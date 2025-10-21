// game.js
// Isometric Game with Promise-based GameAPI for Blockly or any JS caller.

class IsoMoveExample extends Phaser.Scene {
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
    
    // Star/Object properties for compatibility
    this.star = null;
    this.starGridX = 3;
    this.starGridY = 1;
    this.isTowing = false;
    
    // Movement
    this.isMoving = false;
  }

  preload() {
    this.load.image('tile', 'assets/tile.png');
    this.load.scenePlugin({
      key: 'IsoPlugin',
      url: 'https://cdn.jsdelivr.net/npm/phaser3-plugin-isometric@1.0.4/dist/IsoPlugin.min.js',
      sceneKey: 'iso'
    });
  }

  create() {
    console.log('Isometric scene create() called');
    this.isoGroup = this.add.group();
    this.playerGroup = this.add.group();

    this.iso.projector.origin.setTo(0.5, 0.3);

    // Create textures
    this.createPlayerTexture();
    this.createStarTexture();

    // Create the tile grid
    this.spawnTiles();
    
    // Create the player sprite
    this.createPlayer();
    
    // Create the star object
    this.createStar();
    
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

  createStarTexture() {
    // Create a star-like texture for the object
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffdd44); // Yellow color
    graphics.fillRect(0, 0, 12, 12);
    graphics.generateTexture('star', 12, 12);
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
    
    this.player = this.add.isoSprite(isoX, isoY, 10, 'player', this.playerGroup);
    this.player.setScale(1.5); // Make it a bit larger
  }

  createStar() {
    // Convert grid position to world coordinates
    const isoX = this.starGridX * this.tileSize;
    const isoY = this.starGridY * this.tileSize;
    
    this.star = this.add.isoSprite(isoX, isoY, 8, 'star', this.playerGroup);
    this.star.setScale(1.2);
  }
  
  update() {
    // Update loop - no keyboard input, controlled by API only
  }
}

// --- Phaser config ---
const config = {
  type: Phaser.AUTO,
  parent: 'game-canvas',
  backgroundColor: '#0f1220',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 800,
    height: 600
  },
  scene: IsoMoveExample,
  physics: {
    default: 'arcade'
  }
};

// Create game after defining it
let game = new Phaser.Game(config);

// ------------------ ACTION QUEUE + PUBLIC API ------------------
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
      rotation: Phaser.Math.DegToRad(angle),
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
      rotation: Phaser.Math.DegToRad(angle),
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
        
        // Move star if towing
        if (scene.isTowing && scene.star) {
          scene.star.isoX = isoX;
          scene.star.isoY = isoY;
          scene.starGridX = gridX;
          scene.starGridY = gridY;
        }
        
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
    
    // Move star if towing
    if (scene.isTowing && scene.star) {
      scene.star.isoX = isoX;
      scene.star.isoY = isoY;
      scene.starGridX = tx;
      scene.starGridY = ty;
    }
    
    resolve(true);
  });
}

function _toggleTow() {
  return new Promise((resolve) => {
    const scene = _getScene();
    if (!scene) return resolve(false);
    
    // Check if player is near the star
    const distX = Math.abs(scene.playerGridX - scene.starGridX);
    const distY = Math.abs(scene.playerGridY - scene.starGridY);
    
    if (distX <= 1 && distY <= 1) {
      scene.isTowing = !scene.isTowing;
      
      // Visual feedback
      if (scene.isTowing) {
        scene.star.setTint(0x00ff00); // Green when towing
      } else {
        scene.star.clearTint();
      }
      
      resolve(true);
    } else {
      resolve(false); // Too far from object
    }
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

  /** Object interaction */
  toggleTow: () => _enqueue('toggleTow', async () => _toggleTow()),

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
      starGridX: scene.starGridX,
      starGridY: scene.starGridY,
      isTowing: scene.isTowing,
      isMoving: scene.isMoving
    };
  }
};