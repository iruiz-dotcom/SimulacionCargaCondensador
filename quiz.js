/**
 * Cuestionario de Comprobación Conceptualmente Guiado
 * Módulo de evaluación formativa interactiva para Física Universitaria (Electromagnetismo)
 */

(function () {
  const quizData = [
    {
      id: 1,
      category: "Geometría y Capacitancia",
      question: "Si duplicas el área de las placas (A) y simultáneamente duplicas la distancia de separación (d), ¿qué le ocurre a la capacidad (C) del condensador?",
      options: [
        { letter: "A", text: "Se duplica." },
        { letter: "B", text: "Se reduce a la mitad." },
        { letter: "C", text: "Permanece constante." },
        { letter: "D", text: "Se quadruplica." }
      ],
      correctIndex: 2, // C
      feedback: "Dado que C = ε₀ · (A / d), si ambos parámetros aumentan en el mismo factor (2A y 2d), el cociente (2A)/(2d) = A/d no varía, por lo que la capacitancia se mantiene idéntica."
    },
    {
      id: 2,
      category: "Origen y Transporte de Carga",
      question: "¿De dónde provienen los electrones que terminan acumulándose en la placa negativa durante el proceso de carga?",
      options: [
        { letter: "A", text: "Son creados dentro de la batería durante la reacción química." },
        { letter: "B", text: "Provienen de la placa positiva del propio condensador, siendo extraídos por el borne positivo de la batería." },
        { letter: "C", text: "Salen del aire que separa ambas placas." },
        { letter: "D", text: "Se generan por la fricción de la corriente en los cables." }
      ],
      correctIndex: 1, // B
      feedback: "La batería no 'crea' cargas netas; actúa como una bomba impulsora de carga que arranca electrones libres de la placa conductora (dejándola cargada positivamente) y realiza trabajo químico para transportarlos e inyectarlos en la otra placa (dejándola cargada negativamente)."
    },
    {
      id: 3,
      category: "Equilibrio Electrostático",
      question: "¿En qué momento se detiene por completo el movimiento de electrones en el circuito?",
      options: [
        { letter: "A", text: "Cuando la placa negativa se llena por completo de electrones sin espacio libre." },
        { letter: "B", text: "Cuando la diferencia de potencial entre las placas del condensador (V_C) iguala a la tensión de la batería (V₀)." },
        { letter: "C", text: "Cuando se agotan todos los electrones de la placa positiva." },
        { letter: "D", text: "El flujo nunca se detiene mientras la batería siga conectada." }
      ],
      correctIndex: 1, // B
      feedback: "El flujo cesa cuando la fuerza contraelectromotriz generada por la acumulación de cargas en el condensador equilibra exactamente la fuerza electromotriz de la batería (V_C = V₀). En ese instante, el campo eléctrico neto en los cables se vuelve cero y se alcanza el equilibrio electrostático."
    },
    {
      id: 4,
      category: "Campo Eléctrico y Distancia",
      question: "Con la batería conectada a un voltaje fijo V₀, si aumentas la distancia (d) entre las placas, ¿qué ocurre con la intensidad del campo eléctrico (E) interior?",
      options: [
        { letter: "A", text: "Aumenta porque hay más espacio para las líneas de campo." },
        { letter: "B", text: "Disminuye, ya que E = V₀ / d." },
        { letter: "C", text: "Permanece igual porque el voltaje no cambia." },
        { letter: "D", text: "Se vuelve cero inmediatamente." }
      ],
      correctIndex: 1, // B
      feedback: "Al permanecer la batería conectada, el voltaje entre placas se fija en V₀. Dado que en un condensador plano uniforme E = V / d, al aumentar la distancia d el gradiente de potencial disminuye y por tanto la intensidad de campo eléctrico E se reduce."
    },
    {
      id: 5,
      category: "Energía Almacenada",
      question: "Si manteniendo el voltaje constante duplicas la capacidad del condensador (C), ¿qué ocurre con la energía total almacenada (U)?",
      options: [
        { letter: "A", text: "Se duplica." },
        { letter: "B", text: "Se cuadruplica." },
        { letter: "C", text: "Se reduce a la mitad." },
        { letter: "D", text: "No cambia." }
      ],
      correctIndex: 0, // A
      feedback: "La energía electrostática almacenada viene dada por la expresión U = ½ · C · V². Como el potencial V se mantiene constante, la energía es directamente proporcional a la capacitancia (U ∝ C), por lo que duplicar C duplica la energía total U."
    }
  ];

  let currentIndex = 0;
  const userAnswers = new Array(quizData.length).fill(null);

  // DOM Elements
  const container = document.getElementById("quiz-container");
  const progressFill = document.getElementById("quiz-progress-fill");
  const progressText = document.getElementById("quiz-progress-text");
  const scoreBadge = document.getElementById("quiz-score-badge");
  const btnPrev = document.getElementById("btn-quiz-prev");
  const btnNext = document.getElementById("btn-quiz-next");
  const btnReset = document.getElementById("btn-quiz-reset");
  const modalQuiz = document.getElementById("modal-quiz");
  const btnOpenQuiz = document.getElementById("btn-open-quiz");
  const btnCloseQuiz = document.getElementById("btn-close-quiz");
  const quizBadge = document.getElementById("quiz-badge");

  function renderQuestion(index) {
    const q = quizData[index];
    const userAnswer = userAnswers[index];
    const isAnswered = userAnswer !== null;

    let optionsHtml = q.options.map((opt, optIdx) => {
      let stateClass = "";
      if (isAnswered) {
        if (optIdx === q.correctIndex) {
          stateClass = "selected-correct";
        } else if (optIdx === userAnswer) {
          stateClass = "selected-incorrect";
        }
      }

      return `
        <button class="option-btn ${stateClass}" data-index="${optIdx}" ${isAnswered ? "disabled" : ""}>
          <span class="option-letter">${opt.letter}</span>
          <span class="option-text">${opt.text}</span>
        </button>
      `;
    }).join("");

    let feedbackHtml = "";
    if (isAnswered) {
      const isCorrect = userAnswer === q.correctIndex;
      feedbackHtml = `
        <div class="quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}">
          <div class="feedback-header">
            ${isCorrect 
              ? '✓ ¡Respuesta Correcta!' 
              : '✗ Respuesta Incorrecta'}
          </div>
          <p>${q.feedback}</p>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="quiz-card">
        <span class="question-category">${q.category}</span>
        <h3 class="question-text">${q.question}</h3>
        <div class="options-list">
          ${optionsHtml}
        </div>
        ${feedbackHtml}
      </div>
    `;

    // Attach events to options
    if (!isAnswered) {
      const buttons = container.querySelectorAll(".option-btn");
      buttons.forEach(btn => {
        btn.addEventListener("click", () => {
          const selectedIdx = parseInt(btn.getAttribute("data-index"), 10);
          handleAnswer(index, selectedIdx);
        });
      });
    }

    updateNavigation();
  }

  function handleAnswer(qIndex, selectedIdx) {
    userAnswers[qIndex] = selectedIdx;
    
    // Play subtle audio cue if sound is enabled
    if (window.capacitorSim && window.capacitorSim.audio) {
      if (selectedIdx === quizData[qIndex].correctIndex) {
        window.capacitorSim.audio.playSuccess();
      } else {
        window.capacitorSim.audio.playWarning();
      }
    }

    renderQuestion(qIndex);
  }

  function updateNavigation() {
    progressFill.style.width = `${((currentIndex + 1) / quizData.length) * 100}%`;
    progressText.textContent = `Pregunta ${currentIndex + 1} de ${quizData.length}`;

    const score = userAnswers.reduce((acc, ans, idx) => {
      return acc + (ans === quizData[idx].correctIndex ? 1 : 0);
    }, 0);
    
    const answeredCount = userAnswers.filter(a => a !== null).length;
    scoreBadge.textContent = `Puntuación: ${score} / ${quizData.length}`;
    if (quizBadge) {
      quizBadge.textContent = answeredCount === quizData.length 
        ? `${score}/${quizData.length} pts` 
        : `${answeredCount}/5 Resp.`;
    }

    btnPrev.disabled = currentIndex === 0;
    
    if (currentIndex === quizData.length - 1) {
      btnNext.textContent = answeredCount === quizData.length ? "Ver Resumen" : "Finalizar";
    } else {
      btnNext.textContent = "Siguiente";
    }
  }

  function showSummary() {
    const score = userAnswers.reduce((acc, ans, idx) => {
      return acc + (ans === quizData[idx].correctIndex ? 1 : 0);
    }, 0);

    const percent = Math.round((score / quizData.length) * 100);
    let message = "";
    let colorClass = "";

    if (percent === 100) {
      message = "¡Excelente dominio! Has comprendido a la perfección los principios físicos de la capacitancia y el transporte de carga.";
      colorClass = "text-accent";
    } else if (percent >= 60) {
      message = "¡Buen trabajo! Tienes claros los conceptos fundamentales, aunque te sugerimos repasar la guía teórica para afinar detalles.";
      colorClass = "text-voltage";
    } else {
      message = "Te recomendamos revisar la sección de 'Fundamentos Teóricos' y observar con atención el movimiento de los electrones en la simulación.";
      colorClass = "text-charge";
    }

    container.innerHTML = `
      <div style="text-align: center; padding: 1.5rem 1rem; display: flex; flex-direction: column; align-items: center; gap: 1rem;">
        <div style="width: 80px; height: 80px; border-radius: 50%; background: rgba(56, 189, 248, 0.15); border: 2px solid var(--accent-cyan); display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 700; color: var(--accent-cyan); font-family: var(--font-mono);">
          ${score}/${quizData.length}
        </div>
        <h3 style="font-family: var(--font-heading); font-size: 1.4rem; color: #fff;">Resultado: ${percent}% de Aciertos</h3>
        <p style="color: #cbd5e1; max-width: 480px; line-height: 1.5;">${message}</p>
        <button id="btn-quiz-review" class="btn btn-primary" style="margin-top: 0.5rem;">Revisar Respuestas</button>
      </div>
    `;

    document.getElementById("btn-quiz-review").addEventListener("click", () => {
      currentIndex = 0;
      renderQuestion(currentIndex);
    });

    btnNext.disabled = true;
    btnPrev.disabled = false;
  }

  // Navigation handlers
  btnPrev.addEventListener("click", () => {
    if (currentIndex > 0) {
      currentIndex--;
      btnNext.disabled = false;
      renderQuestion(currentIndex);
    }
  });

  btnNext.addEventListener("click", () => {
    if (currentIndex < quizData.length - 1) {
      currentIndex++;
      renderQuestion(currentIndex);
    } else {
      showSummary();
    }
  });

  btnReset.addEventListener("click", () => {
    userAnswers.fill(null);
    currentIndex = 0;
    btnNext.disabled = false;
    renderQuestion(currentIndex);
  });

  // Modal handlers
  function openQuiz() {
    modalQuiz.style.display = "flex";
    setTimeout(() => modalQuiz.classList.add("show"), 10);
    renderQuestion(currentIndex);
  }

  function closeQuiz() {
    modalQuiz.classList.remove("show");
    setTimeout(() => {
      modalQuiz.style.display = "none";
    }, 250);
  }

  btnOpenQuiz.addEventListener("click", openQuiz);
  btnCloseQuiz.addEventListener("click", closeQuiz);
  modalQuiz.addEventListener("click", (e) => {
    if (e.target === modalQuiz) closeQuiz();
  });

  // Export to window for external control if needed
  window.quizController = {
    open: openQuiz,
    close: closeQuiz,
    reset: () => {
      userAnswers.fill(null);
      currentIndex = 0;
      renderQuestion(0);
    }
  };
})();
