// Query helpers (thin wrappers around native DOM APIs)
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const on = (el, type, selOrHandler, handler) => {
  if (!handler) {
    el.addEventListener(type, selOrHandler);
    return;
  }
  el.addEventListener(type, (e) => {
    const target = e.target.closest(selOrHandler);
    if (target && el.contains(target)) handler(e, target);
  });
};

export const createModalManager = ({ suppressHover, restoreHover } = {}) => {
  const suppress = typeof suppressHover === "function" ? suppressHover : () => {};
  const restore = typeof restoreHover === "function" ? restoreHover : () => {};

  const isVisible = (modal) =>
    modal && window.getComputedStyle(modal).display !== "none";

  const anyVisible = () =>
    Array.from(document.querySelectorAll(".modal")).some(isVisible);

  const show = (modal) => {
    if (!modal) return;
    const active =
      document.activeElement && document.activeElement !== document.body
        ? document.activeElement
        : null;
    if (active) modal.__trigger = active;
    if (modal.__trigger && typeof modal.__trigger.blur === "function") {
      try {
        modal.__trigger.blur();
      } catch (_) {
        /* ignore blur issues */
      }
    }
    modal.style.display = "block";
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("in");
    document.body.classList.add("modal-open");
  };

  const hide = (modal) => {
    if (!modal) return;
    modal.classList.remove("in");
    modal.setAttribute("aria-hidden", "true");
    modal.style.display = "none";
    if (!anyVisible()) document.body.classList.remove("modal-open");
    const trigger = modal.__trigger;
    modal.__trigger = null;
    restore(trigger);
    if (trigger && typeof trigger.focus === "function") {
      setTimeout(() => {
        try {
          trigger.focus();
        } catch (_) {
          /* ignore focus issues */
        }
      }, 0);
    }
  };

  const showById = (id) => show($(id.startsWith("#") ? id : `#${id}`));

  const init = () => {
    on(document, "click", '[data-toggle="modal"]', (e, trigger) => {
      e.preventDefault();
      const href = trigger.getAttribute("href");
      if (href) showById(href);
      if ((e.detail || 0) !== 0) {
        requestAnimationFrame(() => {
          if (document.activeElement === trigger) {
            try {
              trigger.blur();
            } catch (_) {
              /* ignore blur issues */
            }
          }
        });
      }
      const modal = $(href);
      if (modal) {
        modal.__trigger = trigger;
        suppress(trigger);
      }
    });

    on(document, "click", '[data-dismiss="modal"]', (e, trigger) => {
      e.preventDefault();
      const modal = trigger.closest(".modal");
      if (modal) hide(modal);
    });

    on(document, "click", ".modal", (e, modal) => {
      if (e.target === modal) hide(modal);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" && e.key !== "Esc") return;
      const open = Array.from(
        document.querySelectorAll('.modal.in, .modal[aria-hidden="false"]'),
      ).filter(isVisible);
      if (!open.length) return;
      e.preventDefault();
      hide(open[open.length - 1]);
    });
  };

  return { init, show, hide, showById };
};
