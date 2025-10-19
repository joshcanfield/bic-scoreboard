import { $, $$, on } from "./dom.js";

const prettyBinding = (binding) =>
  binding
    .replace(/\+/g, " + ")
    .replace("Control", "Ctrl")
    .replace("ArrowUp", "Up")
    .replace("ArrowDown", "Down")
    .replace("ArrowLeft", "Left")
    .replace("ArrowRight", "Right");

const formatShortcut = (shortcut) => {
  if (!shortcut) return "-";
  const bindings = Array.isArray(shortcut) ? shortcut : [shortcut];
  if (!bindings.length) return "-";
  return bindings.map(prettyBinding).join(" / ");
};

export const initGameDialogUi = (KeyboardShortcuts) => {
  const gameTab = $("#game-tab");
  if (gameTab) {
    on(gameTab, "click", 'a[role="tab"]', (e, link) => {
      e.preventDefault();
      $$("#game-tab li").forEach((li) => li.classList.remove("active"));
      link.parentElement.classList.add("active");
      const target = link.getAttribute("href");
      $$("#new-game-dialog .tab-content .tab-pane").forEach((pane) =>
        pane.classList.remove("active"),
      );
      $(target).classList.add("active");
    });
  }

  on(
    document,
    'click',
    'button[href="#keyboard-shortcuts-dialog"][data-toggle="modal"]',
    () => {
      const shortcuts = KeyboardShortcuts.getShortcuts();
      Object.entries(shortcuts).forEach(([action, shortcut]) => {
        const el = document.getElementById(`shortcut-${action}`);
        if (el) el.textContent = formatShortcut(shortcut);
      });
    },
  );
};
