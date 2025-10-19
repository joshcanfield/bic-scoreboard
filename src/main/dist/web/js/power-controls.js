import { $ } from "./dom.js";

export const initPowerControls = ({ api, State, Server, Modals }) => {
  const portStepper = { ports: [], index: 0, active: false };
  let notOnCountdownTimer = null;

  const refreshPortDialog = () => {
    const wrap = $("#connect-portNames");
    if (wrap) wrap.innerHTML = "";
  };

  const renderPortPills = (activeIndex = 0) => {
    const wrap = $("#connect-portNames");
    if (!wrap) return;
    wrap.innerHTML = "";
    (portStepper.ports || []).forEach((name, i) => {
      const pill = document.createElement("span");
      pill.className =
        "port-pill" +
        (i === activeIndex ? " active" : "") +
        (i < activeIndex ? " tried" : "");
      pill.textContent = name;
      wrap.appendChild(pill);
    });
  };

  const startNotOnCountdown = (btn, seconds = 5, nextName = "") => {
    if (!btn) return;
    if (notOnCountdownTimer) {
      clearInterval(notOnCountdownTimer);
      notOnCountdownTimer = null;
    }
    let remaining = seconds;
    const waitingText = "Waiting";
    btn.disabled = true;
    btn.textContent = `${waitingText} (${remaining})`;
    notOnCountdownTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(notOnCountdownTimer);
        notOnCountdownTimer = null;
        btn.disabled = false;
        btn.textContent = nextName ? `Try ${nextName}` : "Not On";
      } else {
        btn.textContent = `${waitingText} (${remaining})`;
      }
    }, 1000);
  };

  const setConnectMessage = (msg) => {
    const el = $("#connect-message");
    if (el) el.textContent = msg || "";
  };

  let setPowerUI = () => {};
  let updatePowerFromServer = () => {};

  const tryPortAtIndex = async (i) => {
    const modal = $("#scoreboard-connect");
    const prog = modal.querySelector(".progress");
    const notOnBtn = $("#not-on");
    const confirmBtn = $("#confirm-on");
    const retryBtn = $("#retry-ports");
    const name = portStepper.ports[i];
    if (!name) {
      if (prog) prog.style.display = "none";
      setConnectMessage("No more ports to try. Check USB/power and cables.");
      portStepper.active = false;
      try {
        Server.powerOff();
      } catch (_) {
        /* ignore */
      }
      setPowerUI("off");
      renderPortPills(portStepper.ports.length);
      if (notOnBtn) {
        if (notOnCountdownTimer) {
          clearInterval(notOnCountdownTimer);
          notOnCountdownTimer = null;
        }
        notOnBtn.style.display = "none";
        notOnBtn.disabled = false;
        notOnBtn.textContent = "Not On";
      }
      return;
    }
    renderPortPills(i);
    if (prog) prog.style.display = "";
    setConnectMessage(`Trying ${name}. Did the scoreboard turn on?`);
    try {
      const resp = await api.post("portName", { portName: name });
      if (resp) {
        State.portNames = resp.portNames || State.portNames;
        State.currentPort = resp.currentPort || name;
      } else {
        State.currentPort = name;
      }
      try {
        Server.powerOff();
      } catch (_) {
        /* ignore */
      }
      try {
        Server.powerOn();
      } catch (_) {
        /* ignore */
      }
    } finally {
      setTimeout(() => {
        if (prog) prog.style.display = "none";
      }, 400);
    }
    if (notOnBtn) {
      notOnBtn.style.display = "";
      if (retryBtn) retryBtn.style.display = "none";
      if (confirmBtn) {
        confirmBtn.textContent = "It's On!";
        confirmBtn.className = "btn btn-success";
      }
      const nextName = portStepper.ports[i + 1] || "";
      startNotOnCountdown(notOnBtn, 5, nextName);
    }
  };

  const resetConnectDialogUI = () => {
    const notOnBtn = $("#not-on");
    const confirmBtn = $("#confirm-on");
    const retryBtn = $("#retry-ports");
    const giveUpBtn = $("#give-up");
    if (notOnCountdownTimer) {
      clearInterval(notOnCountdownTimer);
      notOnCountdownTimer = null;
    }
    setConnectMessage("");
    if (retryBtn) retryBtn.style.display = "none";
    if (giveUpBtn) giveUpBtn.style.display = "none";
    if (confirmBtn) {
      confirmBtn.style.display = "";
      confirmBtn.textContent = "It's On!";
      confirmBtn.className = "btn btn-success";
    }
    if (notOnBtn) {
      notOnBtn.style.display = "none";
      notOnBtn.disabled = false;
      notOnBtn.textContent = "Not On";
    }
    renderPortPills(0);
  };

  const beginPortStepper = async () => {
    portStepper.active = true;
    const ports = [...(State.portNames || [])];
    const curr = State.currentPort;
    if (curr) {
      const idx = ports.indexOf(curr);
      if (idx > 0) {
        ports.splice(idx, 1);
        ports.unshift(curr);
      }
    }
    portStepper.ports = ports;
    portStepper.index = 0;
    resetConnectDialogUI();
    Modals.showById("#scoreboard-connect");
    await tryPortAtIndex(portStepper.index);
  };

  const powerBtn = $("#power-btn");
  const powerStatus = $("#power-status");
  let powerState = "off";

  setPowerUI = (state, text) => {
    powerState = state;
    switch (state) {
      case "off":
        if (powerBtn) powerBtn.disabled = false;
        if (powerStatus) {
          powerStatus.className = "label label-danger";
          powerStatus.textContent = "Scoreboard Off";
        }
        break;
      case "connecting":
        if (powerBtn) powerBtn.disabled = true;
        if (powerStatus) {
          powerStatus.className = "label label-info";
          powerStatus.textContent = text || "Opening port.";
        }
        break;
      case "assumed":
        if (powerBtn) powerBtn.disabled = true;
        if (powerStatus) {
          powerStatus.className = "label label-warning";
          powerStatus.textContent = "Assumed On - confirm";
        }
        break;
      case "on":
        if (powerBtn) powerBtn.disabled = false;
        if (powerStatus) {
          powerStatus.className = "label label-success";
          powerStatus.textContent = "Scoreboard On";
        }
        break;
      case "error":
        if (powerBtn) powerBtn.disabled = false;
        if (powerStatus) {
          powerStatus.className = "label label-danger";
          powerStatus.textContent = text || "Error";
        }
        break;
    }
  };

  updatePowerFromServer = (on) => {
    if (powerState === "connecting" || powerState === "assumed") return;
    setPowerUI(on ? "on" : "off");
  };

  setPowerUI(State.scoreboardOn ? "on" : "off");

  if (powerBtn)
    powerBtn.addEventListener("click", async () => {
      if (powerState === "on") {
        setPowerUI("connecting", "Turning off.");
        try {
          Server.powerOff();
        } catch (_) {
          /* ignore */
        }
        setTimeout(() => setPowerUI("off"), 500);
        return;
      }
      setPowerUI("connecting", "Opening port.");
      try {
        const data = await api.get("portNames");
        State.portNames = data.portNames || [];
        State.currentPort = data.currentPort || "";
        refreshPortDialog();
      } catch (_) {
        /* ignore */
      }
      if (State.portNames && State.portNames.length) {
        setPowerUI("assumed");
        await beginPortStepper();
      } else {
        setPowerUI("error", "No serial ports found");
        resetConnectDialogUI();
        Modals.showById("#scoreboard-connect");
        setConnectMessage(
          "No serial ports detected. Check USB/power and try again.",
        );
      }
    });

  const confirmOn = (state) => {
    if (state === "on") setPowerUI("on");
  };

  document.addEventListener("click", async (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    const confirmEl = target.closest("#confirm-on");
    if (confirmEl) {
      confirmOn("on");
    }

    const notOnEl = target.closest("#not-on");
    if (notOnEl) {
      try {
        Server.powerOff();
      } catch (_) {
        /* ignore */
      }
      if (notOnCountdownTimer) {
        clearInterval(notOnCountdownTimer);
        notOnCountdownTimer = null;
      }
      const confirmBtn = $("#confirm-on");
      const retryBtn = $("#retry-ports");
      const giveUpBtn = $("#give-up");
      const notOnBtn = $("#not-on");
      if (portStepper.active) {
        const isLast = portStepper.index >= portStepper.ports.length - 1;
        if (!isLast) {
          portStepper.index += 1;
          await tryPortAtIndex(portStepper.index);
        } else {
          setConnectMessage(
            "No more ports to try. You can Retry or Give Up.",
          );
          if (confirmBtn) confirmBtn.style.display = "";
          if (retryBtn) retryBtn.style.display = "";
          if (giveUpBtn) giveUpBtn.style.display = "";
          if (notOnBtn) notOnBtn.style.display = "none";
        }
      } else {
        const modal = $("#scoreboard-connect");
        Modals.hide(modal);
        setPowerUI("off");
      }
    }

    const retryEl = target.closest("#retry-ports");
    if (retryEl) {
      const notOnBtn = $("#not-on");
      const confirmBtn = $("#confirm-on");
      const retryBtn = $("#retry-ports");
      const giveUpBtn = $("#give-up");
      if (retryBtn) retryBtn.style.display = "none";
      if (giveUpBtn) giveUpBtn.style.display = "none";
      if (notOnBtn) {
        notOnBtn.style.display = "";
        notOnBtn.disabled = true;
      }
      if (confirmBtn) {
        confirmBtn.style.display = "";
        confirmBtn.textContent = "It's On!";
        confirmBtn.className = "btn btn-success";
      }
      try {
        const data = await api.get("portNames");
        State.portNames = data.portNames || [];
        State.currentPort = data.currentPort || "";
      } catch (_) {
        /* ignore */
      }
      setPowerUI("assumed");
      await beginPortStepper();
    }

    const giveUpEl = target.closest("#give-up");
    if (giveUpEl) {
      const modal = $("#scoreboard-connect");
      try {
        Server.powerOff();
      } catch (_) {
        /* ignore */
      }
      setPowerUI("off");
      Modals.hide(modal);
    }
  });

  return {
    beginPortStepper,
    refreshPortDialog,
    resetConnectDialogUI,
    renderPortPills,
    setPowerUI,
    updatePowerFromServer,
  };
};
