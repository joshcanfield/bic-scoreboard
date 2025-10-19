// Time and formatting helpers for the control UI
export const pad = (d, w) => (`000000${d}`).slice(-w);

export const digits2 = (n) => [Math.floor(n / 10), n % 10];

export const parseClock = (clock) => {
  const s = String(clock).replace(":", "");
  let m = 0;
  let sec = 0;
  if (s.length > 2) {
    sec = parseInt(s.slice(-2), 10);
    m = parseInt(s.slice(0, -2), 10);
  } else {
    sec = parseInt(s, 10);
  }
  if (Number.isNaN(m) || Number.isNaN(sec)) return null;
  return { minutes: m, seconds: sec };
};

export const parseClockMillis = (clock) => {
  if (typeof clock === "number") return clock;
  const parts = parseClock(clock);
  if (!parts) return null;
  return (parts.minutes * 60 + parts.seconds) * 1000;
};

export const formatClock = (m, s) => `${pad(m, 2)}:${pad(s, 2)}`;

export const millisToMinSec = (millis) => ({
  minutes: Math.floor(millis / 1000 / 60),
  seconds: Math.floor((millis / 1000) % 60),
});

export const roundToSecond = (millis) =>
  Math.floor((Number(millis) || 0 + 999) / 1000) * 1000;

export const gcd = (a, b) => {
  let aa = Math.abs(a || 0);
  let bb = Math.abs(b || 0);
  while (bb !== 0) {
    const t = bb;
    bb = aa % bb;
    aa = t;
  }
  return aa;
};

export const lcm = (a, b) => Math.abs(a * b) / (gcd(a, b) || 1);

export const minutesStepForShift = (shiftSec) => {
  if (shiftSec <= 0) return 15;
  const g = gcd(60, shiftSec);
  const stepA = shiftSec / (g || 1);
  const step = lcm(15, stepA);
  return Math.max(15, step);
};

const getShiftTotalForNormalize = () => {
  const sel =
    typeof document !== "undefined"
      ? document.getElementById("shift-select")
      : null;
  const enabled =
    typeof window !== "undefined" ? window.shiftEnabled ?? true : true;
  const v = sel ? parseInt(sel.value || "0", 10) || 0 : 0;
  return enabled ? v : 0;
};

export const normalizeMinutes = (m, shiftOverride) => {
  const shift =
    typeof shiftOverride === "number"
      ? shiftOverride
      : getShiftTotalForNormalize();
  const step = minutesStepForShift(shift);
  if (step <= 0) return m;
  const floored = Math.floor(m / step) * step;
  return Math.max(step, floored);
};
