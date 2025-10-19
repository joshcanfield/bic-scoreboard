import { $ } from "./dom.js";
import { State } from "./state.js";
import {
  digits2,
  formatClock,
  millisToMinSec,
  pad,
} from "./time-utils.js";

const formatPenalties = (team, penalties) =>
  penalties
    .map((p) => {
      const remaining =
        p.startTime > 0 ? Math.max(0, p.time - p.elapsed) : p.time;
      const rem = millisToMinSec(remaining);
      const off = millisToMinSec(p.offIceTime);
      const st = millisToMinSec(p.startTime);
      const durM = Math.floor(p.time / 60000);
      const durS = Math.floor((p.time / 1000) % 60);
      const detailsAttrs = `data-action="penalty-details" data-team="${team}" data-pid="${p.id}"
      data-player="${p.playerNumber}"
      data-period="${p.period}"
      data-duration="${formatClock(durM, durS)}"
      data-off="${formatClock(off.minutes, off.seconds)}"
      data-start="${formatClock(st.minutes, st.seconds)}"
      data-remaining="${formatClock(rem.minutes, rem.seconds)}"`;
      const offender = String(p.playerNumber);
      const serving =
        p.servingPlayerNumber != null && p.servingPlayerNumber !== undefined
          ? String(p.servingPlayerNumber)
          : offender;
      const pnHtml =
        serving && serving !== offender
          ? `<span class="pn" data-serving="${serving}">${offender}</span>`
          : `<span class="pn">${offender}</span>`;
      return `<tr>
      <td>${p.period}</td>
      <td>${pnHtml}</td>
      <td>${formatClock(rem.minutes, rem.seconds)}</td>
      <td>
        <a href="#" ${detailsAttrs} title="Details">Details</a>
        &nbsp;|&nbsp;
        <a href="#" data-action="delete-penalty" data-team="${team}" data-pid="${p.id}">x</a>
      </td>
    </tr>`;
    })
    .join("");

const formatPenaltyPlaceholders = (count) => {
  if (count <= 0) return "";
  const mkCells = () => ["-", "-", "-", "-"].map((txt) => `<td>${txt}</td>`).join("");
  const emptyRow = () => `<tr class="placeholder">${mkCells()}</tr>`;
  return Array.from({ length: count })
    .map(emptyRow)
    .join("");
};

const renderPenaltyTable = (teamElem, teamKey, penalties) => {
  const listTBody = teamElem && teamElem.querySelector("tbody.list");
  const phTBody = teamElem && teamElem.querySelector("tbody.placeholders");
  const filtered = (penalties || []).filter((p) => {
    const remaining = p && p.startTime > 0 ? p.time - p.elapsed : p.time;
    return (remaining || 0) > 0;
  });
  if (listTBody) listTBody.innerHTML = formatPenalties(teamKey, filtered);
  const actual = filtered.length;
  const needed = Math.max(0, 2 - actual);
  if (phTBody) phTBody.innerHTML = formatPenaltyPlaceholders(needed);
};

const formatGoals = (goals) => {
  if (!Array.isArray(goals) || goals.length === 0) {
    return '<tr class="placeholder"><td colspan="4">No goals yet</td></tr>';
  }
  return goals
    .map((g) => {
      const safeTime = typeof g.time === "number" ? Math.max(0, g.time) : 0;
      const tm = millisToMinSec(safeTime);
      const timeText = formatClock(tm.minutes, tm.seconds);
      const period = g.period === 0 || g.period ? g.period : "-";
      const scorer =
        g.playerNumber === 0 || g.playerNumber ? g.playerNumber : "-";
      const primary =
        g.primaryAssistNumber === 0 || g.primaryAssistNumber
          ? g.primaryAssistNumber
          : g.assistNumber && g.assistNumber > 0
            ? g.assistNumber
            : null;
      const secondary =
        g.secondaryAssistNumber === 0 || g.secondaryAssistNumber
          ? g.secondaryAssistNumber
          : null;
      const assists = [];
      if (primary !== null && primary !== undefined) assists.push(primary);
      if (secondary !== null && secondary !== undefined) assists.push(secondary);
      const assistsText = assists.length
        ? assists.map(String).join(" / ")
        : "&ndash;";
      const idAttr = g.id === 0 || g.id ? ` data-goal-id="${String(g.id)}"` : "";
      return `<tr${idAttr}>
      <td>${period}</td>
      <td>${timeText}</td>
      <td>${scorer}</td>
      <td>${assistsText}</td>
    </tr>`;
    })
    .join("");
};

const renderGoalTable = (teamElem, goals) => {
  if (!teamElem) return;
  const listTBody = teamElem.querySelector("tbody.goal-list");
  if (!listTBody) return;
  listTBody.innerHTML = formatGoals(goals || []);
};

export const createRenderer = ({ onPowerStateChange } = {}) => {
  const renderUpdate = (data) => {
    Object.assign(State, {
      time: data.time,
      running: data.running,
      period: data.period,
      periodLengthMillis: data.periodLength * 60 * 1000,
      home: data.home,
      away: data.away,
      scoreboardOn: data.scoreboardOn,
      buzzerOn: data.buzzerOn,
    });

    const home = $("#home");
    const away = $("#away");

    renderPenaltyTable(home, "home", data.home.penalties);
    renderPenaltyTable(away, "away", data.away.penalties);
    renderGoalTable(home, data.home.goals);
    renderGoalTable(away, data.away.goals);

    const { minutes, seconds } = millisToMinSec(State.time);
    const clockText = document.getElementById("clock-text");
    if (clockText) clockText.textContent = `${pad(minutes, 2)}:${pad(seconds, 2)}`;

    let elapsedText = "";
    if (State.periodLengthMillis > 0) {
      const elapsed = State.periodLengthMillis - State.time;
      const em = Math.floor(elapsed / 60000);
      const es = Math.floor((elapsed / 1000) % 60);
      if (em > 0) elapsedText += `${em} minute${em === 1 ? "" : "s"}`;
      if (elapsedText) elapsedText += " and ";
      elapsedText += `${es} seconds`;
    } else {
      elapsedText = "\u00a0";
    }
    const clockMoment = $("#clock-moment");
    if (clockMoment) clockMoment.innerHTML = elapsedText;

    const periodDigit = document.querySelector("#period .digit");
    if (periodDigit) periodDigit.textContent = State.period;

    const toggle = document.getElementById("clock-toggle");
    if (toggle) {
      const icon = toggle.querySelector(".glyphicon");
      const label = toggle.querySelector(".cta-text");
      if (State.running) {
        if (icon) icon.className = "glyphicon glyphicon-pause";
        if (label) label.textContent = "Pause";
      } else {
        if (icon) icon.className = "glyphicon glyphicon-play";
        if (label) label.textContent = "Start";
      }
    }

    const homeScoreText = document.getElementById("home-score");
    const awayScoreText = document.getElementById("away-score");
    const hd = digits2(data.home.score);
    const ad = digits2(data.away.score);
    if (homeScoreText) homeScoreText.textContent = `${hd[0]}${hd[1]}`;
    if (awayScoreText) awayScoreText.textContent = `${ad[0]}${ad[1]}`;

    const homeShots = document.getElementById("home-shots");
    const awayShots = document.getElementById("away-shots");
    if (homeShots) homeShots.textContent = String(data.home.shots || 0);
    if (awayShots) awayShots.textContent = String(data.away.shots || 0);

    if (typeof onPowerStateChange === "function") {
      onPowerStateChange(!!data.scoreboardOn);
    }
    document.body.classList.toggle("buzzer", !!data.buzzerOn);
  };

  return { renderUpdate };
};
