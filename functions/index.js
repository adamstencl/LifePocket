const {onSchedule} = require('firebase-functions/v2/scheduler');
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue, FieldPath, Timestamp} = require('firebase-admin/firestore');
const {getMessaging} = require('firebase-admin/messaging');
const {getAuth} = require('firebase-admin/auth');
const {tS, normLang} = require('./i18n-server');

initializeApp();
const db = getFirestore();

// ── Claude Proxy ──────────────────────────────────────────────────────────────
// Volání Claude API ze serveru — klíč nikdy neopustí backend
const DAILY_LIMIT = 50;
// Strop vstupu (ochrana nákladů). Chat = systém (~2 000 + paměť 6 000 + kontext 7 000) + 10 zpráv;
// souhrn paměti posílá celou starší konverzaci v jedné zprávě, proto znaky s rezervou
const MAX_MESSAGES = 22;          // včetně systémové zprávy
const MAX_INPUT_CHARS = 60000;    // součet všech textů včetně systému
const DEFAULT_MAX_TOKENS = 500;
const MAX_TOKENS_CAP = 2000;
const CLAUDE_TIMEOUT_MS = 45000;

// Výběr modelu z config/ai (pole model, u 5.5 volitelně effort) — přepnutí bez nasazení.
// Jen hodnoty z allowlistu; chybějící nebo neplatný dokument = výchozí Haiku 4.5.
const AI_MODEL_HAIKU45 = 'claude-haiku-4-5-20251001';
const AI_MODEL_HAIKU55 = 'claude-haiku-5-5';
const AI_MODELS = [AI_MODEL_HAIKU45, AI_MODEL_HAIKU55];
const AI_DEFAULT_MODEL = AI_MODEL_HAIKU45;
const AI_EFFORTS = ['low', 'medium', 'high']; // thinking:disabled je u 5.5 povolené jen při těchto úrovních
const AI_DEFAULT_EFFORT = 'medium';
const AI_CONFIG_TTL_MS = 5 * 60 * 1000;

function normAiConfig(d) {
  const m = (d && typeof d.model === 'string') ? d.model.trim() : '';
  const model = AI_MODELS.includes(m) ? m : AI_DEFAULT_MODEL;
  if (m && model !== m) console.warn('[LP] config/ai.model není povolený, používám výchozí model.');
  const e = (d && typeof d.effort === 'string') ? d.effort.trim().toLowerCase() : '';
  const effort = AI_EFFORTS.includes(e) ? e : AI_DEFAULT_EFFORT;
  return {model, effort};
}

// Cache v instanci na 5 min; při chybě čtení platí poslední známá (nebo výchozí) hodnota
let cachedAiConfig = null;
let cachedAiConfigAt = 0;
async function getAiConfig() {
  const now = Date.now();
  if (cachedAiConfig && now - cachedAiConfigAt < AI_CONFIG_TTL_MS) return cachedAiConfig;
  let cfg;
  try {
    const snap = await db.doc('config/ai').get();
    cfg = normAiConfig(snap.exists ? snap.data() : null);
  } catch(e) {
    console.error('[LP] Načtení config/ai selhalo:', e.code || e.message);
    cfg = cachedAiConfig || normAiConfig(null);
  }
  cachedAiConfig = cfg;
  cachedAiConfigAt = now;
  return cfg;
}

// Tělo requestu podle modelu. Nikdy neposílá temperature/top_p/top_k (u 5.5 = 400).
// Haiku 5.5 má thinking ve výchozím stavu zapnuté a počítá se do max_tokens → vypínáme ho.
function buildClaudeBody(cfg, input) {
  const body = {
    model: cfg.model,
    max_tokens: input.maxTokens,
    system: input.system,
    messages: input.messages
  };
  if (cfg.model === AI_MODEL_HAIKU55) {
    body.thinking = {type: 'disabled'};
    body.output_config = {effort: cfg.effort};
  }
  return body;
}

// Odpověď: text = spojení všech bloků type 'text' (5.5 může začínat blokem thinking)
function parseClaudeResponse(body) {
  const stopReason = body?.stop_reason || null;
  const blocks = Array.isArray(body?.content) ? body.content : [];
  const text = blocks
    .filter(b => b && b.type === 'text' && typeof b.text === 'string')
    .map(b => b.text)
    .join('');
  return {text, stopReason, refusalCategory: stopReason === 'refusal' ? (body?.stop_details?.category || null) : null};
}

// Klíč z config/secrets: načte se jednou za instanci, neúspěch se necachuje (příště znovu)
let cachedClaudeKey = null;
async function getClaudeKey(L) {
  if (cachedClaudeKey) return cachedClaudeKey;
  const secretsSnap = await db.doc('config/secrets').get();
  if (!secretsSnap.exists) throw new HttpsError('not-found', tS(L, 'err.aiCfg'));
  const secrets = secretsSnap.data();
  const claudeKey = secrets.claudeKey || secrets.cladeKey || secrets.ClaudeKey || secrets.claude_key;
  if (!claudeKey) throw new HttpsError('not-found', tS(L, 'err.aiKey'));
  cachedClaudeKey = claudeKey;
  return claudeKey;
}

// Obsah zprávy: řetězec, nebo pole textových bloků {type:'text', text}. Vrací {content, chars} nebo null.
function normContent(c) {
  if (typeof c === 'string') return {content: c, chars: c.length};
  if (!Array.isArray(c) || c.length === 0) return null;
  const blocks = [];
  let chars = 0;
  for (const b of c) {
    if (!b || typeof b !== 'object' || b.type !== 'text' || typeof b.text !== 'string') return null;
    blocks.push({type: 'text', text: b.text});
    chars += b.text.length;
  }
  return {content: blocks, chars};
}

// Validace vstupu z klienta. Klient (callClaude v app.js) posílá systémový prompt jako zprávu
// s rolí 'system' (nejvýš jednu); ostatní role jen user/assistant. Vrací {system, messages, maxTokens}.
// L = jazyk chybových zpráv (cs/en)
function validateClaudeInput(data, L) {
  const bad = (key, vars) => new HttpsError('invalid-argument', tS(L, key, vars));
  const {messages, maxTokens} = data || {};
  if (!Array.isArray(messages) || messages.length === 0) throw bad('err.aiNoMsgs');
  if (messages.length > MAX_MESSAGES) throw bad('err.aiTooMany', {n: MAX_MESSAGES});
  let system = '';
  let hasSystem = false;
  let total = 0;
  const out = [];
  for (const m of messages) {
    if (!m || typeof m !== 'object') throw bad('err.aiBadMsg');
    const norm = normContent(m.content);
    if (!norm) throw bad('err.aiBadContent');
    total += norm.chars;
    if (m.role === 'system') {
      if (hasSystem) throw bad('err.aiOneSystem');
      hasSystem = true;
      system = norm.content;
    } else if (m.role === 'user' || m.role === 'assistant') {
      out.push({role: m.role, content: norm.content});
    } else {
      throw bad('err.aiBadRole');
    }
  }
  if (!out.length) throw bad('err.aiNoUser');
  // Poslední zpráva musí být od uživatele (assistant prefill vrací u Haiku 5.5 chybu 400)
  if (out[out.length - 1].role !== 'user') throw bad('err.aiLastUser');
  if (total > MAX_INPUT_CHARS) throw bad('err.aiTooLong');
  const mt = (Number.isInteger(maxTokens) && maxTokens >= 1 && maxTokens <= MAX_TOKENS_CAP) ? maxTokens : DEFAULT_MAX_TOKENS;
  return {system, messages: out, maxTokens: mt};
}

// Vrácení odečteného dotazu (výpadek Anthropicu) — jen ve stejný den a nikdy pod 0
async function refundRate(rateRef, today) {
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(rateRef);
      const d = snap.exists ? snap.data() : null;
      if (!d || d.date !== today || !(d.count > 0)) return;
      tx.update(rateRef, {count: FieldValue.increment(-1)});
    });
  } catch(e) { console.error('[LP] Vrácení AI limitu selhalo:', e.code || e.message); }
}

exports.claudeProxy = onCall({cors: true, region: 'europe-west1'}, async (request) => {
  // 1. Auth check (jazyk chyb z data.lang klienta, profil se kvůli tomu nenačítá)
  const L = reqLang(request);
  if (!request.auth) throw new HttpsError('unauthenticated', tS(L, 'err.auth'));
  const uid = request.auth.uid;

  // 2. Validace vstupu — před odečtem limitu, neplatný dotaz limit nespotřebuje
  const input = validateClaudeInput(request.data, L);

  // 3. Claude API klíč a volba modelu (cache v instanci; admin přístup, klient config/** číst nemůže)
  const claudeKey = await getClaudeKey(L);
  const aiCfg = await getAiConfig();

  // 4. Rate limiting — max 50 AI volání za den (atomicky přes transakci,
  // aby paralelní requesty nemohly limit obejít)
  // Den počítáme v čase Europe/Prague (limit se nuluje o naší půlnoci, ne v UTC)
  const today = pragueDS(new Date());
  const rateRef = db.doc(`rateLimits/${uid}`);
  const todayCount = await db.runTransaction(async (tx) => {
    const rateSnap = await tx.get(rateRef);
    const rateData = rateSnap.exists ? rateSnap.data() : {};
    const count = rateData.date === today ? (rateData.count || 0) : 0;
    if (count >= DAILY_LIMIT) {
      throw new HttpsError('resource-exhausted', tS(L, 'err.aiLimit', {n: DAILY_LIMIT}));
    }
    // merge: v dokumentu je i famNotify (omezení notifyFamily)
    tx.set(rateRef, {date: today, count: count + 1}, {merge: true});
    return count;
  });

  // 5. Zavolej Claude API
  const https = require('https');
  const body = JSON.stringify(buildClaudeBody(aiCfg, input));

  let result;
  try {
    result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          // Neparsovatelné tělo (např. HTML stránka brány při 502) → body null, rozhodne status
          let parsed = null;
          try { parsed = JSON.parse(data); } catch(e) { /* nic */ }
          resolve({status: res.statusCode, body: parsed});
        });
        res.on('error', reject);
      });
      req.setTimeout(CLAUDE_TIMEOUT_MS, () => {
        const err = new Error('Claude API timeout');
        err.lpTimeout = true;
        req.destroy(err);
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  } catch(e) {
    // Timeout nebo síťová chyba = dotaz neproběhl → vrať odečtený limit
    await refundRate(rateRef, today);
    if (e && e.lpTimeout) throw new HttpsError('deadline-exceeded', tS(L, 'err.aiTimeout'));
    throw new HttpsError('unavailable', tS(L, 'err.aiUnavail'));
  }

  if (result.status !== 200) {
    const errType = result.body?.error?.type;
    const overloaded = result.status >= 500 || result.status === 529 || errType === 'overloaded_error';
    if (overloaded) {
      await refundRate(rateRef, today);
      throw new HttpsError('unavailable', tS(L, 'err.aiOverload'));
    }
    // Neplatný klíč → příště načíst config/secrets znovu (klíč mohl být vyměněn)
    if (result.status === 401 || result.status === 403) cachedClaudeKey = null;
    const msg = result.body?.error?.message || tS(L, 'err.aiHttp', {code: result.status});
    throw new HttpsError('internal', msg);
  }
  const parsed = parseClaudeResponse(result.body);
  // Odmítnutí bezpečnostním filtrem (HTTP 200): dotaz proběhl, do limitu se nevrací. Loguje se jen kategorie.
  if (parsed.stopReason === 'refusal') {
    console.warn('[LP] AI odmítla dotaz, kategorie:', parsed.refusalCategory || '?');
    throw new HttpsError('failed-precondition', tS(L, 'err.aiRefused'));
  }
  if (!parsed.text.trim()) {
    if (parsed.stopReason === 'max_tokens') {
      throw new HttpsError('internal', tS(L, 'err.aiMaxTok'));
    }
    throw new HttpsError('internal', tS(L, 'err.aiEmpty'));
  }

  return {text: parsed.text, remaining: DAILY_LIMIT - todayCount - 1};
});

// ── Helpers ──────────────────────────────────────────────
// Pražské datum YYYY-MM-DD pro daný okamžik
function pragueDS(date) {
  return new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Prague'}).format(date);
}

