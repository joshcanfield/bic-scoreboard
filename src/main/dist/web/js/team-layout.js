// Manage which team (home/away) is on the left/right side of the UI
const STORAGE_KEY = "scoreboard.layout.leftTeam";

const readStoredLeft = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "away" ? "away" : "home";
  } catch (_) {
    return "home";
  }
};

const persistLeft = (leftTeam) => {
  try {
    localStorage.setItem(STORAGE_KEY, leftTeam);
  } catch (_) {
    /* ignore persistence issues */
  }
};

const applyDomOrder = (sides) => {
  const row = document.querySelector(".container > .row");
  const home = document.getElementById("home");
  const away = document.getElementById("away");
  const clock = document.getElementById("clock_box");
  if (!row || !home || !away || !clock) return;
  const leftEl = sides.left === "home" ? home : away;
  const rightEl = sides.left === "home" ? away : home;
  [leftEl, clock, rightEl].forEach((el) => {
    if (el && el.parentElement === row) row.appendChild(el);
  });
};

const updateBodyDataset = (sides) => {
  if (!document || !document.body) return;
  document.body.dataset.homeSide = sides.left === "home" ? "left" : "right";
  document.body.dataset.leftTeam = sides.left;
  document.body.dataset.rightTeam = sides.right;
};

const updateButtonState = (button, sides) => {
  if (!button) return;
  const homeSide = sides.left === "home" ? "left" : "right";
  const statusLabel =
    homeSide === "left"
      ? "Home currently on left. Swap sides."
      : "Home currently on right. Swap sides.";
  button.setAttribute("aria-pressed", homeSide === "right" ? "true" : "false");
  button.setAttribute("aria-label", statusLabel);
  button.setAttribute("title", statusLabel);
};

export const TeamLayout = (() => {
  let sides = { left: "home", right: "away" };
  let toggleButton = null;

  const apply = (leftTeam) => {
    const nextLeft = leftTeam === "away" ? "away" : "home";
    if (sides.left !== nextLeft) {
      sides = {
        left: nextLeft,
        right: nextLeft === "home" ? "away" : "home",
      };
      applyDomOrder(sides);
      persistLeft(sides.left);
      updateBodyDataset(sides);
      updateButtonState(toggleButton, sides);
      document.dispatchEvent(
        new CustomEvent("scoreboard:layout-changed", {
          detail: { ...sides },
        }),
      );
      return;
    }
    applyDomOrder(sides);
    updateBodyDataset(sides);
    updateButtonState(toggleButton, sides);
  };

  const toggle = () => {
    const nextLeft = sides.right;
    apply(nextLeft);
  };

  const init = () => {
    toggleButton = document.getElementById("swap-teams-btn");
    if (toggleButton) {
      toggleButton.addEventListener("click", (e) => {
        e.preventDefault();
        toggle();
        toggleButton.blur();
      });
    }
    apply(readStoredLeft());
  };

  const getTeamForSide = (side) => {
    if (side === "left" || side === "right") return sides[side];
    return "home";
  };

  const getSides = () => ({ ...sides });

  return { init, toggle, getTeamForSide, getSides };
})();
