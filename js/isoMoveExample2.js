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
    
    // Grid properties (will be set from tilemap data)
    this.gridWidth = null;
    this.gridHeight = null;
    
    // Player reference (will be IsometricPlayer instance)
    this.isoPlayer = null;
    
    // Camera zoom state
    this.defaultZoom = 1;
    this.followZoom = 1.5;
    this.isZoomedIn = false;
    this.isMoving = false; // Track if moves are being executed
    
    // Level configuration (will be loaded from LevelManager)
    this.levelConfig = null;
  }

  preload() {
    // Load level configuration from LevelManager
    if (window.LevelManager) {
      this.levelConfig = window.LevelManager.getCurrentLevel();
    }
    
    // Fallback if LevelManager not available
    if (!this.levelConfig) {
      this.levelConfig = {
        playerStart: { x: 2, y: 2, direction: 0 },
        itemSpawns: [{ spriteKey: 'boxes', x: 0, y: 7, frame: 0, scale: 1.5 }],
        goalConveyors: [{ x: 7, y: 0 }],
        conveyorLayer: 'Tile Layer 2',
        mapFile: 'lvl1_v1.json'
      };
    }
    
    // Load the tilemap and tileset
    // The tileset is 16 columns, 1024x1024 image, with 64x32 tiles
    this.load.spritesheet('tiles', 'assets/fixes_factory.png', {
      frameWidth: 64,
      frameHeight: 32  // Use 32 for both to match the grid in the tileset
    });
    
    // Load the tilemap for the current level
    const mapFile = this.levelConfig.mapFile || 'lvl1_v1.json';
    console.log('Loading tilemap:', mapFile);
    this.load.tilemapTiledJSON('warehouse', `assets/${mapFile}`);
    
    // Load robot sprite
    this.load.spritesheet('robot', 'assets/Robot_TileSet.png', {
      frameWidth: 24,
      frameHeight: 16
    });
    
    // Load boxes sprite
    this.load.spritesheet('boxes', 'assets/box.png', {
      frameWidth: 22,
      frameHeight: 21
    });
    
    // Add load events to debug
    this.load.on('filecomplete-tilemapJSON-warehouse', () => {
      console.log('Tilemap loaded successfully:', mapFile);
    });
    
    this.load.on('filecomplete-spritesheet-robot', () => {
      console.log('Robot spritesheet loaded successfully');
    });
    
    this.load.on('loaderror', (file) => {
      console.error('Error loading file:', file.src);
      console.error('File type:', file.type);
    });
    
    this.load.on('complete', () => {
      console.log('All assets loaded successfully');
    });
  }

  create() {
    console.log('Scene create() called');

    // Initialize the level
    this.initLevel();
    
    // Set up click handler for zoom in/out
    this.input.on('pointerdown', (pointer) => {
      if (this.isMoving) return; // Disable zoom control during moves
      
      if (!this.isZoomedIn) {
        // Zoom in to clicked location
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.cameras.main.stopFollow();
        this.cameras.main.pan(worldPoint.x, worldPoint.y, 300, 'Power2');
        this.cameras.main.zoomTo(this.followZoom, 300, 'Power2');
        this.isZoomedIn = true;
      } else {
        // Zoom back out to default view
        const centerPos = this.isoMap.gridToScreen(this.isoMap.mapWidth / 2, this.isoMap.mapHeight / 2);
        this.cameras.main.pan(centerPos.x, centerPos.y, 300, 'Power2');
        this.cameras.main.zoomTo(this.defaultZoom, 300, 'Power2');
        this.isZoomedIn = false;
      }
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
  
  /**
   * Initialize the level with configured settings
   */
  initLevel() {
    // Verify tilemap is loaded
    if (!this.cache.tilemap.exists('warehouse')) {
      console.error('Tilemap not found in cache! Cannot initialize level.');
      return;
    }
    
    const tilemapData = this.cache.tilemap.get('warehouse').data;
    if (!tilemapData) {
      console.error('Tilemap data is null! Cannot initialize level.');
      return;
    }
    
    console.log('Initializing level with tilemap:', tilemapData);
    
    // Create isometric tilemap renderer
    this.isoMap = new IsometricTilemap(this, tilemapData, 'tiles');
    this.isoMap.build();
    
    // Auto-detect grid dimensions from tilemap
    this.gridWidth = this.isoMap.mapWidth;
    this.gridHeight = this.isoMap.mapHeight;
    console.log(`Grid dimensions: ${this.gridWidth}x${this.gridHeight}`);
    
    // Debug: Log all available layers
    console.log('Available layers:', this.isoMap.getLayerNames());
    
    // Debug: Check conveyor layer tiles
    console.log(`Checking for conveyor belts on "${this.levelConfig.conveyorLayer}" layer...`);
    for (let y = 0; y < this.isoMap.mapHeight; y++) {
      for (let x = 0; x < this.isoMap.mapWidth; x++) {
        if (this.isoMap.hasTileAt(x, y, this.levelConfig.conveyorLayer)) {
          console.log(`Found conveyor tile at (${x}, ${y})`);
        }
      }
    }
    
    // Create the player at starting position
    const start = this.levelConfig.playerStart;
    this.isoPlayer = new IsometricPlayer(this, this.isoMap, 'robot', start.x, start.y, {
      scale: 2,
      zHeight: 8,
      highlightTile: true,
      highlightColor: 0x000080,
      moveDuration: 300,      // Animation speed (ms) - lower = faster movement
      moveDelay: 200,           // Delay between moves (ms) - higher = slower gameplay
      depth: 10000,
      frameOffset: 4,
      startDirection: start.direction
    });
    
    console.log(`Player created at (${start.x}, ${start.y}), direction: ${start.direction}`);
    console.log(`Player sprite frame: ${this.isoPlayer.sprite.frame.name}`);
    
    // Set up camera
    this.isoMap.centerCamera(this.cameras.main, this.defaultZoom);
    
    // Spawn items at configured positions
    this.levelConfig.itemSpawns.forEach(spawn => {
      console.log(`Spawning ${spawn.spriteKey} at grid position (${spawn.x}, ${spawn.y})`);
      const screenPos = this.isoMap.gridToScreen(spawn.x, spawn.y, 20);
      console.log(`Screen position: (${screenPos.x}, ${screenPos.y})`);
      
      this.isoMap.spawnItem(spawn.spriteKey, spawn.x, spawn.y, {
        frame: spawn.frame,
        scale: spawn.scale,
        zHeight: 20,
        visualOffsetX: 0,//35,
        visualOffsetY: 0//-20
      });
    });
  }
  
  /**
   * Reset the level to initial state
   */
  resetLevel() {
    // Reload level config from LevelManager in case it changed
    if (window.LevelManager) {
      this.levelConfig = window.LevelManager.getCurrentLevel();
    }
    
    // Destroy existing entities
    if (this.isoPlayer) {
      this.isoPlayer.destroy();
      this.isoPlayer = null;
    }
    if (this.isoMap) {
      this.isoMap.destroy();
      this.isoMap = null;
    }
    
    // Reinitialize level
    this.initLevel();
  }
  
  /**
   * Load a new level (requires scene restart for new tilemap)
   */
  loadNewLevel() {
    // Reload level config from LevelManager
    if (window.LevelManager) {
      this.levelConfig = window.LevelManager.getCurrentLevel();
      console.log('Loading new level:', this.levelConfig.title);
    }
    
    // Clear the cached tilemap to force reload
    if (this.cache.tilemap.exists('warehouse')) {
      this.cache.tilemap.remove('warehouse');
    }
    
    // Clear any existing map and player
    if (this.isoPlayer) {
      this.isoPlayer.destroy();
      this.isoPlayer = null;
    }
    if (this.isoMap) {
      this.isoMap.destroy();
      this.isoMap = null;
    }
    
    // Restart the scene to reload assets with new config
    this.scene.restart();
  }
  
  /**
   * Check if a position is a goal conveyor
   */
  isGoalConveyor(x, y) {
    return this.levelConfig.goalConveyors.some(goal => goal.x === x && goal.y === y);
  }
  
  /**
   * Check if a position is a conveyor belt
   */
  isConveyor(x, y) {
    return this.isoMap.hasTileAt(x, y, this.levelConfig.conveyorLayer);
  }
  
  /**
   * Check win/lose condition after dropping an item
   */
  checkDropCondition(x, y) {
    const currentLevel = window.LevelManager ? window.LevelManager.currentLevel : 1;
    
    if (this.isGoalConveyor(x, y)) {
      this.showMessage('🎉 Congratulations! You successfully delivered the box!', 'success');
      
      // Show win modal after a short delay
      this.time.delayedCall(1000, () => {
        if (window.showResultModal) {
          window.showResultModal(true, currentLevel, 0);
        }
      });
      
      return 'win';
    } else if (!this.isConveyor(x, y)) {
      this.showMessage('❌ Game Over! You dropped the box in the wrong place.', 'fail');
      
      // Show lose modal after a short delay
      this.time.delayedCall(1000, () => {
        if (window.showResultModal) {
          window.showResultModal(false, currentLevel, 0);
        }
      });
      
      return 'lose';
    }
    return 'continue';
  }
  
  /**
   * Show a message to the player
   */
  showMessage(text, type = 'info') {
    // Remove existing message if any
    if (this.messageText) {
      this.messageText.destroy();
    }
    
    // Create message text
    const color = type === 'success' ? '#00ff00' : type === 'fail' ? '#ff0000' : '#ffffff';
    this.messageText = this.add.text(400, 50, text, {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: color,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center'
    });
    this.messageText.setOrigin(0.5);
    this.messageText.setDepth(100000);
    this.messageText.setScrollFactor(0); // Fixed to camera
    
    // Auto-remove after 3 seconds
    this.time.delayedCall(3000, () => {
      if (this.messageText) {
        this.messageText.destroy();
        this.messageText = null;
      }
    });
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
  
  const scene = _getScene();
  if (scene) {
    scene.isMoving = true;
  }
  
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
  
  if (scene) {
    scene.isMoving = false;
  }
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

  /** Item interaction */
  spawnItem: (spriteKey, gridX, gridY, config = {}) => {
    const scene = _getScene();
    if (!scene || !scene.isoMap) return null;
    return scene.isoMap.spawnItem(spriteKey, gridX, gridY, config);
  },
  
  pickupItem: () => _enqueue('pickupItem', async () => {
    const scene = _getScene();
    if (!scene || !scene.isoPlayer) return false;
    return scene.isoPlayer.pickupItem();
  }),
  
  dropItem: () => _enqueue('dropItem', async () => {
    const scene = _getScene();
    if (!scene || !scene.isoPlayer) return false;
    
    // Get the position where item will be dropped
    const pos = scene.isoPlayer.getPositionInFront();
    const result = scene.isoPlayer.dropItem();
    
    if (result) {
      // Check win/lose condition
      scene.checkDropCondition(pos.x, pos.y);
    }
    
    return result;
  }),
  
  isCarryingItem: () => {
    const scene = _getScene();
    if (!scene || !scene.isoPlayer) return false;
    return scene.isoPlayer.isCarryingItem();
  },

  /** Utilities */
  face: (dirName) => _enqueue('face', async () => _face(dirName)),
  setPosition: (tx, ty) => _enqueue('setPosition', async () => _setPosition(tx, ty)),
  
  /** Level management */
  resetLevel: () => {
    const scene = _getScene();
    if (!scene) return;
    scene.resetLevel();
  },
  
  loadNewLevel: () => {
    const scene = _getScene();
    if (!scene) return;
    scene.loadNewLevel();
  },

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