// Časové pásmo uživatele (profile.tz, IANA). Neplatné nebo chybějící = Europe/Prague (dřívější chování).
const DEF_TZ = 'Europe/Prague';
const TZ_CACHE_MAX = 500;
const _tzFmt = new Map(); // zóna → Intl formatter; formatter je drahý, tvoří se jednou na zónu (neplatné se necachují)
function tzFormatter(tz) {
  const c = _tzFmt.get(tz);
  if (c) return c;
  let f;
  try {
    f = new Intl.DateTimeFormat('en-US', {timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'});
  } catch(e) { return null; } // neplatná zóna: necachovat (cache by šla zaplnit odpadem)
  if (_tzFmt.size < TZ_CACHE_MAX) _tzFmt.set(tz, f);
  return f;
}
function normTz(tz) {
  return (typeof tz === 'string' && tz.length > 0 && tz.length <= 64 && tzFormatter(tz)) ? tz : DEF_TZ;
}

// „Nástěnný“ čas v zóně bez sekund: {wall (Date v lokální reprezentaci serveru), h, m, today, dow, tmrwMD, tz}
function zoneNow(tz, date = new Date()) {
  const zone = normTz(tz);
  const p = {};
  for (const x of tzFormatter(zone).formatToParts(date)) p[x.type] = x.value;
  // Bez sekund: kolísavé zpoždění startu cronu nesmí posunout výpočet diffMin u událostí
  const wall = new Date(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, 0, 0);
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const tmrw = new Date(wall);
  tmrw.setDate(tmrw.getDate() + 1);
  return {
    wall, h: wall.getHours(), m: wall.getMinutes(),
    today: ymd(wall), dow: wall.getDay(), // den v týdnu v zóně uživatele (0 = neděle)
    tmrwMD: ymd(tmrw).slice(5), tz: zone,
  };
}

// Čas spadá do 5min okna běhu cronu; porovnání v minutách dne, ať okno přechází přes hodinu i půlnoc (07:58, 23:57)
function isTimeMatch(h, m, timeStr) {
  if (!timeStr) return false;
  const [th, tm] = timeStr.split(':').map(Number);
  const t = th * 60 + tm, n = h * 60 + m;
  return ((n - t + 1440) % 1440) < 5;
}

// options.quiet: souhrn (např. večerní ze skupiny) – při nahrazení starší notifikace se stejným tagem nezvoní znovu
// a doručuje se s normální prioritou; ostatní (připomínky, události, změny) zvoní a vibrují podle nastavení telefonu
// (silent:false, vibrate, renotify:true) s Urgency high (Android je doručí i v úsporném režimu).
async function sendPush(token, title, body, tag = 'lifepocket', options = {}) {
  const quiet = !!options.quiet;
  const notif = {
    title, body,
    icon: 'https://lifepocket.app/icon-192.png',
    badge: 'https://lifepocket.app/icon-192.png',
    tag, renotify: !quiet,
    silent: false,
    vibrate: [200, 100, 200],
  };
  if (options.data)    notif.data = options.data;
  if (options.actions?.length) { notif.actions = options.actions; notif.requireInteraction = true; }
  // Top-level data (jen řetězce): data kliknutí (sw.js je čte z FCM_MSG.data), titulek a text pro appku
  // v popředí (onMessage) a pro SW, když payload nemá notification
  const data = {tag: String(tag), title: String(title), body: String(body)};
  for (const [k, v] of Object.entries(options.data || {})) data[k] = String(v);
  if (options.actions?.length) data.actions = JSON.stringify(options.actions);
  if (quiet) data.quiet = '1';
  await getMessaging().send({
    token,
    data,
    webpush: {
      headers: {Urgency: quiet ? 'normal' : 'high'},
      notification: notif,
      fcmOptions: {link: 'https://lifepocket.app/'},
    }
  });
  // Titulek ani text se neloguje (obsahuje jména, názvy návyků apod.)
  console.log('[LP] Push odeslan');
}

// Všechny tokeny uživatele: mapa fcmTokens (zařízení → {token, platform, updatedAt})
// + legacy pole fcmToken (poslední registrované zařízení), bez duplicit
function collectTokens(prof) {
  const byToken = new Map();
  const add = (token, mapKey) => {
    if (typeof token !== 'string' || !token) return;
    const e = byToken.get(token) || {token, mapKeys: [], legacy: false};
    if (mapKey) e.mapKeys.push(mapKey); else e.legacy = true;
    byToken.set(token, e);
  };
  const map = prof && prof.fcmTokens;
  if (map && typeof map === 'object') {
    for (const [k, v] of Object.entries(map)) add(v && v.token, k);
  }
  add(prof && prof.fcmToken, null);
  return [...byToken.values()];
}

// Je chyba z FCM důkazem, že token je mrtvý? (invalid-argument jen když se týká tokenu —
// stejný kód může znamenat i vadný payload a ten nesmí mazat platná zařízení)
function isDeadTokenError(e) {
  const code = e && e.code;
  // mismatched-credential / sender-id-mismatch tu NEJSOU: Admin SDK je mapuje i na 403 PERMISSION_DENIED
  // (vypnuté FCM API, IAM) — to je chyba konfigurace serveru, ne mrtvý token
  if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') return true;
  return code === 'messaging/invalid-argument' && /token/i.test(e.message || '');
}

// Smaž neplatný token z profilu (mapa i legacy pole) — jen pokud tam ještě je, mezitím ho klient mohl obnovit
async function removeDeadToken(uid, prof, entry, expectedUpdatedAt) {
  const ref = db.doc(`users/${uid}/profile/main`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const d = snap.data();
    const args = [];
    for (const k of entry.mapKeys) {
      if (d.fcmTokens && d.fcmTokens[k] && d.fcmTokens[k].token === entry.token
        && (expectedUpdatedAt === undefined || d.fcmTokens[k].updatedAt === expectedUpdatedAt)) args.push(new FieldPath('fcmTokens', k), FieldValue.delete());
    }
    if (entry.legacy && d.fcmToken === entry.token) args.push('fcmToken', FieldValue.delete());
    if (args.length) tx.update(ref, ...args);
  });
  // Ať další push ve stejném běhu mrtvý token nezkouší znovu
  if (prof) {
    for (const k of entry.mapKeys) if (prof.fcmTokens) delete prof.fcmTokens[k];
    if (entry.legacy && prof.fcmToken === entry.token) delete prof.fcmToken;
  }
}

// Čištění mapy fcmTokens: záznamy starší než 60 dní pryč a nejvýše 10 nejnovějších (podle updatedAt)
const TOKEN_MAX_AGE_MS = 60 * 24 * 3600 * 1000;
const TOKEN_MAX_COUNT = 10;
async function pruneTokens(uid, prof) {
  const map = prof && prof.fcmTokens;
  if (!map || typeof map !== 'object') return;
  const ts = (v) => { const t = Date.parse(v && v.updatedAt); return isNaN(t) ? 0 : t; };
  const sorted = Object.entries(map).sort((a, b) => ts(b[1]) - ts(a[1]));
  const now = Date.now();
  const drop = sorted.filter(([, v], i) => i >= TOKEN_MAX_COUNT || now - ts(v) > TOKEN_MAX_AGE_MS);
  for (const [k, v] of drop) {
    const token = v && v.token;
    const entry = {token, mapKeys: [k], legacy: !!token && prof.fcmToken === token};
    try { await removeDeadToken(uid, prof, entry, v && v.updatedAt); }
    catch(e) { console.error(`[LP] Čištění tokenů selhalo uid=${uid}:`, e.message); }
  }
}

// Pošli push na všechna zařízení uživatele. Vrací {sent, lastError}; sent = počet zařízení, kam push odešel.
async function sendPushToUser(uid, prof, title, body, tag = 'lifepocket', options = {}) {
  await pruneTokens(uid, prof);
  const entries = collectTokens(prof);
  const results = await Promise.allSettled(entries.map(t => sendPush(t.token, title, body, tag, options)));
  let sent = 0;
  let lastError = null;
  // Pojistka: selžou-li VŠECHNY tokeny stejným kódem jiným než not-registered, jde nejspíš o chybu
  // serveru/konfigurace (ne o mrtvé tokeny) — nic nemažeme, jen logujeme kód
  const failed = results.filter(r => r.status === 'rejected');
  const failCodes = new Set(failed.map(r => r.reason && r.reason.code));
  const allFailedSameCode = entries.length > 0 && failed.length === entries.length && failCodes.size === 1
    && !failCodes.has('messaging/registration-token-not-registered');
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'fulfilled') { sent++; continue; }
    const e = results[i].reason;
    lastError = e;
    if (isDeadTokenError(e) && !allFailedSameCode) {
      try { await removeDeadToken(uid, prof, entries[i]); console.log(`[LP] Smazán neplatný token uid=${uid} (${e.code})`); }
      catch(delErr) { console.error(`[LP] Mazání tokenu selhalo uid=${uid}:`, delErr.message); }
    } else {
      console.error(`[LP] Push chyba uid=${uid}: ${e && e.code || ''} ${e && e.message || ''}`);
    }
  }
  return {sent, lastError};
}

// Jazyk odpovědi callable funkce: data.lang z klienta (jazyk appky), jinak profile.lang, výchozí cs
function reqLang(request, prof) {
  const l = request && request.data && typeof request.data === 'object' ? request.data.lang : undefined;
  return normLang(l === 'cs' || l === 'en' ? l : (prof && prof.lang));
}

// ── Test Push — ověření že FCM funguje ───────────────────────────────────────
exports.testPush = onCall({cors: true, region: 'europe-west1'}, async (request) => {
  let L = reqLang(request);
  if (!request.auth) throw new HttpsError('unauthenticated', tS(L, 'err.auth'));
  const uid = request.auth.uid;
  const profileSnap = await db.doc(`users/${uid}/profile/main`).get();
  if (!profileSnap.exists) throw new HttpsError('not-found', tS(L, 'err.noProfile'));
  const prof = profileSnap.data();
  L = reqLang(request, prof);
  if (!collectTokens(prof).length) throw new HttpsError('failed-precondition', tS(L, 'err.noToken'));
  // Push v jazyce profilu (stejně jako cron), chyby v jazyce appky, která volá
  const PL = normLang(prof.lang);
  const {sent, lastError} = await sendPushToUser(uid, prof, tS(PL, 'test.t'), tS(PL, 'test.b'), 'test-push');
  if (sent === 0) {
    throw new HttpsError('internal', tS(L, 'err.fcm', {err: (lastError && lastError.message) || tS(L, 'err.fcmUnknown')}));
  }
  return {ok: true, sent};
});

// ── Upozornění ze skupin: preference a texty ─────────────────────────────────
// Výchozí hodnoty musí být stejné jako GROUP_NOTIF_DEFAULTS v app.js
const GROUP_NOTIF_DEFAULTS = {shop: 'instant', cal: 'instant', meal: 'evening', check: 'evening', pantry: 'evening',
  habit: 'evening', goal: 'evening', react: 'instant', challenge: 'instant', note: 'evening', recipe: 'evening',
  quiet: {from: '22:00', to: '07:00'}, notifyChecked: false, msInstant: true};
const GN_MODULES = ['shop', 'cal', 'meal', 'check', 'pantry', 'habit', 'goal', 'react', 'challenge', 'note', 'recipe'];
const GN_MODES = ['instant', 'q15', 'evening'];       // + 'off' (nic)
const INSTANT_SETTLE = 2 * 60000;                     // „Hned“: 2 min bez další změny…
const INSTANT_MAX_WAIT = 10 * 60000;                  // …ale nejdéle 10 min od první neodeslané změny
const CRON_STEP_MS = 5 * 60000;                       // cron běží po 5 min
const GN_BACKLOG_MAX = 24 * 3600000;                  // starý kurzor (přepnutý režim) = nejvýš den zpětně
const GN_QUERY_LIMIT = 200;
const GN_MAX_PAGES = 5;                              // až 1 000 změn na režim a běh
const GN_UPPER_LAG = 10000;                           // horní hranice dotazů i kurzorů = teď − 10 s
const GN_BODY_MAX = 180;
const GN_MAX_GROUPS = 10;
const GROUP_MAX = 5; // max. skupin na uživatele (klient GROUP_MAX v app.js); GN_MAX_GROUPS je pojistka pro starší klienty
// Skupiny uživatele (připomínky kalendáře i upozornění skupin): hlavní první, bez duplicit, jen platné kódy, nejvýš GN_MAX_GROUPS
function calGroupIds(prof) {
  const extra = Array.isArray(prof && prof.extraGroupIds) ? prof.extraGroupIds : [];
  return [...new Set([prof && prof.familyId, ...extra])]
    .filter(g => typeof g === 'string' && GROUP_ID_RE.test(g)).slice(0, GN_MAX_GROUPS);
}
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Preference člena s výchozími hodnotami; neplatné hodnoty = výchozí, quiet:null = noční klid vypnutý
function groupNotifPrefs(prof) {
  const raw = (prof && prof.groupNotif && typeof prof.groupNotif === 'object') ? prof.groupNotif : {};
  const gp = {};
  for (const k of GN_MODULES) gp[k] = (GN_MODES.includes(raw[k]) || raw[k] === 'off') ? raw[k] : GROUP_NOTIF_DEFAULTS[k];
  if (raw.quiet === null) gp.quiet = null;
  else if (raw.quiet && HHMM_RE.test(raw.quiet.from) && HHMM_RE.test(raw.quiet.to)) gp.quiet = {from: raw.quiet.from, to: raw.quiet.to};
  else gp.quiet = {...GROUP_NOTIF_DEFAULTS.quiet};
  gp.notifyChecked = raw.notifyChecked === true;
  gp.msInstant = raw.msInstant !== false;
  return gp;
}
// Milník (série návyku, mezník cíle 25/50/75/100 %, splněná společná výzva) přijde při „Milníky hned“ okamžitě
// i v režimu Večer / 15 min; „Vypnuto“ platí vždy
const gnIsMs = (a) => (a.module === 'habit' && a.action === 'streak') || (a.module === 'goal' && (a.action === 'progress' || a.action === 'done'))
  || (a.module === 'challenge' && a.action === 'done');
