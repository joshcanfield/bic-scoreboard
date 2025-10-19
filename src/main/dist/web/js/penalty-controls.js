import { $, $$, on } from "./dom.js";

export const initPenaltyControls = ({
  api,
  State,
  Modals,
  millisToMinSec,
  formatClock,
  parseClockMillis,
  roundToSecond,
}) => {
  on(document, 'click', 'a[href="#add-penalty"][data-toggle="modal"]', (e, trigger) => {
    const team = trigger.dataset.team || "home";
    const dlg = $("#add-penalty");
    dlg.dataset.team = team;
    const title = dlg.querySelector(".modal-title");
    if (title) title.textContent = `${team} Penalty`;
    const { minutes, seconds } = millisToMinSec(State.time);
    $("#add-penalty-off_ice").value = formatClock(minutes, seconds);
    $("#add-penalty-time").value = "2:00";
    $("#add-penalty-serving").value = "";
    $("#add-penalty-player").value = "";
    $$("#add-penalty .modal-body .form-group").forEach((g) =>
      g.classList.remove("has-error"),
    );
  });

  const addPenalty = () => {
    const dlg = $("#add-penalty");
    const team = dlg.dataset.team;
    const playerField = $("#add-penalty-player");
    const servingField = $("#add-penalty-serving");
    const timeField = $("#add-penalty-time");
    const offField = $("#add-penalty-off_ice");
    $$("#add-penalty .modal-body .form-group").forEach((g) =>
      g.classList.remove("has-error"),
    );

    let error = false;
    const penalty = { servingPlayerNumber: servingField.value };
    penalty.playerNumber = playerField.value.trim();
    if (!penalty.playerNumber) {
      playerField.closest(".form-group").classList.add("has-error");
      error = true;
    }
    penalty.time = parseClockMillis(timeField.value.trim());
    if (!penalty.time) {
      timeField.closest(".form-group").classList.add("has-error");
      error = true;
    }
    penalty.offIceTime = parseClockMillis(offField.value.trim());
    if (!penalty.offIceTime) {
      offField.closest(".form-group").classList.add("has-error");
      error = true;
    }
    if (error) return;
    penalty.period = State.period;
    api.post(`${team}/penalty`, penalty).catch(() => {});
    Modals.hide(dlg);
  };

  const add2plus10 = () => {
    const dlg = $("#add-penalty");
    const team = dlg.dataset.team;
    const playerField = $("#add-penalty-player");
    const servingField = $("#add-penalty-serving");
    const offField = $("#add-penalty-off_ice");
    $$("#add-penalty .modal-body .form-group").forEach((g) =>
      g.classList.remove("has-error"),
    );

    let error = false;
    const player = playerField.value.trim();
    if (!player) {
      playerField.closest(".form-group").classList.add("has-error");
      error = true;
    }
    const serving = servingField.value.trim();
    if (!serving) {
      servingField.closest(".form-group").classList.add("has-error");
      error = true;
    }
    const off = parseClockMillis(offField.value.trim());
    if (!off) {
      offField.closest(".form-group").classList.add("has-error");
      error = true;
    }
    if (error) return;

    const base = { period: State.period, playerNumber: player };
    const p2 = Object.assign({}, base, {
      servingPlayerNumber: serving,
      time: 2 * 60 * 1000,
      offIceTime: off,
    });
    const p10 = Object.assign({}, base, {
      servingPlayerNumber: player,
      time: 10 * 60 * 1000,
      offIceTime: off,
      startTime: roundToSecond(State.time),
    });
    api.post(`${team}/penalty`, p2).catch(() => {});
    api.post(`${team}/penalty`, p10).catch(() => {});
    Modals.hide(dlg);
  };

  const addBtn = document.getElementById("add-penalty-add");
  if (addBtn) addBtn.addEventListener("click", addPenalty);

  const btn2plus10 = document.getElementById("add-penalty-2plus10");
  if (btn2plus10)
    btn2plus10.addEventListener("click", (e) => {
      e.preventDefault();
      add2plus10();
    });
};
