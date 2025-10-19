import { $, on } from "./dom.js";

export const initClockDialog = ({
  api,
  Modals,
  State,
  parseClockMillis,
  millisToMinSec,
  formatClock,
}) => {
  const setClockDialog = $("#set-clock");
  if (!setClockDialog) return;

  setClockDialog.addEventListener("click", (e) => {
    const btn = e.target.closest("button.time");
    if (!btn) return;
    const time = String(btn.dataset.time);
    const millis = parseClockMillis(time);
    if (millis == null) return;
    api
      .put("", { time: millis })
      .then(() => Modals.hide(setClockDialog))
      .catch(() => {
        const err = setClockDialog.querySelector(".error");
        if (err) err.textContent = "Failed to update the time";
      });
  });

  const saveCustom = $("#save-custom-time");
  if (saveCustom)
    saveCustom.addEventListener("click", async () => {
      const custom = $("#custom-time").value;
      const millis = parseClockMillis(custom);
      const err = setClockDialog.querySelector(".error");
      if (!err) return;
      if (millis == null) {
        err.textContent = "Invalid time. Example 20:00";
        return;
      }
      try {
        await api.put("", { time: millis });
        Modals.hide(setClockDialog);
        err.textContent = "";
      } catch (_) {
        err.textContent = "Failed to update the time";
      }
    });

  on(document, 'click', 'a[href="#set-clock"][data-toggle="modal"]', () => {
    const { minutes, seconds } = millisToMinSec(State.time);
    $("#custom-time").value = formatClock(minutes, seconds);
    const err = setClockDialog.querySelector(".error");
    if (err) err.textContent = "";
  });
};
