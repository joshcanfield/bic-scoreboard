// Native ES module version of the control UI (no jQuery/Bootstrap JS)
// Transport: native WebSocket (no Socket.IO)

// ---------- Utilities ----------
const pad = (d, w) => ("000000" + d).slice(-w);
const digits2 = (n) => [Math.floor(n / 10), n % 10];
const parseClock = (clock) => {
  const s = String(clock).replace(":", "");
  let m = 0, sec = 0;
  if (s.length > 2) {
    sec = parseInt(s.slice(-2), 10);
    m = parseInt(s.slice(0, -2), 10);
  } else {
    sec = parseInt(s, 10);
  }
  if (Number.isNaN(m) || Number.isNaN(sec)) return null;
  return { minutes: m, seconds: sec };
};
const parseClockMillis = (clock) => {
  if (typeof clock === 'number') return clock;
  const parts = parseClock(clock);
  if (!parts) return null;
  return (parts.minutes * 60 + parts.seconds) * 1000;
};
const formatClock = (m, s) => `${pad(m, 2)}:${pad(s, 2)}`;
const millisToMinSec = (millis) => ({
  minutes: Math.floor(millis / 1000 / 60),
  seconds: Math.floor((millis / 1000) % 60)
});
const roundToSecond = (millis) => Math.floor((Number(millis)||0 + 999) / 1000) * 1000;

// ---------- Rec time math (exposed for client-side tests) ----------
const gcd = (a, b) => {
  a = Math.abs(a || 0); b = Math.abs(b || 0);
  while (b !== 0) { const t = b; b = a % b; a = t; }
  return a;
};
const lcm = (a, b) => Math.abs(a * b) / (gcd(a, b) || 1);
const minutesStepForShift = (shiftSec) => {
  if (shiftSec <= 0) return 15;
  const g = gcd(60, shiftSec);
  const stepA = shiftSec / (g || 1);
  const step = lcm(15, stepA);
  return Math.max(15, step);
};
const __getShiftTotalForNormalize = () => {
  // Try to read current UI value if present; fallback 0
  const sel = typeof document !== 'undefined' ? document.getElementById('shift-select') : null;
  const enabled = typeof window !== 'undefined' ? (window.shiftEnabled ?? true) : true;
  const v = sel ? (parseInt(sel.value || '0', 10) || 0) : 0;
  return enabled ? v : 0;
};
const normalizeMinutes = (m, shiftOverride) => {
  const shift = typeof shiftOverride === 'number' ? shiftOverride : __getShiftTotalForNormalize();
  const step = minutesStepForShift(shift);
  if (step <= 0) return m;
  const floored = Math.floor(m / step) * step; // do not extend time
  return Math.max(step, floored);
};

try { window.__test = { minutesStepForShift, normalizeMinutes }; } catch(_) {}

