/**
 * COORDINADOR PRINCIPAL DE LA APLICACIÓN
 * Enlace de controles de usuario, sincronización de métricas en tiempo real,
 * gestión de eventos e integración de modales pedagógicos.
 */

window.addEventListener("DOMContentLoaded", () => {
  const sim = window.capacitorSim;

  // DOM Controls
  const sliderVoltage = document.getElementById("slider-voltage");
  const sliderArea = document.getElementById("slider-area");
  const sliderDistance = document.getElementById("slider-distance");
  const badgeVoltage = document.getElementById("badge-voltage");
  const badgeArea = document.getElementById("badge-area");
  const badgeDistance = document.getElementById("badge-distance");

  const btnToggleSwitch = document.getElementById("btn-toggle-switch");
  const btnSwitchLabel = document.getElementById("btn-switch-label");
  const btnResetCharge = document.getElementById("btn-reset-charge");
  const circuitStateBadge = document.getElementById("circuit-state-badge");
  const circuitStateText = document.getElementById("circuit-state-text");

  // Metrics DOM elements
  const valCapacitance = document.getElementById("val-capacitance");
  const valCharge = document.getElementById("val-charge");
  const valChargeMax = document.getElementById("val-charge-max");
  const valVoltage = document.getElementById("val-voltage");
  const valVoltageStatus = document.getElementById("val-voltage-status");
  const valField = document.getElementById("val-field");
  const valSigma = document.getElementById("val-sigma");
  const valEnergy = document.getElementById("val-energy");

  // Speed Buttons
  const speedButtons = document.querySelectorAll(".speed-btn");

  // Layer Checkboxes
  const layerElectrons = document.getElementById("layer-electrons");
  const layerField = document.getElementById("layer-field");
  const layerEquipotentials = document.getElementById("layer-equipotentials");
  const layerCharges = document.getElementById("layer-charges");
  const layerSound = document.getElementById("layer-sound");
  const layerGraph = document.getElementById("layer-graph");
  const oscContainer = document.getElementById("oscilloscope-container");

  // Theory Modal Elements
  const btnOpenTheory = document.getElementById("btn-open-theory");
  const btnCloseTheory = document.getElementById("btn-close-theory");
  const btnTheoryClose = document.getElementById("btn-theory-close");
  const modalTheory = document.getElementById("modal-theory");

  /* -------------------------------------------------------------
     SYNCHRONIZE DASHBOARD METRICS
     ------------------------------------------------------------- */
  function updateDashboard() {
    if (!sim) return;

    // 1. Capacitancia C (en pF)
    const capPf = sim.capacitance * 1e12;
    valCapacitance.textContent = capPf.toFixed(2);

    // 2. Carga Acumulada Q(t) (en pC o nC)
    const chargePc = sim.charge * 1e12;
    const maxChargePc = sim.capacitance * sim.V0 * 1e12;
    valCharge.textContent = chargePc >= 1000 
      ? (chargePc / 1000).toFixed(3) + " nC" 
      : chargePc.toFixed(2);
    valChargeMax.textContent = `Máx: ${maxChargePc.toFixed(1)} pC`;

    // 3. Voltaje Medido V_C
    valVoltage.textContent = sim.voltage.toFixed(2);
    const eqPercent = Math.min(100, (sim.voltage / sim.V0) * 100);
    valVoltageStatus.textContent = `Equilibrio: ${eqPercent.toFixed(1)}%`;

    // 4. Campo Eléctrico E (en kV/m o V/m)
    const fieldKvm = sim.fieldE / 1000;
    valField.textContent = fieldKvm.toFixed(2);

    // 5. Densidad Superficial sigma (en nC/m^2)
    const sigmaNcm2 = sim.sigma * 1e9;
    valSigma.textContent = sigmaNcm2.toFixed(2);

    // 6. Energía Almacenada U (en nJ o pJ)
    const energyNj = sim.energy * 1e9;
    valEnergy.textContent = energyNj >= 1 
      ? energyNj.toFixed(3) 
      : (sim.energy * 1e12).toFixed(1) + " pJ";

    // 7. Estado del Circuito en la Barra de Estado
    const dot = circuitStateBadge.querySelector(".status-dot");
    dot.className = "status-dot";

    if (!sim.isClosed) {
      dot.classList.add("state-open");
      circuitStateText.textContent = sim.voltage > 0.05
        ? `Circuito Abierto (Carga Retenida: ${sim.voltage.toFixed(1)}V)`
        : "Circuito Abierto (Sin Corriente)";
      
      btnToggleSwitch.className = "btn btn-switch btn-switch-open";
      btnSwitchLabel.textContent = "Cerrar Interruptor";
    } else {
      btnToggleSwitch.className = "btn btn-switch btn-switch-closed";
      btnSwitchLabel.textContent = "Abrir Interruptor";

      if (sim.isEquilibrium) {
        dot.classList.add("state-equilibrium");
        circuitStateText.textContent = `Equilibrio Electrostático (V_C = V₀ = ${sim.V0.toFixed(1)}V, I = 0)`;
      } else {
        dot.classList.add("state-charging");
        circuitStateText.textContent = `Cargando Condensador... (I = ${(sim.current * 100).toFixed(0)}%)`;
      }
    }
  }

  window.updateUI = updateDashboard;

  /* -------------------------------------------------------------
     SLIDERS & PARAMETER LISTENERS
     ------------------------------------------------------------- */
  sliderVoltage.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    sim.V0 = val;
    badgeVoltage.textContent = `${val.toFixed(1)} V`;
    sim.recalculatePhysics();
    updateDashboard();
  });

  sliderArea.addEventListener("input", (e) => {
    const val = parseInt(e.target.value, 10);
    sim.areaCm2 = val;
    badgeArea.textContent = `${val} cm²`;
    sim.recalculatePhysics();
    updateDashboard();
  });

  sliderDistance.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    sim.distMm = val;
    badgeDistance.textContent = `${val.toFixed(1)} mm`;
    sim.recalculatePhysics();
    updateDashboard();
  });

  /* -------------------------------------------------------------
     SPEED SELECTOR
     ------------------------------------------------------------- */
  speedButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      speedButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const speed = parseFloat(btn.getAttribute("data-speed"));
      sim.speedFactor = speed;
      sim.recalculatePhysics();
    });
  });

  /* -------------------------------------------------------------
     LAYER TOGGLES
     ------------------------------------------------------------- */
  layerElectrons.addEventListener("change", (e) => {
    sim.layers.electrons = e.target.checked;
  });

  layerField.addEventListener("change", (e) => {
    sim.layers.field = e.target.checked;
  });

  layerEquipotentials.addEventListener("change", (e) => {
    sim.layers.equipotentials = e.target.checked;
  });

  layerCharges.addEventListener("change", (e) => {
    sim.layers.charges = e.target.checked;
  });

  layerSound.addEventListener("change", (e) => {
    sim.layers.sound = e.target.checked;
    if (!e.target.checked && sim.chargeGain) {
      sim.chargeGain.gain.setValueAtTime(0, sim.audioCtx?.currentTime || 0);
    }
  });

  layerGraph.addEventListener("change", (e) => {
    sim.layers.graph = e.target.checked;
    oscContainer.style.display = e.target.checked ? "flex" : "none";
  });

  /* -------------------------------------------------------------
     SWITCH & RESET ACTIONS
     ------------------------------------------------------------- */
  btnToggleSwitch.addEventListener("click", () => {
    sim.toggleSwitch();
    updateDashboard();
  });

  btnResetCharge.addEventListener("click", () => {
    sim.resetCharge();
    updateDashboard();
  });

  /* -------------------------------------------------------------
     THEORY MODAL LOGIC
     ------------------------------------------------------------- */
  function openTheory() {
    modalTheory.style.display = "flex";
    setTimeout(() => modalTheory.classList.add("show"), 10);
  }

  function closeTheory() {
    modalTheory.classList.remove("show");
    setTimeout(() => {
      modalTheory.style.display = "none";
    }, 250);
  }

  btnOpenTheory.addEventListener("click", openTheory);
  btnCloseTheory.addEventListener("click", closeTheory);
  btnTheoryClose.addEventListener("click", closeTheory);
  modalTheory.addEventListener("click", (e) => {
    if (e.target === modalTheory) closeTheory();
  });

  // Teclado: Escape para cerrar modales
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeTheory();
      if (window.quizController) window.quizController.close();
    }
    if (e.key === " " && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "BUTTON") {
      // Barra espaciadora para conmutar interruptor
      e.preventDefault();
      sim.toggleSwitch();
      updateDashboard();
    }
  });

  // Ticker periódico para sincronizar métricas a 30fps
  setInterval(updateDashboard, 33);
  updateDashboard();
});
