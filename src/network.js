// Parse /proc/net/dev text into Map(name -> {rx, tx}) of cumulative byte counters.
export function parseNetDev(text) {
    const result = new Map();
    for (const line of text.split('\n').slice(2)) {
        const [name, data] = line.split(':');
        if (!data)
            continue;
        const f = data.trim().split(/\s+/).map(Number);
        result.set(name.trim(), {rx: f[0], tx: f[8]});
    }
    return result;
}

export class NetworkMonitor {
    constructor(skip = []) {
        this.skip = skip; // interface name prefixes to ignore
        this.totalRx = 0; // bytes since this monitor was created
        this.totalTx = 0;
        this._prev = null;
        this._prevTime = 0;
    }

    // nowUs: GLib.get_monotonic_time(). Returns null on the first call (no previous reading).
    update(text, nowUs) {
        const cur = parseNetDev(text);
        const prev = this._prev;
        const dt = (nowUs - this._prevTime) / 1e6;
        this._prev = cur;
        this._prevTime = nowUs;
        if (!prev || dt <= 0)
            return null;

        const ifaces = new Map();
        let rx = 0, tx = 0;
        for (const [name, c] of cur) {
            const p = prev.get(name);
            if (!p)
                continue;
            // Counter went down = interface reset; count nothing for this interval.
            const drx = Math.max(0, c.rx - p.rx);
            const dtx = Math.max(0, c.tx - p.tx);
            // Skipped interfaces (VPN, virtual) still show in the popup, but their traffic
            // also goes through the real card, so adding them to the totals would double count.
            const counted = !this.skip.some(prefix => name.startsWith(prefix));
            if (counted) {
                rx += drx;
                tx += dtx;
            }
            ifaces.set(name, {rx: drx / dt, tx: dtx / dt, counted});
        }
        this.totalRx += rx;
        this.totalTx += tx;
        return {rx: rx / dt, tx: tx / dt, ifaces};
    }
}

// Friendly popup name by interface name prefix; null = hide (never carries useful traffic).
const KINDS = [
    ['lo', null],
    ['ipv6leakintrf', null], // Proton VPN IPv6 leak guard, always ~0
    ['wl', 'Wi-Fi'],
    ['en', 'Ethernet'],
    ['eth', 'Ethernet'],
    ['proton', 'VPN'],
    ['tun', 'VPN'],
    ['wg', 'VPN'],
    ['tap', 'VPN'],
    ['ppp', 'VPN'],
    ['docker', 'Docker'],
    ['br-', 'Docker'],
    ['veth', 'Docker'],
    ['virbr', 'VM'],
];

export function interfaceLabel(name) {
    const kind = KINDS.find(([prefix]) => name.startsWith(prefix));
    if (!kind)
        return name;
    return kind[1] && `${kind[1]} (${name})`;
}
