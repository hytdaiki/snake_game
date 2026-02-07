import { createGame, reset, setDirection, step } from "./game.js";

const rootEl = document.querySelector("[data-root]");
const boardWrapEl = document.querySelector("[data-board-wrap]");
const gridEl = document.querySelector("[data-grid]");
const scoreEl = document.querySelector("[data-score]");
const statusEl = document.querySelector("[data-status]");
const levelEl = document.querySelector("[data-level]");
const speedEl = document.querySelector("[data-speed]");
const obstaclesEl = document.querySelector("[data-obstacles]");
const boardSizeEl = document.querySelector("[data-board-size]");
const overlayEl = document.querySelector("[data-overlay]");
const uiModeLabelEl = document.querySelector("[data-ui-mode-label]");
const uiModeButtons = Array.from(document.querySelectorAll("[data-ui-mode-btn]"));
const startBtn = document.querySelector("[data-start]");
const restartBtn = document.querySelector("[data-restart]");
const pauseBtn = document.querySelector("[data-pause]");
const touchControls = document.querySelector("[data-controls]");
const rankingListEl = document.querySelector("[data-ranking-list]");
const rankingResetBtn = document.querySelector("[data-ranking-reset]");

const KEY_TO_DIR = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

const SCROLL_BLOCK_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "]);
const DIR_ANGLE = { right: 0, down: 90, left: 180, up: 270 };
const LEADERBOARD_KEY = "snake_leaderboard_v1";
const UI_MODE_KEY = "snake_ui_mode_v1";
const LEADERBOARD_LIMIT = 10;
const SNAKE_COLOR_FILTERS = [
  "hue-rotate(0deg) saturate(1)",
  "hue-rotate(24deg) saturate(1.05)",
  "hue-rotate(52deg) saturate(1.15)",
  "hue-rotate(92deg) saturate(1.2)",
  "hue-rotate(138deg) saturate(1.12)",
  "hue-rotate(182deg) saturate(1.1)",
  "hue-rotate(232deg) saturate(1.12)",
  "hue-rotate(286deg) saturate(1.2)",
];

const state = createGame({ rows: 15, cols: 15 });
const BASE_TICK_MS = 240;
const TICK_STEP_MS = 20;
const MIN_TICK_MS = 80;

let tickMs = speedForScore(state.score);
let timer = null;
let queuedDir = null;
let leaderboard = loadLeaderboard();
let uiModePreference = loadUiModePreference();
let uiMode = resolveUiMode(uiModePreference);
let gameStarted = false;
let runStartedAt = 0;
let pausedStartedAt = null;
let pausedAccumMs = 0;
let gameOverHandled = false;
let touchStart = null;

function levelForScore(score) {
  return Math.floor(score / 5) + 1;
}

function speedForScore(score) {
  const levelUps = Math.floor(score / 5);
  return Math.max(MIN_TICK_MS, BASE_TICK_MS - levelUps * TICK_STEP_MS);
}

function normalizedUiMode(mode) {
  if (mode === "desktop" || mode === "mobile" || mode === "auto") return mode;
  return null;
}

function loadUiModePreference() {
  const urlMode = normalizedUiMode(new URLSearchParams(window.location.search).get("mode"));
  if (urlMode) return urlMode;
  try {
    return normalizedUiMode(localStorage.getItem(UI_MODE_KEY)) ?? "auto";
  } catch {
    return "auto";
  }
}

function saveUiModePreference(mode) {
  try {
    localStorage.setItem(UI_MODE_KEY, mode);
  } catch {
    // localStorage may be unavailable in restricted modes.
  }
}

