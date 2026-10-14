/**
 * SIMULADOR DE CARGA DE UN CONDENSADOR IDEAL DE PLACAS PLANO-PARALELAS
 * Motor de física, renderizado en HTML5 Canvas, partículas de electrones,
 * cálculo de campos electrostáticos y sintetizador de audio Web Audio API.
 */

class CapacitorSimulation {
  constructor() {
    // Physical Constants
    this.EPSILON_0 = 8.854187817e-12; // F/m (Permitividad en vacío/aire)

    // User Interactive Parameters
    this.V0 = 6.0;             // Voltios (1V - 12V)
    this.areaCm2 = 250;        // cm^2 (100 - 500 cm^2)
    this.distMm = 4.0;         // mm (1 - 10 mm)
    this.speedFactor = 1.0;    // 1.0 (normal), 0.5 (lento), 2.0 (rápido), 999 (instantáneo)

    // Circuit States
    this.isClosed = false;     // Interruptor: false = Abierto, true = Cerrado
    this.isEquilibrium = false;// true cuando Vc alcanza V0
    this.chargeTime = 0;       // Tiempo acumulado de carga con interruptor cerrado (segundos)
    this.tauPedagogical = 0.88; // Constante de tiempo visual base (4 tau ~ 3.5s a velocidad 1.0x)

    // Dynamic Variables (calculated per frame)
    this.capacitance = 0;      // Faradios
    this.voltage = 0;          // V_C(t)
    this.charge = 0;           // Q(t) en Coulombs
    this.current = 0;          // I(t) en Amperios normalizados
    this.fieldE = 0;           // E en V/m
    this.sigma = 0;            // Densidad superficial Q/A en C/m^2
    this.energy = 0;           // Energía electrostática U en Joules

    // Layer Visibility
    this.layers = {
      electrons: true,
      field: true,
      equipotentials: true,
      charges: true,
      sound: true,
      graph: true
    };

    // Canvas & Rendering Contexts
    this.simCanvas = document.getElementById("sim-canvas");
    this.simCtx = this.simCanvas.getContext("2d");
    this.graphCanvas = document.getElementById("graph-canvas");
    this.graphCtx = this.graphCanvas.getContext("2d");

    // History for oscilloscope
    this.history = [];
    this.maxHistoryTime = 6.0; // 6 segundos de ventana temporal

    // Animation & Electron Particle System
    this.electrons = [];
    this.numElectrons = 38;
    this.lastTimestamp = performance.now();
    this.switchHitbox = null; // para interacción táctil/ratón directa con el interruptor

    // Audio System
    this.initAudio();

    // Setup Electron Particles along the circuit path
    this.initElectrons();

    // Initial resize and metrics calculation
    this.recalculatePhysics();
    this.handleResize();

    // Event listener for canvas clicks
    this.simCanvas.addEventListener("click", (e) => this.handleCanvasClick(e));
    this.simCanvas.addEventListener("mousemove", (e) => this.handleCanvasHover(e));
    window.addEventListener("resize", () => this.handleResize());
  }

