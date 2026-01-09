type ClockParts = {
  minutes: number;
  seconds: number;
};

export function pad(value: number | string, width: number): string {
  const str = String(value ?? '');
  return `${'0'.repeat(Math.max(0, width))}${str}`.slice(-width);
}

export function digits2(value: number): [number, number] {
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return [tens, ones];
}

export function parseClock(clock: string | number): ClockParts | null {
  const normalized = String(clock ?? '').replace(':', '');
  if (!normalized) return null;

  const seconds = parseInt(normalized.slice(-2), 10);
  const minutes = normalized.length > 2 ? parseInt(normalized.slice(0, -2), 10) : 0;

  if (Number.isNaN(minutes) || Number.isNaN(seconds)) {
    return null;
  }

  return { minutes, seconds };
}

export function parseClockMillis(clock: string | number): number | null {
  if (typeof clock === 'number') {
    return Number.isFinite(clock) ? clock : null;
  }

  const parts = parseClock(clock);
  if (!parts) return null;
  return (parts.minutes * 60 + parts.seconds) * 1000;
}

export function formatClock(minutes: number, seconds: number): string {
  return `${pad(minutes, 2)}:${pad(seconds, 2)}`;
}

export function millisToMinSec(millis: number): ClockParts {
  const totalSeconds = Math.floor((millis || 0) / 1000);
  return {
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60
  };
}

export function formatTime(millis: number): string {
  const parts = millisToMinSec(millis);
  return formatClock(parts.minutes, parts.seconds);
}

export function roundToSecond(millis: number | null | undefined): number {
  const value = Number(millis) || 0;
  return Math.floor((value + 999) / 1000) * 1000;
}

export type { ClockParts };
