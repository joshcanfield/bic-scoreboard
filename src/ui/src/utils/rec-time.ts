const DEFAULT_MINUTE_STEP = 15;
const DEFAULT_MAX_PERIOD_MINUTES = 99;

/**
 * Greatest common divisor using Euclid's algorithm.
 */
export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a) || 0);
  let y = Math.abs(Math.trunc(b) || 0);
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x;
}

/**
 * Least common multiple based on the GCD result.
 */
export function lcm(a: number, b: number): number {
  const ax = Math.trunc(a);
  const bx = Math.trunc(b);
  if (!ax || !bx) return 0;
  const divisor = gcd(ax, bx) || 1;
  return Math.abs(ax * bx) / divisor;
}

/**
 * Determine a minute step that aligns with shift length and the base step.
 */
export function minutesStepForShift(
  shiftSeconds: number,
  baseStepMinutes = DEFAULT_MINUTE_STEP
): number {
  const stepMinutes = baseStepMinutes > 0 ? baseStepMinutes : DEFAULT_MINUTE_STEP;
  if (shiftSeconds <= 0) return stepMinutes;
  const normalizedShift = Math.trunc(shiftSeconds);
  const divisor = gcd(60, normalizedShift) || 1;
  const shiftAlignedMinutes = normalizedShift / divisor;
  const candidate = lcm(stepMinutes, shiftAlignedMinutes) || shiftAlignedMinutes || stepMinutes;
  return Math.max(stepMinutes, candidate);
}

/**
 * Determine the minimum minute step implied solely by the shift length.
 */
export function minutesStepForShiftOnly(shiftSeconds: number): number {
  if (shiftSeconds <= 0) return 1;
  const normalizedShift = Math.trunc(shiftSeconds);
  const divisor = gcd(60, normalizedShift) || 1;
  return normalizedShift / divisor;
}

/**
 * Normalize minutes so it does not exceed the nearest lower aligned step.
 */
export function normalizeMinutes(
  minutes: number,
  shiftSeconds: number,
  baseStepMinutes = DEFAULT_MINUTE_STEP
): number {
  const step = minutesStepForShift(shiftSeconds, baseStepMinutes);
  if (step <= 0) return minutes;
  const floored = Math.floor(minutes / step) * step;
  return Math.max(step, floored);
}

/**
 * Split total minutes into period chunks that respect step and max period constraints.
 */
export function computeRecPeriods(
  totalMinutes: number,
  shiftSeconds: number,
  baseStepMinutes = DEFAULT_MINUTE_STEP,
  maxPeriodMinutes = DEFAULT_MAX_PERIOD_MINUTES
): number[] {
  const parts: number[] = [];
  const minutes = Math.floor(totalMinutes);
  if (minutes <= 0) return parts;

  const stepMinutes = minutesStepForShift(shiftSeconds, baseStepMinutes);
  const validStep = stepMinutes > 0 ? stepMinutes : baseStepMinutes;
  const chunkBase = Math.floor(maxPeriodMinutes / validStep) * validStep;
  const maxChunk = Math.max(validStep, chunkBase) || maxPeriodMinutes;

  let remaining = minutes;
  while (remaining > 0) {
    const chunk = Math.min(remaining, maxChunk);
    parts.push(chunk);
    remaining -= chunk;
  }

  return parts;
}
