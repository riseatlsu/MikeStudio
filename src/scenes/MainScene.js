/**
 * @fileoverview MainScene - Primary Phaser game scene for pAIrStudio.
 * Handles game initialization, asset loading, level rendering, and player control.
 * @module scenes/MainScene
 */

import Phaser from 'phaser';

import { IsoBoard } from '../game/iso/IsoBoard';
import { IsoPlayer } from '../game/iso/IsoPlayer';
import { IsoNPC } from '../game/iso/IsoNPC';
import { LevelBuilder } from '../game/levels/LevelBuilder';
import { LevelManager } from '../game/levels/LevelManager';
import { getLevel } from '../game/levels/index';
import { gridToScreen } from '../game/iso/IsoUtils';
import { GameClock } from '../game/GameClock';

// Real-world ms per game-loop tick. Every player action (move/turn/pick/drop)
// and every NPC patrol step advances by whole ticks, so they're always
// perfectly synchronized - see src/game/GameClock.js.
const TICK_MS = 500;

/**
 * MainScene - Primary game scene for the warehouse robot simulation.
 * 
 * Manages the lifecycle of game levels, including asset loading, level building,
 * player initialization, and camera setup for the isometric environment.
 * 
 * @class MainScene
 * @extends Phaser.Scene
 */
export class MainScene extends Phaser.Scene {
  /**
   * Create a MainScene instance.
   * 
   * Initializes the Phaser scene with key 'MainScene' and creates the
   * LevelManager for handling level progression.
   */
  constructor() {
    super({ key: 'MainScene' });
    this.levelManager = new LevelManager();
    this.npcRobots = [];
    this.gameClock = null;
  }

  /**
   * Phaser preload lifecycle method.
   * 
   * Loads all sprite sheets and assets required for the game:
   * - Isometric floor tiles
   * - Robot sprite sheet (animated by direction)
   * - Box sprite sheet
   * 
   * Resolves base path for deployment compatibility (GitHub Pages, etc.).
   */
  preload() {
    // Load Assets - resolve base path for GitHub Pages compatibility
    const basePath = import.meta.env?.BASE_URL || '/';
    const sanitizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
    this.load.setPath(`${sanitizedBase}/assets`);
    
    // 0. Floor Tiles (Basic Floor=0)
    this.load.spritesheet('tiles', 'floor.png', { 
        frameWidth: 64, 
        frameHeight: 32 
    });

    // 1. Conveyor Belt (6 frames, conveyor piece oriented vertically)
    this.load.spritesheet('conveyor', 'ConveyorBelt-Blue.png', { 
        frameWidth: 66, 
        frameHeight: 50,
    });

    // Pickup Floor (used for input zones)
    this.load.spritesheet('pickup_zone', 'PickUp-Floor.png', {
        frameWidth: 66,
        frameHeight: 33
    });

    // Dropoff Floor (used for output zones)
    this.load.spritesheet('dropoff_zone', 'DropOff-Floor.png', {
        frameWidth: 66,
        frameHeight: 33
    });

    this.load.spritesheet('pillars', 'Pillars.png', { 
        frameWidth: 66,
        frameHeight: 156
    });

    this.load.spritesheet('walls', 'Walls.png', {
        frameWidth: 98,
        frameHeight: 177 
    });

    this.load.spritesheet('shelves', 'Shelves.png', {
        frameWidth: 65.875,
        frameHeight: 70 
    });

    this.load.spritesheet('drums', 'OilDrums.png', {
        frameWidth: 66,
        frameHeight: 54
    });

    // 2. Robot (Rows for different types, Cols for direction)
    // Frame Width: 24, Height: 16
    this.load.spritesheet('robot', 'Robot_TileSet.png', { 
        frameWidth: 24, 
        frameHeight: 16 
    });

    // 3. Boxes
    // Frame Width: 22, Height: 21
    this.load.spritesheet('box', 'box.png', {
        frameWidth: 22,
        frameHeight: 21
    });

    // 4. Sound Effects
    this.load.audio('tire_move', 'sounds/Tire_move.wav');
    this.load.audio('victory', 'sounds/victory.wav');
    this.load.audio('robot_impact', 'sounds/robot_impact.wav');
    this.load.audio('box_sound', 'sounds/box_sound1.wav');
    this.load.audio('talking_sound', 'sounds/talking_sound.wav');
    this.load.audio('talking_sound_low', 'sounds/lower_talking_sound.wav');
  }

