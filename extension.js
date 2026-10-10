import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {Indicator} from './src/indicator.js';
import {NetworkMonitor, interfaceLabel} from './src/network.js';
import {CpuMonitor} from './src/cpu.js';
import {parseMeminfo} from './src/memory.js';
import {formatBytes} from './src/format.js';

const decoder = new TextDecoder();

// /proc files live in kernel memory: a sync read takes microseconds and never blocks on disk.
function read(path) {
    const [, bytes] = GLib.file_get_contents(path);
    return decoder.decode(bytes);
}

export default class AJNetUsageExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._net = new NetworkMonitor();
        this._cpu = new CpuMonitor();
        this._last = null;

        this._indicator = new Indicator(() => this.openPreferences());
        // Signals on our own indicator die with indicator.destroy(); no manual disconnect needed.
        this._indicator.menu.connect('open-state-changed', (_menu, open) => {
            if (open)
                this._renderDetails();
        });
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._settingsId = this._settings.connect('changed', () => this._applySettings());
        this._applySettings(); // starts the timer and primes the "previous" readings
    }

    disable() {
        if (this._timerId) {
            GLib.Source.remove(this._timerId);
            this._timerId = 0;
        }
        this._settings.disconnect(this._settingsId);
        this._indicator.destroy();
        this._indicator = null;
        this._settings = null;
        this._net = null;
        this._cpu = null;
        this._last = null;
    }

    _applySettings() {
        this._net.skip = this._settings.get_strv('skip-interfaces');

        if (this._timerId)
            GLib.Source.remove(this._timerId);
        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT,
            this._settings.get_int('refresh-interval'), () => {
                this._tick();
                return GLib.SOURCE_CONTINUE;
            });
        this._tick();
    }

    _tick() {
        try {
            const net = this._net.update(read('/proc/net/dev'), GLib.get_monotonic_time());
            const cpu = this._cpu.update(read('/proc/stat'));
            const mem = parseMeminfo(read('/proc/meminfo'));
            this._last = {net, cpu, mem};

            this._indicator.setValues(
                net ? `${formatBytes(net.rx)}/s` : '—',
                net ? `${formatBytes(net.tx)}/s` : '—',
                !this._settings.get_boolean('show-cpu') ? null
                    : cpu === null ? '—' : `${Math.round(cpu)}%`,
                this._settings.get_boolean('show-ram') ? formatBytes(mem.used) : null);

            if (this._indicator.menu.isOpen)
                this._renderDetails();
        } catch (e) {
            // Never let one bad read kill the timer.
            console.error('AJ-NetUsage:', e);
        }
    }

    _renderDetails() {
        if (!this._last)
            return;
        const {net, cpu, mem} = this._last;
        const lines = [];
        let anyUncounted = false;
        for (const [name, s] of net?.ifaces ?? []) {
            let label = interfaceLabel(name);
            // Hide null labels, and idle uncounted rows (Docker bridges etc.) to keep the list short.
            if (!label || (!s.counted && s.rx === 0 && s.tx === 0))
                continue;
            if (!s.counted) {
                label += '*';
                anyUncounted = true;
            }
            lines.push(`${label.padEnd(17)} ↓ ${formatBytes(s.rx).padStart(6)}/s  ↑ ${formatBytes(s.tx).padStart(6)}/s`);
        }
        if (anyUncounted)
            lines.push('* not added to totals (already counted on the real card)');
        lines.push(
            '',
            `${'Since enabled'.padEnd(17)} ↓ ${formatBytes(this._net.totalRx)}  ↑ ${formatBytes(this._net.totalTx)}`,
            `${'CPU'.padEnd(17)} ${cpu === null ? '—' : `${cpu.toFixed(1)}%`}`,
            `${'RAM'.padEnd(17)} ${formatBytes(mem.used)} / ${formatBytes(mem.total)} (${Math.round(100 * mem.used / mem.total)}%)`);
        this._indicator.setDetails(lines.join('\n'));
    }
}
