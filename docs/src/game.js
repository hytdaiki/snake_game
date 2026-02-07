const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OBSTACLE_START_SCORE = 31;
const OBSTACLE_SCORE_STEP = 5;
const OBSTACLE_MAX_ATTEMPTS = 120;

function createRng(seed = Date.now()) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function keyFor(x, y) {
  return `${x},${y}`;
}

function isInside(state, x, y) {
  return x >= 0 && x < state.cols && y >= 0 && y < state.rows;
}

function createGame({ rows = 20, cols = 20, rng = Math.random } = {}) {
  const midX = Math.floor(cols / 2);
  const midY = Math.floor(rows / 2);
  const snake = [
    { x: midX, y: midY },
    { x: midX - 1, y: midY },
    { x: midX - 2, y: midY },
  ];
  const state = {
    rows,
    cols,
    snake,
    dir: "right",
    nextDir: "right",
    food: { x: 0, y: 0 },
    score: 0,
    alive: true,
    paused: false,
    lastDeath: null,
    obstacles: [],
    maxObstacles: Math.max(6, Math.floor((rows * cols) / 35)),
    rng,
  };
  state.food = placeFood(state);
  return state;
}

function hasSnakeAt(state, x, y) {
  return state.snake.some((s) => s.x === x && s.y === y);
}

function hasObstacleAt(state, x, y) {
  return state.obstacles.some((o) => o.x === x && o.y === y);
}

function isNearHead(state, x, y) {
  const head = state.snake[0];
  const dist = Math.abs(head.x - x) + Math.abs(head.y - y);
  return dist <= 1;
}

function collectEmptyCells(state, { avoidHeadZone = false, excludeFood = false } = {}) {
  const empty = [];
  for (let y = 0; y < state.rows; y += 1) {
    for (let x = 0; x < state.cols; x += 1) {
      if (hasSnakeAt(state, x, y)) continue;
      if (hasObstacleAt(state, x, y)) continue;
      if (excludeFood && state.food.x === x && state.food.y === y) continue;
      if (avoidHeadZone && isNearHead(state, x, y)) continue;
      empty.push({ x, y });
    }
  }
  return empty;
}

function pickRandomCell(state, cells) {
  if (cells.length === 0) return null;
  const idx = Math.floor(state.rng() * cells.length);
  return cells[idx];
}

function placeFood(state) {
  const safe = collectEmptyCells(state, { avoidHeadZone: true });
  const fallback = collectEmptyCells(state, { avoidHeadZone: false });
  const chosen = pickRandomCell(state, safe.length > 0 ? safe : fallback);
  return chosen ?? { x: -1, y: -1 };
}

function headHasEscapeRoute(state, extraObstacle) {
  const blocked = new Set(state.obstacles.map((o) => keyFor(o.x, o.y)));
  if (extraObstacle) blocked.add(keyFor(extraObstacle.x, extraObstacle.y));

  const head = state.snake[0];
  const body = new Set(state.snake.slice(1).map((s) => keyFor(s.x, s.y)));
  const candidates = [
    { x: head.x + 1, y: head.y },
    { x: head.x - 1, y: head.y },
    { x: head.x, y: head.y + 1 },
    { x: head.x, y: head.y - 1 },
  ];

  return candidates.some((cell) => {
    if (!isInside(state, cell.x, cell.y)) return false;
    const key = keyFor(cell.x, cell.y);
    if (blocked.has(key)) return false;
    if (body.has(key)) return false;
    return true;
  });
}

