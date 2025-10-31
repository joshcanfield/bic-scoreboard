import { $, $$, on } from "./dom.js";

export const initScoreControls = ({
  api,
  Server,
  State,
  Modals,
  millisToMinSec,
  formatClock,
  parseClockMillis,
  scheduleBlur,
}) => {
  const goalModal = document.getElementById("add-goal");

  const clearGoalErrors = () => {
    if (!goalModal) return;
    goalModal
      .querySelectorAll(".form-group")
      .forEach((group) => group.classList.remove("has-error"));
  };

  const setGoalModalTeam = (team) => {
    if (!goalModal) return;
    goalModal.dataset.team = team || "";
    const title = goalModal.querySelector(".modal-title");
    if (title) title.textContent = team === "away" ? "Add Away Goal" : "Add Home Goal";
    const header = goalModal.querySelector(".modal-header");
    if (header) {
      header.classList.add("goal-modal-header");
      header.classList.remove("home", "away");
      header.classList.add(team === "away" ? "away" : "home");
    }
  };

  const openGoalModal = (team) => {
    if (!goalModal) return;
    clearGoalErrors();
    setGoalModalTeam(team);
    const periodField = document.getElementById("add-goal-period");
    const timeField = document.getElementById("add-goal-time");
    const playerField = document.getElementById("add-goal-player");
    const assist1Field = document.getElementById("add-goal-assist1");
    const assist2Field = document.getElementById("add-goal-assist2");
    if (periodField) periodField.value = String(State.period || 0);
    if (timeField) {
      const { minutes, seconds } = millisToMinSec(State.time);
      timeField.value = formatClock(minutes, seconds);
    }
    if (playerField) playerField.value = "";
    if (assist1Field) assist1Field.value = "";
    if (assist2Field) assist2Field.value = "";
    Modals.show(goalModal);
    setTimeout(() => {
      if (playerField) playerField.focus();
    }, 0);
  };

  const submitGoal = async () => {
    if (!goalModal) return;
    const team = goalModal.dataset.team;
    if (!team) return;
    const periodField = document.getElementById("add-goal-period");
    const timeField = document.getElementById("add-goal-time");
    const playerField = document.getElementById("add-goal-player");
    const assist1Field = document.getElementById("add-goal-assist1");
    const assist2Field = document.getElementById("add-goal-assist2");
    clearGoalErrors();

    let hasError = false;

    const markError = (field) => {
      if (field && field.closest) {
        const group = field.closest(".form-group");
        if (group) group.classList.add("has-error");
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
      if (playerRaw === "" || Number.isNaN(playerNumber)) {
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
      time: timeMillis,
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
      console.warn("Failed to add goal", err);
    }
  };

  if (goalModal) {
    const form = goalModal.querySelector("form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        submitGoal();
      });
    }
    const submitBtn = document.getElementById("add-goal-submit");
    if (submitBtn) {
      submitBtn.addEventListener("click", (e) => {
        e.preventDefault();
        submitGoal();
      });
    }
  }

  $$(".score-up").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const team = e.currentTarget.dataset.team;
      if (!team) return;
      openGoalModal(team);
      if ((e.detail || 0) !== 0 && scheduleBlur) scheduleBlur(e.currentTarget);
    }),
  );

  $$(".score-down").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const team = e.currentTarget.dataset.team;
      if (!team) return;
      api.del(`${team}/goal`).catch(() => {});
    }),
  );

  const blurTarget = (event) => {
    const target = event.currentTarget;
    if (target && typeof target.blur === "function") {
      target.blur();
    }
  };

  $$(".shots-up").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const team = e.currentTarget.dataset.team;
      Server.shot({ team });
      blurTarget(e);
    }),
  );

  $$(".shots-down").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const team = e.currentTarget.dataset.team;
      Server.undoShot({ team });
      blurTarget(e);
    }),
  );

  on(document, "click", 'a[data-action="delete-penalty"]', (e, target) => {
    e.preventDefault();
    const team = target.dataset.team;
    const pid = target.dataset.pid;
    api.del(`${team}/penalty/${pid}`).catch(() => {});
  });

  on(document, "click", 'a[data-action="penalty-details"]', (e, target) => {
    e.preventDefault();
    const dlg = $("#penalty-details");
    if (!dlg) return;
    const set = (sel, val) => {
      const el = sel ? dlg.querySelector(sel) : null;
      if (el) el.textContent = String(val || "");
    };
    set("#pd-team", (target.dataset.team || "").toUpperCase());
    set("#pd-period", target.dataset.period || "-");
    set("#pd-player", target.dataset.player || "-");
    set("#pd-duration", target.dataset.duration || "-");
    set("#pd-off", target.dataset.off || "-");
    set("#pd-start", target.dataset.start || "-");
    set("#pd-remaining", target.dataset.remaining || "-");
    Modals.show(dlg);
    if ((e.detail || 0) !== 0 && scheduleBlur) scheduleBlur(target);
  });

  return { openGoalModal };
};
