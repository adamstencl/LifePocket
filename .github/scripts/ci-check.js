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
checkSyntax('i18n.js', true);
checkSyntax('i18n/cs.js', true);
checkSyntax('i18n/en.js', true);
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
  // Generátor (FAMILY_CODE_ALPHABET) musí používat přesně znaky z třídy v pravidlech
  const alpha = appSrc.match(/const\s+FAMILY_CODE_ALPHABET\s*=\s*'([^']+)'/);
  const cls = rm[2].match(/\[([^\]]+)\]/);
  if (!alpha || !cls) fail('FAMILY_CODE_ALPHABET nebo znaková třída v pravidle nenalezena');
  else {
    const set = [];
    cls[1].replace(/(.)-(.)|(.)/g, (m, a, b, c) => {
      if (c) set.push(c); else for (let i = a.charCodeAt(0); i <= b.charCodeAt(0); i++) set.push(String.fromCharCode(i));
    });
    if ([...alpha[1]].sort().join('') !== set.sort().join('')) fail('FAMILY_CODE_ALPHABET (' + alpha[1] + ') neodpovídá třídě v pravidle [' + cls[1] + ']');
    else ok('abeceda kódu shodná s pravidlem (' + alpha[1].length + ' znaků)');
  }
} catch (e) { fail('FAMILY_WORDS: ' + e.message); }

console.log('FAMILY_WORDS a abeceda: functions/index.js vs. app.js');
try {
  const fn = read('functions/index.js');
  const w = fn.match(/const\s+FAMILY_WORDS\s*=\s*\[([\s\S]*?)\]/);
  const a = fn.match(/const\s+FAMILY_CODE_ALPHABET\s*=\s*'([^']+)'/);
  const aw = appSrc.match(/const\s+FAMILY_WORDS\s*=\s*\[([\s\S]*?)\]/);
  const aa = appSrc.match(/const\s+FAMILY_CODE_ALPHABET\s*=\s*'([^']+)'/);
  if (!w || !a) throw new Error('FAMILY_WORDS nebo FAMILY_CODE_ALPHABET ve functions/index.js nenalezeno');
  if (!aw || !aa) throw new Error('FAMILY_WORDS nebo FAMILY_CODE_ALPHABET v app.js nenalezeno');
  const fw = stringLiterals(w[1]), apw = stringLiterals(aw[1]);
  if (fw.join(',') !== apw.join(',')) fail('FAMILY_WORDS ve functions/index.js se liší od app.js');
  else ok('FAMILY_WORDS ve functions shodné s app.js (' + fw.length + ' slov)');
  if (a[1] !== aa[1]) fail('FAMILY_CODE_ALPHABET ve functions/index.js (' + a[1] + ') se liší od app.js (' + aa[1] + ')');
  else ok('FAMILY_CODE_ALPHABET ve functions shodná s app.js');
} catch (e) { fail('functions FAMILY_WORDS: ' + e.message); }

