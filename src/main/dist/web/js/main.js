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
  home: { score: 0, penalties: [] },
  away: { score: 0, penalties: [] },
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
    const off = millisToMinSec(p.offIceTime);
    const st = millisToMinSec(p.startTime);
    const rem = millisToMinSec(remaining);
    return `<tr>
      <td>${p.period}</td>
      <td>${p.playerNumber}</td>
      <td>${formatClock(Math.floor(p.time/60000), Math.floor((p.time/1000)%60))}</td>
      <td>${formatClock(off.minutes, off.seconds)}</td>
      <td>${formatClock(st.minutes, st.seconds)}</td>
      <td>${formatClock(rem.minutes, rem.seconds)}</td>
      <td><a href="#" data-action="delete-penalty" data-team="${team}" data-pid="${p.id}">x</a></td>
    </tr>`;
  }).join('');
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
  const homeTBody = home.querySelector('tbody.list');
  const awayTBody = away.querySelector('tbody.list');
  if (homeTBody) homeTBody.innerHTML = formatPenalties('home', data.home.penalties);
  if (awayTBody) awayTBody.innerHTML = formatPenalties('away', data.away.penalties);

  // clock digits
  const { minutes, seconds } = millisToMinSec(State.time);
  const md = digits2(minutes);
  const sd = digits2(seconds);
  clockBox.querySelector('.digit.minutes.tens').textContent = md[0];
  clockBox.querySelector('.digit.minutes.ones').textContent = md[1];
  clockBox.querySelector('.digit.seconds.tens').textContent = sd[0];
  clockBox.querySelector('.digit.seconds.ones').textContent = sd[1];

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

  // play/pause toggle
  $('#clock-pause').style.display = State.running ? '' : 'none';
  $('#clock-start').style.display = State.running ? 'none' : '';

  // scores
  const hd = digits2(data.home.score);
  home.querySelector('.score .digit.tens').textContent = hd[0];
  home.querySelector('.score .digit.ones').textContent = hd[1];
  const ad = digits2(data.away.score);
  away.querySelector('.score .digit.tens').textContent = ad[0];
  away.querySelector('.score .digit.ones').textContent = ad[1];

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
    await api.post('portName', { portName: name });
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

  // Delete penalty (delegated)
  on(document, 'click', 'a[data-action="delete-penalty"]', (e, t) => {
    e.preventDefault();
    const team = t.dataset.team; const pid = t.dataset.pid;
    api.del(`${team}/penalty/${pid}`).catch(()=>{});
  });

  // Power control button workflow (no device telemetry)
  const powerBtn = $('#power-btn');
  const powerStatus = $('#power-status');
  let powerState = 'off'; // off | connecting | assumed | on | error
  const setPowerUI = (state, text) => {
    powerState = state;
    switch (state) {
      case 'off':
        powerBtn.disabled = false;
        powerBtn.textContent = 'Turn On Scoreboard';
        powerStatus.className = 'label label-default';
        powerStatus.textContent = 'Off';
        break;
      case 'connecting':
        powerBtn.disabled = true;
        powerBtn.textContent = 'Connecting…';
        powerStatus.className = 'label label-info';
        powerStatus.textContent = text || 'Opening port…';
        break;
      case 'assumed':
        powerBtn.disabled = true;
        powerBtn.textContent = 'Connecting…';
        powerStatus.className = 'label label-warning';
        powerStatus.textContent = 'Assumed On — confirm';
        break;
      case 'on':
        powerBtn.disabled = false;
        powerBtn.textContent = 'Turn Off Scoreboard';
        powerStatus.className = 'label label-success';
        powerStatus.textContent = 'On';
        break;
      case 'error':
        powerBtn.disabled = false;
        powerBtn.textContent = 'Retry Turn On';
        powerStatus.className = 'label label-danger';
        powerStatus.textContent = text || 'Error';
        break;
    }
  };
  window.updatePowerFromServer = (on) => {
    // If server reports a boolean, reflect it unless we're mid-assumed confirmation
    if (powerState === 'connecting' || powerState === 'assumed') return;
    setPowerUI(on ? 'on' : 'off');
  };
  setPowerUI(State.scoreboardOn ? 'on' : 'off');

  powerBtn.addEventListener('click', async () => {
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

  // New game (rec)
  $('#new-rec-game').addEventListener('click', () => {
    const minutesField = $('#rec_minutes');
    const shiftField = $('#shift-buzzer');
    const minutes = parseInt(minutesField.value, 10);
    if (!minutes) { minutesField.closest('.form-group').classList.add('has-error'); return; }
    const shift = parseInt(shiftField.value, 10) || 0;
    Server.createGame({ buzzerIntervalSeconds: shift, periodLengths: [0, minutes] });
    Modals.hide($('#new-game-dialog'));
  });

  // Clean errors when opening dialogs
  on(document, 'click', 'a[href="#new-game-dialog"][data-toggle="modal"]', () => {
    $$('#new-game-dialog .modal-body .form-group').forEach(g => g.classList.remove('has-error'));
  });

  // Penalty dialog open
  on(document, 'click', 'a[href="#add-penalty"][data-toggle="modal"]', (e, t) => {
    const team = t.dataset.team || 'home';
    const dlg = $('#add-penalty');
    dlg.dataset.team = team;
    dlg.querySelector('.modal-title').textContent = `${team} Penalty`;
    const { minutes, seconds } = millisToMinSec(State.time);
    $('#add-penalty-off_ice').value = formatClock(minutes, seconds);
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

  // Generic set-value anchors
  on(document, 'click', 'a[data-action="set-value"]', (e, t) => {
    e.preventDefault();
    const targetSel = t.dataset.target; const val = t.dataset.value || '';
    const input = $(targetSel);
    if (input) input.value = String(val);
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
    connect: () => {
      setStatus('ok', 'Connected');
      setOverlay('ok', '');
      output('<span class="connect-msg">Connected</span>');
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
