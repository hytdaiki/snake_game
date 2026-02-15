import { createGame, reset, setDirection, step } from "./game.js";

const rootEl = document.querySelector("[data-root]");
const boardWrapEl = document.querySelector("[data-board-wrap]");
const gridEl = document.querySelector("[data-grid]");
const scoreEl = document.querySelector("[data-score]");
const bestScoreEl = document.querySelector("[data-best-score]");
const statusEl = document.querySelector("[data-status]");
const levelEl = document.querySelector("[data-level]");
const speedEl = document.querySelector("[data-speed]");
const obstaclesEl = document.querySelector("[data-obstacles]");
const boardSizeEl = document.querySelector("[data-board-size]");
const overlayEl = document.querySelector("[data-overlay]");
const uiModeLabelEl = document.querySelector("[data-ui-mode-label]");
const settingsOpenBtn = document.querySelector("[data-settings-open]");
const settingsCloseBtn = document.querySelector("[data-settings-close]");
const settingsBackdropEl = document.querySelector("[data-settings-backdrop]");
const settingsPanelEl = document.querySelector("[data-settings-panel]");
const swipeSettingEl = document.querySelector("[data-setting-swipe]");
const uiModeSettingEls = Array.from(document.querySelectorAll("[data-setting-ui-mode]"));
const adsStatusEl = document.querySelector("[data-ads-status]");
const removeAdsBtn = document.querySelector("[data-setting-remove-ads]");
const restorePurchasesBtn = document.querySelector("[data-setting-restore-purchases]");
const startBtn = document.querySelector("[data-start]");
const restartBtn = document.querySelector("[data-restart]");
const pauseBtn = document.querySelector("[data-pause]");
const touchControls = document.querySelector("[data-controls]");
const adSlotEl = document.querySelector("[data-ad-slot]");
const rankingListEl = document.querySelector("[data-ranking-list]");
const rankingResetBtn = document.querySelector("[data-ranking-reset]");
const effectsEl = document.querySelector("[data-effects]");
const gameoverPanelEl = document.querySelector("[data-gameover]");
const gameoverScoreEl = document.querySelector("[data-gameover-score]");
const gameoverBestEl = document.querySelector("[data-gameover-best]");
const gameoverTierEl = document.querySelector("[data-gameover-tier]");
const gameoverCardEl = document.querySelector("[data-gameover-card]");
const gameoverContinueBtn = document.querySelector("[data-gameover-continue]");
const gameoverRestartBtn = document.querySelector("[data-gameover-restart]");
const gameoverShareBtn = document.querySelector("[data-gameover-share]");
const gameoverCloseBtn = document.querySelector("[data-gameover-close]");

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
const BEST_SCORE_KEY = "snake_best_score_v1";
const UI_MODE_KEY = "snake_ui_mode_v1";
const SWIPE_ENABLED_KEY = "snake_swipe_enabled_v1";
const ADS_REMOVED_KEY = "snake_ads_removed_v1";
const LEADERBOARD_LIMIT = 10;
const SWIPE_THRESHOLD_PX = 28;
const OBSTACLE_EXPLOSION_MS = 330;
const ENABLE_PLACEHOLDER_REWARDED_CONTINUE = false;
const GAMEOVER_TIERS = [
  { minScore: 60, key: "legend", label: "Legend Tier 60+" },
  { minScore: 50, key: "gold", label: "Gold Tier 50+" },
  { minScore: 40, key: "silver", label: "Silver Tier 40+" },
  { minScore: 30, key: "bronze", label: "Bronze Tier 30+" },
];
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
let bestScore = loadBestScore();
let leaderboard = loadLeaderboard();
let uiModePreference = loadUiModePreference();
let uiMode = resolveUiMode(uiModePreference);
let swipeEnabled = loadSwipeEnabled();
let adsRemoved = loadAdsRemoved();
let shouldShowAds = !adsRemoved;
let settingsOpen = false;
let gameStarted = false;
let runStartedAt = 0;
let pausedStartedAt = null;
let pausedAccumMs = 0;
let gameOverHandled = false;
let deathSequenceActive = false;
let deathTimerId = null;
let gameoverVisible = false;
let gestureStart = null;
let lastBoardWrapW = 0;
let lastBoardWrapH = 0;
let lastBoardPx = 0;

