// Run: gjs -m test.js   (tests the pure modules; no GNOME Shell needed)
import {parseNetDev, NetworkMonitor, interfaceLabel} from './src/network.js';
import {CpuMonitor} from './src/cpu.js';
import {parseMeminfo} from './src/memory.js';
import {formatBytes} from './src/format.js';

function eq(actual, expected, msg) {
    if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const netDev = (eth0rx, eth0tx) => `Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 9999 10 0 0 0 0 0 0 9999 10 0 0 0 0 0 0
  eth0: ${eth0rx} 50 0 0 0 0 0 0 ${eth0tx} 20 0 0 0 0 0 0
docker0: ${eth0rx} 5 0 0 0 0 0 0 ${eth0tx} 5 0 0 0 0 0 0
`;

// parse
eq(parseNetDev(netDev(5000, 2000)).get('eth0'), {rx: 5000, tx: 2000}, 'parse eth0');

// rates over 2 s; lo and docker shown but not counted in totals
const net = new NetworkMonitor(['lo', 'docker']);
eq(net.update(netDev(5000, 2000), 0), null, 'first reading');
const r = net.update(netDev(9000, 3000), 2e6);
eq([r.rx, r.tx], [2000, 500], 'rate');
eq([...r.ifaces].map(([n, i]) => [n, i.counted]), [['lo', false], ['eth0', true], ['docker0', false]], 'counted flags');
eq([net.totalRx, net.totalTx], [4000, 1000], 'session totals');

// counter reset does not go negative
eq(net.update(netDev(100, 100), 3e6).rx, 0, 'counter reset');

// friendly names
eq(['wlo1', 'enp3s0', 'proton0', 'ipv6leakintrf0', 'lo', 'xyz0'].map(interfaceLabel),
    ['Wi-Fi (wlo1)', 'Ethernet (enp3s0)', 'VPN (proton0)', null, null, 'xyz0'], 'interfaceLabel');

// cpu: 100 busy + 300 idle jiffies between readings = 25%
const cpu = new CpuMonitor();
eq(cpu.update('cpu  100 0 100 800 0 0 0 0 0 0\ncpu0 ...'), null, 'cpu first');
eq(cpu.update('cpu  150 0 150 1100 0 0 0 0 0 0\ncpu0 ...'), 25, 'cpu %');

// memory
eq(parseMeminfo('MemTotal:       16000 kB\nMemFree:  1000 kB\nMemAvailable:   6000 kB\n'),
    {total: 16000 * 1024, used: 10000 * 1024}, 'meminfo');

// format
eq([formatBytes(0), formatBytes(999), formatBytes(1000), formatBytes(1536), formatBytes(512 * 1024),
    formatBytes(1000 * 1024), formatBytes(1.5 * 1024 ** 2)],
['0 B', '999 B', '1.0 KB', '1.5 KB', '512 KB', '1.0 MB', '1.5 MB'], 'format');
// never more than 3 digits, so the fixed-width top bar box always fits
for (let n = 1; n < 1e12; n *= 1.37)
    eq(formatBytes(n).replace(/\D/g, '').length <= 3, true, `max 3 digits for ${n}`);

print('all tests passed');
