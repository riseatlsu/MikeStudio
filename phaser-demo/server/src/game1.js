// game.js
// Public, Promise-based GameAPI for Blockly or any JS caller.

const TILE_WIDTH = 100;
const TILE_HEIGHT = 100;
const TILE_MARGIN = 0;
const TILE_SPACING = 0;

const data = [
  [5,5,5,5,5,5,5,5,5,5],
  [5,4,4,4,4,4,4,4,4,5],
  [5,4,4,5,5,4,5,5,4,5],
  [5,5,4,4,4,4,5,4,4,5],
  [5,5,4,4,4,4,4,4,4,5],
  [5,4,4,4,4,4,4,4,4,5],
  [5,5,5,4,4,4,4,4,4,5],
  [5,4,4,4,4,4,4,4,4,5],
  [5,4,4,4,4,4,4,4,4,5],
  [5,5,5,5,5,5,5,5,5,5]
];

const COLS = data[0].length;
const ROWS = data.length;
const MAP_W = COLS * TILE_WIDTH;
const MAP_H = ROWS * TILE_HEIGHT;

const BASE_ANGLE = 0; // rotate so "up" looks correct for your art
// dir = 0: up, 1: right, 2: down, 3: left
const DIR2VEC = [
  { dx: 0,  dy: -1 },
  { dx: 1,  dy:  0 },
  { dx: 0,  dy:  1 },
  { dx: -1, dy:  0 }
];

// --- Phaser config ---
const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0f1220',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: MAP_W,
    height: MAP_H
  },
  scene: { preload, create, update }
};

new Phaser.Game(config);

// ---- globals managed by scene ----
let map, layer, player, star;
let playerTile = new Phaser.Math.Vector2(1, 1);
let dir = 0;               // 0 up, 1 right, 2 down, 3 left
let isMoving = false;

let starTile = new Phaser.Math.Vector2(3, 1);
let isTowing = false;

// ------------------ ACTION QUEUE + PUBLIC API ------------------
const _queue = [];
let _running = false;
let _readyResolve;
const _ready = new Promise(res => (_readyResolve = res));

function _enqueue(label, fn) {
  return new Promise((resolve, reject) => {
    _queue.push({ label, fn, resolve, reject });
    _drain();
  });
}

async function _drain() {
  if (_running) return;
  _running = true;
  while (_queue.length) {
    const { label, fn, resolve, reject } = _queue.shift();
    try {
      const v = await fn();
      resolve(v);
    } catch (e) {
      console.error(`[GameAPI] Action failed: ${label}`, e);
      reject(e);
    }
  }
  _running = false;
}

// Expose a minimal, friendly API on window.GameAPI
window.GameAPI = {
  /** await GameAPI.ready() before issuing actions */
  ready: () => _ready,

  /** Movement & interaction (Promise-based) */
  rotateLeft: ()  => _enqueue('rotateLeft',  async () => _rotate(-1)),
  rotateRight: () => _enqueue('rotateRight', async () => _rotate(+1)),
  moveForward: (steps = 1)  => _enqueue('moveForward',  async () => _multiStep(+1, steps)),
  moveBackward: (steps = 1) => _enqueue('moveBackward', async () => _multiStep(-1, steps)),
  toggleTow: () => _enqueue('toggleTow', async () => _toggleTow()),

  /** Utilities */
  face: (dirName) => _enqueue('face', async () => _face(dirName)),
  setPosition: (tx, ty) => _enqueue('setPosition', async () => _setPosition(tx, ty)),

  /** Read-only state (no promises needed) */
  getState: () => ({
    dir,             // 0 up, 1 right, 2 down, 3 left
    isTowing,
    playerTile: { x: playerTile.x, y: playerTile.y },
    starTile:   { x: starTile.x,   y: starTile.y }
  })
};

// ------------------ Scene ------------------
function preload() {
  this.load.image('tiles', 'assets/tiles.png');
  this.load.image('car',  'assets/spriteOpen_0.png'); // single-frame sprite
  this.load.image('star', 'assets/star.png');         // put a star.png in /assets
}

function create() {
  map = this.make.tilemap({ data, tileWidth: TILE_WIDTH, tileHeight: TILE_HEIGHT });
  const tileset = map.addTilesetImage('tiles', 'tiles', TILE_WIDTH, TILE_HEIGHT, TILE_MARGIN, TILE_SPACING);
  layer = map.createLayer(0, tileset, 0, 0);
  layer.setCollision([5]); // walls are 5

  // car
  const start = tileCenterWorldXY(playerTile.x, playerTile.y);
  player = this.add.image(start.x, start.y, 'car').setOrigin(0.5);
  applyFacing();

  // star
  const s = tileCenterWorldXY(starTile.x, starTile.y);
  star = this.add.image(s.x, s.y, 'star').setOrigin(0.5);

  // camera
  this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
  this.cameras.main.startFollow(player, true, 0.15, 0.15);

  // scene ref for tweening helpers
  this.registry.set('scene', this);

  // signal API is ready to accept commands
  _readyResolve();
}

