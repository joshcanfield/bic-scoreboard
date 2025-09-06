// Display-only scoreboard UI implemented with native ES modules.
// Transport: native WebSocket (no Socket.IO)

const digits2 = (n) => [Math.floor(n / 10), n % 10];

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const updatePenalties = (team, penalties) => {
  const teamBox = $(`#penalty_box .penalties.${team}`);
  if (!teamBox) return;
  const playerDigits = $$('.player .digits', teamBox);
  const penaltyDigits = $$('.penalty .digits', teamBox);

  for (let i = 0; i < 2; i++) {
    const p = penalties[i];
    const player = playerDigits[i];
    const pen = penaltyDigits[i];
    const clearDigits = () => {
      $$('.digit', player).forEach(d => d.textContent = '0');
      $$('.digit', pen).forEach(d => d.textContent = '0');
    };
    if (p) {
      let remaining = p.time;
      if (p.startTime > 0) remaining = p.time - p.elapsed;
      if (remaining > 0) {
        const serving = (p.servingPlayerNumber != null && p.servingPlayerNumber !== undefined && Number(p.servingPlayerNumber) !== 0)
          ? Number(p.servingPlayerNumber) : Number(p.playerNumber);
        const pd = digits2(serving || 0);
        $('.digit.tens', player).textContent = pd[0];
        $('.digit.ones', player).textContent = pd[1];

        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining / 1000) % 60);
        const sd = digits2(seconds);
        $('.digit.minutes', pen).textContent = minutes;
        $('.digit.seconds.tens', pen).textContent = sd[0];
        $('.digit.seconds.ones', pen).textContent = sd[1];
      } else {
        clearDigits();
      }
    } else {
      clearDigits();
    }
  }
};

const renderUpdate = (data) => {
  // scores
  const hd = digits2(data.home.score);
  const ad = digits2(data.away.score);
  const scoreBox = $('#score_box');
  $('.score.home .digit.tens', scoreBox).textContent = hd[0];
  $('.score.home .digit.ones', scoreBox).textContent = hd[1];
  $('.score.guest .digit.tens', scoreBox).textContent = ad[0];
  $('.score.guest .digit.ones', scoreBox).textContent = ad[1];

  // clock
  const minutes = Math.floor(data.time / 60000);
  const seconds = Math.floor((data.time / 1000) % 60);
  const md = digits2(minutes);
  const sd = digits2(seconds);
  $('.clock .digit.minutes.tens', scoreBox).textContent = md[0];
  $('.clock .digit.minutes.ones', scoreBox).textContent = md[1];
  $('.clock .digit.seconds.tens', scoreBox).textContent = sd[0];
  $('.clock .digit.seconds.ones', scoreBox).textContent = sd[1];

  // period
  $('#penalty_box .period .digit').textContent = data.period;

  // penalties
  updatePenalties('home', data.home.penalties || []);
  updatePenalties('guest', data.away.penalties || []);

  // buzzer visual
  document.body.classList.toggle('buzzer', !!data.buzzerOn);
};

// Transport: supports Socket.IO by default, optional native WS via ?transport=ws
const buildBaseHost = (defPort) => {
  const url = new URL(window.location.href);
  const host = url.searchParams.get('socketHost') || window.location.hostname;
  const port = url.searchParams.get('socketPort') || defPort;
  return { host, port, isHttps: window.location.protocol === 'https:' };
};
const createTransport = () => {
  const { host, port, isHttps } = buildBaseHost('8082');
  const wsUrl = `${isHttps ? 'wss' : 'ws'}://${host}:${port}/ws`;
  const listeners = new Map();
  let ws = null;
  let reconnectDelay = 500;
  const reconnectDelayMax = 5000;

  const overlay = document.getElementById('conn-overlay');
  const overlayText = document.getElementById('conn-overlay-text');
  const setOverlay = (state, text) => {
    if (!overlay) return;
    overlay.dataset.state = state;
    overlay.style.display = state === 'ok' ? 'none' : 'flex';
    if (overlayText) overlayText.textContent = text || '';
  };

  const connect = () => {
    ws = new WebSocket(wsUrl);
    ws.addEventListener('open', () => { reconnectDelay = 500; setOverlay('ok', ''); });
    ws.addEventListener('message', (e) => {
      try { const msg = JSON.parse(e.data); const cb = listeners.get(msg.event); if (cb) cb(msg.data); } catch(_){}
    });
    ws.addEventListener('close', () => {
      setOverlay('down', 'Reconnecting...');
      const delay = reconnectDelay;
      reconnectDelay = Math.min(reconnectDelay * 2, reconnectDelayMax);
      setTimeout(connect, delay);
    });
    ws.addEventListener('error', () => { setOverlay('down', 'Reconnecting...'); });
  };

  connect();
  return { on: (ev, cb) => listeners.set(ev, cb), emit: ()=>{} };
};
const transport = createTransport();
transport.on('update', renderUpdate);
transport.on('power', (data) => { document.body.classList.toggle('buzzer', !!data.buzzerOn); });
transport.on('message', () => {});
