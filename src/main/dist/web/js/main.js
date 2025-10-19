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
  home: { score: 0, shots: 0, penalties: [], goals: [] },
  away: { score: 0, shots: 0, penalties: [], goals: [] },
  scoreboardOn: false,
  buzzerOn: false,
  portNames: [],
  currentPort: '',
};

// ---------- Team layout (Home/Away ordering) ----------
const TeamLayout = (() => {
  const STORAGE_KEY = 'scoreboard.layout.leftTeam';
  let sides = { left: 'home', right: 'away' };
  let button = null;

  const readStoredLeft = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'away' ? 'away' : 'home';
    } catch (_) {
      return 'home';
    }
  };

  const persistLeft = () => {
    try {
      localStorage.setItem(STORAGE_KEY, sides.left);
    } catch (_) {
      /* ignore persistence issues */
    }
  };

  const applyDomOrder = () => {
    const row = document.querySelector('.container > .row');
    const home = document.getElementById('home');
    const away = document.getElementById('away');
    const clock = document.getElementById('clock_box');
    if (!row || !home || !away || !clock) return;
    const leftEl = sides.left === 'home' ? home : away;
    const rightEl = sides.left === 'home' ? away : home;
    [leftEl, clock, rightEl].forEach((el) => {
      if (el && el.parentElement === row) row.appendChild(el);
    });
  };

  const updateBodyDataset = () => {
    if (!document || !document.body) return;
    document.body.dataset.homeSide = sides.left === 'home' ? 'left' : 'right';
    document.body.dataset.leftTeam = sides.left;
    document.body.dataset.rightTeam = sides.right;
  };

  const updateButtonState = () => {
    if (!button) button = document.getElementById('swap-teams-btn');
    if (!button) return;
    const homeSide = sides.left === 'home' ? 'left' : 'right';
    const statusLabel = homeSide === 'left' ? 'Home currently on left. Swap sides.' : 'Home currently on right. Swap sides.';
    button.setAttribute('aria-pressed', homeSide === 'right' ? 'true' : 'false');
    button.setAttribute('aria-label', statusLabel);
    button.setAttribute('title', statusLabel);
  };

  const apply = (leftTeam) => {
    const nextLeft = leftTeam === 'away' ? 'away' : 'home';
    if (sides.left !== nextLeft) {
      sides = { left: nextLeft, right: nextLeft === 'home' ? 'away' : 'home' };
      applyDomOrder();
      persistLeft();
      updateBodyDataset();
      updateButtonState();
      document.dispatchEvent(new CustomEvent('scoreboard:layout-changed', { detail: { ...sides } }));
      return;
    }
    // Even if unchanged, ensure DOM/order/button reflect stored state
    applyDomOrder();
    updateBodyDataset();
    updateButtonState();
  };

  const toggle = () => {
    const nextLeft = sides.right;
    apply(nextLeft);
  };

  const init = () => {
    button = document.getElementById('swap-teams-btn');
    if (button) {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        toggle();
        button.blur();
      });
    }
    apply(readStoredLeft());
  };

  const getTeamForSide = (side) => {
    if (side === 'left' || side === 'right') return sides[side];
    return 'home';
  };

  const getSides = () => ({ ...sides });

  return { init, toggle, getTeamForSide, getSides };
})();

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
  const isVisible = (modal) => modal && window.getComputedStyle(modal).display !== 'none';
  const anyVisible = () => Array.from(document.querySelectorAll('.modal')).some(isVisible);
  const show = (modal) => {
    if (!modal) return;
    const active = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    if (active) modal.__trigger = active;
    if (modal.__trigger && typeof modal.__trigger.blur === 'function') {
      try { modal.__trigger.blur(); } catch (_) {}
    }
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('in');
    document.body.classList.add('modal-open');
  };
  const hide = (modal) => {
    if (!modal) return;
    modal.classList.remove('in');
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
    if (!anyVisible()) document.body.classList.remove('modal-open');
    const trigger = modal.__trigger;
    modal.__trigger = null;
    restoreHover(trigger);
    if (trigger && typeof trigger.focus === 'function') {
      setTimeout(() => {
        try { trigger.focus(); } catch (_) {}
      }, 0);
    }
  };
  const showById = (id) => show($(id.startsWith('#') ? id : `#${id}`));
  const init = () => {
    // open via [data-toggle="modal"][href="#id"]
    on(document, 'click', '[data-toggle="modal"]', (e, t) => {
      e.preventDefault();
      const href = t.getAttribute('href');
      if (href) showById(href);
      if ((e.detail || 0) !== 0) {
        requestAnimationFrame(() => {
          if (document.activeElement === t) {
            try { t.blur(); } catch (_) {}
          }
        });
      }
      // store trigger for later access
      const m = $(href);
      if (m) {
        m.__trigger = t;
        suppressHover(t);
      }
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
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' && e.key !== 'Esc') return;
      const open = Array.from(document.querySelectorAll('.modal.in, .modal[aria-hidden="false"]'))
        .filter(isVisible);
      if (!open.length) return;
      e.preventDefault();
      hide(open[open.length - 1]);
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

const formatGoals = (goals) => {
  if (!Array.isArray(goals) || goals.length === 0) {
    return '<tr class="placeholder"><td colspan="4">No goals yet</td></tr>';
  }
  return goals.map((g) => {
    const safeTime = typeof g.time === 'number' ? Math.max(0, g.time) : 0;
    const tm = millisToMinSec(safeTime);
    const timeText = formatClock(tm.minutes, tm.seconds);
    const period = (g.period === 0 || g.period) ? g.period : '-';
    const scorer = (g.playerNumber === 0 || g.playerNumber) ? g.playerNumber : '-';
    const primary = (g.primaryAssistNumber === 0 || g.primaryAssistNumber)
      ? g.primaryAssistNumber
      : ((g.assistNumber && g.assistNumber > 0) ? g.assistNumber : null);
    const secondary = (g.secondaryAssistNumber === 0 || g.secondaryAssistNumber)
      ? g.secondaryAssistNumber
      : null;
    const assists = [];
    if (primary !== null && primary !== undefined) assists.push(primary);
    if (secondary !== null && secondary !== undefined) assists.push(secondary);
    const assistsText = assists.length ? assists.map(String).join(' / ') : '&ndash;';
    const idAttr = (g.id === 0 || g.id) ? ` data-goal-id="${String(g.id)}"` : '';
    return `<tr${idAttr}>
      <td>${period}</td>
      <td>${timeText}</td>
      <td>${scorer}</td>
      <td>${assistsText}</td>
    </tr>`;
  }).join('');
};

const renderGoalTable = (teamElem, goals) => {
  if (!teamElem) return;
  const listTBody = teamElem.querySelector('tbody.goal-list');
  if (!listTBody) return;
  listTBody.innerHTML = formatGoals(goals || []);
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
  renderGoalTable(home, data.home.goals);
  renderGoalTable(away, data.away.goals);

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
let openGoalModal = () => {};

const initEvents = () => {
  // Team color chips + modal palettes
  // Presets: rainbow + black and white
  // red, orange, yellow, green, blue, indigo, violet, plus black and white
  const DEFAULT_COLORS = ['#000000','#ffffff','#e74c3c','#f39c12','#f1c40f','#2ecc71','#3498db','#3f51b5','#9b59b6'];
  const LS_HOME = 'scoreboard.homeColor';
  const LS_AWAY = 'scoreboard.awayColor';
  const colorKeyForVar = (cssVarName) => cssVarName === '--home-color' ? LS_HOME : LS_AWAY;
  const sanitizeHex = (val) => (typeof val === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val.trim())) ? val.trim() : '';
  const getCssVar = (name, fallback) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (v && v.trim()) || fallback || '';
  };
  const relLuminance = (hex) => {
    const h = hex.replace('#','');
    const v = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
    const r = parseInt(v.slice(0,2),16)/255, g = parseInt(v.slice(2,4),16)/255, b = parseInt(v.slice(4,6),16)/255;
    const toLin = (c) => (c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4));
    const R = toLin(r), G = toLin(g), B = toLin(b);
    return 0.2126*R + 0.7152*G + 0.0722*B;
  };
  const applyColor = (cssVarName, color) => {
    const c = sanitizeHex(color);
    if (!c) return;
    document.documentElement.style.setProperty(cssVarName, c);
    // set contrasting foreground var
    const fg = relLuminance(c) < 0.5 ? '#ffffff' : '#101218';
    const fgVar = cssVarName === '--home-color' ? '--home-fg' : '--away-fg';
    document.documentElement.style.setProperty(fgVar, fg);
    // persist
    try { localStorage.setItem(colorKeyForVar(cssVarName), c); } catch (_) {}
    // refresh chips
    updateColorChips();
  };
  const updateColorChips = () => {
    const hc = document.getElementById('home-color-chip');
    const ac = document.getElementById('away-color-chip');
    const hCol = getCssVar('--home-color', '#2e86de');
    const aCol = getCssVar('--away-color', '#e74c3c');
    if (hc) { hc.style.background = hCol; hc.style.backgroundColor = hCol; hc.title = `Home ${hCol}`; }
    if (ac) { ac.style.background = aCol; ac.style.backgroundColor = aCol; ac.title = `Away ${aCol}`; }
  };
  const loadStoredTeamColors = () => {
    try {
      const h = sanitizeHex(localStorage.getItem(LS_HOME));
      const a = sanitizeHex(localStorage.getItem(LS_AWAY));
      if (h) applyColor('--home-color', h); else applyColor('--home-color', getCssVar('--home-color', '#2e86de'));
      if (a) applyColor('--away-color', a); else applyColor('--away-color', getCssVar('--away-color', '#e74c3c'));
    } catch (_) {}
  };

  const renderPalette = (containerId, cssVarName, inputId) => {
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
         applyColor(cssVarName, color);
         // update selection state
         [...el.querySelectorAll('.color-swatch')].forEach(n => n.classList.remove('selected'));
         sw.classList.add('selected');
        // sync input
        if (inputId) {
          const input = document.getElementById(inputId); if (input) input.value = color;
        }
       });
       el.appendChild(sw);
     });
   };
  // Open Team Colors modal and render palettes (support anchors or buttons)
  on(document, 'click', '[data-toggle="modal"][href="#team-colors"]', (e, t) => {
    // Initialize inputs from current CSS vars
    const hc = document.getElementById('home-color-input');
    const ac = document.getElementById('away-color-input');
    if (hc) hc.value = getCssVar('--home-color', sanitizeHex(localStorage.getItem(LS_HOME)) || '#2e86de');
    if (ac) ac.value = getCssVar('--away-color', sanitizeHex(localStorage.getItem(LS_AWAY)) || '#e74c3c');
    // Render swatches
    renderPalette('home-color-palette', '--home-color', 'home-color-input');
    renderPalette('away-color-palette', '--away-color', 'away-color-input');
    // Focus the relevant input if chip used
    const team = t && t.id && t.id.indexOf('home') >= 0 ? 'home' : (t && t.id && t.id.indexOf('away') >= 0 ? 'away' : '');
    setTimeout(() => {
      if (team === 'home' && hc) hc.focus();
      if (team === 'away' && ac) ac.focus();
    }, 0);
  });

  // Bind native color inputs to CSS vars and chips
  const bindColorInput = (inputId, cssVarName, paletteId) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('input', () => {
      const val = input.value;
      if (val) applyColor(cssVarName, val);
      // clear selection highlight when picking custom
      const pal = document.getElementById(paletteId);
      if (pal) [...pal.querySelectorAll('.color-swatch')].forEach(n => n.classList.remove('selected'));
    });
  };
  bindColorInput('home-color-input', '--home-color', 'home-color-palette');
  bindColorInput('away-color-input', '--away-color', 'away-color-palette');
  // Load stored colors then paint chips
  loadStoredTeamColors();
  updateColorChips();

  const simulatePointerLeave = (el) => {
    if (!el || typeof el.dispatchEvent !== 'function') return;
    const doc = el.ownerDocument || document;
    const related = doc.body || null;
    ['pointerout', 'pointerleave', 'mouseout', 'mouseleave'].forEach((type) => {
      try {
        const evt = new MouseEvent(type, { bubbles: true, cancelable: true, relatedTarget: related });
        el.dispatchEvent(evt);
      } catch (_) {
        try {
          const evt = doc.createEvent('MouseEvent');
          evt.initMouseEvent(type, true, true, doc.defaultView, 0, 0, 0, 0, 0,
            false, false, false, false, 0, related);
          el.dispatchEvent(evt);
        } catch (_) {}
      }
    });
  };

  const suppressHover = (el) => {
    if (!el || !el.style || el.__hoverSuppressed) return;
    el.__hoverSuppressed = { pointerEvents: el.style.pointerEvents };
    el.style.pointerEvents = 'none';
  };
  const restoreHover = (el) => {
    if (!el || !el.style || !el.__hoverSuppressed) return;
    const prev = el.__hoverSuppressed.pointerEvents;
    if (prev === undefined || prev === null || prev === '') {
      el.style.removeProperty('pointer-events');
    } else {
      el.style.pointerEvents = prev;
    }
    delete el.__hoverSuppressed;
  };
  const scheduleBlur = (el) => {
    if (!el) return;
    simulatePointerLeave(el);
    requestAnimationFrame(() => {
      try { el.blur(); } catch (_) {}
    });
  };

  let pressedButton = null;
  const rememberPressedButton = (e) => {
    const btn = e.target && e.target.closest('.btn');
    if (btn) pressedButton = btn;
  };
  const releasePressedButton = () => {
    if (!pressedButton) return;
    const btn = pressedButton;
    pressedButton = null;
    scheduleBlur(btn);
  };
  if ('onpointerdown' in window) {
    document.addEventListener('pointerdown', rememberPressedButton, true);
    document.addEventListener('pointerup', releasePressedButton, true);
    document.addEventListener('pointercancel', releasePressedButton, true);
  } else {
    document.addEventListener('mousedown', rememberPressedButton, true);
    document.addEventListener('mouseup', releasePressedButton, true);
    document.addEventListener('touchstart', rememberPressedButton, true);
    document.addEventListener('touchend', releasePressedButton, true);
    document.addEventListener('touchcancel', releasePressedButton, true);
  }

  // Navbar buttons
  $('#buzzer').addEventListener('click', () => Server.buzzer());
  $('#clock-start').addEventListener('click', () => Server.startClock());
  $('#clock-pause').addEventListener('click', () => Server.pauseClock());

  // Period controls
  $('.period-up').addEventListener('click', () => Server.setPeriod(State.period + 1));
  $('.period-down').addEventListener('click', () => Server.setPeriod(Math.max(0, State.period - 1)));

  const goalModal = document.getElementById('add-goal');
  const clearGoalErrors = () => {
    if (!goalModal) return;
    goalModal.querySelectorAll('.form-group').forEach((group) => group.classList.remove('has-error'));
  };
  const setGoalModalTeam = (team) => {
    if (!goalModal) return;
    goalModal.dataset.team = team || '';
    const title = goalModal.querySelector('.modal-title');
    if (title) title.textContent = team === 'away' ? 'Add Away Goal' : 'Add Home Goal';
    const header = goalModal.querySelector('.goal-modal-header');
    if (header) {
      header.classList.remove('home', 'away');
      header.classList.add(team === 'away' ? 'away' : 'home');
    }
  };
  openGoalModal = (team) => {
    if (!goalModal) return;
    clearGoalErrors();
    setGoalModalTeam(team);
    const periodField = document.getElementById('add-goal-period');
    const timeField = document.getElementById('add-goal-time');
    const playerField = document.getElementById('add-goal-player');
    const assist1Field = document.getElementById('add-goal-assist1');
    const assist2Field = document.getElementById('add-goal-assist2');
    if (periodField) periodField.value = String(State.period || 0);
    if (timeField) {
      const { minutes, seconds } = millisToMinSec(State.time);
      timeField.value = formatClock(minutes, seconds);
    }
    if (playerField) playerField.value = '';
    if (assist1Field) assist1Field.value = '';
    if (assist2Field) assist2Field.value = '';
    Modals.show(goalModal);
    setTimeout(() => {
      if (playerField) playerField.focus();
    }, 0);
  };
  const submitGoal = async () => {
    if (!goalModal) return;
    const team = goalModal.dataset.team;
    if (!team) return;
    const periodField = document.getElementById('add-goal-period');
    const timeField = document.getElementById('add-goal-time');
    const playerField = document.getElementById('add-goal-player');
    const assist1Field = document.getElementById('add-goal-assist1');
    const assist2Field = document.getElementById('add-goal-assist2');
    clearGoalErrors();

    let hasError = false;

    const markError = (field) => {
      if (field && field.closest) {
        const group = field.closest('.form-group');
        if (group) group.classList.add('has-error');
      }
    };

    let period = State.period;
    if (periodField) {
      const periodRaw = periodField.value.trim();
      const parsedPeriod = parseInt(periodRaw, 10);
      if (!Number.isNaN(parsedPeriod)) {
        period = parsedPeriod;
      } else if (periodRaw) {
        markError(periodField);
        hasError = true;
      }
    }

    let playerNumber = 0;
    if (playerField) {
      const playerRaw = playerField.value.trim();
      playerNumber = parseInt(playerRaw, 10);
      if (playerRaw === '' || Number.isNaN(playerNumber)) {
        markError(playerField);
        hasError = true;
      }
    }

    let timeMillis = State.time;
    if (timeField) {
      const timeRaw = timeField.value.trim();
      const parsedTime = parseClockMillis(timeRaw);
      if (parsedTime == null) {
        markError(timeField);
        hasError = true;
      } else {
        timeMillis = parsedTime;
      }
    }

    const payload = {
      period,
      playerNumber,
      time: timeMillis
    };

    if (assist1Field) {
      const a1Raw = assist1Field.value.trim();
      if (a1Raw) {
        const a1 = parseInt(a1Raw, 10);
        if (Number.isNaN(a1)) {
          markError(assist1Field);
          hasError = true;
        } else {
          payload.primaryAssistNumber = a1;
        }
      }
    }

    if (assist2Field) {
      const a2Raw = assist2Field.value.trim();
      if (a2Raw) {
        const a2 = parseInt(a2Raw, 10);
        if (Number.isNaN(a2)) {
          markError(assist2Field);
          hasError = true;
        } else {
          payload.secondaryAssistNumber = a2;
        }
      }
    }

    if (hasError) return;

    try {
      await api.post(`${team}/goal`, payload);
      Modals.hide(goalModal);
    } catch (err) {
      console.warn('Failed to add goal', err);
    }
  };
  if (goalModal) {
    const form = goalModal.querySelector('form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        submitGoal();
      });
    }
    const submitBtn = document.getElementById('add-goal-submit');
    if (submitBtn) {
      submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        submitGoal();
      });
    }
  }

  // Score buttons
  $$('.score-up').forEach(btn => btn.addEventListener('click', (e) => {
    e.preventDefault();
    const team = e.currentTarget.dataset.team;
    if (!team) return;
    openGoalModal(team);
    if ((e.detail || 0) !== 0) scheduleBlur(e.currentTarget);
  }));
  $$('.score-down').forEach(btn => btn.addEventListener('click', (e) => {
    e.preventDefault();
    const team = e.currentTarget.dataset.team;
    if (!team) return;
    api.del(`${team}/goal`).catch(() => {});
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
    if ((e.detail || 0) !== 0) scheduleBlur(t);
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
  const STANDARD_TEMPLATES = {
    jr: { warmupMinutes: 15, periodMinutes: [20, 20, 20], intermissionMinutes: 15 },
    youth60: { warmupMinutes: 5, periodMinutes: [15, 15, 12], intermissionMinutes: 1 },
    youth75: { warmupMinutes: 5, periodMinutes: [13, 13, 13], intermissionMinutes: 1 },
    pphl: { warmupMinutes: 3, periodMinutes: [17, 17, 17], intermissionMinutes: 1 },
  };
  const standardTemplateSelect = document.getElementById('standard-template');
  const standardPeriodFields = Array.from({ length: 4 }, (_, idx) => document.getElementById(`period-${idx}`));
  const standardIntermissionField = document.getElementById('intermission-minutes');
  let applyingStandardTemplate = false;

  const runWithTemplateApplying = (fn) => {
    const prev = applyingStandardTemplate;
    applyingStandardTemplate = true;
    try { fn(); } finally { applyingStandardTemplate = prev; }
  };

  const setStandardFieldValue = (field, value) => {
    if (!field) return;
    const str = (value === null || value === undefined) ? '' : String(value);
    if (field.value !== str) {
      field.value = str;
    } else {
      // ensure downstream listeners fire even if value is unchanged
      field.value = str;
    }
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const clearStandardErrors = () => {
    $$('#standard .form-group.has-error').forEach((group) => group.classList.remove('has-error'));
  };

  const selectStandardTemplate = (key, { persist = true } = {}) => {
    if (standardTemplateSelect) standardTemplateSelect.value = key || '';
    if (!persist) return;
    try {
      if (key) localStorage.setItem('scoreboard.standard.template', key);
      else localStorage.removeItem('scoreboard.standard.template');
    } catch (_) {}
  };

  const applyStandardTemplate = (key, { persist = true } = {}) => {
    const template = STANDARD_TEMPLATES[key];
    if (!template) {
      selectStandardTemplate('', { persist });
      return false;
    }
    runWithTemplateApplying(() => {
      if (standardPeriodFields[0] && typeof template.warmupMinutes === 'number') {
        setStandardFieldValue(standardPeriodFields[0], template.warmupMinutes);
      }
      const periodMinutes = Array.isArray(template.periodMinutes) ? template.periodMinutes : [];
      for (let i = 1; i < standardPeriodFields.length; i++) {
        const minutes = periodMinutes[i - 1];
        if (typeof minutes === 'number') setStandardFieldValue(standardPeriodFields[i], minutes);
      }
      if (standardIntermissionField) {
        if (typeof template.intermissionMinutes === 'number') {
          setStandardFieldValue(standardIntermissionField, template.intermissionMinutes);
        } else {
          setStandardFieldValue(standardIntermissionField, '');
        }
      }
    });
    clearStandardErrors();
    selectStandardTemplate(key, { persist });
    return true;
  };

  const loadStoredStandardValues = () => {
    let templateKey = '';
    try {
      templateKey = localStorage.getItem('scoreboard.standard.template') || '';
    } catch (_) {
      templateKey = '';
    }
    if (templateKey && applyStandardTemplate(templateKey, { persist: false })) {
      return;
    }
    selectStandardTemplate('', { persist: false });
    runWithTemplateApplying(() => {
      try {
        const raw = localStorage.getItem('scoreboard.standard.periods');
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            standardPeriodFields.forEach((field, idx) => {
              if (field && typeof arr[idx] === 'number') setStandardFieldValue(field, arr[idx]);
            });
          }
        }
        const im = localStorage.getItem('scoreboard.standard.intermission');
        if (im != null && standardIntermissionField) {
          const parsed = parseInt(im, 10);
          if (!Number.isNaN(parsed)) setStandardFieldValue(standardIntermissionField, parsed);
        }
      } catch (_) {}
    });
  };

  const markStandardCustomFromManualEdit = () => {
    if (applyingStandardTemplate) return;
    if (!standardTemplateSelect || standardTemplateSelect.value === '') return;
    selectStandardTemplate('', { persist: true });
  };

  if (standardTemplateSelect) {
    standardTemplateSelect.addEventListener('change', (e) => {
      const key = e.target.value || '';
      if (!key) {
        selectStandardTemplate('', { persist: true });
        loadStoredStandardValues();
        clearStandardErrors();
        return;
      }
      if (!applyStandardTemplate(key)) {
        selectStandardTemplate('', { persist: true });
      }
    });
  }

  standardPeriodFields.forEach((field) => {
    if (!field) return;
    field.addEventListener('input', markStandardCustomFromManualEdit);
  });
  if (standardIntermissionField) {
    standardIntermissionField.addEventListener('input', markStandardCustomFromManualEdit);
  }

  $('#new-game').addEventListener('click', () => {
    clearStandardErrors();
    const periods = [];
    let error = false;
    for (let i = 0; i <= 3; i++) {
      const field = standardPeriodFields[i];
      if (!field) continue;
      const val = field.value.trim();
      if (i === 0 && val === '0') { periods[i] = 0; continue; }
      const n = parseInt(val, 10);
      if (!n) { field.closest('.form-group').classList.add('has-error'); error = true; }
      else { periods[i] = n; }
    }
    let intermission = null;
    if (standardIntermissionField) {
      const raw = standardIntermissionField.value.trim();
      const n = parseInt(raw, 10);
      if (Number.isNaN(n) || n < 0) {
        standardIntermissionField.closest('.form-group').classList.add('has-error');
        error = true;
      } else {
        intermission = n;
      }
    }
    if (error) return;
    try {
      localStorage.setItem('scoreboard.standard.periods', JSON.stringify(periods));
      if (intermission != null) localStorage.setItem('scoreboard.standard.intermission', String(intermission));
      if (standardTemplateSelect) {
        const currentTpl = standardTemplateSelect.value || '';
        if (currentTpl) localStorage.setItem('scoreboard.standard.template', currentTpl);
        else localStorage.removeItem('scoreboard.standard.template');
      }
    } catch (_) {}
    const cfg = { periodLengths: periods };
    if (intermission != null) cfg.intermissionDurationMinutes = intermission;
    Server.createGame(cfg);
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
    // Persist last used rec settings (minutes and shift only)
    try {
      localStorage.setItem('scoreboard.rec.minutes', String(minutes));
      localStorage.setItem('scoreboard.rec.shiftEnabled', JSON.stringify(!!shiftEnabled));
      localStorage.setItem('scoreboard.rec.shiftSeconds', String(getShiftTotal() || lastShiftNonZero || 0));
    } catch(_) {}
    Server.createGame({ buzzerIntervalSeconds: shift, periodLengths: periods });
    Modals.hide($('#new-game-dialog'));
  });

  // Clean errors when opening dialogs
  on(document, 'click', '[data-toggle="modal"][href="#new-game-dialog"]', () => {
    $$('#new-game-dialog .modal-body .form-group').forEach(g => g.classList.remove('has-error'));
    clearStandardErrors();
    loadStoredStandardValues();

    // Rec: minutes and shift settings (do not restore endsAt; ends derives from minutes)
    (function loadRec(){
      let minutes = '';
      let shiftSecs = '';
      let shiftEn = null;
      try {
        minutes = localStorage.getItem('scoreboard.rec.minutes') || '';
        shiftSecs = localStorage.getItem('scoreboard.rec.shiftSeconds') || '';
        const se = localStorage.getItem('scoreboard.rec.shiftEnabled');
        if (se != null) shiftEn = JSON.parse(se);
      } catch(_) {}
      // Populate options around now, then set ends from minutes if present
      const now = new Date();
      const defaultTarget = roundToNearestFive(new Date(now.getTime() + 90*60000));
      populateEndsOptions(defaultTarget);
      if (minutes && recMinutesField) {
        recMinutesField.value = String(parseInt(minutes,10) || 0);
        setEndsFromMinutes(); // endsAt = now + minutes
      } else {
        setMinutesFromEnds(); // keep defaults
      }
      // Apply shift
      const secs = parseInt(shiftSecs || '0', 10) || 0;
      if (shiftEn === false) { shiftEnabled = false; }
      if (secs > 0) setShiftTotal(secs);
      updateShiftDisabledUI();
      updateRecHelper();
      updateDivisibleHint();
      updateSplitHint();
      updateLastBuzzerHint();
    })();
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
    if (input) {
      input.value = String(val);
      const id = input.getAttribute ? input.getAttribute('id') : '';
      if (id === 'intermission-minutes' || /^period-[0-3]$/.test(id || '')) {
        markStandardCustomFromManualEdit();
      }
    }
  });
  // Set all period lengths (1-3) to a value
  on(document, 'click', 'a[data-action="set-periods"]', (e, t) => {
    e.preventDefault();
    const val = t.dataset.value || '';
    ['#period-1', '#period-2', '#period-3'].forEach(sel => {
      const input = $(sel);
      if (input) input.value = String(val);
    });
    markStandardCustomFromManualEdit();
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
  // Keyboard shortcuts help dialog: populate with actual shortcuts when opened
  on(document, 'click', 'button[href="#keyboard-shortcuts-dialog"][data-toggle="modal"]', () => {
    // Get the current shortcuts and update the dialog
    const shortcuts = KeyboardShortcuts.getShortcuts();
    const pretty = (binding) => binding.replace(/\+/g, ' + ').replace('Control', 'Ctrl').replace('ArrowUp', '↑').replace('ArrowDown', '↓').replace('ArrowLeft', '←').replace('ArrowRight', '→');
    const formatShortcut = (sc) => {
      if (!sc) return '—';
      const bindings = Array.isArray(sc) ? sc : [sc];
      if (!bindings.length) return '—';
      return bindings.map(pretty).join(' / ');
    };
    Object.entries(shortcuts).forEach(([action, shortcut]) => {
      const el = document.getElementById(`shortcut-${action}`);
      if (el) el.textContent = formatShortcut(shortcut);
    });
  });

  // Expose helper functions for client-side tests
  try {
    window.__test = Object.assign(window.__test || {}, {
      minutesStepForShift,
      normalizeMinutes
    });
  } catch (_) {}
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

// ---------- Keyboard Shortcuts ----------
const KeyboardShortcuts = (() => {
  // Default shortcuts (fallback if file fails to load)
  const DEFAULT_SHORTCUTS = {
    buzzer: ['b'],
    clockToggle: ['Space'],
    clockStart: ['ArrowUp', 'w'],
    clockStop: ['ArrowDown', 's'],
    homeShotUp: ['q'],
    homeShotDown: ['Shift+q'],
    awayShotUp: ['e'],
    awayShotDown: ['Shift+e'],
    homeGoal: ['ArrowLeft', 'a'],
    awayGoal: ['ArrowRight', 'd'],
    homePenalty: ['p'],
    awayPenalty: ['Shift+p'],
    periodUp: ['Control+ArrowUp'],
    periodDown: ['Control+ArrowDown']
  };

  let shortcuts = { ...DEFAULT_SHORTCUTS };
  let shortcutBindings = []; // array of { action, shortcut, parsed }
  let loadPromise = Promise.resolve();
  let loadError = false;

  const normalizeKey = (key) => String(key).trim();
  const normalizeModifiers = (parts) => {
    const mods = parts.slice(0, -1).map(p => p.toLowerCase().trim());
    const key = parts[parts.length - 1].trim();
    return { shift: mods.includes('shift'), ctrl: mods.includes('control') || mods.includes('ctrl'), alt: mods.includes('alt'), key };
  };

  const canonicalKey = (rawKey) => {
    const key = String(rawKey).trim();
    if (!key) return '';
    const lower = key.toLowerCase();
    if (lower === 'space' || lower === 'spacebar') return ' ';
    if (key.length === 1) return lower;
    return lower;
  };

  const parseShortcut = (shortcut) => {
    const parts = normalizeKey(shortcut).split('+');
    if (parts.length === 1) return { shift: false, ctrl: false, alt: false, key: canonicalKey(parts[0]) };
    const mods = normalizeModifiers(parts);
    return { ...mods, key: canonicalKey(mods.key) };
  };

  const eventMatchesShortcut = (e, parsed) => {
    const eventKey = canonicalKey(e.key);
    return eventKey === parsed.key && e.shiftKey === parsed.shift && e.ctrlKey === parsed.ctrl && e.altKey === parsed.alt;
  };

  // Keyboard shortcuts always apply to the team in each column, regardless of which squad is home/away.
  const LEFT_COLUMN_ACTIONS = new Set(['homeShotUp', 'homeShotDown', 'homeGoal', 'homePenalty']);
  const RIGHT_COLUMN_ACTIONS = new Set(['awayShotUp', 'awayShotDown', 'awayGoal', 'awayPenalty']);
  const teamForShortcutAction = (action) => {
    if (LEFT_COLUMN_ACTIONS.has(action)) return TeamLayout.getTeamForSide('left');
    if (RIGHT_COLUMN_ACTIONS.has(action)) return TeamLayout.getTeamForSide('right');
    return null;
  };

  const loadShortcuts = async () => {
    loadError = false;
    try {
      const res = await fetch('/keyboard-shortcuts.json');
      if (!res.ok) throw new Error('Failed to load keyboard shortcuts');
      const data = await res.json();
      shortcuts = { ...DEFAULT_SHORTCUTS, ...data };
      console.log('Keyboard shortcuts loaded:', shortcuts);
    } catch (err) {
      console.warn('Failed to load keyboard-shortcuts.json, using defaults:', err);
      shortcuts = { ...DEFAULT_SHORTCUTS };
      loadError = true;
    }
    buildBindings();
  };

  const ensureArray = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };

  const buildBindings = () => {
    shortcutBindings = [];
    Object.entries(shortcuts).forEach(([action, bindingValue]) => {
      ensureArray(bindingValue).forEach((binding) => {
        if (!binding) return;
        try {
          const parsed = parseShortcut(binding);
          shortcutBindings.push({ action, shortcut: binding, parsed });
        } catch (err) {
          console.warn(`Invalid shortcut for ${action}: ${binding}`, err);
        }
      });
    });
  };

  const handleKeyPress = (e) => {
    // Ignore if typing in input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    // Ignore if modal is open (except for specific shortcuts)
    const modalOpen = document.body.classList.contains('modal-open');

    for (const { action, parsed } of shortcutBindings) {
      if (eventMatchesShortcut(e, parsed)) {
        e.preventDefault();
        handleAction(action, modalOpen);
        return;
      }
    }
  };

  const handleAction = (action, modalOpen) => {
    // Skip most actions if modal is open
    if (modalOpen && !['buzzer', 'clockToggle', 'clockStart', 'clockStop'].includes(action)) return;

    const team = teamForShortcutAction(action);
    switch (action) {
      case 'buzzer':
        Server.buzzer();
        break;
      case 'clockToggle':
        if (State.running) {
          State.running = false;
          Server.pauseClock();
        } else {
          State.running = true;
          Server.startClock();
        }
        break;
      case 'clockStart':
        if (!State.running) {
          State.running = true;
          Server.startClock();
        }
        break;
      case 'clockStop':
        if (State.running) {
          State.running = false;
          Server.pauseClock();
        }
        break;
      case 'homeShotUp':
      case 'awayShotUp':
        if (!team) return;
        Server.shot({ team });
        break;
      case 'homeShotDown':
      case 'awayShotDown':
        if (!team) return;
        Server.undoShot({ team });
        break;
      case 'homeGoal':
      case 'awayGoal':
        if (!team) return;
        openGoalModal(team);
        break;
      case 'homePenalty':
      case 'awayPenalty':
        if (!team) return;
        {
          const penaltyBtn = document.querySelector(`a[data-team="${team}"][href="#add-penalty"]`);
          if (penaltyBtn) penaltyBtn.click();
        }
        break;
      case 'periodUp':
        Server.setPeriod(State.period + 1);
        break;
      case 'periodDown':
        Server.setPeriod(Math.max(0, State.period - 1));
        break;
      default:
        console.warn('Unknown action:', action);
    }
  };

  const init = async () => {
    loadPromise = loadShortcuts();
    await loadPromise;
    document.addEventListener('keydown', handleKeyPress);
  };

  const cloneShortcuts = () => {
    const cloned = {};
    Object.entries(shortcuts).forEach(([action, value]) => {
      if (!value) return;
      cloned[action] = ensureArray(value).map((binding) => String(binding));
    });
    return cloned;
  };

  const getShortcuts = () => cloneShortcuts();
  const whenReady = () => loadPromise;
  const hadError = () => loadError;

  return { init, getShortcuts, whenReady, hadError };
})();

try {
  window.__test = Object.assign(window.__test || {}, {
    shortcuts: () => KeyboardShortcuts.getShortcuts(),
    shortcutsReady: () => KeyboardShortcuts.whenReady(),
    shortcutsLoadError: () => KeyboardShortcuts.hadError()
  });
} catch (_) {}

// ---------- Boot ----------
document.addEventListener('DOMContentLoaded', () => {
  Modals.init();
  TeamLayout.init();
  initEvents();
  initSocket();
  KeyboardShortcuts.init();
});
