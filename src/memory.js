// text: /proc/meminfo. Returns {total, used} in bytes; used = MemTotal - MemAvailable.
export function parseMeminfo(text) {
    const bytes = key => Number(text.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'))?.[1] ?? 0) * 1024;
    const total = bytes('MemTotal');
    return {total, used: total - bytes('MemAvailable')};
}
