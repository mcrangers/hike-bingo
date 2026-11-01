/* Trail Bingo · MC Rangers
 * Game logic. Cards are stored per phone in localStorage; live settings come from config.json.
 * https://github.com/mcrangers/hike-bingo */

/* ===== Organiser settings: edit these ===== */
const CONFIG = {
  eventName: "Hike Bingo",
  // Change this list to whatever "colleges" means for your group.
  colleges: ["Chung Chi","Morningside","S.H. Ho"],
  // "line" = one full row/column/diagonal wins; "blackout" = whole card
  winCondition: "blackout",
  // How many squares the same person can sign on one card
  maxSignsPerPerson: 3,
  // Loading screen (MC Rangers x CCIA & SHHOISA). true = show it, false = skip it
  // NOTE: anything listed in REMOTE_KEYS below is controlled from admin.html
  // (saved in config.json). The values here are only fallbacks.
  showSplash: false,

  /* ----- Exco-only tiles ----- */
  // How many squares on a card can be signed by people from the player's OWN college (0 = none)
  ownCollegeSigns: 4,
  excoEnabled: true,
  // How many exco-only tiles each card gets (0 = none)
  excoTiles: 4,
  // Code exco type to sign an exco tile. Set it from admin.html.
  excoCode: "",
  // true = exco can sign even if they're from the player's own college
  excoAnyCollege: true,
  // How many exco tiles the same exco member can sign on one card
  excoSignsPerExco: 1,
  excoPrompts: [
    "Why they joined MC Rangers","Their best tip for this trail","High-five at a viewpoint",
    "Their favourite hiking snack","One fun fact about them","Their best hike ever"
  ],
  prompts: [
    "Has hiked Lion Rock before","Is a first-year student","Speaks 3 or more languages","Was born outside Hong Kong",
    "Can name 3 HK hiking trails","Has watched a sunrise from a peak","Brought more than 2 snacks","Has a pet at home",
    "Can do 10 push-ups right now","Plays a musical instrument","Shares your birth month","Has never been to Lantau",
    "Studies in a different faculty","Has been camping overnight","Taught you a word in their language","Has the same favourite food as you",
    "Has a hidden talent (ask!)","Lives in a hall on campus","Brought a reusable bottle","Has run a 10K or more",
    "Has visited 5+ countries","Told you a joke that made you laugh","Is a morning person","Has a part-time job",
    "Recommended you a song","Is left-handed","Can name all 9 CUHK colleges","Wants to start a business",
    "Is wearing something green","Took a selfie with you on the trail","Has seen a wild monkey in HK","Is the youngest in their family"
  ]
};
/* ========================================== */

/* ---------- admin settings (config.json) ---------- */
const RKEY = "trailbingo:remote";
// Every setting the admin page can change. Add new admin toggles here.
const REMOTE_KEYS = ["showSplash","winCondition","maxSignsPerPerson","ownCollegeSigns","excoEnabled","excoTiles","excoCode","excoCodeHash","excoAnyCollege","excoSignsPerExco"];
function applyRemote(r){ if(r && typeof r==="object") REMOTE_KEYS.forEach(k => { if(k in r) CONFIG[k] = r[k]; }); }
try{ applyRemote(JSON.parse(localStorage.getItem(RKEY))); }catch(e){}
const excoOn = () => CONFIG.excoEnabled !== false && Number(CONFIG.excoTiles) > 0;
const xo = c => !!(c && c.exco && CONFIG.excoEnabled !== false);

// Only for an older hidden code (excoCodeHash); a plain excoCode replaces it
async function hashCode(code){
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(String(code).trim().toLowerCase()), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode("mcrangers/hike-bingo/exco"), iterations: 100000 }, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, "0")).join("");
}

const KEY = "trailbingo:v1";
const $ = s => document.querySelector(s);
let S = load();