function syncBoardSize() {
  if (!boardWrapEl || !gridEl) return;
  if (uiMode !== "mobile") {
    if (lastBoardPx) {
      gridEl.style.width = "";
      gridEl.style.height = "";
    }
    lastBoardWrapW = 0;
    lastBoardWrapH = 0;
    lastBoardPx = 0;
    return;
  }

  const w = boardWrapEl.clientWidth;
  const h = boardWrapEl.clientHeight;
  if (!w || !h) return;
  if (w === lastBoardWrapW && h === lastBoardWrapH) return;

  lastBoardWrapW = w;
  lastBoardWrapH = h;
  const size = Math.floor(Math.min(w, h));
  if (!size) return;
  if (size === lastBoardPx) return;
  lastBoardPx = size;

  gridEl.style.width = `${size}px`;
  gridEl.style.height = `${size}px`;
}


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

function loadSwipeEnabled() {
  const urlValue = new URLSearchParams(window.location.search).get("swipe");
  if (urlValue === "1") return true;
  if (urlValue === "0") return false;
  try {
    return localStorage.getItem(SWIPE_ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

function saveSwipeEnabled(enabled) {
  try {
    localStorage.setItem(SWIPE_ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    // localStorage may be unavailable in restricted modes.
  }
}

function loadAdsRemoved() {
  try {
    return localStorage.getItem(ADS_REMOVED_KEY) === "1";
  } catch {
    return false;
  }
}

function saveAdsRemoved(removed) {
  try {
    localStorage.setItem(ADS_REMOVED_KEY, removed ? "1" : "0");
  } catch {
    // localStorage may be unavailable in restricted modes.
  }
}

function applyAdsUi() {
  shouldShowAds = !adsRemoved;
  rootEl.dataset.adsRemoved = adsRemoved ? "true" : "false";
  if (adSlotEl) adSlotEl.hidden = !shouldShowAds;
  if (adsStatusEl) {
    adsStatusEl.textContent = adsRemoved
      ? "Ads removed (mock purchase active)."
      : "Ads enabled (non-personalized placeholder).";
  }
  if (removeAdsBtn) removeAdsBtn.disabled = adsRemoved;
}

function setAdsRemoved(nextRemoved) {
  adsRemoved = Boolean(nextRemoved);
  saveAdsRemoved(adsRemoved);
  applyAdsUi();
}

function detectDeviceUiMode() {
  const narrowViewport = window.matchMedia("(max-width: 768px)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const touchPoints = typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : 0;
  const touchCapable = touchPoints > 0 || "ontouchstart" in window;
  return narrowViewport || coarsePointer || touchCapable ? "mobile" : "desktop";
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
  for (const input of uiModeSettingEls) {
    input.checked = input.value === uiModePreference;
  }
  syncBoardSize();
}

function setUiModePreference(nextMode) {
  const normalized = normalizedUiMode(nextMode);
  if (!normalized) return;
  uiModePreference = normalized;
  saveUiModePreference(uiModePreference);
  applyUiMode();
}

function applySwipeSettingUi() {
  if (!swipeSettingEl) return;
  swipeSettingEl.checked = swipeEnabled;
}

function setSwipeEnabled(nextEnabled) {
  swipeEnabled = Boolean(nextEnabled);
  saveSwipeEnabled(swipeEnabled);
  applySwipeSettingUi();
  if (!swipeEnabled) gestureStart = null;
}

function setSettingsOpen(shouldOpen) {
  if (!settingsPanelEl || !settingsBackdropEl) return;
  settingsOpen = shouldOpen;
  rootEl.dataset.settingsOpen = shouldOpen ? "true" : "false";
  settingsBackdropEl.hidden = !shouldOpen;
  settingsPanelEl.hidden = !shouldOpen;
  document.body.style.overflow = shouldOpen ? "hidden" : "";
  if (shouldOpen) {
    applySwipeSettingUi();
    applyUiMode();
    const focusTarget = settingsPanelEl.querySelector("input, button") || settingsCloseBtn;
    if (focusTarget && focusTarget.focus) focusTarget.focus();
  } else if (settingsOpenBtn && settingsOpenBtn.focus) {
    settingsOpenBtn.focus();
  }
}

function openSettings() {
  setSettingsOpen(true);
}

function closeSettings() {
  setSettingsOpen(false);
}

function snakeFilterForScore(score) {
  const band = Math.floor(score / 5);
  return SNAKE_COLOR_FILTERS[band % SNAKE_COLOR_FILTERS.length];
}

function directionToAngle(dir) {
  return DIR_ANGLE[dir] ?? 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

function loadBestScore() {
  try {
    const raw = Number(localStorage.getItem(BEST_SCORE_KEY));
    if (!Number.isFinite(raw) || raw < 0) return 0;
    return Math.floor(raw);
  } catch {
    return 0;
  }
}

function saveBestScore(value) {
  const normalized = Math.max(0, Math.floor(value));
  bestScore = normalized;
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(normalized));
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

function clearEffects() {
  if (!effectsEl) return;
  effectsEl.innerHTML = "";
}

function hideGameoverPanel() {
  gameoverVisible = false;
  if (gameoverPanelEl) gameoverPanelEl.hidden = true;
  if (gameoverTierEl) {
    gameoverTierEl.hidden = true;
    gameoverTierEl.textContent = "";
  }
  if (gameoverCardEl) gameoverCardEl.removeAttribute("data-tier");
}

function tierForScore(score) {
  for (const tier of GAMEOVER_TIERS) {
    if (score >= tier.minScore) return tier;
  }
  return null;
}

function createBurst(cell, { celebration = false } = {}) {
  if (!effectsEl) return;
  const x = Number.isFinite(cell?.x) ? clamp(cell.x, 0, state.cols - 1) : Math.floor(state.cols / 2);
  const y = Number.isFinite(cell?.y) ? clamp(cell.y, 0, state.rows - 1) : Math.floor(state.rows / 2);
  const xPct = ((x + 0.5) / state.cols) * 100;
  const yPct = ((y + 0.5) / state.rows) * 100;

  const burst = document.createElement("div");
  burst.className = `explosion${celebration ? " explosion-celebration" : ""}`;
  burst.style.setProperty("--x", `${xPct}%`);
  burst.style.setProperty("--y", `${yPct}%`);

  const flash = document.createElement("div");
  flash.className = "explosion-flash";
  flash.style.setProperty("--x", `${xPct}%`);
  flash.style.setProperty("--y", `${yPct}%`);
  burst.appendChild(flash);

  if (!celebration) {
    const core = document.createElement("div");
    core.className = "explosion-core";
    burst.appendChild(core);
  }

  const particleCount = celebration ? 14 : 10;
  for (let i = 0; i < particleCount; i += 1) {
    const angle = (Math.PI * 2 * i) / particleCount;
    const radius = celebration ? 42 : 30;
    const particle = document.createElement("div");
    particle.className = "explosion-particle";
    particle.style.setProperty("--dx", `${Math.cos(angle) * radius}px`);
    particle.style.setProperty("--dy", `${Math.sin(angle) * radius}px`);
    if (celebration) {
      const color = ["#ffe699", "#ffd06b", "#ffeec0", "#ffdcb4"][i % 4];
      particle.style.background = color;
      particle.style.width = "5px";
      particle.style.height = "5px";
    }
    burst.appendChild(particle);
  }

  effectsEl.appendChild(burst);
  window.setTimeout(() => {
    burst.remove();
  }, celebration ? 460 : 380);
}

function showGameoverPanel() {
  if (!gameoverPanelEl || !gameoverScoreEl) return;
  gameoverScoreEl.textContent = String(state.score);
  if (gameoverBestEl) gameoverBestEl.textContent = String(bestScore);

  const tier = tierForScore(state.score);
  if (tier) {
    gameoverCardEl?.setAttribute("data-tier", tier.key);
    if (gameoverTierEl) {
      gameoverTierEl.hidden = false;
      gameoverTierEl.textContent = tier.label;
    }
    if (tier.key === "legend") {
      createBurst({ x: Math.floor(state.cols / 2), y: Math.floor(state.rows * 0.38) }, { celebration: true });
    }
  } else {
    gameoverCardEl?.removeAttribute("data-tier");
    if (gameoverTierEl) {
      gameoverTierEl.hidden = true;
      gameoverTierEl.textContent = "";
    }
  }

  gameoverVisible = true;
  gameoverPanelEl.hidden = false;

  if (gameoverContinueBtn) {
    gameoverContinueBtn.disabled = !ENABLE_PLACEHOLDER_REWARDED_CONTINUE;
  }
}

function adContext() {
  return {
    score: state.score,
    level: levelForScore(state.score),
    speedMs: speedForScore(state.score),
    obstacles: state.obstacles.length,
    boardSize: `${state.cols}x${state.rows}`,
  };
}

// Placeholder for future ad SDK (interstitial after game over, before restart).
async function requestInterstitial(_context) {
  return false;
}

// Placeholder for future ad SDK (rewarded continue once).
async function requestRewardedContinue(_context) {
  return false;
}

const purchaseBridge = {
  async purchaseRemoveAds() {
    return { adsRemoved: true };
  },
  async restorePurchases() {
    return { adsRemoved: loadAdsRemoved() };
  },
};

async function handleRemoveAdsPurchase() {
  const result = await purchaseBridge.purchaseRemoveAds();
  if (result?.adsRemoved) setAdsRemoved(true);
}

async function handleRestorePurchases() {
  const result = await purchaseBridge.restorePurchases();
  setAdsRemoved(Boolean(result?.adsRemoved));
}

async function shareScore() {
  if (state.alive) return;
  const text = `Snake Arcade score: ${state.score} (Lv.${levelForScore(state.score)} / ${speedForScore(state.score)}ms)`;

  try {
    if (navigator.share) {
      await navigator.share({ title: "Snake Arcade", text });
      return;
    }
  } catch {
    return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      window.alert("Score copied to clipboard.");
      return;
    }
  } catch {
    // noop
  }

  window.prompt("Copy your score:", text);
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
  syncBoardSize();
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
  if (bestScoreEl) bestScoreEl.textContent = String(bestScore);
  statusEl.textContent = !state.alive ? "Game Over" : !gameStarted ? "Ready" : state.paused ? "Paused" : "Running";
  levelEl.textContent = String(levelForScore(state.score));
  speedEl.textContent = `${speedForScore(state.score)}ms`;
  obstaclesEl.textContent = String(state.obstacles.length);
  boardSizeEl.textContent = `${state.cols}x${state.rows}`;
  rootEl.dataset.paused = state.paused && state.alive && gameStarted ? "true" : "false";
  pauseBtn.textContent = state.paused ? "Resume" : "Pause";
  pauseBtn.disabled = !state.alive || !gameStarted;
  startBtn.disabled = false;
  startBtn.textContent = "New Game";

  if (!state.alive) {
    if (deathSequenceActive || gameoverVisible) {
      overlayEl.hidden = true;
    } else {
      overlayEl.textContent = "Game Over";
      overlayEl.hidden = false;
    }
  } else if (!gameStarted) {
    overlayEl.textContent = "Tap New Game";
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
  if (state.score > bestScore) saveBestScore(state.score);
  saveRunToLeaderboard();
  showGameoverPanel();
}

function runDeathSequence() {
  const deathInfo = state.lastDeath;
  if (!deathInfo || deathInfo.cause !== "obstacle") {
    handleGameOver();
    render();
    return;
  }

  deathSequenceActive = true;
  boardWrapEl.classList.add("shake");
  createBurst(deathInfo.cell);
  render();

  if (deathTimerId) {
    window.clearTimeout(deathTimerId);
    deathTimerId = null;
  }

  deathTimerId = window.setTimeout(() => {
    deathTimerId = null;
    boardWrapEl.classList.remove("shake");
    deathSequenceActive = false;
    handleGameOver();
    render();
  }, OBSTACLE_EXPLOSION_MS);
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
    runDeathSequence();
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
  if (settingsOpen) return;
  boardWrapEl.focus();
}

function newGame() {
  restart();
  startGame();
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
  deathSequenceActive = false;
  if (deathTimerId) {
    window.clearTimeout(deathTimerId);
    deathTimerId = null;
  }
  gameStarted = false;
  runStartedAt = 0;
  pausedStartedAt = null;
  pausedAccumMs = 0;
  gameOverHandled = false;
  boardWrapEl.classList.remove("shake");
  clearEffects();
  hideGameoverPanel();
  render();
  focusBoard();
}

function handleKey(e) {
  if (settingsOpen) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeSettings();
    }
    return;
  }
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
    newGame();
    return;
  }

  if (normalizedKey === "r") {
    newGame();
  }
}

function beginGesture(x, y, pointerId = null) {
  gestureStart = { x, y, pointerId };
}

function endGesture(x, y, pointerId = null) {
  if (!gestureStart) return;
  if (gestureStart.pointerId !== null && pointerId !== null && gestureStart.pointerId !== pointerId) return;
  const dx = x - gestureStart.x;
  const dy = y - gestureStart.y;
  gestureStart = null;

  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD_PX) return;
  const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
  queueDirection(dir);
}

function handlePointerSwipeStart(e) {
  if (!swipeEnabled) return;
  if (e.pointerType === "mouse") return;
  beginGesture(e.clientX, e.clientY, e.pointerId);
  e.preventDefault();
}

function handlePointerSwipeEnd(e) {
  if (!swipeEnabled) return;
  if (e.pointerType === "mouse") return;
  endGesture(e.clientX, e.clientY, e.pointerId);
  e.preventDefault();
}

function handlePointerSwipeCancel(e) {
  if (gestureStart && gestureStart.pointerId === e.pointerId) gestureStart = null;
}

function handleTouchSwipeStart(e) {
  if (!swipeEnabled) return;
  if (!e.changedTouches || e.changedTouches.length === 0) return;
  const touch = e.changedTouches[0];
  beginGesture(touch.clientX, touch.clientY, null);
  e.preventDefault();
}

function handleTouchSwipeEnd(e) {
  if (!swipeEnabled) return;
  if (!e.changedTouches || e.changedTouches.length === 0) return;
  const touch = e.changedTouches[0];
  endGesture(touch.clientX, touch.clientY, null);
  e.preventDefault();
}

startBtn.addEventListener("click", newGame);
restartBtn.addEventListener("click", newGame);
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

if (settingsOpenBtn) {
  settingsOpenBtn.addEventListener("click", () => {
    openSettings();
  });
}

if (settingsCloseBtn) {
  settingsCloseBtn.addEventListener("click", () => {
    closeSettings();
  });
}

if (settingsBackdropEl) {
  settingsBackdropEl.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeSettings();
  });
}

