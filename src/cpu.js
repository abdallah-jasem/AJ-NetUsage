export class CpuMonitor {
    constructor() {
        this._prev = null;
    }

    // text: /proc/stat. Returns CPU % since the previous call, or null on the first call.
    update(text) {
        // "cpu user nice system idle iowait irq softirq steal guest guest_nice"
        // guest fields are already counted in user/nice, so only sum the first 8.
        const f = text.split('\n')[0].trim().split(/\s+/).slice(1, 9).map(Number);
        const idle = f[3] + f[4];
        const total = f.reduce((a, b) => a + b, 0);

        const prev = this._prev;
        this._prev = {idle, total};
        if (!prev || total <= prev.total)
            return null;
        return 100 * (1 - (idle - prev.idle) / (total - prev.total));
    }
}