function detectDeviceUiMode() {
  const narrowViewport = window.matchMedia("(max-width: 820px)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  return narrowViewport || coarsePointer || noHover ? "mobile" : "desktop";
}

function resolveUiMode(preference) {
  return preference === "auto" ? detectDeviceUiMode() : preference;
}

function applyUiMode() {
  uiMode = resolveUiMode(uiModePreference);
  rootEl.dataset.uiMode = uiMode;
  rootEl.dataset.uiModePreference = uiModePreference;

  const labelSuffix = uiModePreference === "auto" ? " (auto)" : "";
  if (uiModeLabelEl) uiModeLabelEl.textContent = `${uiMode}${labelSuffix}`;
  for (const btn of uiModeButtons) {
    const active = btn.dataset.uiModeBtn === uiModePreference;
    btn.setAttribute("aria-pressed", String(active));
  }
}

function setUiModePreference(nextMode) {
  const normalized = normalizedUiMode(nextMode);
  if (!normalized) return;
  uiModePreference = normalized;
  saveUiModePreference(uiModePreference);
  applyUiMode();
}

function snakeFilterForScore(score) {
  const band = Math.floor(score / 5);
  return SNAKE_COLOR_FILTERS[band % SNAKE_COLOR_FILTERS.length];
}

function directionToAngle(dir) {
  return DIR_ANGLE[dir] ?? 0;
}

function vectorToDir(dx, dy) {
  if (dx === 1 && dy === 0) return "right";
  if (dx === -1 && dy === 0) return "left";
  if (dx === 0 && dy === 1) return "down";
  if (dx === 0 && dy === -1) return "up";
  return "right";
}

function normalizeName(input) {
  if (typeof input !== "string") return "Anonymous";
  const trimmed = input.trim().slice(0, 20);
  return trimmed || "Anonymous";
}

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function sortLeaderboard(entries) {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.durationMs !== b.durationMs) return a.durationMs - b.durationMs;
    return a.dateISO.localeCompare(b.dateISO);
  });
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const score = Number(raw.score);
  const durationMs = Number(raw.durationMs);
  const level = Number(raw.level);
  const speedMs = Number(raw.speedMs);
  if (!Number.isFinite(score) || score < 0) return null;
  if (!Number.isFinite(durationMs) || durationMs < 0) return null;
  if (!Number.isFinite(level) || level < 1) return null;
  if (!Number.isFinite(speedMs) || speedMs < 1) return null;

  const dateISO = typeof raw.dateISO === "string" ? raw.dateISO : new Date().toISOString();
  return {
    name: normalizeName(raw.name),
    score,
    dateISO,
    durationMs,
    level,
    speedMs,
    boardSize: typeof raw.boardSize === "string" ? raw.boardSize : `${state.cols}x${state.rows}`,
  };
}

function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed.map(normalizeEntry).filter(Boolean);
    return sortLeaderboard(normalized).slice(0, LEADERBOARD_LIMIT);
  } catch {
    return [];
  }
}

function saveLeaderboard(entries) {
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
  } catch {
    // localStorage may be unavailable in restricted modes.
  }
}

function renderLeaderboard() {
  rankingListEl.innerHTML = "";
  if (leaderboard.length === 0) {
    const item = document.createElement("li");
    item.className = "ranking-item ranking-item-empty";
    item.textContent = "No records yet. Reach Game Over to save your first run.";
    rankingListEl.appendChild(item);
    return;
  }

  leaderboard.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = `ranking-item${index === 0 ? " ranking-top" : ""}`;
    const timeLabel = new Date(entry.dateISO).toLocaleString();
    item.textContent =
      `#${index + 1} ${entry.name} - ${entry.score}pt - ${formatDuration(entry.durationMs)} - ` +
      `Lv.${entry.level} / ${entry.speedMs}ms - ${entry.boardSize} - ${timeLabel}`;
    rankingListEl.appendChild(item);
  });
}

function qualifiesForLeaderboard(candidate) {
  if (candidate.score <= 0) return false;
  if (leaderboard.length < LEADERBOARD_LIMIT) return true;
  const simulated = sortLeaderboard([...leaderboard, candidate]).slice(0, LEADERBOARD_LIMIT);
  return simulated.some((entry) => entry === candidate);
}

function saveRunToLeaderboard() {
  const candidate = {
    name: "Anonymous",
    score: state.score,
    dateISO: new Date().toISOString(),
    durationMs: currentRunDurationMs(),
    level: levelForScore(state.score),
    speedMs: speedForScore(state.score),
    boardSize: `${state.cols}x${state.rows}`,
  };

  if (qualifiesForLeaderboard(candidate)) {
    const name = window.prompt("Top 10! Enter your name (optional):", "");
    candidate.name = normalizeName(name);
    leaderboard = sortLeaderboard([...leaderboard, candidate]).slice(0, LEADERBOARD_LIMIT);
    saveLeaderboard(leaderboard);
  }

  renderLeaderboard();
}