function canHeadReachFood(state, extraObstacle) {
  if (state.food.x < 0 || state.food.y < 0) return true;
  const start = state.snake[0];
  const targetKey = keyFor(state.food.x, state.food.y);
  const queue = [start];
  const visited = new Set([keyFor(start.x, start.y)]);
  const blocked = new Set(state.obstacles.map((o) => keyFor(o.x, o.y)));
  if (extraObstacle) blocked.add(keyFor(extraObstacle.x, extraObstacle.y));

  for (let i = 1; i < state.snake.length; i += 1) {
    blocked.add(keyFor(state.snake[i].x, state.snake[i].y));
  }

  while (queue.length > 0) {
    const cell = queue.shift();
    const currentKey = keyFor(cell.x, cell.y);
    if (currentKey === targetKey) return true;
    const neighbors = [
      { x: cell.x + 1, y: cell.y },
      { x: cell.x - 1, y: cell.y },
      { x: cell.x, y: cell.y + 1 },
      { x: cell.x, y: cell.y - 1 },
    ];
    for (const next of neighbors) {
      if (!isInside(state, next.x, next.y)) continue;
      const nextKey = keyFor(next.x, next.y);
      if (visited.has(nextKey)) continue;
      if (blocked.has(nextKey) && nextKey !== targetKey) continue;
      visited.add(nextKey);
      queue.push(next);
    }
  }

  return false;
}

function isFairObstaclePlacement(state, candidate) {
  if (!headHasEscapeRoute(state, candidate)) return false;
  return canHeadReachFood(state, candidate);
}

function placeObstacle(state) {
  const candidates = collectEmptyCells(state, { avoidHeadZone: true, excludeFood: true });
  if (candidates.length === 0) return null;

  const maxAttempts = Math.min(candidates.length, OBSTACLE_MAX_ATTEMPTS);
  for (let i = 0; i < maxAttempts; i += 1) {
    const idx = Math.floor(state.rng() * candidates.length);
    const candidate = candidates.splice(idx, 1)[0];
    if (isFairObstaclePlacement(state, candidate)) return candidate;
  }

  return null;
}

function targetObstacleCount(state) {
  if (state.score < OBSTACLE_START_SCORE) return 0;
  const growth = 1 + Math.floor((state.score - OBSTACLE_START_SCORE) / OBSTACLE_SCORE_STEP);
  return Math.min(state.maxObstacles, growth);
}

function syncObstacles(state) {
  const target = targetObstacleCount(state);
  while (state.obstacles.length < target) {
    const obstacle = placeObstacle(state);
    if (!obstacle) break;
    state.obstacles.push(obstacle);
  }
}

function setDirection(state, dir) {
  if (!DIRECTIONS[dir]) return;
  const opposites = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
  };
  if (opposites[dir] === state.dir) return;
  state.nextDir = dir;
}

function step(state) {
  if (!state.alive || state.paused) return;
  state.lastDeath = null;
  state.dir = state.nextDir;
  const vec = DIRECTIONS[state.dir];
  const head = state.snake[0];
  const next = { x: head.x + vec.x, y: head.y + vec.y };

  if (!isInside(state, next.x, next.y)) {
    state.alive = false;
    state.lastDeath = { cause: "wall", cell: next };
    return;
  }

  const hitSelf = state.snake.some((s) => s.x === next.x && s.y === next.y);
  const hitObstacle = hasObstacleAt(state, next.x, next.y);
  if (hitSelf || hitObstacle) {
    state.alive = false;
    state.lastDeath = { cause: hitObstacle ? "obstacle" : "self", cell: next };
    return;
  }

  state.snake.unshift(next);
  if (next.x === state.food.x && next.y === state.food.y) {
    state.score += 1;
    state.food = placeFood(state);
    syncObstacles(state);
  } else {
    state.snake.pop();
  }
}

function reset(state, seed) {
  const rng = seed === undefined ? state.rng : createRng(seed);
  const fresh = createGame({ rows: state.rows, cols: state.cols, rng });
  state.rows = fresh.rows;
  state.cols = fresh.cols;
  state.snake = fresh.snake;
  state.dir = fresh.dir;
  state.nextDir = fresh.nextDir;
  state.food = fresh.food;
  state.score = fresh.score;
  state.alive = fresh.alive;
  state.paused = fresh.paused;
  state.lastDeath = fresh.lastDeath;
  state.obstacles = fresh.obstacles;
  state.maxObstacles = fresh.maxObstacles;
  state.rng = fresh.rng;
}

export { createGame, createRng, placeFood, reset, setDirection, step };
