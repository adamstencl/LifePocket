#!/usr/bin/env node
// Statické kontroly LifePocketu (CI i lokálně: node .github/scripts/ci-check.js)
// Bez závislostí, bez sítě, nečte žádná tajemství.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const errors = [];
let okCount = 0;

const p = f => path.join(ROOT, f);
const read = f => fs.readFileSync(p(f), 'utf8');
function ok(msg) { okCount++; console.log('  OK    ' + msg); }
function fail(msg) { errors.push(msg); console.log('  CHYBA ' + msg); }

// Syntaxe přes node --check; modul (app.js) se zkopíruje do dočasného .mjs
function checkSyntax(file, asModule) {
  let target = p(file);
  let tmpDir = null;
  try {
    if (asModule) {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-ci-'));
      target = path.join(tmpDir, path.basename(file, '.js') + '.mjs');
      fs.copyFileSync(p(file), target);
    }
    execFileSync(process.execPath, ['--check', target], { stdio: 'pipe' });
    ok('syntaxe ' + file + (asModule ? ' (ES modul)' : ''));
  } catch (e) {
    fail('syntaxe ' + file + ': ' + String(e.stderr || e.message).split('\n').slice(0, 6).join(' | '));
  } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function checkJson(file) {
  try { JSON.parse(read(file)); ok('platné JSON ' + file); }
  catch (e) { fail('neplatné JSON ' + file + ': ' + e.message); }
}

// Vytáhne řetězcové literály z textu pole
function stringLiterals(src) {
  return [...src.matchAll(/'([^']*)'|"([^"]*)"/g)].map(m => m[1] !== undefined ? m[1] : m[2]);
}

console.log('Syntaxe');
checkSyntax('app.js', true);
checkSyntax('sw.js', false);
checkSyntax('pwa.js', false);
checkSyntax('functions/index.js', false);

console.log('JSON');
['manifest.json', 'firebase.json', 'functions/package.json'].forEach(checkJson);

console.log('Offline cache (sw.js)');
try {
  const sw = read('sw.js');
  const m = sw.match(/const\s+OFFLINE_URLS\s*=\s*\[([\s\S]*?)\]/);
  if (!m) throw new Error('OFFLINE_URLS nenalezeno');
  const urls = stringLiterals(m[1]);
  if (!urls.length) throw new Error('OFFLINE_URLS je prázdné');
  let missing = 0;
  for (const u of urls) {
    const rel = u.split(/[?#]/)[0].replace(/^\//, '') || 'index.html';
    if (!fs.existsSync(p(rel)) || !fs.statSync(p(rel)).isFile()) { fail('OFFLINE_URLS: chybí soubor ' + u); missing++; }
  }
  if (!missing) ok('všech ' + urls.length + ' souborů z OFFLINE_URLS existuje');
  if (!/const\s+CACHE\s*=\s*['"][^'"]+['"]/.test(sw)) fail('sw.js: chybí konstanta CACHE');
} catch (e) { fail('OFFLINE_URLS: ' + e.message); }

console.log('Verze a CHANGELOG (app.js)');
let appSrc = '';
try {
  appSrc = read('app.js');
  const v = appSrc.match(/const\s+APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!v) throw new Error('APP_VERSION nenalezeno');
  const ver = v[1];
  const cl = appSrc.indexOf('const CHANGELOG');
  if (cl < 0) throw new Error('CHANGELOG nenalezeno');
  // Verze ze záznamů tvaru { v:'4.21', ... } za začátkem CHANGELOGu
  const versions = [...appSrc.slice(cl).matchAll(/\bv\s*:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  if (versions.includes(ver)) ok('APP_VERSION ' + ver + ' má záznam v CHANGELOG');
  else fail("APP_VERSION " + ver + " nemá záznam v CHANGELOG (v:'" + ver + "')");
} catch (e) { fail('APP_VERSION/CHANGELOG: ' + e.message); }

console.log('FAMILY_WORDS vs. firestore.rules');
try {
  const w = appSrc.match(/const\s+FAMILY_WORDS\s*=\s*\[([\s\S]*?)\]/);
  if (!w) throw new Error('FAMILY_WORDS v app.js nenalezeno');
  const appWords = stringLiterals(w[1]);
  const rules = read('firestore.rules');
  const r = rules.match(/familyId\.matches\(\s*'([^']+)'\s*\)/);
  if (!r) throw new Error("pravidlo familyId.matches('...') nenalezeno");
  const rm = r[1].match(/^\^\(([^)]+)\)(.*)\$$/);
  if (!rm) throw new Error('regex pravidla má neočekávaný tvar: ' + r[1]);
  const ruleWords = rm[1].split('|');
  const onlyApp = appWords.filter(x => !ruleWords.includes(x));
  const onlyRule = ruleWords.filter(x => !appWords.includes(x));
  if (new Set(appWords).size !== appWords.length) fail('FAMILY_WORDS obsahuje duplicity');
  if (onlyApp.length || onlyRule.length) {
    fail('seznam slov se liší; jen v app.js: [' + onlyApp.join(',') + '], jen v pravidlech: [' + onlyRule.join(',') + ']');
  } else ok('FAMILY_WORDS shodné s pravidlem (' + appWords.length + ' slov)');
  // Zbytek kódu (část za závorkou) musí odpovídat FAMILY_CODE_RE v app.js
  const codeRe = appSrc.match(/FAMILY_CODE_RE\s*=\s*new RegExp\('\^\(' \+ FAMILY_WORDS\.join\('\|'\) \+ '\)(.*?)\$'\)/);
  if (!codeRe) fail('FAMILY_CODE_RE v app.js má neočekávaný tvar, nelze porovnat příponu');
  else if (codeRe[1] !== rm[2]) fail('přípona kódu se liší; app.js: ' + codeRe[1] + ', pravidla: ' + rm[2]);
  else ok('přípona kódu rodiny shodná (' + rm[2] + ')');
} catch (e) { fail('FAMILY_WORDS: ' + e.message); }

console.log('');
if (errors.length) {
  console.log('SELHALO: ' + errors.length + ' chyb(a), ' + okCount + ' kontrol v pořádku.');
  process.exit(1);
}
console.log('Vše v pořádku (' + okCount + ' kontrol).');
