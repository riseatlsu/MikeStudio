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

// ---- globals ----
let map, layer, player, cursors, wasd, grabKey;
let playerTile = new Phaser.Math.Vector2(1, 1);
let dir = 0;
let isMoving = false;

let star, starTile = new Phaser.Math.Vector2(3, 1);
let isTowing = false;

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

  // input
  cursors = this.input.keyboard.createCursorKeys();
  wasd = this.input.keyboard.addKeys({ up: 'W', left: 'A', down: 'S', right: 'D' });
  grabKey = this.input.keyboard.addKey('E');
}

function update() {
  if (isMoving) return;

  // toggle grab / tow
  if (Phaser.Input.Keyboard.JustDown(grabKey)) {
    toggleTow.call(this);
    return;
  }

  // rotate
  if (Phaser.Input.Keyboard.JustDown(cursors.left) || Phaser.Input.Keyboard.JustDown(wasd.left)) {
    dir = (dir + 3) % 4; applyFacing(); return;
  }
  if (Phaser.Input.Keyboard.JustDown(cursors.right) || Phaser.Input.Keyboard.JustDown(wasd.right)) {
    dir = (dir + 1) % 4; applyFacing(); return;
  }

  // step
  if (Phaser.Input.Keyboard.JustDown(cursors.up) || Phaser.Input.Keyboard.JustDown(wasd.up)) {
    tryStep.call(this, +1); return;
  }
  if (Phaser.Input.Keyboard.JustDown(cursors.down) || Phaser.Input.Keyboard.JustDown(wasd.down)) {
    tryStep.call(this, -1); return;
  }
}

function applyFacing() {
  player.setAngle(BASE_ANGLE + dir * 90);
}

function toggleTow() {
  if (isTowing) {
    // drop / detach
    isTowing = false;
    star.clearTint();
    return;
  }

  // try to grab: star must be in the tile directly in front
  const v = DIR2VEC[dir];
  const frontX = playerTile.x + v.dx;
  const frontY = playerTile.y + v.dy;

  const isFront = (starTile.x === frontX && starTile.y === frontY);
  if (!isFront) return; // nothing to grab

  // we will tow the star BEHIND the car; that tile must be free
  const backX = playerTile.x - v.dx;
  const backY = playerTile.y - v.dy;
  if (!inBounds(backX, backY) || isWall(backX, backY)) return;

  // latch on: move star behind the car instantly (or tween if you prefer)
  const behind = tileCenterWorldXY(backX, backY);
  starTile.set(backX, backY);
  star.setPosition(behind.x, behind.y);

  isTowing = true;
  star.setTint(0x80ff80); // visual cue: towed
}

function tryStep(sign) {
  const v = DIR2VEC[dir];
  const tx = playerTile.x + v.dx * sign;
  const ty = playerTile.y + v.dy * sign;

  if (!inBounds(tx, ty) || isWall(tx, ty)) return;

  // If not towing, the star blocks your path (no push in this mode)
  if (!isTowing && starTile.x === tx && starTile.y === ty) return;

  // Compute tween targets
  const destPlayer = tileCenterWorldXY(tx, ty);

  if (isTowing) {
    // star moves into the tile the car just left (playerTile)
    const starNextTile = new Phaser.Math.Vector2(playerTile.x, playerTile.y);
    const destStar = tileCenterWorldXY(starNextTile.x, starNextTile.y);

    isMoving = true;
    let done = 0;
    const finish = () => {
      if (++done === 2) {
        playerTile.set(tx, ty);
        starTile.copy(starNextTile);
        isMoving = false;
      }
    };

    this.tweens.add({ targets: player, x: destPlayer.x, y: destPlayer.y, duration: 160, ease: 'Linear', onComplete: finish });
    this.tweens.add({ targets: star,   x: destStar.x,   y: destStar.y,   duration: 160, ease: 'Linear', onComplete: finish });
  } else {
    // normal step (no towing)
    isMoving = true;
    this.tweens.add({
      targets: player,
      x: destPlayer.x, y: destPlayer.y,
      duration: 160, ease: 'Linear',
      onComplete: () => { playerTile.set(tx, ty); isMoving = false; }
    });
  }
}

// --- helpers ---
function tileCenterWorldXY(tx, ty) {
  return { x: tx * TILE_WIDTH + TILE_WIDTH / 2, y: ty * TILE_HEIGHT + TILE_HEIGHT / 2 };
}
function inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS; }
function isWall(tx, ty)   { return data[ty][tx] === 5; }
