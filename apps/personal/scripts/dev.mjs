// Accept Next flags and the managed preview's Vite-shaped flags without changing its selected port.
import { spawn } from 'node:child_process';
const args = process.argv.slice(2);
let host = '127.0.0.1',
  port = '3000';
for (let i = 0; i < args.length; i++) {
  if (['--host', '--hostname'].includes(args[i])) host = args[++i];
  else if (args[i] === '--port') port = args[++i];
  else if (args[i] !== '--strictPort') throw Error('Unsupported development flag: ' + args[i]);
}
if (!/^\d+$/.test(port)) throw Error('Invalid port');
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'dev', '--hostname', host, '--port', port],
  { stdio: 'inherit' },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 1));
