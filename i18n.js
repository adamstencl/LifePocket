// ── LifePocket i18n: volba jazyka, překlady, formát data ─────────────
// Čeština je výchozí a statická (texty zůstávají i v index.html), angličtina se načte jen když je zvolená.
// Slovníky: i18n/cs.js a i18n/en.js (stejné klíče, hlídá ci-check).
import CS from './i18n/cs.js';

export const SUPPORTED = ['cs', 'en'];
// Fáze 7: automatická volba podle jazyka telefonu. Do té doby jen ?lang=en nebo přepínač v Nastavení.
const AUTO_DETECT = false;
const LOCALES = { cs: 'cs-CZ', en: 'en-GB' }; // en-GB: týden od pondělí, 24h čas

export let LANG = 'cs', LOCALE = 'cs-CZ';
let D = CS;
let PR = null, PR_CS = null;
const missing = new Set();

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
function plural(lang) { try { return new Intl.PluralRules(lang); } catch (e) { return { select: n => (n === 1 ? 'one' : 'other') }; } }

// Ruční přepínač v Nastavení: uloží se do zařízení a příznak lp_lang_sync zajistí zápis do profile.lang (i po offline přepnutí).
// Odkaz ?lang= platí jen pro zařízení před přihlášením (bez příznaku), profil existujícího účtu nepřepisuje.
function rememberLang(l, sync) {
  const okLs = lsSet('lp_lang', l);
  if (sync) lsSet('lp_lang_sync', '1');
  return okLs;
}
// Čeká ruční volba jazyka na zápis do profilu?
export const langSyncPending = () => lsGet('lp_lang_sync') === '1';
export const clearLangSync = () => lsDel('lp_lang_sync');
// Odhlášení: jazyk patří účtu, zařízení se vrací na výchozí volbu
export function clearLangLocal() { lsDel('lp_lang_sync'); lsDel('lp_lang'); }

// Pořadí: ?lang= → lp_lang (kopie profile.lang) → jazyk telefonu (až od fáze 7) → čeština
export function resolveLang() {
  let q = null;
  try { q = new URLSearchParams(location.search).get('lang'); } catch (e) {}
  if (SUPPORTED.includes(q)) { rememberLang(q, false); return q; }
  const ls = lsGet('lp_lang');
  if (SUPPORTED.includes(ls)) return ls;
  if (!AUTO_DETECT) return 'cs';
  const nav = (navigator.languages || [navigator.language || '']).map(x => String(x).slice(0, 2).toLowerCase());
  return nav.some(l => l === 'cs' || l === 'sk') ? 'cs' : 'en';
}

// Adresa bez ?lang= (aby odkaz nepřebil pozdější přepnutí v Nastavení)
function urlWithoutLang() {
  const u = new URL(location.href);
  u.searchParams.delete('lang');
  return u;
}

export async function initI18n() {
  LANG = resolveLang();
  PR_CS = plural('cs');
  if (LANG !== 'cs') {
    try { D = (await import('./i18n/' + LANG + '.js')).default; }
    catch (e) { console.warn('[i18n] slovník se nenačetl, zůstává čeština'); LANG = 'cs'; D = CS; }
  }
  LOCALE = LOCALES[LANG];
  PR = LANG === 'cs' ? PR_CS : plural(LANG);
  try { document.documentElement.lang = LANG; } catch (e) {}
  // ?lang= už je uložené v zařízení → z adresy pryč (jinak by přebíjelo přepínač)
  try {
    if (new URLSearchParams(location.search).has('lang') && lsGet('lp_lang') === LANG)
      history.replaceState(history.state, '', urlWithoutLang().href);
  } catch (e) {}
}

// Vybere text podle klíče; vars.g === 'f' zkusí variantu '#f', objekt = plurál podle vars.n
function pick(dict, rules, key, vars) {
  let v = (vars.g === 'f' && dict[key + '#f'] != null) ? dict[key + '#f'] : dict[key];
  if (v != null && typeof v === 'object') { const n = Number(vars.n) || 0; v = v[rules.select(n)] ?? v.other; } // cs 'many' (1,5) chybí → other
  return v;
}
// Číslo do textu: desetinné podle jazyka (1,5 / 1.5), celé beze změny (roky, úrovně)
const numStr = x => (typeof x === 'number' && Number.isFinite(x) && !Number.isInteger(x)) ? fmtNum(x) : String(x);

