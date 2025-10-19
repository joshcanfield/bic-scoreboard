import { $, $$, on } from "./dom.js";

export const initStandardGameForm = ({ Server, Modals }) => {
  const STANDARD_TEMPLATES = {
    jr: {
      warmupMinutes: 15,
      periodMinutes: [20, 20, 20],
      intermissionMinutes: 15,
    },
    youth60: {
      warmupMinutes: 5,
      periodMinutes: [15, 15, 12],
      intermissionMinutes: 1,
    },
    youth75: {
      warmupMinutes: 5,
      periodMinutes: [13, 13, 13],
      intermissionMinutes: 1,
    },
    pphl: {
      warmupMinutes: 3,
      periodMinutes: [17, 17, 17],
      intermissionMinutes: 1,
    },
  };

  const standardTemplateSelect = document.getElementById("standard-template");
  const standardPeriodFields = Array.from({ length: 4 }, (_, idx) =>
    document.getElementById(`period-${idx}`),
  );
  const standardIntermissionField = document.getElementById(
    "intermission-minutes",
  );
  let applyingStandardTemplate = false;

  const runWithTemplateApplying = (fn) => {
    const prev = applyingStandardTemplate;
    applyingStandardTemplate = true;
    try {
      fn();
    } finally {
      applyingStandardTemplate = prev;
    }
  };

  const setStandardFieldValue = (field, value) => {
    if (!field) return;
    const str =
      value === null || value === undefined ? "" : String(value);
    field.value = str;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const clearStandardErrors = () => {
    $$("#standard .form-group.has-error").forEach((group) =>
      group.classList.remove("has-error"),
    );
  };

  const selectStandardTemplate = (key, { persist = true } = {}) => {
    if (standardTemplateSelect) standardTemplateSelect.value = key || "";
    if (!persist) return;
    try {
      if (key) localStorage.setItem("scoreboard.standard.template", key);
      else localStorage.removeItem("scoreboard.standard.template");
    } catch (_) {
      /* ignore storage issues */
    }
  };

  const applyStandardTemplate = (key, { persist = true } = {}) => {
    const template = STANDARD_TEMPLATES[key];
    if (!template) {
      selectStandardTemplate("", { persist });
      return false;
    }
    runWithTemplateApplying(() => {
      if (
        standardPeriodFields[0] &&
        typeof template.warmupMinutes === "number"
      ) {
        setStandardFieldValue(
          standardPeriodFields[0],
          template.warmupMinutes,
        );
      }
      const periodMinutes = Array.isArray(template.periodMinutes)
        ? template.periodMinutes
        : [];
      for (let i = 1; i < standardPeriodFields.length; i++) {
        const minutes = periodMinutes[i - 1];
        if (typeof minutes === "number") {
          setStandardFieldValue(standardPeriodFields[i], minutes);
        }
      }
      if (standardIntermissionField) {
        if (typeof template.intermissionMinutes === "number") {
          setStandardFieldValue(
            standardIntermissionField,
            template.intermissionMinutes,
          );
        } else {
          setStandardFieldValue(standardIntermissionField, "");
        }
      }
    });
    clearStandardErrors();
    selectStandardTemplate(key, { persist });
    return true;
  };

  const loadStoredStandardValues = () => {
    let templateKey = "";
    try {
      templateKey = localStorage.getItem("scoreboard.standard.template") || "";
    } catch (_) {
      templateKey = "";
    }
    if (templateKey && applyStandardTemplate(templateKey, { persist: false })) {
      return;
    }
    selectStandardTemplate("", { persist: false });
    runWithTemplateApplying(() => {
      try {
        const raw = localStorage.getItem("scoreboard.standard.periods");
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            standardPeriodFields.forEach((field, idx) => {
              if (field && typeof arr[idx] === "number") {
                setStandardFieldValue(field, arr[idx]);
              }
            });
          }
        }
        const im = localStorage.getItem("scoreboard.standard.intermission");
        if (im != null && standardIntermissionField) {
          const parsed = parseInt(im, 10);
          if (!Number.isNaN(parsed)) {
            setStandardFieldValue(standardIntermissionField, parsed);
          }
        }
      } catch (_) {
        /* ignore storage issues */
      }
    });
  };

  const markStandardCustomFromManualEdit = () => {
    if (applyingStandardTemplate) return;
    if (!standardTemplateSelect || standardTemplateSelect.value === "") return;
    selectStandardTemplate("", { persist: true });
  };

  if (standardTemplateSelect) {
    standardTemplateSelect.addEventListener("change", (e) => {
      const key = e.target.value || "";
      if (!key) {
        selectStandardTemplate("", { persist: true });
        loadStoredStandardValues();
        clearStandardErrors();
        return;
      }
      if (!applyStandardTemplate(key)) {
        selectStandardTemplate("", { persist: true });
      }
    });
  }

  standardPeriodFields.forEach((field) => {
    if (!field) return;
    field.addEventListener("input", markStandardCustomFromManualEdit);
  });
  if (standardIntermissionField) {
    standardIntermissionField.addEventListener(
      "input",
      markStandardCustomFromManualEdit,
    );
  }

  const newGameBtn = $("#new-game");
  if (newGameBtn)
    newGameBtn.addEventListener("click", () => {
      clearStandardErrors();
      const periods = [];
      let error = false;
      for (let i = 0; i <= 3; i++) {
        const field = standardPeriodFields[i];
        if (!field) continue;
        const val = field.value.trim();
        if (i === 0 && val === "0") {
          periods[i] = 0;
          continue;
        }
        const n = parseInt(val, 10);
        if (!n) {
          field.closest(".form-group").classList.add("has-error");
          error = true;
        } else {
          periods[i] = n;
        }
      }
      let intermission = null;
      if (standardIntermissionField) {
        const raw = standardIntermissionField.value.trim();
        const n = parseInt(raw, 10);
        if (Number.isNaN(n) || n < 0) {
          standardIntermissionField
            .closest(".form-group")
            .classList.add("has-error");
          error = true;
        } else {
          intermission = n;
        }
      }
      if (error) return;
      try {
        localStorage.setItem(
          "scoreboard.standard.periods",
          JSON.stringify(periods),
        );
        if (intermission != null) {
          localStorage.setItem(
            "scoreboard.standard.intermission",
            String(intermission),
          );
        }
        if (standardTemplateSelect) {
          const currentTpl = standardTemplateSelect.value || "";
          if (currentTpl) {
            localStorage.setItem("scoreboard.standard.template", currentTpl);
          } else {
            localStorage.removeItem("scoreboard.standard.template");
          }
        }
      } catch (_) {
        /* ignore storage issues */
      }
      const cfg = { periodLengths: periods };
      if (intermission != null) {
        cfg.intermissionDurationMinutes = intermission;
      }
      Server.createGame(cfg);
      Modals.hide($("#new-game-dialog"));
    });

  on(document, 'click', 'a[data-action="set-value"]', (e, trigger) => {
    e.preventDefault();
    const targetSel = trigger.dataset.target;
    const val = trigger.dataset.value || "";
    const input = $(targetSel);
    if (input) {
      input.value = String(val);
      const id = input.getAttribute ? input.getAttribute("id") : "";
      if (id === "intermission-minutes" || /^period-[0-3]$/.test(id || "")) {
        markStandardCustomFromManualEdit();
      }
    }
  });

  on(document, 'click', 'a[data-action="set-periods"]', (e, trigger) => {
    e.preventDefault();
    const val = trigger.dataset.value || "";
    ["#period-1", "#period-2", "#period-3"].forEach((sel) => {
      const input = $(sel);
      if (input) input.value = String(val);
    });
    markStandardCustomFromManualEdit();
  });

  return {
    clearStandardErrors,
    loadStoredStandardValues,
    markStandardCustomFromManualEdit,
  };
};