const gnModeOf = (a, gp) => gp[a.module] === 'off' ? 'off' : (gnIsMs(a) && gp.msInstant ? 'instant' : gp[a.module]);

// Je pražský čas h:m v nočním klidu? Rozsah může přecházet přes půlnoc (22:00–07:00)
function inQuiet(h, m, q) {
  if (!q) return false;
  const toMin = (s) => { const [a, b] = s.split(':').map(Number); return a * 60 + b; };
  const f = toMin(q.from), t = toMin(q.to), n = h * 60 + m;
  if (f === t) return false;
  return f < t ? (n >= f && n < t) : (n >= f || n < t);
}

// Texty skupin jsou ve slovníku (i18n-server.js) v jazyce příjemce L; emoji modulů jsou společná
const GN_EM = {shop: '🧺', cal: '🗓️', meal: '🥗', check: '📋', pantry: '🧊', habit: '🔥', goal: '🎯', react: '👏', challenge: '🤝',
  note: '📒', recipe: '👨‍🍳'};
const gnMore = (L, k) => tS(L, 'gn.more', {n: k});
// „A, B a C“ (L = jazyk spojky)
const gnList = (L, names) => names.length > 1 ? tS(L, 'gn.and', {a: names.slice(0, -1).join(', '), b: names[names.length - 1]}) : names[0];
const RX_EM = {clap: '👏', fire: '🔥', heart: '❤️', strong: '💪'};
const gnEms = (a) => String(a.em || '').split(',').filter(k => RX_EM[k]);
const gnRef = (a) => (typeof a.title === 'string' ? a.title.slice(0, 60).trim() : '');

// Milník série / mezník cíle: vlastní push (titulek podle délky série nebo mezníku); rod podle autora (a.g)
function gnMilestonePush(a, fam, L) {
  const name = gnAuthorName(fam, a, L), v = Number.isInteger(a.val) ? a.val : 0;
  const what = gnRef(a), g = a.g === 'f' ? 'f' : '';
  // Splněná společná výzva: úspěch celé skupiny, ne jednoho člověka
  if (a.module === 'challenge') return [tS(L, 'gn.ms.chal.t'), tS(L, 'gn.ms.chal.b', {pre: what ? what + ' – ' : ''}).slice(0, GN_BODY_MAX)];
  if (a.module === 'goal') {
    if (a.action === 'done' || v >= 100) {
      return [tS(L, 'gn.ms.goalDone.t', {name, g}), tS(L, 'gn.ms.goalDone.b', {pre: what ? what + ' 🎉 ' : '🎉 ', g}).slice(0, GN_BODY_MAX)];
    }
    const phrase = v === 25 ? tS(L, 'gn.ms.goal25') : v === 50 ? tS(L, 'gn.ms.goal50') : v === 75 ? tS(L, 'gn.ms.goal75') : tS(L, 'gn.ms.goalN', {v});
    return [tS(L, 'gn.ms.goal.t', {name, v}), tS(L, 'gn.ms.send', {pre: what ? what + ' – ' : '', phrase, g}).slice(0, GN_BODY_MAX)];
  }
  const s = v === 7 || v === 30 || v === 100 ? 's' + v : 'sN';
  const title = tS(L, `gn.ms.${s}.t`, {name, n: v});
  const body = tS(L, 'gn.ms.send', {pre: what ? what + ' – ' : '', phrase: tS(L, `gn.ms.${s}.p`), g});
  return [title, body.slice(0, GN_BODY_MAX)];
}
// Reakce na mě: 1 reakce → „👏 Adam ti tleská / za 50 dřepů“, komentář → „💬 Adam:“, víc → souhrn
function gnReactPush(acts, fam, groupName, L) {
  if (acts.length === 1) {
    const a = acts[0], name = gnAuthorName(fam, a, L), what = gnRef(a);
    const msg = typeof a._msg === 'string' ? a._msg.trim() : '';
    if (msg) return [`💬 ${name}:`, tS(L, 'gn.rx.quote', {msg: msg.length > 120 ? msg.slice(0, 119) + '…' : msg}) + (what ? ' · ' + tS(L, 'gn.rx.about', {what}) : '')];
    const ems = gnEms(a);
    const title = `${RX_EM[ems[0]] || '👏'} ${name} ${tS(L, 'gn.rx.' + (RX_EM[ems[0]] ? ems[0] : 'clap'))}`;
    return [title, `${what ? tS(L, 'gn.rx.for', {what}) : ''}${ems.length > 1 ? ' ' + ems.map(k => RX_EM[k]).join('') : ''}`.trim() || '👏'];
  }
  const byAuthor = new Map();
  const whats = new Set();
  for (const a of acts) {
    let au = byAuthor.get(a.uid);
    if (!au) { au = {name: gnAuthorName(fam, a, L), ems: [], c: false}; byAuthor.set(a.uid, au); }
    for (const k of gnEms(a)) if (!au.ems.includes(k)) au.ems.push(k);
    if (typeof a._msg === 'string' && a._msg.trim()) au.c = true;
    const w = gnRef(a); if (w) whats.add(w);
  }
  const parts = [...byAuthor.values()].map(au => `${au.name} ${au.ems.map(k => RX_EM[k]).join('')}${au.c ? '💬' : ''}`.trim());
  let body = gnList(L, parts) + (whats.size === 1 ? ' ' + tS(L, 'gn.rx.about', {what: [...whats][0]}) : '');
  if (body.length > GN_BODY_MAX) body = body.slice(0, GN_BODY_MAX - 1) + '…';
  return [`${GN_EM.react} ${tS(L, 'gn.mod.react')} · ${groupName}`, body];
}

// Komentáře: aktivita nese jen rid, text se čte z reactions/{rid}. Smazaný (nebo cizí) komentář → push se nepošle.
const GN_CID_RE = /^c_[A-Za-z0-9]{1,40}$/;
async function gnResolveComments(gid, list, uid) {
  const out = [];
  for (const a of list) {
    if (a.module !== 'react' || a.rid === undefined) { out.push(a); continue; }
    if (typeof a.rid !== 'string' || !GN_CID_RE.test(a.rid)) continue;
    try {
      const r = await db.doc(`families/${gid}/reactions/${a.rid}`).get();
      const d = r.exists ? (r.data() || {}) : null;
      if (!d || d.kind !== 'c' || d.uid !== a.uid || d.to !== uid || typeof d.text !== 'string' || !d.text.trim()) continue;
      out.push({...a, _msg: d.text.slice(0, 200)});
    } catch (e) { console.error(`[LP] komentář gid=${gid}: ${e && e.code || ''}`); }
  }
  return out;
}

// Jméno autora ze členů skupiny (server nevěří jménu z klienta); a.name jen pro bývalé členy
function gnAuthorName(fam, a, L) {
  const mem = fam && fam.members && fam.members[a.uid];
  const n = (mem && typeof mem === 'object' && typeof mem.name === 'string' && mem.name.trim())
    || (typeof a.name === 'string' && a.name.trim()) || tS(L, 'gn.someone');
  return n.slice(0, 40);
}
// Názvy ze záznamu: title = n názvů spojených „, “ (když nesedí počet, bere se celý title)
function gnTitles(a) {
  const t = typeof a.title === 'string' ? a.title.slice(0, 60).trim() : '';
  if (!t) return [];
  const parts = t.split(', ');
  return (Number.isInteger(a.n) && a.n > 1 && parts.length === a.n) ? parts : [t];
}
function gnCount(a) {
  const c = Number(a.count);
  return Number.isInteger(c) && c >= 1 ? Math.min(c, 500) : 1;
}
// Akce autora („přidal do nákupu“); neznámá akce = „upravil“ + „v nákupu“
function gnActText(L, module, action, f) {
  const g = f ? 'f' : '';
  // „#“ v modulu nebo akci (data z klienta) by sáhlo přímo na variantu '#f' slovníku → jen obecné „upravil“
  if (String(module).includes('#') || String(action).includes('#')) return tS(L, 'gn.act.def', {g});
  const key = `gn.act.${module}.${action}`;
  if (tS(L, key) !== key) return tS(L, key, {g});
  const inMod = tS(L, 'gn.in.' + module);
  const verb = tS(L, 'gn.act.def', {g});
  return inMod && inMod !== 'gn.in.' + module ? `${verb} ${inMod}` : verb;
}

// Text jednoho modulu: autor → akce, nejvýš 3 názvy + „a N další“; dlouhý text → „Adam a Jana: 9 změn v nákupu“
function gnModuleText(module, acts, fam, L) {
  const byAuthor = new Map();
  for (const a of acts) {
    let au = byAuthor.get(a.uid);
    if (!au) { au = {name: gnAuthorName(fam, a, L), f: false, actions: new Map()}; byAuthor.set(a.uid, au); }
    if (a.g === 'f') au.f = true;
    let ac = au.actions.get(a.action);
    if (!ac) { ac = {titles: [], count: 0}; au.actions.set(a.action, ac); }
    for (const t of gnTitles(a)) if (!ac.titles.includes(t)) ac.titles.push(t);
    ac.count += gnCount(a);
  }
  const texts = [];
  for (const au of byAuthor.values()) {
    const parts = [];
    for (const [action, ac] of au.actions) {
      let s = gnActText(L, module, action, au.f);
      if (action === 'clear') { if (ac.count > 1) s += ` (${ac.count})`; }
      else if (action !== 'plan' && ac.titles.length) {
        const shown = ac.titles.slice(0, 3);
        const more = Math.max(0, ac.count - shown.length);
        s += ': ' + shown.join(', ') + (more ? ' ' + gnMore(L, more) : '');
      }
      parts.push(s);
    }
    texts.push(`${au.name} ${parts.join('; ')}`);
  }
  let body = texts.join(' · ');
  if (body.length > GN_BODY_MAX) {
    const names = [...byAuthor.values()].map(au => au.name);
    const who = names.length > 3 ? `${names.slice(0, 2).join(', ')} ${gnMore(L, names.length - 2)}` : gnList(L, names);
    const total = acts.reduce((s, a) => s + gnCount(a), 0);
    body = `${who}: ${tS(L, 'gn.changes', {n: total})} ${tS(L, 'gn.in.' + module)}`.trim();
    if (body.length > GN_BODY_MAX) body = body.slice(0, GN_BODY_MAX - 1) + '…';
  }
  return body;
}

// Večerní souhrn skupiny: „🧺 5 změn · 🗓️ 1 nová událost · 📋 2 změny“
function gnEveningBody(byModule, L) {
  const parts = [];
  const tn = (key, n) => tS(L, key, {n});
  for (const mod of GN_MODULES) {
    const acts = byModule.get(mod);
    if (!acts || !acts.length) continue;
    const sum = (list) => list.reduce((s, a) => s + gnCount(a), 0);
    const sub = [];
    if (mod === 'cal') {
      const nAdd = sum(acts.filter(a => a.action === 'add'));
      const nOther = sum(acts.filter(a => a.action !== 'add'));
      if (nAdd) sub.push(tn('gn.ev.calNew', nAdd));
      if (nOther) sub.push(tn('gn.changes', nOther));
    } else if (mod === 'habit') {
      // Lidi a počty, ne názvy (souhrn má zůstat krátký)
      const nDone = sum(acts.filter(a => a.action === 'done'));
      const nMs = acts.filter(a => a.action === 'streak').length;
      const people = new Set(acts.map(a => a.uid)).size;
      if (nDone) sub.push(tn('gn.ev.habitDone', nDone));
      if (nMs) sub.push(tn('gn.ev.ms', nMs));
      if (people > 1) sub.push(tn('gn.ev.people', people));
    } else if (mod === 'goal') {
      // Jen mezníky: počty, ne názvy
      const nDone = acts.filter(a => a.action === 'done').length;
      const nMs = acts.filter(a => a.action === 'progress').length;
      if (nDone) sub.push(tn('gn.ev.goalDone', nDone));
      if (nMs) sub.push(tn('gn.ev.goalMs', nMs));
      if (!sub.length) sub.push(tn('gn.changes', acts.length));
    } else if (mod === 'challenge') {
      const nAdd = acts.filter(a => a.action === 'add').length;
      const nDone = acts.filter(a => a.action === 'done').length;
      if (nAdd) sub.push(tn('gn.ev.chalNew', nAdd));
      if (nDone) sub.push(tn('gn.ev.chalDone', nDone));
    } else if (mod === 'note' || mod === 'recipe') {
      // Jen počet nasdílených položek (názvy jsou v historii změn)
      const n = acts.filter(a => a.action === 'share').length || acts.length;
      sub.push(tn(mod === 'note' ? 'gn.ev.note' : 'gn.ev.recipe', n));
    } else if (mod === 'react') {
      sub.push(tn('gn.ev.react', acts.length));
    } else {
      sub.push(tn('gn.changes', sum(acts)));
    }
    parts.push(`${GN_EM[mod]} ${sub.join(', ')}`);
  }
  return parts.join(' · ');
}