console.log('CACHE v sw.js vs. změněné soubory');
(function checkCacheBump() {
  const WATCHED = ['app.js', 'index.html', 'style.css', 'pwa.js', 'sw.js', 'i18n.js', 'i18n/cs.js', 'i18n/en.js'];
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
  { name: "interpolace '${…}' v inline handleru (použij data-aN)", allow: 14,
    re: /\bon\w+=\\?"[^"]*'\$\{/g },
  // Záznam návyku se píše jen přes putHabitLog / delHabitLog (zrcadlo sdíleného návyku ve skupině)
  { name: "přímý zápis doc(…'habitLogs'…) mimo putHabitLog/delHabitLog", allow: 2,
    re: /\bdoc\(\s*db\s*,\s*'users'\s*,[^)]*'habitLogs'/g },
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

// Ráčny vícejazyčnosti (docs/NAVRH-I18N.md): každá fáze překladu čísla sníží, nový český text mimo slovník CI shodí
const I18N_ALLOW = { appCz: 1075, htmlCz: 158, csCZ: 24, manualPlural: 0 };
console.log('i18n: slovníky a použité klíče');
// Slovník je ES modul „export default { … }“ s čistým objektem; načte se bez importu přes vm
function loadDict(f) {
  const vm = require('vm');
  const src = read(f).replace(/^\s*export\s+default\s+/m, 'result = ');
  const ctx = { result: null };
  vm.runInNewContext(src, ctx, { filename: f, timeout: 1000 });
  if (!ctx.result || typeof ctx.result !== 'object') throw new Error(f + ': chybí export default {…}');
  return ctx.result;
}
const I18N_CZ = /[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/;
let i18nCs = null;
try {
  const cs = loadDict('i18n/cs.js'), en = loadDict('i18n/en.js');
  i18nCs = cs;
  const base = k => k.replace(/#f$/, '');
  const kc = new Set(Object.keys(cs).map(base)), ke = new Set(Object.keys(en).map(base));
  const onlyCs = [...kc].filter(k => !ke.has(k)), onlyEn = [...ke].filter(k => !kc.has(k));
  onlyCs.forEach(k => fail('i18n/en.js: chybí klíč ' + k));
  onlyEn.forEach(k => fail('i18n/cs.js: chybí klíč ' + k));
  if (!onlyCs.length && !onlyEn.length) ok('cs a en mají stejné klíče (' + kc.size + ')');
  // Plurály: cs { one, few, other }, en { one, other }; stejný typ hodnoty v obou jazycích
  const FORMS = { cs: ['one', 'few', 'other'], en: ['one', 'other'] };
  let badPl = 0;
  for (const [lang, d] of [['cs', cs], ['en', en]]) {
    for (const [k, v] of Object.entries(d)) {
      if (v && typeof v === 'object') {
        const miss = FORMS[lang].filter(f => typeof v[f] !== 'string');
        if (miss.length) { fail('i18n/' + lang + '.js: plurál ' + k + ' nemá tvary ' + miss.join(',')); badPl++; }
      } else if (typeof v !== 'string') { fail('i18n/' + lang + '.js: ' + k + ' není text ani plurál'); badPl++; }
    }
  }
  for (const k of kc) {
    if (!ke.has(k) || !(k in cs) || !(k in en)) continue;
    if ((typeof cs[k] === 'object') !== (typeof en[k] === 'object')) { fail('i18n: ' + k + ' je plurál jen v jednom jazyce'); badPl++; }
  }
  if (!badPl) ok('tvary plurálů v pořádku');
  // Bezpečnost: hodnoty jdou do innerHTML i atributů (title="…", data-i18n-attr) → žádné < a ".
  // Uvozovky jen u výslovně textových klíčů (jen textContent), ty se nesmí použít v atributu.
  const QUOTE_TEXT_ONLY = new Set(['ios.s2b', 'dash.ev']);
  let badChars = 0;
  const attrKeys = new Set();
  for (const m of read('index.html').matchAll(/data-i18n-attr="([^"]+)"/g)) m[1].split(';').forEach(x => attrKeys.add(x.slice(x.indexOf(':') + 1).trim()));
  for (const [lang, d] of [['cs', cs], ['en', en]]) {
    for (const [k, v] of Object.entries(d)) {
      const txt = v && typeof v === 'object' ? Object.values(v).join(' ') : String(v);
      if (txt.includes('<')) { fail('i18n/' + lang + '.js: ' + k + ' obsahuje „<“ (HTML do slovníku nepatří)'); badChars++; }
      if (txt.includes('"') && (!QUOTE_TEXT_ONLY.has(base(k)) || attrKeys.has(base(k)))) { fail('i18n/' + lang + '.js: ' + k + ' obsahuje uvozovku " (použij „“ nebo “”)'); badChars++; }
    }
  }
  if (!badChars) ok('slovníky bez < a " (mimo textové klíče ' + [...QUOTE_TEXT_ONLY].join(', ') + ')');
  // Stejné {proměnné} v obou jazycích (varianta #f musí mít stejné jako základní klíč)
  const vars = v => JSON.stringify([...new Set(String(v && typeof v === 'object' ? Object.values(v).join(' ') : v).match(/\{\w+\}/g) || [])].sort());
  let badVars = 0;
  for (const k of Object.keys(cs)) {
    const b = base(k);
    const other = [en[k], en[b], cs[b]].filter(x => x !== undefined);
    for (const o of other) if (vars(cs[k]) !== vars(o)) { fail('i18n: proměnné se liší u ' + k); badVars++; break; }
  }
  if (!badVars) ok('proměnné {…} shodné v cs a en');
  // Použité klíče: t('…'), tH('…'), řetězce tvaru 'jmenný.prostor.klíč' v app.js, data-i18n a data-i18n-attr v index.html
  const html = read('index.html');
  const ns = new Set(Object.keys(cs).map(k => k.split('.')[0]));
  const used = new Set();
  for (const m of appSrc.matchAll(/\bt[H]?\(\s*'([\w.#-]+)'/g)) if (!m[1].endsWith('.')) used.add(m[1]);
  for (const m of appSrc.matchAll(/'([a-z][\w]*(?:\.[\w#-]+)+)'/g)) if (ns.has(m[1].split('.')[0])) used.add(m[1]);
  for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) used.add(m[1].trim());
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) m[1].split(';').forEach(x => used.add(x.slice(x.indexOf(':') + 1).trim()));
  const missingKeys = [...used].filter(k => !(k in cs));
  missingKeys.forEach(k => fail('i18n: klíč neexistuje: ' + k));
  if (!missingKeys.length) ok('všech ' + used.size + ' použitých klíčů existuje');
  // Dynamické klíče: 'mod.' + id → každý modul z MODS musí mít překlad
  const mods = appSrc.match(/const\s+MODS\s*=\s*\[([\s\S]*?)\n\];/);
  if (mods) {
    const ids = [...mods[1].matchAll(/\{\s*id\s*:\s*'([\w-]+)'/g)].map(m => m[1]);
    const miss = ids.filter(id => !(('mod.' + id) in cs));
    if (miss.length) fail('i18n: moduly bez překladu mod.*: ' + miss.join(','));
    else ok('všech ' + ids.length + ' modulů má klíč mod.<id>');
  }
  // Nepoužité klíče jen jako informace (část klíčů se skládá dynamicky)
  const dynPrefixes = [...appSrc.matchAll(/'([a-z][\w]*(?:\.[\w-]+)*\.)'\s*\+/g)].map(m => m[1]);
  const unused = Object.keys(cs).map(base).filter(k => !used.has(k) && !dynPrefixes.some(p => k.startsWith(p)) && !k.startsWith('meta.'));
  if (unused.length) info('nepoužité klíče (' + unused.length + '): ' + [...new Set(unused)].slice(0, 15).join(', '));
  // Čeština v index.html = slovník (HTML je pro cs zdroj, slovník se nepoužije → nesmí se rozjet)
  const norm = x => String(x).replace(/\s+/g, ' ').trim();
  const decode = x => x.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  let diff = 0;
  for (const m of html.matchAll(/<(\w+)\b([^>]*?)\sdata-i18n="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g)) {
    const k = m[3], inner = m[4];
    if (/</.test(inner)) { fail('index.html: prvek s data-i18n="' + k + '" obsahuje HTML (rozděl na spany)'); diff++; continue; }
    if (k in cs && typeof cs[k] === 'string' && norm(decode(inner)) !== norm(cs[k])) { fail('index.html: text u data-i18n="' + k + '" se liší od i18n/cs.js'); diff++; }
  }
  for (const m of html.matchAll(/<\w+\b[^>]*\sdata-i18n-attr="([^"]+)"[^>]*>/g)) {
    for (const part of m[1].split(';')) {
      const i = part.indexOf(':'), a = part.slice(0, i).trim(), k = part.slice(i + 1).trim();
      const am = m[0].match(new RegExp('\\s' + a + '="([^"]*)"'));
      if (am && k in cs && norm(decode(am[1])) !== norm(cs[k])) { fail('index.html: atribut ' + a + ' u klíče ' + k + ' se liší od i18n/cs.js'); diff++; }
    }
  }
  if (!diff) ok('texty s data-i18n v index.html odpovídají i18n/cs.js');
} catch (e) { fail('i18n slovníky: ' + e.message); }

console.log('i18n: ráčny (český text mimo slovník)');
// Řetězcové a šablonové literály mimo komentáře (zjednodušený lexer: řetězce, šablony s ${…}, komentáře, regexy)
function jsLiterals(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  const isRegexCtx = pos => {
    let j = pos - 1;
    while (j >= 0 && /\s/.test(src[j])) j--;
    if (j < 0) return true;
    if (/[(,=:[!&|?{};+\-*%<>~^]/.test(src[j])) return true;
    const w = src.slice(Math.max(0, j - 9), j + 1).match(/(?:return|typeof|case|in|of|delete|void|throw|new|else|do)$/);
    return !!(w && !/[\w$]/.test(src[j - w[0].length] || ''));
  };
  function code(untilBrace) {
    let depth = 0;
    while (i < n) {
      const c = src[i], d = src[i + 1];
      if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
      if (c === '\'' || c === '"') {
        const st = i; i++;
        let s = '';
        while (i < n && src[i] !== c) { if (src[i] === '\\') { s += src[i + 1]; i += 2; continue; } if (src[i] === '\n') break; s += src[i++]; }
        i++; out.push({ s, at: st }); continue;
      }
      if (c === '`') { i++; tpl(); continue; }
      if (c === '/' && isRegexCtx(i)) {
        i++;
        let cls = false;
        while (i < n && src[i] !== '\n') {
          if (src[i] === '\\') { i += 2; continue; }
          if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; else if (src[i] === '/' && !cls) break;
          i++;
        }
        i++; continue;
      }
      if (c === '{') depth++;
      if (c === '}') { if (untilBrace && depth === 0) { i++; return; } depth--; }
      i++;
    }
  }
  function tpl() {
    let st = i, s = '';
    while (i < n) {
      const c = src[i];
      if (c === '\\') { s += src[i + 1]; i += 2; continue; }
      if (c === '`') { i++; out.push({ s, at: st }); return; }
      if (c === '$' && src[i + 1] === '{') { out.push({ s, at: st }); i += 2; code(true); st = i; s = ''; continue; }
      s += c; i++;
    }
  }
  code(false);
  return out;
}
// Allowlist = stav při zavedení; nový výskyt CI shodí, při úbytku INFO připomene snížení
function ratchet(name, count, allow, detail) {
  if (count > allow) fail(name + ': ' + count + ', povoleno ' + allow + (detail ? ' (' + detail + ')' : ''));
  else {
    ok(name + ': ' + count + ' (allowlist ' + allow + ')');
    if (count < allow) info('sniž allowlist "' + name + '" na ' + count);
  }
}
try {
  const clStart = appSrc.indexOf('const CHANGELOG');
  const clEnd = clStart < 0 ? -1 : appSrc.indexOf('\n];', clStart);
  const lits = jsLiterals(appSrc).filter(l => I18N_CZ.test(l.s) && !(l.at > clStart && l.at < clEnd));
  ratchet('české literály v app.js (mimo CHANGELOG)', lits.length, I18N_ALLOW.appCz);
} catch (e) { fail('ráčna app.js: ' + e.message); }
try {
  // Textové uzly a atributy s češtinou v index.html bez data-i18n (translate="no" = záměrně nepřekládat)
  const html = read('index.html').replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');
  const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
  const stack = [];
  let count = 0;
  const re = /<\/?([a-zA-Z][\w-]*)\b([^>]*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[3] !== undefined) {
      const txt = m[3];
      if (!I18N_CZ.test(txt)) continue;
      const parent = stack[stack.length - 1];
      const skip = stack.some(s => /\stranslate="no"/.test(s.attrs)) || (parent && /\sdata-i18n="/.test(parent.attrs));
      if (!skip) count++;
      continue;
    }
    const name = m[1].toLowerCase(), attrs = m[2] || '';
    if (m[0][1] === '/') {
      const idx = stack.map(s => s.name).lastIndexOf(name);
      if (idx >= 0) stack.length = idx;
      continue;
    }
    for (const a of attrs.matchAll(/\s(placeholder|aria-label|title|alt)="([^"]*)"/g)) {
      if (!I18N_CZ.test(a[2])) continue;
      const tr = (attrs.match(/\sdata-i18n-attr="([^"]*)"/) || [])[1] || '';
      if (!tr.split(';').some(x => x.split(':')[0].trim() === a[1])) count++;
    }
    if (!VOID.has(name) && !/\/\s*$/.test(attrs)) stack.push({ name, attrs });
  }
  ratchet('české texty v index.html bez data-i18n', count, I18N_ALLOW.htmlCz);
} catch (e) { fail('ráčna index.html: ' + e.message); }
{
  const csCz = (appSrc.match(/'cs-CZ'/g) || []).length;
  ratchet("'cs-CZ' v app.js (použij LOCALE / fmtDate)", csCz, I18N_ALLOW.csCZ);
  const manualPl = (appSrc.match(/===\s*1\s*\?[^:]+:\s*\w+\s*<\s*5/g) || []).length;
  ratchet('ruční plurál x===1?…:x<5 (použij t(…,{n}))', manualPl, I18N_ALLOW.manualPlural);
}

console.log('');
if (errors.length) {
  console.log('SELHALO: ' + errors.length + ' chyb(a), ' + okCount + ' kontrol v pořádku.');
  process.exit(1);
}
console.log('Vše v pořádku (' + okCount + ' kontrol).');