function currentRunDurationMs() {
  if (!runStartedAt) return 0;
  const now = Date.now();
  const activePauseMs = state.paused && pausedStartedAt ? now - pausedStartedAt : 0;
  return Math.max(0, now - runStartedAt - pausedAccumMs - activePauseMs);
}

function beginRunClock() {
  runStartedAt = Date.now();
  pausedStartedAt = null;
  pausedAccumMs = 0;
}

function queueDirection(dir) {
  if (!gameStarted || !state.alive || state.paused) return;
  if (!dir) return;
  if (!queuedDir) queuedDir = dir;
}

function refreshSpeed() {
  const nextTickMs = speedForScore(state.score);
  if (nextTickMs === tickMs) return;
  tickMs = nextTickMs;
  if (timer && state.alive && !state.paused) {
    stop();
    start();
  }
}

function turnAngleForLinks(dirA, dirB) {
  const links = new Set([dirA, dirB]);
  if (links.has("right") && links.has("down")) return 0;
  if (links.has("down") && links.has("left")) return 90;
  if (links.has("left") && links.has("up")) return 180;
  if (links.has("up") && links.has("right")) return 270;
  return 0;
}

function segmentVisual(i) {
  if (i === 0) {
    return { type: "head", angle: directionToAngle(state.dir) };
  }

  if (i === state.snake.length - 1) {
    const prev = state.snake[i - 1];
    const tail = state.snake[i];
    const tailDir = vectorToDir(tail.x - prev.x, tail.y - prev.y);
    return { type: "tail", angle: directionToAngle(tailDir) };
  }

  const prev = state.snake[i - 1];
  const current = state.snake[i];
  const next = state.snake[i + 1];
  const toPrevDir = vectorToDir(prev.x - current.x, prev.y - current.y);
  const toNextDir = vectorToDir(next.x - current.x, next.y - current.y);
  const links = new Set([toPrevDir, toNextDir]);
  const isHorizontal = links.has("left") && links.has("right");
  const isVertical = links.has("up") && links.has("down");

  if (isHorizontal || isVertical) {
    return { type: "body", angle: isVertical ? 90 : 0 };
  }

  return { type: "turn", angle: turnAngleForLinks(toPrevDir, toNextDir) };
}

function buildSnakeMap() {
  const mapped = new Map();
  for (let i = 0; i < state.snake.length; i += 1) {
    const segment = state.snake[i];
    const key = `${segment.x},${segment.y}`;
    mapped.set(key, segmentVisual(i));
  }
  return mapped;
}

function render() {
  gridEl.style.setProperty("--rows", state.rows);
  gridEl.style.setProperty("--cols", state.cols);
  gridEl.style.setProperty("--snake-filter", snakeFilterForScore(state.score));
  gridEl.innerHTML = "";

  const snakeMap = buildSnakeMap();
  const obstacleCells = new Set(state.obstacles.map((o) => `${o.x},${o.y}`));
  const foodKey = `${state.food.x},${state.food.y}`;

  for (let y = 0; y < state.rows; y += 1) {
    for (let x = 0; x < state.cols; x += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      const key = `${x},${y}`;
      const segment = snakeMap.get(key);
      if (segment) {
        cell.classList.add("entity", `snake-${segment.type}`);
        cell.style.setProperty("--rot", `${segment.angle}deg`);
      } else if (key === foodKey) {
        cell.classList.add("entity", "food");
      } else if (obstacleCells.has(key)) {
        cell.classList.add("entity", "obstacle");
      }
      gridEl.appendChild(cell);
    }
  }

  scoreEl.textContent = String(state.score);
  statusEl.textContent = !state.alive ? "Game Over" : !gameStarted ? "Ready" : state.paused ? "Paused" : "Running";
  levelEl.textContent = String(levelForScore(state.score));
  speedEl.textContent = `${speedForScore(state.score)}ms`;
  obstaclesEl.textContent = String(state.obstacles.length);
  boardSizeEl.textContent = `${state.cols}x${state.rows}`;
  pauseBtn.textContent = state.paused ? "Resume" : "Pause";
  pauseBtn.disabled = !state.alive || !gameStarted;
  startBtn.disabled = state.alive && gameStarted && !state.paused;
  startBtn.textContent = !state.alive ? "New Game" : !gameStarted ? "Start" : state.paused ? "Resume" : "Started";

  if (!state.alive) {
    overlayEl.textContent = "Game Over";
    overlayEl.hidden = false;
  } else if (!gameStarted) {
    overlayEl.textContent = "Press Start";
    overlayEl.hidden = false;
  } else if (state.paused) {
    overlayEl.textContent = "Paused";
    overlayEl.hidden = false;
  } else {
    overlayEl.hidden = true;
  }
}

