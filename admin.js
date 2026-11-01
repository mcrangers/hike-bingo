/* Admin page: reads and writes config.json in the GitHub repo.
 * The GitHub key is pasted once per phone and kept in that phone's localStorage. */
const OWNER = "mcrangers", REPO = "hike-bingo";
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
const TKEY = "trailbingo:adminKey";

/* ===== Admin settings: add new toggles here (and the key to REMOTE_KEYS in app.js) =====
 * type: toggle | stepper | choice | text.  `when` hides/greys it unless another setting is on. */
const SETTINGS = [
  { section: "Game" },
  { key: "winCondition", type: "choice", title: "Win rule", desc: "What players need for a reward.",
    options: [["line","One line"],["blackout","Full card"]], def: "blackout" },
  { key: "maxSignsPerPerson", type: "stepper", title: "Signs per person", desc: "How many squares one person can sign on a card.", min: 1, max: 5, def: 3 },
  { key: "ownCollegeSigns", type: "stepper", title: "Own-college squares", desc: "How many squares people from the player's own college can sign. 0 = other colleges only.", min: 0, max: 12, def: 4 },
  { section: "Opening" },
  { key: "showSplash", type: "toggle", title: "Loading screen", desc: "MC Rangers × CCIA & SHHOISA intro.", def: false },
  { section: "Exco tiles" },
  { key: "excoEnabled", type: "toggle", title: "Exco tiles", desc: "Gold tiles only exco can sign. Off also unlocks them on cards in play.", def: true },
  { key: "excoTiles", type: "stepper", title: "Tiles per card", desc: "Applies to new cards.", min: 1, max: 6, def: 4, when: "excoEnabled" },
  { key: "excoCode", type: "text", title: "Exco code", desc: "Exco type this to sign.", def: "", when: "excoEnabled" },
  { key: "excoSignsPerExco", type: "stepper", title: "Exco tiles per exco", desc: "How many exco tiles one exco member can sign on a card.", min: 1, max: 6, def: 1, when: "excoEnabled" },
  { key: "excoAnyCollege", type: "toggle", title: "Exco from any college", desc: "Exco can sign even if they're from the player's college.", def: true, when: "excoEnabled" },
];
/* ======================================================================================= */

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let token = localStorage.getItem(TKEY) || "";
let sha = null, saved = null, values = {};

/* ---------- GitHub ---------- */
const gh = (path, opts = {}, tok = token) => fetch(API + path, { ...opts, cache: "no-store", headers: {
  "Authorization": "Bearer " + tok, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(opts.headers || {}) } });
const b64e = s => btoa(unescape(encodeURIComponent(s)));
const b64d = s => decodeURIComponent(escape(atob(s.replace(/\n/g, ""))));
async function checkKey(tok){
  const r = await gh("", {}, tok);
  if(r.status === 401) throw new Error("That GitHub key isn't valid or has expired.");
  if(r.status === 404 || r.status === 403) throw new Error("That key can't access mcrangers/hike-bingo. Check the repository and permissions.");
  if(!r.ok) throw new Error("GitHub error " + r.status + ". Try again.");
  const repo = await r.json();
  if(repo.permissions && repo.permissions.push === false) throw new Error("That key can't change the repo. It needs Contents: Read and write.");
}
async function putFile(path, text, message){
  const cur = await gh("/contents/" + path + "?t=" + Date.now());
  const body = { message, content: b64e(text) };
  if(cur.ok) body.sha = (await cur.json()).sha;
  const r = await gh("/contents/" + path, { method: "PUT", body: JSON.stringify(body) });
  if(!r.ok) throw new Error(await explain(r));
  return (await r.json()).content.sha;
}

// Turn GitHub errors into something readable
async function explain(r){
  let msg = ""; try{ msg = (await r.json()).message || ""; }catch(e){}
  if(r.status === 403 && /approv|pending/i.test(msg)) return "This key is waiting for approval in the mcrangers organization. Approve it in the organization's settings → Personal access tokens → Pending requests, then try again.";
  if(r.status === 403) return "GitHub blocked the save: the key can read but not write. Make sure the key's Contents permission is “Read and write” (not Read-only), and that mcrangers has approved it. GitHub said: " + (msg || "forbidden");
  if(r.status === 401) return "That GitHub key isn't valid or has expired.";
  return "Couldn't save (" + r.status + "). " + msg;
}

/* ---------- screens ---------- */
const only = id => ["setupKey","settings"].forEach(s => $("#" + s).classList.toggle("hidden", s !== id));
async function enter(){
  await loadConfig(); only("settings");
  $("#topRight").innerHTML = '<button class="ghost" id="outBtn" type="button">Disconnect</button>';
  $("#outBtn").onclick = () => { localStorage.removeItem(TKEY); location.reload(); };
}
$("#setupForm").onsubmit = async e => {
  e.preventDefault();
  const tok = $("#tok").value.trim(), err = m => $("#setupErr").textContent = m;
  if(!tok) return err("Paste your GitHub key.");
  $("#setupBtn").textContent = "Connecting…"; err("");
  try{ await checkKey(tok); token = tok; localStorage.setItem(TKEY, tok); await enter(); }
  catch(e2){ err(e2.message); }
  $("#setupBtn").textContent = "Connect";
};

