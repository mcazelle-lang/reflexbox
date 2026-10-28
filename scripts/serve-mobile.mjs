// Sert l'app sur https://reflexbox.local pour le téléphone :
// annonce le nom en mDNS (Bonjour) sur le réseau local, puis lance le serveur de dev Angular.
import { spawn } from 'node:child_process';
import http from 'node:http';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import makeMdns from 'multicast-dns';

const HOST = 'reflexbox.local';
const PORT = process.env.PORT ?? '443';

/** Adresse IPv4 du PC sur le réseau local (recalculée à chaque requête si elle change). */
function lanAddress() {
  const candidates = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254.'));
  const isPrivate = (a) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a);
  return (candidates.find((i) => isPrivate(i.address)) ?? candidates[0])?.address;
}

const mdns = makeMdns();

function answers() {
  const ip = lanAddress();
  return ip ? [{ name: HOST, type: 'A', ttl: 120, flush: true, data: ip }] : [];
}

mdns.on('query', (query, rinfo) => {
  const asked = query.questions.some(
    (q) => q.name.toLowerCase() === HOST && (q.type === 'A' || q.type === 'ANY'),
  );
  if (!asked) return;
  const records = answers();
  if (!records.length) return;
  if (rinfo.port !== 5353) {
    // Requête « legacy » (port source ≠ 5353, ex. certains résolveurs) : réponse directe à l'émetteur.
    mdns.respond({ id: query.id, questions: query.questions, answers: records }, rinfo);
  } else {
    mdns.respond({ answers: records });
  }
});

// Annonce spontanée au démarrage, pour les appareils qui écoutent déjà.
mdns.respond({ answers: answers() });

const ip = lanAddress();
const portSuffix = PORT === '443' ? '' : `:${PORT}`;
console.log(`\n  📱 Sur le téléphone (même Wi-Fi) : https://${HOST}${portSuffix}`);
console.log(`     Si le nom n'est pas résolu : https://${ip}${portSuffix}\n`);

// Taper « reflexbox.local » ouvre http:// (port 80) : on redirige vers https://.
const redirect = http.createServer((req, res) => {
  const host = (req.headers.host ?? HOST).replace(/:\d+$/, '');
  res.writeHead(301, { Location: `https://${host}${portSuffix}${req.url}` });
  res.end();
});
redirect.on('error', (e) => console.warn(`  (Redirection http → https indisponible : ${e.message})`));
redirect.listen(80, '0.0.0.0');

const ng = fileURLToPath(new URL('../node_modules/@angular/cli/bin/ng.js', import.meta.url));
const server = spawn(process.execPath, [ng, 'serve', '--host', '0.0.0.0', '--port', PORT, '--ssl'], {
  stdio: 'inherit',
});

const shutdown = () => {
  mdns.destroy();
  redirect.close();
  server.kill();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
server.on('exit', (code) => {
  mdns.destroy();
  redirect.close();
  process.exit(code ?? 0);
});
