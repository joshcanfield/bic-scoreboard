/**
 * New game dialog with standard and drop-in (rec) game creation.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { computeRecPeriods } from '../utils/rec-time';
import { type ServerActions } from '../transport/server';
import {
  buildRecHelperText,
  buildSplitHint,
  buildDivisibleHint,
  buildLastBuzzerHint,
  generateEndsOptions,
  normalizeMinutes as normalizeRecMinutes,
  computeMinutesFromEnds,
  roundToNearestFive as roundRecToFive,
  toShiftTotal,
} from '../rec/game-time';

import Modals from './modals';

const $ = <T extends HTMLElement = HTMLElement>(sel: string): T | null =>
  document.querySelector<T>(sel);

const $$ = (sel: string): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>(sel));

type StandardTemplateKey = 'jr' | 'youth60' | 'youth75' | 'pphl';

interface StandardTemplateConfig {
  warmupMinutes?: number;
  periodMinutes?: number[];
  intermissionMinutes?: number;
}

const STANDARD_TEMPLATES: Record<StandardTemplateKey, StandardTemplateConfig> = {
  jr: { warmupMinutes: 15, periodMinutes: [20, 20, 20], intermissionMinutes: 15 },
  youth60: { warmupMinutes: 5, periodMinutes: [15, 15, 12], intermissionMinutes: 1 },
  youth75: { warmupMinutes: 5, periodMinutes: [13, 13, 13], intermissionMinutes: 1 },
  pphl: { warmupMinutes: 3, periodMinutes: [17, 17, 17], intermissionMinutes: 1 },
};

// Rec game state
let recSyncing = false;
let shiftEnabled = true;
let lastShiftNonZero = 120; // default 2:00

const getShiftTotal = (): number => {
  const shiftSelectEl = document.getElementById('shift-select') as HTMLSelectElement | null;
  if (!shiftSelectEl) return shiftEnabled ? lastShiftNonZero : 0;
  const total = toShiftTotal(shiftSelectEl.value, shiftEnabled);
  if (shiftEnabled && total > 0) lastShiftNonZero = total;
  return total;
};

const renderEndsOptions = (targetDate: Date) => {
  const recEndsField = $('#rec_ends_at') as HTMLSelectElement | null;
  if (!recEndsField) return;
  const { options, selectedValue } = generateEndsOptions(targetDate ?? null);
  recEndsField.innerHTML = options
    .map(({ value, label }) => `<option value="${value}">${label}</option>`)
    .join('');
  recEndsField.value = selectedValue;
};

const updateRecHelper = () => {
  const el = document.getElementById('rec-helper');
  if (!el) return;
  const recMinutesField = $('#rec_minutes') as HTMLInputElement | null;
  const minutes = parseInt((recMinutesField && recMinutesField.value) || '0', 10) || 0;
  const shift = getShiftTotal();
  el.textContent = buildRecHelperText(minutes, shift);
};

const updateSplitHint = () => {
  const hint = document.getElementById('rec-split-hint');
  if (!hint) return;
  const recMinutesField = $('#rec_minutes') as HTMLInputElement | null;
  const minutes = parseInt((recMinutesField && recMinutesField.value) || '0', 10) || 0;
  const shift = getShiftTotal();
  hint.textContent = buildSplitHint(minutes, shift);
};

const updateDivisibleHint = () => {
  const hint = document.getElementById('rec-divisible-hint');
  if (!hint) return;
  const recMinutesField = $('#rec_minutes') as HTMLInputElement | null;
  const minutes = parseInt((recMinutesField && recMinutesField.value) || '0', 10) || 0;
  const shift = getShiftTotal();
  hint.textContent = buildDivisibleHint(minutes, shift);
};

const updateLastBuzzerHint = () => {
  const hint = document.getElementById('rec-last-buzzer');
  if (!hint) return;
  const shift = getShiftTotal();
  const recEndsField = $('#rec_ends_at') as HTMLSelectElement | null;
  const endsValue = recEndsField ? recEndsField.value || '' : '';
  hint.textContent = buildLastBuzzerHint(endsValue, shift);
};

const setEndsFromMinutes = () => {
  const recMinutesField = $('#rec_minutes') as HTMLInputElement | null;
  const recEndsField = $('#rec_ends_at') as HTMLSelectElement | null;
  if (!recMinutesField || !recEndsField) return;
  const minutes = parseInt(recMinutesField.value || '0', 10) || 0;
  if (!minutes) return;
  const shift = getShiftTotal();
  const adjusted = shift > 0 ? normalizeRecMinutes(minutes, shift) || minutes : minutes;
  recSyncing = true;
  const now = new Date();
  const target = roundRecToFive(new Date(now.getTime() + adjusted * 60000));
  renderEndsOptions(target);
  recMinutesField.value = String(adjusted);
  recSyncing = false;
  updateRecHelper();
  updateDivisibleHint();
  updateSplitHint();
  updateLastBuzzerHint();
};

const setMinutesFromEnds = () => {
  const recMinutesField = $('#rec_minutes') as HTMLInputElement | null;
  const recEndsField = $('#rec_ends_at') as HTMLSelectElement | null;
  if (!recMinutesField || !recEndsField) return;
  if (recSyncing) return;
  const now = new Date();
  const raw = computeMinutesFromEnds(recEndsField.value || '', now);
  if (raw == null) return;
  const shift = getShiftTotal();
  const adjusted = shift > 0 ? normalizeRecMinutes(raw, shift) || raw : raw;
  recSyncing = true;
  recMinutesField.value = String(adjusted);
  const target = roundRecToFive(new Date(now.getTime() + adjusted * 60000));
  renderEndsOptions(target);
  recSyncing = false;
  updateRecHelper();
  updateDivisibleHint();
  updateSplitHint();
  updateLastBuzzerHint();
};

const initRecDefaultsOnLoad = () => {
  const now = new Date();
  const defaultTarget = roundRecToFive(new Date(now.getTime() + 90 * 60000));
  renderEndsOptions(defaultTarget);
  setMinutesFromEnds();
};

const setShiftTotal = (total: number) => {
  const shiftSelectEl = document.getElementById('shift-select') as HTMLSelectElement | null;
  if (!shiftSelectEl) return;
  if (total > 0) {
    // pick closest option value
    let best = parseInt(shiftSelectEl.options[0].value, 10);
    let bestD = Math.abs(total - best);
    for (let i = 0; i < shiftSelectEl.options.length; i++) {
      const opt = shiftSelectEl.options[i];
      const val = parseInt(opt.value, 10);
      const d = Math.abs(total - val);
      if (d < bestD) {
        best = val;
        bestD = d;
      }
    }
    shiftSelectEl.value = String(best);
    lastShiftNonZero = best;
    shiftEnabled = true;
  } else {
    shiftEnabled = false;
  }
};

const updateShiftDisabledUI = () => {
  const shiftSelectEl = document.getElementById('shift-select') as HTMLSelectElement | null;
  const shiftToggleBtn = document.getElementById('shift-toggle');
  if (shiftSelectEl) shiftSelectEl.disabled = !shiftEnabled;
  if (shiftToggleBtn) shiftToggleBtn.textContent = shiftEnabled ? 'Disable' : 'Enable';
};

const onShiftChanged = () => {
  const recMinutesField = $('#rec_minutes') as HTMLInputElement | null;
  if (recMinutesField) {
    const minutes = parseInt(recMinutesField.value || '0', 10) || 0;
    if (minutes > 0) {
      const shift = getShiftTotal();
      const normalized = shift > 0 ? normalizeRecMinutes(minutes, shift) || minutes : minutes;
      recMinutesField.value = String(normalized);
    }
  }
  setEndsFromMinutes();
  updateShiftDisabledUI();
  if (recMinutesField && !parseInt(recMinutesField.value || '0', 10)) {
    updateRecHelper();
    updateDivisibleHint();
    updateSplitHint();
    updateLastBuzzerHint();
  }
};

export const initGameDialog = (Server: ServerActions) => {
  const on = (
    el: HTMLElement | Document,
    type: string,
    selector: string,
    handler: (e: Event, t: HTMLElement) => void
  ) => {
    el.addEventListener(type, (e) => {
      const target = (e.target as HTMLElement).closest(selector);
      if (target && el.contains(target)) {
        handler(e, target as HTMLElement);
      }
    });
  };

  const standardTemplateSelect = document.getElementById('standard-template') as HTMLSelectElement | null;
  const standardPeriodFields = Array.from({ length: 4 }, (_, idx) =>
    document.getElementById(`period-${idx}`) as HTMLInputElement | null
  );
  const standardIntermissionField = document.getElementById(
    'intermission-minutes'
  ) as HTMLInputElement | null;
  let applyingStandardTemplate = false;

  const runWithTemplateApplying = (fn: () => void) => {
    const prev = applyingStandardTemplate;
    applyingStandardTemplate = true;
    try {
      fn();
    } finally {
      applyingStandardTemplate = prev;
    }
  };

  const setStandardFieldValue = (field: HTMLInputElement | null, value: number | string | null | undefined) => {
    if (!field) return;
    const str = value === null || value === undefined ? '' : String(value);
    field.value = str;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const clearStandardErrors = () => {
    $$('#standard .form-group.has-error').forEach((group) => group.classList.remove('has-error'));
  };

  const selectStandardTemplate = (key: string, { persist = true }: { persist?: boolean } = {}) => {
    if (standardTemplateSelect) standardTemplateSelect.value = key || '';
    if (!persist) return;
    try {
      if (key) localStorage.setItem('scoreboard.standard.template', key);
      else localStorage.removeItem('scoreboard.standard.template');
    } catch (_) {
      // Ignore storage errors
    }
  };

  const applyStandardTemplate = (key: string, { persist = true }: { persist?: boolean } = {}) => {
    const tpl = STANDARD_TEMPLATES[key as StandardTemplateKey] || null;
    if (!tpl) {
      selectStandardTemplate('', { persist });
      return false;
    }
    runWithTemplateApplying(() => {
      if (standardPeriodFields[0] && typeof tpl.warmupMinutes === 'number') {
        setStandardFieldValue(standardPeriodFields[0], tpl.warmupMinutes);
      }
      const periodMinutes = Array.isArray(tpl.periodMinutes) ? tpl.periodMinutes : [];
      for (let i = 1; i < standardPeriodFields.length; i += 1) {
        const field = standardPeriodFields[i];
        const minutes = periodMinutes[i - 1];
        if (field && typeof minutes === 'number') {
          setStandardFieldValue(field, minutes);
        }
      }
      if (standardIntermissionField) {
        if (typeof tpl.intermissionMinutes === 'number') {
          setStandardFieldValue(standardIntermissionField, tpl.intermissionMinutes);
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
            for (let i = 0; i < standardPeriodFields.length; i += 1) {
              if (standardPeriodFields[i] && typeof arr[i] === 'number') {
                setStandardFieldValue(standardPeriodFields[i], arr[i]);
              }
            }
          }
        }
        const intermissionRaw = localStorage.getItem('scoreboard.standard.intermission');
        if (standardIntermissionField && intermissionRaw != null) {
          const parsed = parseInt(intermissionRaw, 10);
          setStandardFieldValue(standardIntermissionField, Number.isNaN(parsed) ? '' : parsed);
        }
      } catch (_) {
        // Ignore storage errors
      }
    });
  };

  const markStandardCustomFromManualEdit = () => {
    if (applyingStandardTemplate) return;
    if (!standardTemplateSelect || standardTemplateSelect.value === '') return;
    selectStandardTemplate('', { persist: true });
  };

  standardPeriodFields.forEach((field) => {
    if (!field) return;
    field.addEventListener('input', markStandardCustomFromManualEdit);
  });
  if (standardIntermissionField) {
    standardIntermissionField.addEventListener('input', markStandardCustomFromManualEdit);
  }

  // New game (standard)
  const newGameButton = $('#new-game');
  if (newGameButton) {
    newGameButton.addEventListener('click', () => {
      clearStandardErrors();
      const periods: number[] = [];
      let error = false;
      for (let i = 0; i <= 3; i += 1) {
        const field = standardPeriodFields[i];
        if (!field) continue;
        const val = field.value.trim();
        if (i === 0 && val === '0') {
          periods[i] = 0;
          continue;
        }
        const n = parseInt(val, 10);
        if (!n) {
          field.closest('.form-group')?.classList.add('has-error');
          error = true;
        } else {
          periods[i] = n;
        }
      }
      // Intermission minutes (optional, allow 0 for none)
      let intermission: number | null = null;
      if (standardIntermissionField) {
        const raw = standardIntermissionField.value.trim();
        const n = parseInt(raw, 10);
        if (Number.isNaN(n) || n < 0) {
          standardIntermissionField.closest('.form-group')?.classList.add('has-error');
          error = true;
        } else intermission = n;
      }
      if (error) return;
      // Persist last used standard settings (period lengths + intermission)
      try {
        localStorage.setItem('scoreboard.standard.periods', JSON.stringify(periods));
        if (intermission != null)
          localStorage.setItem('scoreboard.standard.intermission', String(intermission));
        if (standardTemplateSelect) {
          const currentTpl = standardTemplateSelect.value || '';
          if (currentTpl) {
            localStorage.setItem('scoreboard.standard.template', currentTpl);
          } else {
            localStorage.removeItem('scoreboard.standard.template');
          }
        }
      } catch (_) {
        // Ignore storage errors
      }
      const cfg: { periodLengths: number[]; intermissionDurationMinutes?: number } = {
        periodLengths: periods,
      };
      // Always include intermission; 0 disables per backend semantics
      if (intermission != null) cfg.intermissionDurationMinutes = intermission;
      Server.createGame(cfg);
      Modals.hide($('#new-game-dialog')!);
    });
  }

  // Clean errors when opening dialogs
  on(document, 'click', '[data-toggle="modal"][href="#new-game-dialog"]', () => {
    $$('#new-game-dialog .modal-body .form-group').forEach((g) => g.classList.remove('has-error'));
    loadStoredStandardValues();

    // Rec: minutes and shift settings (do not restore endsAt; ends derives from minutes)
    (function loadRec() {
      let minutes = '';
      let shiftSecs = '';
      let shiftEn: boolean | null = null;
      try {
        minutes = localStorage.getItem('scoreboard.rec.minutes') || '';
        shiftSecs = localStorage.getItem('scoreboard.rec.shiftSeconds') || '';
        const se = localStorage.getItem('scoreboard.rec.shiftEnabled');
        if (se != null) shiftEn = JSON.parse(se);
      } catch (_) {
        // Ignore storage errors
      }

      const now = new Date();
      const defaultTarget = roundRecToFive(new Date(now.getTime() + 90 * 60000));
      renderEndsOptions(defaultTarget);

      const recMinutesField = $('#rec_minutes') as HTMLInputElement | null;
      if (minutes && recMinutesField) {
        recMinutesField.value = String(parseInt(minutes, 10) || 0);
        setEndsFromMinutes();
      } else {
        setMinutesFromEnds();
      }

      const secs = parseInt(shiftSecs || '0', 10) || 0;
      shiftEnabled = shiftEn !== false;
      if (shiftEnabled && secs > 0) {
        setShiftTotal(secs);
      } else if (secs > 0) {
        lastShiftNonZero = secs;
      }
      updateShiftDisabledUI();
      updateRecHelper();
      updateDivisibleHint();
      updateSplitHint();
      updateLastBuzzerHint();
    })();
  });

  // Rec inputs: duration <-> ends-at bi-directional sync
  const recMinutesField = $('#rec_minutes');
  const recEndsField = $('#rec_ends_at');

  if (recMinutesField) {
    recMinutesField.addEventListener('input', () => {
      setEndsFromMinutes();
    });
    recMinutesField.addEventListener('change', () => {
      setEndsFromMinutes();
    });
  }
  if (recEndsField) {
    recEndsField.addEventListener('change', () => {
      setMinutesFromEnds();
    });
  }

  initRecDefaultsOnLoad();

  // Shift controls: select + toggle
  const shiftSelectEl = document.getElementById('shift-select') as HTMLSelectElement | null;
  const shiftToggleBtn = document.getElementById('shift-toggle');

  if (shiftSelectEl) {
    shiftSelectEl.addEventListener('change', () => {
      lastShiftNonZero = parseInt(shiftSelectEl.value || '0', 10) || lastShiftNonZero;
      onShiftChanged();
    });
  }
  if (shiftToggleBtn) {
    shiftToggleBtn.addEventListener('click', () => {
      shiftEnabled = !shiftEnabled;
      if (shiftEnabled && lastShiftNonZero > 0) setShiftTotal(lastShiftNonZero);
      updateShiftDisabledUI();
      onShiftChanged();
    });
  }

  // Initial helper render
  updateRecHelper();
  updateShiftDisabledUI();

  // New game (rec)
  const newRecGameButton = $('#new-rec-game');
  if (newRecGameButton) {
    newRecGameButton.addEventListener('click', () => {
      const errorBox = $('#rec .error');
      if (errorBox) errorBox.textContent = '';
      $$('#rec .form-group').forEach((g) => g.classList.remove('has-error'));
      let minutes = 0;
      const recEndsField = $('#rec_ends_at') as HTMLSelectElement | null;
      const recMinutesField = $('#rec_minutes') as HTMLInputElement | null;
      const endsValue = (recEndsField && recEndsField.value) || '';
      if (endsValue.includes(':')) {
        const computed = computeMinutesFromEnds(endsValue);
        if (computed == null) {
          if (recEndsField) recEndsField.closest('.form-group')?.classList.add('has-error');
          if (errorBox) errorBox.textContent = 'Please enter a valid end time (HH:MM).';
          return;
        }
        minutes = Math.max(1, computed);
        if (recMinutesField) recMinutesField.value = String(minutes);
      } else {
        minutes = parseInt((recMinutesField && recMinutesField.value) || '0', 10);
        if (!minutes) {
          if (recMinutesField) recMinutesField.closest('.form-group')?.classList.add('has-error');
          if (errorBox) errorBox.textContent = 'Please enter game length in minutes.';
          return;
        }
      }

      const shift = getShiftTotal();
      const minutesForGame = shift > 0 ? normalizeRecMinutes(minutes, shift) || minutes : minutes;
      const periods = [0, ...computeRecPeriods(minutesForGame, shift)];
      if (periods.length === 1) periods.push(minutesForGame);

      try {
        localStorage.setItem('scoreboard.rec.minutes', String(minutes));
        localStorage.setItem('scoreboard.rec.shiftEnabled', JSON.stringify(!!shiftEnabled));
        const storedShift = shiftEnabled ? shift : lastShiftNonZero || 0;
        localStorage.setItem('scoreboard.rec.shiftSeconds', String(storedShift));
      } catch (_) {
        // Ignore storage errors
      }

      Server.createGame({ buzzerIntervalSeconds: shift, periodLengths: periods });
      Modals.hide($('#new-game-dialog')!);
    });
  }

  // Generic set-value anchors
  on(document, 'click', 'a[data-action="set-value"]', (e, t) => {
    e.preventDefault();
    const targetSel = t.dataset.target;
    const val = t.dataset.value || '';
    const input = $(targetSel || '') as HTMLInputElement | null;
    if (input) {
      input.value = String(val);
      const id = input.getAttribute('id') || '';
      if (id === 'intermission-minutes' || /^period-[0-3]$/.test(id)) {
        markStandardCustomFromManualEdit();
      }
    }
  });

  // Standard template dropdown: apply preset warmup, periods, intermission
  if (standardTemplateSelect) {
    standardTemplateSelect.addEventListener('change', (event) => {
      const key = (event.target as HTMLSelectElement).value || '';
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

  // Set all period lengths (1-3) to a value
  on(document, 'click', 'a[data-action="set-periods"]', (e, t) => {
    e.preventDefault();
    const val = t.dataset.value || '';
    ['#period-1', '#period-2', '#period-3'].forEach((sel) => {
      const input = $(sel) as HTMLInputElement | null;
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
      $$('#game-tab li').forEach((li) => li.classList.remove('active'));
      a.parentElement?.classList.add('active');
      // pane active
      const target = a.getAttribute('href');
      $$('#new-game-dialog .tab-content .tab-pane').forEach((p) => p.classList.remove('active'));
      const pane = $(target || '');
      if (pane) pane.classList.add('active');
    });
  }
};