if (settingsPanelEl) {
  settingsPanelEl.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
  });
}

if (swipeSettingEl) {
  swipeSettingEl.addEventListener("change", () => {
    setSwipeEnabled(swipeSettingEl.checked);
  });
}

if (removeAdsBtn) {
  removeAdsBtn.addEventListener("click", async () => {
    await handleRemoveAdsPurchase();
  });
}

if (restorePurchasesBtn) {
  restorePurchasesBtn.addEventListener("click", async () => {
    await handleRestorePurchases();
  });
}

for (const input of uiModeSettingEls) {
  input.addEventListener("change", () => {
    if (!input.checked) return;
    setUiModePreference(input.value);
  });
}

if (touchControls) {
  touchControls.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest("button[data-dir]");
    if (!btn) return;
    e.preventDefault();
    queueDirection(btn.dataset.dir);
    focusBoard();
  });

  touchControls.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-dir]");
    if (!btn) return;
    queueDirection(btn.dataset.dir);
    focusBoard();
  });
}

if (gameoverRestartBtn) {
  gameoverRestartBtn.addEventListener("click", async () => {
    await requestInterstitial(adContext());
    restart();
    startGame();
  });
}

if (gameoverContinueBtn) {
  gameoverContinueBtn.addEventListener("click", async () => {
    if (!ENABLE_PLACEHOLDER_REWARDED_CONTINUE) return;
    await requestRewardedContinue(adContext());
  });
}

if (gameoverShareBtn) {
  gameoverShareBtn.addEventListener("click", shareScore);
}

if (gameoverCloseBtn) {
  gameoverCloseBtn.addEventListener("click", () => {
    hideGameoverPanel();
    render();
    focusBoard();
  });
}

boardWrapEl.addEventListener("pointerdown", handlePointerSwipeStart, { passive: false });
boardWrapEl.addEventListener("pointerup", handlePointerSwipeEnd, { passive: false });
boardWrapEl.addEventListener("pointercancel", handlePointerSwipeCancel, { passive: true });
boardWrapEl.addEventListener("touchstart", handleTouchSwipeStart, { passive: false });
boardWrapEl.addEventListener("touchend", handleTouchSwipeEnd, { passive: false });
boardWrapEl.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
  },
  { passive: false }
);
rootEl.addEventListener("pointerdown", focusBoard);
window.addEventListener("resize", () => {
  if (uiModePreference === "auto") applyUiMode();
  syncBoardSize();
});

applyUiMode();
applySwipeSettingUi();
applyAdsUi();
renderLeaderboard();
restart();
