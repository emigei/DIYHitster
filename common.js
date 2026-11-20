/* Gemeinsamer Code für duo.html und reise.html. Die Anmeldung läuft über index.html, die Tokens liegen im selben Browser-Speicher. */
const LS = localStorage, $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

document.head.insertAdjacentHTML("beforeend", `<style>
*{box-sizing:border-box}
:root{--orange:#ff5500;--border:rgba(255,255,255,.12);--muted:#bdbdbd}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(circle at center,#202020 0%,#0a0a0a 100%);color:#fff;font-family:sans-serif}
.wrap{width:min(420px,100%)}
.card{width:100%;padding:24px;border:2px solid #444;border-radius:32px;text-align:center;background:rgba(22,22,22,.95);box-shadow:0 15px 45px rgba(0,0,0,.6)}
.status{color:var(--orange);font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.btn{width:100%;margin-top:12px;padding:14px;border:none;border-radius:16px;cursor:pointer;background:var(--orange);color:var(--on,#fff);font-weight:700}
.btn.second{background:#1d1d1d;border:1px solid var(--border);color:#f5f5f5;font-weight:400}
input,select{width:100%;margin-top:8px;padding:10px;border-radius:12px;border:1px solid var(--border);background:#1d1d1d;color:#fff;font-size:14px}
.i{width:22px;height:22px;flex:none;align-self:center;border-radius:50%;border:1px solid #777;background:none;color:#ccc;font-size:12px;cursor:pointer;padding:0;margin:0}
.row{display:flex;gap:8px;align-items:center}.row select{flex:1}.row .btn{width:auto;margin-top:8px}
.ir{display:flex;align-items:center;gap:8px;margin:8px 0;font-size:14px;text-align:left}.ir .btn{margin-top:0;flex:1}.ir input[type=text],.ir input:not([type]){flex:1;margin-top:0}
.sm,.muted{color:var(--muted);font-size:12px}
.mini{background:none;border:none;color:var(--muted);text-decoration:underline;cursor:pointer;font-size:12px}
#modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);align-items:center;justify-content:center;padding:20px;z-index:9}
#modal>div{max-width:340px;background:#1b1b1b;border:1px solid #444;border-radius:20px;padding:22px;line-height:1.5;font-size:14px;white-space:pre-line;text-align:left}
#modal b{display:block;color:var(--orange);margin-bottom:8px;font-size:16px}
</style>`);

function info(t) {
  let m = $("modal");
  if (!m) {
    m = document.createElement("div"); m.id = "modal"; m.onclick = () => { m.style.display = "none"; };
    m.innerHTML = '<div><b id="m-title"></b><span id="m-text"></span><br><br><small style="color:#888">Tippen zum Schließen</small></div>';
    document.body.appendChild(m);
  }
  $("m-title").innerText = t[0]; $("m-text").innerText = t[1]; m.style.display = "flex";
}

function needLogin() {
  if (LS.getItem("sp_refresh")) return false;
  document.body.innerHTML = '<div class="wrap"><div class="card"><div class="status">Bitte zuerst anmelden</div><p class="muted">Öffne einmal die Spiel-Seite, melde dich dort bei Spotify an und komm dann hierher zurück.</p><button class="btn" onclick="location.href=\'index.html\'">Zur Anmeldung</button></div></div>';
  return true;
}

/* ---------- Spotify ---------- */
async function api(path, method = "GET", body) {
  if (Date.now() > Number(LS.getItem("sp_expires") || 0) - 60000) {
    const r = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: LS.getItem("sp_client") || "", grant_type: "refresh_token", refresh_token: LS.getItem("sp_refresh") || "" })
    });
    const d = await r.json();
    if (!r.ok) { LS.removeItem("sp_refresh"); throw new Error("Bitte auf der Spiel-Seite neu anmelden."); }
    LS.setItem("sp_access", d.access_token); LS.setItem("sp_expires", String(Date.now() + d.expires_in * 1000));
    if (d.refresh_token) LS.setItem("sp_refresh", d.refresh_token);
  }
  return fetch("https://api.spotify.com/v1" + path, {
    method, headers: { Authorization: "Bearer " + LS.getItem("sp_access"), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
}

const DEVINFO = ["Wiedergabegerät", "Hier wählst du, wo der Ton abgespielt wird: auf diesem Handy oder zum Beispiel auf einem Lautsprecher mit Spotify. Wenn nichts erscheint: Spotify-App einmal öffnen, einen Song starten und hier auf ↻ tippen."];
const devHTML = '<div class="row"><select id="dev" onchange="saveDev()"></select><button class="btn second" onclick="loadDevices()">&#8635;</button><button class="i" onclick="info(DEVINFO)">i</button></div>';

async function loadDevices() {
  const sel = $("dev"); if (!sel) return;
  sel.innerHTML = "";
  let list = [];
  try { list = (await (await api("/me/player/devices")).json()).devices || []; } catch (e) {}
  list.forEach((d) => {
    const o = document.createElement("option");
    o.value = d.id; o.dataset.name = d.name; o.textContent = d.name + (d.is_active ? " (aktiv)" : "");
    sel.appendChild(o);
  });
  const saved = LS.getItem("sp_device");
  const pick = list.find((d) => d.name === saved) || list.find((d) => d.is_active) || list[0];
  if (pick) sel.value = pick.id; else sel.innerHTML = "<option value=''>Kein Gerät gefunden</option>";
}
function saveDev() { const o = $("dev").selectedOptions[0]; if (o && o.dataset.name) LS.setItem("sp_device", o.dataset.name); }

const devQ = () => { const d = $("dev"); return d && d.value ? "?device_id=" + d.value : ""; };
function explain(s) {
  return s === 404 ? "Kein Gerät aktiv. Spotify-App kurz öffnen, Song starten, hier auf ↻ tippen."
    : s === 403 ? "Spotify hat die Steuerung abgelehnt (Premium nötig?)."
    : s === 429 ? "Zu viele Anfragen. Kurz warten." : "Spotify-Fehler " + s;
}
async function playTrack(id, pos = 0) {
  const body = { uris: ["spotify:track:" + id], position_ms: pos };
  let r = await api("/me/player/play" + devQ(), "PUT", body);
  if (r.status === 404) { await loadDevices(); if ($("dev").value) r = await api("/me/player/play" + devQ(), "PUT", body); }
  if (!r.ok) throw new Error(explain(r.status));
}
const pausePlay = () => api("/me/player/pause" + devQ(), "PUT").catch(() => {});
const resumePlay = () => api("/me/player/play" + devQ(), "PUT");
async function trackLength(id) {
  try { const r = await api("/tracks/" + id); if (r.ok) return (await r.json()).duration_ms || 180000; } catch (e) {}
  return 180000;
}

/* ---------- Songs und Ansagen ---------- */
async function loadSongs() {
  const data = await (await fetch("songs.json")).json();
  const sel = JSON.parse(LS.getItem("hit_lists") || "null"), out = [];
  for (const pl in data) {
    if (sel && !sel.includes(pl)) continue;
    for (const id in data[pl]) {
      if (id === "color" || id === "image") continue;
      const s = data[pl][id];
      if (s.spotify) out.push({ id, ...s, color: data[pl].color || "#ff5500", playlist: pl });
    }
  }
  return out;
}
function speak(t) {
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(t); u.lang = "de-DE";
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}