// ── Notify Family ─────────────────────────────────────────────────────────────
// Pošle push notifikaci všem členům rodinné skupiny (kromě odesílatele).
// Starší ruční upozornění (tlačítko v Nákupech): respektuje „off“ u nákupů a noční klid příjemce,
// odesílatel smí volat nejvýš 1× za 2 min na skupinu (rateLimits/{uid}.famNotify, píše jen server)
const FAM_NOTIFY_INTERVAL = 2 * 60000;
exports.notifyFamily = onCall({cors: true, region: 'europe-west1'}, async (request) => {
  let L = reqLang(request);
  if (!request.auth) throw new HttpsError('unauthenticated', tS(L, 'err.auth'));
  const uid = request.auth.uid;

  const {message: rawMessage, type: rawType} = request.data || {};
  if (!rawMessage || typeof rawMessage !== 'string') throw new HttpsError('invalid-argument', tS(L, 'err.nfNoMsg'));
  const message = rawMessage.slice(0, 200);
  // Typ z klienta jen z whitelistu a tag vždy s prefixem fam-, ať nejde přepsat cizí notifikaci (morning, habit-<id>…)
  const type = ['shop-update', 'family-notify'].includes(rawType) ? rawType : 'family-notify';

  // Načti profil odesílatele — potřebujeme familyId a jméno
  const senderSnap = await db.doc(`users/${uid}/profile/main`).get();
  if (!senderSnap.exists) throw new HttpsError('not-found', tS(L, 'err.noProfile'));
  const senderProf = senderSnap.data();
  L = reqLang(request, senderProf); // bez data.lang podle profilu odesílatele
  const familyId = senderProf.familyId;
  if (!familyId) throw new HttpsError('failed-precondition', tS(L, 'err.nfNoGroup'));

  // Jméno odesílatele; bez jména výchozí text v jazyce příjemce (níže)
  const senderNick = String(senderProf.prezdivka || senderProf.nickname || '').trim().slice(0, 40);

  // Načti členy skupiny
  const familySnap = await db.doc(`families/${familyId}`).get();
  if (!familySnap.exists) throw new HttpsError('not-found', tS(L, 'err.grpNotFound'));
  const members = familySnap.data().members || {};
  // Odesílatel musí být členem skupiny (familyId v profilu si může nastavit sám)
  if (!Object.prototype.hasOwnProperty.call(members, uid)) throw new HttpsError('permission-denied', tS(L, 'err.nfNotMember'));

  // Omezení: 1× za 2 min na odesílatele a skupinu (atomicky, paralelní volání limit neobejdou)
  const nowMs = Date.now();
  const rateRef = db.doc(`rateLimits/${uid}`);
  await db.runTransaction(async (tx) => {
    const rs = await tx.get(rateRef);
    const fn = rs.exists ? (rs.data() || {}).famNotify : null;
    const last = fn && typeof fn === 'object' ? Number(fn[familyId]) : NaN;
    if (Number.isFinite(last) && last <= nowMs && nowMs - last < FAM_NOTIFY_INTERVAL) {
      throw new HttpsError('resource-exhausted', tS(L, 'err.nfRate'));
    }
    tx.set(rateRef, {famNotify: {[familyId]: nowMs}}, {merge: true});
  });

  // Pošli notifikaci všem zařízením všech členů kromě odesílatele
  const sendDate = new Date();
  let sent = 0;
  let membersReached = 0;
  for (const memberUid of Object.keys(members)) {
    if (memberUid === uid) continue;
    try {
      const memberSnap = await db.doc(`users/${memberUid}/profile/main`).get();
      if (!memberSnap.exists) continue;
      const memberProf = memberSnap.data();
      if (!collectTokens(memberProf).length) continue;
      // Preference příjemce: nákupy vypnuté nebo noční klid = nic neposílat
      const gp = groupNotifPrefs(memberProf);
      if (type === 'shop-update' && gp.shop === 'off') continue;
      const {h, m} = zoneNow(memberProf.tz, sendDate); // noční klid v čase příjemce
      if (inQuiet(h, m, gp.quiet)) continue;
      const senderName = senderNick || tS(normLang(memberProf.lang), 'nf.member');
      const res = await sendPushToUser(memberUid, memberProf, `📣 ${senderName}`, message, `fam-${type}`);
      sent += res.sent;
      if (res.sent > 0) membersReached++;
    } catch(e) {
      console.error(`[LP] notifyFamily člen uid=${memberUid}:`, e.message);
    }
  }

  // sent = počet zařízení (kompatibilita se starým klientem), members = počet členů, kterým něco odešlo
  return {sent, members: membersReached};
});

// Je návyk dnes na řadě? Shodně s klientem (app.js): archivovaný a pozastavený ne,
// frekvence „konkrétní dny“ jen ve vybrané dny (dow = den v týdnu v zóně uživatele, 0 = neděle)
function isHabitDueToday(habit, today, dow) {
  if (habit.archived) return false;
  if (habit.pausedUntil && habit.pausedUntil >= today) return false;
  const freq = (typeof habit.freq === 'object' && habit.freq) ? habit.freq : {type: 'daily'};
  if (freq.type === 'days') return (Array.isArray(freq.days) ? freq.days : []).includes(dow);
  return true;
}

