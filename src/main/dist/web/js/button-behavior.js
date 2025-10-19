// Consistent pressed/focus behaviour for control buttons
export const createButtonFocusManager = () => {
  const simulatePointerLeave = (el) => {
    if (!el || typeof el.dispatchEvent !== "function") return;
    const doc = el.ownerDocument || document;
    const related = doc.body || null;
    ["pointerout", "pointerleave", "mouseout", "mouseleave"].forEach((type) => {
      try {
        const evt = new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          relatedTarget: related,
        });
        el.dispatchEvent(evt);
      } catch (_) {
        try {
          const evt = doc.createEvent("MouseEvent");
          evt.initMouseEvent(
            type,
            true,
            true,
            doc.defaultView,
            0,
            0,
            0,
            0,
            0,
            false,
            false,
            false,
            false,
            0,
            related,
          );
          el.dispatchEvent(evt);
        } catch (__) {
          /* ignore */
        }
      }
    });
  };

  const suppressHover = (el) => {
    if (!el || !el.style || el.__hoverSuppressed) return;
    el.__hoverSuppressed = { pointerEvents: el.style.pointerEvents };
    el.style.pointerEvents = "none";
  };

  const restoreHover = (el) => {
    if (!el || !el.style || !el.__hoverSuppressed) return;
    const prev = el.__hoverSuppressed.pointerEvents;
    if (prev === undefined || prev === null || prev === "") {
      el.style.removeProperty("pointer-events");
    } else {
      el.style.pointerEvents = prev;
    }
    delete el.__hoverSuppressed;
  };

  const scheduleBlur = (el) => {
    if (!el) return;
    simulatePointerLeave(el);
    requestAnimationFrame(() => {
      try {
        el.blur();
      } catch (_) {
        /* ignore */
      }
    });
  };

  let pressedButton = null;

  const rememberPressedButton = (e) => {
    const btn = e.target && e.target.closest(".btn");
    if (btn) pressedButton = btn;
  };

  const releasePressedButton = () => {
    if (!pressedButton) return;
    const btn = pressedButton;
    pressedButton = null;
    scheduleBlur(btn);
  };

  const init = () => {
    if ("onpointerdown" in window) {
      document.addEventListener("pointerdown", rememberPressedButton, true);
      document.addEventListener("pointerup", releasePressedButton, true);
      document.addEventListener("pointercancel", releasePressedButton, true);
    } else {
      document.addEventListener("mousedown", rememberPressedButton, true);
      document.addEventListener("mouseup", releasePressedButton, true);
      document.addEventListener("touchstart", rememberPressedButton, true);
      document.addEventListener("touchend", releasePressedButton, true);
      document.addEventListener("touchcancel", releasePressedButton, true);
    }
  };

  return { init, scheduleBlur, suppressHover, restoreHover };
};
