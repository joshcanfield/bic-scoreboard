import { $, $$, on } from "./dom.js";

export const initRecGameForm = ({
  api,
  Server,
  State,
  Modals,
  parseClockMillis,
  formatClock,
  millisToMinSec,
  minutesStepForShift,
  pad,
  roundToSecond,
  clearStandardErrors,
  loadStoredStandardValues,
}) => {
  const recMinutesField = $("#rec_minutes"), recEndsField = $("#rec_ends_at");
  let recSyncing = false;
  let lastRawMinutes = 0;
  const shiftSelectEl = document.getElementById("shift-select");
  const shiftToggleBtn = document.getElementById("shift-toggle");
  let shiftEnabled = true;
  let lastShiftNonZero = 120;

  const getShiftTotal = () => {
    const v = shiftSelectEl ? parseInt(shiftSelectEl.value || "0", 10) || 0 : 0;
    return shiftEnabled ? v : 0;
  };

  const minutesStepForShiftOnly = (shiftSec) => {
    if (shiftSec <= 0) return 1;
    const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a || 0));
    const realG = gcd(60, shiftSec);
    return shiftSec / (realG || 1);
  };

  const updateRecHelper = () => {
    const el = document.getElementById("rec-helper");
    if (!el) return;
    const minutes =
      parseInt((recMinutesField && recMinutesField.value) || "0", 10) || 0;
    const shift = getShiftTotal();
    if (!minutes) {
      el.textContent = "";
      return;
    }
    if (shift <= 0) {
      el.textContent = `Game: ${minutes} min  Shifts: disabled`;
      return;
    }
    const totalSec = minutes * 60;
    const count = Math.floor(totalSec / shift);
    const sm = Math.floor(shift / 60);
    const ss = shift % 60;
    el.textContent = `Game: ${minutes} min  Shifts: ${count} x ${pad(sm, 2)}:${pad(ss, 2)}`;
  };

  const computeRecPeriods = (minutes, shift) => {
    const res = [];
    const stepMin = minutesStepForShift(shift);
    const maxChunk =
      Math.max(stepMin, Math.floor(99 / stepMin) * stepMin) || 99;
    let remaining = minutes;
    while (remaining > 0) {
      const chunk = Math.min(remaining, maxChunk);
      res.push(chunk);
      remaining -= chunk;
    }
    return res;
  };
  const updateSplitHint = () => {
    const hint = document.getElementById("rec-split-hint");
    if (!hint) return;
    const minutes =
      parseInt((recMinutesField && recMinutesField.value) || "0", 10) || 0;
    const shift = getShiftTotal();
    if (!minutes) {
      hint.textContent = "";
      return;
    }
    const parts = computeRecPeriods(minutes, shift);
    if (parts.length <= 1) {
      hint.textContent = "";
      return;
    }
    hint.textContent = `Periods: ${parts.join(" + ")}`;
  };
  const updateDivisibleHint = () => {
    const hint = document.getElementById("rec-divisible-hint");
    if (!hint) return;
    const minutes =
      parseInt((recMinutesField && recMinutesField.value) || "0", 10) || 0;
    const shift = getShiftTotal();
    if (minutes <= 0 || shift <= 0) {
      hint.textContent = "";
      return;
    }
    const stepOnly = minutesStepForShiftOnly(shift);
    const minDown = Math.floor(minutes / stepOnly) * stepOnly;
    const isDivisible = ((minutes * 60) % shift) === 0;
    if (isDivisible) {
      hint.textContent = "";
      return;
    }
    const totalShifts = Math.floor((minDown * 60) / shift);
    const sm = Math.floor(shift / 60);
    const ss = shift % 60;
    hint.textContent = `Rounding to ${minDown} min for shift length (${totalShifts} x ${pad(sm, 2)}:${pad(ss, 2)})`;
  };

  const pad2 = (n) => pad(n, 2);
  const roundToNearestFive = (d) => {
    const dt = new Date(d);
    dt.setSeconds(0, 0);
    const m = dt.getMinutes();
    const r = Math.round(m / 5) * 5;
    if (r === 60) {
      dt.setHours(dt.getHours() + 1);
      dt.setMinutes(0);
    } else {
      dt.setMinutes(r);
    }
    return dt;
  };
  const endsOptionValue = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const endsOptionLabel12 = (d) => {
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    h %= 12;
    if (h === 0) h = 12;
    return `${h}:${pad2(m)} ${ampm}`;
  };

  const updateLastBuzzerHint = () => {
    const el = document.getElementById("rec-last-buzzer");
    if (!el) return;
    const shift = getShiftTotal();
    if (shift <= 0) {
      el.textContent = "";
      return;
    }
    const v = (recEndsField && recEndsField.value) || "";
    const parts = v.split(":");
    if (parts.length < 2) {
      el.textContent = "";
      return;
    }
    const hh = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10);
    if (Number.isNaN(hh) || Number.isNaN(mm)) {
      el.textContent = "";
      return;
    }
    const now = new Date();
    const end = new Date(now);
    end.setHours(hh, mm, 0, 0);
    if (end.getTime() <= now.getTime()) end.setDate(end.getDate() + 1);
    const durationSec = Math.floor((end.getTime() - now.getTime()) / 1000);
    let k = Math.floor(durationSec / shift);
    if (k <= 0) {
      el.textContent = "Last buzzer: none before end";
      return;
    }
    if (durationSec % shift === 0) k -= 1;
    if (k <= 0) {
      el.textContent = "Last buzzer: none before end";
      return;
    }
    const last = new Date(now.getTime() + k * shift * 1000);
    el.textContent = `Last buzzer: ${endsOptionLabel12(last)}`;
  };

  const populateEndsOptions = (targetDate) => {
    if (!recEndsField) return;
    const now = new Date();
    const start = roundToNearestFive(now);
    const vals = [];
    const hoursSpan = 12;
    for (let i = 0; i < hoursSpan * 12; i++) {
      const dt = new Date(start.getTime() + i * 5 * 60000);
      vals.push(endsOptionValue(dt));
    }
    recEndsField.innerHTML = Array.from({ length: vals.length })
      .map((_, idx) => {
        const dt = new Date(start.getTime() + idx * 5 * 60000);
        const v = endsOptionValue(dt);
        const label = endsOptionLabel12(dt);
        return `<option value="${v}">${label}</option>`;
      })
      .join("");
    if (targetDate) {
      const v = endsOptionValue(targetDate);
      if (!vals.includes(v)) {
        recEndsField.insertAdjacentHTML(
          "afterbegin",
          `<option value="${v}">${endsOptionLabel12(targetDate)}</option>`,
        );
      }
      recEndsField.value = v;
    } else {
      recEndsField.value = vals[0] || "";
    }
  };

  const setEndsFromMinutes = () => {
    if (!recMinutesField || !recEndsField) return;
    let mRaw = parseInt(recMinutesField.value || "0", 10);
    if (!mRaw) return;
    const mAdj = mRaw;
    recSyncing = true;
    const now = new Date();
    let end = new Date(now.getTime() + mAdj * 60000);
    end = roundToNearestFive(end);
    populateEndsOptions(end);
    recSyncing = false;
    updateRecHelper();
    updateDivisibleHint();
    updateSplitHint();
    updateLastBuzzerHint();
  };

  const setMinutesFromEnds = () => {
    if (!recMinutesField || !recEndsField) return;
    if (recSyncing) return;
    let v = recEndsField.value || "";
    const parts = v.split(":");
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
      const exists = Array.from(recEndsField.options).some(
        (o) => o.value === snapped,
      );
      if (!exists) {
        recEndsField.insertAdjacentHTML(
          "afterbegin",
          `<option value="${snapped}">${endsOptionLabel12(end)}</option>`,
        );
      }
      recEndsField.value = snapped;
      recSyncing = false;
    }
    if (end.getTime() <= now.getTime()) end.setDate(end.getDate() + 1);
    const minutesRaw = Math.max(
      1,
      Math.floor((end.getTime() - now.getTime()) / 60000),
    );
    lastRawMinutes = minutesRaw;
    const minutesAdj = minutesRaw;
    recSyncing = true;
    recMinutesField.value = String(minutesAdj);
    recSyncing = false;
    updateRecHelper();
    updateDivisibleHint();
    updateSplitHint();
    updateLastBuzzerHint();
  };

  if (recMinutesField) {
    recMinutesField.addEventListener("input", () => {
      setEndsFromMinutes();
      updateRecHelper();
      updateDivisibleHint();
      updateSplitHint();
    });
  }
  if (recEndsField) {
    recEndsField.addEventListener("change", () => {
      setMinutesFromEnds();
      updateRecHelper();
      updateDivisibleHint();
      updateSplitHint();
      updateLastBuzzerHint();
    });
  }
  (() => {
    const now = new Date();
    const target = roundToNearestFive(new Date(now.getTime() + 90 * 60000));
    populateEndsOptions(target);
    setMinutesFromEnds();
    updateDivisibleHint();
    updateSplitHint();
    updateLastBuzzerHint();
  })();

  if (recMinutesField) {
    recMinutesField.addEventListener("change", () => {
      setEndsFromMinutes();
      updateRecHelper();
      updateDivisibleHint();
      updateSplitHint();
    });
  }
  const setShiftTotal = (total) => {
    if (!shiftSelectEl) return;
    if (total > 0) {
      let best = parseInt(shiftSelectEl.options[0].value, 10);
      let bestD = Math.abs(total - best);
      for (const opt of shiftSelectEl.options) {
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
    window.shiftEnabled = shiftEnabled;
  };

  const updateShiftDisabledUI = () => {
    if (shiftSelectEl) shiftSelectEl.disabled = !shiftEnabled;
    if (shiftToggleBtn)
      shiftToggleBtn.textContent = shiftEnabled ? "Disable" : "Enable";
  };

  const onShiftChanged = () => {
    const shift = getShiftTotal();
    if (!recMinutesField || !recEndsField) return;
    const v = (recEndsField.value || "").trim();
    const parts = v.split(":");
    if (parts.length >= 2) {
      const hh = parseInt(parts[0], 10);
      const mm = parseInt(parts[1], 10);
      if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
        const now = new Date();
        const end = new Date(now);
        end.setHours(hh, mm, 0, 0);
        if (end.getTime() <= now.getTime()) end.setDate(end.getDate() + 1);
        const minutesRaw = Math.max(
          1,
          Math.floor((end.getTime() - now.getTime()) / 60000),
        );
        lastRawMinutes = minutesRaw;
        recMinutesField.value = String(minutesRaw);
      }
    }
    updateRecHelper();
    updateDivisibleHint();
    updateSplitHint();
    updateLastBuzzerHint();
    updateShiftDisabledUI();
  };

  if (shiftSelectEl) {
    shiftSelectEl.addEventListener("change", () => {
      lastShiftNonZero =
        parseInt(shiftSelectEl.value || "0", 10) || lastShiftNonZero;
      onShiftChanged();
    });
  }
  if (shiftToggleBtn) {
    shiftToggleBtn.addEventListener("click", () => {
      shiftEnabled = !shiftEnabled;
      window.shiftEnabled = shiftEnabled;
      if (shiftEnabled && lastShiftNonZero > 0) setShiftTotal(lastShiftNonZero);
      updateShiftDisabledUI();
      onShiftChanged();
    });
  }
  updateRecHelper();
  updateShiftDisabledUI();
  const newRecBtn = $("#new-rec-game");
  if (newRecBtn) {
    newRecBtn.addEventListener("click", () => {
      const errorBox = $("#rec .error");
      if (errorBox) errorBox.textContent = "";
      $$("#rec .form-group").forEach((g) =>
        g.classList.remove("has-error"),
      );
      const endsField = recEndsField;
      let minutes = 0;
      const v = (endsField && endsField.value) || "";
      const parts = v.split(":");
      if (parts.length >= 2) {
        const hh = parseInt(parts[0], 10);
        const mm = parseInt(parts[1], 10);
        if (Number.isNaN(hh) || Number.isNaN(mm)) {
          if (endsField)
            endsField.closest(".form-group").classList.add("has-error");
          if (errorBox)
            errorBox.textContent = "Please enter a valid end time (HH:MM).";
          return;
        }
        const now = new Date();
        const end = new Date(now);
        end.setHours(hh, mm, 0, 0);
        if (end.getTime() <= now.getTime()) end.setDate(end.getDate() + 1);
        minutes = Math.max(
          1,
          Math.round((end.getTime() - now.getTime()) / 60000),
        );
        if (recMinutesField) recMinutesField.value = String(minutes);
      } else {
        minutes =
          parseInt((recMinutesField && recMinutesField.value) || "0", 10) || 0;
        if (!minutes) {
          if (recMinutesField)
            recMinutesField.closest(".form-group").classList.add("has-error");
          if (errorBox)
            errorBox.textContent = "Please enter game length in minutes.";
          return;
        }
      }
      const shift = getShiftTotal();
      let minutesForGame = minutes;
      if (shift > 0) {
        const stepOnly = minutesStepForShiftOnly(shift);
        minutesForGame = Math.floor(minutes / stepOnly) * stepOnly;
        minutesForGame = Math.max(1, minutesForGame);
      }
      const periods = [0];
      const stepMin = minutesStepForShift(shift);
      const maxChunk =
        Math.max(stepMin, Math.floor(99 / stepMin) * stepMin) || 99;
      let remaining = minutesForGame;
      while (remaining > 0) {
        const chunk = Math.min(remaining, maxChunk);
        periods.push(chunk);
        remaining -= chunk;
      }
      try {
        localStorage.setItem("scoreboard.rec.minutes", String(minutes));
        localStorage.setItem(
          "scoreboard.rec.shiftEnabled",
          JSON.stringify(!!shiftEnabled),
        );
        localStorage.setItem(
          "scoreboard.rec.shiftSeconds",
          String(getShiftTotal() || lastShiftNonZero || 0),
        );
      } catch (_) {
        /* ignore storage issues */
      }
      Server.createGame({
        buzzerIntervalSeconds: shift,
        periodLengths: periods,
      });
      Modals.hide($("#new-game-dialog"));
    });
  }
  on(document, 'click', '[data-toggle="modal"][href="#new-game-dialog"]', () => {
    $$("#new-game-dialog .modal-body .form-group").forEach((g) =>
      g.classList.remove("has-error"),
    );
    clearStandardErrors();
    loadStoredStandardValues();

    (() => {
      let minutes = "";
      let shiftSecs = "";
      let shiftEn = null;
      try {
        minutes = localStorage.getItem("scoreboard.rec.minutes") || "";
        shiftSecs = localStorage.getItem("scoreboard.rec.shiftSeconds") || "";
        const se = localStorage.getItem("scoreboard.rec.shiftEnabled");
        if (se != null) shiftEn = JSON.parse(se);
      } catch (_) {
        /* ignore */
      }
      const now = new Date();
      const defaultTarget = roundToNearestFive(new Date(now.getTime() + 90 * 60000));
      populateEndsOptions(defaultTarget);
      if (minutes && recMinutesField) {
        recMinutesField.value = String(parseInt(minutes, 10) || 0);
        setEndsFromMinutes();
      } else {
        setMinutesFromEnds();
      }
      const secs = parseInt(shiftSecs || "0", 10) || 0;
      if (shiftEn === false) {
        shiftEnabled = false;
        window.shiftEnabled = false;
      } else {
        shiftEnabled = true;
        window.shiftEnabled = true;
      }
      if (secs > 0) setShiftTotal(secs);
      updateShiftDisabledUI();
      updateRecHelper();
      updateDivisibleHint();
      updateSplitHint();
      updateLastBuzzerHint();
    })();
  });
};