// t(): prostý text (textContent, toast, confirm, atributy). Chybějící překlad → čeština → klíč.
export function t(key, vars) {
  vars = vars || {};
  let v = pick(D, PR || PR_CS || plural('cs'), key, vars);
  if (v == null && D !== CS) v = pick(CS, PR_CS || plural('cs'), key, vars);
  if (v == null) {
    if (!missing.has(key)) { missing.add(key); console.warn('[i18n] chybí klíč', key); }
    return key;
  }
  return String(v).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? numStr(vars[k]) : ''));
}
// tN(): plurál podle čísla n (cs one/few/many/other, en one/other), {n} v textu = n. Jediná cesta pro „1 den / 2 dny / 5 dní“.
export const tN = (key, n, vars) => t(key, Object.assign({}, vars, { n }));
// tH(): do innerHTML i atributů; všechny proměnné projdou escapováním, slovník je důvěryhodný (ci-check v něm zakazuje < a ")
export function escH(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;').replace(/"/g, '&quot;'); }
export function tH(key, vars) {
  const o = {};
  for (const [k, x] of Object.entries(vars || {})) o[k] = x == null ? x : (typeof x === 'number' ? x : escH(x));
  return t(key, o);
}
export const tNH = (key, n, vars) => tH(key, Object.assign({}, vars, { n }));

// Statické HTML: data-i18n="klíč" (textContent), data-i18n-attr="placeholder:klíč;aria-label:klíč2"
// Pro češtinu se nic nepřepisuje, texty jsou už v index.html.
export function applyI18n(root) {
  if (LANG === 'cs') return;
  const r = root || document;
  r.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  r.querySelectorAll('[data-i18n-attr]').forEach(el => {
    el.dataset.i18nAttr.split(';').forEach(p => {
      const i = p.indexOf(':');
      if (i > 0) el.setAttribute(p.slice(0, i).trim(), t(p.slice(i + 1).trim()));
    });
  });
  if (r === document) {
    document.title = t('meta.title');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'));
  }
}

// Přepnutí jazyka: uložit do zařízení a načíst stránku znovu (šablony se skládají jednou při startu)
export function reloadWithLang(l) {
  if (!SUPPORTED.includes(l)) return;
  const u = urlWithoutLang();
  if (!rememberLang(l, true)) u.searchParams.set('lang', l); // bez localStorage aspoň přes adresu
  try { sessionStorage.setItem('lp_lang_reload', l); } catch (e) {}
  location.replace(u.href);
}
// Profil má jiný jazyk než zařízení (přepnuto jinde) → převzít, nejvýš jednou za relaci (pojistka proti smyčce)
export function reloadForProfileLang(l) {
  if (!SUPPORTED.includes(l) || l === LANG) return false;
  let guard = null;
  try { guard = sessionStorage.getItem('lp_lang_reload'); } catch (e) { return false; }
  if (guard === l) return false;
  try { sessionStorage.setItem('lp_lang_reload', l); } catch (e) { return false; }
  if (!lsSet('lp_lang', l)) return false;
  location.reload();
  return true;
}

// ── Datum a čísla přes Intl ──
const _dtf = new Map();
const DATE_PRESETS = {
  dm: { day: 'numeric', month: 'short' },
  dM: { day: 'numeric', month: 'long' },
  dmy: { day: 'numeric', month: 'short', year: 'numeric' },
  wdm: { weekday: 'long', day: 'numeric', month: 'long' },
  wdmy: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  my: { month: 'long', year: 'numeric' },
  wShortDm: { weekday: 'short', day: 'numeric', month: 'short' },
};
// d: Date nebo 'YYYY-MM-DD' (bere se poledne místního času, aby se den neposunul)
// Neplatné datum (undefined, null, nesmysl, NaN) → '' místo RangeError
const _toDate = (d, ymdNoon) => {
  if (d == null || d === '') return null;
  const x = d instanceof Date ? d
    : (ymdNoon && typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) ? new Date(d + 'T12:00:00')
    : new Date(d);
  return isNaN(x.getTime()) ? null : x;
};
export function fmtDate(d, preset = 'dm') {
  const x = _toDate(d, true);
  if (!x) return '';
  if (!_dtf.has(preset)) _dtf.set(preset, new Intl.DateTimeFormat(LOCALE, DATE_PRESETS[preset] || DATE_PRESETS.dm));
  return _dtf.get(preset).format(x);
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
// Názvy dnů od pondělí (UI je pondělní)
// raw: bez velkého písmene (cs „út“, en „Tue“) do textu uprostřed věty
// Cache podle LOCALE|style|raw; vrací kopii, aby volající nepřepsal cache
const _wdCache = new Map();
export function weekdayNames(style = 'short', raw = false) {
  const key = LOCALE + '|' + style + '|' + (raw ? 1 : 0);
  let w = _wdCache.get(key);
  if (!w) {
    const f = new Intl.DateTimeFormat(LOCALE, { weekday: style });
    w = [...Array(7)].map((_, i) => { const s = f.format(new Date(2024, 0, 1 + i)); return raw ? s : cap(s); }); // 1. 1. 2024 = pondělí
    _wdCache.set(key, w);
  }
  return w.slice();
}
// Názvy dnů od neděle (index = getDay()), náhrada ručních polí ['Ne','Po',…]
export function dowNames(style = 'short') { const w = weekdayNames(style); return [w[6], ...w.slice(0, 6)]; }
// Čas hh:mm podle jazyka
let _tf = null;
export function fmtTime(d) {
  const x = _toDate(d, false);
  if (!x) return '';
  if (!_tf) _tf = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' });
  return _tf.format(x);
}
export const fmtNum = n => new Intl.NumberFormat(LOCALE).format(n);
