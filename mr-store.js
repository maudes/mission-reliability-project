/* Mission Reliability — shared verification store (test data + decision logic).
   Used by verification.html (Screen 3), index.html and group-detail*.html.
   Everything lives in localStorage so the prototype works on static hosting. */
(function(){
'use strict';

var KEY = 'mr_verif_v1';
var VERSION = 6;
var SIM_START = Date.UTC(2026, 6, 5, 6, 25, 0);   // 2026-07-05 06:25:00 UTC, matches dashboard test data
var MIN = 60000;

var DIRECTORY = {
  'BWC-B04': {officer:'John Acuri',       group:'GROUP B', area:'L1 – ER'},
  'BWC-B07': {officer:'Lena Ortiz',       group:'GROUP B', area:'L1 – ER'},
  'BWC-B11': {officer:'Marcus Webb',      group:'GROUP B', area:'L3 – OB'},
  'BWC-B02': {officer:'Priya Nair',       group:'GROUP B', area:'L2 – General'},
  'BWC-B09': {officer:'Tomas Reyes',      group:'GROUP B', area:'L5 – Rooms'},
  'BWC-B12': {officer:'Catherine Collen', group:'GROUP B', area:'L8 – VIP'},
  'BWC-B03': {officer:'Jeff Acuri',       group:'GROUP B', area:'L6 – Kids'},
  'BWC-B06': {officer:'Jason Chen',       group:'GROUP B', area:'L6 – Kids'},
  'BWC-A09': {officer:'Diego Fernandez',  group:'GROUP A', area:'A02'},
  'BWC-A12': {officer:'Rina Tan',         group:'GROUP A', area:'A01'},
  'BWC-D03': {officer:'Hana Kobayashi',   group:'GROUP D', area:'E02'},
  'BWC-D08': {officer:'Owen Clarke',      group:'GROUP D', area:'E04'},
  'BWC-D01': {officer:'Sofia Ricci',      group:'GROUP D', area:'E01'},
  'BWC-C04': {officer:'Wei Lin',          group:'GROUP C', area:'B02'},
  'BWC-C06': {officer:'Aiko Sato',        group:'GROUP C', area:'B03'}
};

var S = null;
var memoryOnly = null;

/* ---------- clock ---------- */
function now(){ return S.simNow + (Date.now() - S.rt); }
function fmtTime(ms){ return new Date(ms).toISOString().slice(11, 16); }
function fmtStamp(ms){ return new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'; }

/* ---------- seed ---------- */
function ev(o){
  var d = DIRECTORY[o.device] || {officer:'Unknown', group:'GROUP ?', area:'—'};
  var t = SIM_START;
  return {
    id: o.id, device: o.device, officer: d.officer, group: d.group, area: d.area,
    source: o.source || 'auto', kind: o.kind, summary: o.summary || '',
    confidence: o.confidence == null ? null : o.confidence,
    detectedAt: t - o.age * MIN, onsetAt: t - (o.age + o.lag) * MIN, lagMin: o.lag,
    tracks: o.tracks || {hb:[], rec:[], up:[]},
    hints: o.hints || [], memos: (o.memos || []).map(function(m){ return {at: t - m[0] * MIN, by: m[1], text: m[2]}; }),
    snapshot: o.snapshot || null,
    status: o.status || 'pending', decision: o.decision || null, reportedBy: o.reportedBy || null, seeded: true
  };
}

function seed(){
  var events = [
    ev({id:'VQ-2041', device:'BWC-B04', kind:'Fake online · recording stuck', confidence:0.93, age:6, lag:6,
      summary:'Heartbeat says online, but the frame counter has not advanced and no payload has uploaded for 40 min.',
      tracks:{hb:[], rec:[[40,0]], up:[[40,0]]},
      snapshot:{battery:41, channel:'Channel 4', lastUpload:'40 min ago', lastFrame:'#118,204 (frozen)'},
      hints:[
        {w:'for', t:'Heartbeat present while upload bytes = 0 for 40 min (classic fake-online pattern)'},
        {w:'for', t:'Frame counter frozen at #118,204 since 05:45'},
        {w:'for', t:'Same signature on this unit on 06-28 (confirmed hardware fault)'},
        {w:'against', t:'Officer radioed “all good” 14 min ago (cannot see own camera state)'}
      ],
      memos:[[21,'Sammy Leung (CC)','Memo to Group B leader: C03 coverage is thin, watch ER cams.'],[44,'System','Anomaly alert: sync failure, 40 min.']]}),
    ev({id:'VQ-2042', device:'BWC-B07', kind:'Disconnected · low battery', confidence:0.97, age:9, lag:3,
      summary:'No heartbeat for 9 min. Battery was 12% and falling about 4% per 10 min.',
      tracks:{hb:[[9,0]], rec:[[9,0]], up:[[9,0]]},
      snapshot:{battery:12, channel:'Channel 2', lastUpload:'9 min ago', lastFrame:'n/a'},
      hints:[
        {w:'for', t:'Last heartbeat 9 min ago, no reconnect attempts since'},
        {w:'for', t:'Battery 12% and falling, consistent with power-off'},
        {w:'for', t:'Auto Force Sync on Channel 2 failed at 06:14'}
      ],
      memos:[[27,'Sammy Leung (CC)','Device check initiated on BWC-B07.']]}),
    ev({id:'VQ-2043', device:'BWC-B11', kind:'Suspected recording omission', confidence:0.58, age:4, lag:8,
      summary:'Two video gaps of about 2 min inside the OB wing. Audio stream stayed continuous.',
      tracks:{hb:[], rec:[[14,12],[7,5]], up:[]},
      snapshot:{battery:68, channel:'Channel 3', lastUpload:'1 min ago', lastFrame:'live'},
      hints:[
        {w:'for', t:'Two unexplained video gaps (14–12 min and 7–5 min ago)'},
        {w:'against', t:'Audio stayed continuous, which looks like a deliberate lens-down, not a hardware fault'},
        {w:'against', t:'OB wing is a sensitive zone: policy allows pausing video during patient examination'},
        {w:'against', t:'Device log shows the pause button pressed twice, exactly at both gaps'}
      ],
      memos:[[33,'Alex Muller (Leader)','OB ward is sensitive, officers may lower cameras during exams.']]}),
    ev({id:'VQ-2044', device:'BWC-A09', kind:'Fake online · no sync 40 min', confidence:0.88, age:7, lag:5,
      summary:'Reports online but nothing has synced for 40 min. Last action: swap requested, pending.',
      tracks:{hb:[], rec:[], up:[[40,0]]},
      snapshot:{battery:76, channel:'Channel 1', lastUpload:'40 min ago', lastFrame:'live (local only)'},
      hints:[
        {w:'for', t:'Recording locally but 0 bytes uploaded in 40 min'},
        {w:'for', t:'Manual swap already requested by command center at 06:22'},
        {w:'against', t:'Wi-Fi AP A-02 shows 18% packet loss; may be network, not the device'}
      ],
      memos:[[3,'Tanya Sipowitz (CC)','Swap of BWC-A09 requested, pending dispatch.']]}),
    ev({id:'VQ-2045', device:'BWC-D03', kind:'Sync delay · east wing', confidence:0.62, age:11, lag:4,
      summary:'Upload backlog of 18 min while recording is normal.',
      tracks:{hb:[], rec:[], up:[[18,0]]},
      snapshot:{battery:55, channel:'Channel 1', lastUpload:'18 min ago', lastFrame:'live'},
      hints:[
        {w:'for', t:'Upload backlog growing for 18 min'},
        {w:'against', t:'BWC-D08 (same AP E-2) shows the identical pattern, which suggests the network, not the unit'},
        {w:'against', t:'Recording and heartbeat both healthy'}
      ]}),
    ev({id:'VQ-2046', device:'BWC-D08', kind:'Sync delay · east wing', confidence:0.55, age:15, lag:4, status:'unresolved',
      summary:'Upload backlog of 22 min. Shares access point E-2 with BWC-D03.',
      tracks:{hb:[], rec:[], up:[[22,0]]},
      snapshot:{battery:62, channel:'Channel 1', lastUpload:'22 min ago', lastFrame:'live'},
      hints:[
        {w:'for', t:'Upload backlog growing for 22 min'},
        {w:'against', t:'Same AP as BWC-D03; recording and heartbeat healthy'}
      ],
      decision:{by:'Tanya Sipowitz (CC)', status:'unresolved', at:SIM_START - 11 * MIN, note:'Same AP as BWC-D03. Waiting for the network team to check E-2.', nextCheckAt:SIM_START + 4 * MIN, nextCheckMin:15, reviewSec:74}}),
    ev({id:'VQ-2047', device:'BWC-C06', source:'manual', kind:'Manual report · lens covered', confidence:null, age:3, lag:10,
      reportedBy:'Tanya Sipowitz (CC)',
      summary:'Command center saw a black live view and the officer did not answer on channel 1 for 2 min. The system still shows this unit as normal.',
      tracks:{hb:[], rec:[], up:[]},
      snapshot:{battery:88, channel:'Channel 1', lastUpload:'1 min ago', lastFrame:'live (black)'},
      hints:[
        {w:'for', t:'Human report: live view is black for 2+ min'},
        {w:'for', t:'Officer unresponsive on channel 1'},
        {w:'against', t:'All telemetry is normal. The system would not have caught this on its own'}
      ],
      memos:[[3,'Tanya Sipowitz (CC)','Black feed on BWC-C06, calling channel 1.']]})
  ];

  /* 12 h of resolved history so the reliability metrics have a baseline.
     2 h buckets, 10 confirmed each; manual catches per bucket (newest first). */
  var manualPerBucket = [1, 1, 1, 1, 1, 1];
  var lags = [2, 3, 3, 4, 4, 4, 5, 5, 6, 8];
  var devs = Object.keys(DIRECTORY);
  var n = 1000;
  for (var k = 0; k < 6; k++) {
    var manualLeft = manualPerBucket[k];
    for (var i = 0; i < 10; i++) {
      var isManual = i >= 10 - manualLeft;
      var minAgo = 120 * k + 20 + i * 9.5;
      var dv = devs[(k * 10 + i * 3) % devs.length];
      var lag = isManual ? 10 : lags[(i + k) % 10];
      events.push(histEvent('VQ-' + (n++), dv, isManual ? 'manual' : 'auto', 'confirmed', minAgo, lag, 30 + ((i * 17 + k * 11) % 60)));
    }
    for (var j = 0; j < 2; j++) {
      var mA = 120 * k + 45 + j * 40;
      events.push(histEvent('VQ-' + (n++), devs[(k * 2 + j * 5 + 1) % devs.length], 'auto', 'false_alarm', mA, lags[(j * 3 + k) % 10], 20 + ((j * 23 + k * 7) % 70)));
    }
  }

  return {
    v: VERSION, simNow: SIM_START, rt: Date.now(), lastSeen: Date.now(),
    events: events,
    audit: [],
    counter: 2100,
    fatigueDismissed: false
  };
}

function histEvent(id, device, source, status, minAgo, lag, reviewSec){
  var d = DIRECTORY[device];
  var det = SIM_START - minAgo * MIN;
  return {
    id: id, device: device, officer: d.officer, group: d.group, area: d.area, source: source,
    kind: status === 'confirmed' ? 'Resolved failure' : 'Resolved false alarm', summary: '', confidence: source === 'auto' ? 0.8 : null,
    detectedAt: det, onsetAt: det - lag * MIN, lagMin: lag, tracks: {hb:[], rec:[], up:[]}, hints: [], memos: [], snapshot: null,
    status: status, history: true,
    decision: {by:'Shift reviewer', status: status, at: det + reviewSec * 1000, note:'', reviewSec: reviewSec}
  };
}


/* ---------- per-device signals (test data) ---------- */
var DEVICE_INFO = {
  'BWC-B04':{battery:41,channel:'Channel 4'}, 'BWC-B07':{battery:12,channel:'Channel 2'}, 'BWC-B11':{battery:68,channel:'Channel 3'},
  'BWC-B02':{battery:87,channel:'Channel 1'}, 'BWC-B09':{battery:73,channel:'Channel 2'}, 'BWC-B12':{battery:91,channel:'Channel 1'},
  'BWC-B03':{battery:60,channel:'Channel 4'}, 'BWC-B06':{battery:82,channel:'Channel 2'},
  'BWC-A09':{battery:76,channel:'Channel 1'}, 'BWC-A12':{battery:84,channel:'Channel 1'},
  'BWC-D03':{battery:55,channel:'Channel 1'}, 'BWC-D08':{battery:62,channel:'Channel 1'}, 'BWC-D01':{battery:91,channel:'Channel 1'},
  'BWC-C04':{battery:95,channel:'Channel 1'}, 'BWC-C06':{battery:88,channel:'Channel 1'}
};

/* Devices that only exist on the group pages (not in the seed directory) are registered on demand. */
function registerDevice(id, info){
  info = info || {};
  var m = /^BWC-([A-Z])/.exec(id);
  if (!DIRECTORY[id]) DIRECTORY[id] = {officer: info.officer || 'Unassigned', group: m ? 'GROUP ' + m[1] : 'GROUP ?', area: info.area || '—'};
  else {
    if (info.officer) DIRECTORY[id].officer = info.officer;
    if (info.area) DIRECTORY[id].area = info.area;
  }
  if (!DEVICE_INFO[id]) DEVICE_INFO[id] = {battery: info.battery != null ? info.battery : 90, channel: info.channel || 'Channel 1'};
  return DIRECTORY[id];
}
function hash(str, n){
  var h = 2166136261;
  var t = str + ':' + n;
  for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}
function latestEvent(device){
  var l = S.events.filter(function(e){ return !e.history && e.device === device; }).sort(function(a, b){ return b.detectedAt - a.detectedAt; });
  return l[0] || null;
}
function deviceSnapshot(device){
  var e = latestEvent(device);
  if (e && e.snapshot) return e.snapshot;
  var i = DEVICE_INFO[device] || {battery: 80, channel: 'Channel 1'};
  return {battery: i.battery, channel: i.channel, lastUpload: '1 min ago', lastFrame: 'live'};
}
/* 45 one-minute cells per track, oldest first. Each cell: {s:'ok'|'bad'|'nodata', v:short value, t:detail}. */
function signals(device){
  var e = latestEvent(device);
  var tr = e ? e.tracks : {hb: [], rec: [], up: []};
  var slowUp = e && /sync delay/i.test(e.kind);
  var gapNote = e && /omission/i.test(e.kind) ? ' · audio still recording' : e && /stuck/i.test(e.kind) ? ' · frame counter frozen' : '';
  function inR(rs, m){ return rs.some(function(r){ return m <= r[0] && m >= r[1]; }); }
  var out = {hb: [], rec: [], up: []};
  for (var i = 0; i < 45; i++) {
    var m = 44 - i;
    var hbBad = inR(tr.hb, m);
    var jit = hash(device, m);
    if (hbBad) {
      out.hb.push({s:'bad', v:'0 of 4', t:'0 of 4 expected heartbeats received (device pings every 15 s)'});
      out.rec.push({s:'nodata', v:'No data', t:'No telemetry: device unreachable'});
      out.up.push({s:'nodata', v:'No data', t:'No telemetry: device unreachable'});
      continue;
    }
    out.hb.push({s:'ok', v:'4 of 4', t:'4 of 4 expected heartbeats received (device pings every 15 s)'});
    if (inR(tr.rec, m)) out.rec.push({s:'bad', v:'0 fps', t:'0 fps (expected 30)' + gapNote});
    else { var fps = jit > 0.85 ? 29 : 30; out.rec.push({s:'ok', v:fps + ' fps', t:fps + ' fps'}); }
    if (inR(tr.up, m)) {
      var kb = slowUp ? Math.round(6 + jit * 14) : 0;
      out.up.push({s:'bad', v:kb + ' KB/s', t:kb + ' KB/s (expected ~200)'});
    } else { var u = Math.round(170 + jit * 90); out.up.push({s:'ok', v:u + ' KB/s', t:u + ' KB/s'}); }
  }
  return out;
}


/* ---------- follow-up actions after a Confirmed decision (simulated execution) ---------- */
var FU_MS = {'Dispatch swap': 9000, 'Resync device': 6000, 'Escalate to support': 4000};
function startFollowup(e, action, attempts){
  if (action === 'Monitor closely') return {action: action, status: 'monitoring', attempts: 1, startedAt: now()};
  return {action: action, status: 'pending', attempts: attempts, startedAt: now(), startedReal: Date.now(), dur: FU_MS[action] || 6000};
}
function fuOutcome(e){
  var f = e.followup;
  if (f.action === 'Resync device' && f.attempts === 1 && hash(e.id, 'fu') < 0.6) return 'failed';
  return 'success';
}
function tickFollowups(){
  var changed = false;
  S.events.forEach(function(e){
    var f = e.followup;
    if (f && f.status === 'pending' && Date.now() - f.startedReal >= f.dur) {
      f.status = fuOutcome(e); f.doneAt = now(); changed = true;
      log('System (Auto)', f.action + ' — ' + e.device + (f.status === 'success' ? ' completed' : ' failed'), f.status === 'success' ? 'success' : 'failed',
        f.status === 'failed' ? 'Device did not respond after ' + f.attempts + ' attempt' + (f.attempts > 1 ? 's' : '') + '. Retry or escalate.' : '', e.id);
    }
  });
  if (changed) save();
  return changed;
}
function retryFollowup(id, action){
  var e = byId(id); if (!e || !e.followup) return null;
  var prev = e.followup;
  e.followup = startFollowup(e, action || prev.action, prev.attempts + 1);
  log('Sammy Leung (CC)', (action && action !== prev.action ? 'Escalated after failed ' + prev.action : 'Retry ' + prev.action) + ' — ' + e.device, 'pending', '', id);
  save();
  return e;
}

/* Group counts on the dashboard follow the verification outcome. */
function adjustedAbnormal(group, base){
  var cleared = 0, added = 0;
  S.events.forEach(function(e){
    if (e.history || e.group !== group) return;
    if (e.status === 'false_alarm' && e.seeded && e.source === 'auto') cleared++;
    if (e.status === 'confirmed' && !e.seeded) added++;
  });
  return Math.max(0, base - cleared + added);
}

/* ---------- reusable signal-history block for the group pages ---------- */
function injectSigCSS(){
  if (document.getElementById('mr-sig-css')) return;
  var st = document.createElement('style'); st.id = 'mr-sig-css';
  st.textContent =
    '.mrs-row{display:grid;grid-template-columns:92px 1fr 62px;gap:8px;align-items:center;margin-bottom:7px;font-size:11.5px;color:#5B6472}' +
    '.mrs-row small{display:block;font-size:9.5px;color:#8A93A1}' +
    '.mrs-cells{display:grid;grid-template-columns:repeat(45,1fr);gap:1px}' +
    '.mrs-cells i{height:16px;border-radius:1px;background:#CFEBDC;cursor:crosshair}' +
    '.mrs-cells i.bad{background:#FF3838}' +
    '.mrs-cells i.nodata{background:repeating-linear-gradient(45deg,#DDE1E8,#DDE1E8 2px,#F1F3F6 2px,#F1F3F6 5px)}' +
    '.mrs-now{font-family:"IBM Plex Mono",monospace;text-align:right;font-size:10.5px;color:#111827}' +
    '.mrs-now.bad{color:#D62828;font-weight:600}.mrs-now.nodata{color:#8A93A1}' +
    '.mrs-axis{display:grid;grid-template-columns:92px 1fr 62px;gap:8px;font-size:9.5px;color:#8A93A1}' +
    '.mrs-axis div{display:flex;justify-content:space-between}' +
    '.mrs-foot{font-size:11px;color:#5B6472;min-height:16px;margin-top:6px}';
  document.head.appendChild(st);
}
function signalHTML(device){
  injectSigCSS();
  var sg = signals(device);
  var rows = [['Heartbeat', 'hb', '4 per min expected'], ['Recording', 'rec', '30 fps expected'], ['Payload upload', 'up', '~200 KB/s expected']];
  var h = '<div class="mrs">';
  rows.forEach(function(r){
    var a = sg[r[1]], last = a[a.length - 1];
    h += '<div class="mrs-row"><span>' + r[0] + '<small>' + r[2] + '</small></span><div class="mrs-cells">' +
      a.map(function(c, i){ return '<i class="' + c.s + '" data-sig="' + (r[0] + '|' + (44 - i) + '|' + c.t).replace(/"/g, '&quot;') + '"></i>'; }).join('') +
      '</div><span class="mrs-now ' + last.s + '">' + last.v + '</span></div>';
  });
  h += '<div class="mrs-axis"><span></span><div><span>−45 min</span><span>−30</span><span>−15</span><span>now</span></div><span></span></div>' +
    '<div class="mrs-foot">Hover a cell for the reading at that minute.</div></div>';
  return h;
}
function bindSignal(root){
  if (root.__mrs) return; root.__mrs = true;
  root.addEventListener('mouseover', function(ev){
    var c = ev.target.closest && ev.target.closest('i[data-sig]'); if (!c) return;
    var p = c.getAttribute('data-sig').split('|'), f = root.querySelector('.mrs-foot'); if (!f) return;
    f.textContent = (p[1] === '0' ? 'now' : '−' + p[1] + ' min') + ' · ' + p[0] + ': ' + p.slice(2).join('|');
  });
}

/* ---------- persistence ---------- */
function load(){
  var raw = null;
  try { raw = localStorage.getItem(KEY); } catch(e) { memoryOnly = true; }
  var parsed = null;
  if (raw) { try { parsed = JSON.parse(raw); } catch(e) {} }
  if (!parsed || parsed.v !== VERSION) { S = seed(); }
  else {
    S = parsed;
    var d = Math.min(Date.now() - S.lastSeen, 120000);   // sim clock only advances while pages are open
    S.simNow += d; S.rt = Date.now();
  }
  save();
}
function save(){
  S.simNow = now(); S.rt = Date.now(); S.lastSeen = S.rt;
  if (memoryOnly) return;
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e) { memoryOnly = true; }
}
function reload(){
  var raw = null;
  try { raw = localStorage.getItem(KEY); } catch(e) {}
  if (raw) { try { var p = JSON.parse(raw); if (p.v === VERSION) { S = p; S.simNow += Math.min(Date.now() - S.lastSeen, 120000); S.rt = Date.now(); } } catch(e) {} }
}

/* ---------- queries ---------- */
function events(){ return S.events; }
function byId(id){ for (var i = 0; i < S.events.length; i++) if (S.events[i].id === id) return S.events[i]; return null; }

/* An unresolved event whose re-check time has passed is back in the queue. */
function isRecheckDue(e){ return e.status === 'unresolved' && e.decision && e.decision.nextCheckAt <= now(); }
function isOpen(e){ return e.status === 'pending' || e.status === 'unresolved'; }

function pendingCount(group){
  return S.events.filter(function(e){
    return !e.history && isOpen(e) && (!group || e.group === group) && (e.status === 'pending' || isRecheckDue(e));
  }).length;
}
function openCount(group){
  return S.events.filter(function(e){ return !e.history && isOpen(e) && (!group || e.group === group); }).length;
}
function groupSummary(group){
  var list = S.events.filter(function(e){ return !e.history && e.group === group; });
  var c = {pending:0, unresolved:0, confirmed:0, false_alarm:0, actionsPending:0, actionsFailed:0};
  list.forEach(function(e){
    c[e.status]++;
    if (e.followup && e.followup.status === 'pending') c.actionsPending++;
    if (e.followup && e.followup.status === 'failed') c.actionsFailed++;
  });
  return c;
}

function median(a){
  if (!a.length) return null;
  var s = a.slice().sort(function(x, y){ return x - y; });
  var m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function metrics(windowMin){
  windowMin = windowMin || 240;
  var from = now() - windowMin * MIN;
  var win = S.events.filter(function(e){ return e.detectedAt >= from; });
  var conf = win.filter(function(e){ return e.status === 'confirmed'; });
  var manual = conf.filter(function(e){ return e.source === 'manual'; }).length;
  var decided = win.filter(function(e){ return e.decision && e.decision.reviewSec != null && e.status !== 'unresolved'; });
  return {
    windowMin: windowMin,
    confirmed: conf.length, manual: manual,
    autoRate: conf.length ? (conf.length - manual) / conf.length : null,
    manualFrac: conf.length ? manual / conf.length : null,
    medianDetect: median(win.map(function(e){ return e.lagMin; })),
    medianReview: median(decided.map(function(e){ return e.decision.reviewSec; })),
    falseAlarms: win.filter(function(e){ return e.status === 'false_alarm'; }).length,
    reopened: win.filter(function(e){ return e.reopenedFrom; }).length,
    total: win.length
  };
}

/* 2 h buckets for the trend charts, oldest first. */
function trend(){
  var out = [];
  for (var k = 5; k >= 0; k--) {
    var hi = now() - 120 * k * MIN, lo = hi - 120 * MIN;
    var win = S.events.filter(function(e){ return e.detectedAt > lo && e.detectedAt <= hi; });
    var conf = win.filter(function(e){ return e.status === 'confirmed'; });
    var man = conf.filter(function(e){ return e.source === 'manual'; }).length;
    out.push({
      label: k === 0 ? 'Last 2h' : '−' + (k * 2) + 'h',
      manualFrac: conf.length ? man / conf.length : null,
      medianDetect: median(win.map(function(e){ return e.lagMin; })),
      n: conf.length
    });
  }
  return out;
}

/* Failure-mode status from the sensitivity test thresholds. */
function phase(m){
  if ((m.manualFrac != null && m.manualFrac > 0.15) || (m.autoRate != null && m.autoRate < 0.85)) return {n:2, label:'Phase 2 · accuracy degrading', tone:'red'};
  if (m.medianDetect != null && m.medianDetect > 5.2) return {n:1, label:'Phase 1 · speed degrading', tone:'amber'};
  if (m.manualFrac != null && m.manualFrac > 0.12) return {n:0, label:'Watch · manual catches rising', tone:'amber'};
  return {n:0, label:'Healthy', tone:'green'};
}

/* Reviewer-fatigue guard: several fast “false alarm” decisions in a row. */
function fatigue(){
  var mine = S.events.filter(function(e){ return !e.history && e.decision && e.decision.reviewSec != null && e.decision.live; })
    .sort(function(a, b){ return b.decision.at - a.decision.at; }).slice(0, 4);
  if (mine.length < 3) return null;
  var fa = mine.filter(function(e){ return e.status === 'false_alarm'; });
  var fast = fa.filter(function(e){ return e.decision.reviewSec < 25; });
  if (fa.length >= 3 && fast.length >= 3) return {count: fa.length, window: mine.length, medianSec: median(fa.map(function(e){ return e.decision.reviewSec; }))};
  return null;
}

/* ---------- mutations ---------- */
function log(actor, action, outcome, just, eventId){
  S.audit.unshift({ts: now(), actor: actor, action: action, outcome: outcome, just: just || '', eventId: eventId || null});
}

var STATUS_LABEL = {confirmed:'Confirmed', unresolved:'Unresolved', false_alarm:'False alarm'};

function decide(id, d){
  var e = byId(id); if (!e) return null;
  var t = now();
  e.status = d.status;
  e.decision = {
    by: d.by || 'Sammy Leung (CC)', status: d.status, at: t, note: d.note || '', category: d.category || null,
    action: d.action || null, reviewSec: d.reviewSec, live: true,
    nextCheckMin: d.nextCheckMin || null, nextCheckAt: d.nextCheckMin ? t + d.nextCheckMin * MIN : null,
    verified: !!d.verified
  };
  var extra = d.status === 'confirmed' ? ' → ' + d.action : d.status === 'false_alarm' ? ' (' + d.category + ')' : ' · re-check in ' + d.nextCheckMin + ' min';
  if (d.status === 'confirmed' && d.action) e.followup = startFollowup(e, d.action, 1);
  log(e.decision.by, STATUS_LABEL[d.status] + ' — ' + e.device + extra, d.status === 'false_alarm' ? 'success' : d.status === 'unresolved' ? 'pending' : 'success', d.note, id);
  save();
  return e;
}

function addManualReport(o){
  var d = registerDevice(o.device, {officer: o.officer});
  S.counter++;
  var t = now();
  var e = {
    id: 'VQ-' + S.counter, device: o.device, officer: o.officer || d.officer, group: d.group, area: d.area, source: 'manual',
    kind: 'Manual report', summary: o.note || '', confidence: null,
    detectedAt: t, onsetAt: t - 10 * MIN, lagMin: 10, tracks: {hb:[], rec:[], up:[]},
    hints: [{w:'for', t:'Human report from command center'}], memos: [{at: t, by: o.by || 'Sammy Leung (CC)', text: o.note || ''}],
    snapshot: null, status: 'pending', decision: null, reportedBy: o.by || 'Sammy Leung (CC)', reopenedFrom: o.reopenedFrom || null
  };
  S.events.unshift(e);
  log(e.reportedBy, 'Manual anomaly report — ' + o.device, 'pending', o.note, e.id);
  save();
  return e;
}

/* Demo helper: the officer says the problem persists after a reviewer cleared it. */
function reopenAsMissed(id){
  var src = byId(id); if (!src) return null;
  return addManualReport({device: src.device, by: 'Alex Muller (Leader)', reopenedFrom: id,
    note: 'Field report: problem persists on ' + src.device + ' after the false-alarm decision (' + id + ').'});
}

var POOL = [
  {device:'BWC-B09', kind:'Battery drain anomaly', confidence:0.71, lag:4, summary:'Battery fell 18% in 10 min, about 3x the unit baseline.', hints:[{w:'for', t:'Drain rate 3x baseline'},{w:'against', t:'Unit was uploading a large backlog, which also drains power'}]},
  {device:'BWC-B02', kind:'Recording gap · 90 s', confidence:0.52, lag:7, summary:'One 90 s video gap with continuous audio.', hints:[{w:'for', t:'Unexplained 90 s video gap'},{w:'against', t:'Audio continuous, pause button pressed once'}]},
  {device:'BWC-D01', kind:'Sync delay', confidence:0.66, lag:4, summary:'Upload backlog of 9 min.', hints:[{w:'for', t:'Backlog growing'},{w:'against', t:'Recording and heartbeat healthy'}]},
  {device:'BWC-A12', kind:'Fake online suspected', confidence:0.81, lag:5, summary:'Heartbeat OK but upload bytes dropped to zero for 12 min.', hints:[{w:'for', t:'Zero upload bytes for 12 min while heartbeat OK'}]},
  {device:'BWC-C04', kind:'Recording stuck', confidence:0.9, lag:3, summary:'Frame counter has not advanced for 6 min.', hints:[{w:'for', t:'Frame counter frozen for 6 min'},{w:'for', t:'Pattern matches known firmware bug'}]},
  {device:'BWC-B12', kind:'Intermittent disconnect', confidence:0.6, lag:6, summary:'Three disconnects of under 30 s in 10 min.', hints:[{w:'for', t:'3 disconnects in 10 min'},{w:'against', t:'VIP floor has known weak coverage in the lift lobby'}]}
];
function inject(count){
  var made = [];
  for (var i = 0; i < count; i++) {
    var p = POOL[(S.counter + i) % POOL.length];
    var d = DIRECTORY[p.device];
    S.counter++;
    var t = now() - i * 20000;
    made.push({
      id: 'VQ-' + S.counter, device: p.device, officer: d.officer, group: d.group, area: d.area, source: 'auto', kind: p.kind, summary: p.summary,
      confidence: p.confidence, detectedAt: t, onsetAt: t - p.lag * MIN, lagMin: p.lag,
      tracks: {hb:[], rec: p.kind.indexOf('Recording') === 0 || p.kind.indexOf('stuck') > -1 ? [[8, 0]] : [], up: p.kind.indexOf('Sync') > -1 || p.kind.indexOf('Fake') > -1 ? [[12, 0]] : []},
      hints: p.hints, memos: [], snapshot: null, status: 'pending', decision: null
    });
  }
  S.events = made.concat(S.events);
  log('System (Auto)', 'Detection: ' + count + ' new alert' + (count > 1 ? 's' : '') + ' queued for review', 'success', '', null);
  save();
  return made;
}

function reset(){ try { localStorage.removeItem(KEY); } catch(e) {} S = seed(); save(); }

load();
setInterval(save, 5000);
window.addEventListener('beforeunload', save);
window.addEventListener('storage', function(){ reload(); });

window.MR = {
  DIRECTORY: DIRECTORY, STATUS_LABEL: STATUS_LABEL, MIN: MIN,
  now: now, fmtTime: fmtTime, fmtStamp: fmtStamp,
  events: events, byId: byId, isOpen: isOpen, isRecheckDue: isRecheckDue,
  pendingCount: pendingCount, openCount: openCount, groupSummary: groupSummary,
  metrics: metrics, trend: trend, phase: phase, fatigue: fatigue,
  registerDevice: registerDevice, tickFollowups: tickFollowups, retryFollowup: retryFollowup, adjustedAbnormal: adjustedAbnormal, signalHTML: signalHTML, bindSignal: bindSignal, signals: signals, deviceSnapshot: deviceSnapshot, latestEvent: latestEvent, DEVICE_INFO: DEVICE_INFO,
  decide: decide, addManualReport: addManualReport, reopenAsMissed: reopenAsMissed, inject: inject, reset: reset,
  audit: function(){ return S.audit; }, reload: reload, save: save
};
})();