function update() {
  // Keyboard control purposely omitted from this file,
  // so the API is the single source of truth for moves.
}

// ------------------ API impl helpers ------------------
function _scene() { return Phaser.Utils.Objects.GetValue(player, 'scene') || window.Phaser?.Scenes?.ScenePlugin || window; }

function applyFacing() {
  player.setAngle(BASE_ANGLE + dir * 90);
}

function _rotate(delta) {
  return new Promise((resolve) => {
    dir = (dir + (delta > 0 ? 1 : 3)) % 4;
    applyFacing();
    // small delay so queued steps feel discrete
    setTimeout(resolve, 20);
  });
}

async function _multiStep(sign, steps) {
  for (let i = 0; i < steps; i++) {
    const ok = await _tryStep(sign);
    if (!ok) return false; // stop early if blocked
  }
  return true;
}

function _toggleTow() {
  const scene = _scene();
  return new Promise((resolve) => {
    if (isTowing) {
      // detach
      isTowing = false;
      star.clearTint();
      return resolve(true);
    }

    // try to grab: star must be in front; behind must be free
    const v = DIR2VEC[dir];
    const frontX = playerTile.x + v.dx;
    const frontY = playerTile.y + v.dy;
    const isFront = (starTile.x === frontX && starTile.y === frontY);
    if (!isFront) return resolve(false);

    const backX = playerTile.x - v.dx;
    const backY = playerTile.y - v.dy;
    if (!inBounds(backX, backY) || isWall(backX, backY)) return resolve(false);

    const behind = tileCenterWorldXY(backX, backY);
    starTile.set(backX, backY);
    scene.tweens.add({
      targets: star, x: behind.x, y: behind.y, duration: 120, ease: 'Linear',
      onComplete: () => {
        isTowing = true;
        star.setTint(0x80ff80);
        resolve(true);
      }
    });
  });
}

function _tryStep(sign) {
  const scene = _scene();
  return new Promise((resolve) => {
    if (isMoving) return resolve(false);

    const v = DIR2VEC[dir];
    const tx = playerTile.x + v.dx * sign;
    const ty = playerTile.y + v.dy * sign;

    if (!inBounds(tx, ty) || isWall(tx, ty)) return resolve(false);
    if (!isTowing && starTile.x === tx && starTile.y === ty) return resolve(false);

    const destPlayer = tileCenterWorldXY(tx, ty);

    if (isTowing) {
      // star moves into the tile the car just left
      const starNextTile = new Phaser.Math.Vector2(playerTile.x, playerTile.y);
      const destStar = tileCenterWorldXY(starNextTile.x, starNextTile.y);

      isMoving = true;
      let done = 0;
      const finish = () => {
        if (++done === 2) {
          playerTile.set(tx, ty);
          starTile.copy(starNextTile);
          isMoving = false;
          resolve(true);
        }
      };

      scene.tweens.add({ targets: player, x: destPlayer.x, y: destPlayer.y, duration: 160, ease: 'Linear', onComplete: finish });
      scene.tweens.add({ targets: star,   x: destStar.x,   y: destStar.y,   duration: 160, ease: 'Linear', onComplete: finish });
    } else {
      isMoving = true;
      scene.tweens.add({
        targets: player, x: destPlayer.x, y: destPlayer.y, duration: 160, ease: 'Linear',
        onComplete: () => { playerTile.set(tx, ty); isMoving = false; resolve(true); }
      });
    }
  });
}

function _face(dirName) {
  const map = { up:0, right:1, down:2, left:3 };
  if (!(dirName in map)) return false;
  dir = map[dirName];
  applyFacing();
  return true;
}

function _setPosition(tx, ty) {
  if (!inBounds(tx, ty) || isWall(tx, ty)) return false;
  const p = tileCenterWorldXY(tx, ty);
  player.setPosition(p.x, p.y);
  playerTile.set(tx, ty);
  return true;
}

// --- helpers ---
function tileCenterWorldXY(tx, ty) {
  return { x: tx * TILE_WIDTH + TILE_WIDTH / 2, y: ty * TILE_HEIGHT + TILE_HEIGHT / 2 };
}
function inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS; }
function isWall(tx, ty)   { return data[ty][tx] === 5; }