  /**
   * Phaser create lifecycle method.
   * 
   * Initializes the isometric board, exposes global API references,
   * and triggers the first level load via LevelManager.
   * 
   * Sets up:
   * - IsoBoard instance
   * - Global window.IsoBoard reference for GameAPI
   * - Camera bounds and zoom
   * - Initial level loading
   */
  create() {
    // Initialize Board System
    this.isoBoard = new IsoBoard(this, {
        tileWidth: 64,
        tileHeight: 32,
        width: 10,
        height: 10
    });

    // Initialize Level Builder
    this.levelBuilder = new LevelBuilder(this, this.isoBoard, {
        floor: { key: 'tiles', frame: 0 },
        robot: { key: 'robot', frameOffset: 0 }, 
        box: { key: 'box', frame: 0 },
        conveyor: Array.from({ length: 6 }, (_, frame) => ({ key: 'conveyor', frame })), // conveyor frames 0-5
        pickup_zone: Array.from({ length: 4 }, (_, frame) => ({ key: 'pickup_zone', frame })), // pickup zone frames 0-3
        dropoff_zone: Array.from({ length: 4 }, (_, frame) => ({ key: 'dropoff_zone', frame })), // dropoff zone frames 0-3
        pillars: Array.from({ length: 4 }, (_, frame) => ({ key: 'pillars', frame })), // pillars frames 0-3
        walls: Array.from({ length: 2 }, (_, frame) => ({ key: 'walls', frame })), // walls frames 0-1
        shelves: Array.from({ length: 8 }, (_, frame) => ({ key: 'shelves', frame })), // shelves frames 0-7
        oilDrums: Array.from({ length: 4 }, (_, frame) => ({ key: 'drums', frame })) // oil drum frames 0-3
    });

    // Make LevelManager globally available
    window.LevelManager = this.levelManager;

    // Make scene available globally for survey access
    window.phaser_scene = this;

    const inSandbox = Boolean(window.experimentManager && window.experimentManager.sandboxMode);
    if (inSandbox) {
        // Sandbox.js drives its own progression/level choice once it finishes
        // setting up (see initializeSandbox() in src/sandbox/sandbox.js) - mark
        // sandbox mode on the LevelManager now so getCurrentLevel()/loadLevelById()
        // never touch real-study localStorage, and skip the auto-resume below so
        // it can't race with (or get overridden by) that explicit sandbox load.
        this.levelManager.setSandboxMode(true);
    } else {
        // Phaser boots and this create() callback fires independently of the
        // consent overlay (which is just a DOM element on top of the canvas)
        // - without this gate, a brand-new participant would have tutorial_A
        // (and its Mack dialogue box) loaded and shown before ever touching
        // the consent checkbox. Read the cookie directly rather than
        // window.experimentManager.groupId/latinSquareRow, since those are
        // only populated once index.html's DOMContentLoaded handler calls
        // experimentManager.initialize() - which may not have run yet at
        // this point - while getCookie() is a stateless, synchronous read.
        const hasConsented = window.experimentManager?.getCookie?.('pair_consented') === 'true';

        if (hasConsented) {
            const groupId = window.experimentManager.groupId || window.experimentManager.getCookie('pair_group');
            if (groupId) {
                this.levelManager.setLevelProgression(
                    groupId,
                    window.experimentManager.getLatinSquareRow()
                );
            }

            // Load the saved current level (or first level in progression if first time)
            const savedLevel = this.levelManager.getCurrentLevel();

            // Use loadLevelById to ensure chatbot initialization happens if needed
            this.levelManager.loadLevelById(savedLevel);
        } else {
            // No level loaded yet - index.html's consent button handler calls
            // LevelManager.loadLevelById() itself once consent is granted.
            console.log('MainScene: Waiting for consent before loading the first level.');
        }
    }

    // Handle Resize Events to keep board centered
    this.scale.on('resize', (gameSize) => {
        this.cameras.resize(gameSize.width, gameSize.height);
        this.centerCamera();
    });

    // Camera Controls - Pan & Zoom
    this.input.on('pointermove', (pointer) => {
        if (!pointer.isDown) return;

        this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
        this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
    });

    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
        const newZoom = this.cameras.main.zoom - deltaY * 0.001;
        this.cameras.main.setZoom(Phaser.Math.Clamp(newZoom, 0.5, 3.0));
    });
  }

  loadLevel(levelId) {
      // 0. Stop the shared game clock and any NPC patrol subscriptions FIRST,
      // before anything destroys their sprites. This must happen before
      // isoBoard.clear() - a tick firing after clear() would try to tween a
      // null sprite. Since GameAPI.resetLevel() calls loadLevel() on every
      // single "Run Code" click (LevelManager has no restartLevel() method to
      // short-circuit to), skipping this would leak ticks/timers on every run.
      if (this.gameClock) this.gameClock.stop();
      this.npcRobots.forEach(npc => npc.stopPatrol());
      this.npcRobots = [];

      // 1. Clear existing board state
      if (this.isoBoard) {
          this.isoBoard.clear();
      }

      // 2. Clear existing player
      if (this.player) {
          // IsoPlayer.destroy() might not exist or might just destroy sprite.
          // Since board.clear() destroyed the sprite, we just null the ref.
          this.player = null;
      }

      const config = getLevel(levelId);
      if (!config) {
          console.error(`Level ${levelId} not found!`);
          return;
      }

      console.log(`Loading Level: ${config.title}`);

      // Set current level FIRST
      this.levelManager.currentLevelId = levelId;
      
      // Register level with LevelManager
      this.levelManager.registerLevel(config);

      // Build the level
      const playerConfig = this.levelBuilder.build(config);

      // Spawn Player
      this.player = new IsoPlayer(this, this.isoBoard, playerConfig.startRow, playerConfig.startCol, 'robot', {
          direction: playerConfig.startDir,
          scale: playerConfig.scale // Apply scale from config
      });

      // Add player to the board's sprite list so updateDepth() sees it
      this.isoBoard.allSprites.push(this.player.sprite);
      this.isoBoard.moveableObjects.push(this.player);

      // Start the shared game clock BEFORE spawning NPCs - their startPatrol()
      // subscribes to it immediately.
      if (!this.gameClock) this.gameClock = new GameClock(this, TICK_MS);
      this.gameClock.start();

      // 3. Spawn NPC robots (patrolling non-player robots), if this level has any
      (config.npcRobots || []).forEach(npcCfg => {
          // randomizeStart: spawn mid-patrol at a random point in the path
          // instead of always path[0], so a participant can't hardcode a
          // fixed turn-count "wait" that happens to dodge a deterministic
          // patrol - they have to actually sense and wait.
          const startIndex = npcCfg.randomizeStart
              ? Math.floor(Math.random() * npcCfg.path.length)
              : 0;
          const start = npcCfg.path[startIndex];
          const npc = new IsoNPC(this, this.isoBoard, start.row, start.col, 'robot', {
              id: npcCfg.id,
              path: npcCfg.path,
              ticksPerStep: npcCfg.ticksPerStep,
              startIndex,
              scale: playerConfig.scale
          });
          this.isoBoard.allSprites.push(npc.sprite);
          this.isoBoard.moveableObjects.push(npc);
          npc.startPatrol();
          this.npcRobots.push(npc);
      });

      // Register level as current
      this.levelManager.currentLevelId = levelId;

      // Center Camera on the Board
      this.centerCamera();
  }

  centerCamera() {
      if (!this.isoBoard) return;

      // Calculate geometric center of the specific board dimensions
      const midGridX = (this.isoBoard.mapWidth - 1) / 2;
      const midGridY = (this.isoBoard.mapHeight - 1) / 2;
      const centerPos = gridToScreen(midGridX, midGridY, this.isoBoard.tileWidth, this.isoBoard.tileHeight, 0);

      // Calculate Board Dimensions in Screen Space
      // Projection Width = (Rows + Cols) * (TileWidth / 2)
      const isoWidth = (this.isoBoard.mapWidth + this.isoBoard.mapHeight) * (this.isoBoard.tileWidth / 2);
      const isoHeight = (this.isoBoard.mapWidth + this.isoBoard.mapHeight) * (this.isoBoard.tileHeight / 2);

      // Get Viewport Dimensions
      const screenWidth = this.cameras.main.width;
      const screenHeight = this.cameras.main.height;

      // Calculate optimal zoom to fit ~95% of the screen (corners touch edges)
      const zoomX = screenWidth / isoWidth;
      const zoomY = screenHeight / isoHeight;
      const zoom = Math.min(zoomX, zoomY) * 0.95;

      // Clamp Zoom to reasonable values
      const finalZoom = Phaser.Math.Clamp(zoom, 0.5, 3.0);

      // Apply
      this.cameras.main.centerOn(centerPos.x, centerPos.y);
      this.cameras.main.setZoom(finalZoom);
  }

  update() {
    if (this.isoBoard) {
        this.isoBoard.updateDepth();
    }
  }
}