// ---------- HTTP helpers ----------
const api = {
  request: async (method, endpoint, body) => {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(`/api/game/${endpoint}`, opts);
    if (!res.ok) throw new Error(`${method} ${endpoint} failed: ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  },
  get: (endpoint = '') => api.request('GET', endpoint),
  put: (endpoint, body) => api.request('PUT', endpoint, body),
  post: (endpoint, body) => api.request('POST', endpoint, body),
  del: (endpoint) => api.request('DELETE', endpoint),
};

// ---------- State ----------
const State = {
  time: 0,
  running: false,
  period: 0,
  periodLengthMillis: 0,
  home: { score: 0, shots: 0, penalties: [] },
  away: { score: 0, shots: 0, penalties: [] },
  scoreboardOn: false,
  buzzerOn: false,
  portNames: [],
  currentPort: '',
};

// ---------- Transport (Socket.IO or native WebSocket) ----------
const buildBaseHost = (defPort) => {
  const url = new URL(window.location.href);
  const host = url.searchParams.get('socketHost') || window.location.hostname;
  const port = url.searchParams.get('socketPort') || defPort;
  return { host, port, isHttps: window.location.protocol === 'https:' };
};
const createTransport = () => {
  const defaultPort = '8082';
  const { host, port, isHttps } = buildBaseHost(defaultPort);
  const wsUrl = `${isHttps ? 'wss' : 'ws'}://${host}:${port}/ws`;

  const listeners = new Map();
  const statusHandlers = { connect: null, disconnect: null, error: null, reconnecting: null };
  let ws = null;
  let shouldReconnect = true;
  let reconnectDelay = 500;
  const reconnectDelayMax = 5000;
  const pending = [];

  const flushPending = () => {
    while (pending.length && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(pending.shift());
    }
  };

  const connect = () => {
    if (statusHandlers.reconnecting) statusHandlers.reconnecting();
    ws = new WebSocket(wsUrl);
    ws.addEventListener('open', () => {
      reconnectDelay = 500;
      statusHandlers.connect && statusHandlers.connect();
      flushPending();
    });
    ws.addEventListener('message', (e) => {
      try {
        const msg = JSON.parse(e.data);
        const cb = listeners.get(msg.event);
        if (cb) cb(msg.data);
      } catch (_) {/* ignore */}
    });
    ws.addEventListener('close', () => {
      statusHandlers.disconnect && statusHandlers.disconnect();
      if (shouldReconnect) {
        const delay = reconnectDelay;
        reconnectDelay = Math.min(reconnectDelay * 2, reconnectDelayMax);
        setTimeout(connect, delay);
      }
    });
    ws.addEventListener('error', () => {
      statusHandlers.error && statusHandlers.error();
      // close event will schedule reconnect
    });
  };

  connect();

  return {
    kind: 'ws',
    on: (event, cb) => listeners.set(event, cb),
    emit: (event, data) => {
      const payload = JSON.stringify({ event, data });
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(payload); else pending.push(payload);
    },
    onStatus: (handlers) => Object.assign(statusHandlers, handlers)
  };
};
const transport = createTransport();
const socket = { on: transport.on, emit: transport.emit };
const Server = {
  startClock: () => socket.emit('clock_start'),
  pauseClock: () => socket.emit('clock_pause'),
  goal: (data) => socket.emit('goal', data),
  undoGoal: (data) => socket.emit('undo_goal', data),
  shot: (data) => socket.emit('shot', data),
  undoShot: (data) => socket.emit('undo_shot', data),
  buzzer: () => socket.emit('buzzer'),
  powerOn: () => socket.emit('power_on'),
  powerOff: () => socket.emit('power_off'),
  powerState: () => socket.emit('power_state'),
  setPeriod: (p) => socket.emit('set_period', { period: p }),
  createGame: (cfg) => socket.emit('createGame', cfg),
};

// ---------- DOM helpers ----------
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const on = (el, type, selOrHandler, handler) => {
  if (!handler) { el.addEventListener(type, selOrHandler); return; }
  el.addEventListener(type, (e) => {
    const t = e.target.closest(selOrHandler);
    if (t && el.contains(t)) handler(e, t);
  });
};

// Minimal modal management (Bootstrap-like)
const Modals = (() => {
  const show = (modal) => {
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('in');
    document.body.classList.add('modal-open');
  };
  const hide = (modal) => {
    modal.classList.remove('in');
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
  };
  const showById = (id) => show($(id.startsWith('#') ? id : `#${id}`));
  const init = () => {
    // open via [data-toggle="modal"][href="#id"]
    on(document, 'click', '[data-toggle="modal"]', (e, t) => {
      e.preventDefault();
      const href = t.getAttribute('href');
      if (href) showById(href);
      // store trigger for later access
      const m = $(href);
      if (m) m.__trigger = t;
    });
    // close via [data-dismiss="modal"]
    on(document, 'click', '[data-dismiss="modal"]', (e, t) => {
      e.preventDefault();
      const m = t.closest('.modal');
      if (m) hide(m);
    });
    // backdrop click
    on(document, 'click', '.modal', (e, t) => {
      if (e.target === t) hide(t);
    });
  };
  return { init, show, hide, showById };
})();

// ---------- Rendering ----------
const formatPenalties = (team, penalties) => {
  return penalties.map(p => {
    const remaining = p.startTime > 0 ? Math.max(0, p.time - p.elapsed) : p.time;
    const rem = millisToMinSec(remaining);
    const off = millisToMinSec(p.offIceTime);
    const st = millisToMinSec(p.startTime);
    const durM = Math.floor(p.time/60000), durS = Math.floor((p.time/1000)%60);
    const detailsAttrs = `data-action="penalty-details" data-team="${team}" data-pid="${p.id}"
      data-player="${p.playerNumber}"
      data-period="${p.period}"
      data-duration="${formatClock(durM, durS)}"
      data-off="${formatClock(off.minutes, off.seconds)}"
      data-start="${formatClock(st.minutes, st.seconds)}"
      data-remaining="${formatClock(rem.minutes, rem.seconds)}"`;
    const offender = String(p.playerNumber);
    const serving = (p.servingPlayerNumber != null && p.servingPlayerNumber !== undefined) ? String(p.servingPlayerNumber) : offender;
    const pnHtml = (serving && serving !== offender)
      ? `<span class="pn" data-serving="${serving}">${offender}</span>`
      : `<span class="pn">${offender}</span>`;
    return `<tr>
      <td>${p.period}</td>
      <td>${pnHtml}</td>
      <td>${formatClock(rem.minutes, rem.seconds)}</td>
      <td>
        <a href="#" ${detailsAttrs} title="Details">Details</a>
        &nbsp;|&nbsp;
        <a href="#" data-action="delete-penalty" data-team="${team}" data-pid="${p.id}">x</a>
      </td>
    </tr>`;
  }).join('');
};

const formatPenaltyPlaceholders = (count) => {
  if (count <= 0) return '';
  // 4 columns: Period, #, Remaining, action
  const mkCells = () => ['—','—','—','—'].map(txt => `<td>${txt}</td>`).join('');
  const emptyRow = () => `<tr class="placeholder">${mkCells()}</tr>`;
  return Array.from({ length: count }).map(emptyRow).join('');
};

const renderPenaltyTable = (teamElem, teamKey, penalties) => {
  const listTBody = teamElem && teamElem.querySelector('tbody.list');
  const phTBody = teamElem && teamElem.querySelector('tbody.placeholders');
  const filtered = (penalties || []).filter(p => {
    const remaining = (p && p.startTime > 0) ? (p.time - p.elapsed) : p.time;
    return (remaining || 0) > 0;
  });
  if (listTBody) listTBody.innerHTML = formatPenalties(teamKey, filtered);
  const actual = filtered.length;
  const needed = Math.max(0, 2 - actual);
  if (phTBody) phTBody.innerHTML = formatPenaltyPlaceholders(needed);
};

const renderUpdate = (data) => {
  Object.assign(State, {
    time: data.time,
    running: data.running,
    period: data.period,
    periodLengthMillis: data.periodLength * 60 * 1000,
    home: data.home,
    away: data.away,
    scoreboardOn: data.scoreboardOn,
    buzzerOn: data.buzzerOn,
  });

  const home = $('#home');
  const away = $('#away');
  const clockBox = $('#clock_box');

  // penalties
  renderPenaltyTable(home, 'home', data.home.penalties);
  renderPenaltyTable(away, 'away', data.away.penalties);

  // clock update: text element only (mm:ss)
  const { minutes, seconds } = millisToMinSec(State.time);
  const clockText = document.getElementById('clock-text');
  if (clockText) clockText.textContent = `${pad(minutes,2)}:${pad(seconds,2)}`;

  // elapsed phrase
  let elapsedText = '';
  if (State.periodLengthMillis > 0) {
    const elapsed = State.periodLengthMillis - State.time;
    const em = Math.floor(elapsed / 60000);
    const es = Math.floor((elapsed / 1000) % 60);
    if (em > 0) elapsedText += `${em} minute${em===1?'':'s'}`;
    if (elapsedText) elapsedText += ' and ';
    elapsedText += `${es} seconds`;
  } else {
    elapsedText = '\u00a0';
  }
  $('#clock-moment').innerHTML = elapsedText;

  // period
  $('#period .digit').textContent = State.period;

  // play/pause toggle (legacy + big CTA if present)
  // Keep legacy start/pause anchors hidden; do not toggle their display
  const toggle = document.getElementById('clock-toggle');
  if (toggle) {
    const icon = toggle.querySelector('.glyphicon');
    const label = toggle.querySelector('.cta-text');
    if (State.running) {
      if (icon) icon.className = 'glyphicon glyphicon-pause';
      if (label) label.textContent = 'Pause';
    } else {
      if (icon) icon.className = 'glyphicon glyphicon-play';
      if (label) label.textContent = 'Start';
    }
  }

  // scores: update text elements (no split digits)
  const homeScoreText = document.getElementById('home-score');
  const awayScoreText = document.getElementById('away-score');
  const hd = digits2(data.home.score);
  const ad = digits2(data.away.score);
  if (homeScoreText) homeScoreText.textContent = `${hd[0]}${hd[1]}`;
  if (awayScoreText) awayScoreText.textContent = `${ad[0]}${ad[1]}`;

  // shots (compact counter, no split digits)
  const hs = data.home.shots || 0;
  const as = data.away.shots || 0;
  const homeShots = document.getElementById('home-shots');
  const awayShots = document.getElementById('away-shots');
  if (homeShots) homeShots.textContent = String(hs);
  if (awayShots) awayShots.textContent = String(as);

  // power + buzzer visuals
  if (typeof updatePowerFromServer === 'function') {
    updatePowerFromServer(!!data.scoreboardOn);
  }
  document.body.classList.toggle('buzzer', !!data.buzzerOn);
};

// ---------- Ports UI ----------
const refreshPortDialog = () => {
  const wrap = $('#connect-portNames');
  if (wrap) wrap.innerHTML = '';
};

const renderPortPills = (activeIndex = 0) => {
  const wrap = $('#connect-portNames');
  if (!wrap) return;
  wrap.innerHTML = '';
  (portStepper.ports || []).forEach((name, i) => {
    const pill = document.createElement('span');
    pill.className = 'port-pill' + (i === activeIndex ? ' active' : '') + (i < activeIndex ? ' tried' : '');
    pill.textContent = name;
    wrap.appendChild(pill);
  });
};

// Step through ports one by one and ask for confirmation
let portStepper = { ports: [], index: 0, active: false };
let notOnCountdownTimer = null;
const startNotOnCountdown = (btn, seconds = 5, nextName = '') => {
  if (!btn) return;
  if (notOnCountdownTimer) { clearInterval(notOnCountdownTimer); notOnCountdownTimer = null; }
  let remaining = seconds;
  const waitingText = 'Waiting';
  btn.disabled = true;
  btn.textContent = `${waitingText} (${remaining})`;
  notOnCountdownTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(notOnCountdownTimer);
      notOnCountdownTimer = null;
      btn.disabled = false;
      btn.textContent = nextName ? `Try ${nextName}` : 'Not On';
    } else {
      btn.textContent = `${waitingText} (${remaining})`;
    }
  }, 1000);
};
const setConnectMessage = (msg) => { const el = $('#connect-message'); if (el) el.textContent = msg || ''; };
const tryPortAtIndex = async (i) => {
  const modal = $('#scoreboard-connect');
  const prog = modal.querySelector('.progress');
  const notOnBtn = $('#not-on');
  const confirmBtn = $('#confirm-on');
  const retryBtn = $('#retry-ports');
  const name = portStepper.ports[i];
  if (!name) {
    // Exhausted ports: keep dialog open, set UI to Off, allow Retry/Give Up elsewhere
    if (prog) prog.style.display = 'none';
    setConnectMessage('No more ports to try. Check USB/power and cables.');
    portStepper.active = false;
    try { Server.powerOff(); } catch {}
    setPowerUI('off');
    renderPortPills(portStepper.ports.length); // mark all as tried
    if (notOnBtn) { if (notOnCountdownTimer) { clearInterval(notOnCountdownTimer); notOnCountdownTimer = null; } notOnBtn.style.display = 'none'; notOnBtn.disabled = false; notOnBtn.textContent = 'Not On'; }
    // Keep confirm visible; Retry/Give Up are shown by the Not On handler when appropriate
    return;
  }
  renderPortPills(i);
  if (prog) prog.style.display = '';
  setConnectMessage(`Trying ${name}… Did the scoreboard turn on?`);
  try {
    const resp = await api.post('portName', { portName: name });
    if (resp) {
      State.portNames = resp.portNames || State.portNames;
      State.currentPort = resp.currentPort || name;
    } else {
      State.currentPort = name;
    }
    // Explicitly power on for this port (ensure previous off)
    try { Server.powerOff(); } catch {}
    try { Server.powerOn(); } catch {}
  } finally {
    setTimeout(() => { if (prog) prog.style.display = 'none'; }, 400);
  }
  // Temporarily disable "Didn't Turn On" for 5 seconds to allow hardware to respond
  if (notOnBtn) {
    notOnBtn.style.display = '';
    if (retryBtn) retryBtn.style.display = 'none';
    if (confirmBtn) { confirmBtn.textContent = "It's On!"; confirmBtn.className = 'btn btn-success'; }
    const nextName = portStepper.ports[i+1] || '';
    startNotOnCountdown(notOnBtn, 5, nextName);
  }
};
const resetConnectDialogUI = () => {
  const notOnBtn = $('#not-on');
  const confirmBtn = $('#confirm-on');
  const retryBtn = $('#retry-ports');
  const giveUpBtn = $('#give-up');
  if (notOnCountdownTimer) { clearInterval(notOnCountdownTimer); notOnCountdownTimer = null; }
  setConnectMessage('');
  if (retryBtn) retryBtn.style.display = 'none';
  if (giveUpBtn) giveUpBtn.style.display = 'none';
  if (confirmBtn) { confirmBtn.style.display = ''; confirmBtn.textContent = "It's On!"; confirmBtn.className = 'btn btn-success'; }
  if (notOnBtn) { notOnBtn.style.display = 'none'; notOnBtn.disabled = false; notOnBtn.textContent = 'Not On'; }
  renderPortPills(0);
};

