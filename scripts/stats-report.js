#!/usr/bin/env node
/*
 * Report denních anonymních statistik (config/stats_daily/days/{YYYY-MM-DD}).
 *
 * Co to dělá: načte posledních N dní, které zapsala funkce dailyStats (běží v 03:10 Europe/Prague
 * a ukládá čísla za pražský včerejšek), a vypíše je jako tabulku. Data jsou jen souhrnná čísla,
 * bez uid, e-mailů a jmen.
 *
 * Použití (z kořene repa):
 *   node scripts/stats-report.js          posledních 14 dní
 *   node scripts/stats-report.js --days=30
 *
 * Přístup: Admin SDK. Klíč servisního účtu se vezme z proměnné GOOGLE_APPLICATION_CREDENTIALS,
 * jinak z prvního souboru *firebase-adminsdk*.json v kořeni repa (je v .gitignore, nic se necommituje).
 * Balíček firebase-admin se hledá v node_modules repa nebo ve functions/node_modules
 * (když chybí: cd functions && npm install).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const daysArg = args.find(a => a.startsWith('--days='));
const DAYS = daysArg ? Number(daysArg.split('=')[1]) : 14;
if (!(DAYS >= 1 && DAYS <= 366)) { console.error('Neplatný počet dní v --days=N (1–366)'); process.exit(1); }

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

// Sloupce: [klíč, záhlaví]
const COLS = [
  ['date', 'Den'],
  ['usersTotal', 'Uživ.'],
  ['active1d', 'Akt.1d'],
  ['active7d', 'Akt.7d'],
  ['active30d', 'Akt.30d'],
  ['newUsers1d', 'Nový1d'],
  ['newUsers7d', 'Nový7d'],
  ['withPushToken', 'Push'],
  ['familiesTotal', 'Skup.'],
  ['familyMembersAvg', 'Čl./sk.'],
  ['aiCallsToday', 'AI'],
  ['errorLogs24h', 'Chyb24h'],
];

function cell(r, k) {
  if (k === 'errorLogs24h' && (r[k] === null || r[k] === undefined) && typeof r.errorLogsTotal === 'number') {
    return '(' + r.errorLogsTotal + ')'; // bez indexu: jen celkový počet
  }
  const v = r[k];
  return v === null || v === undefined ? '–' : String(v);
}

async function main() {
  const admin = loadAdmin();
  const keyFile = findKey();
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyFile, 'utf8'))) });
  const db = admin.firestore();

  // ID dokumentu = YYYY-MM-DD, takže řazení podle ID je řazení podle data
  const snap = await db.collection('config/stats_daily/days')
    .orderBy(admin.firestore.FieldPath.documentId(), 'desc').limit(DAYS).get();
  if (snap.empty) { console.log('Zatím žádné statistiky (funkce dailyStats běží v 03:10).'); return; }
  const rows = snap.docs.map(d => ({ date: d.id, ...d.data() })).reverse();

  const table = [COLS.map(c => c[1]), ...rows.map(r => COLS.map(c => cell(r, c[0])))];
  const widths = COLS.map((_, i) => Math.max(...table.map(t => t[i].length)));
  const line = t => t.map((v, i) => i === 0 ? v.padEnd(widths[i]) : v.padStart(widths[i])).join('  ');
  console.log('Statistiky za posledních ' + rows.length + ' dní:\n');
  console.log(line(table[0]));
  console.log(widths.map(w => '-'.repeat(w)).join('  '));
  table.slice(1).forEach(t => console.log(line(t)));
  console.log('\nAkt. = podle lastSeen (počítá se od běhu funkce), AI = součet volání za den,'
    + ' Chyb24h v závorce = celkový počet (chybí index pro filtr).');
  if (rows.some(r => r.profileErrors > 0)) console.log('Pozor: v některých dnech se nepodařilo načíst část profilů (profileErrors).');
}

main().catch(e => { console.error('Selhalo: ' + (e && e.code || e && e.message || e)); process.exit(1); });
