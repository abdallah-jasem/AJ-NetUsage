const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

// 1536 -> "1.5 KB". At most 3 digits so the top bar text has a fixed max width:
// switch unit at 1000 (not 1024), drop the decimal from 100 up. Append "/s" for speeds.
export function formatBytes(n) {
    let i = 0;
    while (n >= 1000 && i < UNITS.length - 1) {
        n /= 1024;
        i++;
    }
    return `${n.toFixed(i === 0 || n >= 100 ? 0 : 1)} ${UNITS[i]}`;
}
