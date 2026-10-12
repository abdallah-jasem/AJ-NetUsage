import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {Indicator} from './src/indicator.js';
import {NetworkMonitor, interfaceLabel} from './src/network.js';
import {CpuMonitor} from './src/cpu.js';
import {parseMeminfo} from './src/memory.js';
import {formatBytes} from './src/format.js';

// Async read, so the shell main loop is never blocked (review guideline: no sync file IO).
function readAsync(path, cancellable) {
    return new Promise((resolve, reject) => {
        Gio.File.new_for_path(path).load_contents_async(cancellable, (file, result) => {
            try {
                const [, bytes] = file.load_contents_finish(result);
                resolve(new TextDecoder().decode(bytes));
            } catch (e) {
                reject(e);
            }
        });
    });
}

export default class AJNetUsageExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._net = new NetworkMonitor();
        this._cpu = new CpuMonitor();
        this._last = null;
        this._cancellable = new Gio.Cancellable();

        this._indicator = new Indicator(() => this.openPreferences());
        this._menuId = this._indicator.menu.connect('open-state-changed', (_menu, open) => {
            if (open)
                this._renderDetails();
        });
        Main.panel.addToStatusArea(this.uuid, this._indicator); // right; _place() moves it

        this._settingsId = this._settings.connect('changed', () => this._applySettings());
        this._applySettings(); // starts the timer and primes the "previous" readings
    }

    disable() {
        if (this._timerId) {
            GLib.Source.remove(this._timerId);
            this._timerId = 0;
        }
        this._cancellable.cancel(); // drops any read still in flight
        this._cancellable = null;
        this._settings.disconnect(this._settingsId);
        this._indicator.menu.disconnect(this._menuId);
        this._indicator.destroy();
        this._indicator = null;
        this._settings = null;
        this._net = null;
        this._cpu = null;
        this._last = null;
    }

    _applySettings() {
        this._net.skip = this._settings.get_strv('skip-interfaces');
        this._place();

        if (this._timerId)
            GLib.Source.remove(this._timerId);
        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT,
            this._settings.get_int('refresh-interval'), () => {
                this._tick();
                return GLib.SOURCE_CONTINUE;
            });
        this._tick();
    }

    // Move the indicator when the position setting changes. Left/center: after what is
    // already there; right: first, like addToStatusArea's default.
    _place() {
        const pos = this._settings.get_string('position');
        const box = Main.panel[`_${pos}Box`];
        const container = this._indicator.container;
        if (container.get_parent() === box)
            return;
        container.get_parent().remove_child(container);
        box.insert_child_at_index(container, pos === 'right' ? 0 : -1);
    }

    async _tick() {
        const cancellable = this._cancellable;
        try {
            const [netText, statText, memText] = await Promise.all(
                ['/proc/net/dev', '/proc/stat', '/proc/meminfo'].map(p => readAsync(p, cancellable)));
            if (cancellable.is_cancelled())
                return;

            const net = this._net.update(netText, GLib.get_monotonic_time());
            const cpu = this._cpu.update(statText);
            const mem = parseMeminfo(memText);
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
            // Cancelled = extension was disabled mid-read; nothing to do.
            if (e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                return;
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
