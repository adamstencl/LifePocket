#!/usr/bin/env node
/*
 * Report technických chyb z appky (users/{uid}/errorLogs).
 *
 * Co to dělá: načte všechny záznamy (collectionGroup 'errorLogs'), vypíše posledních 50
 * seskupené podle zprávy a verze appky (počet výskytů, první a poslední čas, místo v kódu,
 * začátek stacku). Záznamy neobsahují osobní údaje (jen očištěná zpráva, místo v kódu, verze, UA).
 * Do výpisu se nedává ani UID.
 *
 * Použití (z kořene repa):
 *   node scripts/errors-report.js                    výpis posledních 50 chyb
 *   node scripts/errors-report.js --purge-older=90   JEN vypíše, kolik záznamů je starších než 90 dní
 *   node scripts/errors-report.js --purge-older=90 --yes   ty záznamy opravdu SMAŽE (nevratné)
 *
 * Mazání starších než 90 dní doporučujeme spouštět ručně jednou za čas (např. 1× měsíčně);
 * bez přepínače --yes se nic nemaže.
 *
 * Přístup: Admin SDK. Klíč servisního účtu se vezme z proměnné GOOGLE_APPLICATION_CREDENTIALS,
 * jinak z prvního souboru *firebase-adminsdk*.json v kořeni repa (je v .gitignore, nic se necommituje).
 * Balíček firebase-admin se hledá v node_modules repa nebo ve functions/node_modules
 * (když chybí: cd functions && npm install).
 *
 * Bez indexů: řazení a filtrování se dělá v paměti, takže nevyžaduje index collection group.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TOP = 50;

const args = process.argv.slice(2);
const purgeArg = args.find(a => a.startsWith('--purge-older='));
const purgeDays = purgeArg ? Number(purgeArg.split('=')[1]) : null;
const confirmed = args.includes('--yes');
if (purgeArg && !(purgeDays >= 1)) { console.error('Neplatný počet dní v --purge-older=N'); process.exit(1); }

function loadAdmin() {
  try {
    return require(require.resolve('firebase-admin', { paths: [ROOT, path.join(ROOT, 'functions')] }));
  } catch (e) {
    console.error('Chybí balíček firebase-admin. Spusť: cd functions && npm install');
    process.exit(1);
  }
}

function findKey() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const f = fs.readdirSync(ROOT).find(n => /firebase-adminsdk.*\.json$/.test(n));
  if (!f) {
    console.error('Chybí klíč servisního účtu: nastav GOOGLE_APPLICATION_CREDENTIALS nebo dej *firebase-adminsdk*.json do kořene repa.');
    process.exit(1);
  }
  return path.join(ROOT, f);
}

async function main() {
  const admin = loadAdmin();
  const keyFile = findKey();
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyFile, 'utf8'))) });
  const db = admin.firestore();

  const snap = await db.collectionGroup('errorLogs').get();
  const rows = snap.docs.map(d => ({ ref: d.ref, ...d.data() }))
    .filter(r => r && typeof r.ts === 'string')
    .sort((a, b) => b.ts.localeCompare(a.ts));
  console.log('Záznamů celkem: ' + rows.length);

  if (purgeDays) {
    const cutoff = new Date(Date.now() - purgeDays * 86400000).toISOString();
    const old = rows.filter(r => r.ts < cutoff);
    console.log('Starších než ' + purgeDays + ' dní (před ' + cutoff.slice(0, 10) + '): ' + old.length);
    if (!confirmed) { console.log('Nic se nemaže. Pro smazání přidej --yes.'); return; }
    for (let i = 0; i < old.length; i += 400) {
      const batch = db.batch();
      old.slice(i, i + 400).forEach(r => batch.delete(r.ref));
      await batch.commit();
    }
    console.log('Smazáno: ' + old.length);
    return;
  }

  const groups = new Map();
  for (const r of rows.slice(0, TOP)) {
    const key = (r.v || '?') + '\u0000' + (r.msg || '?');
    const g = groups.get(key) || { v: r.v || '?', msg: r.msg || '?', src: r.src || '', stack: r.stack || '', n: 0, first: r.ts, last: r.ts };
    g.n++;
    if (r.ts < g.first) g.first = r.ts;
    if (r.ts > g.last) g.last = r.ts;
    groups.set(key, g);
  }
  console.log('Posledních ' + Math.min(TOP, rows.length) + ' chyb, ' + groups.size + ' různých:\n');
  [...groups.values()].sort((a, b) => b.last.localeCompare(a.last)).forEach(g => {
    console.log('[v' + g.v + '] ' + g.n + '×  ' + g.msg);
    console.log('   místo: ' + (g.src || '?') + '   poprvé ' + g.first.slice(0, 16).replace('T', ' ') + ', naposled ' + g.last.slice(0, 16).replace('T', ' '));
    if (g.stack) console.log('   stack: ' + g.stack.split(' ').slice(0, 24).join(' '));
    console.log('');
  });
}

main().catch(e => { console.error('Selhalo: ' + (e && e.code || e && e.message || e)); process.exit(1); });