/* ---------- settings ---------- */
async function loadConfig(){
  const r = await gh("/contents/config.json?t=" + Date.now());
  if(r.status === 401) throw new Error("expired");
  let cfg = {};
  if(r.ok){ const j = await r.json(); sha = j.sha; cfg = JSON.parse(b64d(j.content)); } else sha = null;
  saved = {}; SETTINGS.forEach(s => { if(s.key) saved[s.key] = (s.key in cfg) ? cfg[s.key] : s.def; });
  // excoCodeHash/excoCodeEnc: older hidden-code settings, dropped once a plain code is saved
  saved._extra = Object.fromEntries(Object.entries(cfg).filter(([k]) => !SETTINGS.some(s => s.key === k)));
  values = JSON.parse(JSON.stringify(saved));
  render();
  if(values.excoEnabled && !values.excoCode && cfg.excoCodeHash) status("Type the exco code in once and save. Then it shows here.", "");
}

function render(){
  let html = "", open = false;
  SETTINGS.forEach(s => {
    if(s.section){ if(open) html += "</div>"; html += `<div class="sec-title">${esc(s.section)}</div><div class="panel">`; open = true; return; }
    const v = values[s.key], off = s.when && !values[s.when];
    let ctl = "";
    if(s.type === "toggle") ctl = `<label class="switch" aria-label="${esc(s.title)}"><input type="checkbox" data-k="${s.key}" ${v ? "checked" : ""}><span></span></label>`;
    if(s.type === "stepper") ctl = `<div class="stepper"><button type="button" data-k="${s.key}" data-d="-1" aria-label="Less" ${v <= s.min ? "disabled" : ""}>−</button><output>${esc(v)}</output><button type="button" data-k="${s.key}" data-d="1" aria-label="More" ${v >= s.max ? "disabled" : ""}>+</button></div>`;
    if(s.type === "choice") ctl = `<div class="seg">${s.options.map(([val, lab]) => `<button type="button" data-k="${s.key}" data-v="${esc(val)}" class="${v === val ? "on" : ""}">${esc(lab)}</button>`).join("")}</div>`;
    if(s.type === "text") ctl = `<input type="text" data-k="${s.key}" value="${esc(v)}" maxlength="20" autocomplete="off" spellcheck="false" aria-label="${esc(s.title)}">`;
    html += `<div class="set ${off ? "off" : ""} ${s.type === "choice" ? "wide" : ""}"><div><h3>${esc(s.title)}</h3><p>${esc(s.desc)}</p></div>${ctl}</div>`;
  });
  if(open) html += "</div>";
  $("#panels").innerHTML = html;
  $("#panels").querySelectorAll("input[type=checkbox]").forEach(el => el.onchange = () => { values[el.dataset.k] = el.checked; render(); });
  $("#panels").querySelectorAll(".stepper button").forEach(el => el.onclick = () => {
    const s = SETTINGS.find(x => x.key === el.dataset.k);
    values[s.key] = Math.max(s.min, Math.min(s.max, Number(values[s.key]) + Number(el.dataset.d))); render();
  });
  $("#panels").querySelectorAll(".seg button").forEach(el => el.onclick = () => { values[el.dataset.k] = el.dataset.v; render(); });
  $("#panels").querySelectorAll("input[type=text]").forEach(el => el.oninput = () => { values[el.dataset.k] = el.value.trim(); dirty(); });
  dirty();
}
function dirty(){
  const d = JSON.stringify(values) !== JSON.stringify(saved);
  $("#saveBtn").innerHTML = d ? '<span class="dirty"></span>Save changes' : "Saved";
  $("#saveBtn").disabled = !d;
  return d;
}
const output = () => {
  const o = { ...values._extra }; SETTINGS.forEach(s => { if(s.key) o[s.key] = values[s.key]; });
  if(o.excoCode){ delete o.excoCodeHash; delete o.excoCodeEnc; }
  return o;
};

$("#saveBtn").onclick = async () => {
  if(values.excoEnabled && !values.excoCode && !values._extra.excoCodeHash) return status("Add an exco code first.", "bad");
  $("#saveBtn").textContent = "Saving…"; $("#saveBtn").disabled = true; status("");
  const body = { message: "Admin: update settings", content: b64e(JSON.stringify(output(), null, 2) + "\n") };
  if(sha) body.sha = sha;
  const r = await gh("/contents/config.json", { method: "PUT", body: JSON.stringify(body) });
  if(r.status === 409 || r.status === 422){ await loadConfig(); return status("Settings were changed somewhere else. Reloaded them, check and save again.", "bad"); }
  if(!r.ok){ dirty(); return status(await explain(r), "bad"); }
  sha = (await r.json()).content.sha; saved = JSON.parse(JSON.stringify(values)); render();
  status("Saved. Going live in about a minute…", "ok");
  waitLive(JSON.stringify(output()));
};
async function waitLive(want){
  for(let i = 0; i < 30; i++){
    await new Promise(r => setTimeout(r, 8000));
    try{
      const live = await fetch("config.json?t=" + Date.now(), { cache: "no-store" }).then(r => r.json());
      const o = {}; Object.keys(JSON.parse(want)).forEach(k => o[k] = live[k]);
      if(JSON.stringify(o) === want) return status("Live now. Phones get it next time they open the app.", "ok");
    }catch(e){}
  }
}
function status(m, cls = ""){ const s = $("#status"); s.textContent = m; s.className = "status " + cls; }

/* ---------- boot ---------- */
(async () => {
  if(token){
    try{ await checkKey(token); await enter(); return; }
    catch(e){ localStorage.removeItem(TKEY); token = ""; }
  }
  only("setupKey"); setTimeout(() => $("#tok").focus(), 50);
})();