// Události kolekce potřebné pro cron (místo celé kolekce):
// dnešní (date == today) + každoročně opakované (repeat == 'yes'); narozeniny zvlášť a jen když jsou potřeba.
// Vrací dokumenty bez duplicit, seřazené podle ID (stejné pořadí jako dřív celá kolekce).
async function loadTimedEvents(path, today) {
  const [todaySnap, repSnap] = await Promise.all([
    db.collection(path).where('date', '==', today).get(),
    db.collection(path).where('repeat', '==', 'yes').get(),
  ]);
  const byId = new Map();
  for (const d of [...todaySnap.docs, ...repSnap.docs]) byId.set(d.id, d);
  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
async function loadBirthdays(path) {
  return (await db.collection(path).where('type', '==', 'birthday').get()).docs;
}

const CRON_BATCH = 20;

// ── Hlavní cron — každých 5 minut ────────────────────────
exports.sendScheduledNotifications = onSchedule(
  {schedule: 'every 5 minutes', timeZone: 'Europe/Prague', region: 'europe-west1', timeoutSeconds: 240},
  async () => {
    // Jeden okamžik pro celý běh; čas, datum a den v týdnu se počítají pro každého uživatele v jeho zóně (profile.tz)
    const runDate = new Date();
    const pz = zoneNow(DEF_TZ, runDate);
    console.log(`[LP] Cron: ${String(pz.h).padStart(2,'0')}:${String(pz.m).padStart(2,'0')}, datum: ${pz.today} (${DEF_TZ})`);

    // Klient zapisuje jen podkolekce (users/{uid}/profile/main …), kořenový dokument
    // neexistuje → get() by nic nevrátil. listDocuments() vrací i „chybějící“ rodiče.
    const userRefs = await db.collection('users').listDocuments();
    let sentTotal = 0; // počet skutečně odeslaných notifikací (zařízení)

    // Skupiny: dokument a události čteme jednou za běh pro všechny členy (cache slibů podle familyId)
    const famCache = new Map();
    const famEntry = (fid) => {
      let e = famCache.get(fid);
      if (!e) {
        e = {doc: db.doc(`families/${fid}`).get(), events: null, bdays: null};
        e.doc.catch(() => {}); // chybu řeší každý člen sám (jako dřív), ne unhandled rejection
        famCache.set(fid, e);
      }
      return e;
    };
    const lazy = (e, key, fn) => {
      // Zamítnutý slib z cache smazat, ať další člen skupiny zkusí čtení znovu
      if (!e[key]) { const p = fn(); e[key] = p; p.catch(() => { if (e[key] === p) delete e[key]; }); }
      return e[key];
    };

    // ── Upozornění ze skupin ──
    // Horní hranice dotazů i kurzorů = 10 s před během: zápis s ts těsně před „teď“ ještě nemusí být vidět
    const nowMs = Date.now();
    const upperMs = nowMs - GN_UPPER_LAG;
    const upperTs = Timestamp.fromMillis(upperMs);
    const actCol = (fid) => db.collection(`families/${fid}/activity`);
    // Nejnovější aktivita skupiny: 1 čtení na skupinu a běh, sdílené pro všechny členy.
    // Rozsah na ts zároveň vyřadí ne-Timestamp hodnoty a čas z budoucnosti.
    const latestAct = (fid) => lazy(famEntry(fid), 'latest', async () => {
      const s = await actCol(fid).where('ts', '<=', upperTs).orderBy('ts', 'desc').limit(1).get();
      return s.docs.length ? (toMillis(s.docs[0].data().ts) || 0) : 0;
    });
    // Aktivita (lo, upper] po stránkách (nejvýš GN_MAX_PAGES × GN_QUERY_LIMIT), cache (gid, lo) v rámci běhu.
    // end = konec zpracovaného rozsahu: upper, nebo při plném počtu stránek čas poslední načtené změny − 1 ms
    // (zbytek přijde v dalším běhu; raději výjimečně zopakovat změnu ze stejné ms než ji ztratit)
    const rangeCache = new Map();
    const loadRange = (gid, lo) => {
      const key = `${gid}|${lo}`;
      if (!rangeCache.has(key)) {
        const p = (async () => {
          const acts = [];
          let q = actCol(gid).where('ts', '>', Timestamp.fromMillis(lo)).where('ts', '<=', upperTs).orderBy('ts').limit(GN_QUERY_LIMIT);
          for (let page = 0; page < GN_MAX_PAGES; page++) {
            const snap = await q.get();
            for (const d of snap.docs) {
              const a = d.data() || {};
              const t = toMillis(a.ts);
              if (t !== null) acts.push({...a, _ts: t});
            }
            if (snap.docs.length < GN_QUERY_LIMIT) return {acts, end: upperMs};
            q = q.startAfter(snap.docs[snap.docs.length - 1]);
          }
          const last = acts.length ? acts[acts.length - 1]._ts : upperMs;
          return {acts, end: Math.max(lo, Math.min(upperMs, last - 1))};
        })();
        rangeCache.set(key, p);
        p.catch(() => { if (rangeCache.get(key) === p) rangeCache.delete(key); });
      }
      return rangeCache.get(key);
    };

    const groupNotifs = async (uid, prof, ns, push, L, zn) => {
      const {h, m} = zn;
      const gids = calGroupIds(prof); // stejný seznam skupin jako připomínky kalendáře
      if (!gids.length) return;
      const gp = groupNotifPrefs(prof);
      const sentMap = (prof.groupNotifSent && typeof prof.groupNotifSent === 'object') ? prof.groupNotifSent : {};
      // Noční klid platí pro „Hned“ a „15 min“, ne pro večerní souhrn (čas si uživatel zvolil sám)
      const quiet = inQuiet(h, m, gp.quiet);
      const eveningRun = isTimeMatch(h, m, ns.evening || '21:00');
      const q15Run = m % 15 < 5;  // jeden běh v každé čtvrthodině
      const updates = [];         // [gid, režim, ms] → groupNotifSent.<gid>.<režim>
      const pushes = [];
      for (const gid of gids) {
        try {
          const famSnap = await famEntry(gid).doc;
          const fam = famSnap.exists ? famSnap.data() : null;
          if (!fam || !fam.members || !fam.members[uid]) continue;
          // Sdílení modulů jako v klientu (groupModShared): kalendář, nákupy, jídelníček a checklist (sdílený,
          // dokud není false) podle příznaků v každé skupině (4.53), zásoby jen hlavní skupina
          const isMain = gid === prof.familyId;
          // Osobní moduly (sdílené návyky, cíle, poznámky, recepty, reakce) v každé skupině
          const shared = {cal: !!fam.shareCal, shop: !!fam.shareShop, meal: !!fam.shareMeal,
            check: fam.shareChecklist !== false, pantry: isMain, habit: true, goal: true, react: true, challenge: true,
            note: true, recipe: true};
          const mods = GN_MODULES.filter(k => shared[k] && gp[k] !== 'off');
          const cur = (sentMap[gid] && typeof sentMap[gid] === 'object') ? sentMap[gid] : {};
          // Chybějící kurzor = start na „teď“: po nasazení ani novému členovi nepřijde stará historie
          for (const mode of GN_MODES) if (typeof cur[mode] !== 'number' || !Number.isFinite(cur[mode])) updates.push([gid, mode, upperMs]);
          const from = {};
          const modes = new Set(mods.map(k => gp[k]));
          if (gp.msInstant && (mods.includes('habit') || mods.includes('goal') || mods.includes('challenge'))) modes.add('instant'); // milníky hned
          for (const mode of modes) {
            const c = cur[mode];
            if (typeof c === 'number' && Number.isFinite(c)) from[mode] = Math.max(c, nowMs - GN_BACKLOG_MAX);
          }
          const active = Object.keys(from);
          if (!active.length) continue;
          const latest = await latestAct(gid);
          if (latest <= Math.min(...active.map(k => from[k]))) continue; // takhle skončí většina běhů
          const due = [];
          for (const mode of active) {
            if (latest <= from[mode]) continue;
            if (mode === 'evening') { if (eveningRun) due.push(mode); continue; }
            if (quiet) continue; // po skončení klidu je první běh na řadě sám (latest > kurzor)
            if (mode === 'q15') { if (q15Run) due.push(mode); continue; }
            // instant: 2 min klidu, nebo by další běh překročil 10 min od první neodeslané změny
            if (nowMs - latest >= INSTANT_SETTLE) { due.push(mode); continue; }
            const first = await actCol(gid).where('ts', '>', Timestamp.fromMillis(from[mode])).where('ts', '<=', upperTs)
              .orderBy('ts').limit(1).get();
            const t0 = first.docs.length ? toMillis(first.docs[0].data().ts) : null;
            if (t0 !== null && nowMs - t0 >= INSTANT_MAX_WAIT - CRON_STEP_MS) due.push(mode);
          }
          if (!due.length) continue;
          // „Hlásit i odškrtnuté“ jen u nákupu a checklistu; reakce jen adresátovi
          const wanted = (a) => typeof a.uid === 'string' && a.uid !== uid   // autor nedostane nic
            && mods.includes(a.module)
            && (a.action !== 'done' || !(a.module === 'shop' || a.module === 'check') || gp.notifyChecked)
            && (a.module !== 'react' || a.to === uid);
          const groupName = String(fam.groupName || tS(L, 'gn.groupDef')).slice(0, 30);
          for (const mode of due) {
            const {acts, end} = await loadRange(gid, from[mode]);
            // Kurzor se posune i bez odeslání (jinak by se backlog opakoval) a nikdy necouvá
            updates.push([gid, mode, Math.max(from[mode], end)]);
            const list = await gnResolveComments(gid,
              acts.filter(a => a._ts > from[mode] && a._ts <= end && gnModeOf(a, gp) === mode && wanted(a)), uid);
            if (!list.length) continue;
            const byModule = new Map();
            for (const a of list) { if (!byModule.has(a.module)) byModule.set(a.module, []); byModule.get(a.module).push(a); }
            if (mode === 'evening') {
              pushes.push([tS(L, 'gn.evening.t', {group: groupName}), gnEveningBody(byModule, L), `grp-${gid}-evening`, {data: {open: 'grpfeed', gid}, quiet: true}]);
            } else {
              for (const [mod, la] of byModule) {
                if (mod === 'react') {
                  const [title, body] = gnReactPush(la, fam, groupName, L);
                  pushes.push([title, body, `grp-${gid}-react`, {data: {open: 'grpfeed', gid, module: mod}}]);
                  continue;
                }
                // Milník má vlastní tag (další souhrn návyků ho nepřepíše; další mezník téhož cíle předchozí nahradí)
                const rest = la.filter(a => !gnIsMs(a));
                for (const a of la.filter(gnIsMs)) {
                  const [title, body] = gnMilestonePush(a, fam, L);
                  const ref = String(a.ref || a.uid).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
                  pushes.push([title, body, `grp-${gid}-ms-${ref}`, {data: {open: 'grpfeed', gid, module: mod}}]);
                }
                if (!rest.length) continue;
                pushes.push([`${GN_EM[mod]} ${tS(L, 'gn.mod.' + mod)} · ${groupName}`, gnModuleText(mod, rest, fam, L),
                  `grp-${gid}-${mod}`, {data: {open: 'grpfeed', gid, module: mod}}]);
              }
            }
          }
        } catch(e) { console.error(`[LP] Skupinová upozornění uid=${uid}:`, e.message); }
      }
      if (updates.length) {
        // Jen pole groupNotifSent.<gid>.<režim>, zbytek profilu se nemění. Kurzor dřív než push:
        // když zápis selže, nic se neposílá (jinak by stejné změny chodily každý běh znovu)
        try {
          await db.doc(`users/${uid}/profile/main`).update(...updates.flatMap(([g, mo, ms]) => [new FieldPath('groupNotifSent', g, mo), ms]));
        } catch(e) { console.error(`[LP] Kurzor skupin uid=${uid}:`, e.message); return; }
      }
      for (const [title, body, tag, options] of pushes) {
        try { await push(title, body, tag, options); }
        catch(e) { console.error(`[LP] skupinový push uid=${uid}:`, e.message); }
      }
    };

    const processUser = async (uid) => {
      try {
        const profileSnap = await db.doc(`users/${uid}/profile/main`).get();
        if (!profileSnap.exists) return;

        const prof = profileSnap.data();
        // Bez tokenu nemá smysl nic dalšího číst
        if (!collectTokens(prof).length) return;
        const push = async (title, body, tag, options) => {
          const res = await sendPushToUser(uid, prof, title, body, tag, options);
          sentTotal += res.sent;
        };

        const ns = prof.notifSettings || {};
        // Čas, dnešní datum a den v týdnu v zóně uživatele (bez platné tz = Europe/Prague)
        const zn = zoneNow(prof.tz, runDate);
        const {wall, h, m, today, dow, tmrwMD} = zn;
        const todayMD = today.slice(5);
        // Jazyk a rod příjemce (texty ze slovníku i18n-server.js)
        const L = normLang(prof.lang);
        const g = prof.gender === 'f' ? 'f' : '';
        const nickname = prof.prezdivka || prof.nickname || tS(L, 'nick.friend');
        const morningTime = ns.morning || '08:00';
        // Dnešní návyky načteme nejvýš jednou na uživatele (sdílí ranní, večerní i připomínky)
        let dueCache = null;
        const getDueHabits = async () => {
          if (!dueCache) {
            const habitsSnap = await db.collection(`users/${uid}/habits`).get();
            dueCache = habitsSnap.docs.filter(d => isHabitDueToday(d.data(), today, dow));
          }
          return dueCache;
        };

        // ── Ranní notifikace ──
        if (ns.morningDigest !== false && isTimeMatch(h, m, morningTime)) {
          const total = (await getDueHabits()).length;
          const body = total > 0 ? tS(L, 'morning.b', {n: total}) : tS(L, 'morning.empty');
          try { await push(tS(L, 'morning.t', {name: nickname}), body, 'morning', {data: {open: 'habits'}}); }
          catch(e) { console.error(`[LP] ranní push uid=${uid}:`, e.message); }
        }

        // ── Večerní shrnutí ──
        if (ns.eveningDigest !== false) {
          const eveningTime = ns.evening || '21:00';
          if (isTimeMatch(h, m, eveningTime)) {
            const dueDocs = await getDueHabits();
            const total = dueDocs.length;
            const dueIds = new Set(dueDocs.map(d => d.id));
            const logsSnap = await db.collection(`users/${uid}/habitLogs`)
              .where('date', '==', today).where('done', '==', true).get();
            // Počítej jen splnění dnešních návyků (ne archivovaných / pozastavených)
            const done = logsSnap.docs.filter(l => {
              const hid = l.data().habitId || l.id.slice(0, -(today.length + 1));
              return dueIds.has(hid);
            }).length;
            let body;
            if (total === 0) body = tS(L, 'evening.none');
            else if (done === total) body = tS(L, 'evening.all', {n: total, g});
            else if (done === 0) body = tS(L, 'evening.zero', {g});
            else body = tS(L, 'evening.part', {done, n: total, left: total - done, g});
            try { await push(tS(L, 'evening.t'), body, 'evening', {data: {open: 'habits'}}); }
            catch(e) { console.error(`[LP] večerní push uid=${uid}:`, e.message); }
          }
        }

        // ── Změny ve skupinách (za večerním shrnutím, ať skupinový souhrn přijde hned po něm) ──
        try { await groupNotifs(uid, prof, ns, push, L, zn); }
        catch(e) { console.error(`[LP] Skupiny uid=${uid}:`, e.message); }

        // ── Připomínky návyků ──
        if (ns.habits !== false) {
          for (const habitDoc of await getDueHabits()) {
            const habit = habitDoc.data();
            if (!habit.reminderTime) continue;
            if (!isTimeMatch(h, m, habit.reminderTime)) continue;
            // ID logu = ID dokumentu návyku (pole habit.id v datech není)
            const logId = `${habitDoc.id}_${today}`;
            const logSnap = await db.doc(`users/${uid}/habitLogs/${logId}`).get();
            if (logSnap.exists && logSnap.data().done) continue;
            try {
              await push(
                `${habit.emoji || '🔔'} ${habit.name}`,
                tS(L, 'habit.nag', {name: nickname, habit: habit.name, g}),
                `habit-${habitDoc.id}`,
                { data: {habitId: habitDoc.id, date: today, open: 'habit'}, actions: [{action:'done', title: tS(L, 'habit.done')}] }
              );
            } catch(e) { console.error(`[LP] habit push uid=${uid}:`, e.message); }
          }
        }

        // ── Narozeniny + Události — osobní i rodinné ──
        // Narozeniny se posílají jen v ranním čase uživatele → jen tehdy je čteme
        const bdayRun = isTimeMatch(h, m, morningTime);

        // Osobní kalendář
        const evGroups = [await loadTimedEvents(`users/${uid}/events`, today)];
        const bdayGroups = bdayRun ? [await loadBirthdays(`users/${uid}/events`)] : [];
        // Skupinové kalendáře (4.53): hlavní i vedlejší skupiny, které kalendář sdílí (stejně jako klient)
        for (const fid of calGroupIds(prof)) {
          try {
            // Události skupiny jen skutečnému členovi (odebraný člen může mít v profilu staré ID skupiny)
            const fe = famEntry(fid);
            const famSnap = await fe.doc;
            const fam = famSnap.exists ? famSnap.data() : null;
            if (fam && fam.members?.[uid] && fam.shareCal) {
              evGroups.push(await lazy(fe, 'events|' + today, () => loadTimedEvents(`families/${fid}/events`, today)));
              if (bdayRun) bdayGroups.push(await lazy(fe, 'bdays', () => loadBirthdays(`families/${fid}/events`)));
            }
          } catch(e) { /* skupina nemusí existovat */ }
        }

        // Narozeniny — ráno
        for (const evDoc of bdayGroups.flat()) {
          const ev = evDoc.data();
          if (!ev.date || ev.type !== 'birthday') continue;
          const bday = ev.date.slice(5);
          if (bday === todayMD) {
            try { await push(tS(L, 'bday.today.t'), tS(L, 'bday.today.b', {name: nickname, who: ev.name}), `bday-${evDoc.id}`, {data: {open: 'cal'}}); }
            catch(e) { console.error(`[LP] bday push:`, e.message); }
          } else if (bday === tmrwMD) {
            try { await push(tS(L, 'bday.tmrw.t'), tS(L, 'bday.tmrw.b', {who: ev.name}), `bday-tmrw-${evDoc.id}`, {data: {open: 'cal'}}); }
            catch(e) { console.error(`[LP] bday-tmrw push:`, e.message); }
          }
        }

        // Události s časem — hodinu předem
        for (const evDoc of evGroups.flat()) {
          const ev = evDoc.data();
          if (!ev.date || ev.type !== 'event' || !ev.time) continue;
          const evDate = ev.repeat === 'yes' ? today.slice(0,5) + ev.date.slice(5) : ev.date;
          if (evDate !== today) continue;
          const evTime = new Date(`${today}T${ev.time}:00`);
          const diffMin = Math.round((evTime - wall) / 60000);
          // Okno 5 minut = jeden běh cronu → upozornění jen jednou
          if (diffMin >= 58 && diffMin < 63) {
            try { await push(tS(L, 'ev.t', {ev: ev.name}), tS(L, 'ev.b', {name: nickname, ev: ev.name, time: ev.time}), `ev-${evDoc.id}-${today}`, {data: {open: 'cal'}}); }
            catch(e) { console.error(`[LP] event push:`, e.message); }
          }
        }
      } catch(userErr) {
        console.error(`[LP] Chyba při zpracování uid=${uid}:`, userErr.message);
      }
    };

    // Dávky po 20 uživatelích paralelně; chyba jednoho neshodí běh
    for (let i = 0; i < userRefs.length; i += CRON_BATCH) {
      const res = await Promise.allSettled(userRefs.slice(i, i + CRON_BATCH).map(r => processUser(r.id)));
      res.forEach(r => { if (r.status === 'rejected') console.error('[LP] Cron uživatel selhal:', r.reason && r.reason.message); });
    }

    console.log(`[LP] Cron hotovo, odesláno ${sentTotal} notifikací`);
  }
);

// ── Denní anonymní statistiky pro správce ────────────────────────────────────
// Běží v 03:10 (Europe/Prague) a zapisuje jen souhrnná čísla do config/stats_daily/days/{den}.
// {den} = pražské datum VČEREJŠKA (poslední celý den). Okna active1d/7d/30d, newUsers a
// errorLogs24h se počítají od okamžiku běhu dozadu (24 h, 7 dní, 30 dní).
// aiCallsToday = součet rateLimits.count s date == {den}; kdo použil AI už po půlnoci, má
// v rateLimits nový den, takže jeho včerejší volání chybí (malé podhodnocení, přijatelné).
// Nikam se nezapisují ani nelogují uid, e-maily, jména ani texty. config/** je pro klienty zavřené.
const STATS_BATCH = 20;

// Čas v ms z ISO řetězce, Firestore Timestamp, Date nebo čísla; jinak null
function toMillis(v) {
  if (!v) return null;
  if (typeof v === 'string') { const t = Date.parse(v); return isNaN(t) ? null : t; }
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v.toMillis === 'function') { try { return v.toMillis(); } catch(e) { return null; } }
  return null;
}

