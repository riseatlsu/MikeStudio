// Import the isometric plugin as a module (since it's installed via npm)
import IsoPlugin from 'phaser3-plugin-isometric';

// Use global Phaser that's loaded via script tag
const { Game, Scene } = window.Phaser;

class IsoMoveExample extends Scene {
  constructor() {
    const sceneConfig = {
      key: 'IsoMoveExample',
      mapAdd: { isoPlugin: 'iso' }
    };

    super(sceneConfig);
    
    // Grid properties (matching isoInteractionExample)
    this.tileSize = 38;
    this.gridWidth = 7;  // 256/38 ≈ 6.7, so 7 tiles
    this.gridHeight = 7;
    
    // Player properties
    this.player = null;
    this.playerGridX = 2;
    this.playerGridY = 2;
    this.playerDirection = 0; // 0=North, 1=East, 2=South, 3=West
    
    // Movement
    this.isMoving = false;
  }

  preload() {
    this.load.tilemapTiledJSON('iso-map', new URL('../assets/Construction R1.json', import.meta.url).href);
    this.load.image('tiles-outside', new URL('../assets/iso-64x64-outside.png', import.meta.url).href);
    this.load.image('tiles-building', new URL('../assets/iso-64x64-building.png', import.meta.url).href);

    this.load.scenePlugin({
      key: 'IsoPlugin',
      url: IsoPlugin,
      sceneKey: 'iso'
    });
  }

  create() {
    console.log('Scene create() called');

    // This is for isometric projection
    this.iso.projector.origin.setTo(0.5, 0.3);

    // Load map
    const map = this.make.tilemap({ key: 'iso-map' });

    // Load tilesets — names must match your Tiled tileset names/Json exactly
    const groundTileset = map.addTilesetImage('iso-64x64-outside', 'tiles-outside');
    const buildingTileset = map.addTilesetImage('iso-64x64-building', 'tiles-building');

    // ----- CREATE LAYERS -----
    // Ground layer (outside)
    const bottom1 = map.createLayer('Bottom 1', groundTileset, 0, 0);
    
    // Building layers stacked above
    const bottom2 = map.createLayer('Bottom 2', buildingTileset, 0, 0);
    const bottom3 = map.createLayer('Bottom 3', buildingTileset, 0, 0);
    const top1    = map.createLayer('Top 1', buildingTileset, 0, 0);

    // ----- DEPTH ORDER -----
    bottom1.setDepth(0);  // ground
    bottom2.setDepth(1);  // lower building
    bottom3.setDepth(2);  // upper building
    top1.setDepth(3);     // roof / top-most

    // ----- PLAYER -----
    this.createPlayerTexture();
    this.createPlayer();

    // ----- CAMERA -----
    this.cameras.main.setBounds(-775, -250, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setZoom(0.5);
    // this.cameras.main.startFollow(this.player); // Basically the map follow the player, dont think we need this

    // ----- STORE MAP INFO -----
    this.gridWidth = map.width;
    this.gridHeight = map.height;
    this.tileSize = map.tileWidth; 

    // ----- REGISTER SCENE -----
    this.registry.set('isoScene', this);
    if (_readyResolve) _readyResolve();

    console.log('Map loaded successfully!');
  }

  createPlayerTexture() {
    // Create a simple colored rectangle texture for the player
    const graphics = this.add.graphics();
    graphics.fillStyle(0xff4444); // Red color
    graphics.fillRect(0, 0, 16, 16);
    graphics.generateTexture('player', 16, 16);
    graphics.destroy();
  }

  // This is from the interaction example, not needed anymore after implementing map
  // spawnTiles() {
  //   var tile;

  //   // Use the same coordinate system as the interaction example
  //   for (var xx = 0; xx < 256; xx += 38) {
  //     for (var yy = 0; yy < 256; yy += 38) {
  //       tile = this.add.isoSprite(xx, yy, 0, 'tile', this.isoGroup);
  //       tile.setInteractive();

  //       tile.on('pointerover', function() {
  //         this.setTint(0x86bfda);
  //         this.isoZ += 5;
  //       });

  //       tile.on('pointerout', function() {
  //         this.clearTint();
  //         this.isoZ -= 5;
  //       });
  //     }
  //   }
  // }
  
  createPlayer() {
    // Convert grid position to world coordinates
    const isoX = this.playerGridX * this.tileSize;
    const isoY = this.playerGridY * this.tileSize;
    
    this.player = this.add.isoSprite(isoX, isoY, 10, 'player');
    this.player.setScale(1.5); // Make it a bit larger
  }
  
  update() {
    // Update loop - no keyboard input, controlled by API only
  }
}

// ------------------ ACTION QUEUE + PUBLIC API ------------------
let game = null; // Will be set after game is created
const _queue = [];
let _running = false;
let _readyResolve;
const _ready = new Promise(res => {
  _readyResolve = res;
});

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

// Helper to get scene
function _getScene() {
  if (!game) return null;
  return game.scene.getScene('IsoMoveExample');
}

// ------------------ API Implementation ------------------

function _rotate(delta) {
  return new Promise((resolve) => {
    const scene = _getScene();
    if (!scene) return resolve(false);
    
    scene.playerDirection = (scene.playerDirection + delta + 4) % 4;
    
    // Rotate the player sprite to show direction
    const angle = scene.playerDirection * 90;
    scene.tweens.add({
      targets: scene.player,
      rotation: window.Phaser.Math.DegToRad(angle),
      duration: 200,
      ease: 'Power2',
      onComplete: () => resolve(true)
    });
  });
}

function _face(dirName) {
  return new Promise((resolve) => {
    const scene = _getScene();
    if (!scene) return resolve(false);
    
    const dirMap = { north: 0, east: 1, south: 2, west: 3, up: 0, right: 1, down: 2, left: 3 };
    if (!(dirName in dirMap)) return resolve(false);
    
    scene.playerDirection = dirMap[dirName];
    
    const angle = scene.playerDirection * 90;
    scene.tweens.add({
      targets: scene.player,
      rotation: window.Phaser.Math.DegToRad(angle),
      duration: 200,
      ease: 'Power2',
      onComplete: () => resolve(true)
    });
  });
}

function _getForwardPosition(scene) {
  let newX = scene.playerGridX;
  let newY = scene.playerGridY;
  
  switch (scene.playerDirection) {
    case 0: // North
      newY -= 1;
      break;
    case 1: // East
      newX += 1;
      break;
    case 2: // South
      newY += 1;
      break;
    case 3: // West
      newX -= 1;
      break;
  }
  
  return { x: newX, y: newY };
}

function _getBackwardPosition(scene) {
  let newX = scene.playerGridX;
  let newY = scene.playerGridY;
  
  switch (scene.playerDirection) {
    case 0: // North (go South)
      newY += 1;
      break;
    case 1: // East (go West)
      newX -= 1;
      break;
    case 2: // South (go North)
      newY -= 1;
      break;
    case 3: // West (go East)
      newX += 1;
      break;
  }
  
  return { x: newX, y: newY };
}

function _isValidPosition(scene, x, y) {
  return x >= 0 && x < scene.gridWidth && y >= 0 && y < scene.gridHeight;
}

function _moveToPosition(scene, gridX, gridY) {
  return new Promise((resolve) => {
    if (scene.isMoving) return resolve(false);
    if (!_isValidPosition(scene, gridX, gridY)) return resolve(false);
    
    scene.isMoving = true;
    
    const isoX = gridX * scene.tileSize;
    const isoY = gridY * scene.tileSize;
    
    scene.tweens.add({
      targets: scene.player,
      isoX: isoX,
      isoY: isoY,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        scene.playerGridX = gridX;
        scene.playerGridY = gridY;
        scene.isMoving = false;
        resolve(true);
      }
    });
  });
}

