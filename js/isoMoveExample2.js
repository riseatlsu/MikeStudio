// Use global Phaser that's loaded via script tag
const { Game, Scene } = window.Phaser;

// Import isometric handling classes
import { IsometricTilemap, IsometricPlayer } from './iso_handler.js';

class IsoMoveExample extends Scene {
  constructor() {
    const sceneConfig = {
      key: 'IsoMoveExample'
    };

    super(sceneConfig);
    
    // Grid properties for the warehouse map
    this.gridWidth = 10;  // 10x10 map
    this.gridHeight = 10;
    
    // Player reference (will be IsometricPlayer instance)
    this.isoPlayer = null;
  }

  preload() {
    // Load the tilemap and tileset
    // The tileset is 16 columns, 1024x1024 image, with 64x32 tiles
    this.load.spritesheet('tiles', 'assets/T3.png', {
      frameWidth: 64,
      frameHeight: 32  // Use 32 for both to match the grid in the tileset
    });
    this.load.tilemapTiledJSON('warehouse', 'assets/Basic_warehouse.json');
    
    // Load robot sprite
    this.load.spritesheet('robot', 'assets/Robot_TileSet.png', {
      frameWidth: 24,
      frameHeight: 16
    });
    
    // Add load events to debug
    this.load.on('filecomplete-spritesheet-robot', () => {
      console.log('Robot spritesheet loaded successfully');
    });
    
    this.load.on('loaderror', (file) => {
      console.error('Error loading file:', file.src);
    });
  }

  create() {
    console.log('Scene create() called');

    // Get the tilemap JSON data
    const mapData = this.cache.tilemap.get('warehouse').data;
    
    // Create isometric tilemap renderer
    this.isoMap = new IsometricTilemap(this, mapData, 'tiles');
    this.isoMap.build();
    
    // Center the camera on the map
    this.isoMap.centerCamera(this.cameras.main, 0.93);
    
    // Create the player using IsometricPlayer class
    this.isoPlayer = new IsometricPlayer(this, this.isoMap, 'robot', 2, 2, {
      scale: 2,
      zHeight: 8,
      highlightTile: true,
      highlightColor: 0x0066cc,
      moveDuration: 300,
      depth: 10000
    });
    
    // Store scene reference for API
    this.registry.set('isoScene', this);
    
    // Signal API is ready
    console.log('About to resolve ready promise, _readyResolve exists?', typeof _readyResolve !== 'undefined');
    if (_readyResolve) {
      console.log('Resolving ready promise!');
      _readyResolve();
    } else {
      console.error('_readyResolve is not defined!');
    }
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
  const scene = _getScene();
  if (!scene || !scene.isoPlayer) return Promise.resolve(false);
  return scene.isoPlayer.rotate(delta);
}

function _face(dirName) {
  return new Promise((resolve) => {
    const scene = _getScene();
    if (!scene || !scene.isoPlayer) return resolve(false);
    const result = scene.isoPlayer.face(dirName);
    scene.time.delayedCall(100, () => resolve(result));
  });
}

function _getForwardPosition(scene) {
  const player = scene.isoPlayer;
  let newX = player.gridX;
  let newY = player.gridY;
  
  switch (player.direction) {
    case 0: newY += 1; break; // South
    case 1: newX += 1; break; // East
    case 2: newX -= 1; break; // West
    case 3: newY -= 1; break; // North
  }
  
  return { x: newX, y: newY };
}

function _getBackwardPosition(scene) {
  const player = scene.isoPlayer;
  let newX = player.gridX;
  let newY = player.gridY;
  
  switch (player.direction) {
    case 0: newY -= 1; break; // South (go North)
    case 1: newX -= 1; break; // East (go West)
    case 2: newX += 1; break; // West (go East)
    case 3: newY += 1; break; // North (go South)
  }
  
  return { x: newX, y: newY };
}

function _isValidPosition(scene, x, y) {
  return x >= 0 && x < scene.gridWidth && y >= 0 && y < scene.gridHeight;
}

function _moveToPosition(scene, gridX, gridY) {
  if (!scene.isoPlayer) return Promise.resolve(false);
  return scene.isoPlayer.moveTo(gridX, gridY);
}

async function _multiStep(sign, steps) {
  const scene = _getScene();
  if (!scene || !scene.isoPlayer) return false;
  
  for (let i = 0; i < steps; i++) {
    const newPos = sign > 0 ? _getForwardPosition(scene) : _getBackwardPosition(scene);
    const ok = await _moveToPosition(scene, newPos.x, newPos.y);
    if (!ok) return false; // stop early if blocked
  }
  return true;
}

function _setPosition(tx, ty) {
  const scene = _getScene();
  if (!scene || !scene.isoPlayer) return Promise.resolve(false);
  return scene.isoPlayer.moveTo(tx, ty);
}

// Expose the API
window.GameAPI = {
  /** await GameAPI.ready() before issuing actions */
  ready: () => _ready,

  /** Movement & rotation (Promise-based) */
  rotateLeft: () => _enqueue('rotateLeft', async () => _rotate(-1)),  // Turn counterclockwise
  rotateRight: () => _enqueue('rotateRight', async () => _rotate(+1)), // Turn clockwise
  moveForward: (steps = 1) => _enqueue('moveForward', async () => _multiStep(+1, steps)),
  moveBackward: (steps = 1) => _enqueue('moveBackward', async () => _multiStep(-1, steps)),

  /** Utilities */
  face: (dirName) => _enqueue('face', async () => _face(dirName)),
  setPosition: (tx, ty) => _enqueue('setPosition', async () => _setPosition(tx, ty)),

  /** Read-only state (no promises needed) */
  getState: () => {
    const scene = _getScene();
    if (!scene || !scene.isoPlayer) return null;
    return scene.isoPlayer.getState();
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