exports.dailyStats = onSchedule(
  {schedule: '10 3 * * *', timeZone: 'Europe/Prague', region: 'europe-west1', timeoutSeconds: 540},
  async () => {
    const now = Date.now();
    const DAY = 86400000;
    const statDay = pragueDS(new Date(now - DAY)); // včerejšek v Praze (03:10 − 24 h je vždy včera i přes změnu času)
    const s = {
      usersTotal: 0, active1d: 0, active7d: 0, active30d: 0,
      newUsers1d: 0, newUsers7d: 0, withPushToken: 0,
      familiesTotal: 0, familyMembersAvg: 0, aiCallsToday: 0,
      errorLogs24h: null, errorLogsTotal: null, profileErrors: 0,
    };

    // 1) Uživatelé a profily (paralelně po dávkách; chyba u jednoho neshodí běh)
    const userRefs = await db.collection('users').listDocuments();
    s.usersTotal = userRefs.length;
    const missingCreated = new Set(); // uid jen v paměti, pro dohledání v Auth; nikam se neukládá
    for (let i = 0; i < userRefs.length; i += STATS_BATCH) {
      const chunk = userRefs.slice(i, i + STATS_BATCH);
      const res = await Promise.allSettled(chunk.map(r => db.doc(`users/${r.id}/profile/main`).get()));
      res.forEach((r, j) => {
        if (r.status !== 'fulfilled') { s.profileErrors++; return; }
        if (!r.value.exists) { missingCreated.add(chunk[j].id); return; }
        const p = r.value.data() || {};
        const seen = toMillis(p.lastSeen);
        if (seen !== null) {
          const age = now - seen;
          if (age <= DAY) s.active1d++;
          if (age <= 7 * DAY) s.active7d++;
          if (age <= 30 * DAY) s.active30d++;
        }
        const created = toMillis(p.createdAt);
        if (created === null) missingCreated.add(chunk[j].id);
        else {
          if (now - created <= DAY) s.newUsers1d++;
          if (now - created <= 7 * DAY) s.newUsers7d++;
        }
        if (collectTokens(p).length) s.withPushToken++;
      });
    }

    // 2) Profil bez createdAt (starší účty, nedokončený onboarding) → datum vytvoření z Firebase Auth
    if (missingCreated.size) {
      try {
        let pageToken;
        do {
          const page = await getAuth().listUsers(1000, pageToken);
          for (const u of page.users) {
            if (!missingCreated.has(u.uid)) continue;
            const created = toMillis(u.metadata && u.metadata.creationTime);
            if (created === null) continue;
            if (now - created <= DAY) s.newUsers1d++;
            if (now - created <= 7 * DAY) s.newUsers7d++;
          }
          pageToken = page.pageToken;
        } while (pageToken);
      } catch(e) { console.error('[LP] dailyStats Auth:', e.code || e.message); }
    }
    missingCreated.clear();

    // 3) Rodinné skupiny
    try {
      const famSnap = await db.collection('families').get();
      s.familiesTotal = famSnap.size;
      let members = 0;
      famSnap.forEach(d => { const m = d.data().members; if (m && typeof m === 'object') members += Object.keys(m).length; });
      s.familyMembersAvg = famSnap.size ? Math.round(members / famSnap.size * 10) / 10 : 0;
    } catch(e) { console.error('[LP] dailyStats families:', e.code || e.message); }

    // 4) AI volání za den statistiky
    try {
      const rl = await db.collection('rateLimits').where('date', '==', statDay).get();
      rl.forEach(d => { const c = Number(d.data().count); if (c > 0) s.aiCallsToday += c; });
    } catch(e) { console.error('[LP] dailyStats rateLimits:', e.code || e.message); }

    // 5) Chyby: errorLogs.ts je ISO řetězec (UTC). Filtr na collection group potřebuje index
    // (single-field index pro rozsah collection group); bez něj spadneme na celkový počet.
    try {
      const since = new Date(now - DAY).toISOString();
      const agg = await db.collectionGroup('errorLogs').where('ts', '>=', since).count().get();
      s.errorLogs24h = agg.data().count;
    } catch(e) {
      console.error('[LP] dailyStats errorLogs24h bez indexu:', e.code || e.message);
      try { s.errorLogsTotal = (await db.collectionGroup('errorLogs').count().get()).data().count; }
      catch(e2) { console.error('[LP] dailyStats errorLogs:', e2.code || e2.message); }
    }

    await db.doc(`config/stats_daily/days/${statDay}`).set({
      ...s, date: statDay, generatedAt: new Date().toISOString(), version: 1,
    });
    console.log(`[LP] dailyStats ${statDay}: users=${s.usersTotal} a1=${s.active1d} a7=${s.active7d} a30=${s.active30d} `
      + `new1=${s.newUsers1d} new7=${s.newUsers7d} push=${s.withPushToken} fam=${s.familiesTotal} famAvg=${s.familyMembersAvg} `
      + `ai=${s.aiCallsToday} err24=${s.errorLogs24h} errAll=${s.errorLogsTotal} profErr=${s.profileErrors}`);
  }
);

// ── Delete Account — smazání účtu z aplikace ─────────────────────────────────
// Maže jen účet volajícího. Pořadí: skupiny → users/{uid} → rateLimits → Auth.
// Když selže krok před Auth, účet zůstane a akci jde zopakovat (idempotentní).
// Logy jen technicky: krok a kód chyby, žádná jména ani obsah.
const DELETE_REAUTH_SEC = 10 * 60;
const GROUP_ID_RE = /^[A-Z]{2,12}-[A-Z0-9]{4,8}$/;

// Odebere uid ze skupiny; jediný člen → smaže celou skupinu, správce → předá roli
async function leaveGroupForDelete(gid, uid) {
  const ref = db.doc(`families/${gid}`);
  const outcome = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return 'missing'; // případný zbytek podkolekcí uklidí recursiveDelete níže
    const members = snap.data().members || {};
    if (!Object.prototype.hasOwnProperty.call(members, uid)) return 'notMember';
    const others = Object.keys(members).filter(id => id !== uid);
    // jediný člen: dokument smazat hned v transakci (nikdo se už nepřipojí), podkolekce po ní
    if (!others.length) { tx.delete(ref); return 'sole'; }
    const args = [new FieldPath('members', uid), FieldValue.delete()];
    const wasAdmin = members[uid] && members[uid].role === 'admin';
    const adminLeft = others.some(id => members[id] && members[id].role === 'admin');
    if (wasAdmin && !adminLeft) {
      const ts = (id) => { const t = Date.parse(members[id] && members[id].joinedAt); return Number.isFinite(t) ? t : Infinity; };
      const heir = others.slice().sort((a, b) => ts(a) - ts(b) || (a < b ? -1 : 1))[0];
      args.push(new FieldPath('members', heir, 'role'), 'admin');
    }
    tx.update(ref, ...args);
    return wasAdmin && !adminLeft ? 'leftHandover' : 'left';
  });
  // 'missing' po dřívějším přerušeném běhu: dokument je pryč, podkolekce mohly zůstat
  if (outcome === 'sole' || outcome === 'missing') await db.recursiveDelete(ref);
  return outcome;
}

// Stopy uživatele ve skupině zmizí hned, ne až přes TTL: aktivita (feed, 7 dní), sdílené položky (zrcadla návyků, cílů, poznámek a receptů),
// reakce a komentáře, které dal (30 dní), i reakce na jeho položky (ty už neexistují).
// Levné: dotazy na jedno pole (automatický index)
const ACT_DELETE_BATCH = 400;
async function deleteWhere(col, field, uid) {
  for (let i = 0; i < 20; i++) {
    const s = await col.where(field, '==', uid).limit(ACT_DELETE_BATCH).get();
    if (!s.docs.length) return;
    const b = db.batch();
    s.docs.forEach(d => b.delete(d.ref));
    await b.commit();
    if (s.docs.length < ACT_DELETE_BATCH) return;
  }
}
async function deleteUserActivity(gid, uid) {
  await deleteWhere(db.collection(`families/${gid}/activity`), 'uid', uid);
  // Reakce a komentáře ostatních určené jemu (záznamy feedu s to == uid)
  await deleteWhere(db.collection(`families/${gid}/activity`), 'to', uid);
  await deleteWhere(db.collection(`families/${gid}/shared`), 'ownerUid', uid);
  await deleteWhere(db.collection(`families/${gid}/reactions`), 'uid', uid);
  await deleteWhere(db.collection(`families/${gid}/reactions`), 'to', uid);
  // Příspěvky ve společných výzvách (p.<uid>); výzvy, které založil, zůstávají skupině (bez jména, jen uid zakladatele)
  const chs = await db.collection(`families/${gid}/challenges`).where(new FieldPath('p', uid, 'n'), '>=', 0).get();
  for (const d of chs.docs) await d.ref.update(new FieldPath('p', uid), FieldValue.delete());
}

exports.deleteAccount = onCall({cors: true, region: 'europe-west1', timeoutSeconds: 300}, async (request) => {
  const L = reqLang(request);
  if (!request.auth) throw new HttpsError('unauthenticated', tS(L, 'err.auth'));
  const uid = request.auth.uid;
  const data = request.data || {};
  if (data.confirm !== 'SMAZAT') throw new HttpsError('invalid-argument', tS(L, 'err.delConfirm'));
  const authTime = Number(request.auth.token && request.auth.token.auth_time);
  if (!Number.isFinite(authTime) || Date.now() / 1000 - authTime > DELETE_REAUTH_SEC) {
    throw new HttpsError('failed-precondition', tS(L, 'err.delReauth'));
  }

  let step = 'a';
  try {
    // (a) skupiny z profilu (profil píše klient → ID ověřit formátem)
    const profSnap = await db.doc(`users/${uid}/profile/main`).get();
    const prof = profSnap.exists ? (profSnap.data() || {}) : {};
    const gids = new Set([prof.familyId, ...(Array.isArray(prof.extraGroupIds) ? prof.extraGroupIds : [])]
      .filter(g => typeof g === 'string' && GROUP_ID_RE.test(g)));
    // + skupiny, kde je v members, ale profil o nich neví (automatický single-field index)
    const memberSnap = await db.collection('families')
      .where(new FieldPath('members', uid, 'role'), 'in', ['admin', 'member']).get();
    memberSnap.forEach(d => gids.add(d.id));
    // (b) odchod ze skupin; obsah přidaný uživatelem zůstává (privacy.html bod 5), jeho aktivita (feed),
    //     sdílené návyky a reakce se mažou
    step = 'b';
    for (const gid of gids) {
      const outcome = await leaveGroupForDelete(gid, uid);
      console.log(`[LP] deleteAccount uid=${uid} skupina: ${outcome}`);
      // Smazaná skupina (sole/missing) uklidila aktivitu sama; chyba úklidu smazání účtu nezastaví (zbytek smaže TTL)
      if (outcome !== 'sole' && outcome !== 'missing') {
        try { await deleteUserActivity(gid, uid); }
        catch(e) { console.error(`[LP] deleteAccount uid=${uid} aktivita: ${e && e.code || ''}`); }
      }
    }
    // (c) osobní data včetně všech podkolekcí
    step = 'c';
    await db.recursiveDelete(db.doc(`users/${uid}`));
    // (d) limit AI
    step = 'd';
    await db.doc(`rateLimits/${uid}`).delete();
  } catch (e) {
    console.error(`[LP] deleteAccount uid=${uid} krok ${step} selhal: ${e && e.code || ''} ${e && e.message || ''}`);
    throw new HttpsError('internal', tS(L, 'err.delFail'));
  }

  // (e) Auth účet až nakonec; už smazaný = hotovo (opakované volání)
  try {
    await getAuth().deleteUser(uid);
  } catch (e) {
    if (!(e && e.code === 'auth/user-not-found')) {
      console.error(`[LP] deleteAccount uid=${uid} krok e selhal: ${e && e.code || ''}`);
      // details.reason: klient pozná stav bez ohledu na jazyk zprávy
      throw new HttpsError('internal', tS(L, 'err.delAuthFail'), {reason: 'dataGone'});
    }
  }
  console.log(`[LP] deleteAccount uid=${uid} hotovo`);
  return {ok: true};
});

