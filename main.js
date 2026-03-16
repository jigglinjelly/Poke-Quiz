document.addEventListener("DOMContentLoaded", async () => {
  let clues = [];

  // Load clues.json dynamically
  async function loadClues() {
    try {
      const response = await fetch("clues.json", { cache: "no-store" });
      clues = await response.json();
      loadPuzzle();
    } catch (err) {
      console.error("❌ Failed to load clues.json", err);
      clueText.textContent = "Error loading clue!";
    }
  }

  const clueDate = document.getElementById("clue-date");
  const clueText = document.getElementById("clue-text");
  const checkBtn = document.getElementById("check-btn");
  const hintBtn = document.getElementById("hint-btn");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const randomBtn = document.getElementById("random-btn");
  const resetBtn = document.getElementById("reset-progress");
  const hintModal = document.getElementById("hint-modal");
  const closeBtn = document.querySelector(".close-btn");
  const inputGrid = document.getElementById("input-grid");

  const showLetterBtn = document.querySelector(".hint-letter");
  const showDefinitionBtn = document.querySelector(".hint-definition");
  const showFodderBtn = document.querySelector(".hint-fodder");
  const showIndicatorsBtn = document.querySelector(".hint-indicators");

  const hintToast = document.getElementById("hint-toast");
  const hintToastText = document.getElementById("toast-text");
  const hintToastClose = hintToast.querySelector(".toast-close");
  const hintToastContent = hintToast.querySelector(".toast-content");

  const hintDots = document.getElementById("hint-dots");
  const solvedHintDots = document.getElementById("solved-hint-dots");

  const solvedTimer = document.getElementById("solved-timer");

  const parValueEl = document.getElementById("par-value");
  const statsSolvedEl = document.getElementById("stats-solved");
  const statsParEl = document.getElementById("stats-par");
  const statsHintsEl = document.getElementById("stats-hints");

  const endDef = document.getElementById("end-def");
  const endInd = document.getElementById("end-ind");
  const endFod = document.getElementById("end-fod");
  const endYtLink  = document.getElementById("end-yt-link");
  const endYtThumb = document.getElementById("end-yt-thumb");

  let clueAnswer = "";
  let revealedHints = { definition: false, fodder: false, indicators: false };
  let revealedLetters = [];
  let revealOrder = [];
  let revealIndex = 0;
  let hintsUsed = 0;
  let solvedStatus = false;
  let currentPuzzleIndex = 0;

  // Track active box for persistent highlight
  let activeBox = null;
  function setActiveBox(box, { silent = false } = {}) {
    if (activeBox === box) return;

    if (activeBox && activeBox !== box) {
      activeBox.classList.remove("active");
    }
    activeBox = box;
    if (activeBox) {
      activeBox.classList.add("active");
      activeBox.focus();
    }
    if (!silent) saveProgress();
  }

  let totalHintDots = 0;

  function buildHintDots(total) {
    totalHintDots = total;

    [hintDots, solvedHintDots].forEach(container => {
      if (!container) return;
      container.innerHTML = "";
      for (let i = 0; i < total; i++) {
        const dot = document.createElement("span");
        dot.className = "hint-dot";
        container.appendChild(dot);
      }
    });

    fitHintBarToWidth();
    renderHintDots();
  }

  function renderHintDots() {
    const total = Math.max(1, totalHintDots);
    const used = Math.min(hintsUsed, total);
    const pct = used / total;

    function stateClass() {
      if (pct === 1) return "is-empty";
      if (pct >= 0.80) return "is-low";
      if (pct >= 0.50) return "is-mid";
      return "is-high";
    }

    const cls = stateClass();

    [hintDots, solvedHintDots].forEach(container => {
      if (!container) return;

      container.classList.remove("is-empty", "is-low", "is-mid", "is-high");
      container.classList.add(cls);

      const dots = container.querySelectorAll(".hint-dot");

      dots.forEach((dot, i) => {
        const fromRightIndex = total - 1 - i;
        dot.classList.toggle("used", fromRightIndex < used);
      });
    });
  }

  function getPuzzleId() {
    return String(currentPuzzleIndex);
  }

  function setHintsUsedUI() {
    if (!statsHintsEl) return;
    const n = Number(hintsUsed ?? 0);
    statsHintsEl.textContent = `${n} ${n === 1 ? "hint" : "hints"}`;
  }

  function getStorageKey() {
    return `clueProgress-${getPuzzleId()}`;
  }

  function saveProgress() {
    const inputs = [...inputGrid.querySelectorAll("input")];
    const userInput = inputs.map(inp => inp.value || "");
    const cursorPos = activeBox ? [...inputs].indexOf(activeBox) : -1;

    const state = { 
      revealedHints, 
      revealedLetters, 
      solvedStatus, 
      userInput, 
      cursorPos,
      puzzleIndex: currentPuzzleIndex 
    };
    localStorage.setItem(getStorageKey(), JSON.stringify(state));
  }

  function loadProgress() {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw)
      return {
        revealedHints: { definition: false, fodder: false, indicators: false },
        revealedLetters: [],
        solvedStatus: false,
        cursorPos: -1,
      };
    try {
      return JSON.parse(raw);
    } catch {
      return {
        revealedHints: { definition: false, fodder: false, indicators: false },
        revealedLetters: [],
        solvedStatus: false,
        cursorPos: -1,
      };
    }
  }

  function createEnumeration(answer) {
    return "(" + answer.split(" ").map((word) => word.length).join(", ") + ")";
  }

  function getInputs() {
    return [...document.getElementById("input-grid").querySelectorAll("input")];
  }
  
  function firstEditableInput() {
    return getInputs().find(inp => !inp.disabled) || null;
  }
  
  function nextEditableFrom(index) {
    const inputs = getInputs();
    for (let i = index + 1; i < inputs.length; i++) if (!inputs[i].disabled) return inputs[i];
    return null;
  }
  
  function prevEditableFrom(index) {
    const inputs = getInputs();
    for (let i = index - 1; i >= 0; i--) if (!inputs[i].disabled) return inputs[i];
    return null;
  }

  function ensureActiveFocus() {
    if (activeBox) {
      activeBox.focus?.({ preventScroll: true });
      activeBox.classList.add("active");
    }
  }

  function getYouTubeId(url) {
    const match = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/
    );
    return match ? match[1] : null;
  }

  function renderEndCard(clue) {
    if (!clue) return;

    endDef.textContent = clue.def_text || "";
    endInd.textContent = clue.ind_text || "";
    endFod.textContent = clue.fod_text || "";

    const yt = (clue.yt_link || "").trim();
    const vid = getYouTubeId(yt);

    if (vid) {
      endYtLink.href = yt;
      endYtThumb.style.backgroundImage =
        `url("https://img.youtube.com/vi/${vid}/hqdefault.jpg")`;
      endYtLink.style.display = "block";
    } else {
      endYtLink.style.display = "none";
    }
  }

  function fitInputGridToWidth() {
    const container = document.getElementById("solve-section");
    if (!container) return;

    const letters = inputGrid.querySelectorAll("input.letter-box").length;
    const spaces  = inputGrid.querySelectorAll("div.space-box").length;

    if (!letters) return;

    const spaceFactor = 0.55;
    const units = letters + spaces * spaceFactor;
    const w = container.clientWidth;
    const cell = Math.min(50, Math.floor(w / units));

    inputGrid.style.setProperty("--cell", `${cell}px`);
  }

  function fitHintBarToWidth() {
    const total = totalHintDots;
    if (!total) return;

    const hintBars = [hintDots, solvedHintDots].filter(Boolean);
    if (!hintBars.length) return;

    const container =
      document.body.classList.contains("solved")
        ? document.getElementById("solved-section")
        : document.getElementById("clue-section");

    if (!container) return;

    const w = Math.min(container.clientWidth-50, 450);
    const seg = Math.min(30, Math.floor(w / total));

    hintBars.forEach(bar => bar.style.setProperty("--seg", `${seg}px`));
  }

  function createInputGrid(answer) {
    inputGrid.innerHTML = "";

    let firstBox = null;

    function getNextInput(el) {
      let n = el.nextElementSibling;
      while (n && (n.tagName !== "INPUT" || n.disabled))
        n = n.nextElementSibling;
      return n && n.tagName === "INPUT" ? n : null;
    }

    function getPrevInput(el) {
      let p = el.previousElementSibling;
      while (p && (p.tagName !== "INPUT" || p.disabled))
        p = p.previousElementSibling;
      return p && p.tagName === "INPUT" ? p : null;
    }

    const chars = answer.split("");

    chars.forEach((char, letterPos) => {
      if (char === " ") {
        const space = document.createElement("div");
        space.classList.add("space-box");
        inputGrid.appendChild(space);
      } else {
        const box = document.createElement("input");
        box.type = "text";
        box.maxLength = 1;
        box.classList.add("letter-box");
        box.setAttribute("inputmode", "text");
        box.dataset.letterIndex = letterPos;

        if (!firstBox) {
          firstBox = box;
        }

        box.addEventListener("click", () => {
          if (box.disabled) return;
          setActiveBox(box);
        });

        box.addEventListener("keydown", (e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            return;
          }

          const isLetter = /^[a-zA-Z0-9]$/.test(e.key);

          if (isLetter) {
            e.preventDefault();
            box.value = e.key.toUpperCase();
            saveProgress();
            setCheckEnabled(isGridComplete());

            const next = getNextInput(box);
            if (next) setActiveBox(next);
            return;
          }

          if (e.key === "Backspace") {
            e.preventDefault();

            if (box.value) {
              box.value = "";
              saveProgress();
              setCheckEnabled(isGridComplete());
              return;
            }

            const prev = getPrevInput(box);
            if (prev) {
              prev.value = "";
              setActiveBox(prev);
              saveProgress();
              setCheckEnabled(isGridComplete());
            }
            return;
          }

          if (e.key === "ArrowLeft") {
            e.preventDefault();
            const prev = getPrevInput(box);
            if (prev) setActiveBox(prev);
            return;
          }

          if (e.key === "ArrowRight") {
            e.preventDefault();
            const next = getNextInput(box);
            if (next) setActiveBox(next);
            return;
          }
        });

        box.addEventListener("input", (e) => {
          const v = e.target.value;
          e.target.value = v ? v.slice(-1).toUpperCase() : "";

          saveProgress();
          setCheckEnabled(isGridComplete());

          if (e.target.value) {
            const next = getNextInput(box);
            if (next) setActiveBox(next);
          }
        });

        box.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          if (box.disabled) return;
          setActiveBox(box);
        });

        box.addEventListener("touchstart", (e) => {
          e.preventDefault();
          if (box.disabled) return;
          setActiveBox(box);
        }, { passive: false });

        inputGrid.appendChild(box);
      }
    });

    fitInputGridToWidth();

    if (firstBox && !solvedStatus) {
      setTimeout(() => setActiveBox(firstBox), 0);
    }
  }

  function isGridComplete() {
    const inputs = [...inputGrid.querySelectorAll("input")];
    return inputs
      .filter(inp => !inp.disabled)
      .every(inp => /^[A-Z0-9]$/.test(inp.value));
  }

  function setCheckEnabled(enabled) {
    checkBtn.disabled = !enabled;
  }

  let fitRaf = null;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(fitRaf);
    fitRaf = requestAnimationFrame(() => {
      fitInputGridToWidth();
      fitHintBarToWidth();
    });
  });

  function mulberry32(a) {
    return function () {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
  }

  function seededShuffle(array, seed) {
    const rng = mulberry32(seed >>> 0);
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function escapeRegExp(string) {
    return String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  
  function highlightTermByOccurrence(text, term, occurrence, className) {
    const escaped = escapeRegExp(term);
    const regex = new RegExp(escaped, "gi");
    let count = 0;
    return text.replace(regex, (match) => {
      count++;
      if (count === occurrence) {
        return `<span class="${className}">${match}</span>`;
      }
      return match;
    });
  }

  function highlightTerms(text, terms, className) {
    let highlighted = text;
    terms.forEach(term => {
      if (!term) return;
      const escaped = escapeRegExp(term);
      const isWordLike = /^[A-Za-z0-9\s]+$/.test(term);
      const pattern = isWordLike ? `\\b${escaped}\\b` : escaped;
      const regex = new RegExp(pattern, "i");
      highlighted = highlighted.replace(regex, (match) => `<span class="${className}">${match}</span>`);
    });
    return highlighted;
  }

  function applyHighlights(clue) {
    let result = clueText.dataset.baseClue || clue.clue;

    if (revealedHints.definition && clue.definition) {
      setHintUsed(showDefinitionBtn, true);
      if (typeof clue.definition === "object") {
        result = highlightTermByOccurrence(result, clue.definition.text, clue.definition.occurrence, "highlight-definition");
      } else {
        result = highlightTerms(result, [clue.definition], "highlight-definition");
      }
    }
    if (revealedHints.indicators && Array.isArray(clue.indicators)) {
      setHintUsed(showIndicatorsBtn, true);
      clue.indicators.forEach(ind => {
        if (typeof ind === "object") {
          result = highlightTermByOccurrence(result, ind.text, ind.occurrence, "highlight-indicator");
        } else {
          result = highlightTerms(result, [ind], "highlight-indicator");
        }
      });
    }
    if (revealedHints.fodder && Array.isArray(clue.fodder) && clue.fodder.length) {
      setHintUsed(showFodderBtn, true);
      clue.fodder.forEach(fod => {
        if (typeof fod === "object") {
          result = highlightTermByOccurrence(result, fod.text, fod.occurrence, "highlight-fodder");
        } else {
          result = highlightTerms(result, [fod], "highlight-fodder");
        }
      });
    }

    clueText.innerHTML = `${result} ${createEnumeration(clue.answer)}`;
  }

  function restoreLetters(correctAnswer) {
    const inputs = [...inputGrid.querySelectorAll("input")];
    revealedLetters.forEach(pos => {
      const input = inputs[pos];
      if (input) {
        input.value = correctAnswer[pos];
        input.disabled = true;
        input.classList.add("revealed-letter");
      }
    });
  }

  function restoreInput(userInput) {
    if (userInput) {
      const inputs = [...inputGrid.querySelectorAll("input")];
      userInput.forEach((val, i) => {
        if (inputs[i] && !inputs[i].disabled) {
          inputs[i].value = val;
        }
      });
    }
  }

  function resetPuzzle() {
    // Clear storage for current puzzle
    localStorage.removeItem(getStorageKey());

    // Reset state
    solvedStatus = false;
    document.body.classList.remove("solved");

    // Reset hint buttons
    setHintUsed(showDefinitionBtn, false);
    setHintUsed(showIndicatorsBtn, false);
    setHintUsed(showFodderBtn, false);
    revealedHints = { definition: false, fodder: false, indicators: false };
    revealedLetters = [];
    hintsUsed = 0;
    renderHintDots();
    setHintsUsedUI();

    // Show all hint controls
    document.querySelectorAll(".hint-option").forEach(btn => {
      btn.style.display = "inline-block";
    });

    hintBtn.disabled = false;

    // Load the puzzle
    loadPuzzle();
  }

  function loadPuzzle() {
    const clue = clues[currentPuzzleIndex];
    if (!clue) return;

    clueDate.textContent = `Puzzle #${currentPuzzleIndex + 1} of ${clues.length}`;
    clueText.dataset.baseClue = clue.clue;
    clueAnswer = clue.answer;

    const lettersCount = clueAnswer.replace(/\s/g, "").length;
    buildHintDots(lettersCount + 3);

    renderEndCard(clue);

    const saved = loadProgress();
    revealedHints = saved.revealedHints;
    revealedLetters = saved.revealedLetters;
    hintsUsed = Object.values(revealedHints).filter(Boolean).length + revealedLetters.length;
    renderHintDots();
    setHintsUsedUI();
    solvedStatus = saved.solvedStatus;
    userInput = saved.userInput;

    setHintUsed(showDefinitionBtn, !!revealedHints.definition);
    setHintUsed(showIndicatorsBtn, !!revealedHints.indicators);
    setHintUsed(showFodderBtn,    !!revealedHints.fodder);

    const noSpace = clue.answer.replace(/\s/g, "");
    const indices = Array.from({ length: noSpace.length }, (_, i) => i);
    revealOrder = seededShuffle(indices, currentPuzzleIndex + 1);
    revealIndex = revealedLetters.length;

    createInputGrid(clue.answer);
    restoreLetters(noSpace);
    restoreInput(userInput);
    setCheckEnabled(isGridComplete());
    applyHighlights(clue);

    if (saved.cursorPos !== undefined && saved.cursorPos >= 0) {
      const inputs = [...inputGrid.querySelectorAll("input")];
      const target = inputs[saved.cursorPos];
      if (target && !target.disabled) {
        setTimeout(() => setActiveBox(target), 0);
      }
    }

    if(solvedStatus) {
      markAsSolved();
    }
  }

  function loadPrevPuzzle() {
    if (clues.length === 0) return;
    currentPuzzleIndex = (currentPuzzleIndex - 1 + clues.length) % clues.length;
    resetPuzzle();
  }

  function loadNextPuzzle() {
    if (clues.length === 0) return;
    currentPuzzleIndex = (currentPuzzleIndex + 1) % clues.length;
    resetPuzzle();
  }

  function loadRandomPuzzle() {
    if (clues.length === 0) return;
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * clues.length);
    } while (clues.length > 1 && newIndex === currentPuzzleIndex);
    currentPuzzleIndex = newIndex;
    resetPuzzle();
  }

  function getUserGuess() {
    let guess = "";
    inputGrid.childNodes.forEach(node => {
      if (node.tagName === "INPUT") {
        guess += node.value || "";
      } else {
        guess += " ";
      }
    });
    return guess.trim();
  }

  function markAsSolved() {
    solvedStatus = true;
    document.body.classList.add("solved");

    requestAnimationFrame(() => {
      fitHintBarToWidth();
    });

    inputGrid.querySelectorAll("input").forEach(inp => {
      inp.disabled = true;
      inp.classList.add("solved-letter");
    });

    document.querySelectorAll(".hint-option").forEach(btn => {
      btn.style.display = "none";
    });

    setCheckEnabled(false);
    hintBtn.disabled = true;

    closeHintModal();

    if (activeBox) {
      activeBox.classList.remove("active");
      activeBox = null;
    }

    setHintsUsedUI();
    saveProgress();
  }

  checkBtn.addEventListener("click", () => {
    const userGuess = getUserGuess().toUpperCase();
    const correctAnswer = clueAnswer.toUpperCase();

    if (userGuess === correctAnswer) {
      markAsSolved();
    } else {
      inputGrid.classList.remove("wrong");
      void inputGrid.offsetWidth;
      inputGrid.classList.add("wrong");

      inputGrid.addEventListener(
        "animationend",
        () => inputGrid.classList.remove("wrong"),
        { once: true }
      );
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (!checkBtn.disabled) checkBtn.click();
      return;
    }
    if (e.key === "Escape") {
      if (!hintModal.classList.contains("hidden")) closeHintModal();
      if (!hintToast.classList.contains("hidden")) hideHintToast();
      return;
    }
  });

  // Modal controls
  hintBtn.addEventListener("click", openHintModal);
  closeBtn.addEventListener("click", closeHintModal);

  window.addEventListener("click", (e) => {
    if (e.target === hintModal) closeHintModal();
  });

  // Navigation buttons
  if (prevBtn) prevBtn.addEventListener("click", loadPrevPuzzle);
  if (nextBtn) nextBtn.addEventListener("click", loadNextPuzzle);
  if (randomBtn) randomBtn.addEventListener("click", loadRandomPuzzle);
  if (resetBtn) resetBtn.addEventListener("click", resetPuzzle);

  function setHintUsed(btn, used) {
    if (used) {
      btn.classList.add("is-disabled");
    } else {
      btn.classList.remove("is-disabled");
    }
  }

  function incrementHintsUsed() {
    hintsUsed++;
    renderHintDots();
    setHintsUsedUI();
    saveProgress();
  }

  showLetterBtn.addEventListener("click", () => {
    closeHintModal();

    const correctAnswer = clueAnswer.toUpperCase().replace(/\s/g, "");
    const inputs = [...inputGrid.querySelectorAll("input")];

    if (revealIndex >= revealOrder.length) {
      alert("No more letters to reveal!");
      return;
    }

    const pos = revealOrder[revealIndex];
    revealIndex++;

    const targetInput = inputs[pos];
    if (!targetInput) return;

    targetInput.value = correctAnswer[pos];
    targetInput.disabled = true;
    targetInput.classList.add("revealed-letter");

    revealedLetters.push(pos);
    setCheckEnabled(isGridComplete());

    incrementHintsUsed();

    if (revealedLetters.length === correctAnswer.length) {
      markAsSolved();
    }
  });

  function showHintToast(text = "") {
    if (text === "") return;
    hintToastText.textContent = text;
    hintToast.classList.remove("hidden");
  }

  function hideHintToast() {
    hintToast.classList.add("hidden");
  }

  function openHintModal() {
    hintModal.classList.remove("hidden");
  }

  function closeHintModal() {
    hintModal.classList.add("hidden");
  }
  // ... (keep the main.js from previous message, but verify markAsSolved function)

function markAsSolved() {
  solvedStatus = true;
  document.body.classList.add("solved");

  requestAnimationFrame(() => {
    fitHintBarToWidth();
  });

  inputGrid.querySelectorAll("input").forEach(inp => {
    inp.disabled = true;
    inp.classList.add("solved-letter");
  });

  // Don't hide hint options - let them remain visible but disabled
  // Just update their visual state
  setHintUsed(showDefinitionBtn, true);
  setHintUsed(showIndicatorsBtn, true);
  setHintUsed(showFodderBtn, true);

  setCheckEnabled(false);
  hintBtn.disabled = true;

  closeHintModal();

  if (activeBox) {
    activeBox.classList.remove("active");
    activeBox = null;
  }

  setHintsUsedUI();
  saveProgress();
  }

  hintToastClose.addEventListener("click", (e) => {
    e.stopPropagation();
    hideHintToast();
  });

  hintToastContent.addEventListener("click", (e) => e.stopPropagation());

  showDefinitionBtn.addEventListener("click", () => {
    const clue = clues[currentPuzzleIndex];
    if (revealedHints.definition) {
      closeHintModal();
      showHintToast(clue.def_text);
      return;
    }
    closeHintModal();
    revealedHints.definition = true;
    applyHighlights(clue);
    incrementHintsUsed();
    showHintToast(clue.def_text);
  });

  showIndicatorsBtn.addEventListener("click", () => {
    const clue = clues[currentPuzzleIndex];
    if (revealedHints.indicators) {
      closeHintModal();
      showHintToast(clue.ind_text);
      return;
    }
    closeHintModal();
    revealedHints.indicators = true;
    applyHighlights(clue);
    incrementHintsUsed();
    showHintToast(clue.ind_text);
  });

  showFodderBtn.addEventListener("click", () => {
    const clue = clues[currentPuzzleIndex];
    if (revealedHints.fodder) {
      closeHintModal();
      showHintToast(clue.fod_text);
      return;
    }
    closeHintModal();
    revealedHints.fodder = true;
    applyHighlights(clue);
    incrementHintsUsed();
    showHintToast(clue.fod_text);
  });

  loadClues();
});
