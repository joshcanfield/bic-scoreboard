import { $ } from "./dom.js";

export const initNavbarControls = ({ Server, State }) => {
  const buzzer = $("#buzzer");
  if (buzzer) buzzer.addEventListener("click", () => Server.buzzer());

  const clockStart = $("#clock-start");
  if (clockStart) clockStart.addEventListener("click", () => Server.startClock());

  const clockPause = $("#clock-pause");
  if (clockPause) clockPause.addEventListener("click", () => Server.pauseClock());

  const periodUp = $(".period-up");
  if (periodUp)
    periodUp.addEventListener("click", () => Server.setPeriod(State.period + 1));

  const periodDown = $(".period-down");
  if (periodDown)
    periodDown.addEventListener("click", () =>
      Server.setPeriod(Math.max(0, State.period - 1)),
    );

  const clockToggle = document.getElementById("clock-toggle");
  if (clockToggle) {
    clockToggle.addEventListener("click", () => {
      if (State.running) Server.pauseClock();
      else Server.startClock();
    });
  }
};
