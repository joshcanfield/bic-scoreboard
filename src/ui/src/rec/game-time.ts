import { computeRecPeriods, minutesStepForShiftOnly, normalizeMinutes as normalizeMinutesForShift } from '../utils/rec-time';
import { pad } from '../utils/time';

// Re-export for use in game-dialog
export { computeRecPeriods };

export interface RecGameSettings {
  minutes: number;
  shiftSeconds: number;
  endsAtValue: string;
}

export const toShiftTotal = (value: string | null | undefined, enabled: boolean): number => {
  if (!enabled) return 0;
  const parsed = parseInt(value || '0', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const normalizeMinutes = (minutes: number, shiftSeconds: number): number => {
  if (minutes <= 0) return 0;
  if (shiftSeconds <= 0) return minutes;
  // Use baseStepMinutes=1 to align only with shift length, not a fixed 15-minute increment.
  // This allows values like 56, 63, 70 for 3:30 shifts instead of forcing 105-minute steps.
  return normalizeMinutesForShift(minutes, shiftSeconds, 1);
};

export const buildRecHelperText = (minutes: number, shift: number): string => {
  if (!minutes) return '';
  if (shift <= 0) return `Game: ${minutes} min • Shifts: disabled`;
  const totalSeconds = minutes * 60;
  const count = Math.floor(totalSeconds / shift);
  const minutesPart = Math.floor(shift / 60);
  const secondsPart = shift % 60;
  return `Game: ${minutes} min • Shifts: ${count} × ${pad(minutesPart, 2)}:${pad(secondsPart, 2)}`;
};

export const buildSplitHint = (minutes: number, shift: number): string => {
  if (!minutes) return '';
  const parts = computeRecPeriods(minutes, shift);
  if (parts.length <= 1) return '';
  return `Periods: ${parts.join(' + ')}`;
};

export const buildDivisibleHint = (minutes: number, shift: number): string => {
  if (minutes <= 0 || shift <= 0) return '';
  const stepOnly = minutesStepForShiftOnly(shift);
  const minDown = Math.floor(minutes / stepOnly) * stepOnly;
  const isDivisible = ((minutes * 60) % shift) === 0;
  if (isDivisible) return '';
  const totalShifts = Math.floor((minDown * 60) / shift);
  const sm = Math.floor(shift / 60);
  const ss = shift % 60;
  return `Rounding to ${minDown} min for shift length (${totalShifts} × ${pad(sm, 2)}:${pad(ss, 2)})`;
};

export const formatEndsOptionValue = (date: Date): string => `${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}`;

export const formatEndsOptionLabel = (date: Date): string => {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${pad(minutes, 2)} ${ampm}`;
};

export const roundToNearestFive = (date: Date): Date => {
  const result = new Date(date);
  result.setSeconds(0, 0);
  const m = result.getMinutes();
  const rounded = Math.round(m / 5) * 5;
  if (rounded === 60) {
    result.setHours(result.getHours() + 1);
    result.setMinutes(0);
  } else {
    result.setMinutes(rounded);
  }
  return result;
};

export const generateEndsOptions = (target: Date | null, hoursSpan = 12): { options: Array<{ value: string; label: string }>; selectedValue: string } => {
  const now = new Date();
  const start = roundToNearestFive(now);
  const options: Array<{ value: string; label: string }> = [];
  for (let i = 0; i < hoursSpan * 12; i += 1) {
    const dt = new Date(start.getTime() + i * 5 * 60000);
    options.push({ value: formatEndsOptionValue(dt), label: formatEndsOptionLabel(dt) });
  }
  let selectedValue = options[0]?.value || '';
  if (target) {
    const targetValue = formatEndsOptionValue(target);
    if (!options.some(opt => opt.value === targetValue)) {
      options.unshift({ value: targetValue, label: formatEndsOptionLabel(target) });
    }
    selectedValue = targetValue;
  }
  return { options, selectedValue };
};

export const computeMinutesFromEnds = (endsValue: string, reference: Date = new Date()): number | null => {
  const parts = endsValue.split(':');
  if (parts.length < 2) return null;
  const hh = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  const end = new Date(reference);
  end.setHours(hh, mm, 0, 0);
  const snapped = roundToNearestFive(end);
  if (snapped.getTime() <= reference.getTime()) snapped.setDate(snapped.getDate() + 1);
  const minutes = Math.max(1, Math.floor((snapped.getTime() - reference.getTime()) / 60000));
  return minutes;
};

export const buildLastBuzzerHint = (endsValue: string, shiftSeconds: number, reference: Date = new Date()): string => {
  if (shiftSeconds <= 0) return '';
  const minutes = computeMinutesFromEnds(endsValue, reference);
  if (minutes == null) return '';
  const totalSeconds = minutes * 60;
  let k = Math.floor(totalSeconds / shiftSeconds);
  if (k <= 0) return 'Last buzzer: none before end';
  if (totalSeconds % shiftSeconds === 0) k -= 1;
  if (k <= 0) return 'Last buzzer: none before end';
  const last = new Date(reference.getTime() + k * shiftSeconds * 1000);
  return `Last buzzer: ${formatEndsOptionLabel(last)}`;
};