async function _multiStep(sign, steps) {
  const scene = _getScene();
  if (!scene) return false;
  
  for (let i = 0; i < steps; i++) {
    const newPos = sign > 0 ? _getForwardPosition(scene) : _getBackwardPosition(scene);
    const ok = await _moveToPosition(scene, newPos.x, newPos.y);
    if (!ok) return false; // stop early if blocked
  }
  return true;
}

function _setPosition(tx, ty) {
  return new Promise((resolve) => {
    const scene = _getScene();
    if (!scene) return resolve(false);
    if (!_isValidPosition(scene, tx, ty)) return resolve(false);
    
    const isoX = tx * scene.tileSize;
    const isoY = ty * scene.tileSize;
    
    scene.player.isoX = isoX;
    scene.player.isoY = isoY;
    scene.playerGridX = tx;
    scene.playerGridY = ty;
    
    resolve(true);
  });
}

// Expose the API
window.GameAPI = {
  /** await GameAPI.ready() before issuing actions */
  ready: () => _ready,

  /** Movement & rotation (Promise-based) */
  rotateLeft: () => _enqueue('rotateLeft', async () => _rotate(-1)),
  rotateRight: () => _enqueue('rotateRight', async () => _rotate(+1)),
  moveForward: (steps = 1) => _enqueue('moveForward', async () => _multiStep(+1, steps)),
  moveBackward: (steps = 1) => _enqueue('moveBackward', async () => _multiStep(-1, steps)),

  /** Utilities */
  face: (dirName) => _enqueue('face', async () => _face(dirName)),
  setPosition: (tx, ty) => _enqueue('setPosition', async () => _setPosition(tx, ty)),

  /** Read-only state (no promises needed) */
  getState: () => {
    const scene = _getScene();
    if (!scene) return null;
    
    return {
      direction: scene.playerDirection, // 0=North, 1=East, 2=South, 3=West
      playerGridX: scene.playerGridX,
      playerGridY: scene.playerGridY,
      isMoving: scene.isMoving
    };
  }
};

// Create the game after API is defined
let config = {
  type: window.Phaser.AUTO,
  width: 800,
  height: 600,
  pixelArt: true,
  parent: 'game-canvas',
  scene: IsoMoveExample,
  physics: {
    default: 'arcade'
  }
};

game = new window.Phaser.Game(config);