  /* -------------------------------------------------------------
     WEB AUDIO API SYNTHESIZER
     ------------------------------------------------------------- */
  initAudio() {
    this.audioCtx = null;
    this.chargeOsc = null;
    this.chargeGain = null;

    this.ensureAudio = () => {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.audioCtx = new AudioContext();
          // Hum oscilador continuo para corriente de carga
          this.chargeOsc = this.audioCtx.createOscillator();
          this.chargeGain = this.audioCtx.createGain();
          this.chargeOsc.type = "sine";
          this.chargeOsc.frequency.setValueAtTime(110, this.audioCtx.currentTime);
          this.chargeGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
          this.chargeOsc.connect(this.chargeGain);
          this.chargeGain.connect(this.audioCtx.destination);
          this.chargeOsc.start();
        }
      }
      if (this.audioCtx && this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }
    };
  }

  playSwitchSound(closing) {
    if (!this.layers.sound) return;
    this.ensureAudio();
    if (!this.audioCtx) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = closing ? "triangle" : "square";
    osc.frequency.setValueAtTime(closing ? 380 : 260, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(closing ? 80 : 120, this.audioCtx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.18, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.09);
  }

  playSuccess() {
    if (!this.layers.sound) return;
    this.ensureAudio();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(0.12, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.25);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.26);
    });
  }

  playWarning() {
    if (!this.layers.sound) return;
    this.ensureAudio();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(120, now + 0.15);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  updateAudioHum(currentFraction) {
    if (!this.audioCtx || !this.chargeGain || !this.layers.sound) {
      if (this.chargeGain) this.chargeGain.gain.setValueAtTime(0, this.audioCtx?.currentTime || 0);
      return;
    }
    const targetGain = this.isClosed && !this.isEquilibrium ? Math.min(0.07, currentFraction * 0.07) : 0;
    const targetFreq = 110 + currentFraction * 140;
    this.chargeGain.gain.setTargetAtTime(targetGain, this.audioCtx.currentTime, 0.05);
    this.chargeOsc.frequency.setTargetAtTime(targetFreq, this.audioCtx.currentTime, 0.05);
  }

  /* -------------------------------------------------------------
     PHYSICS CALCULATIONS
     ------------------------------------------------------------- */
  recalculatePhysics() {
    const areaM2 = this.areaCm2 * 1e-4; // cm^2 -> m^2
    const distM = this.distMm * 1e-3;   // mm -> m

    // Capacidad C = (eps_0 * A) / d
    this.capacitance = (this.EPSILON_0 * areaM2) / distM;

    // Constante de tiempo pedagógica visual
    const effectiveTau = this.speedFactor >= 900 ? 0.0001 : (this.tauPedagogical / this.speedFactor);

    if (this.isClosed) {
      if (this.speedFactor >= 900) {
        // Modo ideal instantáneo
        this.voltage = this.V0;
        this.isEquilibrium = true;
        this.current = 0;
      } else {
        // Transitorio exponencial Vc(t) = V0 * (1 - e^(-t / tau))
        const exponent = -this.chargeTime / effectiveTau;
        this.voltage = this.V0 * (1 - Math.exp(exponent));
        this.current = Math.exp(exponent); // Fracción normalizada de corriente (1 -> 0)

        if (this.voltage >= this.V0 * 0.998) {
          this.voltage = this.V0;
          this.isEquilibrium = true;
          this.current = 0;
        } else {
          this.isEquilibrium = false;
        }
      }
    } else {
      // Con circuito abierto, la corriente es cero, pero el voltaje acumulado se retiene en el condensador
      this.current = 0;
      this.isEquilibrium = (this.voltage >= this.V0 * 0.998);
    }

    // Carga Q(t) = C * Vc(t)
    this.charge = this.capacitance * this.voltage;

    // Campo eléctrico uniforme E = Vc / d (V/m)
    this.fieldE = this.voltage / distM;

    // Densidad superficial sigma = Q / A (C/m^2)
    this.sigma = this.charge / areaM2;

    // Energía almacenada U = 0.5 * C * Vc^2 (Joules)
    this.energy = 0.5 * this.capacitance * Math.pow(this.voltage, 2);

    this.updateAudioHum(this.current);
  }

  /* -------------------------------------------------------------
     CANVAS SIZING (High-DPI Retina Crisp Rendering)
     ------------------------------------------------------------- */
  handleResize() {
    const dpr = window.devicePixelRatio || 1;

    // Sim Canvas
    const rect = this.simCanvas.parentElement.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height || 480;

    this.simCanvas.width = w * dpr;
    this.simCanvas.height = h * dpr;
    this.simCanvas.style.width = `${w}px`;
    this.simCanvas.style.height = `${h}px`;
    this.simCtx.resetTransform();
    this.simCtx.scale(dpr, dpr);
    this.simWidth = w;
    this.simHeight = h;

    // Graph Canvas
    const gRect = this.graphCanvas.parentElement.getBoundingClientRect();
    const gw = gRect.width;
    const gh = gRect.height || 140;

    this.graphCanvas.width = gw * dpr;
    this.graphCanvas.height = gh * dpr;
    this.graphCanvas.style.width = `${gw}px`;
    this.graphCanvas.style.height = `${gh}px`;
    this.graphCtx.resetTransform();
    this.graphCtx.scale(dpr, dpr);
    this.graphWidth = gw;
    this.graphHeight = gh;
  }

  /* -------------------------------------------------------------
     CIRCUIT GEOMETRY & ELECTRON PARTICLES
     ------------------------------------------------------------- */
  getCircuitGeometry() {
    const w = this.simWidth;
    const h = this.simHeight;

    // Centrado y márgenes adaptativos
    const leftX = Math.max(70, w * 0.12);
    const rightX = Math.min(w - 70, w * 0.88);
    const topY = Math.max(50, h * 0.15);
    const bottomY = Math.min(h - 50, h * 0.85);

    // Batería en el lado izquierdo
    const batteryX = leftX;
    const batteryCenterY = (topY + bottomY) / 2;
    const batteryHeight = 85;

    // Interruptor en el cable superior
    const switchStartX = leftX + (rightX - leftX) * 0.32;
    const switchEndX = leftX + (rightX - leftX) * 0.48;
    const switchY = topY;

    // Condensador en el lado derecho
    const capacitorCenterX = rightX - (rightX - leftX) * 0.16;
    
    // Escala gráfica de las placas según Área (100 - 500 cm^2 -> ancho visual 110px a 240px)
    const plateWidth = 110 + ((this.areaCm2 - 100) / 400) * 140;
    const plateThickness = 14;

    // Separación gráfica según Distancia (1 - 10 mm -> gap 40px a 140px)
    const plateGap = 42 + ((this.distMm - 1) / 9) * 95;
    
    const plateTopY = batteryCenterY - plateGap / 2 - plateThickness;
    const plateBottomY = batteryCenterY + plateGap / 2;

    // Voltímetro conectado en paralelo a las placas
    const meterX = Math.min(w - 55, capacitorCenterX + plateWidth / 2 + 55);
    const meterY = batteryCenterY;

    return {
      leftX, rightX, topY, bottomY,
      batteryX, batteryCenterY, batteryHeight,
      switchStartX, switchEndX, switchY,
      capacitorCenterX, plateWidth, plateThickness, plateGap,
      plateTopY, plateBottomY,
      meterX, meterY
    };
  }

  initElectrons() {
    this.electrons = [];
    for (let i = 0; i < this.numElectrons; i++) {
      this.electrons.push({
        progress: i / this.numElectrons, // 0.0 a 1.0 a lo largo del camino cerrado
        speedMult: 0.95 + Math.random() * 0.1
      });
    }
  }

  /* -------------------------------------------------------------
     INTERACTIVE HITBOXES & MOUSE EVENTS
     ------------------------------------------------------------- */
  handleCanvasClick(e) {
    const rect = this.simCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.switchHitbox && 
        x >= this.switchHitbox.x && x <= this.switchHitbox.x + this.switchHitbox.w &&
        y >= this.switchHitbox.y && y <= this.switchHitbox.y + this.switchHitbox.h) {
      this.toggleSwitch();
    }
  }

  handleCanvasHover(e) {
    const rect = this.simCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const tooltip = document.getElementById("canvas-tooltip");

    if (this.switchHitbox && 
        x >= this.switchHitbox.x && x <= this.switchHitbox.x + this.switchHitbox.w &&
        y >= this.switchHitbox.y && y <= this.switchHitbox.y + this.switchHitbox.h) {
      this.simCanvas.style.cursor = "pointer";
      tooltip.style.display = "block";
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
      tooltip.innerHTML = `<strong>Interruptor (${this.isClosed ? 'Cerrado' : 'Abierto'})</strong><br><span style="color:#94a3b8">Clic para ${this.isClosed ? 'abrir' : 'cerrar'}</span>`;
    } else {
      this.simCanvas.style.cursor = "default";
      tooltip.style.display = "none";
    }
  }

  toggleSwitch() {
    this.isClosed = !this.isClosed;
    this.playSwitchSound(this.isClosed);
    this.recalculatePhysics();
    if (window.updateUI) window.updateUI();
  }

  setSwitchState(closed) {
    if (this.isClosed !== closed) {
      this.isClosed = closed;
      this.playSwitchSound(this.isClosed);
      this.recalculatePhysics();
      if (window.updateUI) window.updateUI();
    }
  }

  resetCharge() {
    this.chargeTime = 0;
    this.voltage = 0;
    this.charge = 0;
    this.current = 0;
    this.isEquilibrium = false;
    this.history = [];
    this.recalculatePhysics();
    this.playSwitchSound(false);
    if (window.updateUI) window.updateUI();
  }

  /* -------------------------------------------------------------
     MAIN SIMULATION TICK / UPDATE
     ------------------------------------------------------------- */
  update(dt) {
    if (this.isClosed && !this.isEquilibrium) {
      this.chargeTime += dt;
      this.recalculatePhysics();

      // Grabar muestra en osciloscopio
      if (this.history.length === 0 || (this.chargeTime - this.history[this.history.length - 1].t >= 0.03)) {
        this.history.push({
          t: this.chargeTime,
          v: this.voltage,
          i: this.current * this.V0
        });
      }
    }

    // Actualizar posición de electrones si hay corriente
    if (this.isClosed && !this.isEquilibrium && this.current > 0.0001) {
      // Velocidad de deriva proporcional a la corriente
      const moveStep = this.current * dt * 0.28 * this.speedFactor;
      this.electrons.forEach(el => {
        el.progress = (el.progress + moveStep * el.speedMult) % 1.0;
      });
    }
  }

  /* -------------------------------------------------------------
     RENDER PIPELINE
     ------------------------------------------------------------- */
  render() {
    const ctx = this.simCtx;
    const geom = this.getCircuitGeometry();

    ctx.clearRect(0, 0, this.simWidth, this.simHeight);

    // 1. Dibujar cables conductores metálicos
    this.renderWires(ctx, geom);

    // 2. Dibujar Batería (Fuente DC) con bornes (+) y (-)
    this.renderBattery(ctx, geom);

    // 3. Dibujar Interruptor interactivo
    this.renderSwitch(ctx, geom);

    // 4. Dibujar Condensador de Placas Paralelas
    this.renderCapacitorPlates(ctx, geom);

    // 5. Dibujar Campo Eléctrico uniforme y Líneas Equipotenciales
    if (this.layers.equipotentials && this.voltage > 0.05) {
      this.renderEquipotentials(ctx, geom);
    }
    if (this.layers.field && this.voltage > 0.05) {
      this.renderElectricField(ctx, geom);
    }

    // 6. Dibujar Cargas Fijas superficiales (+ en roja superior, - en azul inferior)
    if (this.layers.charges && this.voltage > 0.05) {
      this.renderAccumulatedCharges(ctx, geom);
    }

    // 7. Dibujar Electrones en movimiento
    if (this.layers.electrons) {
      this.renderElectrons(ctx, geom);
    }

    // 8. Dibujar Voltímetro en Paralelo
    this.renderVoltmeter(ctx, geom);

    // 9. Dibujar Acotaciones / Calipers de Geometría (A y d)
    this.renderCalipers(ctx, geom);

    // 10. Actualizar gráfica del Osciloscopio
    if (this.layers.graph) {
      this.renderOscilloscope();
    }
  }

  /* -------------------------------------------------------------
     RENDER SUB-COMPONENTS
     ------------------------------------------------------------- */
  renderWires(ctx, g) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Glow suave de los cables conductores
    ctx.strokeStyle = "rgba(56, 189, 248, 0.15)";
    ctx.lineWidth = 10;
    this.traceCircuitPath(ctx, g);
    ctx.stroke();

    // Núcleo de cobre / conductor metálico
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 4;
    this.traceCircuitPath(ctx, g);
    ctx.stroke();

    // Si hay corriente o potencial, brillo interno
    if (this.isClosed || this.voltage > 0.1) {
      ctx.strokeStyle = this.isClosed && !this.isEquilibrium ? "rgba(56, 189, 248, 0.7)" : "rgba(148, 163, 184, 0.4)";
      ctx.lineWidth = 2;
      this.traceCircuitPath(ctx, g);
      ctx.stroke();
    }

    // Cables de conexión hacia las placas del condensador
    ctx.beginPath();
    // Cable superior hacia placa superior
    ctx.moveTo(g.capacitorCenterX, g.topY);
    ctx.lineTo(g.capacitorCenterX, g.plateTopY);
    // Cable inferior desde placa inferior hacia cable base
    ctx.moveTo(g.capacitorCenterX, g.plateBottomY + g.plateThickness);
    ctx.lineTo(g.capacitorCenterX, g.bottomY);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore();
  }

  traceCircuitPath(ctx, g) {
    ctx.beginPath();
    // Bucle cerrado principal: Batería (+) -> Superior -> Condensador -> Inferior -> Batería (-)
    // Cable superior izquierdo (de batería a interruptor)
    ctx.moveTo(g.batteryX, g.batteryCenterY - g.batteryHeight / 2);
    ctx.lineTo(g.batteryX, g.topY);
    ctx.lineTo(g.switchStartX, g.topY);

    // Cable superior derecho (de interruptor a condensador)
    ctx.moveTo(g.switchEndX, g.topY);
    ctx.lineTo(g.capacitorCenterX, g.topY);

    // Cable inferior (de placa inferior a batería -)
    ctx.moveTo(g.capacitorCenterX, g.bottomY);
    ctx.lineTo(g.batteryX, g.bottomY);
    ctx.lineTo(g.batteryX, g.batteryCenterY + g.batteryHeight / 2);
  }

  renderBattery(ctx, g) {
    const x = g.batteryX;
    const cy = g.batteryCenterY;
    const bh = g.batteryHeight;
    const bw = 32;

    ctx.save();

    // Sombra proyectada del chasis
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;

    // Cuerpo de la batería cilíndrica
    const grad = ctx.createLinearGradient(x - bw / 2, cy, x + bw / 2, cy);
    grad.addColorStop(0, "#1e293b");
    grad.addColorStop(0.3, "#334155");
    grad.addColorStop(0.7, "#1e293b");
    grad.addColorStop(1, "#0f172a");

    ctx.fillStyle = grad;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - bw / 2, cy - bh / 2, bw, bh, 6);
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = "transparent";

    // Borne Superior Positivo (+)
    const termW = 14;
    const termH = 8;
    ctx.fillStyle = "#ff4d6d";
    ctx.beginPath();
    ctx.roundRect(x - termW / 2, cy - bh / 2 - termH, termW, termH, [3, 3, 0, 0]);
    ctx.fill();

    // Borne Inferior Negativo (-)
    ctx.fillStyle = "#0284c7";
    ctx.beginPath();
    ctx.roundRect(x - termW / 2, cy + bh / 2, termW, termH, [0, 0, 3, 3]);
    ctx.fill();

    // Etiquetas y Signos (+) y (-)
    ctx.fillStyle = "#ff4d6d";
    ctx.font = "bold 13px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+", x, cy - bh / 4);

    ctx.fillStyle = "#38bdf8";
    ctx.fillText("−", x, cy + bh / 4);

    // Etiqueta de Voltaje de la Fuente V0
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.fillText(`${this.V0.toFixed(1)}V`, x - 34, cy);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "500 9px 'Inter', sans-serif";
    ctx.fillText("Fuente DC", x - 34, cy + 13);

    // Flecha química interna (Fuerza Electromotriz)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, cy + 12);
    ctx.lineTo(x, cy - 12);
    ctx.stroke();

    ctx.restore();
  }

  renderSwitch(ctx, g) {
    const sx = g.switchStartX;
    const ex = g.switchEndX;
    const sy = g.topY;
    const gap = ex - sx;

    ctx.save();

    // Guardar hitbox para interactividad
    this.switchHitbox = {
      x: sx - 10,
      y: sy - 30,
      w: gap + 20,
      h: 50
    };

    // Terminales / Contactos circulares
    ctx.fillStyle = "#94a3b8";
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.arc(ex, sy, 5, 0, Math.PI * 2);
    ctx.fill();

    // Brazo / Cuchilla del interruptor
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";

    if (this.isClosed) {
      // Estado CERRADO: Contacto plano horizontal directo
      ctx.strokeStyle = "#10b981";
      ctx.shadowColor = "#10b981";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, sy);
      ctx.stroke();

      // Chispa / contacto
      ctx.fillStyle = "#34d399";
      ctx.beginPath();
      ctx.arc(ex, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Estado ABIERTO: Cuchilla levantada a ~36 grados
      const angle = -Math.PI / 5;
      const bladeLen = gap * 1.05;
      const bladeEndX = sx + Math.cos(angle) * bladeLen;
      const bladeEndY = sy + Math.sin(angle) * bladeLen;

      ctx.strokeStyle = "#fb7185";
      ctx.shadowColor = "#fb7185";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(bladeEndX, bladeEndY);
      ctx.stroke();

      // Pomo aislante del interruptor
      ctx.fillStyle = "#f43f5e";
      ctx.beginPath();
      ctx.arc(bladeEndX, bladeEndY, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Texto de estado sobre el interruptor
    ctx.shadowColor = "transparent";
    ctx.fillStyle = this.isClosed ? "#34d399" : "#fb7185";
    ctx.font = "bold 10px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(this.isClosed ? "CERRADO" : "ABIERTO", sx + gap / 2, sy - 24);

    ctx.restore();
  }

  renderCapacitorPlates(ctx, g) {
    const cx = g.capacitorCenterX;
    const pw = g.plateWidth;
    const th = g.plateThickness;

    ctx.save();

    // 1. Placa Superior (Se carga POSITIVAMENTE con respecto al potencial)
    const topY = g.plateTopY;
    const topGrad = ctx.createLinearGradient(cx - pw / 2, topY, cx + pw / 2, topY);
    topGrad.addColorStop(0, "#334155");
    topGrad.addColorStop(0.5, "#64748b");
    topGrad.addColorStop(1, "#334155");

    ctx.fillStyle = topGrad;
    ctx.strokeStyle = "rgba(255, 77, 109, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx - pw / 2, topY, pw, th, 4);
    ctx.fill();
    ctx.stroke();

    // 2. Placa Inferior (Se carga NEGATIVAMENTE con respecto al potencial)
    const botY = g.plateBottomY;
    const botGrad = ctx.createLinearGradient(cx - pw / 2, botY, cx + pw / 2, botY);
    botGrad.addColorStop(0, "#334155");
    botGrad.addColorStop(0.5, "#64748b");
    botGrad.addColorStop(1, "#334155");

    ctx.fillStyle = botGrad;
    ctx.strokeStyle = "rgba(0, 210, 255, 0.4)";
    ctx.beginPath();
    ctx.roundRect(cx - pw / 2, botY, pw, th, 4);
    ctx.fill();
    ctx.stroke();

    // Etiquetas de Placas
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "600 10px 'Inter', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Placa Superior (+)", cx + pw / 2 + 10, topY + th / 2 + 3);
    ctx.fillText("Placa Inferior (−)", cx + pw / 2 + 10, botY + th / 2 + 3);

    ctx.restore();
  }

  renderAccumulatedCharges(ctx, g) {
    const cx = g.capacitorCenterX;
    const pw = g.plateWidth;
    const innerTopY = g.plateTopY + g.plateThickness; // cara interna inferior de placa superior
    const innerBotY = g.plateBottomY;                  // cara interna superior de placa inferior

    // Número de cargas visuales proporcional a Q(t) / Q_max
    const maxChargeFraction = Math.min(1.0, this.voltage / Math.max(1, this.V0));
    const maxSigns = Math.floor(pw / 16);
    const activeSigns = Math.max(0, Math.round(maxSigns * maxChargeFraction));

    if (activeSigns === 0) return;

    ctx.save();
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const spacing = pw / (activeSigns + 1);

    for (let i = 1; i <= activeSigns; i++) {
      const chargeX = cx - pw / 2 + i * spacing;

      // Carga (+) en cara interna de placa superior
      ctx.fillStyle = "#ff4d6d";
      ctx.shadowColor = "rgba(255, 77, 109, 0.6)";
      ctx.shadowBlur = 6;
      ctx.fillText("+", chargeX, innerTopY - 4);

      // Carga (-) en cara interna de placa inferior
      ctx.fillStyle = "#00d2ff";
      ctx.shadowColor = "rgba(0, 210, 255, 0.6)";
      ctx.shadowBlur = 6;
      ctx.fillText("−", chargeX, innerBotY + 5);
    }

    ctx.restore();
  }

  renderElectricField(ctx, g) {
    const cx = g.capacitorCenterX;
    const pw = g.plateWidth;
    const innerTopY = g.plateTopY + g.plateThickness + 4;
    const innerBotY = g.plateBottomY - 4;
    const gap = innerBotY - innerTopY;

    if (gap <= 8) return;

    // Intensidad visual proporcional al campo E
    const fieldFraction = Math.min(1.0, this.voltage / this.V0);
    const numLines = Math.max(3, Math.floor((pw / 24) * fieldFraction));
    const alpha = Math.min(0.9, 0.15 + fieldFraction * 0.75);

    ctx.save();
    ctx.strokeStyle = `rgba(251, 191, 36, ${alpha})`;
    ctx.fillStyle = `rgba(251, 191, 36, ${alpha})`;
    ctx.lineWidth = 1.6;
    ctx.shadowColor = "rgba(251, 191, 36, 0.5)";
    ctx.shadowBlur = 5;

    const spacing = pw / (numLines + 1);

    for (let i = 1; i <= numLines; i++) {
      const lx = cx - pw / 2 + i * spacing;

      // Línea de campo continua descendente de (+) a (-)
      ctx.beginPath();
      ctx.moveTo(lx, innerTopY);
      ctx.lineTo(lx, innerBotY);
      ctx.stroke();

      // Flecha indicadora en el centro
      const midY = (innerTopY + innerBotY) / 2;
      ctx.beginPath();
      ctx.moveTo(lx, midY + 5);
      ctx.lineTo(lx - 3.5, midY - 3);
      ctx.lineTo(lx + 3.5, midY - 3);
      ctx.closePath();
      ctx.fill();
    }

    // Vector E simbólico
    if (fieldFraction > 0.15) {
      ctx.shadowColor = "transparent";
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 11px 'Inter', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("Campo E", cx - pw / 2 - 12, (innerTopY + innerBotY) / 2);
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.fillText(`${(this.fieldE / 1000).toFixed(2)} kV/m`, cx - pw / 2 - 12, (innerTopY + innerBotY) / 2 + 13);
    }

    ctx.restore();
  }

  renderEquipotentials(ctx, g) {
    const cx = g.capacitorCenterX;
    const pw = g.plateWidth;
    const innerTopY = g.plateTopY + g.plateThickness;
    const innerBotY = g.plateBottomY;
    const gap = innerBotY - innerTopY;

    if (gap < 24) return;

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(192, 132, 252, 0.65)";
    ctx.fillStyle = "rgba(192, 132, 252, 0.85)";
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";

    // Tres líneas equipotenciales intermedias (25%, 50%, 75%)
    const steps = [0.25, 0.50, 0.75];
    steps.forEach(factor => {
      // Potencial relativo: placa inferior = 0V, placa superior = V_C
      const y = innerBotY - factor * gap;
      const vVal = this.voltage * factor;

      ctx.beginPath();
      ctx.moveTo(cx - pw / 2 + 6, y);
      ctx.lineTo(cx + pw / 2 - 6, y);
      ctx.stroke();

      // Etiqueta del valor equipotencial
      ctx.fillText(`${vVal.toFixed(1)}V`, cx + pw / 2 - 32, y - 3);
    });

    ctx.restore();
  }

  /* -------------------------------------------------------------
     MICROSCOPIC ELECTRON FLOW RENDERER
     ------------------------------------------------------------- */
  renderElectrons(ctx, g) {
    // Calculamos el camino paramétrico continuo a lo largo del circuito
    // Secuencia del ciclo del flujo de electrones:
    // Placa Superior (+) -> Cable Sup -> Batería (+) -> Int Batería -> Batería (-) -> Cable Inf -> Placa Inferior (-)
    const pathSegments = [
      // 0: Desde el borne central de placa superior subiendo hacia el cable superior
      { x1: g.capacitorCenterX, y1: g.plateTopY, x2: g.capacitorCenterX, y2: g.topY },
      // 1: Hacia la izquierda por cable superior hasta el interruptor
      { x1: g.capacitorCenterX, y1: g.topY, x2: g.switchEndX, y2: g.topY },
      // 2: A través del interruptor (si está cerrado) o salto
      { x1: g.switchEndX, y1: g.topY, x2: g.switchStartX, y2: g.topY },
      // 3: Hacia la esquina superior izquierda
      { x1: g.switchStartX, y1: g.topY, x2: g.batteryX, y2: g.topY },
      // 4: Bajando al borne positivo de la batería
      { x1: g.batteryX, y1: g.topY, x2: g.batteryX, y2: g.batteryCenterY - g.batteryHeight / 2 },
      // 5: A través del interior de la batería química (+ hacia -)
      { x1: g.batteryX, y1: g.batteryCenterY - g.batteryHeight / 2, x2: g.batteryX, y2: g.batteryCenterY + g.batteryHeight / 2 },
      // 6: Saliendo del borne negativo hacia esquina inferior izquierda
      { x1: g.batteryX, y1: g.batteryCenterY + g.batteryHeight / 2, x2: g.batteryX, y2: g.bottomY },
      // 7: Hacia la derecha por el cable inferior hasta el condensador
      { x1: g.batteryX, y1: g.bottomY, x2: g.capacitorCenterX, y2: g.bottomY },
      // 8: Subiendo hacia la placa inferior del condensador
      { x1: g.capacitorCenterX, y1: g.bottomY, x2: g.capacitorCenterX, y2: g.plateBottomY + g.plateThickness }
    ];

    // Longitud total del recorrido
    let totalLength = 0;
    const segLengths = pathSegments.map(seg => {
      const len = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
      totalLength += len;
      return len;
    });

    ctx.save();

    this.electrons.forEach(el => {
      let targetDist = el.progress * totalLength;
      let curX = pathSegments[0].x1;
      let curY = pathSegments[0].y1;

      for (let i = 0; i < pathSegments.length; i++) {
        const segLen = segLengths[i];
        if (targetDist <= segLen) {
          const ratio = segLen > 0 ? (targetDist / segLen) : 0;
          curX = pathSegments[i].x1 + (pathSegments[i].x2 - pathSegments[i].x1) * ratio;
          curY = pathSegments[i].y1 + (pathSegments[i].y2 - pathSegments[i].y1) * ratio;
          break;
        }
        targetDist -= segLen;
      }

      // Dibujar esfera del electrón (e-)
      const radius = 5.5;

      // Glow exterior
      ctx.fillStyle = "rgba(56, 189, 248, 0.4)";
      ctx.beginPath();
      ctx.arc(curX, curY, radius + 3, 0, Math.PI * 2);
      ctx.fill();

      // Esfera azul brillante
      const eGrad = ctx.createRadialGradient(curX - 1.5, curY - 1.5, 1, curX, curY, radius);
      eGrad.addColorStop(0, "#ffffff");
      eGrad.addColorStop(0.35, "#38bdf8");
      eGrad.addColorStop(1, "#0284c7");

      ctx.fillStyle = eGrad;
      ctx.beginPath();
      ctx.arc(curX, curY, radius, 0, Math.PI * 2);
      ctx.fill();

      // Signo (-) en el centro
      ctx.fillStyle = "#0c1017";
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("−", curX, curY + 0.5);
    });

    ctx.restore();
  }

  /* -------------------------------------------------------------
     VOLTMETER INSTRUMENT RENDERER (Dual Digital & Analog Gauge)
     ------------------------------------------------------------- */
  renderVoltmeter(ctx, g) {
    const mx = g.meterX;
    const my = g.meterY;
    const mw = 84;
    const mh = 90;

    ctx.save();

    // Cables de prueba del voltímetro conectados en paralelo
    ctx.lineWidth = 1.8;

    // Sonda Roja (+) a Placa Superior
    ctx.strokeStyle = "rgba(244, 63, 94, 0.85)";
    ctx.beginPath();
    ctx.moveTo(g.capacitorCenterX + g.plateWidth / 2 - 10, g.plateTopY + g.plateThickness / 2);
    ctx.lineTo(mx - mw / 2, my - 20);
    ctx.stroke();

    // Sonda Negra (-) a Placa Inferior
    ctx.strokeStyle = "rgba(148, 163, 184, 0.85)";
    ctx.beginPath();
    ctx.moveTo(g.capacitorCenterX + g.plateWidth / 2 - 10, g.plateBottomY + g.plateThickness / 2);
    ctx.lineTo(mx - mw / 2, my + 20);
    ctx.stroke();

    // Chasis del Voltímetro de Laboratorio
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;

    ctx.fillStyle = "#0f172a";
    ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(mx - mw / 2, my - mh / 2, mw, mh, 10);
    ctx.fill();
    ctx.stroke();
    ctx.shadowColor = "transparent";

    // Pantalla Digital LCD retroiluminada
    const dw = mw - 16;
    const dh = 28;
    ctx.fillStyle = "#020617";
    ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mx - dw / 2, my - mh / 2 + 10, dw, dh, 4);
    ctx.fill();
    ctx.stroke();

    // Lectura digital en display
    ctx.fillStyle = "#38bdf8";
    ctx.shadowColor = "rgba(56, 189, 248, 0.6)";
    ctx.shadowBlur = 8;
    ctx.font = "bold 15px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${this.voltage.toFixed(2)} V`, mx, my - mh / 2 + 24);
    ctx.shadowColor = "transparent";

    // Dial Analógico en la parte inferior del voltímetro
    const dialRadius = 24;
    const dialCenterY = my + 20;

    // Arco de fondo del cuadrante
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(mx, dialCenterY, dialRadius, Math.PI * 0.75, Math.PI * 2.25);
    ctx.stroke();

    // Arco activo de potencial medido
    const voltFraction = Math.min(1.0, this.voltage / 12);
    const startAngle = Math.PI * 0.75;
    const endAngle = startAngle + voltFraction * (Math.PI * 1.5);

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(mx, dialCenterY, dialRadius, startAngle, endAngle);
    ctx.stroke();

    // Aguja analógica
    const needleAngle = startAngle + voltFraction * (Math.PI * 1.5);
    const needleX = mx + Math.cos(needleAngle) * (dialRadius - 2);
    const needleY = dialCenterY + Math.sin(needleAngle) * (dialRadius - 2);

    ctx.strokeStyle = "#ff4d6d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx, dialCenterY);
    ctx.lineTo(needleX, needleY);
    ctx.stroke();

    // Pivote central de la aguja
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(mx, dialCenterY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Etiqueta Voltímetro
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 8px 'Inter', sans-serif";
    ctx.fillText("VOLTÍMETRO", mx, my + mh / 2 - 8);

    ctx.restore();
  }

  /* -------------------------------------------------------------
     CALIPERS & PHYSICAL DIMENSION CALLOUTS
     ------------------------------------------------------------- */
  renderCalipers(ctx, g) {
    const cx = g.capacitorCenterX;
    const pw = g.plateWidth;
    const topY = g.plateTopY;
    const botY = g.plateBottomY;

    ctx.save();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.6)";
    ctx.fillStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.font = "10px 'JetBrains Mono', monospace";

    // Caliper Horizontal para el Área A
    const calY = topY - 14;
    ctx.beginPath();
    ctx.moveTo(cx - pw / 2, calY - 4);
    ctx.lineTo(cx - pw / 2, calY + 4);
    ctx.moveTo(cx - pw / 2, calY);
    ctx.lineTo(cx + pw / 2, calY);
    ctx.moveTo(cx + pw / 2, calY - 4);
    ctx.lineTo(cx + pw / 2, calY + 4);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillText(`A = ${this.areaCm2} cm²`, cx, calY - 6);

    // Caliper Vertical para la Distancia d
    const calX = cx - pw / 2 - 20;
    const innerTopY = topY + g.plateThickness;
    const innerBotY = botY;

    ctx.beginPath();
    ctx.moveTo(calX - 4, innerTopY);
    ctx.lineTo(calX + 4, innerTopY);
    ctx.moveTo(calX, innerTopY);
    ctx.lineTo(calX, innerBotY);
    ctx.moveTo(calX - 4, innerBotY);
    ctx.lineTo(calX + 4, innerBotY);
    ctx.stroke();

    ctx.textAlign = "right";
    ctx.fillText(`d = ${this.distMm.toFixed(1)} mm`, calX - 6, (innerTopY + innerBotY) / 2 + 3);

    ctx.restore();
  }

  /* -------------------------------------------------------------
     OSCILLOSCOPE REAL-TIME CHART RENDERER
     ------------------------------------------------------------- */
  renderOscilloscope() {
    const ctx = this.graphCtx;
    const w = this.graphWidth;
    const h = this.graphHeight;

    ctx.clearRect(0, 0, w, h);

    const padLeft = 40;
    const padRight = 20;
    const padTop = 15;
    const padBottom = 22;
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    ctx.save();

    // Fondo del gráfico con cuadrícula tenue
    ctx.fillStyle = "rgba(7, 10, 18, 0.8)";
    ctx.fillRect(padLeft, padTop, plotW, plotH);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;

    // Líneas horizontales de cuadrícula (Voltaje: 0, 3, 6, 9, 12V)
    ctx.fillStyle = "#64748b";
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";

    const vSteps = [0, 4, 8, 12];
    vSteps.forEach(val => {
      const y = padTop + plotH - (val / 12) * plotH;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();
      ctx.fillText(`${val}V`, padLeft - 6, y + 3);
    });

    // Líneas verticales de cuadrícula (Tiempo: 0s, 1s, 2s, 3s, 4s, 5s)
    ctx.textAlign = "center";
    for (let sec = 0; sec <= 5; sec++) {
      const x = padLeft + (sec / 5) * plotW;
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + plotH);
      ctx.stroke();
      ctx.fillText(`${sec}s`, x, padTop + plotH + 14);
    }

    // Línea de referencia V0 (voltaje de la batería)
    const targetY = padTop + plotH - (this.V0 / 12) * plotH;
    ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padLeft, targetY);
    ctx.lineTo(padLeft + plotW, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Curvas del osciloscopio
    if (this.history.length > 1) {
      // 1. Curva de Corriente I(t) (Color Rosa/Rojo)
      ctx.strokeStyle = "#f43f5e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      this.history.forEach((pt, idx) => {
        const x = padLeft + Math.min(plotW, (pt.t / 5) * plotW);
        const y = padTop + plotH - (pt.i / 12) * plotH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 2. Curva de Voltaje V_C(t) (Color Cian Eléctrico con Glow)
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "rgba(56, 189, 248, 0.6)";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      this.history.forEach((pt, idx) => {
        const x = padLeft + Math.min(plotW, (pt.t / 5) * plotW);
        const y = padTop + plotH - (pt.v / 12) * plotH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.shadowColor = "transparent";

      // Marcador de tiempo actual
      const currentX = padLeft + Math.min(plotW, (this.chargeTime / 5) * plotW);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(currentX, padTop);
      ctx.lineTo(currentX, padTop + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }
}

// Bucle de animación global
window.addEventListener("DOMContentLoaded", () => {
  window.capacitorSim = new CapacitorSimulation();

  let lastTime = performance.now();
  function animationLoop(timestamp) {
    const dt = Math.min(0.05, (timestamp - lastTime) / 1000);
    lastTime = timestamp;

    window.capacitorSim.update(dt);
    window.capacitorSim.render();

    requestAnimationFrame(animationLoop);
  }
  requestAnimationFrame(animationLoop);
});