function load(){ try{ return JSON.parse(localStorage.getItem(KEY)) || null }catch(e){ return null } }
function save(){ localStorage.setItem(KEY, JSON.stringify(S)) }
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a }
const norm = s => (s||"").trim().toLowerCase().replace(/\s+/g," ");
const esc = s => (s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function collegeOptions(sel, placeholder){
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    CONFIG.colleges.map(c=>`<option>${esc(c)}</option>`).join("") +
    (CONFIG.allowOther ? `<option value="__other">Other…</option>` : "");
}

/* ---------- views ---------- */
function show(id){
  ["setup","game","reward"].forEach(v=>$("#"+v).classList.toggle("hidden", v!==id));
  $("#topRight").innerHTML = S ? `<button class="ghost" id="resetBtn" type="button">Reset</button>` : `<span class="chip">${esc(CONFIG.eventName)}</span>`;
  const rb = $("#resetBtn"); if(rb) rb.onclick = confirmReset;
  window.scrollTo(0,0);
}

function refreshRules(){
  const mx = Number(CONFIG.maxSignsPerPerson) || 1;
  $("#ruleSigns").textContent = mx===1 ? "Each person can only sign one square, so keep meeting new people." : `Each person can sign up to ${mx} squares on your card, so keep meeting new people.`;
  const own = Math.max(0, Number(CONFIG.ownCollegeSigns) || 0);
  $("#ruleCollege").innerHTML = own === 0
    ? "They must be from a <strong>different college</strong> than you."
    : `Find people from <strong>other colleges</strong>. Only ${own} square${own===1?"":"s"} can be signed by people from your own college.`;
  $("#ruleExcoRow").classList.toggle("hidden", !excoOn());
  $("#ruleWin").textContent = CONFIG.winCondition==="blackout"
    ? "First to fill the whole card wins. Show your winning card to an MC Rangers exco."
    : "First to get a full line wins. Show your winning card to an MC Rangers exco.";
}

function initSetup(){
  collegeOptions($("#pCollege"), "Choose your college");
  $("#pCollege").onchange = e => $("#pCollegeOther").classList.toggle("hidden", e.target.value!=="__other");
  refreshRules();
  $("#setupForm").onsubmit = e => {
    e.preventDefault();
    const name = $("#pName").value.trim();
    let college = $("#pCollege").value;
    if(college==="__other") college = $("#pCollegeOther").value.trim();
    if(!name) return $("#setupErr").textContent = "Add your name first.";
    if(!college) return $("#setupErr").textContent = "Pick your college.";
    const nEx = Math.min(excoOn() ? Number(CONFIG.excoTiles) : 0, (CONFIG.excoPrompts||[]).length, 24);
    const picks = shuffle([
      ...shuffle(CONFIG.prompts).slice(0,24-nEx).map(p=>({ prompt:p })),
      ...shuffle(CONFIG.excoPrompts||[]).slice(0,nEx).map(p=>({ prompt:p, exco:true }))
    ]);
    picks.splice(12,0,{ prompt:null }); // free centre
    S = { name, college, startedAt: Date.now(), cells: picks.map(p=>({ ...p, who:null, whoCollege:null, note:"" })), wonAt:null };
    save(); renderGame(); show("game");
  };
}

/* ---------- logic ---------- */
const LINES = (()=>{ const L=[]; for(let i=0;i<5;i++){ L.push([0,1,2,3,4].map(j=>i*5+j)); L.push([0,1,2,3,4].map(j=>j*5+i)); } L.push([0,6,12,18,24]); L.push([4,8,12,16,20]); return L })();
const filled = i => i===12 || !!S.cells[i].who;
function completedLines(){ return LINES.filter(l=>l.every(filled)) }
function doneCount(){ return S.cells.filter((c,i)=>i!==12 && c.who).length }
function collegesMet(){ return new Set(S.cells.filter(c=>c.who).map(c=>norm(c.whoCollege))).size }
function hasWon(){ return CONFIG.winCondition==="blackout" ? doneCount()===24 : completedLines().length>0 }

/* ---------- render ---------- */
function renderGame(popIdx){
  const winSet = new Set(completedLines().flat());
  $("#board").innerHTML = S.cells.map((c,i)=>{
    if(i===12) return `<div class="sq free ${winSet.has(i)?'win':''}" role="gridcell">FREE<br>trail start</div>`;
    const d = !!c.who;
    return `<button class="sq ${d?'done':''} ${xo(c)?'exco':''} ${winSet.has(i)?'win':''} ${popIdx===i?'pop':''}" data-i="${i}" role="gridcell"
      aria-label="${xo(c)?'Exco tile: ':''}${esc(c.prompt)}${d?', signed by '+esc(c.who):''}">
      ${xo(c)&&!d?'<span class="xtag">EXCO</span>':''}<span class="txt">${esc(c.prompt)}</span>
      ${d?`<span class="who">${esc(c.who)}<small>${esc(c.whoCollege)}</small></span>`:""}
    </button>`;
  }).join("");
  $("#board").querySelectorAll("button.sq").forEach(b=>b.onclick=()=>openSheet(+b.dataset.i));
  const dc = doneCount(), ln = completedLines().length;
  $("#sDone").textContent = dc; $("#sLines").textContent = ln; $("#sCols").textContent = collegesMet();
  $("#bar").style.width = (dc/24*100)+"%";
  const won = hasWon();
  $("#banner").innerHTML = won
    ? `<div class="banner"><div class="big">${dc===24?'FULL CARD':'BINGO'}</div><p>First to finish wins. Find an MC Rangers exco now.</p></div>` : "";
  $("#ticketBtn").classList.toggle("hidden", !won);
  if(won && !S.wonAt){ S.wonAt = Date.now(); save(); confetti(); }
}

function openSheet(i){
  const c = S.cells[i];
  $("#sheetRoot").innerHTML = `
  <div class="scrim" id="scrim">
    <form class="sheet" id="sheetForm" role="dialog" aria-modal="true" aria-labelledby="shTitle" novalidate>
      <div class="tag">${xo(c)?'Exco-only tile':'Find someone who…'}</div>
      <h2 id="shTitle">${esc(c.prompt)}</h2>
      <p class="sub">${xo(c) ? 'Find an MC Rangers exco. They type their name and the exco code to sign.' : `They must be from a college other than ${esc(S.college)}.`}</p>
      <label for="wName">${xo(c)?'Exco name':'Their name'}</label>
      <input type="text" id="wName" maxlength="40" placeholder="Ask them to type it" value="${esc(c.who||"")}">
      <label for="wCollege">Their college</label>
      <select id="wCollege"></select>
      <input type="text" id="wCollegeOther" class="hidden" placeholder="Type their college" maxlength="40" style="margin-top:8px">
      <label for="wNote">Note (optional)</label>
      <input type="text" id="wNote" maxlength="80" placeholder="e.g. the word they taught you" value="${esc(c.note||"")}">
      ${xo(c)?`<label for="wCode">Exco code</label>
      <input type="password" id="wCode" inputmode="numeric" autocomplete="off" maxlength="12" placeholder="Exco types this">`:''}
      <div class="err" id="wErr"></div>
      <div class="row">
        ${c.who?`<button class="btn warn" type="button" id="wClear">Clear</button>`:`<button class="btn line" type="button" id="wCancel">Cancel</button>`}
        <button class="btn" type="submit">Sign square</button>
      </div>
    </form>
  </div>`;
  const sel = $("#wCollege"); collegeOptions(sel, "Choose their college");
  if(c.whoCollege){ if(CONFIG.colleges.includes(c.whoCollege)) sel.value=c.whoCollege; else { sel.value="__other"; $("#wCollegeOther").classList.remove("hidden"); $("#wCollegeOther").value=c.whoCollege } }
  sel.onchange = e => $("#wCollegeOther").classList.toggle("hidden", e.target.value!=="__other");
  const close = ()=> $("#sheetRoot").innerHTML="";
  $("#scrim").onclick = e => { if(e.target.id==="scrim") close() };
  document.onkeydown = e => { if(e.key==="Escape") close() };
  if($("#wCancel")) $("#wCancel").onclick = close;
  if($("#wClear")) $("#wClear").onclick = ()=>{ S.cells[i]={...c,who:null,whoCollege:null,note:""}; if(!hasWon()) S.wonAt=null; save(); close(); renderGame(); };
  setTimeout(()=>{const w=$("#wName"); if(w) w.focus()}, 50);
  $("#sheetForm").onsubmit = async e => {
    e.preventDefault();
    const who = $("#wName").value.trim();
    let col = sel.value; if(col==="__other") col = $("#wCollegeOther").value.trim();
    const err = m => $("#wErr").textContent = m;
    if(!who) return err("Add their name.");
    if(!col) return err("Pick their college.");
    if(xo(c)){
      const typed = ($("#wCode").value||"").trim();
      if(!typed) return err("Ask an MC Rangers exco to type the exco code.");
      const ok = CONFIG.excoCode ? norm(typed) === norm(CONFIG.excoCode)
        : !!CONFIG.excoCodeHash && await hashCode(typed) === CONFIG.excoCodeHash;
      if(!ok) return err("That exco code isn't right. Only exco know it.");
      const exMax = Math.max(1, Number(CONFIG.excoSignsPerExco) || 1);
      const exUsed = S.cells.filter((x,j)=>j!==i && xo(x) && x.who && norm(x.who)===norm(who)).length;
      if(exUsed >= exMax) return err(exMax===1 ? `${who} already signed an exco tile. Find a different exco member.` : `${who} has already signed ${exMax} exco tiles, the limit. Find a different exco member.`);
    }
    const sameCol = norm(col)===norm(S.college);
    if(sameCol && !(xo(c) && CONFIG.excoAnyCollege)){
      // exco tiles don't count toward the own-college allowance
      const own = Math.max(0, Number(CONFIG.ownCollegeSigns) || 0);
      const ownUsed = S.cells.filter((x,j)=>j!==i && x.who && !xo(x) && norm(x.whoCollege)===norm(S.college)).length;
      if(ownUsed >= own) return err(own===0
        ? `They're from ${S.college} too. Find someone from another college.`
        : `You've used all ${own} ${S.college} squares. Find someone from another college.`);
    }
    if(norm(who)===norm(S.name)) return err("You can't sign your own square.");
    const max = CONFIG.maxSignsPerPerson || 1;
    const used = S.cells.filter((x,j)=>j!==i && x.who && norm(x.who)===norm(who)).length;
    if(used >= max) return err(max===1 ? `${who} already signed a square. Find someone new.` : `${who} has already signed ${max} squares, the limit. Find someone new.`);
    S.cells[i] = { ...c, who, whoCollege: col, note: $("#wNote").value.trim() };
    save(); close(); renderGame(i);
  };
}

function showTicket(){
  const dc = doneCount();
  $("#tTag").textContent = "Winning card · show an MC Rangers exco";
  $("#tTitle").textContent = dc===24 ? "FULL CARD" : "BINGO";
  $("#tName").textContent = S.name; $("#tCollege").textContent = S.college;
  $("#tPeople").textContent = new Set(S.cells.filter(c=>c.who).map(c=>norm(c.who))).size;
  const t = new Date(S.wonAt||Date.now());
  $("#tTime").textContent = t.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"});
  $("#tClock").textContent = t.toLocaleDateString([], {weekday:"short", day:"numeric", month:"short"});
  // The whole card, so the exco can check every square and who signed it
  const win = new Set(completedLines().flat());
  $("#tBoard").innerHTML = S.cells.map((c,i) => i===12
    ? `<div class="tc free">FREE</div>`
    : `<div class="tc ${c.who?'done':''} ${xo(c)?'exco':''} ${win.has(i)?'win':''}"><span class="p">${esc(c.prompt)}</span>${c.who?`<b>${esc(c.who)}</b><i>${esc(c.whoCollege)}</i>`:'<i>–</i>'}</div>`).join("");
  show("reward");
}

function confirmReset(){
  $("#sheetRoot").innerHTML = `<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true">
    <div class="tag">Start over</div><h2>Reset your card?</h2><p class="sub">This clears every square and gives you a new shuffled card.</p>
    <div class="row"><button class="btn line" type="button" id="rNo">Keep my card</button><button class="btn warn" type="button" id="rYes">Reset</button></div></div></div>`;
  const close=()=>$("#sheetRoot").innerHTML="";
  $("#rNo").onclick=close; $("#scrim").onclick=e=>{if(e.target.id==="scrim")close()};
  $("#rYes").onclick=()=>{ localStorage.removeItem(KEY); S=null; close(); $("#setupForm").reset(); $("#pCollegeOther").classList.add("hidden"); show("setup") };
}

/* ---------- confetti ---------- */
function confetti(){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv=$("#confetti"), ctx=cv.getContext("2d"); cv.width=innerWidth; cv.height=innerHeight;
  const cols=["#f2a541","#5e7d4f","#1f3a2e","#f6f1e7","#d9822b"];
  const P=Array.from({length:140},()=>({x:Math.random()*cv.width,y:-20-Math.random()*cv.height*.5,r:4+Math.random()*5,c:cols[Math.random()*5|0],vy:2+Math.random()*3,vx:-1.5+Math.random()*3,a:Math.random()*6}));
  let f=0; (function tick(){ ctx.clearRect(0,0,cv.width,cv.height);
    P.forEach(p=>{p.y+=p.vy;p.x+=p.vx;p.a+=.1;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);ctx.fillStyle=p.c;ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*1.6);ctx.restore()});
    if(++f<200) requestAnimationFrame(tick); else ctx.clearRect(0,0,cv.width,cv.height) })();
}

