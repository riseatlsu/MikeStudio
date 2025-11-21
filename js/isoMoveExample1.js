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
    this.playerDirection = 0; // 0=South, 1=East, 2=West, 3=North - starting South
    
    // Movement
    this.isMoving = false;
  }

  preload() {
    this.load.image('tile', 'assets/tile.png');
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
    
    this.load.scenePlugin({
      key: 'IsoPlugin',
      url: IsoPlugin,
      sceneKey: 'iso'
    });
  }

  create() {
    console.log('Scene create() called');
    this.isoGroup = this.add.group();
    this.playerGroup = this.add.group();

    this.iso.projector.origin.setTo(0.5, 0.3);

    // Create a simple colored rectangle for the player sprite
    this.createPlayerTexture();

    // Create the tile grid
    this.spawnTiles();
    
    // Create the player sprite
    this.createPlayer();
    
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

  createPlayerTexture() {
    // Create a simple colored rectangle texture for the player
    const graphics = this.add.graphics();
    graphics.fillStyle(0xff4444); // Red color
    graphics.fillRect(0, 0, 16, 16);
    graphics.generateTexture('player', 16, 16);
    graphics.destroy();
  }

  spawnTiles() {
    var tile;

    // Use the same coordinate system as the interaction example
    for (var xx = 0; xx < 256; xx += 38) {
      for (var yy = 0; yy < 256; yy += 38) {
        tile = this.add.isoSprite(xx, yy, 0, 'tile', this.isoGroup);
        tile.setInteractive();

        tile.on('pointerover', function() {
          this.setTint(0x86bfda);
          this.isoZ += 5;
        });

        tile.on('pointerout', function() {
          this.clearTint();
          this.isoZ -= 5;
        });
      }
    }
  }
  
  createPlayer() {
    // Convert grid position to world coordinates
    const isoX = this.playerGridX * this.tileSize;
    const isoY = this.playerGridY * this.tileSize;
    
    // Create player with robot sprite - correct syntax for isoSprite
    this.player = this.add.isoSprite(isoX, isoY, 10, 'robot', this.playerGroup);
    this.player.setFrame(0); // Set initial frame to South
    this.player.setScale(2.5); // Make it bigger
    this.player.setDepth(100); // Make sure it's above tiles
    
    console.log('Player created at:', isoX, isoY, 'Frame:', this.playerDirection);
  }
  
  updatePlayerFrame() {
    // Sprite sheet frames: 0=South, 1=East, 2=West, 3=North
    if (this.player) {
      this.player.setFrame(this.playerDirection);
      console.log('Updated player frame to:', this.playerDirection);
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
  return new Promise((resolve) => {
    const scene = _getScene();
    if (!scene) return resolve(false);
    
    // Rotation mapping for sprite frames: 0=South, 1=East, 2=West, 3=North
    // Left turn: South(0) -> East(1) -> North(3) -> West(2) -> South(0)
    // Right turn: South(0) -> West(2) -> North(3) -> East(1) -> South(0)
    if (delta < 0) { // Turn left (counterclockwise)
      const leftSequence = [0, 1, 3, 2]; // South -> East -> North -> West
      const currentIndex = leftSequence.indexOf(scene.playerDirection);
      scene.playerDirection = leftSequence[(currentIndex + 1) % 4];
    } else { // Turn right (clockwise)
      const rightSequence = [0, 2, 3, 1]; // South -> West -> North -> East
      const currentIndex = rightSequence.indexOf(scene.playerDirection);
      scene.playerDirection = rightSequence[(currentIndex + 1) % 4];
    }
    
    // Update sprite frame to show direction
    scene.updatePlayerFrame();
    
    // Small delay for visual feedback
    scene.time.delayedCall(100, () => resolve(true));
  });
}

function _face(dirName) {
  return new Promise((resolve) => {
    const scene = _getScene();
    if (!scene) return resolve(false);
    
    // Map direction names to sprite frames: 0=South, 1=East, 2=West, 3=North
    const dirMap = { 
      south: 0, down: 0,
      east: 1, right: 1,
      west: 2, left: 2,
      north: 3, up: 3
    };
    if (!(dirName in dirMap)) return resolve(false);
    
    scene.playerDirection = dirMap[dirName];
    
    // Update sprite frame to show direction
    scene.updatePlayerFrame();
    
    // Small delay for visual feedback
    scene.time.delayedCall(100, () => resolve(true));
  });
}

function _getForwardPosition(scene) {
  let newX = scene.playerGridX;
  let newY = scene.playerGridY;
  
  switch (scene.playerDirection) {
    case 0: // South
      newY += 1;
      break;
    case 1: // East
      newX += 1;
      break;
    case 2: // West
      newX -= 1;
      break;
    case 3: // North
      newY -= 1;
      break;
  }
  
  return { x: newX, y: newY };
}

function _getBackwardPosition(scene) {
  let newX = scene.playerGridX;
  let newY = scene.playerGridY;
  
  switch (scene.playerDirection) {
    case 0: // South (go North)
      newY -= 1;
      break;
    case 1: // East (go West)
      newX -= 1;
      break;
    case 2: // West (go East)
      newX += 1;
      break;
    case 3: // North (go South)
      newY += 1;
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
    if (!scene) return null;
    
    return {
      direction: scene.playerDirection, // 0=South, 1=East, 2=West, 3=North
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