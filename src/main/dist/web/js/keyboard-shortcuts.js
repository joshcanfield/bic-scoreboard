import { TeamLayout } from "./team-layout.js";

const DEFAULT_SHORTCUTS = {
  buzzer: ["b"],
  clockToggle: ["Space"],
  clockStart: ["ArrowUp", "w"],
  clockStop: ["ArrowDown", "s"],
  homeShotUp: ["q"],
  homeShotDown: ["Shift+q"],
  awayShotUp: ["e"],
  awayShotDown: ["Shift+e"],
  homeGoal: ["ArrowLeft", "a"],
  awayGoal: ["ArrowRight", "d"],
  homePenalty: ["p"],
  awayPenalty: ["Shift+p"],
  periodUp: ["Control+ArrowUp"],
  periodDown: ["Control+ArrowDown"],
};

const LEFT_COLUMN_ACTIONS = new Set([
  "homeShotUp",
  "homeShotDown",
  "homeGoal",
  "homePenalty",
]);
const RIGHT_COLUMN_ACTIONS = new Set([
  "awayShotUp",
  "awayShotDown",
  "awayGoal",
  "awayPenalty",
]);

const normalizeKey = (key) => String(key).trim();
const canonicalKey = (rawKey) => {
  const key = String(rawKey).trim();
  if (!key) return "";
  const lower = key.toLowerCase();
  if (lower === "space" || lower === "spacebar") return " ";
  if (key.length === 1) return lower;
  return lower;
};

const normalizeModifiers = (parts) => {
  const mods = parts.slice(0, -1).map((p) => p.toLowerCase().trim());
  const key = parts[parts.length - 1].trim();
  return {
    shift: mods.includes("shift"),
    ctrl: mods.includes("control") || mods.includes("ctrl"),
    alt: mods.includes("alt"),
    key,
  };
};

const parseShortcut = (shortcut) => {
  const parts = normalizeKey(shortcut).split("+");
  if (parts.length === 1) {
    return { shift: false, ctrl: false, alt: false, key: canonicalKey(parts[0]) };
  }
  const mods = normalizeModifiers(parts);
  return { ...mods, key: canonicalKey(mods.key) };
};

const eventMatchesShortcut = (e, parsed) =>
  canonicalKey(e.key) === parsed.key &&
  e.shiftKey === parsed.shift &&
  e.ctrlKey === parsed.ctrl &&
  e.altKey === parsed.alt;

const ensureArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

export const createKeyboardShortcuts = ({ Server, State, openGoalModal }) => {
  let shortcuts = { ...DEFAULT_SHORTCUTS };
  let shortcutBindings = [];
  let loadPromise = Promise.resolve();
  let loadError = false;

  const teamForShortcutAction = (action) => {
    if (LEFT_COLUMN_ACTIONS.has(action)) return TeamLayout.getTeamForSide("left");
    if (RIGHT_COLUMN_ACTIONS.has(action))
      return TeamLayout.getTeamForSide("right");
    return null;
  };

  const buildBindings = () => {
    shortcutBindings = [];
    Object.entries(shortcuts).forEach(([action, bindingValue]) => {
      ensureArray(bindingValue).forEach((binding) => {
        if (!binding) return;
        try {
          const parsed = parseShortcut(binding);
          shortcutBindings.push({ action, shortcut: binding, parsed });
        } catch (err) {
          console.warn(`Invalid shortcut for ${action}: ${binding}`, err);
        }
      });
    });
  };

  const loadShortcuts = async () => {
    loadError = false;
    try {
      const res = await fetch("/keyboard-shortcuts.json");
      if (!res.ok) throw new Error("Failed to load keyboard shortcuts");
      const data = await res.json();
      shortcuts = { ...DEFAULT_SHORTCUTS, ...data };
      console.log("Keyboard shortcuts loaded:", shortcuts);
    } catch (err) {
      console.warn("Failed to load keyboard-shortcuts.json, using defaults:", err);
      shortcuts = { ...DEFAULT_SHORTCUTS };
      loadError = true;
    }
    buildBindings();
  };

  const handleAction = (action, modalOpen) => {
    if (
      modalOpen &&
      !["buzzer", "clockToggle", "clockStart", "clockStop"].includes(action)
    )
      return;

    const team = teamForShortcutAction(action);
    switch (action) {
      case "buzzer":
        Server.buzzer();
        break;
      case "clockToggle":
        if (State.running) {
          State.running = false;
          Server.pauseClock();
        } else {
          State.running = true;
          Server.startClock();
        }
        break;
      case "clockStart":
        if (!State.running) {
          State.running = true;
          Server.startClock();
        }
        break;
      case "clockStop":
        if (State.running) {
          State.running = false;
          Server.pauseClock();
        }
        break;
      case "homeShotUp":
      case "awayShotUp":
        if (!team) return;
        Server.shot({ team });
        break;
      case "homeShotDown":
      case "awayShotDown":
        if (!team) return;
        Server.undoShot({ team });
        break;
      case "homeGoal":
      case "awayGoal":
        if (!team) return;
        openGoalModal(team);
        break;
      case "homePenalty":
      case "awayPenalty":
        if (!team) return;
        {
          const penaltyBtn = document.querySelector(
            `a[data-team="${team}"][href="#add-penalty"]`,
          );
          if (penaltyBtn) penaltyBtn.click();
        }
        break;
      case "periodUp":
        Server.setPeriod(State.period + 1);
        break;
      case "periodDown":
        Server.setPeriod(Math.max(0, State.period - 1));
        break;
      default:
        console.warn("Unknown action:", action);
    }
  };

  const handleKeyPress = (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    const modalOpen = document.body.classList.contains("modal-open");
    for (const { action, parsed } of shortcutBindings) {
      if (eventMatchesShortcut(e, parsed)) {
        e.preventDefault();
        handleAction(action, modalOpen);
        return;
      }
    }
  };

  const cloneShortcuts = () => {
    const cloned = {};
    Object.entries(shortcuts).forEach(([action, value]) => {
      if (!value) return;
      cloned[action] = ensureArray(value).map((binding) => String(binding));
    });
    return cloned;
  };

  const init = async () => {
    loadPromise = loadShortcuts();
    await loadPromise;
    document.addEventListener("keydown", handleKeyPress);
  };

  const whenReady = () => loadPromise;
  const hadError = () => loadError;

  return {
    init,
    getShortcuts: () => cloneShortcuts(),
    whenReady,
    hadError,
  };
};