const beginPortStepper = async () => {
  portStepper.active = true;
  // Build ordered ports: try currentPort first if present
  const ports = [...(State.portNames || [])];
  const curr = State.currentPort;
  if (curr) {
    const idx = ports.indexOf(curr);
    if (idx > 0) { ports.splice(idx, 1); ports.unshift(curr); }
  }
  portStepper.ports = ports;
  portStepper.index = 0;
  resetConnectDialogUI();
  Modals.showById('#scoreboard-connect');
  await tryPortAtIndex(portStepper.index);
};

// ---------- Wire up events ----------
const initEvents = () => {
  // Team color palettes (inline in header)
  // Predefined: black, white, red, dark blue, teal, green
  const DEFAULT_COLORS = ['#000000','#ffffff','#e74c3c','#0d47a1','#1abc9c','#2ecc71'];
  const getCssVar = (name, fallback) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (v && v.trim()) || fallback || '';
  };
  const renderPalette = (containerId, cssVarName) => {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    const current = getCssVar(cssVarName);
    DEFAULT_COLORS.forEach((color) => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'color-swatch' + (color.toLowerCase() === (current||'').toLowerCase() ? ' selected' : '');
      sw.style.backgroundColor = color;
      sw.title = color;
      sw.setAttribute('aria-label', color);
      sw.addEventListener('click', () => {
        document.documentElement.style.setProperty(cssVarName, color);
        // update selection state
        [...el.querySelectorAll('.color-swatch')].forEach(n => n.classList.remove('selected'));
        sw.classList.add('selected');
      });
      el.appendChild(sw);
    });
  };
  // Render inline palettes on load
  renderPalette('home-color-palette', '--home-color');
  renderPalette('away-color-palette', '--away-color');
  // Navbar buttons
  $('#buzzer').addEventListener('click', () => Server.buzzer());
  $('#clock-start').addEventListener('click', () => Server.startClock());
  $('#clock-pause').addEventListener('click', () => Server.pauseClock());

  // Period controls
  $('.period-up').addEventListener('click', () => Server.setPeriod(State.period + 1));
  $('.period-down').addEventListener('click', () => Server.setPeriod(Math.max(0, State.period - 1)));

  // Score buttons
  $$('.score-up').forEach(btn => btn.addEventListener('click', (e) => {
    const team = e.currentTarget.dataset.team;
    Server.goal({ team, player: 10, assist: 15 });
  }));
  $$('.score-down').forEach(btn => btn.addEventListener('click', (e) => {
    const team = e.currentTarget.dataset.team;
    Server.undoGoal({ team });
  }));

  // Shot buttons
  $$('.shots-up').forEach(btn => btn.addEventListener('click', (e) => {
    const team = e.currentTarget.dataset.team;
    Server.shot({ team });
  }));
  $$('.shots-down').forEach(btn => btn.addEventListener('click', (e) => {
    const team = e.currentTarget.dataset.team;
    Server.undoShot({ team });
  }));

  // Delete penalty (delegated)
  on(document, 'click', 'a[data-action="delete-penalty"]', (e, t) => {
    e.preventDefault();
    const team = t.dataset.team; const pid = t.dataset.pid;
    api.del(`${team}/penalty/${pid}`).catch(()=>{});
  });

  // Penalty details popup (delegated)
  on(document, 'click', 'a[data-action="penalty-details"]', (e, t) => {
    e.preventDefault();
    const dlg = $('#penalty-details');
    if (!dlg) return;
    const set = (sel, val) => { const el = sel ? dlg.querySelector(sel) : null; if (el) el.textContent = String(val || ''); };
    set('#pd-team', (t.dataset.team || '').toUpperCase());
    set('#pd-period', t.dataset.period || '—');
    set('#pd-player', t.dataset.player || '—');
    set('#pd-duration', t.dataset.duration || '—');
    set('#pd-off', t.dataset.off || '—');
    set('#pd-start', t.dataset.start || '—');
    set('#pd-remaining', t.dataset.remaining || '—');
    Modals.show(dlg);
  });

  // Power control button workflow
  const powerBtn = $('#power-btn');
  const powerStatus = $('#power-status');
  let powerState = 'off'; // off | connecting | assumed | on | error
  const setPowerUI = (state, text) => {
    powerState = state;
    switch (state) {
      case 'off':
        if (powerBtn) powerBtn.disabled = false;
        if (powerStatus) { powerStatus.className = 'label label-danger'; powerStatus.textContent = 'Scoreboard Off'; }
        break;
      case 'connecting':
        if (powerBtn) powerBtn.disabled = true;
        if (powerStatus) { powerStatus.className = 'label label-info'; powerStatus.textContent = text || 'Opening port…'; }
        break;
      case 'assumed':
        if (powerBtn) powerBtn.disabled = true;
        if (powerStatus) { powerStatus.className = 'label label-warning'; powerStatus.textContent = 'Assumed On — confirm'; }
        break;
      case 'on':
        if (powerBtn) powerBtn.disabled = false;
        if (powerStatus) { powerStatus.className = 'label label-success'; powerStatus.textContent = 'Scoreboard On'; }
        break;
      case 'error':
        if (powerBtn) powerBtn.disabled = false;
        if (powerStatus) { powerStatus.className = 'label label-danger'; powerStatus.textContent = text || 'Error'; }
        break;
    }
  };
  window.updatePowerFromServer = (on) => {
    // If server reports a boolean, reflect it unless we're mid-assumed confirmation
    if (powerState === 'connecting' || powerState === 'assumed') return;
    setPowerUI(on ? 'on' : 'off');
  };
  setPowerUI(State.scoreboardOn ? 'on' : 'off');

  if (powerBtn) powerBtn.addEventListener('click', async () => {
    if (powerState === 'on') {
      // Turn off
      setPowerUI('connecting', 'Turning off…');
      try { Server.powerOff(); } catch {}
      // Assume quick off
      setTimeout(() => setPowerUI('off'), 500);
      return;
    }
    // Turn on flow
    setPowerUI('connecting', 'Opening port…');
    // Prepare ports list
    try {
      const data = await api.get('portNames');
      State.portNames = data.portNames || [];
      State.currentPort = data.currentPort || '';
      refreshPortDialog();
    } catch {}
    // Step through ports if available, otherwise show modal with message
    if (State.portNames && State.portNames.length) {
      setPowerUI('assumed');
      await beginPortStepper();
    } else {
      setPowerUI('error', 'No serial ports found');
      resetConnectDialogUI();
      Modals.showById('#scoreboard-connect');
      setConnectMessage('No serial ports detected. Check USB/power and try again.');
    }
  });

  // Big clock toggle (if present)
  const clockToggle = document.getElementById('clock-toggle');
  if (clockToggle) {
    clockToggle.addEventListener('click', () => {
      if (State.running) Server.pauseClock(); else Server.startClock();
    });
  }

  // Confirmation from modal
  on(document, 'click', '#confirm-on', (e) => {
    setPowerUI('on');
  });
  on(document, 'click', '#not-on', async (e) => {
    // User indicates the board didn't turn on
    try { Server.powerOff(); } catch {}
    if (notOnCountdownTimer) { clearInterval(notOnCountdownTimer); notOnCountdownTimer = null; }
    const confirmBtn = $('#confirm-on');
    const retryBtn = $('#retry-ports');
    const giveUpBtn = $('#give-up');
    const notOnBtn = $('#not-on');
    if (portStepper.active) {
      const isLast = portStepper.index >= (portStepper.ports.length - 1);
      if (!isLast) {
        portStepper.index += 1;
        await tryPortAtIndex(portStepper.index);
      } else {
        // Last port: show Retry + Give Up, hide confirm
        setConnectMessage('No more ports to try. You can Retry or Give Up.');
        if (confirmBtn) { confirmBtn.style.display = ''; }
        if (retryBtn) retryBtn.style.display = '';
        if (giveUpBtn) giveUpBtn.style.display = '';
        if (notOnBtn) notOnBtn.style.display = 'none';
      }
    } else {
      const modal = $('#scoreboard-connect');
      Modals.hide(modal);
      setPowerUI('off');
    }
  });

  // Retry through ports again
  on(document, 'click', '#retry-ports', async () => {
    const notOnBtn = $('#not-on');
    const confirmBtn = $('#confirm-on');
    const retryBtn = $('#retry-ports');
    const giveUpBtn = $('#give-up');
    if (retryBtn) retryBtn.style.display = 'none';
    if (giveUpBtn) giveUpBtn.style.display = 'none';
    if (notOnBtn) { notOnBtn.style.display = ''; notOnBtn.disabled = true; }
    if (confirmBtn) { confirmBtn.style.display = ''; confirmBtn.textContent = "It's On!"; confirmBtn.className = 'btn btn-success'; }
    // Refresh port list
    try {
      const data = await api.get('portNames');
      State.portNames = data.portNames || [];
      State.currentPort = data.currentPort || '';
    } catch {}
    setPowerUI('assumed');
    await beginPortStepper();
  });

  // Give up: close port and dialog, reflect Off
  on(document, 'click', '#give-up', () => {
    const modal = $('#scoreboard-connect');
    try { Server.powerOff(); } catch {}
    setPowerUI('off');
    Modals.hide(modal);
  });

  // Set clock modal presets
  const setClockDialog = $('#set-clock');
  setClockDialog.addEventListener('click', (e) => {
    const btn = e.target.closest('button.time');
    if (!btn) return;
    const time = String(btn.dataset.time);
    const millis = parseClockMillis(time);
    if (millis == null) return;
    api.put('', { time: millis }).then(() => Modals.hide(setClockDialog)).catch(() => {
      setClockDialog.querySelector('.error').textContent = 'Failed to update the time';
    });
  });
  $('#save-custom-time').addEventListener('click', async (e) => {
    const custom = $('#custom-time').value;
    const millis = parseClockMillis(custom);
    const err = setClockDialog.querySelector('.error');
    if (millis == null) { err.textContent = 'Invalid time. Example 20:00'; return; }
    try {
      await api.put('', { time: millis });
      Modals.hide(setClockDialog);
      err.textContent = '';
    } catch {
      err.textContent = 'Failed to update the time';
    }
  });

  // When opening set-clock (via data-toggle), prefill value
  on(document, 'click', 'a[href="#set-clock"][data-toggle="modal"]', () => {
    const { minutes, seconds } = millisToMinSec(State.time);
    $('#custom-time').value = formatClock(minutes, seconds);
    setClockDialog.querySelector('.error').textContent = '';
  });

  // New game (standard)
  $('#new-game').addEventListener('click', () => {
    const periods = [];
    let error = false;
    for (let i=0;i<=3;i++) {
      const field = $(`#period-${i}`);
      const val = field.value.trim();
      if (i===0 && val === '0') { periods[i] = 0; continue; }
      const n = parseInt(val, 10);
      if (!n) { field.closest('.form-group').classList.add('has-error'); error = true; }
      else { periods[i] = n; }
    }
    if (error) return;
    Server.createGame({ periodLengths: periods });
    Modals.hide($('#new-game-dialog'));
  });

  // Rec inputs: duration <-> ends-at bi-directional sync
  const recMinutesGroup = $('#rec_minutes_group');
  const recEndsGroup = $('#rec_ends_group');
  const recMinutesField = $('#rec_minutes');
  const recEndsField = $('#rec_ends_at');
  let recSyncing = false;
  let lastRawMinutes = 0;
  // Shift controls: declare early so helpers can use them
  const shiftSelectEl = document.getElementById('shift-select');
  const shiftToggleBtn = document.getElementById('shift-toggle');
  let shiftEnabled = true;
  let lastShiftNonZero = 120; // default 2:00
  const getShiftTotal = () => {
    const v = shiftSelectEl ? parseInt(shiftSelectEl.value || '0', 10) || 0 : 0;
    return shiftEnabled ? v : 0;
  };
  // Constraints and helper display
  const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a || 0);
  const lcm = (a, b) => Math.abs(a * b) / (gcd(a, b) || 1);
  const minutesStepForShift = (shiftSec) => {
    if (shiftSec <= 0) return 15;
    const g = gcd(60, shiftSec);
    const stepA = shiftSec / g; // minutes granularity to align with shift
    return lcm(15, stepA);
  };
  // Shift-only minute step (no quarter-hour constraint)
  const minutesStepForShiftOnly = (shiftSec) => {
    if (shiftSec <= 0) return 1;
    const g = gcd(60, shiftSec);
    return shiftSec / g;
  };
  const normalizeMinutes = (m) => {
    const step = minutesStepForShift(getShiftTotal());
    if (step <= 0) return m;
    const floored = Math.floor(m / step) * step; // do not extend time
    return Math.max(step, floored);
  };
  const updateRecHelper = () => {
    const el = document.getElementById('rec-helper'); if (!el) return;
    const minutes = parseInt((recMinutesField && recMinutesField.value) || '0', 10) || 0;
    const shift = getShiftTotal();
    if (!minutes) { el.textContent = ''; return; }
    if (shift <= 0) { el.textContent = `Game: ${minutes} min • Shifts: disabled`; return; }
    const totalSec = minutes * 60;
    const count = Math.floor(totalSec / shift);
    const sm = Math.floor(shift / 60); const ss = shift % 60;
    el.textContent = `Game: ${minutes} min • Shifts: ${count} × ${pad(sm,2)}:${pad(ss,2)}`;
  };
  const computeRecPeriods = (minutes, shift) => {
    const res = [];
    const stepMin = minutesStepForShift(shift);
    const maxChunk = Math.max(stepMin, Math.floor(99 / stepMin) * stepMin) || 99;
    let remaining = minutes;
    while (remaining > 0) {
      const chunk = Math.min(remaining, maxChunk);
      res.push(chunk);
      remaining -= chunk;
    }
    return res;
  };
  const updateSplitHint = () => {
    const hint = document.getElementById('rec-split-hint'); if (!hint) return;
    const minutes = parseInt((recMinutesField && recMinutesField.value) || '0', 10) || 0;
    const shift = getShiftTotal();
    if (!minutes) { hint.textContent = ''; return; }
    const parts = computeRecPeriods(minutes, shift);
    if (parts.length <= 1) { hint.textContent = ''; return; }
    hint.textContent = `Periods: ${parts.join(' + ')}`;
  };
  const updateDivisibleHint = () => {
    const hint = document.getElementById('rec-divisible-hint');
    if (!hint) return;
    const minutes = parseInt((recMinutesField && recMinutesField.value) || '0', 10) || 0;
    const shift = getShiftTotal();
    if (minutes <= 0 || shift <= 0) { hint.textContent = ''; return; }
    const stepOnly = minutesStepForShiftOnly(shift);
    const minDown = Math.floor(minutes / stepOnly) * stepOnly;
    const isDivisible = ((minutes * 60) % shift) === 0;
    if (isDivisible) { hint.textContent = ''; return; }
    const totalShifts = Math.floor((minDown * 60) / shift);
    const sm = Math.floor(shift / 60); const ss = shift % 60;
    hint.textContent = `Rounding to ${minDown} min for shift length (${totalShifts} × ${pad(sm,2)}:${pad(ss,2)})`;
  };
  // 5-minute rounding helpers and options for ends-at select
  const pad2 = (n) => pad(n, 2);
  const roundToNearestFive = (d) => {
    const dt = new Date(d);
    dt.setSeconds(0, 0);
    const m = dt.getMinutes();
    const r = Math.round(m / 5) * 5;
    if (r === 60) { dt.setHours(dt.getHours() + 1); dt.setMinutes(0); }
    else dt.setMinutes(r);
    return dt;
  };
  const endsOptionValue = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const endsOptionLabel12 = (d) => {
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return `${h}:${pad2(m)} ${ampm}`;
  };
  const updateLastBuzzerHint = () => {
    const el = document.getElementById('rec-last-buzzer');
    if (!el) return;
    const shift = getShiftTotal();
    if (shift <= 0) { el.textContent = ''; return; }
    const v = (recEndsField && recEndsField.value) || '';
    const parts = v.split(':');
    if (parts.length < 2) { el.textContent = ''; return; }
    const hh = parseInt(parts[0], 10); const mm = parseInt(parts[1], 10);
    if (Number.isNaN(hh) || Number.isNaN(mm)) { el.textContent = ''; return; }
    const now = new Date();
    const end = new Date(now);
    end.setHours(hh, mm, 0, 0);
    if (end.getTime() <= now.getTime()) end.setDate(end.getDate() + 1);
    const durationSec = Math.floor((end.getTime() - now.getTime()) / 1000);
    let k = Math.floor(durationSec / shift);
    if (k <= 0) { el.textContent = 'Last buzzer: none before end'; return; }
    if (durationSec % shift === 0) k = k - 1; // ensure strictly before end
    if (k <= 0) { el.textContent = 'Last buzzer: none before end'; return; }
    const last = new Date(now.getTime() + k * shift * 1000);
    el.textContent = `Last buzzer: ${endsOptionLabel12(last)}`;
  };
  const populateEndsOptions = (targetDate) => {
    if (!recEndsField) return;
    const now = new Date();
    const start = roundToNearestFive(now);
    const vals = [];
    const hoursSpan = 12; // next 12 hours of 5-minute increments
    for (let i=0;i<hoursSpan*12;i++) {
      const dt = new Date(start.getTime() + i*5*60000);
      vals.push(endsOptionValue(dt));
    }
    recEndsField.innerHTML = Array.from({length: vals.length}).map((_, idx) => {
      const dt = new Date(start.getTime() + idx*5*60000);
      const v = endsOptionValue(dt);
      const label = endsOptionLabel12(dt);
      return `<option value="${v}">${label}</option>`;
    }).join('');
    if (targetDate) {
      const v = endsOptionValue(targetDate);
      if (!vals.includes(v)) recEndsField.insertAdjacentHTML('afterbegin', `<option value="${v}">${endsOptionLabel12(targetDate)}</option>`);
      recEndsField.value = v;
    } else {
      recEndsField.value = vals[0] || '';
    }
  };
  const setEndsFromMinutes = () => {
    if (!recMinutesField || !recEndsField) return;
    let mRaw = parseInt(recMinutesField.value || '0', 10);
    if (!mRaw) return;
    const mAdj = mRaw;
    recSyncing = true;
    const now = new Date();
    let end = new Date(now.getTime() + mAdj * 60000);
    end = roundToNearestFive(end);
    populateEndsOptions(end);
    recSyncing = false;
    if (typeof updateRecHelper === 'function') updateRecHelper();
    if (typeof updateDivisibleHint === 'function') updateDivisibleHint();
    if (typeof updateSplitHint === 'function') updateSplitHint();
    updateLastBuzzerHint();
  };
  const setMinutesFromEnds = () => {
    if (!recMinutesField || !recEndsField) return;
    if (recSyncing) return;
    // Snap to nearest 5-minute boundary
    let v = recEndsField.value || '';
    const parts = v.split(':');
    if (parts.length < 2) return;
    const hh = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return;
    const now = new Date();
    const end0 = new Date(now);
    end0.setHours(hh, mm, 0, 0);
    const end = roundToNearestFive(end0);
    const snapped = endsOptionValue(end);
    if (snapped !== v) {
      recSyncing = true;
      const exists = Array.from(recEndsField.options).some(o => o.value === snapped);
      if (!exists) recEndsField.insertAdjacentHTML('afterbegin', `<option value="${snapped}">${endsOptionLabel12(end)}</option>`);
      recEndsField.value = snapped;
      recSyncing = false;
    }
    if (end.getTime() <= now.getTime()) end.setDate(end.getDate() + 1);
    const minutesRaw = Math.max(1, Math.floor((end.getTime() - now.getTime()) / 60000));
    lastRawMinutes = minutesRaw;
    const minutesAdj = minutesRaw;
    recSyncing = true;
    recMinutesField.value = String(minutesAdj);
    recSyncing = false;
    if (typeof updateRecHelper === 'function') updateRecHelper();
    if (typeof updateDivisibleHint === 'function') updateDivisibleHint();
    if (typeof updateSplitHint === 'function') updateSplitHint();
    updateLastBuzzerHint();
  };
  if (recMinutesField) recMinutesField.addEventListener('input', () => { setEndsFromMinutes(); updateRecHelper(); updateDivisibleHint(); updateSplitHint(); });
  if (recEndsField) recEndsField.addEventListener('change', () => { setMinutesFromEnds(); updateRecHelper(); updateDivisibleHint(); updateSplitHint(); updateLastBuzzerHint(); });
  // Initialize defaults: end time ~90 minutes from now (rounded to 5), derive minutes from it
  (function initRecDefaultsOnLoad(){
    const now = new Date();
    const target = roundToNearestFive(new Date(now.getTime() + 90*60000));
    populateEndsOptions(target);
    setMinutesFromEnds();
    updateDivisibleHint();
    updateSplitHint();
    updateLastBuzzerHint();
  })();
  // On change, accept minutes as entered; just update end and helpers
  if (recMinutesField) recMinutesField.addEventListener('change', () => { setEndsFromMinutes(); if (typeof updateRecHelper==='function') updateRecHelper(); updateDivisibleHint(); updateSplitHint(); });

  // Shift controls: select + toggle
  const setShiftTotal = (total) => {
    if (!shiftSelectEl) return;
    if (total > 0) {
      // pick closest option value
      let best = parseInt(shiftSelectEl.options[0].value, 10);
      let bestD = Math.abs(total - best);
      for (const opt of shiftSelectEl.options) {
        const val = parseInt(opt.value, 10);
        const d = Math.abs(total - val);
        if (d < bestD) { best = val; bestD = d; }
      }
      shiftSelectEl.value = String(best);
      lastShiftNonZero = best;
      shiftEnabled = true;
    } else {
      shiftEnabled = false;
    }
  };
  const updateShiftDisabledUI = () => {
    if (shiftSelectEl) shiftSelectEl.disabled = !shiftEnabled;
    if (shiftToggleBtn) shiftToggleBtn.textContent = shiftEnabled ? 'Disable' : 'Enable';
  };
  if (shiftSelectEl) shiftSelectEl.addEventListener('change', () => {
    lastShiftNonZero = parseInt(shiftSelectEl.value || '0', 10) || lastShiftNonZero;
    onShiftChanged();
  });
  if (shiftToggleBtn) shiftToggleBtn.addEventListener('click', () => {
    shiftEnabled = !shiftEnabled;
    if (shiftEnabled && lastShiftNonZero > 0) setShiftTotal(lastShiftNonZero);
    updateShiftDisabledUI();
    onShiftChanged();
  });
  const onShiftChanged = () => {
    const shift = getShiftTotal();
    if (!recMinutesField || !recEndsField) return;
    // Do not change end time. Recompute minutes from current end, then adjust by shift.
    const v = (recEndsField.value || '').trim();
    const parts = v.split(':');
    if (parts.length >= 2) {
      const hh = parseInt(parts[0], 10); const mm = parseInt(parts[1], 10);
      if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
        const now = new Date(); const end = new Date(now);
        end.setHours(hh, mm, 0, 0); if (end.getTime() <= now.getTime()) end.setDate(end.getDate() + 1);
        let minutesRaw = Math.max(1, Math.floor((end.getTime() - now.getTime()) / 60000));
        lastRawMinutes = minutesRaw;
        // Keep game length as raw minutes; show suggestion via hint instead of auto-adjusting
        recMinutesField.value = String(minutesRaw);
      }
    }
    updateRecHelper();
    updateDivisibleHint();
    updateSplitHint();
    updateLastBuzzerHint();
    updateShiftDisabledUI();
  };
  // Initial helper render
  updateRecHelper();
  updateShiftDisabledUI();

  // New game (rec)
  $('#new-rec-game').addEventListener('click', () => {
    const errorBox = $('#rec .error');
    if (errorBox) errorBox.textContent = '';
    $$('#rec .form-group').forEach(g => g.classList.remove('has-error'));
    // Always recompute minutes from end time if provided to avoid drift
    const endsField = recEndsField;
    let minutes = 0;
    const v = (endsField && endsField.value) || '';
    const parts = v.split(':');
    if (parts.length >= 2) {
      const hh = parseInt(parts[0], 10);
      const mm = parseInt(parts[1], 10);
      if (Number.isNaN(hh) || Number.isNaN(mm)) { if (endsField) endsField.closest('.form-group').classList.add('has-error'); if (errorBox) errorBox.textContent = 'Please enter a valid end time (HH:MM).'; return; }
      const now = new Date();
      const end = new Date(now);
      end.setHours(hh, mm, 0, 0);
      if (end.getTime() <= now.getTime()) end.setDate(end.getDate() + 1);
      minutes = Math.max(1, Math.round((end.getTime() - now.getTime()) / 60000));
      if (recMinutesField) recMinutesField.value = String(minutes);
    } else {
      minutes = parseInt((recMinutesField && recMinutesField.value) || '0', 10);
      if (!minutes) { if (recMinutesField) recMinutesField.closest('.form-group').classList.add('has-error'); if (errorBox) errorBox.textContent = 'Please enter game length in minutes.'; return; }
    }
    const shift = getShiftTotal();
    // Round down to nearest value divisible by shift length (do not block)
    let minutesForGame = minutes;
    if (shift > 0) {
      const stepOnly = minutesStepForShiftOnly(shift);
      minutesForGame = Math.floor(minutes / stepOnly) * stepOnly;
      minutesForGame = Math.max(1, minutesForGame);
    }
    // Split long rec games into multiple periods to keep per-period clock <= 99 minutes
    const periods = [0];
    const stepMin = minutesStepForShift(shift); // minutes granularity compatible with shift and 15-min rule
    const maxChunk = Math.max(stepMin, Math.floor(99 / stepMin) * stepMin) || 99; // safeguard
    let remaining = minutesForGame;
    while (remaining > 0) {
      const chunk = Math.min(remaining, maxChunk);
      periods.push(chunk);
      remaining -= chunk;
    }
    Server.createGame({ buzzerIntervalSeconds: shift, periodLengths: periods });
    Modals.hide($('#new-game-dialog'));
  });

  // Clean errors when opening dialogs
  on(document, 'click', 'a[href="#new-game-dialog"][data-toggle="modal"]', () => {
    $$('#new-game-dialog .modal-body .form-group').forEach(g => g.classList.remove('has-error'));
    // Reset Rec defaults each time the dialog opens: choose ~90 minutes from now (rounded to 5)
    const now = new Date();
    const target = roundToNearestFive(new Date(now.getTime() + 90*60000));
    populateEndsOptions(target);
    setMinutesFromEnds();
    updateRecHelper();
    updateDivisibleHint();
    updateSplitHint();
    updateLastBuzzerHint();
  });

  // Penalty dialog open
  on(document, 'click', 'a[href="#add-penalty"][data-toggle="modal"]', (e, t) => {
    const team = t.dataset.team || 'home';
    const dlg = $('#add-penalty');
    dlg.dataset.team = team;
    dlg.querySelector('.modal-title').textContent = `${team} Penalty`;
    const { minutes, seconds } = millisToMinSec(State.time);
    $('#add-penalty-off_ice').value = formatClock(minutes, seconds);
    // Default penalty duration to 2 minutes on open
    $('#add-penalty-time').value = '2:00';
    $('#add-penalty-serving').value = '';
    $('#add-penalty-player').value = '';
    $$('#add-penalty .modal-body .form-group').forEach(g => g.classList.remove('has-error'));
  });

  // Add penalty submit
  $('#add-penalty-add').addEventListener('click', () => {
    const dlg = $('#add-penalty');
    const team = dlg.dataset.team;
    const playerField = $('#add-penalty-player');
    const servingField = $('#add-penalty-serving');
    const timeField = $('#add-penalty-time');
    const offField = $('#add-penalty-off_ice');
    $$('#add-penalty .modal-body .form-group').forEach(g => g.classList.remove('has-error'));

    let error = false;
    const penalty = { servingPlayerNumber: servingField.value };
    penalty.playerNumber = playerField.value.trim();
    if (!penalty.playerNumber) { playerField.closest('.form-group').classList.add('has-error'); error = true; }
    penalty.time = parseClockMillis(timeField.value.trim());
    if (!penalty.time) { timeField.closest('.form-group').classList.add('has-error'); error = true; }
    penalty.offIceTime = parseClockMillis(offField.value.trim());
    if (!penalty.offIceTime) { offField.closest('.form-group').classList.add('has-error'); error = true; }
    if (error) return;
    penalty.period = State.period;
    api.post(`${team}/penalty`, penalty).catch(()=>{});
    Modals.hide(dlg);
  });

  // Add 2+10 (minor + misconduct) helper
  const add2plus10 = () => {
    const dlg = $('#add-penalty');
    const team = dlg.dataset.team;
    const playerField = $('#add-penalty-player');
    const servingField = $('#add-penalty-serving');
    const offField = $('#add-penalty-off_ice');
    $$('#add-penalty .modal-body .form-group').forEach(g => g.classList.remove('has-error'));

    let error = false;
    const player = playerField.value.trim();
    if (!player) { playerField.closest('.form-group').classList.add('has-error'); error = true; }
    const serving = servingField.value.trim();
    if (!serving) { servingField.closest('.form-group').classList.add('has-error'); error = true; }
    const off = parseClockMillis(offField.value.trim());
    if (!off) { offField.closest('.form-group').classList.add('has-error'); error = true; }
    if (error) return;

    const base = { period: State.period, playerNumber: player };
    // 2-minute minor: served by the serving player
    const p2 = Object.assign({}, base, { servingPlayerNumber: serving, time: 2 * 60 * 1000, offIceTime: off });
    // 10-minute misconduct: served by the original offender
    // Start immediately to run concurrently with the 2
    const p10 = Object.assign({}, base, { servingPlayerNumber: player, time: 10 * 60 * 1000, offIceTime: off, startTime: roundToSecond(State.time) });
    api.post(`${team}/penalty`, p2).catch(()=>{});
    api.post(`${team}/penalty`, p10).catch(()=>{});
    Modals.hide(dlg);
  };
  const btn2plus10 = document.getElementById('add-penalty-2plus10');
  if (btn2plus10) btn2plus10.addEventListener('click', (e) => { e.preventDefault(); add2plus10(); });

  // Generic set-value anchors
  on(document, 'click', 'a[data-action="set-value"]', (e, t) => {
    e.preventDefault();
    const targetSel = t.dataset.target; const val = t.dataset.value || '';
    const input = $(targetSel);
    if (input) input.value = String(val);
  });
  // Set all period lengths (1-3) to a value
  on(document, 'click', 'a[data-action="set-periods"]', (e, t) => {
    e.preventDefault();
    const val = t.dataset.value || '';
    ['#period-1', '#period-2', '#period-3'].forEach(sel => {
      const input = $(sel);
      if (input) input.value = String(val);
    });
  });

  // Tabs for new game dialog
  const gameTab = $('#game-tab');
  if (gameTab) {
    on(gameTab, 'click', 'a[role="tab"]', (e, a) => {
      e.preventDefault();
      // nav active
      $$('#game-tab li').forEach(li => li.classList.remove('active'));
      a.parentElement.classList.add('active');
      // pane active
      const target = a.getAttribute('href');
      $$('#new-game-dialog .tab-content .tab-pane').forEach(p => p.classList.remove('active'));
      $(target).classList.add('active');
    });
  }
  // Expose helper functions for client-side tests
  try { window.__test = { minutesStepForShift, normalizeMinutes }; } catch (_) {}
};