// ── Rotate Group Code — nový kód skupiny (jen správce) ───────────────────────
// Kód = ID dokumentu, proto se skupina zkopíruje pod nové ID a stará se smaže.
// Pořadí a selhání:
//  (1) zámek ve staré skupině (codeRotation) – selže → nic se nezměnilo
//  (2) nový dokument přes create() (unikátní ID) + kopie všech podkolekcí rekurzivně
//  (3) profily AKTUÁLNÍCH členů (transakce): familyId / extraGroupIds stará → nová
//      selže (2) nebo (3) nebo dojde čas → profily zpět, nový strom pryč, zámek pryč, stará beze změny
//  (4) BOD BEZ NÁVRATU: jedna transakce přečte a smaže starý dokument. Starý kód tím přestane platit
//      a pravidla odmítnou další zápisy do starých podkolekcí (exists rodiče), okno se zavře.
//      Ostatní klienti se přepnou až teď (checkGroupGone), do té doby psali do staré skupiny.
//  (4b) dorovnání ze snapshotu mazací transakce (konečný stav): členové (příchody, odchody, změna
//      jména / avataru) a pole hlavního dokumentu; novější zápisy v nové skupině se nepřepisují.
//      Člen přepnutý v (3), který už v members není, dostane profil zpět (nový kód pryč).
//  (4c) delta kopie: dokumenty staré skupiny změněné od začátku kopie; selže → ještě jeden pokus
//  (4d) staré podkolekce se smažou JEN po úplné deltě; jinak zůstanou pro ruční obnovu
//      a vrátí se {code, oldRemoved:false, deltaIncomplete:true}
// Po (4) se už nic nevrací zpět. Čas: kopie max. 150 s, (4) nejpozději 170 s od startu,
// delta do 280 s (funkce má 300 s); pád na timeout po (4) nechá stará data na místě.
// Nepřenese se: dokumenty smazané ve staré skupině během přesunu a zápisy offline klientů,
// které dorazí až po smazání staré skupiny (pravidla je odmítnou).
// Logy jen technicky: krok, počty a kód chyby; žádné kódy skupin ani obsah.
// Slova a abeceda musí odpovídat app.js a firestore.rules (hlídá .github/scripts/ci-check.js)
const FAMILY_WORDS = ['ADAM','ANNA','BARA','DOMA','ELAN','FARA','HANA','JANA','KARA','LARA','MARA','NORA','PATA','RANA','SARA','TARA'];
const FAMILY_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ROTATE_LOCK_MS = 6 * 60 * 1000;      // déle než timeout funkce → zámek po pádu sám vyprší
const ROTATE_COOLDOWN_MS = 2 * 60 * 1000;  // ochrana proti opakovanému klikání
const ROTATE_COPY_MS = 150 * 1000;         // rozpočet na kopii podkolekcí
const ROTATE_DEADLINE_MS = 170 * 1000;     // nejzazší bod bez návratu (zbytek: dorovnání, delta, úklid)
const ROTATE_HARD_MS = 280 * 1000;         // delta musí skončit před timeoutem 300 s
const COPY_BATCH = 400;
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;
// Pole hlavního dokumentu, která dorovnání nepřenáší (vlastní rotace, členové zvlášť)
const ROTATE_SKIP_FIELDS = new Set(['code', 'codeRotation', 'codeRotatedAt', 'members']);

function genGroupCode() {
  const crypto = require('crypto');
  let s = '';
  for (let i = 0; i < 6; i++) s += FAMILY_CODE_ALPHABET[crypto.randomInt(FAMILY_CODE_ALPHABET.length)];
  return FAMILY_WORDS[crypto.randomInt(FAMILY_WORDS.length)] + '-' + s;
}

// a < b pro Firestore Timestamp (bez převodu na ms, ať se neztratí přesnost)
function tsBefore(a, b) {
  return a.seconds < b.seconds || (a.seconds === b.seconds && a.nanoseconds < b.nanoseconds);
}
function tsAfter(a, b) { return tsBefore(b, a); }
function sameVal(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function deadlineErr() { return Object.assign(new Error('deadline'), {code: 'deadline'}); }

// Zkopíruje všechny podkolekce src → dst (rekurzivně, i dokumenty bez dat s vnořenými kolekcemi);
// copied = cesty zapsané v cíli (delta pak pozná dokument, který přepnutý klient smazal);
// check() hlídá čas před každou dávkou
async function copySubcollections(srcRef, dstRef, stats, copied, check) {
  const cols = await srcRef.listCollections();
  for (const col of cols) {
    const refs = await col.listDocuments();
    for (let i = 0; i < refs.length; i += COPY_BATCH) {
      check();
      const chunk = refs.slice(i, i + COPY_BATCH);
      const snaps = await db.getAll(...chunk);
      const batch = db.batch();
      let n = 0;
      for (const s of snaps) {
        if (!s.exists) continue;
        const dst = dstRef.collection(col.id).doc(s.id);
        batch.set(dst, s.data());
        copied.add(dst.path);
        n++;
      }
      if (n) { await batch.commit(); stats.docs += n; }
    }
    for (const r of refs) await copySubcollections(r, dstRef.collection(col.id).doc(r.id), stats, copied, check);
  }
}

// Delta kopie: dokumenty staré skupiny změněné po `since` (začátek kopie).
// Cíl se přepíše jen když ho od kopie nikdo nezměnil (updateTime <= copyEnd);
// novější zápis už přepnutého klienta má přednost. Chybějící cíl: zkopírovaný dřív = přepnutý
// klient ho smazal → nechat; jinak nový dokument → zapsat. Každý dokument ve vlastní transakci.
// Opakované spuštění je bezpečné (co už delta zapsala, má updateTime > copyEnd).
async function copyDelta(srcRef, dstRef, since, copyEnd, copied, stats, check) {
  const cols = await srcRef.listCollections();
  for (const col of cols) {
    const refs = await col.listDocuments();
    for (let i = 0; i < refs.length; i += COPY_BATCH) {
      check();
      const snaps = await db.getAll(...refs.slice(i, i + COPY_BATCH));
      for (const s of snaps) {
        if (!s.exists || !tsBefore(since, s.updateTime)) continue;
        const dst = dstRef.collection(col.id).doc(s.id);
        const wrote = await db.runTransaction(async (tx) => {
          const t = await tx.get(dst);
          if (t.exists ? tsAfter(t.updateTime, copyEnd) : copied.has(dst.path)) return false;
          tx.set(dst, s.data());
          return true;
        });
        if (wrote) stats.delta++;
      }
    }
    for (const r of refs) await copyDelta(r, dstRef.collection(col.id).doc(r.id), since, copyEnd, copied, stats, check);
  }
}

// Přepne skupinu v profilu člena (hlavní i vedlejší); transakce nepřepíše souběžné změny profilu.
// Kopíruje se všechno včetně activity (reakce a_<id> na ni odkazují), proto se přenese i „přečteno“
// (groupFeedSeen), jinak by po změně kódu naskočila celá historie jako nová.
async function swapGroupInProfile(uid, from, to) {
  const ref = db.doc(`users/${uid}/profile/main`);
  return db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) return false;
    const p = s.data() || {};
    const upd = {};
    if (p.familyId === from) upd.familyId = to;
    if (Array.isArray(p.extraGroupIds) && p.extraGroupIds.includes(from)) {
      upd.extraGroupIds = [...new Set(p.extraGroupIds.map(g => g === from ? to : g))];
    }
    if (!Object.keys(upd).length) return false;
    const seen = p.groupFeedSeen && typeof p.groupFeedSeen === 'object' ? Number(p.groupFeedSeen[from]) : NaN;
    tx.update(ref, ...Object.entries(upd).flat(), new FieldPath('groupFeedSeen', to), Number.isFinite(seen) ? seen : Date.now());
    return true;
  });
}

// Odebere nový kód z profilu člena, který během přesunu odešel / byl odebrán.
// familyId se maže jen když pořád ukazuje na skupinu a člen v ní není (jako clearProfileFamilyIdIf v app.js)
async function dropGroupFromProfile(uid, groupRef) {
  const ref = db.doc(`users/${uid}/profile/main`);
  return db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const g = await tx.get(groupRef);
    if (!s.exists) return false;
    if (g.exists && (g.data().members || {})[uid]) return false;
    const p = s.data() || {};
    const upd = {};
    if (p.familyId === groupRef.id) upd.familyId = FieldValue.delete();
    if (Array.isArray(p.extraGroupIds) && p.extraGroupIds.includes(groupRef.id)) {
      upd.extraGroupIds = p.extraGroupIds.filter(x => x !== groupRef.id);
    }
    if (!Object.keys(upd).length) return false;
    tx.update(ref, upd);
    return true;
  });
}

// Bod bez návratu: v jedné transakci přečte konečný stav starého dokumentu a smaže ho.
// Vrací {data, sure}. Nejistý commit (chyba po odeslání) se ověří čtením: dokument pryč = smazáno.
// Když nejde ověřit, sure:false → pokračuje se bez mazání starých dat (nic se nevrací zpět).
// Vyhodí chybu jen když starý dokument prokazatelně existuje dál (nebo ho smazal někdo jiný předem).
async function deleteOldGroup(ref) {
  let last = null;
  try {
    const data = await db.runTransaction(async (tx) => {
      const s = await tx.get(ref);
      if (!s.exists) {
        if (last) return last; // předchozí pokus transakce už smazal
        throw Object.assign(new Error('gone'), {code: 'gone'});
      }
      last = s.data() || {};
      tx.delete(ref);
      return last;
    });
    return {data, sure: true};
  } catch (e) {
    if (!last) throw e;
    let exists;
    try { exists = (await ref.get()).exists; } catch (e2) { return {data: last, sure: false}; }
    if (!exists) return {data: last, sure: true};
    throw e;
  }
}

