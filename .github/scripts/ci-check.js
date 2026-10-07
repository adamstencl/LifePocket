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
function info(msg) { console.log('  INFO  ' + msg); }
const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

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
  // Nejnovější (první) záznam CHANGELOGu musí patřit aktuální verzi
  if (versions[0] === ver) ok('APP_VERSION ' + ver + ' = první záznam v CHANGELOG');
  else if (versions.includes(ver)) fail("APP_VERSION " + ver + " není prvním záznamem CHANGELOG (první je v:'" + versions[0] + "')");
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

console.log('CACHE v sw.js vs. změněné soubory');
(function checkCacheBump() {
  const WATCHED = ['app.js', 'index.html', 'style.css', 'pwa.js', 'sw.js'];
  const git = args => execFileSync('git', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  const tryGit = args => { try { return git(args); } catch (e) { return null; } };
  if (tryGit(['rev-parse', '--is-inside-work-tree']) !== 'true') { info('git není k dispozici, kontrola přeskočena'); return; }
  const head = tryGit(['rev-parse', 'HEAD']);
  const resolve = ref => ref ? tryGit(['rev-parse', '--verify', '--quiet', ref + '^{commit}']) : null;
  const changedSince = base => {
    const out = tryGit(['diff', '--name-only', base, '--', ...WATCHED]);
    return out === null ? null : out.split('\n').filter(Boolean);
  };
  // Základ: CI_BASE_SHA (z workflow) → merge-base s origin/main → HEAD~1; jinak přeskočit
  let base = null, label = '';
  const envBase = resolve(process.env.CI_BASE_SHA && !/^0+$/.test(process.env.CI_BASE_SHA) ? process.env.CI_BASE_SHA : null);
  if (envBase) { base = envBase; label = 'CI_BASE_SHA'; }
  if (!base && resolve('origin/main')) {
    const mb = tryGit(['merge-base', 'HEAD', 'origin/main']);
    // Na main bez lokálních změn je diff proti origin/main prázdný → zkusí se HEAD~1 (push do main v CI)
    if (mb && !(mb === head && (changedSince(mb) || []).length === 0)) { base = mb; label = 'origin/main'; }
  }
  if (!base && resolve('HEAD~1')) { base = resolve('HEAD~1'); label = 'HEAD~1'; }
  // Jediný commit (mělký checkout), ale neuložené změny → aspoň proti HEAD
  if (!base && head && (changedSince(head) || []).length) { base = head; label = 'HEAD'; }
  if (!base) { info('základ pro diff není k dispozici (mělký checkout?), kontrola přeskočena'); return; }
  const changed = changedSince(base);
  if (changed === null) { info('git diff selhal, kontrola přeskočena'); return; }
  if (!changed.length) { ok('žádná změna ' + WATCHED.join(', ') + ' proti ' + label); return; }
  const cacheRe = /const\s+CACHE\s*=\s*['"]([^'"]+)['"]/;
  const oldSw = tryGit(['show', base + ':sw.js']);
  const oldCache = oldSw && (oldSw.match(cacheRe) || [])[1];
  const newCache = (read('sw.js').match(cacheRe) || [])[1];
  if (!oldCache) { info('CACHE v základu (' + label + ') nenalezen, kontrola přeskočena'); return; }
  if (oldCache !== newCache) ok('CACHE změněn (' + oldCache + ' → ' + newCache + '), změněno: ' + changed.join(', '));
  else fail('změněno ' + changed.join(', ') + ' proti ' + label + ', ale CACHE v sw.js zůstal ' + oldCache);
})();

console.log('Zakázané vzory (app.js)');
// Allowlist = počet výskytů ke dni zavedení kontroly; nový výskyt kontrolu shodí.
// Když výskyty ubydou, sniž číslo (INFO to připomene).
const FORBIDDEN = [
  { name: 'toISOString() pro datum (použij toDS())', allow: 0,
    re: /toISOString\(\)\s*\.\s*(?:(?:slice|substring|substr)\(\s*0\s*,\s*10\s*\)|split\(\s*['"]T['"]\s*\)\s*\[\s*0\s*\])/g },
  { name: "interpolace '${…}' v inline handleru (použij data-aN)", allow: 18,
    re: /\bon\w+=\\?"[^"]*'\$\{/g },
];
for (const f of FORBIDDEN) {
  const hits = [...appSrc.matchAll(f.re)].map(m => lineOf(appSrc, m.index));
  if (hits.length > f.allow) fail(f.name + ': ' + hits.length + ' výskytů, povoleno ' + f.allow + ' (řádky ' + hits.join(',') + ')');
  else {
    ok(f.name + ': ' + hits.length + ' výskytů (allowlist ' + f.allow + ')');
    if (hits.length < f.allow) info('sniž allowlist "' + f.name + '" na ' + hits.length);
  }
}

console.log('Inline handlery → funkce na window');
try {
  const html = read('index.html');
  const pwa = fs.existsSync(p('pwa.js')) ? read('pwa.js') : '';
  const onWin = new Set();
  for (const m of appSrc.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) onWin.add(m[1]);
  for (const m of appSrc.matchAll(/Object\.assign\(\s*window\s*,\s*\{([^}]*)\}/g)) m[1].split(',').forEach(x => onWin.add(x.split(':')[0].trim()));
  // pwa.js a inline <script> bez type=module jsou klasické skripty → top-level deklarace jsou globální
  const classic = [pwa, ...[...html.matchAll(/<script(?![^>]*type=["']module)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1])];
  for (const src of classic) {
    for (const m of src.matchAll(/^(?:async\s+)?function\s+([\w$]+)|^(?:var|let|const)\s+([\w$]+)/gm)) onWin.add(m[1] || m[2]);
    for (const m of src.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) onWin.add(m[1]);
  }
  const BUILTIN = new Set(('if for while switch return typeof void new delete in of await async function catch ' +
    'alert confirm prompt setTimeout clearTimeout setInterval clearInterval requestAnimationFrame fetch open close print scrollTo ' +
    'Math Date Number String Boolean JSON Array Object Promise parseInt parseFloat isNaN encodeURIComponent decodeURIComponent ' +
    'getComputedStyle this event document window localStorage navigator location history console').split(' '));
  const missing = {};
  const scan = (src, name) => {
    // atributy on*="…" (v app.js i s escapovanými uvozovkami \")
    for (const m of src.matchAll(/\bon[a-z]+=(\\?["'])([\s\S]*?)\1/g)) {
      let code = m[2]
        .replace(/'\s*\+\s*'/g, '')          // handler poskládaný z více JS řetězců
        .replace(/\\(['"])/g, '$1')           // \' → '
        .replace(/'[^']*'|"[^"]*"/g, '""')     // řetězcové literály
        .replace(/\$\{/g, ' ');               // ${…} jen otevřít, obsah se kontroluje dál
      // lokální proměnné a cíle přiřazení se ignorují
      const locals = new Set();
      for (const d of code.matchAll(/\b(?:var|let|const)\s+([^;]*)/g))
        for (const n of d[1].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)/g)) locals.add(n[1]);
      for (const a of code.matchAll(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*=(?![=>])/g)) locals.add(a[1]);
      // jen volání identifikátorů, které nejsou za tečkou (metody objektů se přeskočí)
      for (const t of code.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
        const id = t[2];
        if (BUILTIN.has(id) || onWin.has(id) || locals.has(id)) continue;
        (missing[id] = missing[id] || []).push(name + ':' + lineOf(src, m.index));
      }
    }
  };
  scan(html, 'index.html');
  scan(appSrc, 'app.js');
  const ids = Object.keys(missing);
  if (!ids.length) ok('všechny funkce z inline handlerů jsou na window (' + onWin.size + ' exportů)');
  else ids.forEach(id => fail('inline handler volá ' + id + '(), ale chybí window.' + id + ' (' + [...new Set(missing[id])].join(' ') + ')'));
} catch (e) { fail('inline handlery: ' + e.message); }

console.log('');
if (errors.length) {
  console.log('SELHALO: ' + errors.length + ' chyb(a), ' + okCount + ' kontrol v pořádku.');
  process.exit(1);
}
console.log('Vše v pořádku (' + okCount + ' kontrol).');