function handleGameOver() {
  if (gameOverHandled) return;
  gameOverHandled = true;
  saveRunToLeaderboard();
}

function loop() {
  const wasAlive = state.alive;
  if (queuedDir) {
    setDirection(state, queuedDir);
    queuedDir = null;
  }

  step(state);
  refreshSpeed();
  render();

  if (wasAlive && !state.alive) {
    stop();
    handleGameOver();
    render();
  }
}

function start() {
  if (timer || !state.alive || state.paused) return;
  timer = setInterval(loop, tickMs);
}

function stop() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

function setPaused(shouldPause) {
  if (!state.alive || !gameStarted) return;
  if (state.paused === shouldPause) return;

  state.paused = shouldPause;
  if (shouldPause) {
    pausedStartedAt = Date.now();
    stop();
  } else {
    if (pausedStartedAt) pausedAccumMs += Date.now() - pausedStartedAt;
    pausedStartedAt = null;
    start();
  }
  render();
}

function focusBoard() {
  boardWrapEl.focus();
}

function startGame() {
  if (!state.alive) {
    restart();
  }
  if (!gameStarted) {
    gameStarted = true;
    beginRunClock();
  }
  if (state.paused) {
    if (pausedStartedAt) pausedAccumMs += Date.now() - pausedStartedAt;
    pausedStartedAt = null;
    state.paused = false;
  }
  start();
  render();
  focusBoard();
}

function restart() {
  stop();
  reset(state);
  queuedDir = null;
  tickMs = speedForScore(state.score);
  gameStarted = false;
  runStartedAt = 0;
  pausedStartedAt = null;
  pausedAccumMs = 0;
  gameOverHandled = false;
  render();
  focusBoard();
}

function handleKey(e) {
  const normalizedKey = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const dir = KEY_TO_DIR[normalizedKey];

  if (SCROLL_BLOCK_KEYS.has(e.key)) e.preventDefault();

  if (dir) {
    if (e.repeat) return;
    queueDirection(dir);
    return;
  }

  if (e.repeat) return;

  if (normalizedKey === " " || normalizedKey === "p") {
    setPaused(!state.paused);
    return;
  }

  if (normalizedKey === "enter") {
    startGame();
    return;
  }

  if (normalizedKey === "r") {
    restart();
  }
}

function handleSwipeStart(e) {
  if (!e.changedTouches || e.changedTouches.length === 0) return;
  const touch = e.changedTouches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
}

function handleSwipeEnd(e) {
  if (!touchStart || !e.changedTouches || e.changedTouches.length === 0) return;
  const touch = e.changedTouches[0];
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  touchStart = null;

  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
  queueDirection(dir);
}

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", restart);
pauseBtn.addEventListener("click", () => {
  setPaused(!state.paused);
});

rankingResetBtn.addEventListener("click", () => {
  if (!leaderboard.length) return;
  const ok = window.confirm("Reset ranking? This cannot be undone.");
  if (!ok) return;
  leaderboard = [];
  saveLeaderboard(leaderboard);
  renderLeaderboard();
});

document.addEventListener("keydown", handleKey);

if (touchControls) {
  touchControls.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-dir]");
    if (!btn) return;
    queueDirection(btn.dataset.dir);
    focusBoard();
  });
}

for (const btn of uiModeButtons) {
  btn.addEventListener("click", () => {
    setUiModePreference(btn.dataset.uiModeBtn);
  });
}

boardWrapEl.addEventListener("touchstart", handleSwipeStart, { passive: true });
boardWrapEl.addEventListener("touchend", handleSwipeEnd, { passive: true });
rootEl.addEventListener("pointerdown", focusBoard);
window.addEventListener("resize", () => {
  if (uiModePreference === "auto") applyUiMode();
});

applyUiMode();
renderLeaderboard();
restart();
