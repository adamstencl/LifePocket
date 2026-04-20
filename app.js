import{initializeApp}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import{getAuth,signInWithPopup,GoogleAuthProvider,signOut,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,sendPasswordResetEmail,sendEmailVerification}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import{getFirestore,doc,setDoc,getDoc,collection,addDoc,updateDoc,deleteDoc,onSnapshot,query,orderBy,getDocs}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import{getMessaging,getToken}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js';
import{getFunctions,httpsCallable}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';

const FC={apiKey:"AIzaSyAwI761FoCCd6vWhXANRbOOQrVih_JDz0w",authDomain:"lifepocket-d8f0e.firebaseapp.com",projectId:"lifepocket-d8f0e",storageBucket:"lifepocket-d8f0e.firebasestorage.app",messagingSenderId:"763710336120",appId:"1:763710336120:web:84085b690117f605f8918d"};
const fb=initializeApp(FC),auth=getAuth(fb),db=getFirestore(fb),gp=new GoogleAuthProvider();
let messaging=null;try{messaging=getMessaging(fb);}catch(e){}
const functions=getFunctions(fb,'europe-west1');
const claudeProxyFn=httpsCallable(functions,'claudeProxy');
const notifyFamilyFn=httpsCallable(functions,'notifyFamily');
const testPushFn=httpsCallable(functions,'testPush');
const VAPID_KEY='BCSH4S7n__eSj1QKSo22lC9Z7HrkMCR5d_pHIjv2qT-1WNYEuWrc_yjDA7KiCvqei6Tux4zWGQDFGdGZOdr6Sn4';


const APP_VERSION = '3.3';
const CHANGELOG = [
  { v:'3.3', items:[
    '🧊 Zásoby — opravena nabídka přidat do zásoby při sdíleném nákupním seznamu',
  ]},
  { v:'3.2', items:[
    '📤 Migrace kalendáře — tlačítko pro přesun starých událostí do sdíleného kalendáře',
  ]},
  { v:'3.1', items:[
    '📅 Sdílený kalendář — události se ukládají do rodinného kalendáře a vidí je všichni členové',
  ]},
  { v:'3.0', items:[
    '📐 Recepty — AI používá vždy jen ks/g/kg/ml/l (lžíce, hrnek, stroužky automaticky převede)',
  ]},
  { v:'2.9', items:[
    '🔢 Zásoby — přepočet jednotek při vaření (200 ml z 1 l = zbyde 0.8 l)',
  ]},
  { v:'2.8', items:[
    '🧊 Zásoby — standardizované jednotky (ks, g, kg, ml, l)',
  ]},
  { v:'2.7', items:[
    '✕ Nesplněný návyk na dashboardu — červené ✕ místo prázdného kroužku',
    '🧊 Zásoby — nabídka přidat do zásoby funguje i když jsou zásoby prázdné',
  ]},
  { v:'2.6', items:[
    '📧 Ověření emailu — po registraci přijde potvrzovací email',
    '⌨️ Klávesnice na mobilu — tlačítka v dialozích již nejsou skryta pod klávesnicí',
    '🔒 Popis soukromí — upřesněno kde jsou data uložena',
  ]},
  { v:'2.5', items:[
    '🔑 Oprava VAPID klíče — notifikace při zavřené appce nyní fungují správně',
  ]},
  { v:'2.4', items:[
    '📅 Notifikace kalendáře — připomínky událostí hodinu předem fungují i při zavřené appce',
    '📡 Test server push — v Nastavení → Notifikace ověříš že server push funguje',
  ]},
  { v:'2.3', items:[
    '🔔 Notifikace — opraveny na Androidu a PWA, nyní fungují spolehlivě',
    '🔴 Návyky — nula je zobrazena červeně (odlišné od nezaznamenáno)',
    '👨‍👩‍👧 Rodina — přehledné přepínače modulů + správce může odebrat člena',
    '🥗 Jídelníček — denní kalorický cíl přesunut z nastavení přímo do jídelníčku',
  ]},
  { v:'2.2', items:[
    '🏷️ Název skupiny — pojmenuj skupinu jak chceš (Rodina, Spolubydlící…)',
    '📅 Vícedenní události — v kalendáři zadej rozsah datumů (např. 10–11. dubna)',
    '✅ Checklist jako modul — lze zapnout/vypnout v Nastavení → Moduly',
  ]},
  { v:'2.1', items:[
    '📣 Informovat skupinu — tlačítko v nákupech, odešle push notifikaci ostatním členům skupiny',
  ]},
  { v:'2.0', items:[
    '🧠 Paměť AI asistenta — konverzace se ukládají, asistent si pamatuje co sis psali',
    '📝 AI summary — každých 20 zpráv vytvoří souhrn klíčových věcí o tobě',
    '🔄 Kontinuita — navážeš přesně tam kde jste skončili, i po měsíci',
  ]},
  { v:'1.9', items:[
    '🤖 AI asistent — lze vypnout v Nastavení → Moduly (výchozí: zapnuto)',
  ]},
  { v:'1.8', items:[
    '🧊 Zásoby v Nákupech — stejný modul, záložka přímo v nákupní sekci',
    '⚠️ Badge na záložce Zásoby — vidíš kolik položek dochází',
    '💡 Hint při psaní — zobrazí aktuální stav zásoby dané položky',
    '🧊 Propis do zásob — po zaškrtnutí nákupu nabídne přidat do zásob',
    '🤖 AI návrh nákupu — doporučí co koupit na základě tvých receptů',
  ]},
  { v:'1.7', items:[
    '🛒 Nákupy — sdílení přes WhatsApp teď zahrnuje správný seznam (osobní nebo rodinný)',
    '👨‍👩‍👧 Nákupy — tlačítko pro přesun osobního seznamu do rodinného sdílení',
  ]},
  { v:'1.6', items:[
    '🍽️ Vaření — filtrování receptů podle typu (Snídaně/Svačina/Oběd/Večeře)',
    '🤖 AI recept — typ jídla ovlivní co AI vygeneruje',
  ]},
  { v:'1.5', items:[
    '🍽️ Jídelníček — oprava výběru receptu, typ jídla místo náročnosti',
    '🗑️ Checklist — možnost smazat celý seznam',
    '🌅 Návyky — sekce Ráno/Den/Večer si pamatují stav skrytí',
    '🛒 Nákupy — oprava úpravy množství',
    '👫 Pohlaví — správné skloňování v notifikacích',
  ]},
  { v:'1.4', items:[
    '🔔 Push notifikace — fungují i když je appka zavřená!',
    '🌅 Ranní & večerní shrnutí přesně v čas',
    '💪 Připomínky návyků v nastavenou hodinu',
    '🎂 Narozeniny — upozornění den předem',
    '🌍 Rex mluví vždy česky (oprava cizích jazyků)',
  ]},
  { v:'1.3', items:[
    '✅ Checklist — vstupní řádek nahoře, nové položky přidány navrch',
    '👁️ Přihlášení — očičko pro zobrazení/skrytí hesla',
    '✨ Registrace — přehlednější průvodce s tlačítkem Zpět',
    '🛒 Nákupy — rychlé přidání oblíbených položek jedním klikem',
    '📷 Foto přímo při zadávání nové položky v checklistu',
  ]},
  { v:'1.2', items:[
    '📷 Foto v poznámkách — přidej snímek k záznamu v deníku',
    '📷 Foto v checklistu — foť si úkoly přímo v seznamu',
    '🦖 Rex Tamagotchi — Rex teď odráží tvůj výkon dne',
    '😊 Nálada tracker — denní check-in přímo na dashboardu',
    '🔔 Changelog — víš co je nového po každé aktualizaci',
  ]},
];

function checkChangelog() {
  const seen = lsGet('lp_seen_version', '');
  if (seen === APP_VERSION) return;
  // Při update vymaž cached citát aby se vygeneroval nový
  localStorage.removeItem('lp_daily_quote');
  const entry = CHANGELOG.find(c => c.v === APP_VERSION);
  if (!entry) return;
  document.getElementById('app').insertAdjacentHTML('beforeend', `
    <div class="moverlay open" id="changelog-modal" onclick="if(event.target===this)closeChangelog()">
      <div class="modal" style="max-width:380px;gap:0">
        <div style="font-size:36px;text-align:center;margin-bottom:8px">🎉</div>
        <div style="font-family:'Playfair Display',serif;font-style:italic;font-size:20px;color:var(--accent);text-align:center;margin-bottom:4px">Co je nového</div>
        <div style="font-size:13px;color:var(--text3);text-align:center;margin-bottom:18px">Verze ${entry.v}</div>
        <ul style="list-style:none;padding:0;margin:0 0 20px;display:flex;flex-direction:column;gap:10px">
          ${entry.items.map(i=>`<li style="font-size:14px;color:var(--text);background:var(--card2);border-radius:10px;padding:10px 14px">${i}</li>`).join('')}
        </ul>
        <button class="btn-p" onclick="closeChangelog()">Super, díky! 👍</button>
      </div>
    </div>`);
}
window.closeChangelog = function() {
  lsSave('lp_seen_version', APP_VERSION);
  document.getElementById('changelog-modal')?.remove();
};

const AVS=[
  {id:'rex',emoji:'⚔️',name:'Rex',vibe:'Tvrdý trénink,\njasné cíle.'},
  {id:'sage',emoji:'🌿',name:'Sage',vibe:'Ticho, moudrost,\nhloubka.'},
  {id:'ash',emoji:'🔥',name:'Ash',vibe:'Nový začátek\nkaždý den.'},
  {id:'nora',emoji:'🏡',name:'Nora',vibe:'Teplo domova,\npéče o blízké.'},
  {id:'rio',emoji:'🌊',name:'Rio',vibe:'Žít naplno,\nbez hranic.'},
];
const MODS=[
  {id:'rex',emoji:'🤖',name:'AI asistent',desc:'Chat s tvým osobním AI průvodcem — rady, motivace, odpovědi na cokoliv.'},
  {id:'habits',emoji:'🔥',name:'Návyky',desc:'Buduj denní rutiny, sleduj streak a plň si osobní výzvy.'},
  {id:'journal',emoji:'📒',name:'Poznámky',desc:'Piš si myšlenky, nálady a záznamy dne — text i hlas.'},
  {id:'calendar',emoji:'🗓️',name:'Kalendář',desc:'Události, narozeniny a rodinný kalendář na jednom místě.'},
  {id:'goals',emoji:'🏆',name:'Cíle',desc:'Nastav si životní cíle, sleduj milníky a plň je krok za krokem.'},
  {id:'cooking',emoji:'👨‍🍳',name:'Vaření',desc:'Ukládej recepty, sleduj kalorie a generuj nákupní seznamy.'},
  {id:'shopping',emoji:'🧺',name:'Nákupy',desc:'Chytrý nákupní seznam — AI sestaví seznam z receptu za pár sekund.'},
  {id:'mealplan',emoji:'🥗',name:'Jídelníček',desc:'Plánuj jídla na celý týden a sdílej jídelníček s rodinou.'},
  {id:'checklist',emoji:'✅',name:'Checklist',desc:'Sdílené seznamy úkolů pro celou skupinu — cestování, přípravy, projekty.'},
];
const AVMODS={rex:['habits','goals','journal'],sage:['journal','goals'],ash:['habits','goals'],nora:['cooking','shopping','calendar'],rio:['journal','calendar']};
const AVGREET={rex:{m:n=>`Vítej, ${n}! Makáme a plníme cíle. Připraven?`,f:n=>`Vítej, ${n}! Připravena?`},sage:{m:n=>`Ahoj ${n}, pojď zkoumat sebe sama.`,f:n=>`Ahoj ${n}, pojď zkoumat sebe sama.`},ash:{m:n=>`Hej ${n}! Co dnes změníme?`,f:n=>`Hej ${n}! Co dnes změníme?`},nora:{m:n=>`Ahoj ${n}! Postarám se o tebe.`,f:n=>`Ahoj ${n}! Postarám se o tebe.`},rio:{m:n=>`Yo ${n}! Žijeme naplno!`,f:n=>`Yo ${n}! Žijeme naplno!`}};
const AVMSGS={rex:['Dnes je čas tvrdě makat! 💪','Každý splněný cíl tě posouvá dál.','Bez bolesti žádný pokrok!'],sage:['Ticho přináší moudrost. 🌿','Co sis dnes uvědomil o sobě?','Každý den je příležitost poznat sám sebe.'],ash:['Dnes je nový začátek! 🔥','Minulost nelze změnit, budoucnost tvoříš ty.','Změna začíná jedním krokem.'],nora:['Jak se dnes máš? 🏡','Malé radosti dělají velký život.','Jsi tu pro ostatní — nezapomeň na sebe.'],rio:['Žij naplno! 🌊','Dnes je skvělý den na nové dobrodružství!','Žít naplno je tvoje superschopnost.']};
const MOODS=[{emoji:'😄',label:'Skvělý'},{emoji:'🙂',label:'Dobrý'},{emoji:'😐',label:'Normální'},{emoji:'😔',label:'Unavený'},{emoji:'😤',label:'Frustr.'}];

let CU=null,prof={},goals=[],subs={},selMods=new Set(),selG='',selAv='',editGId=null,gEm='🌟',gCol='#f5c842',chatH=[],unsub=null,mood='',tmpAv='';
let chatMemorySummary=''; // AI-generated summary of older conversations
let customReminders = [];
const claudeKey = true; // klíč je na serveru (Firebase Function), klient ho nepotřebuje

// ── CLAUDE API HELPER — volá Firebase Function (klíč nikdy v klientu) ──────
async function callClaude(messages, maxTokens = 500) {
  try {
    const result = await claudeProxyFn({messages, maxTokens});
    return result.data.text;
  } catch(e) {
    const msg = e?.message || 'AI není k dispozici';
    if (msg.includes('resource-exhausted') || msg.includes('limit')) {
      toast('⚠️ Denní limit AI dotazů byl dosažen. Obnoví se zítra.');
    }
    throw new Error(msg);
  }
}
let micRec=null,micOn=false,dsRec=null,dsOn=false;
let entries=[], unsubEntries=null;

// ── Firebase subscription helper ──────────────────────────
// Eliminuje opakující se vzor: if(unsub) unsub(); unsub = onSnapshot(...)
const _fireSubs = {};
function createFireSub(key, ref, callback) {
  if (!CU) return;
  if (_fireSubs[key]) { _fireSubs[key](); delete _fireSubs[key]; }
  _fireSubs[key] = onSnapshot(ref, callback);
}
function destroyAllFireSubs() {
  Object.keys(_fireSubs).forEach(k => { if (_fireSubs[k]) _fireSubs[k](); delete _fireSubs[k]; });
}
// ──────────────────────────────────────────────────────────

onAuthStateChanged(auth,async u=>{
  if(u){CU=u;const s=await getDoc(doc(db,'users',u.uid,'profile','main'));if(s.exists()){prof=s.data();
    // Stávající uživatelé: přidat rex + checklist default pokud ještě nejsou v modules
    let migrated=false;
    if(prof.modules&&!prof.modules.includes('rex')){prof.modules=['rex',...prof.modules];migrated=true;}
    if(prof.modules&&!prof.modules.includes('checklist')){prof.modules=[...prof.modules,'checklist'];migrated=true;}
    if(migrated)await setDoc(doc(db,'users',u.uid,'profile','main'),prof);
    selMods=new Set(prof.modules||[]);initApp();
    if(u.providerData[0]?.providerId==='password'&&!u.emailVerified){
      setTimeout(()=>toast('📧 Ověř svůj email — zkontroluj schránku',5000),1000);
    }
  }else ss('s-step1');}
  else{
    CU=null;
    // Unsubscribe všechny Firebase listenery
    destroyAllFireSubs();
    [unsub,unsubHabits,unsubLogs,unsubFamily,unsubFamilyShop,unsubFamilyCal,unsubFamilyMeal].forEach(u=>{if(u)u();});
    unsub=null; unsubHabits=null; unsubLogs=null;
    unsubFamily=null; unsubFamilyShop=null; unsubFamilyCal=null; unsubFamilyMeal=null;
    // Reset dat
    entries=[]; habits=[]; habitLogs=[]; events=[]; shopItems=[]; goals=[];
    ss('s-login');
  }
});

function ss(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById('app').classList.remove('active');const el=document.getElementById(id);if(el){if(id==='app')el.classList.add('active');else el.classList.add('active');}}
function toast(m,d=2500){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),d);}
function fd(iso){if(!iso)return'';const d=new Date(iso+'T12:00:00'),df=Math.round((d-new Date())/86400000),s=d.toLocaleDateString('cs-CZ',{day:'numeric',month:'short'});if(df<0)return`⚠️ ${s}`;if(df===0)return'🔴 Dnes!';if(df<=7)return`🟠 ${s}`;return`📅 ${s}`;}
function esc(t){return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;').replace(/"/g,'&quot;');}
function lsGet(key,fallback=null){try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback;}catch(e){return fallback;}}
function lsSave(key,val){try{localStorage.setItem(key,JSON.stringify(val));}catch(e){}}
function genId(){return Math.random().toString(36).substr(2,9);}


// ── JOURNAL ───────────────────────────────────────────
let curEntryId=null, entryMood='', entryDirty=false;
let jRec=null, jRecOn=false;

function subEntries(){
  createFireSub('entries',
    query(collection(db,'users',CU.uid,'entries'),orderBy('createdAt','desc')),
    snap=>{ entries=snap.docs.map(d=>({id:d.id,...d.data()})); renderEntryList(); }
  );
}

function renderEntryList(filter=''){
  const list=document.getElementById('j-list');
  if(!list)return;
  const f=filter.toLowerCase();
  const filtered=!f?entries:entries.filter(e=>
    (e.title||'').toLowerCase().includes(f)||(e.text||'').toLowerCase().includes(f)
  );
  if(!filtered.length){
    list.innerHTML=f
      ? `<div style="text-align:center;color:var(--text3);font-size:14px;padding:20px;font-style:italic">🔍 Žádné výsledky pro „${f}"</div>`
      : `<div style="text-align:center;padding:32px 16px">
          <div style="font-size:40px;margin-bottom:10px">✍️</div>
          <div style="color:var(--text2);font-size:15px;margin-bottom:14px;font-style:italic">Zatím žádné zápisky</div>
          <button class="btn-p" style="width:auto;padding:9px 22px;font-size:14px" onclick="newEntry()">+ Napsat první zápisek</button>
         </div>`;
    return;
  }
  list.innerHTML=filtered.map(e=>{
    const d=e.createdAt?new Date(e.createdAt).toLocaleDateString('cs-CZ',{day:'numeric',month:'short',year:'numeric'}):'?';
    const preview=(e.text||'').slice(0,50);
    return `<div class="j-item ${e.id===curEntryId?'active':''}" onclick="openEntry('${esc(e.id)}')">
      <div class="j-item-date">${d}</div>
      <div class="j-item-title">${e.mood?`<span class="j-item-mood">${e.mood}</span>`:''}${e.title||'Bez názvu'}${e.photo?` <span style="font-size:11px">📷</span>`:''}</div>
      ${preview?`<div class="j-item-preview">${preview}…</div>`:''}
    </div>`;
  }).join('');
}

window.filterEntries=()=>renderEntryList(document.getElementById('j-search').value);

// ── Komprese obrázků ──────────────────────────────────────
async function compressImage(file, maxPx=900, quality=0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

let curEntryPhoto = null;

window.triggerEntryPhoto = () => document.getElementById('j-photo-input')?.click();
window.removeEntryPhoto = () => {
  curEntryPhoto = null;
  const p = document.getElementById('j-photo-preview');
  if (p) p.innerHTML = '';
};
window.handleEntryPhotoInput = async function(input) {
  const file = input.files[0];
  if (!file) return;
  toast('📷 Zpracovávám fotku…');
  try {
    curEntryPhoto = await compressImage(file);
    const p = document.getElementById('j-photo-preview');
    if (p) p.innerHTML = `<div style="position:relative;display:inline-block;margin-top:8px">
      <img src="${curEntryPhoto}" style="max-width:100%;max-height:200px;border-radius:10px;display:block">
      <button onclick="removeEntryPhoto()" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.55);border:none;color:#fff;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:13px;line-height:22px;text-align:center">×</button>
    </div>`;
    toast('📷 Fotka připravena');
  } catch(e) { toast('❌ Nepodařilo se načíst fotku'); }
  input.value = '';
};
// ─────────────────────────────────────────────────────────

window.newEntry=()=>{
  curEntryId=null; entryMood=''; entryDirty=false;
  curEntryPhoto = null;
  const p = document.getElementById('j-photo-preview');
  if (p) p.innerHTML = '';
  document.getElementById('j-title')?.value != null && (document.getElementById('j-title').value='');
  document.getElementById('j-text')?.value != null && (document.getElementById('j-text').value='');
  const jdate = document.getElementById('j-date');
  if(jdate) jdate.textContent=new Date().toLocaleDateString('cs-CZ',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  document.querySelectorAll('.j-mood-btn').forEach(b=>b.classList.remove('sel'));
  document.getElementById('j-empty')?.style && (document.getElementById('j-empty').style.display='none');
  document.getElementById('j-edit-area')?.style && (document.getElementById('j-edit-area').style.display='flex');
  renderEntryList();
  setTimeout(()=>document.getElementById('j-title')?.focus(),100);
};

window.openEntry=(id)=>{
  const e=entries.find(x=>x.id===id);
  if(!e)return;
  curEntryId=id; entryMood=e.mood||''; entryDirty=false;
  const jt=document.getElementById('j-title'); if(jt) jt.value=e.title||'';
  const jx=document.getElementById('j-text'); if(jx) jx.value=e.text||'';
  const jd=document.getElementById('j-date'); if(jd) jd.textContent=e.createdAt?new Date(e.createdAt).toLocaleDateString('cs-CZ',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'Neznámé datum';
  document.querySelectorAll('.j-mood-btn').forEach(b=>b.classList.toggle('sel',b.dataset.m===entryMood));
  // Load photo
  curEntryPhoto = e.photo || null;
  const p = document.getElementById('j-photo-preview');
  if (p) p.innerHTML = curEntryPhoto
    ? `<div style="position:relative;display:inline-block;margin-top:8px">
        <img src="${curEntryPhoto}" style="max-width:100%;max-height:200px;border-radius:10px;display:block">
        <button onclick="removeEntryPhoto()" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.55);border:none;color:#fff;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:13px;line-height:22px;text-align:center">×</button>
      </div>`
    : '';
  document.getElementById('j-empty')?.style && (document.getElementById('j-empty').style.display='none');
  document.getElementById('j-edit-area')?.style && (document.getElementById('j-edit-area').style.display='flex');
  renderEntryList();
};

window.saveEntry=async()=>{
  if(!CU)return;
  const title=document.getElementById('j-title').value.trim()||'Bez názvu';
  const text=document.getElementById('j-text').value;
  const now=new Date().toISOString();
  try{
    if(curEntryId){
      const idx=entries.findIndex(e=>e.id===curEntryId);
      if(idx>=0){
        entries[idx]={...entries[idx],title,text,mood:entryMood,updatedAt:now,photo:curEntryPhoto||null};
        await setDoc(doc(db,'users',CU.uid,'entries',curEntryId),entries[idx]);
      }
    } else {
      const e={title,text,mood:entryMood,createdAt:now,updatedAt:now,photo:curEntryPhoto||null};
      const ref=await addDoc(collection(db,'users',CU.uid,'entries'),e);
      curEntryId=ref.id;
      entries.unshift({...e,id:ref.id});
    }
    entryDirty=false;
    renderEntryList();
    toast('✓ Uloženo');
  }catch(e){toast('❌ Chyba ukládání: '+e.message);}
  // Detekuj jídla, návyky i náladu — postupně s prodlevou (ne najednou)
  if(text && text.length > 20){
    detectFoodsInEntry(text);
    setTimeout(()=>detectHabitsInEntry(text), 800);
    // Automaticky navrhni náladu pokud není vybraná
    if(!entryMood) setTimeout(()=>autoDetectMood(), 1600);
  }
};

window.deleteEntry=async()=>{
  if(!CU||!curEntryId||!confirm('Smazat zápisek?'))return;
  try{
    await deleteDoc(doc(db,'users',CU.uid,'entries',curEntryId));
    entries=entries.filter(e=>e.id!==curEntryId);
    curEntryId=null; entryMood='';
    document.getElementById('j-edit-area').style.display='none';
    document.getElementById('j-empty').style.display='flex';
    renderEntryList();
    toast('Zápisek smazán');
  }catch(e){toast('❌ Chyba mazání: '+e.message);}
};

window.setEntryMood=(m,btn)=>{
  entryMood=entryMood===m?'':m;
  document.querySelectorAll('.j-mood-btn').forEach(b=>b.classList.toggle('sel',b.dataset.m===entryMood));
  markDirty();
};

window.markDirty=()=>{ entryDirty=true; };

// Auto-save every 30s when dirty
setInterval(()=>{ if(entryDirty&&curEntryId)saveEntry(); },30000);

// ── JOURNAL VOICE ──────────────────────────────────────
const jIsMobile=/Android|iPhone|iPad/i.test(navigator.userAgent);
// Na mobilu používáme jednodušší přístup — continuous=false, restart po každé větě
// jMicBase drží vše co bylo řečeno PŘED aktuální session
let jMicBase='';

function startJRec(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  jRec=new SR();
  jRec.lang='cs-CZ';
  jRec.maxAlternatives=1;
  jRec.interimResults=true;
  // Na mobilu continuous=false — každá věta je samostatná session
  // Tím se zabrání duplikaci textu při restartu
  jRec.continuous=false;

  const ta=document.getElementById('j-text');
  // sessionFin drží jen text z AKTUÁLNÍ session (od posledního startu)
  let sessionFin='';

  jRec.onresult=e=>{
    let interim='';
    // Zpracuj pouze NOVÉ výsledky od e.resultIndex — zabraňuje duplikaci slov
    for(let i=e.resultIndex;i<e.results.length;i++){
      if(e.results[i].isFinal) sessionFin+=e.results[i][0].transcript+' ';
      else interim+=e.results[i][0].transcript;
    }
    // Zobraz: co bylo před + co je v této session + interim
    ta.value=jMicBase+sessionFin+interim;
    markDirty();
  };

  jRec.onstart=()=>{
    jRecOn=true;
    sessionFin=''; // reset pro každou novou session
    const btn=document.getElementById('j-mic-btn');
    if(btn){btn.classList.add('rec');btn.textContent='⏹';}
    const bar=document.getElementById('j-voice-bar');
    if(bar)bar.style.display='flex';
  };

  jRec.onend=()=>{
    // Přidej co bylo řečeno v této session do základny
    if(sessionFin) jMicBase+=sessionFin;
    sessionFin='';
    if(jRecOn){
      // Automaticky restartuj pro další větu
      try{
        setTimeout(()=>{
          if(jRecOn) startJRec(); // nová instance = čistá session
        },150);
      } catch(e){ stopJournalMic(); }
    } else {
      stopJournalMic();
    }
  };

  jRec.onerror=e=>{
    if(e.error==='no-speech'){
      // Tiše restartuj — pauza v řeči je normální
      if(jRecOn) setTimeout(()=>{ if(jRecOn) startJRec(); },150);
      return;
    }
    if(e.error==='not-allowed') toast('❌ Povol mikrofon v nastavení Chrome');
    else if(e.error==='aborted') return; // normální při stopJournalMic
    else toast('❌ Mikrofon: '+e.error);
    stopJournalMic();
  };

  try{ jRec.start(); }
  catch(err){ toast('❌ Nelze spustit mikrofon: '+err.message); }
}

window.toggleJournalMic=()=>{
  if(!('webkitSpeechRecognition'in window||'SpeechRecognition'in window)){
    toast('❌ Hlasový vstup vyžaduje Chrome'); return;
  }
  if(jRecOn){ stopJournalMic(); return; }
  // Ulož aktuální obsah textarey jako základ
  const ta=document.getElementById('j-text');
  jMicBase=ta.value;
  if(jMicBase&&!jMicBase.endsWith(' ')) jMicBase+=' ';
  startJRec();
  toast('🎤 Poslouchám…');
};

window.stopJournalMic=()=>{
  jRecOn=false;
  if(jRec)jRec.stop();
  const btn=document.getElementById('j-mic-btn');
  if(btn){btn.classList.remove('rec');btn.textContent='🎤';}
  const bar=document.getElementById('j-voice-bar');
  if(bar)bar.style.display='none';
};

// ── HABITS ────────────────────────────────────────────
let habitDay=new Date().toISOString().slice(0,10);
let selHabitType='yesno', selHabitEmoji='🏃';
let selFreqType='daily', selFreqTimes=3, selFreqDays=new Set();
let selHabitGroup='morning'; // default group
function loadOpenGroups(){
  try {
    const saved = localStorage.getItem('lp_open_groups');
    if (saved) {
      const {date, groups} = JSON.parse(saved);
      if (date === new Date().toISOString().slice(0,10)) return new Set(groups);
    }
  } catch(e){}
  return new Set(['morning','day','evening']);
}
let openGroups=loadOpenGroups();

function toDS(d){return d.toISOString().slice(0,10);}

let habits=[], habitLogs=[], unsubHabits=null, unsubLogs=null;

function subHabits(){
  if(!CU)return;
  if(unsubHabits)unsubHabits();
  if(unsubLogs)unsubLogs();
  unsubHabits=onSnapshot(query(collection(db,'users',CU.uid,'habits'),orderBy('createdAt','asc')),snap=>{
    habits=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderHabits();
  });
  unsubLogs=onSnapshot(collection(db,'users',CU.uid,'habitLogs'),snap=>{
    habitLogs=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderHabits();
  });
}

function habitDayLabel(){
  const today=toDS(new Date());
  const yesterday=toDS(new Date(Date.now()-86400000));
  const tomorrow=toDS(new Date(Date.now()+86400000));
  if(habitDay===today)return'Dnes';
  if(habitDay===yesterday)return'Včera';
  if(habitDay===tomorrow)return'Zítra';
  return new Date(habitDay+'T12:00:00').toLocaleDateString('cs-CZ',{weekday:'short',day:'numeric',month:'short'});
}

function buildHabitCard(h){
  const logId=h.id+'_'+habitDay;
  const log=habitLogs.find(l=>l.id===logId);
  const done=log&&log.done;
  const failed=log&&log.failed;
  const hState=done?'done':failed?'failed':'empty';
  const val=log?log.value:0;
  const goal=h.goal||1;
  const todayDS=toDS(new Date());

  // Streak
  let streak=0;
  let sd=new Date(habitDay+'T12:00:00');
  for(let i=0;i<365;i++){
    const ds=toDS(sd);
    const l=habitLogs.find(l=>l.id===h.id+'_'+ds);
    if(l&&l.done)streak++; else break;
    sd.setDate(sd.getDate()-1);
  }

  // Weekly completion
  let weeklyStatus='';
  if(h.freq&&h.freq.type==='weekly'){
    const hd=new Date(habitDay+'T12:00:00');
    const dow=(hd.getDay()+6)%7;
    const weekStart=new Date(hd); weekStart.setDate(hd.getDate()-dow);
    let weekDone=0;
    for(let i=0;i<7;i++){
      const d=new Date(weekStart); d.setDate(weekStart.getDate()+i);
      const l=habitLogs.find(l=>l.id===h.id+'_'+toDS(d));
      if(l&&l.done)weekDone++;
    }
    weeklyStatus=`${weekDone}/${h.freq.times||3}× tento týden`;
  }

  const freq=(typeof h.freq==='object'&&h.freq)?h.freq:{type:'daily'};
  const freqLabel=freq.type==='daily'?'každý den'
    :freq.type==='weekly'?`${freq.times||3}× týdně`
    :freq.type==='days'?(freq.days||[]).map(d=>['Ne','Po','Út','St','Čt','Pá','So'][d]).join(', ')
    :'každý den';

  // Streak badge s milníky
  let streakBadge = '';
  if(streak >= 30) {
    streakBadge = `<span class="streak-badge s-month">👑 ${streak} dní!</span>`;
  } else if(streak >= 14) {
    streakBadge = `<span class="streak-badge s-two-week">🏆 ${streak} dní</span>`;
  } else if(streak >= 7) {
    streakBadge = `<span class="streak-badge s-week">🔥 ${streak} dní</span>`;
  } else if(streak >= 3) {
    streakBadge = `<span class="streak-badge s-normal">🔥 ${streak} dní</span>`;
  } else if(streak > 0) {
    streakBadge = `<span class="habit-streak-fire">🔥</span> ${streak} ${streak===1?'den':'dny'}`;
  }
  const streakHtml=(streak>0
    ? streakBadge
    :(weeklyStatus||'<span style="color:var(--text3);font-size:11px">Začni dnes!</span>'))
    +`<span class="habit-freq-badge">${freqLabel}</span>`;

  // 7-day table
  const DAY_NAMES=['Ne','Po','Út','St','Čt','Pá','So'];
  let thHtml='', tdHtml='';
  for(let i=6;i>=0;i--){
    const d=new Date(habitDay+'T12:00:00');
    d.setDate(d.getDate()-i);
    const ds=toDS(d);
    const dow=d.getDay();
    const l=habitLogs.find(l=>l.id===h.id+'_'+ds);
    let active=true;
    if(freq.type==='days') active=(freq.days||[]).includes(dow);
    const isDone=l&&l.done;
    const isFailed=l&&l.failed;
    const isZero=l&&!l.done&&!l.failed&&l.value===0;
    const isPartial=l&&l.value>0&&!l.done&&!l.failed;
    const isToday=ds===todayDS;
    const isHabitDay=ds===habitDay;
    let cls='htd-dot';
    if(!active) cls+=' inactive';
    else if(isDone) cls+=' done';
    else if(isFailed) cls+=' failed';
    else if(isZero) cls+=' failed';
    else if(isPartial) cls+=' partial';
    else cls+=' miss';
    if(isHabitDay) cls+=' today';

    let inner='';
    if(!active) inner='—';
    else if(isDone) inner=h.type==='count'?`<span style="font-size:10px">${l.value}</span>`:'✓';
    else if(isFailed) inner='✕';
    else if(isZero) inner=`<span style="font-size:10px;color:var(--red)">0</span>`;
    else if(isPartial) inner=`<span style="font-size:10px">${l.value}</span>`;
    else inner='×';

    thHtml+=`<th>${DAY_NAMES[dow]}<br><span style="font-weight:400;color:var(--text3);font-size:9px">${d.getDate()}.${d.getMonth()+1}</span></th>`;
    tdHtml+=`<td><div class="${cls}" onclick="${h.type==='count'?`directInput('${esc(h.id)}','${ds}',${l?l.value:0},${goal})`:`toggleHabitDay('${esc(h.id)}','${ds}')`}" style="cursor:pointer">${inner}</div></td>`;
  }

  let controlHtml='';
  if(h.type==='count'){
    const pct=Math.min(Math.round(val/goal*100),100);
    controlHtml=`
      <div class="habit-counter">
        <button class="cnt-btn" onclick="adjustHabit('${esc(h.id)}','${habitDay}',-1,${goal})">−</button>
        <div onclick="directInput('${esc(h.id)}','${habitDay}',${val},${goal})" style="cursor:pointer;text-align:center" title="Klepni pro přímé zadání">
          <div class="cnt-val cnt-clickable">${val}</div>
          <div class="cnt-goal">/ ${goal} ✎</div>
        </div>
        <button class="cnt-btn" onclick="adjustHabit('${esc(h.id)}','${habitDay}',1,${goal})">+</button>
      </div>
      <div class="habit-progress" style="margin-top:8px">
        <div class="habit-prog-bar"><div class="habit-prog-fill" style="width:${pct}%"></div></div>
        <div class="habit-prog-pct">${val} / ${goal} (${pct}%)</div>
      </div>`;
  } else {
    controlHtml=`<div class="habit-check ${hState==='done'?'done':hState==='failed'?'failed':''}" onclick="toggleHabit('${esc(h.id)}','${habitDay}','${hState}')"> ${hState==='done'?'✓':hState==='failed'?'✕':''}</div>`;
  }

  const cardDone = h.type==='count' ? (val>=goal) : done;
  const hasZeroLog = log && !log.done && !log.failed && log.value===0;
  const badgeHtml = h.type==='count'
    ? `<span class="habit-done-badge" style="${hasZeroLog?'color:var(--red)':''}">${val} / ${goal}${cardDone?' ✓':hasZeroLog?' ✕':''}</span>`
    : `<span class="habit-done-badge" style="${failed?'color:var(--red)':''}">${ done?'✓ Splněno':failed?'✕ Nesplněno':'Nesplněno'}</span>`;

  return `<div class="habit-card${cardDone?' done':''}">
    <div class="habit-card-top">
      <div class="habit-emoji" onclick="openHabitDetail('${esc(h.id)}')" style="cursor:pointer" title="Zobrazit historii">${h.emoji||'🎯'}</div>
      <div class="habit-info" onclick="openHabitDetail('${esc(h.id)}')" style="cursor:pointer;flex:1;min-width:0" title="Zobrazit historii">
        <div class="habit-name">${h.name}</div>
        <div class="habit-streak">${streakHtml}${h.reminderTime ? `<span style="margin-left:6px;font-size:11px;color:var(--text3)">🔔 ${h.reminderTime}</span>` : ''}</div>
      </div>
      ${badgeHtml}
      ${h.type==='count'
        ? `<div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
            <button class="cnt-btn" onclick="adjustHabit('${esc(h.id)}','${habitDay}',-1,${goal})">−</button>
            <div onclick="directInput('${esc(h.id)}','${habitDay}',${val},${goal})" style="cursor:pointer;text-align:center" title="Klepni pro přímé zadání">
              <div class="cnt-val cnt-clickable">${val}</div>
              <div style="font-size:9px;color:var(--text3)">/${goal} ✎</div>
            </div>
            <button class="cnt-btn" onclick="adjustHabit('${esc(h.id)}','${habitDay}',1,${goal})">+</button>
          </div>`
        : `<div class="habit-check ${hState==='done'?'done':hState==='failed'?'failed':''}" onclick="toggleHabit('${esc(h.id)}','${habitDay}','${hState}')">${hState==='done'?'✓':hState==='failed'?'✕':''}</div>`
      }
    </div>
    <table class="habit-table" style="margin-top:10px"><thead><tr>${thHtml}</tr></thead><tbody><tr>${tdHtml}</tr></tbody></table>
  </div>`;
}

function renderHabits(){
  const lbl=document.getElementById('habit-day-lbl');
  const list=document.getElementById('habits-list');
  const empty=document.getElementById('habits-empty');
  if(!lbl||!list||!empty)return;
  lbl.textContent=habitDayLabel();

  const activeHabits = habits.filter(h => !h.archived);
  const archivedHabits = habits.filter(h => h.archived);
  const archToggle = document.getElementById('habits-archive-toggle');
  if (archToggle) archToggle.style.display = archivedHabits.length ? 'block' : 'none';
  if(!activeHabits.length && !archivedHabits.length){
    list.innerHTML=''; empty.style.display='flex'; return;
  }
  if(!activeHabits.length){
    list.innerHTML='<div style="color:var(--text3);font-size:14px;padding:20px;text-align:center">Všechny návyky jsou archivovány. 📦</div>';
    empty.style.display='none'; return;
  }
  empty.style.display='none';

  const GROUPS=[
    {id:'morning', emoji:'🌅', label:'Ráno'},
    {id:'day',     emoji:'☀️', label:'Přes den'},
    {id:'evening', emoji:'🌙', label:'Večer'},
  ];

  // Habits without group go to "day" by default
  const getGroup=h=>h.group||'day';

  let html='';
  GROUPS.forEach(g=>{
    const groupHabits=habits.filter(h=>getGroup(h)===g.id && !h.archived);
    if(!groupHabits.length) return;

    // Calculate done count for today
    const doneCount=groupHabits.filter(h=>{
      const log=habitLogs.find(l=>l.id===h.id+'_'+habitDay);
      return log&&log.done;
    }).length;
    const pct=Math.round(doneCount/groupHabits.length*100);
    const pctCls=pct===100?'full':pct>0?'partial':'empty';

    // Is group open? Default: all open
    const isOpen=openGroups.has(g.id);

    html+=`<div class="habit-group" data-group="${g.id}">
      <div class="habit-group-header" onclick="toggleHabitGroup('${esc(g.id)}')">
        <div class="habit-group-left">
          <span class="habit-group-emoji">${g.emoji}</span>
          <span class="habit-group-title">${g.label}</span>
          <span class="habit-group-count">${doneCount}/${groupHabits.length}</span>
        </div>
        <div class="habit-group-progress">
          <span class="habit-group-pct ${pctCls}">${pct}%</span>
          <span class="habit-group-arrow ${isOpen?'open':''}">▼</span>
        </div>
      </div>
      <div class="habit-group-body ${isOpen?'open':''}">
        ${groupHabits.map(h=>buildHabitCard(h)).join('')}
      </div>
    </div>`;
  });

  list.innerHTML=html;
}

// ── HABIT DETAIL ──────────────────────────────────────
let detailHabitId = null;

window.openHabitDetail = (hid) => {
  detailHabitId = hid;
  const h = habits.find(x => x.id === hid);
  if (!h) return;
  const hdTitle = document.getElementById('hd-title');
  if(hdTitle) hdTitle.textContent = h.emoji + ' ' + h.name;
  renderHabitDetail(h);
  // Navigate to detail page
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('p-habit-detail').classList.add('active');
  document.getElementById('abody').scrollTop = 0;
  history.pushState({type:'screen',id:'p-habit-detail'}, '');
};

window.closeHabitDetail = () => {
  sp('habits');
};

function renderHabitDetail(h) {
  const body = document.getElementById('hd-body');
  const today = toDS(new Date());
  const logs = habitLogs.filter(l => l.habitId === h.id && l.done);
  const totalDone = logs.length;

  // Current streak
  let curStreak = 0;
  let sd = new Date(today + 'T12:00:00');
  for (let i = 0; i < 365; i++) {
    const ds = toDS(sd);
    if (habitLogs.some(l => l.id === h.id + '_' + ds && l.done)) curStreak++;
    else break;
    sd.setDate(sd.getDate() - 1);
  }

  // Best streak
  let bestStreak = 0, tmpStreak = 0;
  const allDates = logs.map(l => l.date).sort();
  if (allDates.length) {
    tmpStreak = 1; bestStreak = 1;
    for (let i = 1; i < allDates.length; i++) {
      const prev = new Date(allDates[i-1] + 'T12:00:00');
      const cur = new Date(allDates[i] + 'T12:00:00');
      const diff = Math.round((cur - prev) / 86400000);
      if (diff === 1) { tmpStreak++; if (tmpStreak > bestStreak) bestStreak = tmpStreak; }
      else tmpStreak = 1;
    }
  }

  // % this month
  const nowD = new Date();
  const daysInMonth = new Date(nowD.getFullYear(), nowD.getMonth()+1, 0).getDate();
  const daysSoFar = nowD.getDate();
  const thisMonthKey = today.slice(0,7);
  const doneThisMonth = logs.filter(l => l.date.startsWith(thisMonthKey)).length;
  const pctMonth = daysSoFar > 0 ? Math.round(doneThisMonth / daysSoFar * 100) : 0;

  // Build line chart — last 12 weeks (% per week)
  const weeks = [];
  for (let i = 11; i >= 0; i--) {
    const wEnd = new Date(); wEnd.setDate(wEnd.getDate() - i * 7);
    const wStart = new Date(wEnd); wStart.setDate(wEnd.getDate() - 6);
    let done = 0, total = 0;
    for (let d = new Date(wStart); d <= wEnd; d.setDate(d.getDate()+1)) {
      const ds = toDS(d);
      const freq = (typeof h.freq === 'object' && h.freq) ? h.freq : {type:'daily'};
      let active = true;
      if (freq.type === 'days') active = (freq.days||[]).includes(d.getDay());
      if (active) {
        total++;
        if (habitLogs.some(l => l.id === h.id + '_' + ds && l.done)) done++;
      }
    }
    const pct = total > 0 ? Math.round(done/total*100) : 0;
    const label = wEnd.getDate() + '.' + (wEnd.getMonth()+1);
    weeks.push({pct, label, done, total});
  }
  const maxPct = Math.max(...weeks.map(w => w.pct), 1);

  const chartHtml = `
    <div class="hd-chart-wrap">
      <div class="hd-section-title" style="margin-top:0">📈 Plnění po týdnech</div>
      <div class="hd-streak-bar">
        ${weeks.map(w => `
          <div class="hd-streak-col" title="${w.done}/${w.total} dní (${w.pct}%)">
            <div class="hd-streak-fill" style="height:${Math.max(w.pct/maxPct*70,w.pct>0?4:2)}px;background:${w.pct>=80?'var(--green)':w.pct>=50?'var(--accent)':'var(--accent2)'}"></div>
            <div class="hd-streak-lbl">${w.label}</div>
          </div>`).join('')}
      </div>
    </div>`;

  // Build month history — jen aktuální měsíc s navigací
  const DAY_NAMES_SHORT = ['Po','Út','St','Čt','Pá','So','Ne'];
  // Použij uložený měsíc nebo aktuální
  const hdMonthKey = 'hd_month_' + h.id;
  if(!window._hdMonth) window._hdMonth = {};
  if(!window._hdMonth[h.id]) window._hdMonth[h.id] = {y: nowD.getFullYear(), m: nowD.getMonth()};
  const mYear = window._hdMonth[h.id].y;
  const mMonth = window._hdMonth[h.id].m;
  const mDate = new Date(mYear, mMonth, 1);
  const mKey = mYear + '-' + String(mMonth+1).padStart(2,'0');
  const mLabel = mDate.toLocaleDateString('cs-CZ', {month:'long', year:'numeric'}).toUpperCase();
  const daysInM = new Date(mYear, mMonth+1, 0).getDate();
  const firstDow = (new Date(mYear, mMonth, 1).getDay() + 6) % 7;
  const isCurrentMonth = mYear === nowD.getFullYear() && mMonth === nowD.getMonth();

  let dayNamesRow = DAY_NAMES_SHORT.map(n => `<div class="hd-month-dayname">${n}</div>`).join('');
  let cells = '';
  for (let i = 0; i < firstDow; i++) cells += `<div class="hd-day-cell empty"></div>`;
  for (let day = 1; day <= daysInM; day++) {
    const ds = mKey + '-' + String(day).padStart(2,'0');
    const isDone = habitLogs.some(l => l.id === h.id + '_' + ds && l.done);
    const isToday = ds === today;
    const isFuture = ds > today;
    let cls = 'hd-day-cell';
    if (isFuture) cls += ' empty';
    else if (isDone) cls += ' done';
    else cls += ' miss';
    if (isToday) cls += ' today';
    cells += `<div class="${cls}" title="${ds}">${isDone ? '✓' : (isFuture ? '' : day)}</div>`;
  }

  const monthsHtml = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <button onclick="hdNavMonth('${esc(h.id)}',-1)" style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:5px 12px;color:var(--text);cursor:pointer;font-size:16px">‹</button>
      <div style="font-family:'Playfair Display',serif;font-size:15px;color:var(--accent);font-weight:700">${mLabel}</div>
      <button onclick="hdNavMonth('${esc(h.id)}',1)" ${isCurrentMonth?'disabled style="opacity:.3;cursor:default"':''} style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:5px 12px;color:var(--text);cursor:pointer;font-size:16px">›</button>
    </div>
    <div class="hd-month-grid">
      ${dayNamesRow}
      ${cells}
    </div>`;

  body.innerHTML = `
    <!-- Stats -->
    <div class="hd-stat-grid">
      <div class="hd-stat" style="${curStreak>0&&curStreak===bestStreak?'border-color:var(--accent);background:rgba(245,200,66,.08)':''}">
        <div class="hd-stat-num" style="${curStreak>=30?'color:var(--accent)':curStreak>=7?'color:var(--green)':''}">${curStreak}${curStreak>0&&curStreak===bestStreak&&curStreak>1?'<span style="font-size:12px;color:var(--accent);margin-left:4px">★</span>':''}</div>
        <div class="hd-stat-lbl">🔥 Aktuální série${curStreak>0&&curStreak===bestStreak&&curStreak>1?' <span style="color:var(--accent);font-size:10px">REKORD</span>':''}</div>
      </div>
      <div class="hd-stat">
        <div class="hd-stat-num">${bestStreak}</div>
        <div class="hd-stat-lbl">🏆 Nejlepší série</div>
      </div>
      <div class="hd-stat">
        <div class="hd-stat-num">${totalDone}</div>
        <div class="hd-stat-lbl">✓ Celkem splněno</div>
      </div>
      <div class="hd-stat">
        <div class="hd-stat-num">${pctMonth}%</div>
        <div class="hd-stat-lbl">📆 Tento měsíc</div>
      </div>
      <div class="hd-stat">
        <div class="hd-stat-num">${doneThisMonth}</div>
        <div class="hd-stat-lbl">📅 Splněno tento měsíc</div>
      </div>
      <div class="hd-stat">
        <div class="hd-stat-num">${(() => { const daysSince = Math.max(1, Math.round((new Date() - new Date(h.createdAt || Date.now())) / 86400000)); return Math.min(100, Math.round(totalDone / daysSince * 100)); })()}%</div>
        <div class="hd-stat-lbl">📊 Celkový výkon</div>
      </div>
    </div>

    ${chartHtml}
    <div class="hd-section-title" style="margin-top:20px">📅 Historie po měsících</div>
    <div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:16px;">
      ${monthsHtml}
    </div>
    <div class="hd-section-title" style="margin-top:20px">🔔 Připomínka</div>
    <div class="hd-notif-row" style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;overflow:hidden">
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;color:var(--text2);margin-bottom:8px">Každý den tě upozorním v nastavenou hodinu, pokud návyk ještě nebude splněný.</div>
        <input type="time" id="hd-notif-time" value="${h.reminderTime||''}"
          style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:9px 14px;color:var(--text);font-family:'Crimson Pro',serif;font-size:16px;outline:none;width:100%;box-sizing:border-box;max-width:160px">
      </div>
      <div class="hd-notif-btns" style="display:flex;gap:8px;flex-wrap:wrap">
        ${h.reminderTime ? `<button class="btn-s" onclick="saveHabitReminder('${esc(h.id)}',null)">🔕 Vypnout</button>` : ''}
        <button class="btn-p" onclick="saveHabitReminder('${esc(h.id)}',document.getElementById('hd-notif-time').value)">💾 Uložit</button>
      </div>
    </div>

    <div class="hd-section-title" style="margin-top:20px">⚙️ Správa návyku</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn-s" style="flex:1;min-width:120px" onclick="archiveHabit('${esc(h.id)}')">📦 ${h.archived ? 'Obnovit' : 'Archivovat'}</button>
      <button class="btn-s" style="flex:1;min-width:120px;color:var(--text3);border-color:var(--border)" onclick="showDeleteHabitConfirm('${esc(h.id)}',this)">🗑️ Smazat</button>
    </div>
    <div id="hd-delete-confirm" style="display:none;margin-top:12px;background:rgba(255,59,48,.08);border:1px solid var(--red);border-radius:14px;padding:16px">
      <div style="font-size:14px;color:var(--red);font-weight:600;margin-bottom:8px">⚠️ Opravdu smazat návyk?</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:14px">Smažou se i všechny záznamy a statistiky. Tuto akci nelze vrátit.</div>
      <div style="display:flex;gap:8px">
        <button class="btn-s" style="flex:1" onclick="document.getElementById('hd-delete-confirm').style.display='none'">Zrušit</button>
        <button class="btn-s" style="flex:1;color:var(--red);border-color:var(--red);font-weight:700" onclick="deleteHabit('${esc(h.id)}')">Ano, smazat</button>
      </div>
    </div>
  `;
}

window.saveHabitReminder = async (hid, time) => {
  const h = habits.find(x => x.id === hid);
  if (!h) return;
  if (time === '') time = null; // prázdné pole = vypnout
  if (time && !/^\d{2}:\d{2}$/.test(time)) { toast('⚠️ Zadej platný čas'); return; }
  // Zkontroluj oprávnění
  if (time && Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('❌ Notifikace nejsou povoleny'); return; }
  }
  h.reminderTime = time;
  await updateDoc(doc(db,'users',CU.uid,'habits',hid), { reminderTime: time });
  toast(time ? `🔔 Připomínka nastavena na ${time}` : '🔕 Připomínka vypnuta');
  renderHabitDetail(h); // překresli detail
  renderHabits(); // aktualizuj kartičku
};

window.habitPrevDay=()=>{
  const d=new Date(habitDay+'T12:00:00'); d.setDate(d.getDate()-1);
  habitDay=toDS(d); renderHabits();
};
window.habitNextDay=()=>{
  const d=new Date(habitDay+'T12:00:00'); d.setDate(d.getDate()+1);
  habitDay=toDS(d); renderHabits();
};

window.toggleHabit=async(hid,date,currentState)=>{
  if(!CU)return;
  const logId=hid+'_'+date;
  if(currentState==='done'){
    const log={id:logId,habitId:hid,date,done:false,failed:true,value:0};
    await setDoc(doc(db,'users',CU.uid,'habitLogs',logId),log);
    const ex=habitLogs.find(l=>l.id===logId);
    if(ex)Object.assign(ex,log); else habitLogs.push(log);
  } else if(currentState==='failed'){
    await deleteDoc(doc(db,'users',CU.uid,'habitLogs',logId));
    habitLogs=habitLogs.filter(l=>l.id!==logId);
  } else {
    const log={id:logId,habitId:hid,date,done:true,failed:false,value:1};
    await setDoc(doc(db,'users',CU.uid,'habitLogs',logId),log);
    const ex=habitLogs.find(l=>l.id===logId);
    if(ex)Object.assign(ex,log); else habitLogs.push(log);
    checkAvatarReactions(hid, date, true);
  }
  renderHabits();
  rAvPage();
};

window.adjustHabit=async(hid,date,delta,goal)=>{
  if(!CU)return;
  const logId=hid+'_'+date;
  const ex=habitLogs.find(l=>l.id===logId);
  const cur=ex?ex.value:0;
  const newVal=Math.max(0,cur+delta);
  if(newVal===0){
    await deleteDoc(doc(db,'users',CU.uid,'habitLogs',logId));
    habitLogs=habitLogs.filter(l=>l.id!==logId);
  } else {
    const log={id:logId,habitId:hid,date,done:newVal>=goal,value:newVal};
    await setDoc(doc(db,'users',CU.uid,'habitLogs',logId),log);
    if(ex)Object.assign(ex,log); else habitLogs.push(log);
  }
  renderHabits();
  // Reakce avatara pokud byl právě splněn cíl (done přešlo na true)
  if(delta>0 && newVal>=goal && (cur<goal)) checkAvatarReactions(hid, date, true);
};

window.toggleAddHabit=()=>{
  const wrap=document.getElementById('add-habit-wrap');
  const btn=document.getElementById('add-habit-toggle');
  const showing=wrap.style.display!=='none';
  wrap.style.display=showing?'none':'block';
  btn.textContent=showing?'+ Přidat návyk':'✕ Zrušit';
  if(!showing){
    // Auto-select group based on current time
    const h=new Date().getHours();
    const autoGroup=h<11?'morning':h<17?'day':'evening';
    setHabitGroup(autoGroup, document.getElementById('hgroup-'+autoGroup));
    setTimeout(()=>document.getElementById('habit-name-inp').focus(),100);
  }
};

window.setHabitGroup=(group,btn)=>{
  selHabitGroup=group;
  document.querySelectorAll('#habit-group-row .ev-type-btn').forEach(b=>b.classList.remove('sel'));
  if(btn) btn.classList.add('sel');
};

window.toggleHabitGroup=(groupId)=>{
  if(openGroups.has(groupId)) openGroups.delete(groupId);
  else openGroups.add(groupId);
  localStorage.setItem('lp_open_groups', JSON.stringify({
    date: new Date().toISOString().slice(0,10),
    groups: [...openGroups]
  }));
  renderHabits();
};

window.toggleHabitDay=async(hid,date)=>{
  if(!CU)return;
  const logId=hid+'_'+date;
  const existing=habitLogs.find(l=>l.id===logId);
  const curState=existing?(existing.done?'done':'failed'):'empty';
  if(curState==='done'){
    const log={id:logId,habitId:hid,date,done:false,failed:true,value:0};
    await setDoc(doc(db,'users',CU.uid,'habitLogs',logId),log);
    if(existing)Object.assign(existing,log); else habitLogs.push(log);
  } else if(curState==='failed'){
    await deleteDoc(doc(db,'users',CU.uid,'habitLogs',logId));
    habitLogs=habitLogs.filter(l=>l.id!==logId);
  } else {
    const log={id:logId,habitId:hid,date,done:true,failed:false,value:1};
    await setDoc(doc(db,'users',CU.uid,'habitLogs',logId),log);
    const ex=habitLogs.find(l=>l.id===logId);
    if(ex)Object.assign(ex,log); else habitLogs.push(log);
  }
  renderHabits();
};

window.setHabitType=(type,btn)=>{
  selHabitType=type;
  document.querySelectorAll('.habit-type-row .ev-type-btn').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
  document.getElementById('habit-goal-wrap').style.display=type==='count'?'block':'none';
};

window.setHabitEmoji=(e,btn)=>{
  selHabitEmoji=e;
  document.querySelectorAll('.emoji-pick-btn').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
};

window.setFreqType=(type,btn)=>{
  selFreqType=type;
  document.querySelectorAll('.freq-type-row .ev-type-btn').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
  document.getElementById('freq-weekly-wrap').style.display=type==='weekly'?'block':'none';
  document.getElementById('freq-days-wrap').style.display=type==='days'?'block':'none';
};
window.setFreqTimes=(n,btn)=>{
  selFreqTimes=n;
  document.querySelectorAll('.freq-num-btn').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
};
window.toggleFreqDay=(d,btn)=>{
  if(selFreqDays.has(d))selFreqDays.delete(d);
  else selFreqDays.add(d);
  btn.classList.toggle('sel',selFreqDays.has(d));
};

window.saveHabit=async()=>{
  const name=document.getElementById('habit-name-inp').value.trim();
  if(!name){toast('⚠️ Zadej název návyku');return;}
  if(selFreqType==='days'&&selFreqDays.size===0){toast('⚠️ Vyber alespoň jeden den');return;}
  const goal=selHabitType==='count'?parseInt(document.getElementById('habit-goal-inp').value)||10:1;
  const freq={type:selFreqType};
  if(selFreqType==='weekly')freq.times=selFreqTimes;
  if(selFreqType==='days')freq.days=[...selFreqDays];
  const reminderTime = document.getElementById('habit-notif-time').value || null;
  const h={name,emoji:selHabitEmoji,type:selHabitType,goal,freq,group:selHabitGroup,reminderTime,createdAt:new Date().toISOString()};
  await addDoc(collection(db,'users',CU.uid,'habits'),h);
  const hni=document.getElementById('habit-name-inp'); if(hni) hni.value='';
  const hgi=document.getElementById('habit-goal-inp'); if(hgi) hgi.value='10';
  const hnt=document.getElementById('habit-notif-time'); if(hnt) hnt.value='';
  // Reset frequency UI
  selFreqType='daily'; selFreqTimes=3; selFreqDays=new Set();
  document.querySelectorAll('.freq-type-row .ev-type-btn').forEach((b,i)=>b.classList.toggle('sel',i===0));
  document.getElementById('freq-weekly-wrap').style.display='none';
  document.getElementById('freq-days-wrap').style.display='none';
  document.querySelectorAll('.freq-day-btn').forEach(b=>b.classList.remove('sel'));
  // Zavři formulář BEZ auto-resetu skupiny (toggleAddHabit by přepsal selHabitGroup)
  const wrap=document.getElementById('add-habit-wrap');
  const btn=document.getElementById('add-habit-toggle');
  wrap.style.display='none';
  btn.textContent='+ Přidat návyk';
  toast('✓ Návyk přidán!');
};

window.directInput=async(hid,date,curVal,goal)=>{
  // Inline modal místo prompt() — funguje na všech zařízeních
  const existing = document.getElementById('direct-input-modal');
  if(existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'direct-input-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto';
  modal.innerHTML = `
    <div style="background:#1a1a20;border:1px solid #f5c842;border-radius:16px;padding:24px;width:100%;max-width:320px;text-align:center">
      <div style="font-family:'Playfair Display',serif;font-size:18px;color:#f5c842;margin-bottom:6px">Zadat počet</div>
      <div style="font-size:14px;color:#a0a0b0;margin-bottom:16px">Cíl: ${goal}</div>
      <input id="di-inp" type="number" min="0" max="9999" value="${curVal||0}"
        style="width:100%;background:#222228;border:2px solid #f5c842;border-radius:10px;padding:12px;color:#fff;font-family:'Playfair Display',serif;font-size:28px;text-align:center;outline:none;margin-bottom:16px">
      <div style="display:flex;gap:10px;margin-bottom:8px">
        <button onclick="document.getElementById('direct-input-modal').remove()"
          style="flex:1;background:none;border:1px solid #2a2a35;border-radius:10px;padding:11px;color:#a0a0b0;font-family:'Crimson Pro',serif;font-size:16px;cursor:pointer">Zrušit</button>
        <button id="di-ok"
          style="flex:1;background:#f5c842;border:none;border-radius:10px;padding:11px;color:#1a1a1a;font-family:'Crimson Pro',serif;font-size:16px;font-weight:700;cursor:pointer">Uložit</button>
      </div>
      ${curVal!==null&&curVal!==undefined?`<button id="di-clear" style="width:100%;background:none;border:none;color:#6a6a88;font-family:'Crimson Pro',serif;font-size:13px;cursor:pointer;padding:4px">✕ Vymazat záznam</button>`:''}
    </div>`;
  document.body.appendChild(modal);

  const inp = document.getElementById('di-inp');
  inp.focus(); inp.select();

  const logId = hid+'_'+date;

  const save = async () => {
    const newVal = parseInt(inp.value);
    modal.remove();
    if(isNaN(newVal)||newVal<0){toast('⚠️ Zadej platné číslo');return;}
    const log={id:logId,habitId:hid,date,done:newVal>=goal,value:newVal};
    await setDoc(doc(db,'users',CU.uid,'habitLogs',logId),log);
    const ex=habitLogs.find(l=>l.id===logId);
    if(ex)Object.assign(ex,log); else habitLogs.push(log);
    renderHabits();
    toast(newVal===0?'✓ Zaznamenáno: 0':`✓ Zaznamenáno: ${newVal}`);
  };

  const clear = async () => {
    modal.remove();
    await deleteDoc(doc(db,'users',CU.uid,'habitLogs',logId));
    habitLogs=habitLogs.filter(l=>l.id!==logId);
    renderHabits();
    toast('✕ Záznam smazán');
  };

  document.getElementById('di-ok').onclick = save;
  document.getElementById('di-clear')?.addEventListener('click', clear);
  inp.addEventListener('keydown', e => { if(e.key==='Enter') save(); if(e.key==='Escape') modal.remove(); });
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
};

window.showDeleteHabitConfirm=(id,btn)=>{
  const box=document.getElementById('hd-delete-confirm');
  if(box) box.style.display='block';
  if(btn) btn.style.display='none';
};

window.deleteHabit=async(id)=>{
  if(!CU)return;
  await deleteDoc(doc(db,'users',CU.uid,'habits',id));
  habits=habits.filter(h=>h.id!==id);
  const logsToDelete=habitLogs.filter(l=>l.habitId===id);
  for(const l of logsToDelete) await deleteDoc(doc(db,'users',CU.uid,'habitLogs',l.id));
  habitLogs=habitLogs.filter(l=>l.habitId!==id);
  renderHabits(); toast('Návyk smazán');
  window.closeHabitDetail();
};

let _showArchived = false;

window.archiveHabit = async (id) => {
  if (!CU) return;
  const h = habits.find(h => h.id === id);
  if (!h) return;
  const isArchived = h.archived || false;
  const msg = isArchived ? 'Obnovit tento návyk?' : 'Archivovat tento návyk? Můžeš ho kdykoliv obnovit.';
  if (!confirm(msg)) return;
  await updateDoc(doc(db, 'users', CU.uid, 'habits', id), { archived: !isArchived });
  h.archived = !isArchived;
  toast(isArchived ? '✅ Návyk obnoven' : '📦 Návyk archivován');
  renderHabits();
  if (!isArchived) window.closeHabitDetail();
};

window.toggleArchivedHabits = () => {
  _showArchived = !_showArchived;
  const section = document.getElementById('habits-archived');
  const btn = document.getElementById('arch-toggle-btn');
  if (section) section.style.display = _showArchived ? 'block' : 'none';
  if (btn) btn.textContent = _showArchived ? '📦 Skrýt archiv' : '📦 Zobrazit archiv';
  renderArchivedHabits();
};

function renderArchivedHabits() {
  const list = document.getElementById('habits-archived-list');
  const cnt = document.getElementById('arch-count');
  if (!list) return;
  const archived = habits.filter(h => h.archived);
  if (cnt) cnt.textContent = archived.length;
  if (!archived.length) { list.innerHTML = '<div style="color:var(--text3);font-size:14px;padding:12px">Žádné archivované návyky.</div>'; return; }
  list.innerHTML = archived.map(h => `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;gap:12px;opacity:0.7">
      <span style="font-size:22px">${h.emoji||'📌'}</span>
      <div style="flex:1">
        <div style="font-size:15px;color:var(--text2);text-decoration:line-through">${h.name}</div>
        <div style="font-size:12px;color:var(--text3)">${h.group||'den'} · ${h.freq||'každý den'}</div>
      </div>
      <button onclick="archiveHabit('${esc(h.id)}')" title="Obnovit" style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:6px 12px;font-size:12px;color:var(--text2);cursor:pointer">↩ Obnovit</button>
      <button onclick="deleteHabit('${esc(h.id)}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:15px">🗑️</button>
    </div>`).join('');
}


// ── CALENDAR ─────────────────────────────────────────
let events=[], unsubEvents=null, calYear=new Date().getFullYear(), calMonth=new Date().getMonth();
let selEvType_val='birthday';

const EV_ICONS={birthday:'🎂',event:'📌'};
const EV_LABELS={birthday:'Narozeniny',event:'Událost'};

function subEvents(){
  createFireSub('events',
    collection(db,'users',CU.uid,'events'),
    snap=>{ events=snap.docs.map(d=>({id:d.id,...d.data()})); renderCal(); }
  );
}


function getGcalEventsForDate(_ds){ return []; }

function renderCal(){
  const lbl=document.getElementById('cal-month-lbl');
  if(!lbl)return;
  const d=new Date(calYear,calMonth,1);
  lbl.textContent=d.toLocaleDateString('cs-CZ',{month:'long',year:'numeric'});
  const today=new Date(); today.setHours(0,0,0,0);
  const dim=new Date(calYear,calMonth+1,0).getDate();
  let start=(d.getDay()+6)%7; // Monday=0
  const prev=new Date(calYear,calMonth,0).getDate();
  let html='';
  // Prev month days
  for(let i=start-1;i>=0;i--) html+=`<div class="cal-cell other-month">${prev-i}</div>`;
  // Current month
  for(let day=1;day<=dim;day++){
    const ds=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isToday=today.getFullYear()===calYear&&today.getMonth()===calMonth&&today.getDate()===day;
    const dayEvs=getEventsForDate(ds);
    const hasEv=dayEvs.length>0;
    html+=`<div class="cal-cell ${isToday?'today':''} ${hasEv?'has-event':''}" onclick="calDayClick('${ds}','${day}')">
      ${day}
      ${hasEv?`<span class="cal-cell-dot">${dayEvs[0]?EV_ICONS[dayEvs[0].type]||'•':''}</span>`:''}
    </div>`;
  }
  // Next month
  const total=start+dim; const remaining=(7-total%7)%7;
  for(let i=1;i<=remaining;i++) html+=`<div class="cal-cell other-month">${i}</div>`;
  const cg=document.getElementById('cal-grid'); if(cg) cg.innerHTML=html;
  // Tlačítko migrace osobních událostí do sdíleného kalendáře
  const migrBtn=document.getElementById('cal-migrate-btn');
  if(migrBtn) migrBtn.style.display=(isCalShared()&&events.length>0)?'':'none';
  if(migrBtn) migrBtn.textContent=`📤 Přesunout do sdíleného (${events.length})`;
  renderEvList();
}

function getEventsForDate(ds){
  const match = ev => {
    if(ev.repeat==='yes') return ev.date.slice(5)===ds.slice(5);
    if(ev.dateEnd) return ds>=ev.date && ds<=ev.dateEnd;
    return ev.date===ds;
  };
  return [...events.filter(match), ...familyEvents.filter(match)];
}

function getUpcoming14(){
  const today=new Date(); today.setHours(0,0,0,0);
  const future=new Date(today); future.setDate(future.getDate()+14);
  const result=[];
  [...events, ...familyEvents].forEach(ev=>{
    let evDate=new Date(ev.date+'T12:00:00');
    if(ev.repeat==='yes'){
      const thisYear=new Date(today.getFullYear(),evDate.getMonth(),evDate.getDate());
      const nextYear=new Date(today.getFullYear()+1,evDate.getMonth(),evDate.getDate());
      if(thisYear>=today&&thisYear<=future) result.push({...ev,_date:thisYear});
      else if(nextYear>=today&&nextYear<=future) result.push({...ev,_date:nextYear});
    } else {
      if(evDate>=today&&evDate<=future) result.push({...ev,_date:evDate});
    }
  });
  return result.sort((a,b)=>a._date-b._date);
}


function renderEvList(){
  const allEvents=getUpcoming14();
  const container=document.getElementById('cal-events-list');
  if(!container)return;
  if(!allEvents.length){container.innerHTML='<div style="color:var(--text3);font-size:14px;padding:12px">Žádné události v příštích 14 dnech</div>';return;}
  container.innerHTML=allEvents.map(ev=>`
    <div class="ev-card">
      <div class="ev-icon">${EV_ICONS[ev.type]||'📌'}</div>
      <div class="ev-info">
        <div class="ev-name">${esc(ev.name)}${ev.shared?'<span class="ev-badge" style="background:rgba(245,200,66,.15);color:var(--accent)">👨‍👩‍👧 rodina</span>':''}</div>
        <div class="ev-date">${ev.dateEnd
          ? ev._date.toLocaleDateString('cs-CZ',{day:'numeric',month:'long'})+' – '+new Date(ev.dateEnd+'T12:00:00').toLocaleDateString('cs-CZ',{day:'numeric',month:'long'})
          : ev._date.toLocaleDateString('cs-CZ',{weekday:'long',day:'numeric',month:'long'})}${ev.time?' · '+ev.time:''}${ev.repeat==='yes'?' · každý rok':''}</div>
      </div>
      ${!ev.shared?`<button class="ev-del" onclick="delEvent('${esc(ev.id)}')">🗑️</button>`:''}
    </div>`).join('');
}

window.calPrev=()=>{calMonth--;if(calMonth<0){calMonth=11;calYear--;}renderCal();};
window.calNext=()=>{calMonth++;if(calMonth>11){calMonth=0;calYear++;}renderCal();};

window.migrateCalEvents = async function() {
  if(!isCalShared()||!events.length) return;
  if(!confirm(`Přesunout ${events.length} osobních událostí do sdíleného kalendáře?`)) return;
  let ok=0;
  for(const ev of events) {
    try {
      const {id, ...data} = ev;
      data.addedBy = CU.uid;
      await addDoc(collection(db,'families',familyId,'events'), data);
      await deleteDoc(doc(db,'users',CU.uid,'events',id));
      ok++;
    } catch(e) { console.warn('migrate err', e); }
  }
  toast(`✓ ${ok} událostí přesunuto do sdíleného kalendáře`);
};
window.calDayClick=(ds)=>{
  // Najdi události pro tento den
  const dayEvs = getEventsForDate(ds);
  if(dayEvs.length > 0) {
    // Zobraz modal s přehledem událostí dne
    showDayEventsModal(ds, dayEvs);
  } else {
    // Prázdný den - otevři formulář pro novou událost
    const edi=document.getElementById('ev-date-inp'); if(edi) edi.value=ds;
    const eni=document.getElementById('ev-name-inp'); if(eni) eni.value='';
    const ti=document.getElementById('ev-time-inp'); if(ti) ti.value='';
    const tr=document.getElementById('ev-time-row'); if(tr) tr.style.display='none';
    selEvType_val='birthday';
    document.querySelectorAll('.ev-type-btn').forEach(b=>b.classList.toggle('sel',b.dataset.t==='birthday'));
    document.getElementById('m-event').querySelector('.mtitle').textContent='📅 Nová událost';
    om('m-event');
    setTimeout(()=>document.getElementById('ev-name-inp')?.focus(),100);
  }
};

function showDayEventsModal(ds, dayEvs) {
  // Odstraň starý modal pokud existuje
  document.getElementById('m-day-events')?.remove();
  const date = new Date(ds + 'T12:00:00');
  const dateLabel = date.toLocaleDateString('cs-CZ',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const evHtml = dayEvs.map(ev=>`
    <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--card2);border-radius:10px;margin-bottom:8px">
      <div style="font-size:22px">${EV_ICONS[ev.type]||'📌'}</div>
      <div style="flex:1">
        <div style="font-weight:600;color:var(--text1)">${ev.name}</div>
        <div style="font-size:12px;color:var(--text3)">${EV_LABELS[ev.type]||'Událost'}${ev.time?' · ⏰ '+ev.time:''}${ev.repeat==='yes'?' · každý rok':''}</div>
      </div>
      <button onclick="delEvent('${esc(ev.id)}');document.getElementById('m-day-events')?.remove();" style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--text3);padding:4px">🗑️</button>
    </div>`).join('');
  const modal = document.createElement('div');
  modal.className='moverlay open';
  modal.id='m-day-events';
  modal.innerHTML=`<div class="modal">
    <div class="mtitle">📅 ${dateLabel}</div>
    <div style="margin-bottom:16px">${evHtml}</div>
    <div class="macts">
      <button class="btn-s" onclick="document.getElementById('m-day-events').remove()">Zavřít</button>
      <button class="btn-p" onclick="addEventForDay('${ds}')">+ Přidat další</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target === modal) modal.remove(); });
}

window.addEventForDay = (ds) => {
  document.getElementById('m-day-events')?.remove();
  const edi = document.getElementById('ev-date-inp'); if(edi) edi.value = ds;
  const eni = document.getElementById('ev-name-inp'); if(eni) eni.value = '';
  const ti = document.getElementById('ev-time-inp'); if(ti) ti.value = '';
  const tr = document.getElementById('ev-time-row'); if(tr) tr.style.display = 'none';
  selEvType_val = 'birthday';
  document.querySelectorAll('.ev-type-btn').forEach(b => b.classList.toggle('sel', b.dataset.t === 'birthday'));
  document.getElementById('m-event').querySelector('.mtitle').textContent = '📅 Nová událost';
  om('m-event');
  setTimeout(() => document.getElementById('ev-name-inp')?.focus(), 100);
};

window.openEvModal=()=>{
  const eni=document.getElementById('ev-name-inp'); if(eni) eni.value='';
  const edi2=document.getElementById('ev-date-inp'); if(edi2) edi2.value=new Date().toISOString().slice(0,10);
  const ti=document.getElementById('ev-time-inp'); if(ti) ti.value='';
  const tr=document.getElementById('ev-time-row'); if(tr) tr.style.display='none';
  const eed=document.getElementById('ev-end-date-inp'); if(eed) eed.value='';
  const eer=document.getElementById('ev-end-date-row'); if(eer) eer.style.display='none';
  selEvType_val='birthday';
  document.querySelectorAll('.ev-type-btn').forEach(b=>b.classList.toggle('sel',b.dataset.t==='birthday'));
  om('m-event');
};

window.selEvType=(t,btn)=>{
  selEvType_val=t;
  document.querySelectorAll('.ev-type-btn').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
  const tr=document.getElementById('ev-time-row');
  if(tr) tr.style.display=t==='event'?'block':'none';
  const er=document.getElementById('ev-end-date-row');
  if(er) er.style.display=t==='event'?'block':'none';
};

window.saveEvent=async()=>{
  const name=document.getElementById('ev-name-inp').value.trim();
  const date=document.getElementById('ev-date-inp').value;
  const repeat=document.getElementById('ev-repeat-inp').value;
  const time=selEvType_val==='event'?(document.getElementById('ev-time-inp')?.value||null):null;
  const dateEnd=selEvType_val==='event'?(document.getElementById('ev-end-date-inp')?.value||null):null;
  if(!name){toast('⚠️ Zadej název');return;}
  if(!date){toast('⚠️ Vyber datum');return;}
  if(dateEnd&&dateEnd<date){toast('⚠️ Datum konce musí být po začátku');return;}
  const ev={name,date,type:selEvType_val,repeat,createdAt:new Date().toISOString(),addedBy:CU.uid};
  if(time) ev.time=time;
  if(dateEnd) ev.dateEnd=dateEnd;
  if(isCalShared()) {
    await addDoc(collection(db,'families',familyId,'events'),ev);
  } else {
    await addDoc(collection(db,'users',CU.uid,'events'),ev);
  }
  toast('✓ Událost přidána');
  cm('m-event');
};

window.delEvent=async(id)=>{
  if(!CU||!confirm('Smazat událost?'))return;
  // Zkus smazat z rodiny i z osobního — v jednom existuje
  const delPromises = [];
  if(isCalShared()) delPromises.push(deleteDoc(doc(db,'families',familyId,'events',id)).catch(()=>{}));
  delPromises.push(deleteDoc(doc(db,'users',CU.uid,'events',id)).catch(()=>{}));
  await Promise.all(delPromises);
  toast('Smazáno');
};

function om(id){document.getElementById(id).classList.add('open');history.pushState({type:'modal',id},'')}
function cm(id){document.getElementById(id).classList.remove('open');}

// ── Android back button (popstate) ──────────────────────────────────────
window.addEventListener('popstate', () => {
  // 1. Zavři otevřený modal
  const openModal = document.querySelector('.moverlay.open, .modal-wrap.open');
  if(openModal) { cm(openModal.id); return; }
  // 2. Zavři habit detail
  if(document.getElementById('p-habit-detail')?.classList.contains('active')) {
    window.closeHabitDetail(); return;
  }
  // 3. Vrať se na dashboard pokud nejsme na root stránce
  const activePage = document.querySelector('.page.active');
  if(activePage && activePage.id !== 'p-dashboard') {
    sp('dashboard'); return;
  }
  // 4. Nic neotevřeného — nenech browser odejít, pushni nový stav
  history.pushState(null, '');
});

window.resetAndCloseEventModal = () => {
  const nameInp = document.getElementById('ev-name-inp');
  const dateInp = document.getElementById('ev-date-inp');
  const repeatInp = document.getElementById('ev-repeat-inp');
  if(nameInp) nameInp.value = '';
  if(dateInp) dateInp.value = '';
  if(repeatInp) repeatInp.value = 'yes';
  document.querySelectorAll('.ev-type-btn').forEach(b => b.classList.remove('sel'));
  const firstBtn = document.querySelector('.ev-type-btn');
  if(firstBtn) firstBtn.classList.add('sel');
  selEvType_val = 'birthday';
  cm('m-event');
};
document.addEventListener('click',e=>{if(e.target.classList.contains('moverlay'))e.target.classList.remove('open');});

window.doLogin=async()=>{
  const b=document.getElementById('login-btn'),e=document.getElementById('login-err');
  e.classList.remove('show');b.disabled=true;b.innerHTML='<div class="spin"></div> Přihlašuji…';
  try{
    await signInWithPopup(auth,gp);
  } catch(ex){
    b.disabled=false;
    resetLoginBtn();
    if(ex.code!=='auth/popup-closed-by-user'){
      e.textContent='Chyba: '+ex.message;
      e.classList.add('show');
    }
  }
};
function resetLoginBtn(){
  const b=document.getElementById('login-btn');
  if(b) b.innerHTML='<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.5 30.2 0 24 0 14.7 0 6.7 5.5 2.9 13.6l7.8 6C12.4 13.2 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.6 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.9 7.2l7.6 5.9c4.5-4.1 7.2-10.2 7.2-17.1z"/><path fill="#34A853" d="M10.7 28.4A14.5 14.5 0 0 1 9.5 24c0-1.5.3-3 .7-4.4l-7.8-6A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.9 10.6l7.8-6.2z"/><path fill="#FBBC05" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.6-5.9c-2 1.4-4.7 2.2-7.6 2.2-6.2 0-11.5-3.7-13.4-9.2l-7.8 6C6.7 42.5 14.7 48 24 48z"/></svg> Přihlásit se přes Google';
}
window.doLogout=async()=>{if(!confirm('Odhlásit se?'))return;await signOut(auth);};

// ── EMAIL / HESLO PŘIHLÁŠENÍ ──────────────────────────
window.doEmailLogin=async()=>{
  const email=document.getElementById('email-inp').value.trim();
  const pass=document.getElementById('pass-inp').value;
  const e=document.getElementById('login-err');
  const b=document.getElementById('email-login-btn');
  e.classList.remove('show');
  if(!email||!pass){e.textContent='Vyplň email a heslo';e.classList.add('show');return;}
  b.disabled=true;b.textContent='Přihlašuji…';
  try{
    await signInWithEmailAndPassword(auth,email,pass);
  }catch(ex){
    b.disabled=false;b.textContent='Přihlásit se';
    const msgs={'auth/invalid-credential':'Špatný email nebo heslo','auth/user-not-found':'Účet neexistuje','auth/wrong-password':'Špatné heslo','auth/invalid-email':'Neplatný email'};
    e.textContent=msgs[ex.code]||'Chyba: '+ex.message;
    e.classList.add('show');
  }
};

window.doEmailRegister=async()=>{
  const email=document.getElementById('email-inp').value.trim();
  const pass=document.getElementById('pass-inp').value;
  const e=document.getElementById('login-err');
  const b=document.getElementById('email-login-btn');
  e.classList.remove('show');
  if(!email||!pass){e.textContent='Vyplň email a heslo';e.classList.add('show');return;}
  if(pass.length<6){e.textContent='Heslo musí mít alespoň 6 znaků';e.classList.add('show');return;}
  b.disabled=true;b.textContent='Registruji…';
  try{
    await createUserWithEmailAndPassword(auth,email,pass);
    await sendEmailVerification(auth.currentUser);
  }catch(ex){
    b.disabled=false;b.textContent='Registrovat';
    const msgs={'auth/email-already-in-use':'Email je už registrovaný','auth/invalid-email':'Neplatný email','auth/weak-password':'Heslo je příliš slabé'};
    e.textContent=msgs[ex.code]||'Chyba: '+ex.message;
    e.classList.add('show');
  }
};

window.doPasswordReset=async()=>{
  const email=document.getElementById('email-inp').value.trim();
  const e=document.getElementById('login-err');
  if(!email){e.textContent='Zadej email pro reset hesla';e.classList.add('show');return;}
  try{
    await sendPasswordResetEmail(auth,email);
    e.textContent='✅ Email pro reset hesla odeslán!';
    e.style.color='var(--green)';
    e.classList.add('show');
    setTimeout(()=>{e.classList.remove('show');e.style.color='';},4000);
  }catch(ex){
    e.textContent='Chyba: '+ex.message;e.classList.add('show');
  }
};

window.togglePassVis=()=>{
  const inp=document.getElementById('pass-inp');
  const btn=document.getElementById('pass-eye-btn');
  if(!inp)return;
  inp.type=inp.type==='password'?'text':'password';
  if(btn)btn.textContent=inp.type==='password'?'👁️':'🙈';
};

window.toggleLoginMode=(mode)=>{
  const isReg=mode==='register';
  document.getElementById('email-login-btn').textContent=isReg?'Vytvořit účet':'Přihlásit se';
  document.getElementById('email-login-btn').onclick=isReg?window.doEmailRegister:window.doEmailLogin;
  document.getElementById('login-toggle-reg').style.display=isReg?'none':'block';
  document.getElementById('login-toggle-login').style.display=isReg?'block':'none';
  document.getElementById('login-forgot').style.display=isReg?'none':'block';
  const lbl=document.getElementById('auth-mode-lbl');
  if(lbl)lbl.textContent=isReg?'✨ Nový účet':'🔑 Přihlásit se';
  document.getElementById('login-err').classList.remove('show');
};

let selAddr='jmeno';
window.sg=g=>{selG=g;document.getElementById('gm').classList.toggle('sel',g==='m');document.getElementById('gf').classList.toggle('sel',g==='f');v1();};
window.sa=a=>{selAddr=a;document.getElementById('addr-jmeno').classList.toggle('sel',a==='jmeno');document.getElementById('addr-prezdivka').classList.toggle('sel',a==='prezdivka');document.getElementById('prezdivka-wrap').style.display=a==='prezdivka'?'block':'none';v1();};
window.v1=()=>{const nick=document.getElementById('u-nick').value.trim();document.getElementById('btn-s1').disabled=!(nick&&selG);};
window.gS2=()=>{prof.nickname=document.getElementById('u-nick').value.trim();prof.gender=selG;prof.addrMode='jmeno';prof.prezdivka=prof.nickname;rAvGrid('av-grid',false);ss('s-step2');};
function rAvGrid(cid,isC){document.getElementById(cid).innerHTML=AVS.map(a=>`<div class="av-card ${(isC?tmpAv:selAv)===a.id?'sel':''}" onclick="${isC?'sTmpAv':'selAv2'}('${esc(a.id)}')"><div class="av-em">${a.emoji}</div><div class="av-nm">${a.name}</div><div class="av-vb">${a.vibe.replace('\n','<br>')}</div></div>`).join('');}
window.selAv2=id=>{selAv=id;rAvGrid('av-grid',false);document.getElementById('btn-s2').disabled=false;};
window.sTmpAv=id=>{tmpAv=id;rAvGrid('av-change-grid',true);};
window.gS3=()=>{prof.avatarId=selAv;selMods=new Set(AVMODS[selAv]||[]);rMods();ss('s-step3');};
function rMods(){
  const s3t=document.getElementById('s3-title'); if(s3t) s3t.textContent=`Co chceš sledovat, ${prof.nickname}?`;
  const p=AVMODS[prof.avatarId]||[];
  const mp=document.getElementById('mods-primary'); if(mp) mp.innerHTML=MODS.filter(m=>p.includes(m.id)).map(mCard).join('');
  const me=document.getElementById('mods-extra'); if(me) me.innerHTML=MODS.filter(m=>!p.includes(m.id)).map(mCard).join('');
}
function mCard(m){const s=selMods.has(m.id);return`<div class="mod-card ${s?'sel':''}" onclick="togMod('${esc(m.id)}')"><div class="mem">${m.emoji}</div><div><div class="mnm">${m.name}</div><div class="mds">${m.desc}</div></div><div class="mchk">${s?'✓':''}</div></div>`;}
window.togMod=id=>{selMods.has(id)?selMods.delete(id):selMods.add(id);rMods();};
window.togMore=()=>{const el=document.getElementById('extra-mods'),b=document.getElementById('more-tog');el.classList.toggle('open');b.textContent=el.classList.contains('open')?'− Skrýt':'+ Zobrazit další možnosti';};
window.finishOnboard=async()=>{if(selMods.size===0){toast('⚠️ Vyber alespoň jeden modul');return;}selMods.add('rex');selMods.add('checklist');prof.modules=[...selMods];prof.createdAt=new Date().toISOString();await setDoc(doc(db,'users',CU.uid,'profile','main'),prof);initApp();};


function rEmptyStates(){
  const av = AVS.find(a=>a.id===prof.avatarId)||AVS[0];
  const name = prof.prezdivka||prof.nickname||'';
  const greet = name ? `Ahoj ${name}! ` : 'Ahoj! ';
  // Journal empty
  const je_av=document.getElementById('je-av'); if(je_av)je_av.textContent=av.emoji;
  const je_t=document.getElementById('je-title'); if(je_t)je_t.textContent=greet+'Co se dnes děje?';
  // Habits empty
  const he_av=document.getElementById('he-av'); if(he_av)he_av.textContent=av.emoji;
  const he_t=document.getElementById('he-title'); if(he_t)he_t.textContent='Ještě žádné návyky';
}

function getRexEnergy() {
  const today = new Date().toISOString().slice(0,10);
  let score = 0;
  let hasAnyActivity = false;

  // Návyky — 40 bodů max
  const active = habits.filter(h => !h.archived);
  if (active.length) {
    const done = active.filter(h => habitLogs.some(l => l.id === h.id+'_'+today && l.done)).length;
    score += Math.round((done / active.length) * 40);
    if (done > 0) hasAnyActivity = true;
  }

  // Zápisník — 20 bodů (má dnes záznam?)
  const hasJournal = entries.some(e => e.createdAt?.startsWith(today));
  if (hasJournal) { score += 20; hasAnyActivity = true; }

  // Checklist — 20 bodů (splnil dnes aspoň 1 položku?)
  const allItems = checklists.flatMap(c => c.items || []);
  const hasDoneItem = allItems.some(i => i.done);
  if (hasDoneItem) { score += 20; hasAnyActivity = true; }

  // Nálada — 10 bodů (pozitivní = 10, neutrální = 5, negativní = 0)
  const moodData = lsGet('lp_daily_mood', null);
  if (moodData?.date === today) {
    hasAnyActivity = true;
    if (['😄','🙂'].includes(moodData.emoji)) score += 10;
    else if (moodData.emoji === '😐') score += 5;
  }

  // Základní aktivita — 10 bodů (jen za to že appku otevřel)
  score += 10; hasAnyActivity = true;

  if (!hasAnyActivity && !active.length) return null;
  return Math.min(100, score);
}

function getRexState(energy) {
  if (energy === null) return {emoji:'💤', label:'Čeká na tebe', color:'#888', msg:'Začni svůj den — já ožiju s tebou!'};
  if (energy === 0)    return {emoji:'😴', label:'Spí', color:'#888', msg:'Ještě žádná aktivita dnes...'};
  if (energy <= 25)   return {emoji:'😪', label:'Unavený', color:'#e8a87c', msg:'Pojď, trochu mě probudi!'};
  if (energy <= 50)   return {emoji:'😕', label:'Trochu líný', color:'#f4c430', msg:'Jsi na půli cesty!'};
  if (energy <= 75)   return {emoji:'😊', label:'Spokojený', color:'#4cd964', msg:'Skvělá práce, pokračuj!'};
  if (energy <= 90)   return {emoji:'💪', label:'Nabitý', color:'#5ac8fa', msg:'Málem na vrcholu!'};
  return {emoji:'🔥', label:'V zóně!', color:'#ff9500', msg:'Jsem na 100%! Jsi borec!'};
}

// ── CHAT MEMORY (Firestore persistence + AI summary) ──────────────────────
async function loadChatHistory() {
  if(!CU) return;
  try {
    const snap = await getDoc(doc(db,'users',CU.uid,'chatMemory','main'));
    if(snap.exists()){
      const data = snap.data();
      chatMemorySummary = data.summary || '';
      chatH = data.recentMessages || [];
      // Renderuj historii do chatu
      const c = document.getElementById('chatmsgs');
      if(c && chatH.length > 0){
        document.getElementById('cwelcome')?.remove();
        chatH.forEach(m => {
          if(m.role==='user') appendMsg('user', m.content);
          else if(m.role==='assistant'){
            const av=AVS.find(a=>a.id===prof.avatarId)||AVS[0];
            appendMsg('bot', m.content, av.name, av.emoji);
          }
        });
        scrollChat();
      }
    }
  } catch(e){ console.warn('loadChatHistory:', e); }
}

async function saveChatMessage(role, content) {
  if(!CU) return;
  // Přidej zprávu do history
  const msg = {role, content, ts: Date.now()};
  chatH.push({role, content});

  // Každých 20 zpráv vygeneruj nový summary
  if(chatH.length > 0 && chatH.length % 20 === 0){
    generateChatSummary();
  }

  // Ulož do Firestore: summary + posledních 30 zpráv
  try {
    await setDoc(doc(db,'users',CU.uid,'chatMemory','main'), {
      summary: chatMemorySummary,
      recentMessages: chatH.slice(-30),
      updatedAt: Date.now()
    });
  } catch(e){ console.warn('saveChatMessage:', e); }
}

async function generateChatSummary() {
  if(chatH.length < 10) return;
  try {
    const toSummarize = chatH.slice(0, -10); // vše kromě posledních 10
    const prev = chatMemorySummary ? `Předchozí souhrn: ${chatMemorySummary}\n\n` : '';
    const conversation = toSummarize.map(m=>`${m.role==='user'?'Uživatel':'Asistent'}: ${m.content}`).join('\n');
    const summary = await callClaude([
      {role:'system', content:'Jsi archivář konverzací. Vytvoř stručný souhrn (max 300 slov) klíčových informací o uživateli z této konverzace — jeho zájmy, cíle, problémy, důležité události, preference. Piš česky, ve třetí osobě ("Uživatel pracuje jako...", "Uživatel chce..."). Zahrň i předchozí souhrn pokud existuje.'},
      {role:'user', content:`${prev}Konverzace:\n${conversation}`}
    ], 400);
    if(summary){
      chatMemorySummary = summary;
      await setDoc(doc(db,'users',CU.uid,'chatMemory','main'), {
        summary: chatMemorySummary,
        recentMessages: chatH.slice(-30),
        updatedAt: Date.now()
      });
    }
  } catch(e){ console.warn('generateChatSummary:', e); }
}

function rAvPage(){
  rEmptyStates();
  const av=AVS.find(a=>a.id===prof.avatarId)||AVS[0];
  const msgs=AVMSGS[av.id]||['Vítej!'];
  const msg=msgs[new Date().getDate()%msgs.length];
  const el_em=document.getElementById('av-em');
  const el_nm=document.getElementById('av-nm');
  const el_msg=document.getElementById('av-msg');
  const el_cwem=document.getElementById('cwem');
  const el_cwtitle=document.getElementById('cwtitle');
  const el_moods=document.getElementById('av-moods');
  if(el_em)el_em.textContent=av.emoji;
  if(el_nm)el_nm.textContent=av.name;
  if(el_msg)el_msg.textContent=msg;
  // av-msg already updated above
  if(el_cwem)el_cwem.textContent=av.emoji;
  if(el_cwtitle)el_cwtitle.textContent=`${av.name} — čím ti mohu pomoci?`;
  if(el_moods)el_moods.innerHTML=MOODS.map(m=>`<div class="av-mood-btn ${mood===m.emoji?'active':''}" onclick="selMood('${esc(m.emoji)}')"><span>${m.emoji}</span><div class="av-mood-lbl">${m.label}</div></div>`).join('');
  // Rex Tamagotchi energy
  const energy = getRexEnergy();
  const rexState = getRexState(energy);
  const elEnergy = document.getElementById('av-energy');
  if (elEnergy) {
    const pct = energy ?? 0;
    elEnergy.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin:10px 0 4px">
        <span style="font-size:22px">${rexState.emoji}</span>
        <div style="flex:1">
          <div style="font-size:12px;color:var(--text3);margin-bottom:4px">Energie · <span style="color:${rexState.color};font-weight:700">${rexState.label}</span></div>
          <div style="background:var(--border);border-radius:20px;height:8px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${rexState.color};border-radius:20px;transition:width .5s"></div>
          </div>
        </div>
        <span style="font-size:13px;font-weight:700;color:${rexState.color}">${energy !== null ? pct+'%' : ''}</span>
      </div>
      <div style="font-size:13px;color:var(--text3);font-style:italic;text-align:center;margin-bottom:6px">"${rexState.msg}"</div>
    `;
  }
}

// ── ZDRAVÍ MODUL ──────────────────────────────────────
let healthDay = new Date().toISOString().slice(0,10);
let healthLog = {}; // {mood, sleepH, sleepQ, energy, stress, water, note}
let unsubHealthLogs = null;
let healthLogs = {}; // {date: log}
let sleepQual = 0;

window.healthPrevDay = () => {
  const d = new Date(healthDay+'T12:00:00');
  d.setDate(d.getDate()-1);
  healthDay = d.toISOString().slice(0,10);
  loadHealthDay();
};
window.healthNextDay = () => {
  const d = new Date(healthDay+'T12:00:00');
  d.setDate(d.getDate()+1);
  healthDay = d.toISOString().slice(0,10);
  loadHealthDay();
};

function updateHealthDayLabel() {
  const lbl = document.getElementById('health-day-lbl');
  if (!lbl) return;
  const today = new Date().toISOString().slice(0,10);
  const d = new Date(healthDay+'T12:00:00');
  const diff = Math.round((new Date(healthDay)-new Date(today))/(86400000));
  lbl.textContent = diff===0?'Dnes':diff===-1?'Včera':diff===1?'Zítra':
    d.toLocaleDateString('cs-CZ',{weekday:'short',day:'numeric',month:'short'});
}

window.setHealthMood = (mood, btn) => {
  document.querySelectorAll('.hm-btn').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
  healthLog.mood = mood;
  saveHealthLog();
};

window.setSleepQual = (q, btn) => {
  sleepQual = q;
  document.querySelectorAll('.hs-qual-btn').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
  healthLog.sleepQ = q;
  saveHealthLog();
};

window.updateSlider = (id, valId, val, suffix) => {
  document.getElementById(valId).textContent = val + suffix;
  if(id==='sleep-hours') healthLog.sleepH = parseFloat(val);
  if(id==='energy-level') healthLog.energy = parseInt(val);
  if(id==='stress-level') healthLog.stress = parseInt(val);
};

window.adjustWater = (delta) => {
  const cur = healthLog.water || 0;
  healthLog.water = Math.max(0, Math.min(12, cur + delta));
  const wc = document.getElementById('water-count'); if(wc) wc.textContent = healthLog.water;
  const wm = document.getElementById('water-ml'); if(wm) wm.textContent = (healthLog.water * 250) + ' ml';
  renderWaterGlasses();
  saveHealthLog();
};

function renderWaterGlasses() {
  const w = healthLog.water || 0;
  const el = document.getElementById('water-glasses');
  if (!el) return;
  el.innerHTML = Array.from({length:8},(_,i)=>
    `<span class="wglass ${i<w?'filled':''}" onclick="adjustWater(${i<w?-1:1})">💧</span>`
  ).join('');
}

window.saveHealthLog = async () => {
  if (!CU) return;
  const note = document.getElementById('health-note')?.value || '';
  healthLog.note = note;
  healthLog.date = healthDay;
  healthLog.updatedAt = new Date().toISOString();
  healthLogs[healthDay] = {...healthLog};
  await setDoc(doc(db,'users',CU.uid,'healthLogs',healthDay), healthLog);
};

// loadHealthLogs - data se načítají přes subHealthLogs() real-time listener

function subHealthLogs() {
  createFireSub('healthLogs',
    collection(db,'users',CU.uid,'healthLogs'),
    snap=>{ healthLogs={}; snap.docs.forEach(d=>{ healthLogs[d.id]=d.data(); }); rDash(); }
  );
}

function loadHealthDay() {
  updateHealthDayLabel();
  const log = healthLogs[healthDay] || {};
  healthLog = {...log, date: healthDay};

  // Nastav UI
  document.querySelectorAll('.hm-btn').forEach(b =>
    b.classList.toggle('sel', b.dataset.mood === log.mood));
  document.querySelectorAll('.hs-qual-btn').forEach(b =>
    b.classList.toggle('sel', parseInt(b.dataset.q) === (log.sleepQ||0)));

  const sh = document.getElementById('sleep-hours');
  if(sh) { sh.value = log.sleepH||7; document.getElementById('sleep-hours-val').textContent=(log.sleepH||7)+' h'; }
  const el = document.getElementById('energy-level');
  if(el) { el.value = log.energy||5; document.getElementById('energy-val').textContent=(log.energy||5)+'/10'; }
  const sl = document.getElementById('stress-level');
  if(sl) { sl.value = log.stress||5; document.getElementById('stress-val').textContent=(log.stress||5)+'/10'; }
  const wc = document.getElementById('water-count');
  if(wc) { wc.textContent = log.water||0; document.getElementById('water-ml').textContent=((log.water||0)*250)+' ml'; }
  const hn = document.getElementById('health-note');
  if(hn) hn.value = log.note||'';
  sleepQual = log.sleepQ||0;

  renderWaterGlasses();
  renderHealthWeek();
}

function renderHealthWeek() {
  const el = document.getElementById('health-week-chart');
  if (!el) return;
  const days = [];
  const today = new Date();
  for(let i=6;i>=0;i--) {
    const d = new Date(today); d.setDate(d.getDate()-i);
    const ds = d.toISOString().slice(0,10);
    days.push({ds, log: healthLogs[ds]||null, label: d.toLocaleDateString('cs-CZ',{weekday:'short'})});
  }
  const maxEnergy = 10;
  el.innerHTML = `
    <div class="health-week-bar">
      ${days.map(day=>`
        <div class="hwb-col">
          <div class="hwb-mood">${day.log?.mood||'·'}</div>
          <div class="hwb-bar" style="height:${day.log?.energy?Math.round(day.log.energy/maxEnergy*50):2}px;background:${day.log?.energy?'var(--green)':'var(--border)'}"></div>
          <div class="hwb-lbl">${day.label}</div>
        </div>`).join('')}
    </div>
    <div style="font-size:11px;color:var(--text3);text-align:center">Energie posledních 7 dní · klik na den pro detail</div>`;
}


// ── THEME TOGGLE ──────────────────────────────────────
let isDark = false;

const THEMES = {
  'dark-gold':  { emoji:'🌑', label:'Tmavé',   bg:'#0c0c10', accent:'#f5c842', tc:'#0c0c10' },
  'sunshine':   { emoji:'☀️', label:'Světlé',  bg:'#faf8f0', accent:'#d4870a', tc:'#faf8f0' },
};

window.setTheme = (id) => {
  if (!THEMES[id]) id = 'sunshine';
  localStorage.setItem('lp_theme', id);
  document.documentElement.setAttribute('data-theme', id);
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.content = THEMES[id].tc;
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = THEMES[id].emoji;
  // Zvýrazni aktivní kartu
  document.querySelectorAll('.theme-card').forEach(c => {
    c.style.outline = c.dataset.t === id ? '3px solid ' + THEMES[id].accent : 'none';
    c.style.transform = c.dataset.t === id ? 'scale(1.03)' : 'scale(1)';
  });
  toast(THEMES[id].emoji + ' ' + THEMES[id].label);
};

window.toggleTheme = () => {
  const cur = localStorage.getItem('lp_theme') || 'sunshine';
  const order = ['sunshine','dark-gold'];
  const next = order[(order.indexOf(cur)+1) % order.length];
  window.setTheme(next);
};

function loadTheme() {
  const saved = localStorage.getItem('lp_theme') || 'sunshine';
  window.setTheme(saved);
}


// ════════════════════════════════════════════════════════════
// 🔔  PUSH NOTIFIKACE SYSTÉM
// ════════════════════════════════════════════════════════════

let notifSettings = {
  morning: '08:00',
  evening: '21:00',
  habits: true,
  morningDigest: true,
  eveningDigest: true,
  birthday: true
};
let notifTimers = [];

// ── FCM token — získej a ulož do Firestore ──
async function registerFcmToken() {
  if (!messaging || !CU) return;
  if (Notification.permission !== 'granted') return;
  try {
    // Odstraň staré SW registrace (např. /LifePocket/sw.js) které by blokovaly nový token
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        if (reg.active?.scriptURL && !reg.active.scriptURL.endsWith('/sw.js')) {
          await reg.unregister();
          console.log('[LP] Odregistrován starý SW:', reg.active.scriptURL);
        }
      }
    }

    const swReg = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg
    });
    if (token && prof) {
      prof.fcmToken = token;
      prof.notifSettings = notifSettings;
      await setDoc(doc(db,'users',CU.uid,'profile','main'), prof);
      console.log('[LP] FCM token uložen:', token.slice(0,20) + '...');
    } else {
      console.warn('[LP] FCM getToken vrátil prázdný token');
    }
  } catch(e) {
    console.warn('[LP] FCM token chyba:', e.message);
  }
}

// ── Inicializace ──
async function initNotifications() {
  loadNotifSettings();
  await checkNotifStatus();
  scheduleAllNotifications();
  await registerFcmToken();
  // Při návratu do appky zkontroluj promeškané notifikace
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      setTimeout(checkMissedNotifications, 1000);
    }
  });
}

function loadNotifSettings() {
  try {
    const saved = localStorage.getItem('lp_notif');
    if (saved) notifSettings = {...notifSettings, ...JSON.parse(saved)};
  } catch(e) { console.warn('loadNotifSettings: chyba při načítání nastavení', e); }
  // Naplň UI
  const m = document.getElementById('notif-morning');
  const ev = document.getElementById('notif-evening');
  if (m) m.value = notifSettings.morning;
  if (ev) ev.value = notifSettings.evening;
  const ids = ['nt-habits','nt-morning','nt-evening'];
  const keys = ['habits','morningDigest','eveningDigest'];
  ids.forEach((id,i) => {
    const el = document.getElementById(id);
    if (el) el.checked = notifSettings[keys[i]];
  });
}

window.saveNotifSettings = () => {
  const m = document.getElementById('notif-morning');
  const ev = document.getElementById('notif-evening');
  if (m) notifSettings.morning = m.value || '08:00';
  if (ev) notifSettings.evening = ev.value || '21:00';
  notifSettings.habits = document.getElementById('nt-habits')?.checked ?? true;
  notifSettings.morningDigest = document.getElementById('nt-morning')?.checked ?? true;
  notifSettings.eveningDigest = document.getElementById('nt-evening')?.checked ?? true;

  localStorage.setItem('lp_notif', JSON.stringify(notifSettings));
  scheduleAllNotifications();
  // Ulož nastavení i do Firestore pro Cloud Functions
  if (CU && prof) {
    prof.notifSettings = notifSettings;
    setDoc(doc(db,'users',CU.uid,'profile','main'), prof).catch(()=>{});
  }
  toast('✅ Nastavení notifikací uloženo');
};

// ── Stav oprávnění ──
async function checkNotifStatus() {
  const box = document.getElementById('notif-status-box');
  const enableBtn = document.getElementById('notif-enable-btn');
  const testBtn = document.getElementById('notif-test-btn');
  const testServerBtn = document.getElementById('notif-test-server-btn');
  const refreshTokenBtn = document.getElementById('notif-refresh-token-btn');
  if (!box) return;

  if (!('Notification' in window)) {
    box.innerHTML = '❌ Tento prohlížeč nepodporuje notifikace. Zkus Chrome nebo Edge.';
    box.style.borderColor = 'rgba(255,107,107,0.3)';
    return;
  }

  const perm = Notification.permission;
  if (perm === 'granted') {
    box.innerHTML = '✅ Notifikace jsou povoleny a aktivní';
    box.style.borderColor = 'rgba(76,217,100,0.3)';
    box.style.color = 'var(--green)';
    if (enableBtn) enableBtn.style.display = 'none';
    if (testBtn) testBtn.style.display = 'block';
    if (testServerBtn) testServerBtn.style.display = 'block';
    if (refreshTokenBtn) refreshTokenBtn.style.display = 'block';
    // Vždy obnov FCM token při otevření nastavení
    registerFcmToken();
  } else if (perm === 'denied') {
    box.innerHTML = '🚫 Notifikace jsou <b>zakázány</b> v nastavení prohlížeče. Klikni na 🔒 v adresním řádku a povol notifikace.';
    box.style.borderColor = 'rgba(255,107,107,0.3)';
    box.style.color = 'var(--red)';
    if (enableBtn) enableBtn.style.display = 'none';
  } else {
    box.innerHTML = '⚪ Notifikace nejsou povoleny. Klikni na tlačítko níže.';
    if (enableBtn) enableBtn.style.display = 'block';
    if (testBtn) testBtn.style.display = 'none';
  }
}

// ── Povolení notifikací ──
window.enableNotifications = async () => {
  if (!('Notification' in window)) { toast('❌ Prohlížeč nepodporuje notifikace'); return; }
  const perm = await Notification.requestPermission();
  await checkNotifStatus();
  if (perm === 'granted') {
    toast('✅ Notifikace povoleny!');
    scheduleAllNotifications();
    // Hned pošli uvítací notifikaci
    setTimeout(() => sendNotif('✨ LifePocket', 'Notifikace fungují! Budu tě připomínat.', '🎉'), 1000);
  } else {
    toast('❌ Notifikace zamítnuty');
  }
};

// ── Testovací notifikace ──
window.sendTestServerPush = async () => {
  try {
    toast('📡 Odesílám test přes server...');
    await testPushFn();
    toast('✅ Server push odeslán! Zavři appku a zkontroluj notifikaci.');
  } catch(e) {
    const msg = e.message || '';
    if (msg.includes('FCM token')) {
      toast('⚠️ FCM token chybí — klikni "Obnovit token"');
    } else {
      toast('❌ ' + msg);
    }
  }
};

window.refreshFcmToken = async () => {
  const log = (msg) => {
    const box = document.getElementById('fcm-debug-box');
    if (box) box.innerHTML += `<div>${msg}</div>`;
    console.log('[FCM]', msg);
  };

  // Zobraz debug box
  let box = document.getElementById('fcm-debug-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'fcm-debug-box';
    box.style.cssText = 'background:#111;border:1px solid #f5c842;border-radius:10px;padding:12px;margin-top:12px;font-size:12px;color:#ccc;font-family:monospace;line-height:1.8';
    document.getElementById('notif-refresh-token-btn')?.insertAdjacentElement('afterend', box);
  }
  box.innerHTML = '<div style="color:#f5c842;font-weight:bold">🔍 FCM Debug:</div>';
  box.scrollIntoView({behavior:'smooth', block:'center'});

  log('1. messaging: ' + (messaging ? '✅' : '❌ NULL - Firebase messaging se neinicializoval'));
  log('2. CU (přihlášen): ' + (CU ? '✅ ' + CU.uid.slice(0,8) : '❌ NULL'));
  log('3. Notif permission: ' + Notification.permission);
  log('4. SW support: ' + ('serviceWorker' in navigator ? '✅' : '❌'));

  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    log('5. SW registrace: ' + regs.length);
    regs.forEach((r, i) => log(`   SW[${i}]: ${r.active?.scriptURL || r.installing?.scriptURL || 'pending'}`));

    const swReg = await navigator.serviceWorker.ready;
    log('6. SW ready: ✅ ' + swReg.active?.scriptURL);

    log('7. Získávám FCM token...');
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg
    });

    if (token) {
      log('8. Token: ✅ ' + token.slice(0, 30) + '...');
      prof.fcmToken = token;
      await setDoc(doc(db,'users',CU.uid,'profile','main'), prof);
      log('9. Uloženo do Firestore: ✅');
      toast('✅ FCM token uložen!');
    } else {
      log('8. Token: ❌ prázdný');
    }
  } catch(e) {
    log('❌ CHYBA: ' + e.message);
  }
};

window.sendTestNotif = () => {
  const doneToday = habits.filter(h => {
    const logId = `${h.id}_${new Date().toISOString().slice(0,10)}`;
    return habitLogs.some(l => l.id === logId && l.done);
  }).length;
  const total = habits.length;
  sendNotif(
    '🧪 Test — LifePocket',
    `Notifikace fungují! Dnes: ${doneToday}/${total} návyků splněno.`,
    '✅'
  );
  toast('🧪 Testovací notifikace odeslána!');
};

// ── Odeslat notifikaci ──
function renderCustomRemindersList() {
  // Stub - custom reminders UI placeholder
  const el = document.getElementById('custom-reminders-list');
  if (el) el.innerHTML = '';
}
function sendNotif(title, body, icon = '✨', data = {}, actions = []) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const opts = {
      body,
      icon: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${icon}</text></svg>`,
      badge: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✨</text></svg>`,
      tag: data.habitId || data.reminderId || 'lifepocket',
      renotify: true,
      silent: false,
      data
    };
    // Vždy použij SW (povinné na Android/PWA), fallback na new Notification() na desktopu
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        const swOpts = actions.length > 0
          ? {...opts, actions, requireInteraction: true}
          : opts;
        return reg.showNotification(title, swOpts);
      }).catch(() => {
        new Notification(title, opts);
      });
    } else {
      new Notification(title, opts);
    }
  } catch(e) { /* notifikace nepodporována */ }
}

// Uzivatel klikl "Splneno" v notifikaci — zaznamenej navyk
async function handleNotifHabitDone(data) {
  const today = new Date().toISOString().slice(0, 10);
  const date = data.date || today;

  // Splneni navyku
  if (data.habitId) {
    const habit = habits.find(h => h.id === data.habitId);
    if (!habit) return;
    const logId = `${data.habitId}_${date}`;
    const existing = habitLogs.find(l => l.id === logId);
    if (!existing) {
      const log = {id: logId, habitId: data.habitId, date, done: true, value: 1};
      const exLog = habitLogs.find(l => l.id === logId);
      if (exLog) Object.assign(exLog, log); else habitLogs.push(log);
      await setDoc(doc(db,'users',CU.uid,'habitLogs',logId), log);
      renderHabits();
      rDash();
      toast(`✅ ${habit.emoji} ${habit.name} — splněno!`);
    } else {
      toast(`ℹ️ ${habit.emoji} ${habit.name} — už bylo splněno`);
    }
  }

  // Vlastni pripominka — oznac jako splnenou (dnes)
  if (data.reminderId) {
    const reminder = customReminders.find(r => r.id === data.reminderId);
    if (reminder) toast(`✅ ${reminder.emoji} ${reminder.name} — hotovo!`);
  }
}

// ── Plánování notifikací ──
function scheduleAllNotifications() {
  // Zruš staré timery
  notifTimers.forEach(t => clearTimeout(t));
  notifTimers = [];
  if (Notification.permission !== 'granted') return;

  const now = new Date();

  // Ranní notifikace
  if (notifSettings.morningDigest) {
    const morning = notifSettings.morning || '08:00';
    const [mh, mm] = morning.split(':').map(Number);
    if (!isNaN(mh) && !isNaN(mm)) scheduleDaily(mh, mm, sendMorningNotif);
  }

  // Večerní notifikace
  if (notifSettings.eveningDigest) {
    const evening = notifSettings.evening || '21:00';
    const [eh, em] = evening.split(':').map(Number);
    if (!isNaN(eh) && !isNaN(em)) scheduleDaily(eh, em, sendEveningNotif);
  }

  // Návykové připomínky — každou hodinu kontroluj
  if (notifSettings.habits) {
    scheduleHabitReminders();
  }

  // Narozeniny — zkontroluj jednou za den
  // Narozeniny + výročí — vždy zapnuté, každý den v 8:01
  scheduleDaily(8, 1, checkBirthdayNotifs);
  setTimeout(checkBirthdayNotifs, 6000); // i hned při spuštění

  // Události s časem — každou minutu hodinu předem
  const evIv = setInterval(checkEventReminders, 60 * 1000);
  notifTimers.push(evIv);
  setTimeout(checkEventReminders, 5000);
}

function scheduleDaily(hour, minute, callback) {
  // Ulož plánované časy do localStorage — při probuzení appky zkontrolujeme
  const key = `lp_sched_${hour}_${minute}`;
  const existing = lsGet(key, {});
  const today = new Date().toISOString().slice(0,10);
  existing.hour = hour; existing.minute = minute; existing.lastRun = existing.lastRun || '';
  localStorage.setItem(key, JSON.stringify(existing));

  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const ms = target - now;

  const fire = () => {
    const stored = lsGet(key, {});
    const todayStr = new Date().toISOString().slice(0,10);
    if (stored.lastRun === todayStr) return; // už dnes proběhl
    stored.lastRun = todayStr;
    localStorage.setItem(key, JSON.stringify(stored));
    callback();
    // Naplánuj na zítřek
    const daily = setInterval(() => {
      const s2 = lsGet(key, {});
      const t2 = new Date().toISOString().slice(0,10);
      if (s2.lastRun === t2) return;
      s2.lastRun = t2;
      localStorage.setItem(key, JSON.stringify(s2));
      callback();
    }, 24 * 60 * 60 * 1000);
    notifTimers.push(daily);
  };

  const t = setTimeout(fire, ms);
  notifTimers.push(t);
}

// Zkontroluj při návratu do appky jestli jsme promeškali nějaké notifikace
function checkMissedNotifications() {
  if (Notification.permission !== 'granted') return;
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes();

  // Ranní
  if (notifSettings.morningDigest) {
    const [mh, mm] = (notifSettings.morning || '08:00').split(':').map(Number);
    if (!isNaN(mh) && !isNaN(mm)) {
      const key = `lp_sched_${mh}_${mm}`;
      const stored = lsGet(key, {});
      const today = now.toISOString().slice(0,10);
      if (stored.lastRun !== today && (h > mh || (h === mh && m >= mm))) {
        stored.lastRun = today;
        localStorage.setItem(key, JSON.stringify(stored));
        sendMorningNotif();
      }
    }
  }
  // Večerní
  if (notifSettings.eveningDigest) {
    const [eh, em] = (notifSettings.evening || '21:00').split(':').map(Number);
    if (!isNaN(eh) && !isNaN(em)) {
      const key = `lp_sched_${eh}_${em}`;
      const stored = lsGet(key, {});
      const today = now.toISOString().slice(0,10);
      if (stored.lastRun !== today && (h > eh || (h === eh && m >= em))) {
        stored.lastRun = today;
        localStorage.setItem(key, JSON.stringify(stored));
        sendEveningNotif();
      }
    }
  }
  // Návyky — zkontroluj pokud je 10+ hodin a nebyla dnešní připomínka
  if (notifSettings.habits && h >= 10) {
    const lastRemind = localStorage.getItem('lp_last_remind');
    const today = now.toISOString().slice(0,10);
    if (lastRemind !== today) checkAndRemindHabits();
  }
}

function scheduleHabitReminders() {
  // Zkontroluj každou hodinu 8:00–22:00 jestli jsou nesplněné návyky
  const checkInterval = setInterval(() => {
    const h = new Date().getHours();
    if (h >= 8 && h <= 22) checkAndRemindHabits();
  }, 60 * 60 * 1000);
  notifTimers.push(checkInterval);
  // Jedna kontrola hned při spuštění (pokud je správný čas)
  const h = new Date().getHours();
  if (h >= 8 && h <= 22) setTimeout(checkAndRemindHabits, 5000);

  // Každou minutu zkontroluj individuální časy návyků
  const perHabitInterval = setInterval(checkPerHabitReminders, 60 * 1000);
  notifTimers.push(perHabitInterval);
  // Ihned při startu taky zkontroluj
  setTimeout(checkPerHabitReminders, 3000);
}

function checkPerHabitReminders() {
  if (Notification.permission !== 'granted') return;
  const now = new Date();
  const today = now.toISOString().slice(0,10);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const av = AVS.find(a => a.id === prof?.avatarId);

  habits.forEach(h => {
    if (!h.reminderTime) return;
    const [rh, rm] = h.reminderTime.split(':').map(Number);
    if (isNaN(rh) || isNaN(rm)) return;
    const targetMin = rh * 60 + rm;
    // Okno ±2 minuty — nemineme při pomalém intervalovém timeru
    if (Math.abs(nowMin - targetMin) > 2) return;

    // Zkontroluj jestli jsme dnes tuto notifikaci už poslali
    const sentKey = `lp_hrnotif_${h.id}_${today}`;
    if (localStorage.getItem(sentKey)) return; // už odesláno dnes

    // Zkontroluj jestli návyk ještě není splněn
    const isDone = habitLogs.some(l => l.id === `${h.id}_${today}` && l.done);
    if (isDone) return; // už splněno, neotravovat

    // Odešli notifikaci
    localStorage.setItem(sentKey, '1');
    const name = prof?.prezdivka || prof?.nickname || 'příteli';
    sendNotif(
      `${h.emoji} Připomínka: ${h.name}`,
      `${name}, ještě jsi dnes nesplnil${prof?.gender === 'f' ? 'a' : ''} "${h.name}". Teď je správný čas! 💪`,
      av?.emoji || h.emoji
    );
  });
}

// ── Obsah notifikací ──
function sendMorningNotif() {
  const today = new Date().toISOString().slice(0,10);
  const todayEvents = events.filter(ev => {
    if (ev.repeat === 'yes') return ev.date.slice(5) === today.slice(5);
    return ev.date === today;
  });
  const todayDow = new Date().getDay();
  const habitCount = habits.filter(h => {
    const freq = h.freq || {type:'daily'};
    if (freq.type === 'days') return (freq.days||[]).includes(todayDow);
    return true;
  }).length;
  let body = `Čeká tě ${habitCount} návyk${habitCount===1?'':'ů'} na dnes.`;
  if (todayEvents.length > 0) {
    body += ` 📅 ${todayEvents[0].name}${todayEvents.length > 1 ? ` +${todayEvents.length-1}` : ''}`;
  }
  const av = AVS.find(a => a.id === prof?.avatarId);
  sendNotif(`${av?.emoji || '⭐'} Dobré ráno, ${prof?.prezdivka||prof?.nickname || 'příteli'}!`, body, av?.emoji || '🌅');
}

function sendEveningNotif() {
  const today = new Date().toISOString().slice(0,10);
  const done = habits.filter(h => habitLogs.some(l => l.id === `${h.id}_${today}` && l.done)).length;
  const total = habits.length;
  const a = prof?.gender === 'f' ? 'a' : '';
  let body = '';
  if (total === 0) {
    body = 'Přidej si první návyk a začni budovat lepší rutinu!';
  } else if (done === total) {
    body = `🏆 Perfektní den! Splnil${a} jsi všech ${total} návyků!`;
  } else if (done === 0) {
    body = `Dnes jsi nesplnil${a} žádný návyk. Zítra to vyjde! 💪`;
  } else {
    body = `Splnil${a} jsi ${done} z ${total} návyků. ${total - done} zbývají — ještě je čas!`;
  }
  const av = AVS.find(a => a.id === prof?.avatarId);
  sendNotif(`${av?.emoji || '⭐'} Večerní shrnutí`, body, av?.emoji || '🌙');
}

function checkAndRemindHabits() {
  const today = new Date().toISOString().slice(0,10);
  const undone = habits.filter(h => {
    const freq = (typeof h.freq==='object'&&h.freq)?h.freq:{type:'daily'};
    const dow = new Date().getDay();
    // Konkrétní dny — zkontroluj jestli dnes patří
    if (freq.type === 'days') {
      if (!(freq.days||[]).includes(dow)) return false;
    }
    // Týdenní — pokud už má splněno dost dní tento týden, nepřipomínej
    if (freq.type === 'weekly') {
      const hd = new Date(); const weekStart = new Date(hd);
      weekStart.setDate(hd.getDate() - (hd.getDay()+6)%7);
      let weekDone = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart); d.setDate(weekStart.getDate()+i);
        const ds = d.toISOString().slice(0,10);
        if (habitLogs.some(l => l.id===`${h.id}_${ds}`&&l.done)) weekDone++;
      }
      if (weekDone >= (freq.times||3)) return false; // cíl splněn
    }
    return !habitLogs.some(l => l.id === `${h.id}_${today}` && l.done);
  });
  if (undone.length === 0) return;
  const lastRemind = localStorage.getItem('lp_last_remind');
  if (lastRemind === today) return;
  const hour = new Date().getHours();
  if (hour < 10) return;
  localStorage.setItem('lp_last_remind', today);

  // Posli notifikaci pro kazdy nesplneny navyk zvlast (max 3) — kazda ma tlacitko Splneno
  undone.slice(0, 3).forEach((h, i) => {
    setTimeout(() => {
      sendNotif(
        `${h.emoji} ${h.name}`,
        'Dnes ještě nesplněno — klikni Splněno!',
        h.emoji,
        {habitId: h.id},
        [{action: 'done', title: '✅ Splněno'}]
      );
    }, i * 2000); // rozestup 2s aby se neprekryvaly
  });
}

function checkBirthdayNotifs() {
  if (Notification.permission !== 'granted') return;
  if (!Array.isArray(events) || events.length === 0) return;
  const now = new Date();
  const todayMMDD = `${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const in7 = new Date(now); in7.setDate(now.getDate()+7);
  const in7MMDD = `${String(in7.getMonth()+1).padStart(2,'0')}-${String(in7.getDate()).padStart(2,'0')}`;
  const today = now.toISOString().slice(0,10);
  const name = prof?.prezdivka || prof?.nickname || 'příteli';

  events.forEach(ev => {
    if (!ev.date) return;
    const mmdd = ev.date.slice(5); // MM-DD

    if (ev.type === 'birthday') {
      // Ráno V DEN narozenin
      if (mmdd === todayMMDD) {
        const key = `lp_notif_bday_today_${ev.id}_${today}`;
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, '1');
          sendNotif('🎂 Dnes jsou narozeniny!', `${name}, nezapomeň popřát: ${ev.name} 🎉`, '🎂');
        }
      }
      // 7 dní předem — porovnání MM-DD funguje i přes roční hranici
      if (mmdd === in7MMDD) {
        const key = `lp_notif_bday_7d_${ev.id}_${today}`;
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, '1');
          sendNotif('🎂 Za 7 dní narozeniny', `${ev.name} slaví za týden — čas na přání nebo dárek! 🎁`, '🎂');
        }
      }
    }
  });
}

// Notifikace pro události s časem — hodinu předem
function checkEventReminders() {
  if (Notification.permission !== 'granted') return;
  const now = new Date();
  const today = now.toISOString().slice(0,10);
  const name = prof?.prezdivka || prof?.nickname || 'příteli';

  events.forEach(ev => {
    if (ev.type !== 'event' || !ev.time) return;
    const evDate = (ev.repeat === 'yes') ? today.slice(0,5) + ev.date.slice(5) : ev.date;
    if (evDate !== today) return;

    const evTime = new Date(today + 'T' + ev.time + ':00');
    const diffMin = Math.round((evTime - now) / 60000);

    if (diffMin >= 55 && diffMin <= 65) {
      const key = `lp_notif_ev_${ev.id}_${today}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, '1');
        sendNotif(`📌 Za hodinu: ${ev.name}`, `${name}, za hodinu tě čeká: ${ev.name} v ${ev.time}`, '📌');
      }
    }
  });
}


// ════════════════════════════════════════════════════════════
// 🤖  REX VYLEPŠENÍ — týdenní report + proaktivní analýza
// ════════════════════════════════════════════════════════════

// Proaktivní zpráva od Rexe po přihlášení
async function rexProactiveGreeting() {
  const lastGreet = localStorage.getItem('lp_rex_greet');
  const today = new Date().toISOString().slice(0, 10);
  if (lastGreet === today) return; // jednou denně
  localStorage.setItem('lp_rex_greet', today);

  const today_date = new Date();
  const todayStr = today_date.toISOString().slice(0, 10);

  // Sestav kontext
  const doneToday = habits.filter(h =>
    habitLogs.some(l => l.id === `${h.id}_${todayStr}` && l.done)
  ).length;
  const totalH = habits.length;

  // Narozeniny dnes nebo zítra
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tmmw = `${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;
  const todayMMDD = `${String(today_date.getMonth()+1).padStart(2,'0')}-${String(today_date.getDate()).padStart(2,'0')}`;
  const bdayToday = events.filter(e => e.type==='birthday' && e.date.slice(5)===todayMMDD).map(e=>e.name);
  const bdayTmrw = events.filter(e => e.type==='birthday' && e.date.slice(5)===tmmw).map(e=>e.name);

  // Vzory v návycích — posledních 7 dní
  const weekPatterns = analyzeWeekPatterns();

  const sys = `Jsi ${prof?.avatarName || 'Rex'}, AI společník v LifePocket. Max 3 věty, přátelsky.
Ráno pozdravi uživatele a zmíň 1-2 relevantní věci ze seznamu:
- Dnes splněno návyků: ${doneToday}/${totalH}
- Narozeniny DNES: ${bdayToday.join(', ') || 'žádné'}
- Narozeniny ZÍTRA: ${bdayTmrw.join(', ') || 'žádné'}
- Vzory: ${weekPatterns || 'zatím málo dat'}
Buď konkrétní, ne obecný. Nezačínej s "Ahoj".
PRAVIDLO JMÉNO: Oslovuj uživatele PŘESNĚ jako "${prof?.nickname || ''}" — neupravuj, nezdrobňuj, nepřekládej.
PRAVIDLO JAZYK: Piš VÝHRADNĚ česky. Žádná anglická, německá ani jiná cizí slova.`;

  try {
    const msg = await callClaude([{role:'system',content:sys},{role:'user',content:'ranní pozdrav'}], 150);
    if (msg) showRexDashboardMessage(msg);
  } catch(e) { console.warn('[LP] rexProactiveGreeting selhalo:', e.message); }
}

function analyzeWeekPatterns() {
  if (!habits.length) return '';
  const patterns = [];
  const days = ['Ne','Po','Út','St','Čt','Pá','So'];

  habits.forEach(h => {
    const dayStats = [0,0,0,0,0,0,0]; // po-ne splněno za posledních 4 týdnů
    const dayCounts = [0,0,0,0,0,0,0];
    for (let i = 0; i < 28; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0,10);
      const dow = d.getDay();
      dayCounts[dow]++;
      if (habitLogs.some(l => l.id === `${h.id}_${ds}` && l.done)) dayStats[dow]++;
    }
    // Najdi nejslabší den
    let minPct = 1, minDay = -1;
    for (let d = 0; d < 7; d++) {
      if (dayCounts[d] >= 2) {
        const pct = dayStats[d] / dayCounts[d];
        if (pct < minPct) { minPct = pct; minDay = d; }
      }
    }
    if (minDay >= 0 && minPct < 0.4) {
      patterns.push(`${h.emoji} ${h.name}: nejslabší v ${days[minDay]} (${Math.round(minPct*100)}%)`);
    }
  });
  return patterns.slice(0,2).join('; ') || '';
}

function showRexDashboardMessage(msg) {
  // Přidej zprávu do dashboard karty Rexe
  const existing = document.getElementById('rex-dash-msg');
  if (existing) existing.remove();

  const av = AVS.find(a => a.id === prof?.avatarId) || {emoji:'⭐', name:'Rex'};
  const dashCard = document.querySelector('.avbanner');
  if (!dashCard) return;

  const msgEl = document.createElement('div');
  msgEl.id = 'rex-dash-msg';
  msgEl.style.cssText = `margin-top:10px;padding:12px 14px;background:rgba(245,200,66,0.06);border:1px solid rgba(245,200,66,0.15);border-radius:12px;font-size:15px;color:var(--text2);line-height:1.6;font-style:italic;`;
  msgEl.innerHTML = `<span style="color:var(--accent);font-style:normal;font-weight:600">${av.emoji} ${av.name}:</span> ${msg}`;
  dashCard.appendChild(msgEl);
}

// Týdenní report — zavolej z chatu
window.getRexWeeklyReport = async () => {

  appendMsg('user', 'Dej mi týdenní report', '', '');
  saveChatMessage('user','Dej mi týdenní report');
  document.getElementById('typing')?.classList.add('active');
  scrollChat();

  const today = new Date();
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0,10);
    const dayEntries = entries.filter(e => (e.createdAt||'').startsWith(ds));
    const dayHabits = habits.filter(h => habitLogs.some(l => l.id===`${h.id}_${ds}` && l.done));
    week.push({
      date: d.toLocaleDateString('cs-CZ',{weekday:'short',day:'numeric',month:'short'}),
      entries: dayEntries.length,
      mood: dayEntries[0]?.mood || '',
      habits: `${dayHabits.length}/${habits.length}`
    });
  }
  const weekStr = week.map(d => `${d.date}: zápisky=${d.entries} ${d.mood}, návyky=${d.habits}`).join('\n');
  const patterns = analyzeWeekPatterns();

  const av = AVS.find(a => a.id === prof?.avatarId) || {name:'Rex'};
  const sys = `Jsi ${av.name}, AI společník v LifePocket. Mluv česky, přátelsky.
Udělej týdenní report uživatele ${prof?.nickname || ''}. Buď konkrétní, použij emoji, max 8 vět.
Data posledních 7 dní:\n${weekStr}\nVzory v návycích: ${patterns || 'zatím málo dat'}
PRAVIDLO JAZYK: Piš VÝHRADNĚ česky. Každé slovo v receptu — název, ingredience, kroky i tip — musí být česky. ZAKÁZÁNO použít jakékoliv cizí slovo, včetně anglických, japonských, ruských (cyrilice) nebo arabských výrazů. Cizí jídla popiš česky (např. "noky" ne "gnocchi", "smaženice" ne "scrambled eggs").`;

  try {
    const rep = await callClaude([{role:'system',content:sys},{role:'user',content:'Týdenní report'}], 500);
    if (!rep) throw new Error('AI není k dispozici — klíč bude nastaven brzy');
    saveChatMessage('assistant',rep);
    appendMsg('bot', rep, av.name, av.emoji || '⭐');
    localStorage.setItem('lp_weekly_report', JSON.stringify({text: rep, date: new Date().toISOString()}));
    rDash();
  } catch(e) { appendMsg('bot','❌ '+e.message,'Chyba','⚠️'); }
  document.getElementById('typing')?.classList.remove('active');
  scrollChat();
};

// Automaticky generuj týdenní report v neděli (pokud ještě nebyl tento týden)
function checkAutoWeeklyReport() {
  const now = new Date();
  if(now.getDay() !== 0) return; // jen v neděli
  // Zjisti ISO datum v lokálním čase (ne UTC) pro konzistentní porovnání
  const localDateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const stored = lsGet('lp_weekly_report', null);
  if(stored) {
    const reportDate = new Date(stored.date);
    const reportLocalStr = `${reportDate.getFullYear()}-${String(reportDate.getMonth()+1).padStart(2,'0')}-${String(reportDate.getDate()).padStart(2,'0')}`;
    if(reportLocalStr === localDateStr) return; // už byl dnes generován
  }
  // Vygeneruj tiše a ulož
  generateWeeklyReportSilent();
}

async function generateWeeklyReportSilent() {
  const today = new Date();
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0,10);
    const dayEntries = entries.filter(e => (e.createdAt||'').startsWith(ds));
    const dayHabits = habits.filter(h => habitLogs.some(l => l.id===`${h.id}_${ds}` && l.done));
    week.push({
      date: d.toLocaleDateString('cs-CZ',{weekday:'short',day:'numeric',month:'short'}),
      entries: dayEntries.length, mood: dayEntries[0]?.mood || '',
      habits: `${dayHabits.length}/${habits.length}`
    });
  }
  const weekStr = week.map(d => `${d.date}: zápisky=${d.entries} ${d.mood}, návyky=${d.habits}`).join('\n');
  const av = AVS.find(a => a.id === prof?.avatarId) || {name:'Rex'};
  const sys = `Jsi ${av.name} v LifePocket. Napiš krátký, přátelský týdenní souhrn pro ${prof?.nickname||'uživatele'} (max 5 vět). Buď konkrétní a motivující. Data týdne:\n${weekStr}\nPRAVIDLO: Piš VÝHRADNĚ česky.`;
  try {
    const rep = await callClaude([{role:'system',content:sys},{role:'user',content:'Týdenní souhrn'}], 300);
    if (!rep) return;
    localStorage.setItem('lp_weekly_report', JSON.stringify({text: rep, date: new Date().toISOString(), avatar: av.emoji||'⭐', avatarName: av.name}));
    rDash();
    if(Notification.permission === 'granted') {
      sendNotif(`${av.emoji||'⭐'} Tvůj týdenní report je ready!`, `${av.name} připravil souhrn tohoto týdne — otevři LifePocket a podívej se.`, av.emoji||'⭐');
    }
  } catch(e) { console.warn('[LP] generateWeeklyReportSilent selhalo:', e.message); }
}


// ════════════════════════════════════════════════════════════
// 💧  WATER TRACKER
// ════════════════════════════════════════════════════════════
let waterGoal = 8;
let waterToday = 0;

function initWater() {
  const today = new Date().toDateString();
  const stored = lsGet('lp_water', {date: '', count: 0, goal: 8});
  if (stored.date !== today) {
    waterToday = 0;
    lsSave('lp_water', {date: today, count: 0, goal: stored.goal || 8});
  } else {
    waterToday = stored.count || 0;
    waterGoal = stored.goal || 8;
  }
}

window.addWater = function(n = 1) {
  waterToday = Math.min(waterToday + n, waterGoal * 2);
  const stored = lsGet('lp_water', {date: new Date().toDateString(), count: 0, goal: waterGoal});
  lsSave('lp_water', {...stored, count: waterToday});
  renderWaterInDash();
  if (waterToday >= waterGoal) {
    toast('💧 Skvělé! Denní cíl vody splněn!');
  }
};

window.removeWater = function() {
  waterToday = Math.max(waterToday - 1, 0);
  const stored = lsGet('lp_water', {date: new Date().toDateString(), count: 0, goal: waterGoal});
  lsSave('lp_water', {...stored, count: waterToday});
  renderWaterInDash();
};

function renderWaterInDash() {
  const el = document.getElementById('water-widget');
  if (!el) return;
  const pct = Math.min(waterToday / waterGoal * 100, 100);
  const glasses = [];
  for (let i = 0; i < waterGoal; i++) {
    glasses.push(`<span class="water-glass ${i < waterToday ? 'filled' : ''}" onclick="addWater()">💧</span>`);
  }
  el.innerHTML = `
    <div class="water-header">
      <span class="water-title">💧 Voda</span>
      <span class="water-count">${waterToday}/${waterGoal} sklenic</span>
    </div>
    <div class="water-glasses">${glasses.join('')}</div>
    <div class="water-bar-wrap"><div class="water-bar" style="width:${pct}%"></div></div>
    <div class="water-actions">
      <button class="water-btn-minus" onclick="removeWater()">−</button>
      <button class="water-btn-plus" onclick="addWater()">+ Přidat sklenici</button>
    </div>
  `;
}

function waterWidgetHTML() {
  const pct = Math.min(waterToday / waterGoal * 100, 100);
  const glasses = [];
  for (let i = 0; i < waterGoal; i++) {
    glasses.push(`<span class="water-glass ${i < waterToday ? 'filled' : ''}" onclick="addWater()">💧</span>`);
  }
  return `<div id="water-widget" class="card water-card">
    <div class="water-header">
      <span class="water-title">💧 Voda</span>
      <span class="water-count">${waterToday}/${waterGoal} sklenic</span>
    </div>
    <div class="water-glasses">${glasses.join('')}</div>
    <div class="water-bar-wrap"><div class="water-bar" style="width:${pct}%"></div></div>
    <div class="water-actions">
      <button class="water-btn-minus" onclick="removeWater()">−</button>
      <button class="water-btn-plus" onclick="addWater()">+ Přidat sklenici</button>
    </div>
  </div>`;
}


// ════════════════════════════════════════════════════════════
// 🎯  DAILY FOCUS (MIT)
// ════════════════════════════════════════════════════════════
let dailyFocus = null;

function initFocus() {
  const today = new Date().toDateString();
  const stored = lsGet('lp_focus', {date: '', text: ''});
  if (stored.date === today) {
    dailyFocus = stored.text || null;
  } else {
    dailyFocus = null;
  }
}

window.saveFocus = function(text) {
  const today = new Date().toDateString();
  dailyFocus = text.trim();
  lsSave('lp_focus', {date: today, text: dailyFocus});
  renderFocusInDash();
  document.getElementById('focus-modal')?.remove();
};

window.openFocusModal = function() {
  const existing = dailyFocus || '';
  const m = document.createElement('div');
  m.id = 'focus-modal';
  m.className = 'moverlay open';
  m.innerHTML = `<div class="modal" style="max-width:420px">
    <h3 style="margin:0 0 12px;font-family:'Playfair Display',serif">🎯 Co musíš dnes udělat?</h3>
    <p style="font-size:13px;color:var(--text3);margin:0 0 14px">Jedna nejdůležitější věc na dnešek.</p>
    <input id="focus-inp" type="text" class="finp" placeholder="Napiš svůj denní focus..." value="${esc(existing)}" style="margin-bottom:14px">
    <div style="display:flex;gap:8px">
      <button class="btn-sv" onclick="saveFocus(document.getElementById('focus-inp').value)" style="flex:1">✓ Uložit</button>
      <button class="btn-s" onclick="document.getElementById('focus-modal').remove()">Zrušit</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  document.getElementById('focus-inp').focus();
};

function renderFocusInDash() {
  const el = document.getElementById('focus-widget');
  if (!el) return;
  if (dailyFocus) {
    el.innerHTML = `<div class="focus-content">
      <span class="focus-label">🎯 Dnešní focus</span>
      <div class="focus-text">${esc(dailyFocus)}</div>
      <button class="focus-edit-btn" onclick="openFocusModal()">✏️ Změnit</button>
    </div>`;
  } else {
    el.innerHTML = `<button class="focus-empty-btn" onclick="openFocusModal()">
      🎯 <strong>Co musíš dnes udělat?</strong> <span style="color:var(--text3);font-weight:400">Nastav denní focus</span>
    </button>`;
  }
}

function focusWidgetHTML() {
  if (dailyFocus) {
    return `<div id="focus-widget" class="card focus-card"><div class="focus-content">
      <span class="focus-label">🎯 Dnešní focus</span>
      <div class="focus-text">${esc(dailyFocus)}</div>
      <button class="focus-edit-btn" onclick="openFocusModal()">✏️ Změnit</button>
    </div></div>`;
  } else {
    return `<div id="focus-widget" class="card focus-card"><button class="focus-empty-btn" onclick="openFocusModal()">
      🎯 <strong>Co musíš dnes udělat?</strong> <span style="color:var(--text3);font-weight:400">Nastav denní focus</span>
    </button></div>`;
  }
}


// ── QUICK START ───────────────────────────────────────
function quickStartHTML() {
  if (lsGet('lp_qs_dismissed')) return '';
  // Zobrazit jen pro uživatele mladší 21 dní
  if (prof.createdAt) {
    const age = (Date.now() - new Date(prof.createdAt).getTime()) / 86400000;
    if (age > 21) return '';
  }
  const mods = prof.modules || [];
  const done = lsGet('lp_qs_done', []);

  // Definice úkolů podle aktivních modulů
  const allTasks = [
    { id:'habit',    emoji:'🎯', text:'Přidej svůj první návyk',        page:'habits',   done: habits.length > 0 },
    { id:'focus',    emoji:'🎯', text:'Nastav dnešní focus',             action:'openFocusModal()', done: !!dailyFocus },
    { id:'water',    emoji:'💧', text:'Dej si první sklenici vody',       action:'addWater()',       done: waterToday > 0 },
    { id:'recipe',   emoji:'🍳', text:'Vyzkoušej AI recept',             page:'cooking',  done: savedRecipes.length > 0 },
    { id:'shop',     emoji:'🛒', text:'Přidej položku do nákupu',        page:'shopping', done: shopItems.length > 0 },
    { id:'goal',     emoji:'🏆', text:'Vytvoř svůj první cíl',           page:'goals',    done: goals.length > 0 },
    { id:'family',   emoji:'👨‍👩‍👧', text:'Připoj se k rodině nebo pozvi blízkého', page:'settings', done: !!familyId },
    { id:'note',     emoji:'📝', text:'Napiš první poznámku',            page:'journal',  done: entries.length > 0 },
  ];

  // Filtruj podle aktivních modulů + základní (focus, water jsou vždy)
  const relevant = allTasks.filter(t => {
    if (['focus','water'].includes(t.id)) return true;
    if (t.id === 'habit' && mods.includes('habits')) return true;
    if (t.id === 'recipe' && mods.includes('cooking')) return true;
    if (t.id === 'shop' && mods.includes('shopping')) return true;
    if (t.id === 'goal' && mods.includes('goals')) return true;
    if (t.id === 'family') return true;
    if (t.id === 'note' && mods.includes('journal')) return true;
    return false;
  }).slice(0, 5);

  // Aktualizuj done status
  const completedIds = relevant.filter(t => t.done || done.includes(t.id)).map(t => t.id);
  const allDone = relevant.every(t => t.done || done.includes(t.id));
  if (allDone && relevant.length > 0) {
    lsSave('lp_qs_dismissed', true);
    return '';
  }

  const completedCount = completedIds.length;
  const total = relevant.length;
  const pct = Math.round(completedCount / total * 100);
  const av = AVS.find(a => a.id === prof?.avatarId) || AVS[0];

  const taskHTML = relevant.map(t => {
    const isDone = t.done || done.includes(t.id);
    const onclick = t.action ? t.action : `sp('${t.page}')`;
    return `<div class="qs-task ${isDone ? 'done' : ''}" onclick="${isDone ? '' : onclick}">
      <div class="qs-check">${isDone ? '✓' : ''}</div>
      <span class="qs-task-text">${t.emoji} ${t.text}</span>
    </div>`;
  }).join('');

  return `<div class="card qs-card" id="qs-card">
    <div class="qs-header">
      <div class="qs-title-row">
        <span style="font-size:20px">${av.emoji}</span>
        <div>
          <div class="qs-title">Začínáme! ${completedCount}/${total} hotovo</div>
          <div class="qs-sub">Prvních pár kroků v LifePocket</div>
        </div>
      </div>
      <button class="qs-dismiss" onclick="dismissQS()" title="Skrýt">×</button>
    </div>
    <div class="qs-bar-wrap"><div class="qs-bar" style="width:${pct}%"></div></div>
    <div class="qs-tasks">${taskHTML}</div>
  </div>`;
}

window.dismissQS = () => {
  lsSave('lp_qs_dismissed', true);
  document.getElementById('qs-card')?.remove();
};

// ── AVATAR REAKCE ─────────────────────────────────────
let avReactionTimer = null;

function showAvReaction(emoji, title, msg, confetti=false) {
  const av = AVS.find(a=>a.id===prof?.avatarId)||AVS[0];
  const el = document.getElementById('av-reaction');
  const emEl = document.getElementById('av-r-em');
  const titleEl = document.getElementById('av-r-title');
  const msgEl = document.getElementById('av-r-msg');
  if(!el) return;
  emEl.textContent = emoji || av.emoji;
  titleEl.textContent = title;
  msgEl.textContent = msg;
  el.classList.add('show');
  if(confetti) spawnConfetti();
  if(avReactionTimer) clearTimeout(avReactionTimer);
  avReactionTimer = setTimeout(hideAvReaction, 5000);
}

window.hideAvReaction = () => {
  document.getElementById('av-reaction')?.classList.remove('show');
};

function spawnConfetti() {
  const emojis = ['🎉','⭐','✨','🏆','🔥','💪'];
  for(let i=0; i<8; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.textContent = emojis[Math.floor(Math.random()*emojis.length)];
      el.style.left = (20 + Math.random()*60) + 'vw';
      el.style.top = (20 + Math.random()*50) + 'vh';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 900);
    }, i * 80);
  }
}

function getStreak(hid) {
  let streak = 0;
  const d = new Date();
  for(let i=0; i<365; i++) {
    const ds = d.toISOString().slice(0,10);
    if(habitLogs.some(l=>l.id===`${hid}_${ds}`&&l.done)) streak++;
    else break;
    d.setDate(d.getDate()-1);
  }
  return streak;
}

function checkAvatarReactions(hid, date, justCompleted) {
  if(!justCompleted) return; // jen při splnění, ne při odškrtnutí
  const av = AVS.find(a=>a.id===prof?.avatarId)||AVS[0];
  const name = prof?.prezdivka||prof?.nickname||'';
  const today = new Date().toISOString().slice(0,10);
  if(date !== today) return; // jen pro dnešek

  // Streak milník
  const streak = getStreak(hid);
  const h = habits.find(x=>x.id===hid);
  const hname = h ? `${h.emoji} ${h.name}` : 'návyk';

  if(streak === 7) {
    showAvReaction('🔥', `7 dní v řadě!`, `${av.name}: Týden bez přerušení u „${h?.name}"! ${name ? name+', jsi' : 'Jsi'} neporazitelný! 💪`, true);
    return;
  }
  if(streak === 14) {
    showAvReaction('🏆', `14 dní v řadě!`, `${av.name}: Dva týdny nepřetržitě! Tohle je už charakter, ne náhoda. Bravo! 🌟`, true);
    return;
  }
  if(streak === 30) {
    showAvReaction('👑', `30 dní v řadě!`, `${av.name}: Celý měsíc! ${name ? name+' — ' : ''}tohle je výjimečné. Jsem na tebe hrdý! 🎉`, true);
    return;
  }

  // Všechny návyky splněny
  const totalH = habits.length;
  if(totalH > 1) {
    const doneToday = habits.filter(hh =>
      habitLogs.some(l=>l.id===`${hh.id}_${today}`&&l.done)
    ).length;
    if(doneToday === totalH) {
      const msgs = {
        rex: `Všechno splněno! Makáš jak stroj. ${name}, to je výkon! 💪`,
        sage: `Vše splněno. ${name}, věnuji ti okamžik ticha a úcty. 🌿`,
        ash: `100% dnes! ${name}, takhle se mění životy. 🔥`,
        nora: `Všechno hotovo! ${name}, jsi hvězda tohoto dne. ⭐`,
        rio: `Celý den splněn! ${name}, žiješ naplno! 🌊`,
      };
      showAvReaction(av.emoji, 'Perfektní den! 🎯', msgs[av.id]||msgs.rex, true);
      return;
    }
  }

  // Streak 3 — malá oslava
  if(streak === 3) {
    showAvReaction(av.emoji, '3 dny v řadě!', `${av.name}: Tři dny bez přestávky u „${h?.name}". Dobrý začátek! 🔥`);
  }
}

// Kontrola nečinnosti — zavolá se při načtení
function checkInactivity() {
  if(!habits.length) return;
  const av = AVS.find(a=>a.id===prof?.avatarId)||AVS[0];
  const name = prof?.prezdivka||prof?.nickname||'';
  const today = new Date();
  let lastActive = null;

  // Najdi poslední den kdy byl splněn aspoň 1 návyk
  for(let i=1; i<=30; i++) {
    const d = new Date(today); d.setDate(d.getDate()-i);
    const ds = d.toISOString().slice(0,10);
    if(habitLogs.some(l=>l.date===ds&&l.done)) { lastActive=i; break; }
  }

  if(lastActive === null || lastActive < 2) return;

  const msgs2 = {
    rex: `Zdravím! Pauza ${lastActive} dní. Dnes znovu makáme?`,
    sage: `${lastActive} dní ticha. Všimli jsme si. Jak se máš?`,
    ash: `Jsem zpět! ${lastActive} dní pauza. Co se dělo?`,
    nora: `Chyběl jsi mi! ${lastActive} dní bez aktivity. Vše ok?`,
    rio: `Hej! ${lastActive} dní mimo. Pojď zase žít naplno!`,
  };

  const k = `lp_inactivity_shown_${today.toISOString().slice(0,10)}`;
  if(localStorage.getItem(k)) return;
  localStorage.setItem(k, '1');

  // Zobrazit až po chvíli
  setTimeout(() => {
    showAvReaction(av.emoji,
      lastActive >= 7 ? `${lastActive} dní pauza 😴` : `${lastActive} dny bez aktivit`,
      `${av.name}: ${msgs2[av.id]||msgs2.rex}`
    );
  }, 6000);
}


// ── RODINA & SDÍLENÍ ──────────────────────────────────
let familyId = null;
let familyData = null;
let unsubFamily = null;
let unsubFamilyShop = null;
let unsubFamilyMeal = null;
let unsubFamilyCal = null;
let familyShopItems = [];
let familyMealPlan = {};
let mealViewMode = 'shared'; // 'shared' | 'personal'
window.setMealView = (mode) => { mealViewMode = mode; renderMealPlan(); };
let shopViewMode = 'shared'; // 'shared' | 'personal'
window.setShopView = (mode) => { shopViewMode = mode; renderShop(); };
function isShopShared() { return !!(familyId && familyData?.shareShop && shopViewMode === 'shared'); }
function isCalShared() { return !!(familyId && familyData?.shareCal); }
let familyEvents = [];

function genFamilyCode() {
  const words = ['ADAM','ANNA','BARA','DOMA','ELAN','FARA','HANA','JANA','KARA','LARA','MARA','NORA','PATA','RANA','SARA','TARA'];
  const w = words[Math.floor(Math.random()*words.length)];
  const n = String(Math.floor(1000+Math.random()*9000));
  return w+'-'+n;
}

window.createFamily = async () => {
  if(!CU) return;
  if(familyId) { toast('Už jsi ve skupině'); return; }
  const nameInp = document.getElementById('family-name-inp');
  const groupName = (nameInp?.value||'').trim() || 'Moje skupina';
  const code = genFamilyCode();
  const fid = code; // kód = ID
  const data = {
    code, groupName, createdBy: CU.uid, createdAt: new Date().toISOString(),
    members: { [CU.uid]: { name: prof.prezdivka||prof.nickname||CU.displayName, avatar: prof.avatarId||'rex', joinedAt: new Date().toISOString(), role:'admin' } },
    shareShop: true, shareCal: true, shareMeal: true
  };
  await setDoc(doc(db,'families',fid), data);
  await setDoc(doc(db,'users',CU.uid,'profile','main'), {...prof, familyId: fid});
  prof.familyId = fid;
  familyId = fid;
  subscribeFamily();
  renderFamilySettings();
  toast('✅ Skupina vytvořena! Sdílej kód s partnerem.');
};

window.showJoinFamily = () => {
  document.getElementById('family-join-form').style.display='block';
  document.getElementById('family-code-inp').focus();
};

window.joinFamily = async () => {
  const code = document.getElementById('family-code-inp').value.trim().toUpperCase();
  if(!code || code.length < 4) { toast('⚠️ Zadej platný kód'); return; }
  try {
    const fSnap = await getDoc(doc(db,'families',code));
    if(!fSnap.exists()) { toast('❌ Skupina nenalezena — zkontroluj kód'); return; }
    const fData = fSnap.data();
    if(Object.keys(fData.members||{}).length >= 6) { toast('❌ Skupina je plná'); return; }
    // Přidej sebe do skupiny
    await setDoc(doc(db,'families',code), {
      members: { ...fData.members, [CU.uid]: { name: prof.prezdivka||prof.nickname||CU.displayName, avatar: prof.avatarId||'rex', joinedAt: new Date().toISOString(), role:'member' } }
    }, {merge:true});
    await setDoc(doc(db,'users',CU.uid,'profile','main'), {...prof, familyId: code});
    prof.familyId = code;
    familyId = code;
    document.getElementById('family-join-form').style.display='none';
    subscribeFamily();
    renderFamilySettings();
    toast('✅ Připojen k rodinné skupině!');
  } catch(e) { toast('❌ Chyba: '+e.message); }
};

window.leaveFamily = async () => {
  if(!familyId || !confirm('Opustit rodinnou skupinu?')) return;
  try {
    const fSnap = await getDoc(doc(db,'families',familyId));
    if(fSnap.exists()) {
      const d = fSnap.data();
      const members = {...(d.members||{})};
      delete members[CU.uid];
      await setDoc(doc(db,'families',familyId), {members}, {merge:true});
    }
    const newProf = {...prof}; delete newProf.familyId;
    prof = newProf;
    await setDoc(doc(db,'users',CU.uid,'profile','main'), prof);
    familyId = null; familyData = null;
    if(unsubFamily) { unsubFamily(); unsubFamily=null; }
    if(unsubFamilyShop) { unsubFamilyShop(); unsubFamilyShop=null; }
    if(unsubFamilyCal) { unsubFamilyCal(); unsubFamilyCal=null; }
    if(unsubFamilyMeal) { unsubFamilyMeal(); unsubFamilyMeal=null; }
    renderFamilySettings();
    toast('Opustil jsi skupinu');
  } catch(e) { toast('❌ '+e.message); }
};

window.copyFamilyCode = () => {
  if(!familyId) return;
  navigator.clipboard.writeText(familyId).then(()=>toast('📋 Kód zkopírován!'));
};

window.shareFamilyCode = async () => {
  if(!familyId) return;
  const text = `Připoj se k naší rodině v LifePocket!\nKód skupiny: ${familyId}\nhttps://adamstencl.github.io/LifePocket/`;
  if(navigator.share) {
    try { await navigator.share({title:'LifePocket – rodinná skupina', text}); }
    catch(e) { if(e.name!=='AbortError') toast('❌ Sdílení selhalo'); }
  } else {
    navigator.clipboard.writeText(familyId).then(()=>toast('📋 Kód zkopírován do schránky'));
  }
};

window.saveFamilyPrefs = async () => {
  if(!familyId || !familyData) return;
  const {shareShop,shareCal,shareMeal,shareChecklist} = familyData;
  await setDoc(doc(db,'families',familyId), {shareShop,shareCal,shareMeal,shareChecklist}, {merge:true});
  if(shareShop) syncShopToFamily();
  if(shareChecklist) syncChecklistToFamily();
};

window.toggleFamilyModule = async (key) => {
  if(!familyId || !familyData) return;
  const newVal = !familyData[key];
  familyData[key] = newVal;
  await setDoc(doc(db,'families',familyId), {[key]: newVal}, {merge:true});
  if(key==='shareShop' && newVal) syncShopToFamily();
  if(key==='shareChecklist' && newVal) syncChecklistToFamily();
  renderFamilySettings();
};

window.removeFamilyMember = async (uid) => {
  if(!familyId || !familyData) return;
  if(!confirm('Odebrat tohoto člena ze skupiny?')) return;
  const members = {...(familyData.members||{})};
  delete members[uid];
  await setDoc(doc(db,'families',familyId), {members}, {merge:true});
  // Smaž familyId z profilu člena
  try { await setDoc(doc(db,'users',uid,'profile','main'), {familyId: null}, {merge:true}); } catch(e){}
  toast('✓ Člen odebrán');
};

function subscribeFamily() {
  if(!familyId) return;

  // Sleduj data skupiny (členové)
  unsubFamily = onSnapshot(doc(db,'families',familyId), snap => {
    if(!snap.exists()) return;
    familyData = snap.data();
    renderFamilySettings();
    // Přihlásit se k sdíleným datům
    if(familyData.shareShop) subscribeSharedShop();
    if(familyData.shareCal) subscribeSharedCal();
    if(familyData.shareMeal) subscribeSharedMeal();
    if(familyData.shareChecklist) subscribeSharedChecklist();
  });
}

function subscribeSharedShop() {
  if(unsubFamilyShop) return;
  unsubFamilyShop = onSnapshot(collection(db,'families',familyId,'shopItems'), snap => {
    familyShopItems = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderShop(); // přerenderuj nákupy
  });
}

function subscribeSharedCal() {
  if(unsubFamilyCal) return;
  unsubFamilyCal = onSnapshot(collection(db,'families',familyId,'events'), snap => {
    familyEvents = snap.docs.map(d=>({id:d.id,...d.data(),shared:true}));
    // Sloučit s osobními eventi
    renderCal();
  });
}

function subscribeSharedMeal() {
  if(unsubFamilyMeal) return;
  unsubFamilyMeal = onSnapshot(doc(db,'families',familyId,'mealplan','week'), snap => {
    familyMealPlan = snap.exists() ? snap.data() : {};
    renderMealPlan();
  });
}

// Sync nákupní seznam do rodinného prostoru
async function syncShopToFamily() {
  if(!familyId || !familyData?.shareShop) return;
  // Nákupní seznam se nyní píše přímo do families/{id}/shopItems
}

// ── SDÍLENÝ CHECKLIST ──────────────────────────────────────
let familyChecklists = [];
let unsubFamilyChecklist = null;

function subscribeSharedChecklist() {
  if(unsubFamilyChecklist) return;
  unsubFamilyChecklist = onSnapshot(
    collection(db,'families',familyId,'checklists'),
    snap => {
      familyChecklists = snap.docs.map(d => ({...d.data(), id: d.id, _family: true}));
      renderChecklist();
    }
  );
}

async function syncChecklistToFamily() {
  if(!familyId || !familyData?.shareChecklist) return;
  // Sync označených listů (shared: true) do Firestore
  const toShare = checklists.filter(c => c.shared);
  for (const list of toShare) {
    await setDoc(doc(db,'families',familyId,'checklists',list.id), {
      name: list.name, items: list.items, updatedAt: Date.now(), owner: CU.uid
    });
  }
}

window.toggleChecklistShare = async function(listId) {
  const list = checklists.find(c => c.id === listId);
  if(!list || !familyId) return;
  list.shared = !list.shared;
  saveChecklistDoc(list);
  if(list.shared) {
    await setDoc(doc(db,'families',familyId,'checklists',list.id), {
      name: list.name, items: list.items, updatedAt: Date.now(), owner: CU.uid
    });
    toast(`✅ "${list.name}" sdíleno s rodinou`);
  } else {
    await deleteDoc(doc(db,'families',familyId,'checklists',list.id));
    toast(`"${list.name}" odebráno ze sdílení`);
  }
  renderChecklist();
};

function renderFamilySettings() {
  const noGroup = document.getElementById('family-no-group');
  const groupView = document.getElementById('family-group-view');
  if(!noGroup || !groupView) return;

  if(!familyId || !familyData) {
    noGroup.style.display = 'block';
    groupView.style.display = 'none';
    return;
  }
  noGroup.style.display = 'none';
  groupView.style.display = 'block';

  const fgn = document.getElementById('family-group-name-display');
  if(fgn) {
    const gn = familyData.groupName || 'Moje skupina';
    fgn.innerHTML = `${gn} <button onclick="renameFamilyGroup()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px;padding:0 4px" title="Přejmenovat">✏️</button>`;
  }

  const fcd = document.getElementById('family-code-display');
  if(fcd) fcd.textContent = familyId;

  // Členové
  const members = familyData.members || {};
  const avs = {rex:'🐺',sage:'🦉',ash:'🔥',nora:'🌸',rio:'🌊'};
  const isAdmin = members[CU?.uid]?.role === 'admin';
  const fml = document.getElementById('family-members-list');
  if(fml) fml.innerHTML = `
    <div style="font-size:12px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Členové (${Object.keys(members).length})</div>
    ${Object.entries(members).map(([uid,m])=>`
    <div class="family-member">
      <div class="family-member-av">${avs[m.avatar]||'👤'}</div>
      <div class="family-member-info">
        <div class="family-member-name">${m.name||'Člen'}${uid===CU?.uid?' <span style="color:var(--text3);font-size:11px">(ty)</span>':''}</div>
        <div class="family-member-role">${m.role==='admin'?'Správce':'Člen'} · připojen ${new Date(m.joinedAt||Date.now()).toLocaleDateString('cs-CZ',{day:'numeric',month:'short'})}</div>
      </div>
      ${isAdmin && uid !== CU?.uid ? `<button onclick="removeFamilyMember('${uid}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:18px;padding:4px 8px;opacity:.7" title="Odebrat člena">✕</button>` : ''}
    </div>`).join('')}`;

  // Moduly — kartičky s toggle
  const shareModules = [
    {key:'shareShop', emoji:'🛒', label:'Nákupní seznam', val: familyData.shareShop!==false},
    {key:'shareCal',  emoji:'📅', label:'Kalendář',       val: familyData.shareCal!==false},
    {key:'shareMeal', emoji:'🥗', label:'Jídelníček',     val: familyData.shareMeal!==false},
    {key:'shareChecklist', emoji:'📋', label:'Checklist', val: familyData.shareChecklist===true},
  ];
  const fsm = document.getElementById('family-share-modules');
  if(fsm) fsm.innerHTML = shareModules.map(m=>`
    <div class="fshare-mod-row" onclick="toggleFamilyModule('${m.key}')" style="cursor:pointer">
      <span style="font-size:20px">${m.emoji}</span>
      <span style="flex:1;font-size:14px;color:var(--text1)">${m.label}</span>
      <div class="fshare-toggle ${m.val?'on':''}">
        <div class="fshare-thumb"></div>
      </div>
    </div>`).join('');
}

window.renameFamilyGroup = async () => {
  if(!familyId) return;
  const cur = familyData?.groupName || 'Moje skupina';
  const name = prompt('Nový název skupiny:', cur);
  if(!name || name.trim() === cur) return;
  await setDoc(doc(db,'families',familyId), {groupName: name.trim()}, {merge:true});
  toast('✓ Název skupiny změněn');
};

// ── SDÍLENÝ NÁKUPNÍ SEZNAM ────────────────────────────
// Override addShopItem aby zapisoval do rodinného prostoru pokud je aktivní sdílení
async function addShopItemToFamily(name, category) {
  if(!familyId || !familyData?.shareShop) return false;
  await addDoc(collection(db,'families',familyId,'shopItems'), {
    name, category: category||'Ostatní', done:false,
    addedBy: CU.uid, addedByName: prof.prezdivka||prof.nickname||'',
    createdAt: new Date().toISOString()
  });
  return true;
}

async function toggleFamilyShopItem(id, done) {
  if(!familyId) return;
  await setDoc(doc(db,'families',familyId,'shopItems',id), {done:!done, doneBy:CU.uid}, {merge:true});
}

async function deleteFamilyShopItem(id) {
  if(!familyId) return;
  await deleteDoc(doc(db,'families',familyId,'shopItems',id));
}

// ── JÍDELNÍČEK ────────────────────────────────────────
const DAYS_CS = ['Pondělí','Úterý','Středa','Čtvrtek','Pátek','Sobota','Neděle'];
const MEALS_CS = ['Snídaně','Oběd','Večeře'];

function renderMealPlan() {
  renderKcalToday();
  const kg = document.getElementById('set-kcalgoal');
  if(kg) kg.value = prof.kcalGoal || 2000;
  const el = document.getElementById('mealplan-content');
  if(!el) return;

  const canShareMeal = !!(familyId && familyData?.shareMeal);
  const badge = document.getElementById('meal-shared-badge');
  const toggle = document.getElementById('meal-view-toggle');

  if(canShareMeal) {
    if(badge) badge.style.display = 'none';
    if(toggle) {
      toggle.style.display = 'flex';
      const btnShared = document.getElementById('meal-toggle-shared');
      const btnPersonal = document.getElementById('meal-toggle-personal');
      const selStyle = 'background:var(--accent);color:var(--tc);font-weight:600';
      const defStyle = 'background:transparent;color:var(--text2)';
      if(btnShared) btnShared.style.cssText = mealViewMode==='shared' ? selStyle : defStyle;
      if(btnPersonal) btnPersonal.style.cssText = mealViewMode==='personal' ? selStyle : defStyle;
    }
  } else {
    if(badge) badge.style.display = 'none';
    if(toggle) toggle.style.display = 'none';
    mealViewMode = 'personal';
  }

  const isShared = canShareMeal && mealViewMode === 'shared';
  const plan = isShared ? familyMealPlan : (prof.mealPlan || {});

  const canEdit = !isShared || (familyData?.members?.[CU.uid]?.role==='admin');

  // Zjisti jestli je plán úplně prázdný
  const hasAnyMeal = Object.values(plan).some(day =>
    typeof day === 'object' && Object.values(day).some(v => v && v.trim())
  );
  const welcomeBanner = !hasAnyMeal ? `
    <div style="background:linear-gradient(135deg,rgba(245,200,66,.08),rgba(224,149,74,.06));border:1px solid rgba(245,200,66,.2);border-radius:14px;padding:18px;margin-bottom:16px;text-align:center">
      <div style="font-size:36px;margin-bottom:8px">🗓️</div>
      <div style="font-family:'Playfair Display',serif;font-style:italic;font-size:17px;color:var(--accent);margin-bottom:6px">Jídelníček je prázdný</div>
      <div style="font-size:14px;color:var(--text3);margin-bottom:14px">Naplň ho ručně nebo nech AI navrhnout celý týden</div>
      <button class="btn-p" style="width:auto;padding:9px 22px;font-size:14px" onclick="generateMealPlanAI()">✨ Navrhnout AI jídelníček</button>
    </div>` : '';

  el.innerHTML = welcomeBanner + DAYS_CS.map((day,di) => {
    const dayKey = 'd'+di;
    const dayData = plan[dayKey] || {};
    return `<div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
      <div style="font-family:'Playfair Display',serif;font-size:16px;font-weight:700;color:var(--accent);margin-bottom:10px">${day}</div>
      ${MEALS_CS.map((meal,mi) => {
        const mealKey = 'm'+mi;
        const val = dayData[mealKey] || '';
        const mealEmoji = ['🌅','☀️','🌙'][mi];
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
          <div style="font-size:11px;color:var(--text3);min-width:58px;font-weight:600">${mealEmoji} ${meal}</div>
          <div ${canEdit?`onclick="openMealPicker('${dayKey}','${mealKey}','${day}','${meal}')"`:``}
            style="flex:1;background:var(--card3,var(--bg));border:1px solid var(--border);border-radius:8px;padding:7px 12px;color:${val?'var(--text)':'var(--text3)'};font-family:'Crimson Pro',serif;font-size:14px;cursor:${canEdit?'pointer':'default'};min-height:34px;display:flex;align-items:center;justify-content:space-between;transition:border-color .2s"
            ${canEdit?`onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'"`:``}>
            <span>${val || (canEdit ? 'Klikni pro výběr…' : '—')}</span>
            ${val && canEdit ? `<span onclick="event.stopPropagation();saveMealPlanItem('${dayKey}','${mealKey}','')" style="color:var(--text3);font-size:12px;padding:2px 4px;border-radius:4px" title="Smazat">✕</span>` : (canEdit && !val ? '<span style="font-size:11px;color:var(--accent);opacity:.6">+</span>' : '')}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('') + (!hasAnyMeal ? '' : `<button class="btn-p" style="margin-top:6px" onclick="generateMealPlanAI()">✨ Navrhnout jídelníček pomocí AI</button>`);
}

window.saveMealPlanItem = async (dayKey, mealKey, val) => {
  if(!CU) return;
  if(familyId && familyData?.shareMeal && mealViewMode === 'shared') {
    // Uložit do rodinného prostoru
    const update = {}; update[dayKey+'.'+mealKey] = val;
    await setDoc(doc(db,'families',familyId,'mealplan','week'), update, {merge:true});
  } else {
    // Lokální profil
    if(!prof.mealPlan) prof.mealPlan = {};
    if(!prof.mealPlan[dayKey]) prof.mealPlan[dayKey] = {};
    prof.mealPlan[dayKey][mealKey] = val;
    await setDoc(doc(db,'users',CU.uid,'profile','main'), prof);
  }
};

window.generateMealPlanAI = async () => {
  toast('✨ Generuji jídelníček…');
  try {
    const raw = await callClaude([
      {role:'system',content:'Odpovídej POUZE v JSON formátu, bez markdown. Vygeneruj týdenní jídelníček. PRAVIDLO: Piš VÝHRADNĚ česky. Žádná anglická, japonská ani jiná cizí slova.'},
      {role:'user',content:'Vygeneruj jídelníček na 7 dní (d0-d6), každý den má snídani (m0), oběd (m1) a večeři (m2). Format: {"d0":{"m0":"...","m1":"...","m2":"..."},...}'}
    ], 800);
    if (!raw) throw new Error('AI není k dispozici');
    const text = raw.replace(/```json|```/g,'').trim();
    const plan = JSON.parse(text);
    // Uložit
    if(familyId && familyData?.shareMeal && mealViewMode === 'shared') {
      await setDoc(doc(db,'families',familyId,'mealplan','week'), plan);
      renderMealPlan();
    } else {
      prof.mealPlan = plan;
      await setDoc(doc(db,'users',CU.uid,'profile','main'), prof);
      renderMealPlan();
    }
    toast('✅ Jídelníček vygenerován!');
  } catch(e) { toast('❌ Chyba: '+e.message); }
};

// ════════════════════════════════════════
// KALORICKÝ TRACKER — log + render + AI odhad
// ════════════════════════════════════════

let foodLogs = []; // [{id, name, kcal, protein, carbs, fat, date, time}]

async function subFoodLogs() {
  if(!CU) return;
  const today = new Date().toISOString().slice(0,10);
  const snap = await getDocs(collection(db,'users',CU.uid,'foodLogs'));
  foodLogs = snap.docs.map(d=>({id:d.id,...d.data()}));
}

window.renderKcalToday = async () => {
  const sec = document.getElementById('kcal-today-section');
  if(!sec) return;
  const today = new Date().toISOString().slice(0,10);
  const todayLogs = foodLogs.filter(l=>l.date===today);
  const goal = prof.kcalGoal || 2000;
  const totalKcal = todayLogs.reduce((s,l)=>s+(l.kcal||0),0);
  const totalP = todayLogs.reduce((s,l)=>s+(l.protein||0),0);
  const totalC = todayLogs.reduce((s,l)=>s+(l.carbs||0),0);
  const totalF = todayLogs.reduce((s,l)=>s+(l.fat||0),0);
  const pct = Math.min(Math.round(totalKcal/goal*100),100);
  const remaining = Math.max(goal-totalKcal,0);
  const over = totalKcal > goal;

  const chipsHtml = todayLogs.map(l=>`
    <div style="background:var(--card);border:1px solid var(--border);border-radius:20px;padding:5px 12px;font-size:13px;color:var(--text);display:flex;align-items:center;gap:7px;box-shadow:0 1px 4px rgba(0,0,0,.05)">
      ${l.name}
      <span style="font-size:11px;color:var(--accent);font-weight:600">${l.kcal} kcal</span>
      <span onclick="deleteFoodLog('${esc(l.id)}')" style="color:var(--text3);cursor:pointer;font-size:13px;padding:0 2px" title="Smazat">×</span>
    </div>`).join('');

  sec.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:20px;padding:20px 22px;box-shadow:var(--shadow)">
      <!-- Hlavička -->
      <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:16px">
        <div style="font-family:'Playfair Display',serif;font-style:italic">
          <div style="font-size:42px;color:var(--text);line-height:1">${totalKcal.toLocaleString('cs-CZ')}<span style="font-size:15px;color:var(--text3);margin-left:4px">kcal</span></div>
          <div style="font-size:13px;color:var(--text2);margin-top:2px">${over?'⚠️ Překročen cíl o '+(totalKcal-goal)+' kcal':'z cíle '+goal.toLocaleString('cs-CZ')+' kcal · zbývá '+remaining}</div>
        </div>
        <div style="background:${over?'rgba(var(--red-rgb,198,40,40),.12)':'rgba(61,214,140,.12)'};border:1px solid ${over?'rgba(198,40,40,.3)':'rgba(61,214,140,.3)'};border-radius:20px;padding:6px 14px;font-size:12px;color:${over?'var(--red)':'var(--green)'};font-family:monospace;white-space:nowrap">${pct} % splněno</div>
      </div>

      <!-- Hlavní progress bar -->
      <div style="height:10px;background:var(--card2);border-radius:10px;margin-bottom:6px;overflow:hidden">
        <div style="height:100%;border-radius:10px;background:linear-gradient(90deg,var(--accent),var(--accent2));width:${pct}%;box-shadow:0 0 8px rgba(245,200,66,.25);transition:width .6s ease"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:18px;font-family:monospace">
        <span>0</span><span>${Math.round(goal*0.25)}</span><span>${Math.round(goal*0.5)}</span><span>${Math.round(goal*0.75)}</span><span>${goal}</span>
      </div>

      <!-- Makra -->
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:18px">
        <div style="display:grid;grid-template-columns:90px 1fr 55px;align-items:center;gap:12px">
          <div style="font-size:13px;color:var(--text2)">💪 Bílkoviny</div>
          <div style="height:7px;background:var(--card2);border-radius:6px;overflow:hidden"><div style="height:100%;border-radius:6px;background:var(--blue);width:${Math.min(Math.round(totalP/150*100),100)}%"></div></div>
          <div style="font-family:monospace;font-size:13px;font-weight:500;color:var(--blue);text-align:right">${totalP} g</div>
        </div>
        <div style="display:grid;grid-template-columns:90px 1fr 55px;align-items:center;gap:12px">
          <div style="font-size:13px;color:var(--text2)">🍞 Sacharidy</div>
          <div style="height:7px;background:var(--card2);border-radius:6px;overflow:hidden"><div style="height:100%;border-radius:6px;background:var(--accent2);width:${Math.min(Math.round(totalC/250*100),100)}%"></div></div>
          <div style="font-family:monospace;font-size:13px;font-weight:500;color:var(--accent2);text-align:right">${totalC} g</div>
        </div>
        <div style="display:grid;grid-template-columns:90px 1fr 55px;align-items:center;gap:12px">
          <div style="font-size:13px;color:var(--text2)">🥑 Tuky</div>
          <div style="height:7px;background:var(--card2);border-radius:6px;overflow:hidden"><div style="height:100%;border-radius:6px;background:var(--green);width:${Math.min(Math.round(totalF/80*100),100)}%"></div></div>
          <div style="font-family:monospace;font-size:13px;font-weight:500;color:var(--green);text-align:right">${totalF} g</div>
        </div>
      </div>

      <!-- Dnešní jídla (chipy) -->
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:14px 16px">
        <div style="font-size:11px;color:var(--text3);font-family:monospace;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">Dnešní jídla</div>
        <div style="display:flex;flex-wrap:wrap;gap:7px">
          ${chipsHtml}
          <div onclick="openAddFoodLog()" style="background:transparent;border:1px dashed var(--border2);border-radius:20px;padding:5px 13px;font-size:13px;color:var(--text3);cursor:pointer;font-style:italic;transition:border-color .2s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border2)'">+ přidat jídlo</div>
        </div>
      </div>
    </div>`;
};

window.openAddFoodLog = () => {
  // Nabídni dnešní plán z jídelníčku jako rychlé přidání
  const today = new Date();
  const di = today.getDay() === 0 ? 6 : today.getDay()-1; // 0=Po
  const plan = prof.mealPlan || {};
  const dayData = plan['d'+di] || {};
  const planned = ['m0','m1','m2'].map((k,i)=>dayData[k]?{key:k,name:dayData[k],emoji:['🌅','☀️','🌙'][i]}:null).filter(Boolean);

  const plannedBtns = planned.length ? `
    <div style="font-size:12px;color:var(--text3);margin-bottom:8px;font-family:monospace;letter-spacing:.5px;text-transform:uppercase">Z dnešního plánu</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">
      ${planned.map(p=>`<button onclick="addFoodFromPlan(${JSON.stringify(p.name)},${JSON.stringify(p.key)})" style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:6px 12px;font-size:13px;color:var(--text);cursor:pointer;font-family:'Crimson Pro',serif">${p.emoji} ${esc(p.name)}</button>`).join('')}
    </div>` : '';

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center;padding:16px';
  modal.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:20px 20px 16px 16px;padding:24px;width:100%;max-width:420px;box-shadow:0 -8px 40px rgba(0,0,0,.3)">
      <div style="font-family:'Playfair Display',serif;font-style:italic;font-size:18px;color:var(--accent);margin-bottom:16px">🍽️ Přidat jídlo</div>
      ${plannedBtns}
      <div style="font-size:12px;color:var(--text3);margin-bottom:8px;font-family:monospace;letter-spacing:.5px;text-transform:uppercase">Zadat ručně</div>
      <input id="fl-name" type="text" placeholder="Název jídla…" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:10px 14px;color:var(--text);font-family:'Crimson Pro',serif;font-size:15px;margin-bottom:10px;outline:none">
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <div style="flex:1"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">kcal</div><input id="fl-kcal" type="number" placeholder="380" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:8px 12px;color:var(--text);font-family:'Crimson Pro',serif;font-size:14px;outline:none"></div>
        <div style="flex:1"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">Bílkoviny g</div><input id="fl-p" type="number" placeholder="25" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:8px 12px;color:var(--text);font-family:'Crimson Pro',serif;font-size:14px;outline:none"></div>
        <div style="flex:1"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">Sacharidy g</div><input id="fl-c" type="number" placeholder="45" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:8px 12px;color:var(--text);font-family:'Crimson Pro',serif;font-size:14px;outline:none"></div>
        <div style="flex:1"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">Tuky g</div><input id="fl-f" type="number" placeholder="12" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:8px 12px;color:var(--text);font-family:'Crimson Pro',serif;font-size:14px;outline:none"></div>
      </div>
      <button onclick="aiEstimateFoodLog()" style="width:100%;background:rgba(245,200,66,.1);border:1px solid rgba(245,200,66,.3);border-radius:12px;padding:10px;font-family:'Crimson Pro',serif;font-size:14px;color:var(--accent);cursor:pointer;margin-bottom:8px">✨ AI odhadne kalorie z názvu</button>
      <div style="display:flex;gap:8px">
        <button onclick="this.closest('div[style]').remove()" style="flex:1;background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:12px;font-family:'Crimson Pro',serif;font-size:15px;color:var(--text2);cursor:pointer">Zrušit</button>
        <button onclick="saveFoodLog(this.closest('div[style]'))" style="flex:2;background:var(--accent);border:none;border-radius:12px;padding:12px;font-family:'Crimson Pro',serif;font-size:15px;color:#1a1a1a;font-weight:700;cursor:pointer">Přidat</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
};

window.aiEstimateFoodLog = async () => {
  const name = document.getElementById('fl-name').value.trim();
  if(!name) { toast('⚠️ Nejprve zadej název jídla'); return; }
  toast('✨ AI odhaduje kalorie…');
  try {
    const raw = await callClaude([
      {role:'system',content:'Odpovídej POUZE JSON. Bez markdown. Odhadni nutriční hodnoty pro 1 porci jídla. Formát: {"kcal":380,"protein":18,"carbs":62,"fat":8}'},
      {role:'user',content:'Jídlo: '+name}
    ], 100);
    if (!raw) throw new Error('AI není k dispozici');
    const txt = raw.replace(/```json|```/g,'').trim();
    const est = JSON.parse(txt);
    document.getElementById('fl-kcal').value = est.kcal||'';
    document.getElementById('fl-p').value = est.protein||'';
    document.getElementById('fl-c').value = est.carbs||'';
    document.getElementById('fl-f').value = est.fat||'';
    toast('✅ Kalorie odhadnuty!');
  } catch(e) { toast('❌ Nepodařilo se odhadnout: '+e.message); }
};

window.addFoodFromPlan = async (name, mealKey) => {
  toast('✨ AI odhaduje kalorie pro "'+name+'"…');
  try {
    const raw = await callClaude([
      {role:'system',content:'Odpovídej POUZE JSON. Bez markdown. Odhadni nutriční hodnoty pro 1 porci jídla. Formát: {"kcal":380,"protein":18,"carbs":62,"fat":8}'},
      {role:'user',content:'Jídlo: '+name}
    ], 100);
    if (!raw) throw new Error('AI není k dispozici');
    const txt = raw.replace(/```json|```/g,'').trim();
    const est = JSON.parse(txt);
    const today = new Date().toISOString().slice(0,10);
    const now = new Date().toTimeString().slice(0,5);
    const log = {name, kcal:est.kcal||0, protein:est.protein||0, carbs:est.carbs||0, fat:est.fat||0, date:today, time:now};
    const ref = await addDoc(collection(db,'users',CU.uid,'foodLogs'), log);
    foodLogs.push({id:ref.id,...log});
    document.querySelector('[style*="flex-end"]')?.remove();
    renderKcalToday();
    toast('✅ '+name+' přidáno ('+est.kcal+' kcal)');
  } catch(e) { toast('❌ Chyba: '+e.message); }
};

window.saveFoodLog = async (modalEl) => {
  const name = document.getElementById('fl-name').value.trim();
  if(!name) { toast('⚠️ Zadej název jídla'); return; }
  const today = new Date().toISOString().slice(0,10);
  const now = new Date().toTimeString().slice(0,5);
  const log = {
    name,
    kcal: parseInt(document.getElementById('fl-kcal').value)||0,
    protein: parseInt(document.getElementById('fl-p').value)||0,
    carbs: parseInt(document.getElementById('fl-c').value)||0,
    fat: parseInt(document.getElementById('fl-f').value)||0,
    date: today, time: now
  };
  const ref = await addDoc(collection(db,'users',CU.uid,'foodLogs'), log);
  foodLogs.push({id:ref.id,...log});
  modalEl.remove();
  renderKcalToday();
  toast('✅ Jídlo přidáno');
};

window.deleteFoodLog = async (id) => {
  await deleteDoc(doc(db,'users',CU.uid,'foodLogs',id));
  foodLogs = foodLogs.filter(l=>l.id!==id);
  renderKcalToday();
  toast('🗑️ Odebráno');
};


window.mealplanToShopping = async () => {
  if(!CU){ toast('Musíš být přihlášen'); return; }
  const isShared = !!(familyId && familyData?.shareMeal);
  const plan = isShared ? familyMealPlan : (prof.mealPlan || {});

  const mealNames = [];
  DAYS_CS.forEach((_,di) => {
    const dayData = plan['d'+di] || {};
    MEALS_CS.forEach((_,mi) => {
      const val = (dayData['m'+mi] || '').trim();
      if(val) mealNames.push(val);
    });
  });

  if(!mealNames.length){ toast('Jídelníček je prázdný — nejdřív vyplň jídla'); return; }

  const isSharedShop = isShopShared();
  const activeShopItems = isSharedShop ? familyShopItems : shopItems;

  let addedCount = 0;
  let foundRecipes = [];
  const alreadyAdded = new Set();

  for(const mealName of mealNames) {
    const recipe = savedRecipes.find(r =>
      r.name.toLowerCase() === mealName.toLowerCase() ||
      mealName.toLowerCase().includes(r.name.toLowerCase())
    );
    if(recipe && recipe.ingredients?.length && !foundRecipes.find(r=>r.id===recipe.id)) {
      foundRecipes.push(recipe);
      for(const ing of recipe.ingredients) {
        const key = ing.name.toLowerCase();
        if(alreadyAdded.has(key)) continue;
        const exists = activeShopItems.some(i => i.name.toLowerCase() === key);
        if(!exists) {
          const ref = isSharedShop
            ? collection(db,'families',familyId,'shopItems')
            : collection(db,'users',CU.uid,'shopItems');
          await addDoc(ref, {
            name: ing.name, qty: ing.qty||'',
            category: ing.category||'Ostatní',
            done: false, fromRecipe: recipe.name,
            createdAt: new Date().toISOString()
          });
          addedCount++;
          alreadyAdded.add(key);
        }
      }
    }
  }

  const withoutRecipe = mealNames.filter(m =>
    !savedRecipes.find(r =>
      r.name.toLowerCase() === m.toLowerCase() ||
      m.toLowerCase().includes(r.name.toLowerCase())
    )
  );

  if(addedCount > 0 || foundRecipes.length > 0) {
    let msg = `✅ Přidáno ${addedCount} ingrediencí z ${foundRecipes.length} receptu/ů.`;
    if(withoutRecipe.length) msg += ` (${withoutRecipe.length} jídel bez receptu)`;
    toast(msg);
    sp('shopping');
  } else if(withoutRecipe.length) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto';
    modal.innerHTML = `
      <div style="background:var(--card);border:1px solid var(--border);border-radius:18px;padding:22px;width:100%;max-width:340px">
        <div style="font-family:'Playfair Display',serif;font-size:18px;color:var(--accent);margin-bottom:10px;font-weight:700">🍳 Chybí uložené recepty</div>
        <div style="font-size:14px;color:var(--text2);margin-bottom:14px">Tato jídla nemají uložené ingredience:</div>
        ${withoutRecipe.map(m=>`<div style="padding:6px 10px;background:var(--card2);border-radius:8px;margin-bottom:6px;font-family:'Crimson Pro',serif;font-size:15px;color:var(--text)">• ${m}</div>`).join('')}
        <div style="font-size:13px;color:var(--text3);margin:12px 0 16px">Jdi do Vaření, vygeneruj recept a ulož ho — pak se ingredience přidají automaticky.</div>
        <button onclick="this.closest('[style]').remove()" style="width:100%;background:var(--accent);border:none;border-radius:10px;padding:11px;font-family:'Crimson Pro',serif;font-size:15px;color:#1a1a1a;font-weight:700;cursor:pointer">Rozumím</button>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
  } else {
    toast('Všechny ingredience už máš v nákupu ✅');
  }
};

window.openMealPicker = (dayKey, mealKey, dayLabel, mealLabel) => {
  const existing = document.getElementById('meal-picker-modal');
  if(existing) existing.remove();

  const recipes = savedRecipes || [];
  const recipesHTML = recipes.length
    ? recipes.map(r => `
        <div onclick="pickMeal('${esc(dayKey)}','${esc(mealKey)}','${esc(r.name)}',this)"
          style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:11px 14px;margin-bottom:6px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:border-color .2s"
          onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
          <span style="font-size:20px">🍽️</span>
          <div style="flex:1">
            <div style="font-family:'Crimson Pro',serif;font-size:15px;color:var(--text);font-weight:600">${r.name}</div>
            <div style="font-size:12px;color:var(--text3)">⏱ ${r.time||'?'} · 🍽 ${r.mealType||r.difficulty||'?'}</div>
          </div>
        </div>`).join('')
    : `<div style="text-align:center;padding:20px;color:var(--text3);font-size:14px">Zatím nemáš žádné uložené recepty.<br>Jdi do Vaření a ulož si oblíbené! 🔖</div>`;

  const modal = document.createElement('div');
  modal.id = 'meal-picker-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center;padding:0';
  modal.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:18px 18px 0 0;padding:22px;width:100%;max-width:480px;max-height:82vh;display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div style="font-family:'Playfair Display',serif;font-style:italic;font-size:19px;color:var(--accent);font-weight:700">📅 ${dayLabel} — ${mealLabel}</div>
        <button onclick="document.getElementById('meal-picker-modal').remove()" style="background:none;border:none;color:var(--text3);font-size:22px;cursor:pointer;line-height:1">×</button>
      </div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:14px">Vyber z oblíbených receptů nebo napiš ručně</div>

      <div style="overflow-y:auto;flex:1;margin-bottom:14px">
        ${recipesHTML}
      </div>

      <div style="border-top:1px solid var(--border);padding-top:14px">
        <div style="font-size:13px;color:var(--text2);font-weight:600;margin-bottom:8px">Nebo napiš ručně:</div>
        <div style="display:flex;gap:8px">
          <input id="meal-picker-manual" class="finp" placeholder="Název jídla…" style="flex:1;min-width:0"
            onkeydown="if(event.key==='Enter')pickMealManual('${dayKey}','${mealKey}')">
          <button onclick="pickMealManual('${dayKey}','${mealKey}')" class="btn-p" style="width:auto;padding:10px 16px">✅ Přidat</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
  setTimeout(() => document.getElementById('meal-picker-manual')?.focus(), 100);
};

window.pickMeal = async (dayKey, mealKey, name, el) => {
  await saveMealPlanItem(dayKey, mealKey, name);
  document.getElementById('meal-picker-modal')?.remove();
  renderMealPlan();
  toast(`✅ Přidáno: ${name}`);
};

window.pickMealManual = async (dayKey, mealKey) => {
  const val = document.getElementById('meal-picker-manual')?.value.trim();
  if(!val){ toast('Napiš název jídla'); return; }
  await saveMealPlanItem(dayKey, mealKey, val);
  document.getElementById('meal-picker-modal')?.remove();
  toast(`✅ Přidáno: ${val}`);
};

window.openAddToMealplan = () => {
  if(!lastRecipe){ toast('Nejprve nechej Rexe navrhnout recept'); return; }
  const existing = document.getElementById('add-to-mealplan-modal');
  if(existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'add-to-mealplan-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto';
  modal.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:18px;padding:22px;width:100%;max-width:340px;max-height:80vh;overflow-y:auto">
      <div style="font-family:'Playfair Display',serif;font-style:italic;font-size:19px;color:var(--accent);margin-bottom:4px;font-weight:700">📅 Přidat do jídelníčku</div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:16px">${lastRecipe.name}</div>
      <div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:8px">Vyber den:</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">
        ${DAYS_CS.map((d,i)=>`<button onclick="selectMealplanDay(${i},this)" style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:7px 12px;font-family:'Crimson Pro',serif;font-size:14px;color:var(--text2);cursor:pointer" data-day="${i}">${d}</button>`).join('')}
      </div>
      <div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:8px">Vyber jídlo:</div>
      <div style="display:flex;gap:8px;margin-bottom:20px">
        ${MEALS_CS.map((m,i)=>`<button onclick="selectMealplanMeal(${i},this)" style="flex:1;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:8px 6px;font-family:'Crimson Pro',serif;font-size:13px;color:var(--text2);cursor:pointer" data-meal="${i}">${m}</button>`).join('')}
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="document.getElementById('add-to-mealplan-modal').remove()" style="flex:1;background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:11px;font-family:'Crimson Pro',serif;font-size:15px;color:var(--text2);cursor:pointer">Zrušit</button>
        <button onclick="confirmAddToMealplan()" style="flex:2;background:var(--accent);border:none;border-radius:10px;padding:11px;font-family:'Crimson Pro',serif;font-size:15px;color:#1a1a1a;font-weight:700;cursor:pointer">✅ Přidat</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
};

let _mealplanSelDay = 0, _mealplanSelMeal = 1;
window.selectMealplanDay = (i, btn) => {
  _mealplanSelDay = i;
  document.querySelectorAll('#add-to-mealplan-modal [data-day]').forEach(b => b.style.borderColor = 'var(--border)');
  btn.style.borderColor = 'var(--accent)'; btn.style.color = 'var(--accent)';
};
window.selectMealplanMeal = (i, btn) => {
  _mealplanSelMeal = i;
  document.querySelectorAll('#add-to-mealplan-modal [data-meal]').forEach(b => b.style.borderColor = 'var(--border)');
  btn.style.borderColor = 'var(--accent)'; btn.style.color = 'var(--accent)';
};
window.confirmAddToMealplan = async () => {
  if(!lastRecipe) return;
  await saveMealPlanItem('d'+_mealplanSelDay, 'm'+_mealplanSelMeal, lastRecipe.name);
  document.getElementById('add-to-mealplan-modal')?.remove();
  renderMealPlan();
  toast(`✅ Přidáno do jídelníčku — ${DAYS_CS[_mealplanSelDay]}, ${MEALS_CS[_mealplanSelMeal]}`);
};

// ── STATISTIKY ────────────────────────────────────────
window.hdNavMonth = (hid, dir) => {
  if(!window._hdMonth) window._hdMonth = {};
  if(!window._hdMonth[hid]) {
    const n = new Date();
    window._hdMonth[hid] = {y: n.getFullYear(), m: n.getMonth()};
  }
  const cur = window._hdMonth[hid];
  let m = cur.m + dir, y = cur.y;
  if(m < 0) { m = 11; y--; }
  if(m > 11) { m = 0; y++; }
  // Nepusť do budoucnosti
  const now = new Date();
  if(y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth())) return;
  window._hdMonth[hid] = {y, m};
  // Znovu vyrenderuj detail
  const h = habits.find(x => x.id === hid);
  if(h) openHabitDetail(hid);
};


// ════════════════════════════════════════════════════════════
// ✅  CHECKLIST / ÚKOLNÍČEK
// ════════════════════════════════════════════════════════════
let checklists = [];
let activeChecklist = null;
let expandedCheckItemId = null;

function subChecklist() {
  if (!CU) return;
  // Migrate localStorage data to Firestore if exists
  const localData = lsGet('lp_checklists', []);
  if (localData.length) {
    localData.forEach(list => setDoc(doc(db,'users',CU.uid,'checklists',list.id), list));
    localStorage.removeItem('lp_checklists');
  }
  createFireSub('checklist',
    query(collection(db,'users',CU.uid,'checklists'), orderBy('createdAt','asc')),
    snap => {
      checklists = snap.docs.map(d => ({...d.data(), id: d.id}));
      if (!checklists.length) {
        const def = {id: genId(), name: 'Úkoly', items: [], shared: false, createdAt: Date.now()};
        setDoc(doc(db,'users',CU.uid,'checklists',def.id), def);
        return;
      }
      if (!activeChecklist || !checklists.find(c => c.id === activeChecklist)) activeChecklist = checklists[0].id;
      renderChecklist();
    }
  );
}

async function saveChecklistDoc(list) {
  if (!CU || !list) return;
  await setDoc(doc(db,'users',CU.uid,'checklists',list.id), list);
}


function renderChecklist() {
  const el = document.getElementById('checklist-content');
  if (!el) return;

  const list = checklists.find(c => c.id === activeChecklist) || checklists[0];
  if (!list) return;

  const done = list.items.filter(i => i.done).length;
  const total = list.items.length;
  // Splněné položky vždy na konec
  const sortedItems = [...list.items.filter(i => !i.done), ...list.items.filter(i => i.done)];

  el.innerHTML = `
    <div class="cl-tabs">
      ${checklists.map(c => `<button class="cl-tab ${c.id === activeChecklist ? 'active' : ''}" onclick="switchChecklist('${esc(c.id)}')">${esc(c.name)}</button>`).join('')}
      <button class="cl-tab cl-tab-add" onclick="addChecklist()">+</button>
    </div>
    <div class="cl-header">
      <div class="cl-title-row">
        <span class="cl-list-name">${esc(list.name)}</span>
        ${total > 0 ? `<span class="cl-progress">${done}/${total}</span>` : ''}
        ${familyId && familyData?.shareChecklist ? `<button onclick="toggleChecklistShare('${esc(list.id)}')" style="background:${list.shared?'rgba(76,217,100,.15)':'none'};border:1px solid ${list.shared?'var(--green)':'var(--border)'};border-radius:8px;padding:3px 9px;font-size:12px;color:${list.shared?'var(--green)':'var(--text3)'};cursor:pointer" title="${list.shared?'Přestat sdílet':'Sdílet s rodinou'}">${list.shared?'👨‍👩‍👧 Sdíleno':'👤 Soukromé'}</button>` : ''}
        ${checklists.length > 1 ? `<button onclick="deleteChecklist('${esc(list.id)}')" style="background:none;border:none;color:var(--text3);font-size:16px;cursor:pointer;padding:0 4px;line-height:1" title="Smazat tento seznam">🗑️</button>` : ''}
      </div>
      ${done > 0 ? `<button class="cl-clear-done" onclick="clearDoneChecklistItems()">Smazat splněné</button>` : ''}
    </div>
    <div class="cl-add-row">
      <div class="cl-inp-wrap">
        <input id="cl-new-inp" class="cl-new-inp" type="text" placeholder="Přidat úkol..." onkeydown="if(event.key==='Enter')addCheckItem()">
        <label class="cl-inp-photo-label" title="Přidat fotku">📷<input type="file" accept="image/*" style="display:none" onchange="handleClNewPhotoInput(this)"></label>
      </div>
      <button class="cl-add-btn" onclick="addCheckItem()">Přidat</button>
    </div>
    <div id="cl-new-photo-preview" style="display:none;margin-top:8px;position:relative"></div>
    <div class="cl-items">
      ${sortedItems.length ? sortedItems.map(item => {
        const isExpanded = expandedCheckItemId === item.id;
        return `
        <div class="cl-item ${item.done ? 'done' : ''} ${isExpanded ? 'cl-item-open' : ''}">
          <button class="cl-check" onclick="toggleCheckItem('${esc(item.id)}')">
            ${item.done ? '✓' : ''}
          </button>
          <div class="cl-item-body" style="flex:1;min-width:0">
            ${isExpanded ? `
              <textarea id="cl-edit-${esc(item.id)}" class="cl-item-edit-inp" rows="2" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();saveExpandedCheckItem('${esc(item.id)}')}">${esc(item.text)}</textarea>
              <div class="cl-item-edit-actions">
                <button class="cl-edit-save" onclick="saveExpandedCheckItem('${esc(item.id)}')">✓ Uložit</button>
                <button class="cl-edit-cancel" onclick="expandedCheckItemId=null;renderChecklist()">Zrušit</button>
                <button class="cl-edit-del" onclick="deleteCheckItem('${esc(item.id)}')">🗑 Smazat</button>
              </div>
            ` : `
              <span class="cl-item-text" onclick="expandCheckItem('${esc(item.id)}')">${esc(item.text)}</span>
            `}
            ${item.photo ? `<div class="cl-item-photo-wrap"><img src="${item.photo}" class="cl-item-photo" onclick="showClItemPhoto('${esc(item.id)}')"><button class="cl-item-photo-del" onclick="removeClItemPhoto('${esc(item.id)}')">×</button></div>` : ''}
          </div>
          ${!isExpanded ? `<button class="cl-item-photo-btn cl-always-show" onclick="triggerClItemPhoto('${esc(item.id)}')" title="Přidat fotku">📷</button>` : ''}
          ${!isExpanded ? `<button class="cl-item-del" onclick="deleteCheckItem('${esc(item.id)}')">×</button>` : ''}
        </div>`;
      }).join('') : '<div class="cl-empty">Žádné úkoly. Přidej první!</div>'}
    </div>
  `;
}

window.switchChecklist = function(id) {
  activeChecklist = id;
  renderChecklist();
};

let clNewPhoto = null;

window.handleClNewPhotoInput = async function(input) {
  const file = input.files[0]; if (!file) return;
  toast('📷 Zpracovávám…');
  try {
    clNewPhoto = await compressImage(file, 900, 0.75);
    const preview = document.getElementById('cl-new-photo-preview');
    if (preview) {
      preview.style.display = 'block';
      preview.innerHTML = `<img src="${clNewPhoto}" style="max-width:80px;max-height:60px;border-radius:8px;display:block"><button onclick="clNewPhoto=null;this.parentElement.style.display='none'" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.55);border:none;color:#fff;border-radius:50%;width:18px;height:18px;cursor:pointer;font-size:11px;line-height:18px;text-align:center;padding:0">×</button>`;
    }
  } catch(e) { toast('❌ Nepodařilo se načíst fotku'); }
  input.value = '';
};

window.addCheckItem = function() {
  const inp = document.getElementById('cl-new-inp');
  if (!inp || (!inp.value.trim() && !clNewPhoto)) return;
  const list = checklists.find(c => c.id === activeChecklist);
  if (!list) return;
  const item = {id: genId(), text: inp.value.trim(), done: false};
  if (clNewPhoto) { item.photo = clNewPhoto; clNewPhoto = null; }
  list.items.unshift(item);
  inp.value = '';
  saveChecklistDoc(list);
  renderChecklist();
  document.getElementById('cl-new-inp')?.focus();
};

window.toggleCheckItem = function(itemId) {
  const list = checklists.find(c => c.id === activeChecklist);
  if (!list) return;
  const item = list.items.find(i => i.id === itemId);
  if (item) { item.done = !item.done; }
  saveChecklistDoc(list);
  renderChecklist();
};

window.expandCheckItem = function(itemId) {
  expandedCheckItemId = expandedCheckItemId === itemId ? null : itemId;
  renderChecklist();
  if (expandedCheckItemId) {
    const ta = document.getElementById(`cl-edit-${itemId}`);
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }
};

window.saveExpandedCheckItem = function(itemId) {
  const ta = document.getElementById(`cl-edit-${itemId}`);
  if (!ta) return;
  const newText = ta.value.trim();
  if (!newText) return;
  const list = checklists.find(c => c.id === activeChecklist);
  if (!list) return;
  const item = list.items.find(i => i.id === itemId);
  if (item) item.text = newText;
  expandedCheckItemId = null;
  saveChecklistDoc(list);
  renderChecklist();
};

window.deleteCheckItem = function(itemId) {
  const list = checklists.find(c => c.id === activeChecklist);
  if (!list) return;
  list.items = list.items.filter(i => i.id !== itemId);
  saveChecklistDoc(list);
  renderChecklist();
};

// ── Checklist foto ────────────────────────────────────────
window.triggerClItemPhoto = function(itemId) {
  let inp = document.getElementById('cl-photo-input');
  if (!inp) {
    inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'cl-photo-input';
    inp.style.display = 'none'; document.body.appendChild(inp);
  }
  inp.onchange = async function() {
    const file = inp.files[0]; if (!file) return;
    toast('📷 Zpracovávám…');
    try {
      const photo = await compressImage(file, 900, 0.75);
      const list = checklists.find(c => c.id === activeChecklist);
      if (!list) return;
      const item = list.items.find(i => i.id === itemId);
      if (item) { item.photo = photo; saveChecklistDoc(list); renderChecklist(); }
    } catch(e) { toast('❌ Nepodařilo se načíst fotku'); }
    inp.value = '';
  };
  inp.click();
};
window.removeClItemPhoto = function(itemId) {
  const list = checklists.find(c => c.id === activeChecklist);
  if (!list) return;
  const item = list.items.find(i => i.id === itemId);
  if (item) { delete item.photo; saveChecklistDoc(list); renderChecklist(); }
};
window.showClItemPhoto = function(itemId) {
  const list = checklists.find(c => c.id === activeChecklist);
  const item = list?.items.find(i => i.id === itemId);
  if (!item?.photo) return;
  document.getElementById('app').insertAdjacentHTML('beforeend',
    `<div class="moverlay open" onclick="this.remove()" style="z-index:9999">
      <div class="modal" onclick="event.stopPropagation()" style="max-width:90vw;max-height:90vh;display:flex;flex-direction:column;align-items:center;gap:12px">
        <img src="${item.photo}" style="max-width:100%;max-height:70vh;border-radius:12px">
        <button class="btn-s" onclick="this.closest('.moverlay').remove()">Zavřít</button>
      </div>
    </div>`
  );
};
// ─────────────────────────────────────────────────────────

window.clearDoneChecklistItems = function() {
  const list = checklists.find(c => c.id === activeChecklist);
  if (!list) return;
  list.items = list.items.filter(i => !i.done);
  saveChecklistDoc(list);
  renderChecklist();
};

window.addChecklist = function() {
  const name = prompt('Název nového seznamu:');
  if (!name?.trim()) return;
  const newList = {id: genId(), name: name.trim(), items: [], shared: false, createdAt: Date.now()};
  activeChecklist = newList.id;
  saveChecklistDoc(newList);
};

window.deleteChecklist = async function(id) {
  if (checklists.length <= 1) return;
  const list = checklists.find(c => c.id === id);
  if (!confirm(`Smazat seznam "${list?.name}"? Tato akce je nevratná.`)) return;
  await deleteDoc(doc(db,'users',CU.uid,'checklists',id));
  activeChecklist = checklists.find(c => c.id !== id)?.id || null;
};


async function initApp(){
  // Init history state pro Android back button
  history.replaceState({type:'root'}, '');
  initWater();initFocus();subChecklist();loadTheme();buildNav();rDash();rAvPage();subGoals();subEvents();subHabits();subEntries();subShop();subHealthLogs();subSavedRecipes();loadPlannedMeals();initSet();subFoodLogs();ss('app');sp('dashboard');
  setTimeout(checkChangelog,1500);
  setTimeout(initNotifications,2000);setTimeout(rexProactiveGreeting,4000);setTimeout(checkInactivity,8000);
  // Zpracuj "Splněno" akce uložené SW když byla appka zavřená
  if ('serviceWorker' in navigator && 'caches' in window) {
    caches.open('lp-pending').then(c => c.match('pending-action')).then(r => {
      if (!r) return;
      r.json().then(msg => {
        if (msg?.type === 'HABIT_DONE_FROM_NOTIF' && typeof handleNotifHabitDone === 'function') {
          handleNotifHabitDone(msg);
        }
        caches.open('lp-pending').then(c => c.delete('pending-action'));
      }).catch(() => {});
    }).catch(() => {});
  }
  setTimeout(checkAutoWeeklyReport,10000); // první kontrola po spuštění
  setInterval(checkAutoWeeklyReport,3600000); // opakuj každou hodinu (v neděli spustí report)
  // Rodinná skupina
  if(prof.familyId){familyId=prof.familyId;subscribeFamily();}
}

function buildNav(){
  const av=AVS.find(a=>a.id===prof.avatarId)||AVS[0];
  const showRex=(prof.modules||[]).includes('rex');
  const fixed=showRex
    ?[{id:'dashboard',emoji:'🏠',label:'Domů'},{id:'avatar',emoji:av.emoji,label:av.name}]
    :[{id:'dashboard',emoji:'🏠',label:'Domů'}];
  const hasUI=['goals','journal','calendar','habits','cooking','shopping','mealplan','checklist'];
  const uMods=MODS.filter(m=>(prof.modules||[]).includes(m.id)&&hasUI.includes(m.id)).map(m=>({id:m.id,emoji:m.emoji,label:m.name}));
  const all=[...fixed,...uMods,{id:'settings',emoji:'🔧',label:'Nastavení'}];
  const hn=document.getElementById('hnav'); if(hn) hn.innerHTML=all.map(p=>`<button class="nbtn" id="nb-${p.id}" onclick="sp('${esc(p.id)}')"><span>${p.emoji}</span><span class="nl">${p.label}</span></button>`).join('');
  // Build bottom nav - 4 primary + More
  const primary=all.slice(0,4);
  const more=all.slice(4);
  const bni=document.getElementById('bottom-nav-inner');
  if(bni) bni.innerHTML=primary.map(p=>`<button class="bnbtn" id="bn-${p.id}" onclick="sp('${esc(p.id)}')"><span class="bn-em">${p.emoji}</span><span class="bn-lbl">${p.label}</span></button>`).join('')+(more.length?`<button class="bnbtn" id="bn-more" onclick="togBnMore()"><span class="bn-em">⋯</span><span class="bn-lbl">Více</span></button>`:'');
  const bmp=document.getElementById('bn-more-panel'); if(bmp) bmp.innerHTML=more.map(p=>`<div class="bn-more-item" id="bnm-${p.id}" onclick="sp('${esc(p.id)}');closeBnMore()"><div class="bn-more-em">${p.emoji}</div><div class="bn-more-lbl">${p.label}</div></div>`).join('');
}

window.togBnMore=()=>{
  document.getElementById('bn-more-panel')?.classList.toggle('open');
};
window.closeBnMore=()=>{
  document.getElementById('bn-more-panel')?.classList.remove('open');
};
document.addEventListener('click',e=>{
  const panel=document.getElementById('bn-more-panel');
  if(panel&&panel.classList.contains('open')&&!panel.contains(e.target)&&!e.target.closest('#bn-more'))
    panel.classList.remove('open');
});

window.sp=id=>{
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nbtn').forEach(b=>b.classList.remove('active'));
  const pg=document.getElementById('p-'+id);if(pg)pg.classList.add('active');
  const nb=document.getElementById('nb-'+id);if(nb)nb.classList.add('active');
  document.getElementById('abody').style.overflowY=id==='avatar'?'hidden':'auto';
  if(id==='settings'){initSet();rSetMods();loadNotifSettings();setTimeout(checkNotifStatus,100);renderCustomRemindersList();}
  if(id==='avatar'){rAvPage();if(!chatH.length)loadChatHistory();}
  if(id==='mealplan')renderMealPlan();
  if(id==='settings')renderFamilySettings();
  if(id==='calendar'){renderCal();}
  if(id==='habits')renderHabits();
  if(id==='journal'){renderEntryList();}
  if(id==='dashboard')rDash();
  if(id==='checklist')renderChecklist();
  if(id==='cooking')initPantry();
};

// ── Denní motivační citát ────────────────────────────────
const FALLBACK_QUOTES = [
  'Každý velký výsledek začíná rozhodnutím zkusit to znovu.',
  'Konzistence poráží motivaci — každý den, i malý krok.',
  'Nejsilnější verze tebe čeká na druhé straně pohodlí.',
  'Disciplína je most mezi cílem a výsledkem.',
  'Nezáleží na tom jak pomalu jdeš, dokud se nezastavíš.',
  'Úspěch není konečný, neúspěch není osudný — odvaha pokračovat rozhoduje.',
  'Co děláš každý den je důležitější než to, co děláš občas.',
  'Tvoje budoucí já ti poděkuje za dnešní rozhodnutí.',
  'Malé kroky každý den vedou k velkým změnám.',
  'Buď na sebe pyšný za každý den, kdy jsi to nevzdal.',
];

async function loadDailyQuote() {
  const today = new Date().toISOString().slice(0,10);
  const cached = lsGet('lp_daily_quote', null);
  if (cached?.date === today) return cached.text;

  // Pokus o AI citát
  try {
      const av = AVS.find(a => a.id === prof?.avatarId) || AVS[0];
      const text = await callClaude([
        {role:'system', content:`Jsi ${av.name}. Napiš JEDEN krátký motivační citát (max 15 slov). PRAVIDLO JAZYK: Piš VÝHRADNĚ česky. Žádná anglická, německá, čínská ani jiná cizí slova. Pouze citát, žádné uvozovky, žádné doplnění.`},
        {role:'user', content:'Dej mi dnešní motivační citát v češtině.'}
      ], 60);
      if (text) {
        lsSave('lp_daily_quote', {date: today, text});
        return text;
      }
    } catch(e) { /* fallback */ }

  // Fallback — lokální pool
  const fallback = FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
  lsSave('lp_daily_quote', {date: today, text: fallback});
  return fallback;
}

function rDash(){
  const av=AVS.find(a=>a.id===prof.avatarId)||AVS[0];
  const g=prof.gender==='f'?'f':'m';
  const gr=AVGREET[av.id]?.[g]?.(prof.prezdivka||prof.nickname)||`Vítej, ${prof.prezdivka||prof.nickname}!`;
  const h=new Date().getHours();
  const tg=h<12?'Dobré ráno':h<18?'Ahoj':'Dobrý večer';
  const dg=document.getElementById('d-greet'); if(dg) dg.innerHTML=`${tg}, <span style="color:var(--accent)">${prof.prezdivka||prof.nickname}</span>!`;
  const ddl=document.getElementById('d-date-lbl'); if(ddl) ddl.textContent=new Date().toLocaleDateString('cs-CZ',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const up=document.getElementById('upill');if(up){const uName=prof.prezdivka||prof.nickname||CU.displayName?.split(' ')[0]||CU.email?.split('@')[0]||'';const uPhoto=CU.photoURL;up.innerHTML=uPhoto?`<img src="${uPhoto}" style="width:24px;height:24px;border-radius:50%;object-fit:cover" onerror="this.outerHTML='<div style=\\'width:24px;height:24px;border-radius:50%;background:var(--accent);color:var(--tc);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center\\'>${uName.charAt(0).toUpperCase()}</div>'">`:`<div style="width:24px;height:24px;border-radius:50%;background:var(--accent);color:var(--tc);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center">${uName.charAt(0).toUpperCase()||'👤'}</div>`;up.innerHTML+=`<span style="font-size:13px;color:var(--text2)">${uName}</span>`;}
  const dem=document.getElementById('d-avem'); if(dem) dem.textContent=av.emoji;
  const dnm=document.getElementById('d-avnm'); if(dnm) dnm.textContent=av.name;
  // Dynamická Rex zpráva podle skutečného stavu
  const today_r=new Date().toISOString().slice(0,10);
  const h_r=new Date().getHours();
  const doneToday_r=habitLogs.filter(l=>l.date===today_r&&l.done).length;
  const totalHabits_r=habits.length;
  const nextEv=[...events].filter(e=>{
    const d=new Date(e.date+'T12:00:00'); const t=new Date(); t.setHours(0,0,0,0);
    return d>=t;
  }).sort((a,b)=>a.date.localeCompare(b.date))[0];
  
  const rnd = (arr) => arr[Math.floor(Math.random()*arr.length)];
  const nm = prof?.nickname || prof?.prezdivka || 'příteli';
  const evStr = nextEv ? ' Dnes tě čeká "' + nextEv.name + '".' : '';
  const remaining_r = totalHabits_r - doneToday_r;
  let dynamicMsg = gr;
  if(totalHabits_r===0){
    dynamicMsg = rnd([
      'Ahoj ' + nm + '! Přidej si první návyk a začneme pracovat na tvých cílech. 💪',
      'Vítej zpět, ' + nm + '! Co chceš dnes sledovat? Přidej si první návyk. 🎯',
      nm + ', první krok je nejdůležitější — přidej si návyk a jdeme na to! 🚀',
    ]);
  } else if(h_r<9){
    dynamicMsg = rnd([
      'Dobré ráno, ' + nm + '! Čeká tě ' + totalHabits_r + ' návyků.' + evStr + ' Pojď na to! ☀️',
      'Ráno, ' + nm + '! Nový den, nová šance. ' + totalHabits_r + ' návyků na tebe čeká. ☀️',
      'Vstaň a svět je tvůj, ' + nm + '! ' + totalHabits_r + ' návyků dnes. Začínáme? ☀️',
    ]);
  } else if(h_r>=21){
    if(doneToday_r===totalHabits_r && totalHabits_r>0){
      dynamicMsg = rnd([
        'Výborný den, ' + nm + '! Všechny návyky splněny ✅ — zasloužený odpočinek. 🌙',
        doneToday_r + '/' + totalHabits_r + ' — perfektní! Dneska sis to ' + nm + ' opravdu zasloužil' + (g==='f'?'a':'') + '. 🌙',
        'Den uzavřen na jedničku! ' + nm + ', jsi na správné cestě. 🌙',
      ]);
    } else {
      dynamicMsg = rnd([
        'Večer, ' + nm + '. Dnes ' + doneToday_r + '/' + totalHabits_r + ' návyků — zítra to vyjde! 🌙',
        nm + ', den se chýlí ke konci. ' + doneToday_r + ' z ' + totalHabits_r + ' — dobrá práce. 🌙',
        'Odpočívej, ' + nm + '. ' + doneToday_r + '/' + totalHabits_r + ' návyků — každý den se počítá. 🌙',
      ]);
    }
  } else if(doneToday_r===0){
    dynamicMsg = rnd([
      nm + ', dnes zatím žádný návyk — první krok je nejdůležitější! 🚀',
      'Pojď do toho, ' + nm + '! ' + totalHabits_r + ' návyků čeká.' + evStr + ' 💪',
      'Ještě nic nesplněno, ' + nm + ' — ale den ještě nekončí. Jdeme! 🔥',
    ]);
  } else if(doneToday_r>0 && doneToday_r<totalHabits_r){
    dynamicMsg = rnd([
      'Dobrý start, ' + nm + '! ' + doneToday_r + '/' + totalHabits_r + ' splněno — zbývá ' + remaining_r + '. 🔥',
      nm + ', jdeš dobře! ' + doneToday_r + ' splněno, ještě ' + remaining_r + ' před tebou.' + evStr + ' 💪',
      doneToday_r + ' z ' + totalHabits_r + ' — pokračuj, ' + nm + ', jsi na půl cesty! 🏃',
    ]);
  } else if(doneToday_r===totalHabits_r && totalHabits_r>0){
    dynamicMsg = rnd([
      'Dnešek patří tobě, ' + nm + '! Všechny návyky splněny ✅' + evStr + ' Perfektní den! 🎉',
      '100 %! ' + nm + ', dneska jsi to zvládl' + (g==='f'?'a':'') + ' na jedničku. 🎉',
      'Všechno hotovo, ' + nm + '! Takhle se to dělá. 🏆' + evStr,
    ]);
  }
  
  const dtx=document.getElementById('d-avtxt'); if(dtx) dtx.textContent=dynamicMsg;

  const today=new Date().toISOString().slice(0,10);
  const mods=prof.modules||[];
  // Focus widget always at top
  let html=focusWidgetHTML();
  // Quick Start karta pro nové uživatele
  html+=quickStartHTML();

  // Mini Rex energy widget
  const rexEn = getRexEnergy();
  const rexSt = getRexState(rexEn);
  html += `<div class="dw" onclick="sp('avatar')" style="cursor:pointer">
    <div class="dw-head">
      <div class="dw-title">${av.emoji||'⭐'} ${av.name||'Rex'}</div>
      <div class="dw-arrow">→</div>
    </div>
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:28px">${rexSt.emoji}</span>
      <div style="flex:1">
        <div style="font-size:13px;color:var(--text2);font-weight:600">${rexSt.label}${rexEn !== null ? ' · '+rexEn+'%' : ''}</div>
        <div style="background:var(--border);border-radius:20px;height:6px;margin-top:4px;overflow:hidden">
          <div style="width:${rexEn??0}%;height:100%;background:${rexSt.color};border-radius:20px;transition:width .5s"></div>
        </div>
      </div>
    </div>
  </div>`;

  // ── WIDGET: DENNÍ CITÁT ──
  const quoteToday = lsGet('lp_daily_quote', null);
  const quoteTodayStr = new Date().toISOString().slice(0,10);
  const quoteText = quoteToday?.date === quoteTodayStr ? quoteToday.text : null;
  html += `<div class="dw" id="dash-quote-widget">
    <div style="font-size:11px;color:var(--text3);font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">${av.name} říká</div>
    <div id="dash-quote-text" style="font-family:'Crimson Pro',serif;font-style:italic;font-size:16px;color:var(--text);line-height:1.5">${quoteText || '...'}</div>
  </div>`;
  if (!quoteText) {
    loadDailyQuote().then(t => {
      const el = document.getElementById('dash-quote-text');
      if (el) el.textContent = t;
    });
  }

  // ── WIDGET: NÁLADA (zobrazí se jen pokud ještě nebyla vybrána dnes) ──
  const dailyMoodData = lsGet('lp_daily_mood', null);
  const todayStr = new Date().toISOString().slice(0,10);
  const todayMood = dailyMoodData?.date === todayStr ? dailyMoodData.emoji : null;

  if (!todayMood) {
    html += `<div class="dw">
      <div class="dw-head">
        <div class="dw-title">💭 Jak se dnes cítíš?</div>
      </div>
      <div style="display:flex;justify-content:space-around;padding:4px 0">
        ${['😄','🙂','😐','😔','😤'].map(e =>
          `<button onclick="setDailyMood('${e}')" style="background:none;border:2px solid transparent;border-radius:10px;padding:6px 8px;font-size:24px;cursor:pointer;transition:all .15s">${e}</button>`
        ).join('')}
      </div>
    </div>`;
  }

  // ── WIDGET: NÁVYKY ──
  if(mods.includes('habits')&&habits.length){
    const doneTodayH=habitLogs.filter(l=>l.date===today&&l.done).length;
    const totalH=habits.length;
    const pct=Math.round(doneTodayH/totalH*100);
    const pctColor=pct===100?'var(--green)':pct>50?'var(--accent)':'var(--accent2)';
    const habRows=habits.slice(0,4).map(hb=>{
      const log=habitLogs.find(l=>l.habitId===hb.id&&l.date===today);
      const done=log?.done||false;
      const failed=log?.failed||false;
      const isCount=hb.type==='count';
      const val=isCount?(log?.value||0)+'/'+hb.goal:'';
      let streak=0;const sd=new Date(today+'T12:00:00');
      for(let i=0;i<30;i++){const ds=sd.toISOString().slice(0,10);if(habitLogs.some(l=>l.habitId===hb.id&&l.date===ds&&l.done))streak++;else break;sd.setDate(sd.getDate()-1);}
      return `<div class="dw-habit-row">
        <div class="dw-hcheck ${done?'done':failed?'failed':''}">${done?'✓':failed?'✕':''}</div>
        <div class="dw-hname">${hb.emoji} ${hb.name}</div>
        ${val?`<div class="dw-hval">${val}</div>`:''}
        ${streak>=30?`<div class="dw-hfire" style="color:var(--accent);font-weight:700">👑${streak}</div>`
         :streak>=7?`<div class="dw-hfire" style="color:var(--green);font-weight:700">🔥${streak}</div>`
         :streak>1?`<div class="dw-hfire">🔥${streak}</div>`:''}
      </div>`;
    }).join('');
    const more=habits.length>4?`<div style="font-size:12px;color:var(--text3);text-align:center;margin-top:6px">+ ${habits.length-4} dalších</div>`:'';
    html+=`<div class="dw" onclick="sp('habits')">
      <div class="dw-head">
        <div class="dw-title">🎯 Návyky dnes</div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:15px;font-weight:700;color:${pctColor}">${doneTodayH}/${totalH}</span>
          <div class="dw-arrow">→</div>
        </div>
      </div>
      ${habRows}${more}
      <div class="dw-pbar"><div class="dw-pbar-fill" style="width:${pct}%;background:${pctColor}"></div></div>
    </div>`;
  }

  // ── WIDGET: ZÁPISNÍK ──
  if(mods.includes('journal')){
    const todayEntries=entries.filter(e=>e.createdAt?.startsWith(today));
    const lastEntry=entries[0];
    const todayMood=todayEntries.find(e=>e.mood)?.mood||'';
    if(lastEntry){
      html+=`<div class="dw" onclick="sp('journal')">
        <div class="dw-head">
          <div class="dw-title">📝 Poznámky</div>
          <div class="dw-arrow">→</div>
        </div>
        <div class="dw-entry-title">${lastEntry.mood?`<span class="dw-entry-mood">${lastEntry.mood}</span>`:''}${lastEntry.title||'Bez názvu'}</div>
        ${lastEntry.text?`<div class="dw-entry-preview">${lastEntry.text.substring(0,120)}</div>`:''}
        <div class="dw-row" style="margin-top:8px">
          ${todayEntries.length?`<div class="dw-pill">Dnes <b>${todayEntries.length} zápisků</b></div>`:''}
          ${!todayEntries.length?`<div class="dw-pill" style="color:var(--text3)">Dnes jsi ještě nepsal</div>`:''}
          <div class="dw-pill">Celkem <b>${entries.length}</b></div>
        </div>
      </div>`;
    } else {
      html+=`<div class="dw" onclick="sp('journal')">
        <div class="dw-head"><div class="dw-title">📝 Poznámky</div><div class="dw-arrow">→</div></div>
        <div class="dw-empty">Zatím žádné zápisky. Napiš první!</div>
      </div>`;
    }
  }

  // ── WIDGET: CÍLE ──
  if(mods.includes('goals')&&goals.length){
    const avgProgress=Math.round(goals.reduce((s,g)=>s+(g.progress||0),0)/goals.length);
    const doneGoals=goals.filter(g=>g.progress>=100).length;
    const goalRows=goals.slice(0,3).map(g=>`
      <div class="dw-goal-row">
        <div class="dw-goal-top">
          <span style="font-size:14px;color:var(--text)">${g.emoji||'🌟'} ${g.name}</span>
          <span class="dw-goal-pct" style="color:${g.color||'var(--accent)'}">${g.progress||0}%</span>
        </div>
        <div class="dw-pbar"><div class="dw-pbar-fill" style="width:${g.progress||0}%;background:${g.color||'var(--accent)'}"></div></div>
      </div>`).join('');
    html+=`<div class="dw" onclick="sp('goals')">
      <div class="dw-head">
        <div class="dw-title">🌟 Moje cíle</div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:13px;color:var(--text2)">${doneGoals} splněno · ${avgProgress}% průměr</span>
          <div class="dw-arrow">→</div>
        </div>
      </div>
      ${goalRows}
    </div>`;
  }

  // ── WIDGET: KALENDÁŘ / UDÁLOSTI ──
  if(mods.includes('calendar')){
    const upcoming=typeof getUpcoming14==='function'?getUpcoming14():[];
    if(upcoming.length){
      const todayDate=new Date(); todayDate.setHours(0,0,0,0);
      const evRows=upcoming.slice(0,3).map(ev=>{
        const diff=Math.round((ev._date-todayDate)/86400000);
        const diffLbl=diff===0?'Dnes 🔥':diff===1?'Zítra':'Za '+diff+' dní';
        const isSoon=diff<=2;
        return `<div class="dw-ev-row">
          <div class="dw-ev-ico">${EV_ICONS[ev.type]||'📌'}</div>
          <div style="flex:1">
            <div class="dw-ev-name">${ev.name}</div>
            <div class="dw-ev-date">${ev._date.toLocaleDateString('cs-CZ',{weekday:'short',day:'numeric',month:'long'})}</div>
          </div>
          ${isSoon?`<span class="dw-ev-badge">${diffLbl}</span>`:`<span style="font-size:12px;color:var(--text3)">${diffLbl}</span>`}
        </div>`;
      }).join('');
      const more=upcoming.length>3?`<div style="font-size:12px;color:var(--text3);text-align:center;margin-top:6px">+ ${upcoming.length-3} dalších událostí</div>`:'';
      html+=`<div class="dw" onclick="sp('calendar')">
        <div class="dw-head">
          <div class="dw-title">📅 Nadcházející události</div>
          <div class="dw-arrow">→</div>
        </div>
        ${evRows}${more}
      </div>`;
    }
  }

  // ── WIDGET: VAŘENÍ ──
  if(mods.includes('cooking')){
    html+=`<div class="dw" onclick="sp('cooking')">
      <div class="dw-head"><div class="dw-title">🍽️ Vaření</div><div class="dw-arrow">→</div></div>
      <div class="dw-empty">Nech AI navrhnout recept na dnes!</div>
    </div>`;
  }

  // ── WIDGET: NÁKUPY ──
  if(mods.includes('shopping')){
    const shopItemsArr=typeof shopItems!=='undefined'?shopItems:[];
    const pending=shopItemsArr.filter(i=>!i.done);
    const done=shopItemsArr.filter(i=>i.done).length;
    if(shopItemsArr.length){
      const shopPct = shopItemsArr.length ? Math.round(done/shopItemsArr.length*100) : 0;
      const shopLabel = pending.length===0 ? '✅ Vše nakoupeno!' : `${pending.length} položek zbývá`;
      const firstItems = pending.slice(0,3).map(i=>i.name).join(', ');
      html+=`<div class="dw" onclick="sp('shopping')">
        <div class="dw-head">
          <div class="dw-title">🛒 Nákupní seznam</div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:13px;color:var(--text2)">${done}/${shopItemsArr.length} hotovo</span>
            <div class="dw-arrow">→</div>
          </div>
        </div>
        <div style="font-size:14px;color:var(--text2);margin-bottom:8px">${shopLabel}${firstItems ? ` · <span style="color:var(--text3)">${firstItems}${pending.length>3?'…':''}</span>` : ''}</div>
        <div class="dw-pbar"><div class="dw-pbar-fill" style="width:${shopPct}%;background:var(--green)"></div></div>
      </div>`;
    }
  }

  // ── WIDGET: NÁLADA (pokud aktivní) ──
  if(mods.includes('mood')){
    const todayMoodEntry=entries.filter(e=>e.createdAt?.startsWith(today)&&e.mood);
    const todayMoodVal=todayMoodEntry[0]?.mood||'';
    const weekMoods=[];
    for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const ds=d.toISOString().slice(0,10);const me=entries.filter(e=>e.createdAt?.startsWith(ds)&&e.mood);weekMoods.push(me[0]?.mood||'');}
    html+=`<div class="dw" onclick="sp('journal')">
      <div class="dw-head">
        <div class="dw-title">💭 Nálada</div>
        <div class="dw-arrow">→</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <div style="font-size:40px">${todayMoodVal||'😶'}</div>
        <div>
          <div style="font-size:13px;color:var(--text2);margin-bottom:6px">Posledních 7 dní</div>
          <div style="display:flex;gap:4px">${weekMoods.map(m=>`<span style="font-size:18px">${m||'·'}</span>`).join('')}</div>
        </div>
      </div>
    </div>`;
  }

  // ── WIDGET: TÝDENNÍ REPORT ──
  const weeklyData = localStorage.getItem('lp_weekly_report');
  if(weeklyData) {
    try {
      const wr = JSON.parse(weeklyData);
      const reportDate = new Date(wr.date);
      const daysDiff = Math.floor((new Date()-reportDate)/86400000);
      if(daysDiff <= 7) { // zobraz max 7 dní
        const dateLabel = reportDate.toLocaleDateString('cs-CZ',{weekday:'long',day:'numeric',month:'long'});
        const shortReport = wr.text.length > 120 ? wr.text.slice(0,120)+'…' : wr.text;
        html += `<div class="dw" style="cursor:default;background:linear-gradient(135deg,rgba(245,200,66,.07),rgba(224,149,74,.05));border-color:rgba(245,200,66,.25)">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:20px">${wr.avatar||'⭐'}</span>
            <span style="font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:var(--accent)">Týdenní report</span>
            <span style="font-size:12px;color:var(--text3);margin-left:auto">${dateLabel}</span>
          </div>
          <div id="wr-preview" style="font-size:14px;color:var(--text2);line-height:1.6;margin-top:8px">${shortReport}</div>
          <div id="wr-full" style="font-size:14px;color:var(--text2);line-height:1.6;margin-top:8px;display:none">${wr.text}</div>
          <button onclick="const p=document.getElementById('wr-preview'),f=document.getElementById('wr-full'),b=this;if(f.style.display==='none'){f.style.display='block';p.style.display='none';b.textContent='Skrýt ↑'}else{f.style.display='none';p.style.display='block';b.textContent='Zobrazit celý report →'}" style="margin-top:10px;background:none;border:1px solid var(--border);border-radius:8px;padding:5px 14px;font-size:13px;color:var(--text3);cursor:pointer;font-family:'Crimson Pro',serif">${wr.text.length>120?'Zobrazit celý report →':'Otevřít chat →'}</button>
        </div>`;
      }
    } catch(e) { /* ignoruj */ }
  }

  // ── WIDGET: STREAKY ──
  if(mods.includes('habits') && habits.length) {
    const streakHabits = habits.map(h => {
      let streak = 0;
      const d = new Date();
      while(streak < 365) {
        const ds = d.toISOString().slice(0,10);
        const log = habitLogs.find(l => l.id===`${h.id}_${ds}` && l.done);
        if(!log) break;
        streak++;
        d.setDate(d.getDate()-1);
      }
      return {...h, streak};
    }).filter(h => h.streak >= 2).sort((a,b) => b.streak - a.streak).slice(0,4);

    if(streakHabits.length) {
      html += `<div class="dw" style="cursor:default">
        <div style="font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:var(--text);margin-bottom:12px">🔥 Aktivní streaky</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${streakHabits.map(h=>`
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:20px">${h.emoji||'⭐'}</span>
              <span style="flex:1;font-size:15px;color:var(--text)">${h.name}</span>
              <span style="background:rgba(255,140,0,.15);border:1px solid rgba(255,140,0,.3);border-radius:20px;padding:3px 10px;font-size:13px;font-weight:700;color:#ff8c00">🔥 ${h.streak} dní</span>
            </div>`).join('')}
        </div>
      </div>`;
    }
  }

  // ── Pokud žádné moduly (bez focus widgetu) — ukáž nápovědu ──
  if(!mods.length){
    html+=`<div class="dw" style="text-align:center;cursor:default">
      <div style="font-size:32px;margin-bottom:8px">📱</div>
      <div style="font-size:15px;color:var(--text2)">Zapni si moduly v <b style="color:var(--accent)">Nastavení</b></div>
    </div>`;
  }

  // Water widget always at bottom
  html += waterWidgetHTML();

  const dw=document.getElementById('d-widgets'); if(dw) dw.innerHTML=html;
}
window.selMood=em=>{
  mood=em;
  const today = new Date().toISOString().slice(0,10);
  lsSave('lp_daily_mood', {emoji:em, date:today});
  rAvPage();
  toast(`Nálada ${em} zaznamenána`);
};

window.setDailyMood = function(emoji) {
  const today = new Date().toISOString().slice(0,10);
  lsSave('lp_daily_mood', {emoji, date: today});
  mood = emoji;
  rAvPage();
  rDash();
  const av = AVS.find(a => a.id === prof?.avatarId) || AVS[0];
  const reactions = {
    '😄': `Super den! ${av.name} se raduje s tebou! 🎉`,
    '🙂': `Příjemný den! ${av.name} je tu pro tebe.`,
    '😐': `Průměrný den? ${av.name} věří, že se to zlepší.`,
    '😔': `${av.name} cítí, že to není lehký den. Drž se! 💙`,
    '😤': `Frustrující den? ${av.name} ti fandí 💪`,
  };
  toast(reactions[emoji] || `Nálada ${emoji} zaznamenána`);
};

window.openVM=()=>{document.getElementById('vi-inp').value=prof.vision||'';om('m-vision');};
window.saveV=async()=>{
  if(!CU)return;const v=document.getElementById('vi-inp').value.trim();prof.vision=v;await setDoc(doc(db,'users',CU.uid,'profile','main'),prof);const el=document.getElementById('vtxt');if(v){el.textContent=v;el.classList.remove('empty');}else{el.textContent='Klikni a napiš svoji velkou životní vizi…';el.classList.add('empty');}cm('m-vision');toast('✓ Vize uložena');};
function loadV(){const el=document.getElementById('vtxt');if(prof.vision){el.textContent=prof.vision;el.classList.remove('empty');}}

function subGoals(){loadV();if(unsub)unsub();unsub=onSnapshot(query(collection(db,'users',CU.uid,'goals'),orderBy('createdAt','asc')),async snap=>{goals=snap.docs.map(d=>({id:d.id,...d.data()}));for(const g of goals){if(!subs[g.id]){const ss2=await getDocs(collection(db,'users',CU.uid,'goals',g.id,'subgoals'));subs[g.id]=ss2.docs.map(d=>({id:d.id,...d.data()}));}}rGoals();rAvPage();rDash();});}

window.openGM=(gid=null)=>{
  editGId=gid;document.getElementById('gm-title').textContent=gid?'✏️ Upravit cíl':'🌟 Nový cíl';
  if(gid){const g=goals.find(x=>x.id===gid);document.getElementById('g-name').value=g.name||'';document.getElementById('g-cat').value=g.category||'zdraví';document.getElementById('g-dl').value=g.deadline||'';document.getElementById('g-prog').value=g.progress||0;document.getElementById('g-pval').textContent=(g.progress||0)+'%';sGE(g.emoji||'🌟',null);sGC(g.color||'#f5c842',null);}
  else{document.getElementById('g-name').value='';document.getElementById('g-cat').value='zdraví';document.getElementById('g-dl').value='';document.getElementById('g-prog').value=0;document.getElementById('g-pval').textContent='0%';sGE('🌟',null);sGC('#f5c842',null);}
  om('m-goal');
};
window.sGE=(e,b)=>{gEm=e;document.querySelectorAll('#g-epick .epbtn').forEach(x=>x.classList.remove('sel'));const t=b||document.querySelector(`#g-epick [data-e="${e}"]`);if(t)t.classList.add('sel');};
window.sGC=(c,b)=>{gCol=c;document.querySelectorAll('#g-cpick .cpbtn').forEach(x=>x.classList.remove('sel'));const t=b||document.querySelector(`#g-cpick [data-c="${c}"]`);if(t)t.classList.add('sel');};
window.saveG=async()=>{
  const nm=document.getElementById('g-name').value.trim();if(!nm){toast('⚠️ Zadej název');return;}
  const d={name:nm,category:document.getElementById('g-cat').value,deadline:document.getElementById('g-dl').value,progress:parseInt(document.getElementById('g-prog').value)||0,emoji:gEm,color:gCol,updatedAt:new Date().toISOString()};
  if(editGId){await updateDoc(doc(db,'users',CU.uid,'goals',editGId),d);toast('✓ Cíl upraven');}
  else{d.createdAt=new Date().toISOString();const r=await addDoc(collection(db,'users',CU.uid,'goals'),d);subs[r.id]=[];toast('✓ Cíl přidán');}
  cm('m-goal');
};
window.delG=async id=>{if(!CU||!confirm('Smazat cíl?'))return;await deleteDoc(doc(db,'users',CU.uid,'goals',id));delete subs[id];toast('Cíl smazán');};
window.togSubs=gid=>document.getElementById('gs-'+gid)?.classList.toggle('open');
window.addSub=async gid=>{const inp=document.getElementById('si-'+gid),nm=inp.value.trim();if(!nm)return;const d={name:nm,done:false,createdAt:new Date().toISOString()};const r=await addDoc(collection(db,'users',CU.uid,'goals',gid,'subgoals'),d);if(!subs[gid])subs[gid]=[];subs[gid].push({id:r.id,...d});inp.value='';rGoals();toast('✓ Dílčí cíl přidán');};
window.togSub=async(gid,sid)=>{
  if(!CU)return;const s=subs[gid]?.find(x=>x.id===sid);if(!s)return;s.done=!s.done;await updateDoc(doc(db,'users',CU.uid,'goals',gid,'subgoals',sid),{done:s.done});const arr=subs[gid]||[];if(arr.length>0){const pct=Math.round(arr.filter(x=>x.done).length/arr.length*100);await updateDoc(doc(db,'users',CU.uid,'goals',gid),{progress:pct});}rGoals();};
window.delSub=async(gid,sid)=>{
  if(!CU)return;await deleteDoc(doc(db,'users',CU.uid,'goals',gid,'subgoals',sid));subs[gid]=subs[gid]?.filter(x=>x.id!==sid)||[];rGoals();};
function rGoals(){
  const c=document.getElementById('goals-list');
  if(!goals.length){const av=AVS.find(a=>a.id===prof.avatarId)||AVS[0];c.innerHTML=`<div class="empty-st"><div style="font-size:52px">${av.emoji}</div><div style="font-family:'Playfair Display',serif;font-style:italic;font-size:20px;color:var(--accent);margin-top:10px">Jaký je tvůj velký sen?</div><div style="font-size:15px;color:var(--text2);margin-top:8px;max-width:280px;line-height:1.5">Cíle ti pomáhají dávat návykům smysl. Přidej svůj první cíl!</div><button class="btn-p" style="margin-top:16px;width:auto;padding:10px 22px" onclick="om('m-goal')">🌟 Přidat první cíl</button></div>`;return;}
  const open=new Set([...document.querySelectorAll('.gsubs.open')].map(el=>el.id.replace('gs-','')));
  c.innerHTML=goals.map(g=>{
    const sb=subs[g.id]||[],io=open.has(g.id),sd=sb.filter(s=>s.done).length;
    return`<div class="gcard"><div class="ghdr" onclick="togSubs('${esc(g.id)}')"><div class="gdot" style="background:${g.color||'#f5c842'}"></div><div class="gem">${g.emoji||'🌟'}</div><div class="ginf"><div class="gnm">${g.name}</div><div class="gmeta"><span class="gtag">📂 ${g.category||'ostatní'}</span>${g.deadline?`<span class="gtag">${fd(g.deadline)}</span>`:''}${sb.length?`<span class="gtag">✓ ${sd}/${sb.length}</span>`:''}</div></div><div class="gpw"><div class="gpct" style="color:${g.color||'#f5c842'}">${g.progress||0}%</div><div class="gpbar"><div class="gpfill" style="width:${g.progress||0}%;background:${g.color||'#f5c842'}"></div></div></div><div class="gacts" onclick="event.stopPropagation()"><button class="btn-xs" onclick="openGM('${esc(g.id)}')">✏️</button><button class="btn-xs" onclick="delG('${esc(g.id)}')">🗑️</button></div></div><div class="gsubs ${io?'open':''}" id="gs-${g.id}">${sb.map(s=>`<div class="si"><div class="schk ${s.done?'done':''}" onclick="togSub('${esc(g.id)}','${esc(s.id)}')">${s.done?'✓':''}</div><div class="snm ${s.done?'done':''}">${s.name}</div><button class="btn-xs" onclick="delSub('${esc(g.id)}','${esc(s.id)}')">×</button></div>`).join('')}<div class="sarow"><input class="sainp" id="si-${g.id}" placeholder="Přidat dílčí cíl…" onkeydown="if(event.key==='Enter')addSub('${esc(g.id)}')"><button class="btn-ads" onclick="addSub('${esc(g.id)}')">+ Přidat</button></div></div></div>`;
  }).join('');
}

// SETTINGS
function initSet(){
  document.getElementById('set-nick').value=prof.nickname||'';
  const av=AVS.find(a=>a.id===prof.avatarId)||AVS[0];
  document.getElementById('set-avem').textContent=av.emoji;
  document.getElementById('set-avnm').textContent=av.name;
  document.getElementById('set-avsub').textContent=prof.nickname||'';
}
function rSetMods(){
  document.getElementById('set-mods').innerHTML=MODS.map(m=>`<div class="togrow"><div class="toginf"><div class="tognm">${m.emoji} ${m.name}</div><div class="togds">${m.desc}</div></div><label class="togswitch"><input type="checkbox" ${(prof.modules||[]).includes(m.id)?'checked':''} onchange="togModSet('${m.id}',this.checked)"><span class="togsl"></span></label></div>`).join('');
}
window.togModSet=async(id,on)=>{const ms=new Set(prof.modules||[]);on?ms.add(id):ms.delete(id);prof.modules=[...ms];await setDoc(doc(db,'users',CU.uid,'profile','main'),prof);buildNav();rDash();toast(on?`✓ ${id} zapnut`:`${id} vypnut`);};
window.saveNick=async()=>{const v=document.getElementById('set-nick').value.trim();if(!v){toast('⚠️ Zadej jméno');return;}prof.nickname=v;await setDoc(doc(db,'users',CU.uid,'profile','main'),prof);rDash();initSet();toast('✓ Jméno uloženo');};
window.saveKcalGoal=async()=>{const v=parseInt(document.getElementById('set-kcalgoal').value);if(!v||v<500||v>9999){toast('⚠️ Zadej cíl 500–9999 kcal');return;}prof.kcalGoal=v;await setDoc(doc(db,'users',CU.uid,'profile','main'),prof);toast('✓ Kalorický cíl uložen');renderMealPlan();};
window.openAVC=()=>{tmpAv=prof.avatarId||'rex';rAvGrid('av-change-grid',true);om('m-avchange');};
window.saveAVC=async()=>{if(!tmpAv)return;prof.avatarId=tmpAv;await setDoc(doc(db,'users',CU.uid,'profile','main'),prof);buildNav();rDash();rAvPage();initSet();cm('m-avchange');toast('✓ Společník změněn');};

// VOICE — chat mic
window.togMic=()=>{
  if(!('webkitSpeechRecognition'in window||'SpeechRecognition'in window)){
    toast('❌ Hlasový vstup vyžaduje Chrome nebo Safari');return;
  }
  if(micOn){micRec?.stop();micOn=false;return;}
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  micRec=new SR();
  micRec.lang='cs-CZ';
  micRec.continuous=false;
  micRec.interimResults=true;
  micRec.maxAlternatives=1;
  const ta=document.getElementById('c-inp');
  let transcript='';
  let sent=false;
  micRec.onresult=e=>{
    transcript='';
    let interim='';
    for(let i=0;i<e.results.length;i++){
      if(e.results[i].isFinal)transcript+=e.results[i][0].transcript;
      else interim+=e.results[i][0].transcript;
    }
    ta.value=transcript+interim;
    ar(ta);
  };
  micRec.onstart=()=>{
    micOn=true;sent=false;transcript='';
    const b=document.getElementById('mic-btn');
    if(b){b.classList.add('rec');b.textContent='⏹';}
    toast('🎤 Poslouchám…');
  };
  micRec.onend=()=>{
    micOn=false;
    const b=document.getElementById('mic-btn');
    if(b){b.classList.remove('rec');b.textContent='🎤';}
    if(transcript.trim()&&!sent){sent=true;setTimeout(()=>send(),400);}
  };
  micRec.onerror=e=>{
    micOn=false;
    const b=document.getElementById('mic-btn');
    if(b){b.classList.remove('rec');b.textContent='🎤';}
    if(e.error==='not-allowed')toast('❌ Povol mikrofon v nastavení prohlížeče');
    else if(e.error!=='no-speech')toast('❌ Mikrofon: '+e.error);
  };
  try{micRec.start();}catch(err){toast('❌ Nelze spustit mikrofon: '+err.message);}
};

// DAY SUMMARY
window.togDS=()=>{
  if(!('webkitSpeechRecognition'in window||'SpeechRecognition'in window)){toast('❌ Vyžaduje Chrome');return;}
  if(dsOn){stopDS();return;}
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  dsRec=new SR();dsRec.lang='cs-CZ';dsRec.continuous=true;dsRec.interimResults=true;
      let fin='';let finished=false;
      dsRec.onresult=e=>{let int='';for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)fin+=e.results[i][0].transcript+' ';else int=e.results[i][0].transcript;}document.getElementById('vrec-txt').textContent='Poslouchám… '+(fin+int).slice(-60);}
      dsRec.onstart=()=>{dsOn=true;document.getElementById('dsBtn').classList.add('rec');document.getElementById('dsBtn').textContent='⏹ Nahrávám…';document.getElementById('vrec-banner').classList.add('active');};
      dsRec.onend=()=>{if(dsOn&&fin.trim()&&!finished){finished=true;dsOn=false;finishDS(fin.trim());}else if(dsOn&&!fin.trim()){dsRec.start();}};
      dsRec.onerror=e=>{toast('❌ Chyba mikrofonu: '+e.error);stopDS();};
      dsRec.start();
};
window.stopDS=()=>{dsOn=false;dsRec?.stop();document.getElementById('dsBtn').classList.remove('rec');document.getElementById('dsBtn').textContent='🎤 Nahrát přehled dne';document.getElementById('vrec-banner').classList.remove('active');};

async function finishDS(text){
  stopDS();
  document.getElementById('cwelcome')?.remove();
  appendMsg('user','🎙️ '+text);
  saveChatMessage('user',text);
  const av=AVS.find(a=>a.id===prof.avatarId)||AVS[0];
  document.getElementById('typing').classList.add('active');scrollChat();
  const today=new Date().toISOString().slice(0,10);
  const gCtx=goals.length ? goals.map(g=>`- ${g.emoji} ${g.name} (${g.progress||0}%)`).join('\n') : 'Žádné';
  const todayHabits=habits.map(h=>{
    const log=habitLogs.find(l=>l.habitId===h.id&&l.date===today);
    return `- ${log?.done?'✅':'⬜'} ${h.emoji} ${h.name}${h.type==='count'?' ('+(log?.value||0)+'/'+h.goal+')':''}`;
  }).join('\n');
  const sys=`Jsi ${av.name}, osobní AI společník uživatele ${prof.prezdivka||prof.nickname}.
Mluvíš česky, přátelsky, stručně (max 5 vět).
Vize: "${prof.vision||'nezadána'}"

CÍLE: ${gCtx}
DNEŠNÍ NÁVYKY: ${todayHabits||'Žádné'}

Uživatel ti řekl přehled svého dne. Tvůj úkol:
1. Pochval konkrétně co zvládl
2. Propoj to s jeho návyky a cíli — vidíš které splnil/nesplnil
3. Krátce povzbuď na zbytek dne nebo večer
4. Max 4-5 vět, buď osobní a konkrétní.`;
  try{
    const rep=await callClaude([{role:'system',content:sys},{role:'user',content:'Přehled mého dne: '+text}],500);
    if(!rep)throw new Error('AI není k dispozici — klíč bude nastaven brzy');
    saveChatMessage('assistant',rep);
    appendMsg('bot',rep,av.name,av.emoji);
    appendMsg('sys','📝 Aktivita zaznamenaná. Chceš ji přidat do cílů?');
  }catch(e){appendMsg('bot','❌ '+e.message,'Chyba','⚠️');}
  document.getElementById('typing').classList.remove('active');scrollChat();
}

// CHAT SEND
window.askC=t=>{document.getElementById('c-inp').value=t;send();};
window.ck=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}};
window.ar=el=>{el.style.height='auto';el.style.height=Math.min(el.scrollHeight,130)+'px';};
window.send=async()=>{
  const inp=document.getElementById('c-inp'),t=inp.value.trim();if(!t)return;
  document.getElementById('cwelcome')?.remove();
  inp.value='';inp.style.height='auto';
  appendMsg('user',t);saveChatMessage('user',t);
  document.getElementById('send-btn').disabled=true;document.getElementById('typing').classList.add('active');scrollChat();
  const av=AVS.find(a=>a.id===prof.avatarId)||AVS[0];
  const today=new Date().toISOString().slice(0,10);

  // ── Kontext: Cíle ──
  const gCtx=goals.length
    ? goals.map(g=>`- ${g.emoji} ${g.name} (${g.progress||0}%, ${g.category}${g.deadline?', do '+g.deadline:''})`).join('\n')
    : 'Žádné cíle';

  // ── Kontext: Návyky + dnešní plnění ──
  const habitCtxFull = habits.length ? habits.map(h=>{
    const todayLog = habitLogs.find(l=>l.habitId===h.id&&l.date===today);
    const done = todayLog?.done ? '✅' : '⬜';
    const val = h.type==='count' ? (todayLog?.value||0)+'/'+h.goal : '';
    // Streak
    let streak=0;
    const sd=new Date(today);
    for(let i=0;i<30;i++){
      const ds=sd.toISOString().slice(0,10);
      if(habitLogs.some(l=>l.habitId===h.id&&l.date===ds&&l.done)) streak++;
      else break;
      sd.setDate(sd.getDate()-1);
    }
    return `- ${done} ${h.emoji} ${h.name}${val?' ('+val+')':''} | streak: ${streak} dní`;
  }).join('\n') : 'Žádné návyky';

  // ── Kontext: Poslední zápisky (5) ──
  const recentEntries = entries.slice(0,5).map(e=>
    `[${e.createdAt?.slice(0,10)||'?'}] ${e.mood||''} "${e.title}": ${(e.text||'').substring(0,150)}`
  ).join('\n');

  // ── Kontext: Checklist ──
  const activeClList = checklists.find(c => c.id === activeChecklist) || checklists[0];
  const clCtx = activeClList?.items?.length
    ? activeClList.items.map(i => `- [${i.done?'✓':'○'}] ${i.text}`).join('\n')
    : 'Prázdný';

  // ── Kontext: Nákupy ──
  const shopCtx = shopItems.filter(i=>!i.done).slice(0,10)
    .map(i=>`- ${i.name}${i.qty?' ('+i.qty+')':''}${i.fromRecipe?' ['+i.fromRecipe+']':''}`).join('\n');

  // ── Kontext: Nadcházející události ──
  const today2=new Date(); today2.setHours(0,0,0,0);
  const future2=new Date(today2); future2.setDate(future2.getDate()+14);
  const allEvCtx = events.map(e=>({name:e.name, date:e.date, source:'LifePocket'}))
  .filter(e=>{
    const d=new Date(e.date+'T12:00:00');
    return d>=today2 && d<=future2;
  }).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,10);
  const evCtx = allEvCtx.length ? allEvCtx.map(e=>`- ${e.date} ${e.name}`).join('\n') : 'Žádné';

  // ── Kontext: Dnešní datum a den v týdnu ──
  const todayLabel = new Date().toLocaleDateString('cs-CZ',{weekday:'long',day:'numeric',month:'long'});

  const memorySec = chatMemorySummary ? `\nPAMĚŤ (souhrn předchozích konverzací):\n${chatMemorySummary}\n` : '';
  const sys=`Jsi ${av.name}, osobní AI společník uživatele ${prof.prezdivka||prof.nickname} v aplikaci LifePocket.
Mluvíš česky, přátelsky a stručně (max 4-5 vět). Znáš uživatelův celý kontext — jeho cíle, návyky, zápisky i plány.
Odpovídej jako skutečný osobní asistent který zná člověka dobře.
${memorySec}

Dnes: ${todayLabel}
Vize uživatele: "${prof.vision||'zatím nezadána'}"

CÍLE:
${gCtx}

NÁVYKY (dnešní stav):
${habitCtxFull}

POSLEDNÍCH 5 ZÁPISKŮ:
${recentEntries||'Žádné zápisky'}

CHECKLIST (${activeClList?.name||'Úkoly'}):
${clCtx}

NÁKUPNÍ SEZNAM (nesplněné):
${shopCtx||'Prázdný'}

NADCHÁZEJÍCÍ UDÁLOSTI:
${evCtx||'Žádné'}

PRAVIDLO JÍDLO: Nikdy sám od sebe nezmiňuj jídlo, recepty ani vaření — ani v textu, ani jako návrh. Jídlo řeš VÝHRADNĚ když tě uživatel přímo a explicitně požádá ("co mám uvařit?", "navrhni recept", "co k večeři?"). Tag [FOOD:název] přidej NA KONEC odpovědi POUZE v těchto případech. Ve všech ostatních situacích (motivace, návyky, nálada, den, práce, cíle, povídání) jídlo VŮBEC nezmiňuj.
Pokud uživatel potřebuje motivaci nebo se ptá jak se daří, komentuj konkrétně jeho návyky a streak.

PRAVIDLO JAZYK: Piš VÝHRADNĚ česky. Každé slovo v receptu — název, ingredience, kroky i tip — musí být česky. ZAKÁZÁNO použít jakékoliv cizí slovo, včetně anglických, japonských, ruských (cyrilice) nebo arabských výrazů. Cizí jídla popiš česky (např. "noky" ne "gnocchi", "smaženice" ne "scrambled eggs").`;
  try{
    let rep=await callClaude([{role:'system',content:sys},...chatH.slice(-10)],600);
    if(!rep)throw new Error('AI není k dispozici — klíč bude nastaven brzy');
    const foodMatch=rep.match(/\[FOOD:([^\]]+)\]/);
    rep=rep.replace(/\[FOOD:[^\]]+\]/g,'').trim();
    saveChatMessage('assistant',rep);
    appendMsg('bot',rep,av.name,av.emoji);
    if(foodMatch){
      const food=foodMatch[1].trim();
      const c=document.getElementById('chatmsgs');
      const btns=document.createElement('div');
      btns.style.cssText='display:flex;gap:8px;flex-wrap:wrap;padding:4px 0 8px 0;';
      const esc2=food.replace(/'/g,"\\'");
      btns.innerHTML=`<button onclick="rexRecipe('${esc2}',this.parentElement)" style="background:rgba(224,149,74,.15);border:1px solid rgba(224,149,74,.4);border-radius:10px;padding:10px 18px;color:var(--accent2);font-family:'Crimson Pro',serif;font-size:15px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:6px;">🍳 Navrhnout recept na <b>${food}</b></button>`;
      c.appendChild(btns);scrollChat();
    }
  }catch(e){appendMsg('bot','❌ '+e.message,'Chyba','⚠️');}
  document.getElementById('send-btn').disabled=false;document.getElementById('typing').classList.remove('active');scrollChat();
};
window.rexRecipe=async(food,btnEl)=>{
  btnEl?.remove();
  // Zobraz loading v chatu
  const c=document.getElementById('chatmsgs');
  const {row:loadingRow,bubble:loading}=makeBotBubble('<div style="color:var(--text3);font-style:italic">Připravuji recept, chvilku strpení…</div>','🍳','Vařím recept…');
  c.appendChild(loadingRow);scrollChat();
  const sys=`Jsi kuchařský asistent. Odpovídej POUZE v JSON formátu, bez markdown, bez backticks.
Vrať JSON objekt:
{"name":"Název jídla","time":"30 minut","mealType":"Oběd","portions":4,"ingredients":[{"name":"Ingredience","qty":"200 g","category":"Maso & ryby"}],"steps":["Krok 1..."],"tip":"Tip..."}
Kategorie: "Zelenina & ovoce","Maso & ryby","Mléčné výrobky","Pečivo","Trvanlivé","Ostatní"
PRAVIDLO JEDNOTKY: V poli "qty" používej VÝHRADNĚ tyto jednotky: ks, g, kg, ml, l. Příklady: "200 g", "1 ks", "0.5 l", "150 ml", "0.25 kg". NIKDY nepoužívej: lžíce, hrnek, dcl, stroužky, špetka, svazek ani jiné nestandardní jednotky — převeď je na standardní (1 lžíce = 15 ml, 1 hrnek = 250 ml, 1 stroužek česneku = 1 ks, 1 špetka = 2 g).
PRAVIDLO JAZYK: Piš VÝHRADNĚ česky. Každé slovo v receptu musí být česky. ZAKÁZÁNO použít cyrilici, ruštinu, angličtinu ani jiné cizí jazyky.
PRAVIDLO VAŘENÍ: Používej POUZE běžné česky kuchařské výrazy — opečte, osmažte, uvařte, promíchejte, přidejte, nakrájejte, zalijte, ochutnejte, odceďte, propasírujte atd. NIKDY nevymýšlej neexistující slova. Piš jasně, srozumitelně, jako recept z kuchařské knihy. Správná čeština: "noky" (množné č.), "odceďte" (ne "ocedíte"), "osmažte" (ne "osmělujte"), "zpracujte" (ne "vyměsujte").`;
  try{
    const rawRecipe=await callClaude([{role:'system',content:sys},{role:'user',content:`Recept na: ${food} pro 4 osoby`}],1500);
    if(!rawRecipe)throw new Error('AI není k dispozici');
    let raw=rawRecipe.trim();
    raw=raw.replace(/\`{3}json/g,'').replace(/\`{3}/g,'').trim();
    const recipe=JSON.parse(raw);
    lastRecipe=recipe;
    // Nahraď loading za kartu receptu v chatu
    loading.innerHTML=`<div class="mlbl">🍳 Navrhovaný recept</div>
      <div style="font-family:'Playfair Display',serif;font-style:italic;font-size:20px;color:var(--accent);margin-bottom:4px;font-weight:700">${recipe.name}</div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:12px">⏱ ${recipe.time} · 🍽 ${recipe.mealType||recipe.difficulty||'?'} · 🍽 ${recipe.portions} porcí</div>
      <div style="font-size:13px;color:var(--text2);font-weight:700;margin-bottom:8px">SUROVINY:</div>
      ${recipe.ingredients.map(i=>`<div style="padding:4px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:14px;display:flex;justify-content:space-between"><span>• ${i.name}</span><span style="color:var(--text3)">${i.qty}</span></div>`).join('')}
      <div style="font-size:13px;color:var(--text2);font-weight:700;margin:12px 0 8px">POSTUP:</div>
      ${recipe.steps.map((s,i)=>`<div style="padding:5px 0;font-size:14px;color:var(--text2)"><span style="color:var(--accent);font-weight:700">${i+1}.</span> ${s}</div>`).join('')}
      ${recipe.tip?`<div style="margin-top:10px;background:rgba(245,200,66,.07);border:1px solid rgba(245,200,66,.2);border-radius:8px;padding:8px 12px;font-size:13px;color:var(--text2)">💡 ${recipe.tip}</div>`:''}`;
    // Přidej potvrzovací tlačítka
    const confirm=document.createElement('div');
    confirm.style.cssText='display:flex;gap:8px;flex-wrap:wrap;padding:4px 0 8px 0;';
    confirm.innerHTML=`
      <button onclick="confirmRecipeToShop(this.parentElement)" style="background:rgba(76,217,100,.15);border:1px solid rgba(76,217,100,.4);border-radius:10px;padding:10px 18px;color:var(--green);font-family:'Crimson Pro',serif;font-size:15px;cursor:pointer;font-weight:600">✅ Použít — přidat suroviny do nákupu</button>
      <button onclick="rexRecipe(${JSON.stringify(food)},this.parentElement)" style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:10px 14px;color:var(--text2);font-family:'Crimson Pro',serif;font-size:14px;cursor:pointer">🔄 Jiný návrh</button>`;
    c.appendChild(confirm);scrollChat();
  }catch(e){
    loading.innerHTML=`<div class="mlbl">⚠️ Chyba</div>❌ ${e.message}`;
  }
};

window.confirmRecipeToShop=async(btnEl)=>{
  if(!lastRecipe){toast('Nejprve nechej Rexe navrhnout recept');return;}
  btnEl?.remove();
  let added=0;
  const isShared = isShopShared();
  const activeItems = isShared ? familyShopItems : shopItems;
  for(const ing of lastRecipe.ingredients){
    const exists=activeItems.some(i=>i.name.toLowerCase()===ing.name.toLowerCase());
    if(!exists){
      const ref = isShared
        ? collection(db,'families',familyId,'shopItems')
        : collection(db,'users',CU.uid,'shopItems');
      await addDoc(ref,{
        name:ing.name, qty:ing.qty,
        category:ing.category||'Ostatní',
        done:false, fromRecipe:lastRecipe.name,
        createdAt:new Date().toISOString()
      });
      added++;
    }
  }
  const c=document.getElementById('chatmsgs');
  const avCur=(typeof AVATARS!=='undefined'&&typeof userData!=='undefined'&&userData?.avatar&&AVATARS[userData.avatar])?AVATARS[userData.avatar]:{emoji:'⭐',name:'Rex'};
  const {row:doneRow,bubble:done}=makeBotBubble(`✅ Přidal jsem <b>${added} surovin</b> do nákupního seznamu! Dobrou chuť 😋 <button onclick="sp('shopping')" style="margin-left:10px;background:rgba(76,217,100,.15);border:1px solid rgba(76,217,100,.3);border-radius:8px;padding:4px 12px;color:var(--green);font-family:'Crimson Pro',serif;font-size:14px;cursor:pointer">🛒 Zobrazit nákup</button>`,avCur.emoji,avCur.name);
  c.appendChild(doneRow);scrollChat();
  toast(`✅ ${added} surovin přidáno do nákupu!`);
};


// ── COOKING & SHOPPING ────────────────────────────────
let cookPortions=2, cookType='any', cookMealType='any';
let lastRecipe=null; // posledni vygenerovany recept

let shopItems=[], unsubShop=null;
let savedRecipes=[], unsubSavedRecipes=null;

function subSavedRecipes(){
  if(_fireSubs['savedRecipes'])return; // už subscribed
  createFireSub('savedRecipes',
    query(collection(db,'users',CU.uid,'savedRecipes'),orderBy('savedAt','desc')),
    snap=>{ savedRecipes=snap.docs.map(d=>({id:d.id,...d.data()})); renderSavedRecipes(); }
  );
}

function subShop(){
  if(_fireSubs['shop'])return; // už subscribed
  createFireSub('shop',
    collection(db,'users',CU.uid,'shopItems'),
    snap=>{ shopItems=snap.docs.map(d=>({id:d.id,...d.data()})); renderShop(); }
  );
}

// ── SHOPPING ──────────────────────────────────────────
function renderShop(){
  const list=document.getElementById('shop-list');
  const empty=document.getElementById('shop-empty');
  if(!list||!empty)return;
  const canShareShop = !!(familyId && familyData?.shareShop);
  const shopToggle = document.getElementById('shop-view-toggle');
  const badge = document.getElementById('shop-shared-badge');
  if(canShareShop) {
    if(badge) badge.style.display = 'none';
    if(shopToggle) {
      shopToggle.style.display = 'flex';
      const btnS = document.getElementById('shop-toggle-shared');
      const btnP = document.getElementById('shop-toggle-personal');
      if(btnS) btnS.classList.toggle('active', shopViewMode==='shared');
      if(btnP) btnP.classList.toggle('active', shopViewMode==='personal');
    }
  } else {
    if(badge) badge.style.display = 'none';
    if(shopToggle) shopToggle.style.display = 'none';
    shopViewMode = 'personal';
  }
  const isShared = isShopShared();
  const activeItems = isShared ? familyShopItems : shopItems;

  // Tlačítko "Přesunout do rodiny" — jen v osobním módu s aktivní rodinnou skupinou
  const moveBtn = document.getElementById('shop-move-to-family');
  if(moveBtn) moveBtn.style.display = (!isShared && familyId && familyData?.shareShop && shopItems.length) ? 'block' : 'none';

  // Tlačítko "Informovat skupinu" — jen ve sdíleném módu s aktivní rodinnou skupinou
  const notifyBtn = document.getElementById('shop-notify-family');
  if(notifyBtn) notifyBtn.style.display = (isShared && familyId && familyData?.shareShop) ? 'block' : 'none';

  if(!activeItems.length){
    list.innerHTML='';empty.style.display='flex';
    document.getElementById('shop-progress-wrap').style.display='none';
    return;
  }
  empty.style.display='none';

  // Progress bar
  const total=activeItems.length;
  const done=activeItems.filter(i=>i.done).length;
  const pct=Math.round(done/total*100);
  const pw=document.getElementById('shop-progress-wrap');
  if(pw){
    pw.style.display='block';
    document.getElementById('shop-progress-label').textContent=`${done} z ${total} položek hotovo`;
    document.getElementById('shop-progress-pct').textContent=pct+'%';
    document.getElementById('shop-progress-bar').style.width=pct+'%';
  }

  // Group by category
  const cats={};
  activeItems.forEach(i=>{
    const c=i.category||'Ostatní';
    if(!cats[c])cats[c]=[];
    cats[c].push(i);
  });

  // Sort: unchecked first within each category
  const catOrder=['Zelenina & ovoce','Maso & ryby','Mléčné výrobky','Pečivo','Trvanlivé','Ostatní'];
  const sortedCats=Object.keys(cats).sort((a,b)=>{
    const ai=catOrder.indexOf(a), bi=catOrder.indexOf(b);
    return (ai===-1?99:ai)-(bi===-1?99:bi);
  });

  list.innerHTML=sortedCats.map((cat, catIdx)=>{
    const items=cats[cat].sort((a,b)=>a.done===b.done?0:a.done?1:-1);
    const hintHtml = catIdx === 0 ? `<div style="font-size:12px;color:var(--text3);font-family:'Crimson Pro',serif;font-style:italic;margin-bottom:10px;padding:0 4px">✏️ Klikni na množství pro úpravu</div>` : '';
    return `<div class="shop-category">
      <div class="shop-cat-label">${cat}</div>
      ${hintHtml}
      ${items.map(i=>`
        <div class="shop-item ${i.done?'done':''}">
          <div class="shop-check ${i.done?'done':''}" onclick="toggleShopItem('${esc(i.id)}',${i.done})">${i.done?'✓':''}</div>
          <span class="shop-item-name">${i.name}</span>
          ${i.qty?`<span class="shop-item-qty" onclick="editShopQty('${esc(i.id)}','${esc(i.qty||'')}',this)" title="Klikni pro úpravu množství" style="cursor:pointer" >${esc(i.qty)}</span>`:`<span class="shop-item-qty" onclick="editShopQty('${esc(i.id)}','',this)" title="Přidat množství" style="cursor:pointer;opacity:.4">+qty</span>`}
          <span class="shop-item-cat" data-id="${esc(i.id)}" onclick="editShopCat('${esc(i.id)}','${esc(i.category||'Ostatní')}')" title="Změnit kategorii" style="font-size:11px;color:var(--text3);cursor:pointer;opacity:.5;flex-shrink:0">✏️</span>
          ${i.fromRecipe?`<span class="shop-from-recipe">🍳 ${i.fromRecipe}</span>`:''}
          <button class="shop-item-del" onclick="delShopItem('${esc(i.id)}')">×</button>
        </div>`).join('')}
    </div>`;
  }).join('');
}

function guessShopCategory(name){
  const n=name.toLowerCase();
  const rules=[
    ['Zelenina & ovoce', ['zelenina','ovoce','salát','špenát','kapusta','brokolice','brokoli','karfiol','květák','cuketa','paprika','rajče','okurka','mrkev','cibule','česnek','petržel','pórek','ředkvička','kedlubna','hrášek','fazole','kukuřice','lilek','batát','dýně','zelí','řepa','chřest','šalvěj','bazalka','kopr','mango','banán','jablko','hruška','pomeranč','citron','grep','kiwi','jahoda','borůvka','malina','třešeň','višeň','meruňka','broskev','švestka','hrozno','ananas','kokos','meloun','avokádo','fík','datle','lesní plody','ovoce','zeleniny']],
    ['Maso & ryby', ['maso','kuře','kuřecí','vepřové','hovězí','jehněčí','krůtí','kachna','slanina','šunka','salám','párky','klobása','játra','ryba','losos','treska','tuňák','sardinky','krevety','kalamáry','mušle','uzené','mleté','kotleta','řízek','steak','roštěná','svíčková']],
    ['Mléčné výrobky', ['mléko','máslo','smetana','jogurt','tvaroh','sýr','niva','eidam','gouda','hermelín','brie','cottage','ricotta','mozzarella','parmazán','kefír','podmáslí','šlehačka','crème','quark','bryndza']],
    ['Pečivo', ['chleba','chléb','rohlík','houska','bageta','tortilla','pita','croissant','koláč','buchta','závin','muffin','toastový','baguette','chlebíček','knäckebrot','pumpernikl']],
    ['Trvanlivé', ['mouka','cukr','sůl','olej','ocet','rýže','těstoviny','pasta','nudle','špagety','kuskus','bulgur','kroupy','čočka','hrách','cizrna','konzerva','kompot','džem','med','sirup','koření','paprika mletá','kmín','skořice','vanilka','prášek do pečiva','soda','škrob','droždí','kakao','čokoláda','káva','čaj','ovesné vločky','müsli','corn flakes','cereálie','kečup','hořčice','majonéza','tatarka','sojová','worchester','tabasco','balzamiko','suš','trvanlivé']],
  ];
  for(const [cat,kw] of rules){
    if(kw.some(k=>n.includes(k))) return cat;
  }
  return 'Ostatní';
}

const SHOP_CATS=['Zelenina & ovoce','Maso & ryby','Mléčné výrobky','Pečivo','Trvanlivé','Ostatní'];

window.editShopCat=(id, currentCat)=>{
  const sel=document.createElement('select');
  sel.style.cssText='background:var(--card2);border:1px solid var(--accent);border-radius:6px;padding:3px 6px;font-size:12px;color:var(--text);font-family:"Crimson Pro",serif;outline:none;max-width:140px';
  SHOP_CATS.forEach(c=>{
    const o=document.createElement('option');
    o.value=c; o.textContent=c;
    if(c===currentCat)o.selected=true;
    sel.appendChild(o);
  });
  // najdi span kategorie v položce a nahraď ho
  const allCatSpans=document.querySelectorAll('.shop-item-cat');
  allCatSpans.forEach(sp=>{if(sp.dataset.id===id){sp.replaceWith(sel);}});
  sel.focus();
  const save=async()=>{
    const newCat=sel.value;
    try{
      if(isShopShared()) await updateDoc(doc(db,'families',familyId,'shopItems',id),{category:newCat});
      else await updateDoc(doc(db,'users',CU.uid,'shopItems',id),{category:newCat});
    }catch(e){console.warn(e);}
  };
  sel.addEventListener('change',save);
  sel.addEventListener('blur',()=>{ save(); renderShop(); });
};

window.onShopInpKey=()=>{
  const name=document.getElementById('shop-inp')?.value||'';
  if(name.length<2){ const h=document.getElementById('shop-pantry-hint'); if(h)h.style.display='none'; return; }
  const cat=guessShopCategory(name);
  const sel=document.getElementById('shop-cat-sel');
  if(sel&&cat!=='Ostatní') sel.value=cat;
  // Pantry hint
  const hint=document.getElementById('shop-pantry-hint');
  if(hint&&pantryItems.length){
    const match=pantryItems.find(p=>p.name.toLowerCase().includes(name.toLowerCase())||name.toLowerCase().includes(p.name.toLowerCase()));
    if(match){ hint.textContent=`🧊 V zásobách: ${match.qty} ${match.unit||'ks'}`; hint.style.display=''; }
    else hint.style.display='none';
  }
};

window.notifyShopFamily=async()=>{
  if(!familyId||!familyData?.shareShop){toast('Nejsi v rodinné skupině se sdíleným seznamem');return;}
  const senderName=prof?.prezdivka||prof?.nickname||'Člen rodiny';
  const groupName=familyData?.groupName||'rodiny';
  const count=familyShopItems.filter(i=>!i.done).length;
  const msg=count>0
    ?`${senderName} aktualizoval${prof?.gender==='f'?'a':''} nákupní seznam — ${count} položek čeká na nákup`
    :`${senderName} aktualizoval${prof?.gender==='f'?'a':''} nákupní seznam`;
  try {
    const res=await notifyFamilyFn({message:msg,type:'shop-update'});
    toast(res.data.sent>0?`📣 Upozornění odesláno (${res.data.sent} členů)`:'📣 Nikdo jiný nemá zapnuté notifikace');
  } catch(e) {
    toast('❌ Nepodařilo se odeslat upozornění');
    console.warn('notifyShopFamily error:',e);
  }
};

window.moveShopToFamily=async()=>{
  if(!familyId||!familyData?.shareShop){toast('Nejsi v rodinné skupině se sdíleným seznamem');return;}
  if(!shopItems.length){toast('Osobní seznam je prázdný');return;}
  const count=shopItems.length;
  for(const i of shopItems){
    await addDoc(collection(db,'families',familyId,'shopItems'),{
      name:i.name, category:i.category||'Ostatní', done:false, qty:i.qty||'',
      addedBy:CU.uid, addedByName:prof?.prezdivka||prof?.nickname||'',
      createdAt:new Date().toISOString()
    });
    await deleteDoc(doc(db,'users',CU.uid,'shopItems',i.id));
  }
  shopViewMode='shared';
  toast(`✓ ${count} položek přesunuto do rodinného seznamu 👨‍👩‍👧`);
};

window.addShopItem=async()=>{
  const inp=document.getElementById('shop-inp');
  const name=inp.value.trim();
  if(!name)return;
  const selCat=document.getElementById('shop-cat-sel')?.value||'Ostatní';
  const cat=selCat==='Ostatní'?guessShopCategory(name):selCat;
  const qtyInp=document.getElementById('shop-qty-inp');
  const qty=(qtyInp?.value||'').trim();
  inp.value='';
  if(qtyInp)qtyInp.value='';
  if(isShopShared()) {
    await addDoc(collection(db,'families',familyId,'shopItems'),{
      name, category:cat, done:false, qty,
      addedBy:CU.uid, addedByName:prof?.prezdivka||prof?.nickname||'',
      createdAt:new Date().toISOString()
    });
    toast('✓ Přidáno do sdíleného seznamu 👨‍👩‍👧');
  } else {
    await addDoc(collection(db,'users',CU.uid,'shopItems'),{name,done:false,category:cat,qty,createdAt:new Date().toISOString()});
    toast('✓ Přidáno');
  }
};

window.quickAddShopItem=async(name,cat)=>{
  const activeItems=isShopShared()?familyShopItems:shopItems;
  if(activeItems.some(i=>i.name.toLowerCase()===name.toLowerCase()&&!i.done)){
    toast(`${name} už je v seznamu`);return;
  }
  if(isShopShared()){
    await addShopItemToFamily(name,cat);
    toast(`✓ ${name} přidáno 👨‍👩‍👧`);
  } else {
    await addDoc(collection(db,'users',CU.uid,'shopItems'),{name,done:false,category:cat,createdAt:new Date().toISOString()});
    toast(`✓ ${name} přidáno`);
  }
};

window.toggleShopItem=async(id,wasDone)=>{
  if(isShopShared()) {
    const item = familyShopItems.find(i=>i.id===id);
    const name = item?.name;
    await toggleFamilyShopItem(id,wasDone);
    if(!wasDone && name) offerPantryUpdate(name);
    return;
  }
  const item=shopItems.find(i=>i.id===id);
  if(!item)return;
  const name = item.name;
  await setDoc(doc(db,'users',CU.uid,'shopItems',id),{...item,done:!wasDone});
  if(!wasDone) offerPantryUpdate(name);
};

function offerPantryUpdate(name) {
  if(!name) return;
  const match = pantryItems.find(p=>p.name.toLowerCase()===name.toLowerCase()||name.toLowerCase().includes(p.name.toLowerCase()));
  if(match){
    // Auto-update: +1
    changePantryQty(match.id, 1);
    toast(`🧊 ${match.name} v zásobách: ${(match.qty||0)+1} ${match.unit||'ks'}`);
  } else {
    // Nabídni přidání do zásob
    const t = document.createElement('div');
    t.style.cssText='position:fixed;bottom:90px;left:12px;right:12px;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:12px 14px;z-index:800;display:flex;align-items:center;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,.4)';
    t.innerHTML=`<span style="flex:1;font-size:13px;color:var(--text2)">Přidat <b>${esc(name)}</b> do zásob?</span><button onclick="openPantryAdd({name:'${esc(name)}',qty:1});this.closest('div').remove()" style="background:var(--accent);color:#1a1a1a;border:none;border-radius:8px;padding:6px 12px;font-size:13px;font-weight:700;cursor:pointer">+ Zásoby</button><button onclick="this.closest('div').remove()" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer">×</button>`;
    document.body.appendChild(t);
    setTimeout(()=>t.remove(), 6000);
  }
}

window.editShopQty = (id, currentQty, el) => {
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = currentQty;
  inp.placeholder = 'množství…';
  inp.style.cssText = 'width:70px;background:var(--card2);border:1px solid var(--accent);border-radius:6px;padding:2px 6px;font-size:13px;color:var(--text);font-family:"Crimson Pro",serif;outline:none';
  el.replaceWith(inp);
  inp.focus();
  inp.select();
  const save = async () => {
    const newQty = inp.value.trim();
    try {
      if(isShopShared()) {
        await updateDoc(doc(db,'families',familyId,'shopItems',id), {qty: newQty});
      } else {
        await updateDoc(doc(db,'users',CU.uid,'shopItems',id), {qty: newQty});
      }
    } catch(e) { console.warn('editShopQty chyba:', e); }
  };
  inp.addEventListener('blur', save);
  inp.addEventListener('keydown', e => { if(e.key==='Enter'||e.key==='Escape') inp.blur(); });
};

window.delShopItem=async(id)=>{
  if(isShopShared()) {
    await deleteFamilyShopItem(id); return;
  }
  await deleteDoc(doc(db,'users',CU.uid,'shopItems',id));
};

window.shareShoppingList=()=>{
  const activeItems=isShopShared()?familyShopItems:shopItems;
  if(!activeItems.length){toast('Seznam je prázdný');return;}
  const remaining=activeItems.filter(i=>!i.done);
  if(!remaining.length){toast('Vše už nakoupeno! 🎉');return;}
  // Sestav text podle kategorií
  const cats={};
  remaining.forEach(i=>{
    const c=i.category||'Ostatní';
    if(!cats[c])cats[c]=[];
    cats[c].push(i);
  });
  const catOrder=['Zelenina & ovoce','Maso & ryby','Mléčné výrobky','Pečivo','Trvanlivé','Ostatní'];
  const sorted=Object.keys(cats).sort((a,b)=>(catOrder.indexOf(a)<0?99:catOrder.indexOf(a))-(catOrder.indexOf(b)<0?99:catOrder.indexOf(b)));
  let text='🛒 Nákupní seznam\n\n';
  sorted.forEach(cat=>{
    text+=`${cat}:\n`;
    cats[cat].forEach(i=>{ text+=`• ${i.name}${i.qty?' ('+i.qty+')':''}\n`; });
    text+='\n';
  });
  text+=`Celkem ${remaining.length} položek`;
  // Zkus Web Share API (mobil), jinak zkopíruj do schránky
  if(navigator.share){
    navigator.share({title:'Nákupní seznam',text}).catch(()=>{});
  } else {
    navigator.clipboard.writeText(text).then(()=>toast('📋 Seznam zkopírován do schránky!')).catch(()=>toast('❌ Kopírování selhalo'));
  }
};

window.openRecipePickerForShop = function() {
  document.getElementById('recipe-shop-picker')?.remove();
  const m = document.createElement('div');
  m.id = 'recipe-shop-picker';
  m.className = 'moverlay open';
  const recipes = savedRecipes || [];
  m.innerHTML = `<div class="modal" style="max-width:400px">
    <h3 style="margin:0 0 14px;font-family:'Playfair Display',serif">🍽️ Vybrat recept do nákupu</h3>
    ${recipes.length ? `
      <div style="font-size:13px;color:var(--text3);margin-bottom:12px">Klikni na recept — ingredience se přidají do nákupního seznamu.</div>
      <div style="max-height:55vh;overflow-y:auto;display:flex;flex-direction:column;gap:8px">
        ${recipes.map(r => `
          <div onclick="addRecipeToShop('${esc(r.id)}',this)"
            style="background:var(--card2);border:1.5px solid var(--border);border-radius:12px;padding:12px 14px;cursor:pointer;display:flex;align-items:center;gap:12px;transition:border-color .2s"
            onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
            <span style="font-size:22px">🍽️</span>
            <div style="flex:1;min-width:0">
              <div style="font-family:'Crimson Pro',serif;font-size:15px;font-weight:600;color:var(--text)">${esc(r.name)}</div>
              <div style="font-size:12px;color:var(--text3);margin-top:2px">⏱ ${r.time||'?'} · 🥘 ${r.ingredients?.length||0} surovin</div>
            </div>
          </div>`).join('')}
      </div>` : `
      <div style="text-align:center;padding:24px 0;color:var(--text3)">
        <div style="font-size:36px;margin-bottom:10px">🔖</div>
        <div style="font-size:14px">Zatím nemáš žádné uložené recepty.</div>
        <div style="font-size:13px;margin-top:4px">Vygeneruj recept ve Vaření a ulož ho.</div>
      </div>`}
    <button class="btn-s" style="width:100%;margin-top:14px" onclick="document.getElementById('recipe-shop-picker').remove()">Zavřít</button>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if(e.target === m) m.remove(); });
};

window.addRecipeToShop = async function(recipeId, el) {
  const recipe = savedRecipes.find(r => r.id === recipeId);
  if(!recipe) return;
  if(!recipe.ingredients?.length) { toast('Recept nemá ingredience'); return; }
  el.style.borderColor = 'var(--green)';
  el.style.pointerEvents = 'none';
  const isSharedShop = isShopShared();
  const activeShopItems = isSharedShop ? familyShopItems : shopItems;
  const ref = isSharedShop
    ? collection(db,'families',familyId,'shopItems')
    : collection(db,'users',CU.uid,'shopItems');
  let added = 0;
  for(const ing of recipe.ingredients) {
    const key = ing.name.toLowerCase();
    if(activeShopItems.some(i => i.name.toLowerCase() === key)) continue;
    await addDoc(ref, {
      name: ing.name, qty: ing.qty||'',
      category: ing.category||'Ostatní',
      done: false, fromRecipe: recipe.name,
      createdAt: new Date().toISOString()
    });
    added++;
  }
  el.innerHTML = `<span style="color:var(--green);font-size:22px">✅</span><div style="flex:1;min-width:0"><div style="font-family:'Crimson Pro',serif;font-size:15px;font-weight:600;color:var(--green)">${esc(recipe.name)}</div><div style="font-size:12px;color:var(--text3)">${added > 0 ? `Přidáno ${added} ingrediencí` : 'Vše už máš v nákupu'}</div></div>`;
  toast(added > 0 ? `✅ Přidáno ${added} ingrediencí z "${recipe.name}"` : '📌 Vše z tohoto receptu už máš v nákupu');
};

window.clearDoneItems=async()=>{
  const activeItems = isShopShared() ? familyShopItems : shopItems;
  const done=activeItems.filter(i=>i.done);
  if(!done.length){toast('Žádné splněné položky');return;}
  if(isShopShared()) {
    for(const i of done) await deleteDoc(doc(db,'families',familyId,'shopItems',i.id));
  } else {
    for(const i of done) await deleteDoc(doc(db,'users',CU.uid,'shopItems',i.id));
  }
  toast(`✓ Smazáno ${done.length} položek`);
};

// ── COOKING ───────────────────────────────────────────
window.setPortions=(n,btn)=>{
  cookPortions=n;
  document.querySelectorAll('[data-p]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
};

window.setCookType=(t,btn)=>{
  cookType=t;
  document.querySelectorAll('[data-t]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
};

window.setCookMealType=(t,btn)=>{
  cookMealType=t;
  document.querySelectorAll('[data-m]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderSavedRecipes();
};

window.askRecipe=async()=>{
  const inp=document.getElementById('cook-inp');
  const query=inp.value.trim();
  if(!query){toast('⚠️ Napiš co chceš vařit');return;}

  document.getElementById('cook-result').style.display='none';
  document.getElementById('cook-welcome').style.display='none';
  const cookLoadingEl=document.getElementById('cook-loading');
  cookLoadingEl.style.display='block';
  const avatarName=(AVS.find(a=>a.id===prof?.avatarId)||AVS[0]).name;
  const loadingText=cookLoadingEl.querySelector('div:last-child');
  if(loadingText)loadingText.textContent=`${avatarName} vymýšlí recept…`;
  cookLoadingEl?.scrollIntoView({behavior:'smooth', block:'center'});

  const typeHint=cookType==='quick'?'Recept musí být rychlý (do 30 min).':
    cookType==='healthy'?'Recept musí být zdravý a výživný.':
    cookType==='cheap'?'Recept musí být levný z dostupných surovin.':'';
  const mealTypeHint=cookMealType!=='any'?`Recept musí být vhodný jako: ${cookMealType}.`:'';

  const sys=`Jsi kuchařský asistent. Odpovídej POUZE v JSON formátu, bez markdown, bez backticks.
Vrať JSON objekt s těmito poli:
{
  "name": "Název jídla",
  "time": "30 minut",
  "mealType": "Oběd",
  "portions": ${cookPortions},
  "ingredients": [
    {"name": "Kuřecí prsa", "qty": "400 g", "category": "Maso & ryby"},
    {"name": "Cibule", "qty": "1 ks", "category": "Zelenina & ovoce"}
  ],
  "steps": ["Krok 1...", "Krok 2..."],
  "tip": "Tip kuchaře..."
}
Kategorie surovin: "Zelenina & ovoce", "Maso & ryby", "Mléčné výrobky", "Pečivo", "Trvanlivé", "Ostatní"
${typeHint}${mealTypeHint}
PRAVIDLO JEDNOTKY: V poli "qty" používej VÝHRADNĚ tyto jednotky: ks, g, kg, ml, l. Příklady: "200 g", "1 ks", "0.5 l", "150 ml", "0.25 kg". NIKDY nepoužívej: lžíce, hrnek, dcl, stroužky, špetka, svazek ani jiné nestandardní jednotky — převeď je na standardní (1 lžíce = 15 ml, 1 hrnek = 250 ml, 1 stroužek česneku = 1 ks, 1 špetka = 2 g).
PRAVIDLO JAZYK: Piš VÝHRADNĚ česky. Každé slovo v receptu musí být česky. ZAKÁZÁNO použít cyrilici, ruštinu, angličtinu ani jiné cizí jazyky.
PRAVIDLO VAŘENÍ: Používej POUZE běžné česky kuchařské výrazy — opečte, osmažte, uvařte, promíchejte, přidejte, nakrájejte, zalijte, ochutnejte, odceďte, propasírujte atd. NIKDY nevymýšlej neexistující slova. Piš jasně, srozumitelně, jako recept z kuchařské knihy. Správná čeština: "noky" (množné č.), "odceďte" (ne "ocedíte"), "osmažte" (ne "osmělujte"), "zpracujte" (ne "vyměsujte").`;

  try{
    const rawR=await callClaude([{role:'system',content:sys},{role:'user',content:`Recept na: ${query} pro ${cookPortions} osoby`}],1500);
    if(!rawR)throw new Error('AI není k dispozici — klíč bude nastaven brzy');
    let raw=rawR.trim().replace(/`{3}json/g,'').replace(/`{3}/g,'').trim();
    const recipe=JSON.parse(raw);
    lastRecipe=recipe;
    renderRecipe(recipe);
    if(pantryItems.length) offerPantryDeduct(recipe.ingredients);
  }catch(e){
    document.getElementById('cook-loading').style.display='none';
    toast('❌ Chyba: '+e.message);
  }
};

// ── Manuální recept ───────────────────────────────────────
window.openManualRecipe = function() {
  document.getElementById('manual-recipe-modal')?.remove();
  document.getElementById('app').insertAdjacentHTML('beforeend', `
    <div class="moverlay open" id="manual-recipe-modal" onclick="if(event.target===this)this.remove()">
      <div class="modal" style="max-width:480px;max-height:88vh;overflow-y:auto;gap:14px">
        <div style="font-family:'Playfair Display',serif;font-style:italic;font-size:20px;color:var(--accent);font-weight:700">✏️ Vlastní recept</div>

        <input id="mr-name" class="finp" placeholder="Název receptu *">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          <input id="mr-time" class="finp" placeholder="Čas (30 min)">
          <select id="mr-diff" class="finp">
            <option>Snídaně</option><option>Svačina</option><option>Oběd</option><option>Večeře</option><option>Dezert</option>
          </select>
          <input id="mr-portions" class="finp" type="number" placeholder="Porce" value="4" min="1" max="20">
        </div>

        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:6px">Suroviny (každá na nový řádek, např. "Mouka 200 g")</div>
          <textarea id="mr-ingredients" class="finp" rows="5" placeholder="Kuřecí prsa 400 g&#10;Cibule 1 ks&#10;Česnek 10 g&#10;Mléko 250 ml" style="resize:vertical;font-size:14px"></textarea>
        </div>

        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div style="font-size:13px;font-weight:600;color:var(--text2)">Postup (každý krok na nový řádek)</div>
            <button onclick="aiSuggestSteps()" style="background:var(--accent);color:#1a1a1a;border:none;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Crimson Pro',serif">✨ Navrhnout AI</button>
          </div>
          <textarea id="mr-steps" class="finp" rows="6" placeholder="Maso nakrájejte na kousky&#10;Na oleji osmažte cibuli&#10;Přidejte maso a opečte" style="resize:vertical;font-size:14px"></textarea>
        </div>

        <input id="mr-tip" class="finp" placeholder="Tip kuchaře (volitelné)">

        <div style="display:flex;gap:8px">
          <button class="btn-s" style="flex:1" onclick="document.getElementById('manual-recipe-modal').remove()">Zrušit</button>
          <button class="btn-p" style="flex:2" onclick="saveManualRecipe()">💾 Uložit recept</button>
        </div>
      </div>
    </div>`);
  setTimeout(() => document.getElementById('mr-name')?.focus(), 100);
};

window.aiSuggestSteps = async function() {
  const name = document.getElementById('mr-name')?.value.trim();
  const ingr = document.getElementById('mr-ingredients')?.value.trim();
  const stepsEl = document.getElementById('mr-steps');
  if (!name) { toast('⚠️ Nejdřív zadej název receptu'); return; }
  const btn = document.querySelector('[onclick="aiSuggestSteps()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generuji…'; }
  try {
    const portions = document.getElementById('mr-portions')?.value || '4';
    const sys = `Jsi kuchařský asistent. Na základě názvu jídla a surovin napiš stručný postup vaření — 4 až 8 kroků. Každý krok na jeden řádek, bez číslování. Piš VÝHRADNĚ česky, jasně a srozumitelně jako recept z kuchařské knihy.`;
    const user = `Recept: ${name} pro ${portions} osoby\nSuroviny:\n${ingr||'(neuvedeny)'}`;
    const result = await callClaude([{role:'system',content:sys},{role:'user',content:user}], 600);
    if (result && stepsEl) {
      stepsEl.value = result.trim();
      toast('✨ Postup vygenerován');
    }
  } catch(e) {
    toast('⚠️ AI není dostupná');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✨ Navrhnout AI'; }
  }
};

function normalizeIngQty(amount, unit) {
  const a = parseFloat(String(amount).replace(',','.')) || 1;
  const u = unit.toLowerCase();
  // Převod na standardní jednotky
  if(u==='lžíce'||u==='lžic'||u==='lžíci') return `${Math.round(a*15)} ml`;
  if(u==='lžička'||u==='lžičky'||u==='lžičce') return `${Math.round(a*5)} ml`;
  if(u==='hrnek'||u==='hrnky'||u==='hrnků') return `${Math.round(a*250)} ml`;
  if(u==='dcl'||u==='dl') return `${Math.round(a*100)} ml`;
  if(u==='špetka'||u==='špetky') return `${Math.round(a*2)} g`;
  if(u==='stroužek'||u==='stroužky'||u==='stroužků') return `${a} ks`;
  if(u==='svazek'||u==='svazky'||u==='svazků') return `${Math.round(a*50)} g`;
  if(u==='plátek'||u==='plátky'||u==='plátků') return `${a} ks`;
  // Už standardní
  if(['ks','g','kg','ml','l'].includes(u)) return `${a} ${u}`;
  // Neznámá — nech jak je
  return `${a} ${unit}`;
}

window.saveManualRecipe = async function() {
  const name = document.getElementById('mr-name')?.value.trim();
  if (!name) { toast('⚠️ Zadej název receptu'); return; }

  const rawIngr = document.getElementById('mr-ingredients')?.value.trim() || '';
  const rawSteps = document.getElementById('mr-steps')?.value.trim() || '';

  const ingredients = rawIngr.split('\n').filter(l => l.trim()).map(l => {
    const parts = l.trim().match(/^(.+?)\s+([\d\/,.]+)\s*(\S+)\s*$/);
    if (parts) {
      const qty = normalizeIngQty(parts[2].trim(), parts[3].trim());
      return { name: parts[1].trim(), qty, category: 'Ostatní' };
    }
    return { name: l.trim(), qty: '', category: 'Ostatní' };
  });

  const steps = rawSteps.split('\n').filter(l => l.trim()).map(l => l.trim());

  const recipe = {
    name,
    time: document.getElementById('mr-time')?.value.trim() || '?',
    mealType: document.getElementById('mr-diff')?.value || 'Oběd',
    portions: parseInt(document.getElementById('mr-portions')?.value) || 4,
    ingredients,
    steps,
    tip: document.getElementById('mr-tip')?.value.trim() || '',
  };

  // Ulož do Firestore
  const data = { ...recipe, savedAt: Date.now(), manual: true };
  await addDoc(collection(db, 'users', CU.uid, 'savedRecipes'), data);
  document.getElementById('manual-recipe-modal')?.remove();

  // Zobraz recept
  lastRecipe = recipe;
  document.getElementById('cook-welcome').style.display = 'none';
  renderRecipe(recipe);
  toast('✅ Recept uložen!');
};

function renderRecipe(r, scaledPortions){
  document.getElementById('cook-loading').style.display='none';
  document.getElementById('cook-result').style.display='block';
  const basePortions = r.portions || 4;
  const portions = scaledPortions || basePortions;
  const scale = portions / basePortions;
  // Reset save button
  const saveBtn=document.getElementById('btn-save-recipe');
  if(saveBtn){saveBtn.textContent='🔖 Uložit recept';saveBtn.style.background='';saveBtn.style.color='';saveBtn.style.borderColor='';}

  // Funkce pro škálování množství (jednoduché číslo × scale)
  const scaleQty = (qty) => {
    if(!qty) return qty;
    const match = qty.match(/^([\d.,]+)(.*)/);
    if(!match) return qty;
    const num = parseFloat(match[1].replace(',','.'));
    const unit = match[2];
    const scaled = Math.round(num * scale * 10) / 10;
    return scaled + unit;
  };

  const titleEl = document.getElementById('cook-recipe-title');
  if(titleEl) titleEl.textContent = r.name;
  document.getElementById('cook-recipe-card').innerHTML=`
    <div class="cook-recipe-meta" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <span>⏱ ${r.time}</span>
      <span>🍽 ${r.mealType||r.difficulty||'?'}</span>
      <span style="display:flex;align-items:center;gap:6px">🍽
        <button onclick="changePortions(-1)" style="background:var(--card2);border:1px solid var(--border);border-radius:6px;width:24px;height:24px;cursor:pointer;color:var(--text);font-size:14px;line-height:1">−</button>
        <span id="portions-display" style="font-weight:700;min-width:20px;text-align:center">${portions}</span>
        <button onclick="changePortions(1)" style="background:var(--card2);border:1px solid var(--border);border-radius:6px;width:24px;height:24px;cursor:pointer;color:var(--text);font-size:14px;line-height:1">+</button>
        <span style="color:var(--text3)">porcí</span>
      </span>
    </div>
    <div class="cook-section" style="display:flex;align-items:center;justify-content:space-between">Suroviny <span style="font-size:12px;color:var(--text3);font-family:'Crimson Pro',serif;font-style:italic;font-weight:400">✏️ klikni na množství pro úpravu</span></div>
    ${r.ingredients.map((ing,i)=>`
      <div class="cook-ingredient" id="cing-row-${i}">
        <div class="cook-ing-check" id="cing-${i}" onclick="toggleIng(${i})"></div>
        <span id="ing-name-${i}">${ing.name}</span>
        <span style="color:var(--text3);margin-left:auto;font-size:14px;cursor:pointer" title="Klikni pro úpravu" onclick="editRecipeQty(${i},this)">${scale===1?ing.qty:scaleQty(ing.qty)}</span>
        <span id="cing-badge-${i}" style="display:none;font-size:11px;background:rgba(76,217,100,.15);color:var(--green);border-radius:6px;padding:2px 7px;border:1px solid rgba(76,217,100,.3)">mám doma</span>
      </div>`).join('')}
    <div class="cook-section">Postup</div>
    ${r.steps.map((s,i)=>`
      <div class="cook-step">
        <span class="cook-step-num">${i+1}.</span>
        <span>${s}</span>
      </div>`).join('')}
    ${r.tip?`<div style="margin-top:14px;background:rgba(245,200,66,.07);border:1px solid rgba(245,200,66,.2);border-radius:10px;padding:10px 14px;font-size:14px;color:var(--text2)">💡 ${r.tip}</div>`:''}
  `;
  // Ulož aktuální porce pro škálování
  window._currentPortions = portions;
}

window.changePortions = (delta) => {
  if(!lastRecipe) return;
  const current = window._currentPortions || lastRecipe.portions || 4;
  const next = Math.max(1, current + delta);
  renderRecipe(lastRecipe, next);
};

window.editRecipeQty = (idx, el) => {
  if(!lastRecipe) return;
  const current = el.textContent.trim();
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = current;
  inp.style.cssText = 'width:70px;background:var(--card2);border:1px solid var(--accent);border-radius:6px;padding:2px 6px;font-size:13px;color:var(--text);font-family:"Crimson Pro",serif;outline:none;text-align:right';
  el.replaceWith(inp);
  inp.focus(); inp.select();
  inp.addEventListener('blur', () => {
    const newQty = inp.value.trim();
    if(lastRecipe.ingredients[idx]) lastRecipe.ingredients[idx].qty = newQty;
    const span = document.createElement('span');
    span.style.cssText = 'color:var(--text3);margin-left:auto;font-size:14px;cursor:pointer';
    span.title = 'Klikni pro úpravu';
    span.textContent = newQty;
    span.onclick = function(){ editRecipeQty(idx, this); };
    inp.replaceWith(span);
  });
  inp.addEventListener('keydown', e => { if(e.key==='Enter'||e.key==='Escape') inp.blur(); });
};

window.toggleIng=(i)=>{
  const el=document.getElementById(`cing-${i}`);
  const nm=document.getElementById(`ing-name-${i}`);
  const badge=document.getElementById(`cing-badge-${i}`);
  const done=el.classList.toggle('done');
  el.textContent=done?'✓':'';
  nm.style.textDecoration=done?'line-through':'none';
  nm.style.color=done?'var(--text3)':'var(--text)';
  if(badge) badge.style.display=done?'inline':'none';
};

window.sendToShopping=async()=>{
  if(!lastRecipe){toast('Nejprve vygeneruj recept');return;}
  let added=0, skipped=0, haveit=0;
  lastRecipe.ingredients.forEach((ing,i)=>{
    const checkedEl=document.getElementById(`cing-${i}`);
    if(checkedEl&&checkedEl.classList.contains('done')){ haveit++; } // mám doma — přeskočit
  });
  for(let i=0;i<lastRecipe.ingredients.length;i++){
    const ing=lastRecipe.ingredients[i];
    const checkedEl=document.getElementById(`cing-${i}`);
    if(checkedEl&&checkedEl.classList.contains('done')) continue; // mám doma
    const exists=shopItems.some(s=>s.name.toLowerCase()===ing.name.toLowerCase());
    if(!exists){
      await addDoc(collection(db,'users',CU.uid,'shopItems'),{
        name:ing.name, qty:ing.qty,
        category:ing.category||'Ostatní',
        done:false,
        fromRecipe:lastRecipe.name,
        createdAt:new Date().toISOString()
      });
      added++;
    } else { skipped++; }
  }
  const parts=[];
  if(added>0) parts.push(`${added} přidáno`);
  if(skipped>0) parts.push(`${skipped} už v seznamu`);
  if(haveit>0) parts.push(`${haveit} máš doma`);
  toast(`✅ ${parts.join(' · ')}`, 3500);
  // Zvýrazni tlačítko "Otevřít nákupy"
  const btn = document.querySelector('.cook-actions .btn-s');
  if(btn){ btn.style.background='var(--accent)'; btn.style.color='#1a1a1a'; }
};

// ── SAVED RECIPES ─────────────────────────────────────
window.saveRecipe=async()=>{
  if(!CU||!lastRecipe){toast(!lastRecipe?'Nejprve vygeneruj recept':'');return;}
  const btn=document.getElementById('btn-save-recipe');
  const exists=savedRecipes.some(r=>r.name===lastRecipe.name);
  if(exists){toast('📌 Tento recept už máš uložený');return;}
  try{
    const data={...lastRecipe, savedAt:new Date().toISOString()};
    await addDoc(collection(db,'users',CU.uid,'savedRecipes'),data);
    toast('🔖 Recept uložen do oblíbených!');
    if(btn){btn.textContent='✅ Uloženo';btn.style.background='rgba(76,217,100,.15)';btn.style.color='var(--green)';btn.style.borderColor='rgba(76,217,100,.4)';}
  }catch(e){toast('❌ Nepodařilo se uložit: '+e.message);}
};

window.deleteSavedRecipe=async(id,e)=>{
  e.stopPropagation();
  if(!CU||!confirm('Smazat uložený recept?'))return;
  try{
    await deleteDoc(doc(db,'users',CU.uid,'savedRecipes',id));
    toast('Recept smazán');
  }catch(err){toast('❌ Chyba mazání: '+err.message);}
};

window.openSavedRecipe=(id)=>{
  const r=savedRecipes.find(x=>x.id===id);
  if(!r)return;
  lastRecipe=r;
  // Reset save button
  const btn=document.getElementById('btn-save-recipe');
  if(btn){btn.textContent='✅ Uloženo';btn.style.background='rgba(76,217,100,.15)';btn.style.color='var(--green)';btn.style.borderColor='rgba(76,217,100,.4)';}
  document.getElementById('cook-loading').style.display='none';
  document.getElementById('cook-result').style.display='block';
  renderRecipe(r);
  // Scroll to top of recipe
  document.getElementById('cook-result').scrollIntoView({behavior:'smooth',block:'start'});
};

function renderSavedRecipes(){
  const section=document.getElementById('saved-recipes-section');
  const list=document.getElementById('saved-recipes-list');
  if(!section||!list)return;
  const filtered=cookMealType==='any'?savedRecipes:savedRecipes.filter(r=>(r.mealType||r.difficulty||'')=== cookMealType);
  if(!filtered.length){
    list.innerHTML=`<div style="font-size:14px;color:var(--text3);font-style:italic;padding:8px 0">${savedRecipes.length?'Žádné recepty pro tento typ jídla.':'Zatím žádné uložené recepty. Vygeneruj recept a klikni 🔖 Uložit.'}</div>`;
    return;
  }
  list.innerHTML=filtered.map(r=>`
    <div class="saved-recipe-card" onclick="openSavedRecipe('${esc(r.id)}')">
      <div class="saved-recipe-top">
        <div style="font-size:24px">🍽️</div>
        <div style="flex:1">
          <div class="saved-recipe-name">${r.name}</div>
          <div class="saved-recipe-meta">⏱ ${r.time||'?'} · 🍽 ${r.mealType||r.difficulty||'?'} · ${r.portions||2} porcí · Uloženo ${new Date(r.savedAt).toLocaleDateString('cs-CZ',{day:'numeric',month:'short'})}</div>
        </div>
        <button onclick="deleteSavedRecipe('${esc(r.id)}',event)" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;padding:4px;transition:color .2s;flex-shrink:0" title="Smazat">🗑️</button>
      </div>
      <div class="saved-recipe-actions">
        <button onclick="openSavedRecipe('${esc(r.id)}')" style="background:rgba(245,200,66,.1);border:1px solid rgba(245,200,66,.25);border-radius:8px;padding:5px 12px;font-size:13px;color:var(--accent);cursor:pointer;font-family:'Crimson Pro',serif">📖 Otevřít recept</button>
      </div>
    </div>`).join('');
}

// ===== ZÁSOBY (PANTRY) =====
let pantryItems = []; // [{id, name, qty, unit, minQty, updatedAt}]
let pantryUnsub = null;

window.switchCookTab = function(tab) {
  document.getElementById('cook-tab-recipes')?.classList.toggle('active', tab === 'recipes');
  document.getElementById('cook-tab-pantry')?.classList.toggle('active', tab === 'pantry');
  const rs = document.getElementById('cook-section-recipes');
  const ps = document.getElementById('cook-section-pantry');
  if (rs) rs.style.display = tab === 'recipes' ? '' : 'none';
  if (ps) ps.style.display = tab === 'pantry' ? '' : 'none';
  if (tab === 'pantry') renderPantry();
};

window.switchShopTab = function(tab) {
  document.getElementById('shop-tab-list')?.classList.toggle('active', tab === 'list');
  document.getElementById('shop-tab-pantry')?.classList.toggle('active', tab === 'pantry');
  const sl = document.getElementById('shop-section-list');
  const sp = document.getElementById('shop-section-pantry');
  if (sl) sl.style.display = tab === 'list' ? '' : 'none';
  if (sp) sp.style.display = tab === 'pantry' ? '' : 'none';
  if (tab === 'pantry') renderShopPantry();
};

function initPantry() {
  if (familyId) {
    if (pantryUnsub) pantryUnsub();
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js').then(({collection: col, onSnapshot: ons}) => {
      const pantryCol = col(db, 'families', familyId, 'pantry');
      pantryUnsub = ons(pantryCol, snap => {
        pantryItems = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderPantry();
      });
    }).catch(e => console.warn('Pantry load failed:', e));
  } else {
    pantryItems = lsGet('lp_pantry', []);
    renderPantry();
  }
}

function buildPantryHtml(low, sorted) {
  return `
    ${low.length ? `<div class="pantry-alert">⚠️ ${low.length} ${low.length === 1 ? 'položka dochází' : low.length < 5 ? 'položky dochází' : 'položek dochází'}: ${low.map(i => i.name).join(', ')}</div>` : ''}
    <div class="pantry-actions-top">
      <button class="btn-sv pantry-add-btn" onclick="openPantryAdd()">+ Přidat zásobu</button>
      ${low.length ? `<button class="btn-cook-suggest" onclick="pantryToShop()">🛒 Navrhnout nákup</button>` : ''}
    </div>
    ${sorted.length === 0 ? `<div class="pantry-empty"><div style="font-size:40px;margin-bottom:8px">🧊</div><div>Zásoby jsou prázdné.</div><div style="font-size:13px;margin-top:4px;color:var(--text3)">Přidej co máš doma.</div></div>` : ''}
    <div class="pantry-list">
      ${sorted.map(item => {
        const isLow = item.minQty && item.qty <= item.minQty;
        return `<div class="pantry-item ${isLow ? 'low' : ''}">
          <div class="pantry-item-info">
            <span class="pantry-item-name">${esc(item.name)}</span>
            ${isLow ? '<span class="pantry-low-badge">dochází</span>' : ''}
          </div>
          <div class="pantry-item-qty">
            <button class="pantry-qty-btn" onclick="changePantryQty('${esc(item.id)}', -1)">−</button>
            <span class="pantry-qty-val">${item.qty} ${esc(item.unit || '')}</span>
            <button class="pantry-qty-btn" onclick="changePantryQty('${esc(item.id)}', 1)">+</button>
            <button class="pantry-item-del" onclick="deletePantryItem('${esc(item.id)}')">🗑</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

function getPantrySorted() {
  const low = pantryItems.filter(i => i.minQty && i.qty <= i.minQty);
  const sorted = [...pantryItems].sort((a, b) => {
    const aLow = a.minQty && a.qty <= a.minQty;
    const bLow = b.minQty && b.qty <= b.minQty;
    if (aLow && !bLow) return -1;
    if (!aLow && bLow) return 1;
    return a.name.localeCompare(b.name, 'cs');
  });
  return { low, sorted };
}

function updatePantryBadge() {
  const low = pantryItems.filter(i => i.minQty && i.qty <= i.minQty);
  const badge = document.getElementById('shop-pantry-badge');
  if (badge) {
    if (low.length) { badge.textContent = '⚠️ ' + low.length; badge.style.display = ''; }
    else badge.style.display = 'none';
  }
}

function renderShopPantry() {
  const el = document.getElementById('shop-pantry-content');
  if (!el) return;
  const { low, sorted } = getPantrySorted();
  el.innerHTML = buildPantryHtml(low, sorted);
  updatePantryBadge();
}

function renderPantry() {
  const el = document.getElementById('pantry-content');
  if (!el) return;
  const { low, sorted } = getPantrySorted();
  el.innerHTML = buildPantryHtml(low, sorted);
  updatePantryBadge();
  renderShopPantry();
}

window.openPantryAdd = function(prefill = {}) {
  document.getElementById('pantry-add-modal')?.remove();
  const m = document.createElement('div');
  m.id = 'pantry-add-modal';
  m.className = 'moverlay open';
  m.innerHTML = `<div class="modal" style="max-width:380px">
    <h3 style="margin:0 0 14px;font-family:'Playfair Display',serif">🧊 ${prefill.id ? 'Upravit zásobu' : 'Přidat zásobu'}</h3>
    <div style="display:flex;flex-direction:column;gap:10px">
      <input id="pi-name" class="finp" placeholder="Název (např. Mléko)" value="${esc(prefill.name || '')}" style="width:100%;box-sizing:border-box">
      <div style="display:flex;gap:8px">
        <input id="pi-qty" class="finp" type="number" min="0" step="0.1" placeholder="Množství" value="${prefill.qty || ''}" style="flex:1">
        <select id="pi-unit" class="finp" style="flex:1">
          ${['ks','g','kg','ml','l'].map(u=>`<option value="${u}" ${(prefill.unit||'ks')===u?'selected':''}>${u}</option>`).join('')}
        </select>
      </div>
      <input id="pi-min" class="finp" type="number" min="0" step="0.1" placeholder="Min. množství (volitelné, pro upozornění)" value="${prefill.minQty || ''}" style="width:100%;box-sizing:border-box">
    </div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn-sv" style="flex:1" onclick="savePantryItem('${esc(prefill.id || '')}')">✓ Uložit</button>
      <button class="btn-s" onclick="document.getElementById('pantry-add-modal').remove()">Zrušit</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  document.getElementById('pi-name').focus();
};

window.savePantryItem = async function(existingId) {
  const name = document.getElementById('pi-name')?.value.trim();
  const qty = parseFloat(document.getElementById('pi-qty')?.value) || 0;
  const unit = document.getElementById('pi-unit')?.value.trim();
  const minQty = parseFloat(document.getElementById('pi-min')?.value) || 0;

  if (!name) { toast('⚠️ Zadej název'); return; }

  document.getElementById('pantry-add-modal')?.remove();

  const item = { name, qty, unit, minQty: minQty || null, updatedAt: Date.now() };

  if (familyId) {
    const { doc: d, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const id = existingId || Math.random().toString(36).substr(2, 9);
    await setDoc(d(db, 'families', familyId, 'pantry', id), item);
  } else {
    const id = existingId || Math.random().toString(36).substr(2, 9);
    if (existingId) {
      const idx = pantryItems.findIndex(i => i.id === existingId);
      if (idx >= 0) pantryItems[idx] = { id, ...item };
      else pantryItems.push({ id, ...item });
    } else {
      pantryItems.push({ id, ...item });
    }
    lsSave('lp_pantry', pantryItems);
    renderPantry();
  }
  toast('✓ Uloženo');
};

window.changePantryQty = async function(id, delta) {
  const item = pantryItems.find(i => i.id === id);
  if (!item) return;
  item.qty = Math.max(0, (item.qty || 0) + delta);

  if (familyId) {
    const { doc: d, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    await setDoc(d(db, 'families', familyId, 'pantry', id), item);
  } else {
    lsSave('lp_pantry', pantryItems);
    renderPantry();
  }
};

window.deletePantryItem = async function(id) {
  if (!confirm('Smazat tuto zásobu?')) return;

  if (familyId) {
    const { doc: d, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    await deleteDoc(d(db, 'families', familyId, 'pantry', id));
  } else {
    pantryItems = pantryItems.filter(i => i.id !== id);
    lsSave('lp_pantry', pantryItems);
    renderPantry();
  }
};

window.pantryToShop = async function() {
  const low = pantryItems.filter(i => i.minQty && i.qty <= i.minQty);
  if (!low.length) { toast('Žádné docházející zásoby'); return; }
  try {
    let added = 0;
    for (const item of low) {
      const shopItem = { name: item.unit ? `${item.name} (${item.unit})` : item.name, qty: '', category: guessShopCategory(item.name), done: false, createdAt: new Date().toISOString() };
      if (isShopShared()) {
        const { addDoc, collection: col } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        await addDoc(col(db, 'families', familyId, 'shopItems'), shopItem);
      } else {
        await addDoc(collection(db, 'users', CU.uid, 'shopItems'), shopItem);
      }
      added++;
    }
    toast(`✓ ${added} položek přidáno do nákupního seznamu`);
  } catch(e) { toast('❌ Chyba při přidávání do nákupů'); }
};

window.aiShopSuggest = async function() {
  if(!savedRecipes.length){ toast('Nejdřív si ulož nějaké recepty ve Vaření'); return; }
  const btn = document.querySelector('[onclick="aiShopSuggest()"]');
  if(btn){ btn.textContent = '🤖 Analyzuji receptury…'; btn.disabled = true; }
  const recipeNames = savedRecipes.slice(0, 15).map(r => r.name).join(', ');
  const pantryList = pantryItems.map(p => `${p.name} (${p.qty} ${p.unit||'ks'})`).join(', ') || 'prázdné';
  const sys = `Jsi nákupní asistent. Uživatel má uložené recepty a zásoby. Na základě toho doporuč co nakoupit.
Odpovídej POUZE v JSON formátu: {"items":[{"name":"Název","qty":"množství","category":"kategorie"},...]}
Kategorie: "Zelenina & ovoce", "Maso & ryby", "Mléčné výrobky", "Pečivo", "Trvanlivé", "Ostatní"
Doporuč max 10 položek. Nezahrnuj co je v zásobách v dostatečném množství. PRAVIDLO JAZYK: Piš VÝHRADNĚ česky.`;
  try {
    const raw = await callClaude([
      {role:'system',content:sys},
      {role:'user',content:`Moje recepty: ${recipeNames}\nMoje zásoby: ${pantryList}\nCo mám nakoupit?`}
    ], 600);
    const data = JSON.parse(raw.trim().replace(/```json/g,'').replace(/```/g,'').trim());
    if(!data.items?.length){ toast('AI nic nedoporučuje — zásoby jsou v pořádku'); return; }
    const m = document.createElement('div');
    m.className = 'moverlay open';
    m.innerHTML = `<div class="modal" style="max-width:400px">
      <h3 style="margin:0 0 8px;font-family:'Playfair Display',serif">🤖 AI návrh nákupu</h3>
      <p style="font-size:13px;color:var(--text3);margin:0 0 12px">Na základě tvých receptů a zásob doporučuji:</p>
      <div style="max-height:280px;overflow-y:auto;margin-bottom:14px">
        ${data.items.map(i=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:14px;color:var(--text2)">${esc(i.name)}</span>
          <span style="font-size:13px;color:var(--text3)">${esc(i.qty||'')}</span>
        </div>`).join('')}
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-sv" style="flex:1" id="ai-shop-add-btn">✓ Přidat vše do nákupů</button>
        <button class="btn-s" onclick="this.closest('.moverlay').remove()">Zavřít</button>
      </div>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if(e.target===m) m.remove(); });
    document.getElementById('ai-shop-add-btn')?.addEventListener('click', () => { aiShopAddAll(data.items); m.remove(); });
  } catch(e) {
    toast('❌ AI není k dispozici');
  } finally {
    if(btn){ btn.textContent = '🤖 AI návrh nákupu z receptů'; btn.disabled = false; }
  }
};

window.aiShopAddAll = async function(items) {
  for(const i of items){
    const cat = guessShopCategory(i.name);
    if(isShopShared()){
      await addDoc(collection(db,'families',familyId,'shopItems'),{name:i.name,qty:i.qty||'',category:cat,done:false,addedBy:CU.uid,createdAt:new Date().toISOString()});
    } else {
      await addDoc(collection(db,'users',CU.uid,'shopItems'),{name:i.name,qty:i.qty||'',category:cat,done:false,createdAt:new Date().toISOString()});
    }
  }
  switchShopTab('list');
  toast(`✓ ${items.length} položek přidáno do nákupního seznamu`);
};

function parseIngQty(qtyStr) {
  if (!qtyStr) return {amount:1, unit:'ks'};
  const m = String(qtyStr).match(/(\d+(?:[.,]\d+)?)\s*(ks|kg|ml|g\b|l\b|kus|kusy)?/i);
  if (!m) return {amount:1, unit:'ks'};
  const amount = parseFloat(m[1].replace(',','.'));
  let unit = (m[2]||'ks').toLowerCase();
  if(unit==='kus'||unit==='kusy') unit='ks';
  return {amount, unit};
}

function convertUnits(amount, from, to) {
  const f=from?.toLowerCase(), t=to?.toLowerCase();
  if(f===t) return amount;
  if(f==='ml'&&t==='l') return amount/1000;
  if(f==='l'&&t==='ml') return amount*1000;
  if(f==='g'&&t==='kg') return amount/1000;
  if(f==='kg'&&t==='g') return amount*1000;
  return null; // nekompatibilní jednotky
}

function offerPantryDeduct(ingredients) {
  if (!pantryItems.length || !ingredients?.length) return;
  // ingredients může být pole objektů {name,qty} nebo pole stringů
  const normalized = ingredients.map(i => typeof i==='string' ? {name:i,qty:''} : i);
  const matches = normalized.filter(ing => {
    const n = ing.name.toLowerCase();
    return pantryItems.some(p => n.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(n.split(' ')[0]));
  });
  if (!matches.length) return;

  const m = document.createElement('div');
  m.id = 'pantry-deduct-modal';
  m.className = 'moverlay open';
  m.innerHTML = `<div class="modal" style="max-width:400px">
    <h3 style="margin:0 0 8px;font-family:'Playfair Display',serif">🧊 Odečíst ze zásob?</h3>
    <p style="font-size:13px;color:var(--text3);margin:0 0 12px">Chceš odečíst suroviny tohoto receptu ze svých zásob?</p>
    <div style="max-height:200px;overflow-y:auto;margin-bottom:14px">
      ${matches.slice(0,10).map(ing=>`<div style="font-size:13px;padding:4px 0;border-bottom:1px solid var(--border);color:var(--text2)">${esc(ing.name)}${ing.qty?` <span style="color:var(--text3)">${esc(ing.qty)}</span>`:''}</div>`).join('')}
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn-sv" style="flex:1" onclick="deductPantryIngredients(${JSON.stringify(normalized).replace(/"/g,'&quot;')});document.getElementById('pantry-deduct-modal').remove()">Odečíst</button>
      <button class="btn-s" onclick="document.getElementById('pantry-deduct-modal').remove()">Přeskočit</button>
    </div>
  </div>`;
  document.body.appendChild(m);
}

window.deductPantryIngredients = async function(ingredients) {
  const normalized = ingredients.map(i => typeof i==='string' ? {name:i,qty:''} : i);
  let matched = 0;
  for (const ing of normalized) {
    const ingName = ing.name.toLowerCase();
    const pantryItem = pantryItems.find(p => ingName.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(ingName.split(' ')[0]));
    if (!pantryItem || pantryItem.qty <= 0) continue;
    const {amount: ingAmt, unit: ingUnit} = parseIngQty(ing.qty);
    const pantryUnit = (pantryItem.unit||'ks').toLowerCase();
    let deduct = ingAmt;
    if (ingUnit !== pantryUnit) {
      const converted = convertUnits(ingAmt, ingUnit, pantryUnit);
      if (converted === null) { deduct = 1; } // nekompatibilní — odečti 1
      else { deduct = converted; }
    }
    pantryItem.qty = Math.max(0, Math.round((pantryItem.qty - deduct) * 1000) / 1000);
    if (familyId) {
      const { doc: d, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      await setDoc(d(db, 'families', familyId, 'pantry', pantryItem.id), pantryItem);
    }
    matched++;
  }
  if (!familyId) { lsSave('lp_pantry', pantryItems); renderPantry(); }
  toast(matched > 0 ? `✓ ${matched} položek odečteno ze zásob` : 'Žádné suroviny nenalezeny v zásobách');
};

// ── COOKING MIC ───────────────────────────────────────



// ── JOURNAL → COOKING PROPOJENÍ ───────────────────────
let plannedMeals = []; // [{name, source, date}]

window.detectFoodsInEntry = async (text) => {
  const sys = `Jsi asistent pro detekci jídel. Analyzuj text poznámek a najdi jídla která uživatel PLÁNUJE vařit nebo jíst v budoucnu.
Ignoruj jídla která již snědl (minulý čas). Hledej budoucí záměry: "chci vařit", "dám si", "plánuji", "tento týden", "zítra" apod.
Odpovídej POUZE v JSON: {"foods": ["jídlo1", "jídlo2"]} nebo {"foods": []} pokud žádná nejsou.
Maximálně 5 jídel.
PRAVIDLO JAZYK: Piš VÝHRADNĚ česky. Každé slovo v receptu — název, ingredience, kroky i tip — musí být česky. ZAKÁZÁNO použít jakékoliv cizí slovo, včetně anglických, japonských, ruských (cyrilice) nebo arabských výrazů. Cizí jídla popiš česky (např. "noky" ne "gnocchi", "smaženice" ne "scrambled eggs").`;

  try {
    const rawF = await callClaude([{role:'system',content:sys},{role:'user',content:text}], 200);
    if (!rawF) return;
    let raw = rawF.trim().replace(/`{3}json/g,'').replace(/`{3}/g,'').trim();
    const result = JSON.parse(raw);
    if (result.foods && result.foods.length > 0) {
      showFoodDetectBanner(result.foods);
    }
  } catch(e) { /* tiše selhat */ }
};

function showFoodDetectBanner(foods) {
  // Odstraň starý banner pokud existuje
  document.getElementById('food-detect-banner')?.remove();

  const entryArea = document.getElementById('j-edit-area');
  if (!entryArea) return;

  const banner = document.createElement('div');
  banner.id = 'food-detect-banner';
  banner.className = 'food-detect-banner';
  banner.innerHTML = `
    <div class="food-detect-title">🍽️ Rex našel plánovaná jídla v poznámkách</div>
    <div class="food-detect-items">
      ${foods.map(f => `<span class="food-tag">🍳 ${f}</span>`).join('')}
    </div>
    <div class="food-detect-btns">
      <button onclick="addPlannedMeals(${JSON.stringify(foods)},this.closest('.food-detect-banner'))"
        style="background:var(--accent);color:#1a1a1a;border:none;border-radius:8px;padding:8px 16px;font-family:'Crimson Pro',serif;font-size:14px;font-weight:700;cursor:pointer">
        ✅ Přidat do Vaření jako plánovaná
      </button>
      <button onclick="this.closest('.food-detect-banner').remove()"
        style="background:none;border:1px solid var(--border);border-radius:8px;padding:8px 14px;color:var(--text2);font-family:'Crimson Pro',serif;font-size:14px;cursor:pointer">
        Přeskočit
      </button>
    </div>`;
  entryArea.appendChild(banner);
}

window.addPlannedMeals = (foods, bannerEl) => {
  bannerEl?.remove();
  const today = new Date().toLocaleDateString('cs-CZ', {day:'numeric', month:'long'});
  const existing = new Set(plannedMeals.map(m => m.name.toLowerCase()));
  let added = 0;
  foods.forEach(food => {
    if (!existing.has(food.toLowerCase())) {
      plannedMeals.push({name: food, source: `Poznámky ${today}`, date: new Date().toISOString()});
      added++;
    }
  });
  savePlannedMeals();
  renderPlannedMeals();
  toast(`✅ ${added} jídel přidáno do Vaření!`);
};

async function savePlannedMeals() {
  if (!CU) return;
  // Ulož do Firebase — dostupné na všech zařízeních
  await setDoc(doc(db,'users',CU.uid,'profile','plannedMeals'), {items: plannedMeals});
}

async function loadPlannedMeals() {
  if (!CU) return;
  try {
    const snap = await getDoc(doc(db,'users',CU.uid,'profile','plannedMeals'));
    plannedMeals = snap.exists() ? (snap.data().items || []) : [];
  } catch(e) { plannedMeals = []; }
  renderPlannedMeals();
}

function renderPlannedMeals() {
  const section = document.getElementById('planned-meals-section');
  const list = document.getElementById('planned-meals-list');
  if (!section || !list) return;

  if (!plannedMeals.length) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';

  list.innerHTML = plannedMeals.map((m, i) => `
    <div class="planned-meal-card">
      <span class="planned-meal-emoji">🍽️</span>
      <div style="flex:1">
        <div class="planned-meal-name">${m.name}</div>
        <div class="planned-meal-source">📓 ${m.source}</div>
      </div>
      <div class="planned-meal-btns">
        <button class="pm-btn pm-btn-recipe" onclick="cookPlanned('${m.name.replace(/'/g,"\'")}', ${i})">🍳 Vařit</button>
        <button class="pm-btn pm-btn-del" onclick="removePlanned(${i})">×</button>
      </div>
    </div>`).join('');
}

window.cookPlanned = (name, idx) => {
  // Přejdi na vaření s předvyplněným jídlem
  sp('cooking');
  setTimeout(() => {
    const inp = document.getElementById('cook-inp');
    if (inp) { inp.value = name; askRecipe(); }
  }, 200);
};

window.removePlanned = (idx) => {
  plannedMeals.splice(idx, 1);
  savePlannedMeals();
  renderPlannedMeals();
};

window.clearPlannedMeals = () => {
  if (!confirm('Vymazat všechna plánovaná jídla?')) return;
  plannedMeals = [];
  savePlannedMeals();
  renderPlannedMeals();
};


// ── AUTO DETEKCE NÁLADY ZE ZÁPISNÍKU ──────────────────
window.autoDetectMood = async () => {
  const text = document.getElementById('j-text').value.trim();
  if (text.length < 20) { toast('⚠️ Nejprve něco napiš'); return; }

  const btn = document.getElementById('auto-mood-btn');
  btn.textContent = '⏳';
  btn.classList.add('loading');

  const sys = `Jsi asistent pro analýzu nálady. Přečti zápisník a urči náladu autora.
Odpovídej POUZE v JSON (bez markdown):
{"mood": "😄", "reason": "Krátké vysvětlení proč (max 8 slov)"}
Možné hodnoty mood: "😄" (skvělá), "🙂" (dobrá), "😐" (neutrální), "😔" (smutná), "😤" (frustrovaná), "😴" (unavená)
Vyber JEDNU náladu která nejlépe odpovídá celkovému vyznění textu.
PRAVIDLO JAZYK: Piš VÝHRADNĚ česky. Každé slovo v receptu — název, ingredience, kroky i tip — musí být česky. ZAKÁZÁNO použít jakékoliv cizí slovo, včetně anglických, japonských, ruských (cyrilice) nebo arabských výrazů. Cizí jídla popiš česky (např. "noky" ne "gnocchi", "smaženice" ne "scrambled eggs").`;

  try {
    const rawM = await callClaude([{role:'system',content:sys},{role:'user',content:text}], 100);
    if (!rawM) throw new Error('AI není k dispozici');
    let raw = rawM.trim().replace(/`{3}json/g,'').replace(/`{3}/g,'').trim();
    const result = JSON.parse(raw);

    // Zobraz návrh
    const suggest = document.getElementById('mood-suggest');
    suggest.style.display = 'flex';
    suggest.innerHTML = `
      <span style="font-size:22px">${result.mood}</span>
      <div style="flex:1">
        <div style="font-size:13px;color:var(--text);font-weight:600">Rex navrhuje: ${result.mood}</div>
        <div style="font-size:12px;color:var(--text3);margin-top:1px">${result.reason}</div>
      </div>
      <button onclick="acceptMood('${esc(result.mood)}')"
        style="background:var(--accent);color:#1a1a1a;border:none;border-radius:8px;padding:5px 12px;font-family:'Crimson Pro',serif;font-size:13px;font-weight:700;cursor:pointer">
        ✓ Použít
      </button>
      <button onclick="document.getElementById('mood-suggest').style.display='none'"
        style="background:none;border:1px solid var(--border);border-radius:8px;padding:5px 10px;color:var(--text3);font-family:'Crimson Pro',serif;font-size:13px;cursor:pointer">
        ✕
      </button>`;
  } catch(e) {
    toast('❌ ' + e.message);
  }

  btn.textContent = '✨ Auto';
  btn.classList.remove('loading');
};

window.acceptMood = (mood) => {
  // Nastav náladu stejně jako ruční výběr
  entryMood = mood;
  document.querySelectorAll('.j-mood-btn').forEach(b => {
    b.classList.toggle('sel', b.dataset.m === mood);
  });
  document.getElementById('mood-suggest').style.display = 'none';
  markDirty();
  toast(`Nálada ${mood} nastavena!`);
};

// ── ZÁPISNÍK → NÁVYKY PROPOJENÍ ───────────────────────
window.detectHabitsInEntry = async (text) => {

  // Připrav kontext existujících návyků
  const habitCtx = habits.length
    ? habits.map(h => `- "${h.name}" (${h.type==='count'?'počet, cíl '+h.goal:'ano/ne'})`).join('\n')
    : 'žádné';

  const sys = `Jsi asistent pro analýzu poznámek. Analyzuj text a najdi:
1. SPLNĚNÉ AKTIVITY — co uživatel již udělal (minulý čas): "udělal jsem", "šel jsem", "vypil jsem", "jsem splnil" apod.
2. NOVÉ ZÁMĚRY — co chce začít pravidelně dělat: "chci začít", "budu každý den", "mám v plánu pravidelně" apod.

Existující návyky uživatele:
${habitCtx}

Odpovídej POUZE v JSON (bez markdown):
{
  "completed": [
    {"activity": "kliky", "count": 30, "matchesHabit": "kliky", "type": "count"},
    {"activity": "meditace", "count": null, "matchesHabit": null, "type": "check"}
  ],
  "newHabits": [
    {"name": "sklenice vody", "type": "check", "goal": null, "emoji": "💧"},
    {"name": "kliky", "type": "count", "goal": 40, "emoji": "💪"}
  ]
}
- "matchesHabit": název existujícího návyku pokud sedí, jinak null
- "type": "check" nebo "count"
- "goal": číslo pro count typ, null pro check
- "emoji": vhodné emoji
- Vrať prázdné pole pokud nic nenajdeš
- MAX 3 položky v každém poli
- PRAVIDLO JAZYK: Piš VÝHRADNĚ česky. Každé slovo v receptu — název, ingredience, kroky i tip — musí být česky. ZAKÁZÁNO použít jakékoliv cizí slovo, včetně anglických, japonských, ruských (cyrilice) nebo arabských výrazů. Cizí jídla popiš česky (např. "noky" ne "gnocchi", "smaženice" ne "scrambled eggs").`;

  try {
    const rawH = await callClaude([{role:'system',content:sys},{role:'user',content:text}], 400);
    if (!rawH) return;
    let raw = rawH.trim().replace(/`{3}json/g,'').replace(/`{3}/g,'').trim();
    const result = JSON.parse(raw);
    const hasCompleted = result.completed && result.completed.length > 0;
    const hasNew = result.newHabits && result.newHabits.length > 0;
    if (hasCompleted || hasNew) {
      showHabitDetectBanner(result.completed||[], result.newHabits||[]);
    }
  } catch(e) { /* tiše selhat */ }
};

function showHabitDetectBanner(completed, newHabits) {
  document.getElementById('habit-detect-banner')?.remove();
  const entryArea = document.getElementById('j-edit-area');
  if (!entryArea) return;

  const banner = document.createElement('div');
  banner.id = 'habit-detect-banner';
  banner.className = 'habit-detect-banner';

  let html = '<div class="habit-detect-title">🎯 Rex našel aktivity v poznámkách</div>';

  // Splněné aktivity
  if (completed.length > 0) {
    html += '<div style="font-size:12px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Splněno dnes</div>';
    completed.forEach((item, i) => {
      const existingHabit = habits.find(h =>
        item.matchesHabit && h.name.toLowerCase().includes(item.matchesHabit.toLowerCase())
      );
      const label = existingHabit
        ? `Zaznamenat do návyku "${existingHabit.name}"`
        : `Vytvořit návyk "${item.activity}"`;
      const meta = item.type === 'count' && item.count
        ? `${item.count}× dnes · počitatelný`
        : 'splněno dnes · ano/ne';
      const btnData = JSON.stringify({item, existingHabitId: existingHabit?.id||null}).replace(/"/g,'&quot;');
      html += `<div class="habit-detect-card">
        <div class="hdc-info">
          <div class="hdc-name">${item.emoji||'✅'} ${item.activity}${item.count?` — ${item.count}×`:''}</div>
          <div class="hdc-meta">${meta}</div>
        </div>
        <span class="hdc-type">${item.type==='count'?'počet':'ano/ne'}</span>
        <div class="hdc-btns">
          <button onclick="logHabitFromEntry('${encodeURIComponent(JSON.stringify({item, existingHabitId: existingHabit?.id||null}))}')"
            style="background:var(--green);color:#1a1a1a;border:none;border-radius:8px;padding:7px 14px;font-family:'Crimson Pro',serif;font-size:13px;font-weight:700;cursor:pointer">
            ✅ ${existingHabit ? 'Zaznamenat' : 'Vytvořit návyk'}
          </button>
        </div>
      </div>`;
    });
  }

  // Nové záměry
  if (newHabits.length > 0) {
    html += '<div style="font-size:12px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:10px 0 6px">Nové návyky k vytvoření</div>';
    newHabits.forEach((h, i) => {
      const alreadyExists = habits.some(ex => ex.name.toLowerCase() === h.name.toLowerCase());
      if (alreadyExists) return;
      html += `<div class="habit-detect-card">
        <div class="hdc-info">
          <div class="hdc-name">${h.emoji||'🎯'} ${h.name}</div>
          <div class="hdc-meta">${h.type==='count'?`počet · cíl ${h.goal||'?'}×`:'ano/ne'} · každý den</div>
        </div>
        <span class="hdc-type">${h.type==='count'?'počet':'ano/ne'}</span>
        <div class="hdc-btns">
          <button onclick="createHabitFromEntry('${encodeURIComponent(JSON.stringify(h))}')"
            style="background:var(--green);color:#1a1a1a;border:none;border-radius:8px;padding:7px 14px;font-family:'Crimson Pro',serif;font-size:13px;font-weight:700;cursor:pointer">
            + Vytvořit návyk
          </button>
        </div>
      </div>`;
    });
  }

  html += `<button onclick="document.getElementById('habit-detect-banner').remove()"
    style="background:none;border:none;color:var(--text3);font-size:13px;cursor:pointer;margin-top:6px;font-family:'Crimson Pro',serif">
    Přeskočit
  </button>`;

  banner.innerHTML = html;
  entryArea.appendChild(banner);
}

// Zaznamenat splněný návyk (existující nebo nový)
window.logHabitFromEntry = async (dataEnc) => {
  const {item, existingHabitId} = JSON.parse(decodeURIComponent(dataEnc));
  const today = new Date().toISOString().slice(0,10);

  if (existingHabitId) {
    // Zaznamenat do existujícího návyku
    const habit = habits.find(h => h.id === existingHabitId);
    if (!habit) return;
    const logId = existingHabitId + '_' + today;
    const value = item.count || 1;
    const goal = habit.goal || 1;
    const log = {id:logId, habitId:existingHabitId, date:today, done:value>=goal, value};
    await setDoc(doc(db,'users',CU.uid,'habitLogs',logId), log);
    const ex = habitLogs.find(l=>l.id===logId);
    if(ex) Object.assign(ex,log); else habitLogs.push(log);
    document.getElementById('habit-detect-banner')?.remove();
    toast(`✅ "${habit.name}" zaznamenáno${item.count?' ('+item.count+'×)':''}!`);
    renderHabits();
  } else {
    // Vytvořit nový návyk a hned zaznamenat
    const newH = {
      name: item.activity,
      emoji: item.emoji || '✅',
      type: item.type || 'check',
      goal: item.count || 1,
      freq: {type: 'daily'},
      createdAt: new Date().toISOString()
    };
    const ref = await addDoc(collection(db,'users',CU.uid,'habits'), newH);
    newH.id = ref.id;
    // Zaznamenat dnešní splnění
    const logId = ref.id + '_' + today;
    const log = {id:logId, habitId:ref.id, date:today, done:true, value:item.count||1};
    await setDoc(doc(db,'users',CU.uid,'habitLogs',logId), log);
    const exL = habitLogs.find(l=>l.id===logId);
    if (exL) Object.assign(exL, log); else habitLogs.push(log);
    document.getElementById('habit-detect-banner')?.remove();
    toast(`✅ Návyk "${item.activity}" vytvořen a zaznamenán!`);
  }
};

// Vytvořit nový návyk ze záměru
window.createHabitFromEntry = async (dataEnc) => {
  const h = JSON.parse(decodeURIComponent(dataEnc));
  const newH = {
    name: h.name,
    emoji: h.emoji || '🎯',
    type: h.type || 'check',
    goal: h.goal || 1,
    freq: {type: 'daily'},
    createdAt: new Date().toISOString()
  };
  const newRef = await addDoc(collection(db,'users',CU.uid,'habits'), newH);
  // Zaznamenat dnešní splnění pokud je k dispozici
  if (h.logToday) {
    const lId = newRef.id + '_' + new Date().toISOString().slice(0,10);
    const lg = {id:lId, habitId:newRef.id, date:new Date().toISOString().slice(0,10), done:true, value:1};
    await setDoc(doc(db,'users',CU.uid,'habitLogs',lId), lg);
    const exLg = habitLogs.find(l=>l.id===lId);
    if (exLg) Object.assign(exLg, lg); else habitLogs.push(lg);
  }
  // Odstraň tuto kartu z banneru
  document.getElementById('habit-detect-banner')?.remove();
  toast(`✅ Návyk "${h.name}" vytvořen! Najdeš ho v Návycích.`);
};


// Helper: vytvoří bot bublinu s avatar row wrapperem
function makeBotBubble(htmlContent, labelEmoji='', labelName=''){
  const row=document.createElement('div');
  row.className='msg-row bot-row';
  const avDiv=document.createElement('div');
  avDiv.className='msg-av';
  const av=(typeof AVATARS!=='undefined'&&typeof userData!=='undefined'&&userData?.avatar&&AVATARS[userData.avatar])?AVATARS[userData.avatar]:null;
  avDiv.textContent=av?av.emoji:(labelEmoji||'⭐');
  const bubble=document.createElement('div');
  bubble.className='msg bot';
  const lbl=labelName?`<div class="mlbl">${labelEmoji||''} ${labelName}</div>`:'';
  bubble.innerHTML=lbl+htmlContent;
  row.appendChild(avDiv);row.appendChild(bubble);
  return {row,bubble};
}

function appendMsg(role,text,nm='',em=''){
  const c=document.getElementById('chatmsgs');
  const now=new Date().toLocaleTimeString('cs-CZ',{hour:'2-digit',minute:'2-digit'});
  if(role==='sys'){
    const d=document.createElement('div');
    d.className='msg sys';
    d.textContent=text;
    c.appendChild(d);
    scrollChat();return;
  }
  const row=document.createElement('div');
  row.className='msg-row '+(role==='user'?'user-row':'bot-row');
  const avDiv=document.createElement('div');
  avDiv.className='msg-av '+(role==='user'?'user-av':'');
  if(role==='bot'){
    const av=(typeof AVATARS!=='undefined'&&typeof userData!=='undefined'&&userData?.avatar&&AVATARS[userData.avatar])?AVATARS[userData.avatar]:null;
    avDiv.textContent=av?av.emoji:(em||'⭐');
  } else {
    avDiv.textContent='👤';
  }
  const bubble=document.createElement('div');
  bubble.className='msg '+role;
  if(role==='bot'){
    const lbl=nm?`<div class="mlbl">${em||''} ${nm}</div>`:'';
    bubble.innerHTML=lbl+esc(text).replace(/\n/g,'<br>')+`<span class="msg-time">${now}</span>`;
  } else {
    bubble.innerHTML=esc(text).replace(/\n/g,'<br>')+`<span class="msg-time">${now}</span>`;
  }
  if(role==='user'){row.appendChild(bubble);row.appendChild(avDiv);}
  else{row.appendChild(avDiv);row.appendChild(bubble);}
  c.appendChild(row);
  scrollChat();
}
function scrollChat(){const c=document.getElementById('chatmsgs');c.scrollTop=c.scrollHeight;}

// ── TOUR / PRŮVODCE ───────────────────────────────────

const TOUR_MODULES = {
  dashboard: {
    title: 'Domovská obrazovka 🏠',
    text: 'Tady vidíš přehled celého dne — splněné návyky, nadcházející události, jídlo a rychlý přístup ke všemu. Každé ráno začni tady.'
  },
  habits: {
    title: 'Návyky 🎯',
    text: 'Sleduj své denní rutiny — cvičení, čtení, pití vody... Každý den je zaškrtni a buduj streak. Návyky jsou propojené s tvými cíli.'
  },
  journal: {
    title: 'Poznámky 📝',
    text: 'Místo pro tvoje myšlenky, pocity a zážitky. Piš co chceš — krátce nebo dlouze. Můžeš přidat náladu nebo nahrát hlasový záznam.'
  },
  calendar: {
    title: 'Kalendář 📅',
    text: 'Plánuj události, schůzky a připomínky. Vše co si přidáš tady uvidíš i na domovské obrazovce.'
  },
  goals: {
    title: 'Cíle 🌟',
    text: 'Napiš svoji velkou životní vizi a rozděl ji na konkrétní cíle. Každý cíl propoj s návyky a uvidíš jak se každý den posouvat dál.'
  },
  cooking: {
    title: 'Vaření 🍳',
    text: 'Řekni mi co chceš vařit a já ti navrhnu recept s ingrediencemi. Recept si ulož a ingredience přidej jedním kliknutím do nákupního seznamu.'
  },
  shopping: {
    title: 'Nákupy 🛒',
    text: 'Nákupní seznam který se sám plní z receptů. Přidej položky ručně nebo nechej recept přidat ingredience automaticky. Sdílej seznam s rodinou.'
  },
  mealplan: {
    title: 'Jídelníček 🍽️',
    text: 'Naplánuj jídla na celý týden — snídaně, obědy i večeře. Vyber z uložených receptů a jedním kliknutím přidej všechny ingredience do nákupu.'
  },

  avatar: {
    title: `${(()=>{try{const av=AVS?.find(a=>a.id===prof?.avatarId);return av?av.emoji+' '+av.name:'Rex 🐺';}catch(e){return 'Tvůj společník ⭐';}})()}`,
    text: 'Tady si promluvíme. Zeptej se mě na cokoliv — cíle, recepty, jak se ti daří. Čím víc mi řekneš, tím lépe ti poradím. Můžeš i nahrát hlasový vzkaz.'
  }
};

// Spustit uvítací tour pro nového uživatele
function startWelcomeTour() {
  const av = AVS.find(a => a.id === prof?.avatarId) || AVS[0];
  const name = prof?.prezdivka || prof?.nickname || 'příteli';

  const modal = document.createElement('div');
  modal.id = 'tour-welcome';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto';
  modal.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:22px;padding:28px 24px;width:100%;max-width:360px;text-align:center">
      <div style="font-size:52px;margin-bottom:12px">${av.emoji}</div>
      <div style="font-family:'Playfair Display',serif;font-style:italic;font-size:22px;color:var(--accent);font-weight:700;margin-bottom:8px">Vítej, ${name}!</div>
      <div style="font-size:15px;color:var(--text2);line-height:1.6;margin-bottom:6px">
        Jsem <strong>${av.name}</strong>, tvůj osobní společník v LifePocket.
      </div>
      <div style="font-size:14px;color:var(--text3);line-height:1.6;margin-bottom:24px">
        Jsem tady vždy když mě budeš potřebovat — pomůžu ti s cíli, recepty, návyky i poznámkami. Chceš si se mnou projít co všechno LifePocket umí?
      </div>
      <button onclick="startModuleTour()" style="width:100%;background:var(--accent);border:none;border-radius:12px;padding:13px;font-family:'Crimson Pro',serif;font-size:16px;color:#1a1a1a;font-weight:700;cursor:pointer;margin-bottom:10px">
        🗺️ Ukáž mi co umíš!
      </button>
      <button onclick="dismissTour()" style="width:100%;background:none;border:1px solid var(--border);border-radius:12px;padding:11px;font-family:'Crimson Pro',serif;font-size:15px;color:var(--text3);cursor:pointer">
        Prozkoumám sám, díky
      </button>
    </div>`;
  document.body.appendChild(modal);
}

// Tour po modulech — spotlight + popis
const TOUR_STEPS = ['dashboard','habits','journal','cooking','shopping','goals'];
let _tourStep = 0;

window.startModuleTour = () => {
  document.getElementById('tour-welcome')?.remove();
  _tourStep = 0;
  showTourStep();
};

function showTourStep() {
  document.getElementById('tour-step')?.remove();
  document.getElementById('tour-overlay')?.remove();

  const activeModules = [...(prof.modules || []), 'dashboard', 'avatar'];
  const steps = TOUR_STEPS.filter(s => activeModules.includes(s) || s === 'dashboard');

  if(_tourStep >= steps.length) {
    finishTour();
    return;
  }

  const moduleId = steps[_tourStep];
  const info = TOUR_MODULES[moduleId];
  const av = AVS.find(a => a.id === prof?.avatarId) || AVS[0];

  // Přepni na danou stránku
  sp(moduleId);

  // Overlay s info bublinou
  const overlay = document.createElement('div');
  overlay.id = 'tour-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99998;pointer-events:none';
  document.body.appendChild(overlay);

  const bubble = document.createElement('div');
  bubble.id = 'tour-step';
  bubble.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:99999;width:calc(100% - 32px);max-width:400px';
  bubble.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--accent);border-radius:18px;padding:20px;box-shadow:0 8px 32px rgba(0,0,0,.4)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span style="font-size:26px">${av.emoji}</span>
        <div style="font-family:'Playfair Display',serif;font-style:italic;font-size:17px;color:var(--accent);font-weight:700">${info.title}</div>
      </div>
      <div style="font-size:14px;color:var(--text2);line-height:1.6;margin-bottom:16px">${info.text}</div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:12px;color:var(--text3)">${_tourStep + 1} / ${steps.length}</div>
        <div style="display:flex;gap:8px">
          <button onclick="dismissTour()" style="background:none;border:1px solid var(--border);border-radius:8px;padding:8px 14px;font-family:'Crimson Pro',serif;font-size:14px;color:var(--text3);cursor:pointer">Přeskočit</button>
          <button onclick="nextTourStep()" style="background:var(--accent);border:none;border-radius:8px;padding:8px 18px;font-family:'Crimson Pro',serif;font-size:14px;color:#1a1a1a;font-weight:700;cursor:pointer">${_tourStep + 1 < steps.length ? 'Další →' : '🎉 Hotovo!'}</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(bubble);
}

window.nextTourStep = () => {
  _tourStep++;
  showTourStep();
};

function finishTour() {
  document.getElementById('tour-step')?.remove();
  document.getElementById('tour-overlay')?.remove();
  localStorage.setItem('lp_tour_done', '1');
  sp('dashboard');

  const av = AVS.find(a => a.id === prof?.avatarId) || AVS[0];
  const name = prof?.prezdivka || prof?.nickname || 'příteli';
  setTimeout(() => {
    const done = document.createElement('div');
    done.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto';
    done.innerHTML = `
      <div style="background:var(--card);border:1px solid var(--border);border-radius:22px;padding:28px 24px;width:100%;max-width:340px;text-align:center">
        <div style="font-size:48px;margin-bottom:12px">🎉</div>
        <div style="font-family:'Playfair Display',serif;font-style:italic;font-size:20px;color:var(--accent);font-weight:700;margin-bottom:10px">To je vše, ${name}!</div>
        <div style="font-size:14px;color:var(--text2);line-height:1.6;margin-bottom:20px">Teď víš co LifePocket umí. Kdykoliv budeš chtít průvodce znovu, najdeš ho v ⚙️ Nastavení.</div>
        <button onclick="this.closest('div[style]').remove()" style="width:100%;background:var(--accent);border:none;border-radius:12px;padding:13px;font-family:'Crimson Pro',serif;font-size:16px;color:#1a1a1a;font-weight:700;cursor:pointer">
          Jdeme na to! 💪
        </button>
      </div>`;
    document.body.appendChild(done);
    done.addEventListener('click', e => { if(e.target===done) done.remove(); });
  }, 300);
}

window.dismissTour = () => {
  document.getElementById('tour-welcome')?.remove();
  document.getElementById('tour-step')?.remove();
  document.getElementById('tour-overlay')?.remove();
  localStorage.setItem('lp_tour_done', '1');
};

// Kontextové nápovědy při první návštěvě modulu
function showModuleHint(moduleId) {
  const key = 'lp_hint_' + moduleId;
  if(localStorage.getItem(key)) return; // už viděl
  if(!localStorage.getItem('lp_tour_done')) return; // probíhá tour, nepřekrývat
  const info = TOUR_MODULES[moduleId];
  if(!info) return;
  const av = AVS.find(a => a.id === prof?.avatarId) || AVS[0];

  localStorage.setItem(key, '1');

  const hint = document.createElement('div');
  hint.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:9999;width:calc(100% - 32px);max-width:400px;animation:fadeIn .3s ease';
  hint.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--accent);border-radius:16px;padding:16px 18px;box-shadow:0 6px 24px rgba(0,0,0,.3);display:flex;gap:12px;align-items:flex-start">
      <span style="font-size:24px;flex-shrink:0">${av.emoji}</span>
      <div style="flex:1">
        <div style="font-family:'Playfair Display',serif;font-style:italic;font-size:15px;color:var(--accent);font-weight:700;margin-bottom:4px">${info.title}</div>
        <div style="font-size:13px;color:var(--text2);line-height:1.5">${info.text}</div>
      </div>
      <button onclick="this.closest('div[style]').remove()" style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer;flex-shrink:0;line-height:1;padding:0 0 0 4px">×</button>
    </div>`;
  document.body.appendChild(hint);
  setTimeout(() => hint.remove(), 8000); // zmizí po 8s
}

// Spustit tour po dokončení onboardingu nebo při initApp pro nové uživatele
const _origFinishOnboard = window.finishOnboard;
window.finishOnboard = async () => {
  localStorage.setItem('lp_tour_pending', '1');
  await _origFinishOnboard();
  setTimeout(startWelcomeTour, 1000);
};

// Pro existující uživatele kteří tour ještě neviděli (ne nové registrace)
const _origInitApp = initApp;
window.initApp = function(){
  _origInitApp();
  if(!localStorage.getItem('lp_tour_done') && !localStorage.getItem('lp_tour_pending') && prof?.createdAt) {
    setTimeout(startWelcomeTour, 2000);
  }
  localStorage.removeItem('lp_tour_pending');
}

// Přidat hint do sp() pro první návštěvy
const _origSp = window.sp;
window.sp = id => {
  _origSp(id);
  if(id !== 'dashboard' && id !== 'settings') {
    setTimeout(() => showModuleHint(id), 500);
  }
};

// Kontaktní formulář
window.sendContactMsg = async () => {
  const msg = document.getElementById('contact-msg')?.value?.trim();
  const emailEl = document.getElementById('contact-email');
  const replyEmail = emailEl?.value?.trim() || 'neuveden';
  if(!msg) { toast('⚠️ Napiš zprávu'); return; }
  const btn = document.querySelector('[onclick="sendContactMsg()"]');
  if(btn) { btn.disabled = true; btn.textContent = '⏳ Odesílám…'; }
  try {
    const res = await fetch('https://formspree.io/f/xlgpyjaa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ email: replyEmail, message: msg, user: prof.nickname || CU?.email || 'anon' })
    });
    if(res.ok) {
      document.getElementById('contact-msg').value = '';
      if(emailEl) emailEl.value = '';
      toast('✓ Zpráva odeslána, díky!');
    } else {
      toast('❌ Chyba při odesílání, zkus to znovu');
    }
  } catch(e) {
    toast('❌ Chyba: ' + e.message);
  } finally {
    if(btn) { btn.disabled = false; btn.textContent = '📨 Odeslat zprávu'; }
  }
};

window.handleContactSubmit = async function(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('.cf-submit');
  btn.disabled = true;
  btn.textContent = '⏳ Odesílám...';
  try {
    const res = await fetch('https://formspree.io/f/xlgpyjaa', {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      form.style.display = 'none';
      const successEl = document.getElementById('contact-success');
      if (successEl) successEl.style.display = 'block';
    } else {
      btn.disabled = false;
      btn.textContent = '📤 Odeslat zprávu';
      toast('❌ Chyba při odesílání. Zkus to znovu.');
    }
  } catch(err) {
    btn.disabled = false;
    btn.textContent = '📤 Odeslat zprávu';
    toast('❌ Chyba při odesílání.');
  }
};

// Restart tour z nastavení
window.restartTour = () => {
  // Smaž všechny hint záznamy
  Object.keys(localStorage).filter(k => k.startsWith('lp_hint_')).forEach(k => localStorage.removeItem(k));
  localStorage.removeItem('lp_tour_done');
  startWelcomeTour();
};

// iOS PWA Banner
{
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const iosDismissed = localStorage.getItem('ios-dismissed');
  if (isIOS && !isStandalone && !iosDismissed) {
    setTimeout(() => { document.getElementById('ios-banner').style.display = 'block'; }, 3000);
  }
}