exports.rotateGroupCode = onCall({cors: true, region: 'europe-west1', timeoutSeconds: 300}, async (request) => {
  const L = reqLang(request);
  if (!request.auth) throw new HttpsError('unauthenticated', tS(L, 'err.auth'));
  const uid = request.auth.uid;
  const gid = String((request.data || {}).gid || '');
  if (!GROUP_ID_RE.test(gid)) throw new HttpsError('invalid-argument', tS(L, 'err.grpCode'));
  const oldRef = db.doc(`families/${gid}`);

  // (1) oprávnění + zámek v jedné transakci; čas z budoucnosti (posunuté hodiny) se ignoruje
  const now = Date.now();
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(oldRef);
      if (!snap.exists) throw new HttpsError('not-found', tS(L, 'err.grpNotFound'));
      const d = snap.data() || {};
      const me = d.members && d.members[uid];
      if (!me || me.role !== 'admin') throw new HttpsError('permission-denied', tS(L, 'err.rotAdmin'));
      const lockAt = Number(d.codeRotation && d.codeRotation.at);
      if (Number.isFinite(lockAt) && lockAt <= now && now - lockAt < ROTATE_LOCK_MS) throw new HttpsError('aborted', tS(L, 'err.rotBusy'));
      const lastAt = Date.parse(d.codeRotatedAt);
      if (Number.isFinite(lastAt) && lastAt <= now && now - lastAt < ROTATE_COOLDOWN_MS) throw new HttpsError('resource-exhausted', tS(L, 'err.rotCooldown'));
      tx.update(oldRef, {codeRotation: {at: now, by: uid}});
    });
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error(`[LP] rotateGroupCode uid=${uid} krok 1 selhal: ${e && e.code || ''}`);
    throw new HttpsError('unavailable', tS(L, 'err.rotUnavail'));
  }

  let step = '2';
  let newCode = null, newRef = null;
  const swapped = [];
  const stats = {docs: 0, delta: 0, reverted: 0};
  const copied = new Set();
  const elapsed = () => Date.now() - now;
  const timeUp = (limit) => { if (elapsed() > limit) throw deadlineErr(); };
  let since, copyEnd, base, curMembers, fin;
  try {
    // (2) stav na začátku kopie: readTime = hranice pro delta kopii
    const startSnap = await oldRef.get();
    if (!startSnap.exists) throw Object.assign(new Error('gone'), {code: 'gone'});
    since = startSnap.readTime;
    base = startSnap.data() || {};
    delete base.codeRotation;
    // nový dokument s unikátním ID (create selže, když už existuje) + podkolekce
    const data = {...base, codeRotatedAt: new Date(now).toISOString()};
    for (let i = 0; i < 5 && !newCode; i++) {
      const code = genGroupCode();
      if (code === gid) continue;
      const ref = db.doc(`families/${code}`);
      try {
        await ref.create({...data, code});
        newCode = code; newRef = ref;
      } catch (e) {
        if (!(e && (e.code === 6 || e.code === 'already-exists'))) throw e;
      }
    }
    if (!newCode) throw Object.assign(new Error('no free code'), {code: 'no-free-code'});
    await copySubcollections(oldRef, newRef, stats, copied, () => timeUp(ROTATE_COPY_MS));

    // Členové se mohli během kopie změnit (připojení / odchod) → seznam podle aktuálního stavu.
    // readTime = konec kopie: cílové dokumenty s updateTime <= copyEnd zapsala jen kopie
    const cur = await oldRef.get();
    if (!cur.exists) throw Object.assign(new Error('gone'), {code: 'gone'});
    copyEnd = cur.readTime;
    curMembers = cur.data().members || {};
    await newRef.update({members: curMembers});

    // (3) profily jen aktuálních členů (kdo během kopie odešel, nový kód nedostane)
    timeUp(ROTATE_DEADLINE_MS);
    step = '3';
    for (const m of Object.keys(curMembers)) {
      if (UID_RE.test(m) && await swapGroupInProfile(m, gid, newCode)) swapped.push(m);
    }

    // (4) bod bez návratu: konečný stav + smazání starého dokumentu
    timeUp(ROTATE_DEADLINE_MS);
    step = '4';
    for (let i = 0; !fin; i++) {
      try { fin = await deleteOldGroup(oldRef); }
      catch (e) {
        if (i || (e && e.code === 'gone')) throw e;
        console.error(`[LP] rotateGroupCode uid=${uid} krok 4 pokus 1 selhal: ${e && e.code || ''}`);
        timeUp(ROTATE_DEADLINE_MS);
      }
    }
  } catch (e) {
    // jen kód chyby: zpráva Firestore může obsahovat cestu s kódem skupiny
    console.error(`[LP] rotateGroupCode uid=${uid} krok ${step} selhal: ${e && e.code || ''}`);
    // Úklid: profily zpět, nový strom pryč, zámek pryč → stará skupina jako předtím
    let cleanOk = true;
    for (const m of swapped) {
      try { await swapGroupInProfile(m, newCode, gid); }
      catch (e2) { cleanOk = false; console.error(`[LP] rotateGroupCode úklid profilu selhal: ${e2 && e2.code || ''}`); }
    }
    if (newRef) {
      try { await db.recursiveDelete(newRef); }
      catch (e2) { cleanOk = false; console.error(`[LP] rotateGroupCode úklid nové skupiny selhal: ${e2 && e2.code || ''}`); }
    }
    try { await oldRef.update({codeRotation: FieldValue.delete()}); }
    catch (e2) { console.error(`[LP] rotateGroupCode uvolnění zámku selhalo: ${e2 && e2.code || ''}`); } // vyprší sám
    if (!cleanOk) console.error(`[LP] rotateGroupCode úklid neúplný`);
    if (e && e.code === 'deadline') throw new HttpsError('deadline-exceeded', tS(L, 'err.rotDeadline'));
    throw new HttpsError('internal', tS(L, 'err.rotFail'));
  }

  // ── Od tady se nic nevrací zpět: starý kód neplatí, zbytek jen dotahuje stav ──
  const ld = fin.data || {};
  const lastMembers = ld.members || {};

  // (4b) dorovnání ze snapshotu mazací transakce; idempotentní → při chybě ještě jeden pokus
  const syncFinal = async () => {
    await db.runTransaction(async (tx) => {
      const t = await tx.get(newRef);
      const nd = t.data() || {};
      const out = {...nd, members: {...(nd.members || {})}};
      for (const [m, v] of Object.entries(lastMembers)) {
        if (!curMembers[m]) { if (!out.members[m]) out.members[m] = v; } // připojil se
        else if (!sameVal(v, curMembers[m]) && sameVal(out.members[m], curMembers[m])) out.members[m] = v; // jméno, avatar, role
      }
      for (const m of Object.keys(curMembers)) if (!lastMembers[m]) delete out.members[m]; // odešel / odebrán
      for (const k of new Set([...Object.keys(base), ...Object.keys(ld)])) {
        if (ROTATE_SKIP_FIELDS.has(k) || sameVal(ld[k], base[k]) || !sameVal(nd[k], base[k])) continue;
        if (k in ld) out[k] = ld[k]; else delete out[k];
      }
      if (!sameVal(out, nd)) tx.set(newRef, out);
    });
    for (const m of Object.keys(lastMembers)) {
      if (curMembers[m] || !UID_RE.test(m) || swapped.includes(m)) continue;
      if (await swapGroupInProfile(m, gid, newCode)) swapped.push(m);
    }
    for (const m of swapped) {
      if (!lastMembers[m] && await dropGroupFromProfile(m, newRef)) stats.reverted++;
    }
  };
  step = '4b';
  for (let i = 0; i < 2; i++) {
    try { await syncFinal(); break; }
    catch (e) { console.error(`[LP] rotateGroupCode uid=${uid} krok 4b pokus ${i + 1} selhal: ${e && e.code || ''}`); }
  }

  // (4c) delta kopie podkolekcí; po smazání starého dokumentu už do nich klienti nezapíšou
  step = '4c';
  let deltaOk = false;
  for (let i = 0; i < 2 && !deltaOk; i++) {
    if (i && elapsed() > ROTATE_HARD_MS) break;
    try {
      await copyDelta(oldRef, newRef, since, copyEnd, copied, stats, () => timeUp(ROTATE_HARD_MS));
      deltaOk = true;
    } catch (e) {
      console.error(`[LP] rotateGroupCode uid=${uid} krok 4c pokus ${i + 1} selhal: ${e && e.code || ''}`);
    }
  }

  // (4d) staré podkolekce smazat jen po úplné deltě (a jistém smazání dokumentu)
  if (!deltaOk || !fin.sure) {
    console.error(`[LP] rotateGroupCode uid=${uid} delta neúplná, stará data ponechána pro ruční obnovu (dokument smazán: ${fin.sure ? 'ano' : 'nejisté'})`);
    return {code: newCode, oldRemoved: false, deltaIncomplete: true};
  }
  try { await db.recursiveDelete(oldRef); }
  catch (e) { console.error(`[LP] rotateGroupCode uid=${uid} úklid podkolekcí selhal: ${e && e.code || ''}`); }

  console.log(`[LP] rotateGroupCode uid=${uid} hotovo: dokumentů ${stats.docs}, delta ${stats.delta}, profilů ${swapped.length}, vráceno ${stats.reverted}`);
  return {code: newCode, oldRemoved: true};
});

// ── Restore Group — obnova opuštěné skupiny (4.47) ───────────────────────────
// Když skupinu opustí všichni členové, dokument i data (nákupy, události…) zůstávají, jen k nim nikdo nemá
// přístup (pravidla pouští jen členy). Volající, který skupinu založil (createdBy) nebo ji opustil
// (users/{uid}/profile/main.formerGroups.{kód}, zapisuje klient při odchodu), ji tu vrátí:
//  - bez gid: seznam takových skupin bez členů (max 20) s počty položek
//  - s gid: v transakci ověří totéž, přidá volajícího jako správce a skupinu zapíše do profilu
//    (familyId, pokud nemá platnou hlavní skupinu, jinak extraGroupIds).
// Pravidla Firestore se nemění (Admin SDK). Ostatní se pak připojí kódem běžnou cestou.
// Logy bez kódů skupin, názvů a jmen.
const RESTORE_MAX = 20;
const RESTORE_SCAN = 50;
const RESTORE_COUNTS = [['shop', 'shopItems'], ['cal', 'events'], ['check', 'checklists'], ['pantry', 'pantry']];

function isEmptyGroup(d) {
  const m = d && d.members;
  return !m || typeof m !== 'object' || Object.keys(m).length === 0;
}
// Kódy opuštěných skupin z profilu (klient píše jen vlastní profil → ověřit formát a omezit počet)
function formerGroupIds(prof) {
  const fg = prof && prof.formerGroups;
  if (!fg || typeof fg !== 'object') return [];
  return Object.keys(fg).filter(g => GROUP_ID_RE.test(g))
    .sort((a, b) => (Number(fg[b]) || 0) - (Number(fg[a]) || 0)).slice(0, RESTORE_MAX);
}
function canRestore(d, uid, former, gid) {
  return isEmptyGroup(d) && (d.createdBy === uid || former.includes(gid));
}

exports.restoreGroup = onCall({cors: true, region: 'europe-west1', timeoutSeconds: 60}, async (request) => {
  const L = reqLang(request);
  if (!request.auth) throw new HttpsError('unauthenticated', tS(L, 'err.auth'));
  const uid = request.auth.uid;
  const profRef = db.doc(`users/${uid}/profile/main`);
  const rawGid = (request.data || {}).gid;

  // (1) Seznam obnovitelných skupin
  if (rawGid === undefined || rawGid === null || rawGid === '') {
    try {
      const ps = await profRef.get();
      const former = formerGroupIds(ps.exists ? ps.data() : {});
      const snaps = new Map();
      // automatický single-field index na createdBy
      const own = await db.collection('families').where('createdBy', '==', uid).limit(RESTORE_SCAN).get();
      own.forEach(s => snaps.set(s.id, s));
      const rest = former.filter(g => !snaps.has(g));
      if (rest.length) (await db.getAll(...rest.map(g => db.doc(`families/${g}`)))).forEach(s => { if (s.exists) snaps.set(s.id, s); });
      const found = [...snaps.values()]
        .filter(s => canRestore(s.data() || {}, uid, former, s.id))
        .sort((a, b) => String((b.data() || {}).createdAt || '').localeCompare(String((a.data() || {}).createdAt || '')))
        .slice(0, RESTORE_MAX);
      const groups = await Promise.all(found.map(async (s) => {
        const d = s.data() || {};
        const counts = {};
        await Promise.all(RESTORE_COUNTS.map(async ([key, col]) => {
          try { counts[key] = (await s.ref.collection(col).count().get()).data().count; }
          catch (e) { counts[key] = null; }
        }));
        return {
          id: s.id,
          name: String(d.groupName || '').slice(0, 40),
          createdAt: typeof d.createdAt === 'string' ? d.createdAt.slice(0, 40) : null,
          counts,
        };
      }));
      console.log(`[LP] restoreGroup uid=${uid} seznam: ${groups.length}`);
      return {groups};
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      console.error(`[LP] restoreGroup uid=${uid} seznam selhal: ${e && e.code || ''}`);
      throw new HttpsError('unavailable', tS(L, 'err.resList'));
    }
  }

  // (2) Obnova jedné skupiny
  const gid = String(rawGid);
  if (!GROUP_ID_RE.test(gid)) throw new HttpsError('invalid-argument', tS(L, 'err.grpCode'));
  const ref = db.doc(`families/${gid}`);
  const tokenName = request.auth.token && typeof request.auth.token.name === 'string' ? request.auth.token.name : '';
  try {
    const res = await db.runTransaction(async (tx) => {
      const gs = await tx.get(ref);
      const ps = await tx.get(profRef);
      if (!gs.exists) throw new HttpsError('not-found', tS(L, 'err.resGone'));
      if (!ps.exists) throw new HttpsError('failed-precondition', tS(L, 'err.resSetup'));
      const d = gs.data() || {};
      const p = ps.data() || {};
      if (!isEmptyGroup(d)) throw new HttpsError('failed-precondition', tS(L, 'err.resTaken'));
      if (!canRestore(d, uid, formerGroupIds(p), gid)) throw new HttpsError('permission-denied', tS(L, 'err.resDenied'));
      // Hlavní skupina: jen když v profilu žádná platná není (neexistuje nebo v ní nejsem)
      let asMain = true;
      if (typeof p.familyId === 'string' && p.familyId !== gid && GROUP_ID_RE.test(p.familyId)) {
        const ms = await tx.get(db.doc(`families/${p.familyId}`));
        if (ms.exists && (ms.data().members || {})[uid]) asMain = false;
      }
      // Limit skupin na uživatele (stejně jako klient, 4.50): hlavní + vedlejší bez obnovované
      if (!asMain) {
        const extra = Array.isArray(p.extraGroupIds) ? p.extraGroupIds : [];
        const mine = new Set([p.familyId, ...extra].filter(g => typeof g === 'string' && g !== gid && GROUP_ID_RE.test(g)));
        if (mine.size >= GROUP_MAX) throw new HttpsError('failed-precondition', tS(L, 'err.resMax', {n: GROUP_MAX}));
      }
      const name = String(p.prezdivka || p.nickname || tokenName || '').trim().slice(0, 40) || tS('cs', 'grp.member'); // uložené jméno vidí všichni členové → neutrální česky jako dřív, ne v jazyce obnovujícího
      const avatar = typeof p.avatarId === 'string' && p.avatarId ? p.avatarId.slice(0, 40) : 'rex';
      tx.update(ref, new FieldPath('members', uid), {name, avatar, joinedAt: new Date().toISOString(), role: 'admin'});
      const upd = asMain
        ? ['familyId', gid]
        : ['extraGroupIds', FieldValue.arrayUnion(gid)];
      if (p.formerGroups && typeof p.formerGroups === 'object' && Object.prototype.hasOwnProperty.call(p.formerGroups, gid)) {
        upd.push(new FieldPath('formerGroups', gid), FieldValue.delete());
      }
      tx.update(profRef, ...upd);
      return {asMain, groupName: String(d.groupName || '').slice(0, 40)};
    });
    console.log(`[LP] restoreGroup uid=${uid} obnoveno (${res.asMain ? 'hlavní' : 'vedlejší'})`);
    return {gid, asMain: res.asMain, groupName: res.groupName};
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error(`[LP] restoreGroup uid=${uid} obnova selhala: ${e && e.code || ''}`);
    throw new HttpsError('unavailable', tS(L, 'err.resFail'));
  }
});