/* ---------- boot ---------- */
$("#backBtn").onclick = ()=>{ renderGame(); show("game") };
$("#ticketBtn").onclick = showTicket;
document.title = "Trail Bingo · MC Rangers";
initSetup();
/* ---------- offline + add to home screen ---------- */
if("serviceWorker" in navigator && location.protocol.startsWith("http")){
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(()=>{}));
}
let installEvt = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; });
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
if(standalone) $("#foot").classList.add("hidden");
addEventListener("appinstalled", () => $("#foot").classList.add("hidden"));
$("#installLink").onclick = async () => {
  if(installEvt){ installEvt.prompt(); await installEvt.userChoice.catch(()=>{}); installEvt = null; return; }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
  const steps = ios
    ? ["Tap the <strong>Share</strong> button in Safari (square with an arrow).","Scroll down and tap <strong>Add to Home Screen</strong>.","Tap <strong>Add</strong>, then open Trail Bingo from your home screen."]
    : ["Open your browser menu (<strong>⋮</strong> in Chrome).","Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>.","Open Trail Bingo from your home screen."];
  $("#sheetRoot").innerHTML = `<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="iT">
    <div class="tag">Optional</div><h2 id="iT">Add to Home Screen</h2>
    <p class="sub">Opens full-screen and works with no signal on the trail.</p>
    <div class="steps">${steps.map((s,i)=>`<div><b>${i+1}</b><span>${s}</span></div>`).join("")}</div>
    ${ios ? `<p class="note">On iPhone, the home screen app keeps its own card. Add it <strong>before</strong> you start playing, or your Safari card won't carry over.</p>` : ""}
    <button class="btn line" type="button" id="iClose">Got it</button></div></div>`;
  const close = () => $("#sheetRoot").innerHTML = "";
  $("#iClose").onclick = close; $("#scrim").onclick = e => { if(e.target.id==="scrim") close(); };
};
(function splash(){
  const sp = $("#splash"); if(!sp) return;
  // only skip instantly if we already know the admin setting; otherwise wait for config.json below
  if(CONFIG.showSplash === false && localStorage.getItem(RKEY)){ sp.remove(); return; }
  const hide = () => { sp.classList.add("out"); setTimeout(()=>sp.remove(), 600) };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(hide, reduced ? 1200 : 3200);
  sp.addEventListener("click", hide);
})();
if(S){ renderGame(); show("game") } else show("setup");

// fetch the latest admin settings (falls back to the saved copy when offline)
fetch("config.json?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(r => {
  if(!r) return;
  const before = JSON.stringify(REMOTE_KEYS.map(k => CONFIG[k]));
  localStorage.setItem(RKEY, JSON.stringify(r)); applyRemote(r);
  if(CONFIG.showSplash === false){ const sp = $("#splash"); if(sp) sp.remove(); }
  if(JSON.stringify(REMOTE_KEYS.map(k => CONFIG[k])) === before) return;
  refreshRules();
  if(S && !$("#game").classList.contains("hidden")) renderGame();
}).catch(()=>{});