// ---------- Socket events ----------
const output = (html) => {
  const consoleBox = $('#console');
  if (!consoleBox) return;
  // prune old messages (keep ~10 seconds worth visually)
  while (consoleBox.children.length > 20) consoleBox.removeChild(consoleBox.lastChild);
  const el = document.createElement('div');
  el.innerHTML = html;
  consoleBox.prepend(el);
};

const initSocket = () => {
  const status = document.getElementById('conn-status');
  const overlay = document.getElementById('conn-overlay');
  const overlayText = document.getElementById('conn-overlay-text');
  const setStatus = (state, text) => {
    if (!status) return;
    status.dataset.state = state;
    status.textContent = text;
  };
  const setOverlay = (state, text) => {
    if (!overlay) return;
    overlay.dataset.state = state;
    overlay.style.display = state === 'ok' ? 'none' : 'flex';
    if (overlayText) overlayText.textContent = text || '';
  };
  transport.onStatus({
    connect: async () => {
      setStatus('ok', 'Connected');
      setOverlay('ok', '');
      output('<span class="connect-msg">Connected</span>');
      try {
        const data = await api.get('portNames');
        State.portNames = data.portNames || [];
        State.currentPort = data.currentPort || '';
        // Refresh power label with port if already on
        if (State.scoreboardOn) setPowerUI('on'); else setPowerUI('off');
      } catch {}
    },
    disconnect: () => {
      setStatus('down', 'Disconnected');
      setOverlay('down', 'Reconnecting...');
      output('<span class="disconnect-msg">Disconnected! Make sure the app is running!</span>');
    },
    reconnecting: () => {
      setStatus('reconnecting', 'Reconnecting...');
      setOverlay('reconnecting', 'Reconnecting...');
    },
    error: () => {
      setStatus('down', 'Connect error');
      setOverlay('down', 'Reconnecting...');
    }
  });
  socket.on('message', (data) => output(`<pre>Message ${JSON.stringify(data)}</pre>`));
  socket.on('power', (data) => {
    output(`<span class="disconnect-msg">The Scoreboard has been turned ${data.scoreboardOn ? 'ON' : 'OFF'}</span>`);
    if (typeof updatePowerFromServer === 'function') updatePowerFromServer(!!data.scoreboardOn);
  });
  socket.on('update', (data) => renderUpdate(data));
};

// ---------- Boot ----------
document.addEventListener('DOMContentLoaded', () => {
  Modals.init();
  initEvents();
  initSocket();
});
