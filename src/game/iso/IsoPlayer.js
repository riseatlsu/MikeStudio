/**
 * @fileoverview IsoPlayer - Player-controlled robot entity in the isometric environment.
 * Handles movement, rotation, object interaction, and carrying mechanics.
 * @module game/iso/IsoPlayer
 */

import { MoveableObject } from './IsoObjects';
import { gridToScreen } from './IsoUtils';
import { directionToNumber, directionToString } from './DirectionConstants';

/**
 * IsoPlayer - Player-controlled robot with movement and interaction capabilities.
 * 
 * Extends MoveableObject to add:
 * - Directional facing (NORTH, SOUTH, EAST, WEST)
 * - Forward movement with collision detection
 * - Object pickup and drop mechanics
 * - Smooth tween-based animations
 * - API methods for Blockly code execution
 * 
 * Direction Mapping (Isometric Grid):
 * - NORTH (3): Grid Row decreases (move towards top-right)
 * - EAST (1): Grid Col increases (move towards bottom-right)
 * - SOUTH (0): Grid Row increases (move towards bottom-left)
 * - WEST (2): Grid Col decreases (move towards top-left)
 * 
 * @class IsoPlayer
 * @extends MoveableObject
 */
export class IsoPlayer extends MoveableObject {
  /**
   * Create an IsoPlayer instance.
   * 
   * @param {Phaser.Scene} scene - The Phaser scene this player belongs to
   * @param {IsoBoard} board - The isometric board
   * @param {number} gridRow - Starting grid row position
   * @param {number} gridCol - Starting grid column position
   * @param {string} texture - Phaser texture key for robot sprite
   * @param {Object} [config={}] - Player configuration
   * @param {number|string} [config.direction=0] - Initial direction (0-3 or 'NORTH'/'SOUTH'/'EAST'/'WEST')
   * @param {number} [config.zHeight=10] - Vertical offset for depth sorting
   * @param {boolean} [config.collidable=true] - Whether player blocks movement
   */
  constructor(scene, board, gridRow, gridCol, texture, config = {}) {
    super(scene, board, gridRow, gridCol, texture, {
        ...config,
        zHeight: config.zHeight || 10,
        collidable: true, // Player is collidable by default
        visualOffsetX: -2, // Move visual offsets here so they apply during sprite creation
        visualOffsetY: 4 // Adjusted: position player on tile
    });
    
    // Explicitly set these on the instance too in case super doesn't assign 
    // them to this (MoveableObject usually does if it puts them in config, but IsoObject reads from config)
    this.visualOffsetX = -2;
    this.visualOffsetY = 4;
    
    this.type = 'player';
    this.sprite.isoType = 'player';
    
    // Direction: 0=South(SW), 1=East(SE), 2=West(NW), 3=North(NE)
    // Based on user sprite sheet: 0=South, 1=East, 2=West, 3=North
    // Geometric mapping for Isometric (Grid Row/Col):
    // NE (North) = Grid Row-
    // SE (East)  = Grid Col+
    // SW (South) = Grid Row+
    // NW (West)  = Grid Col-
    // Accepts both string directions ('NORTH', 'SOUTH', etc.) and numeric (0-3)
    this.direction = directionToNumber(config.direction !== undefined ? config.direction : 0);
    
    // Fix initial facing
    this.sprite.setFrame(this.direction);

    // Carried item visual offset (adjust this single value to move carried items)
    this.carriedItemYOffset = 7;
  }

  /**
   * Get the grid coordinates directly in front of the player.
   * 
   * Calculates target coordinates based on current direction:
   * - NORTH: Row - 1
   * - EAST: Col + 1
   * - SOUTH: Row + 1
   * - WEST: Col - 1
   * 
   * @returns {{row: number, col: number}} Grid coordinates in front of player
   */
  getFrontCoordinates() {
    let dRow = 0;
    let dCol = 0;
    switch(this.direction) {
        case 0: dRow = 1; break;  // South (SW) => Grid Row+
        case 1: dCol = 1; break;  // East (SE)  => Grid Col+
        case 2: dCol = -1; break; // West (NW)  => Grid Col-
        case 3: dRow = -1; break; // North (NE) => Grid Row-
    }
    return { row: this.gridRow + dRow, col: this.gridCol + dCol };
  }

  /**
   * Get the current direction as a string name.
   * 
   * @returns {string} Cardinal direction ('NORTH', 'SOUTH', 'EAST', 'WEST')
   */
  getDirectionName() {
    return directionToString(this.direction);
  }

  // --- API for Blockly / Executor ---

  /**
   * Move the player forward one grid space.
   *
   * Checks walkability (collision detection) before moving. If blocked,
   * returns false. If successful, the grid position commits IMMEDIATELY
   * (not when the visual animation finishes) - this is what keeps the
   * player and any NPC robots perfectly synchronized on the shared
   * GameClock, so collision checks can never read a stale position. The
   * tween is purely cosmetic and always spans exactly one tick.
   *
   * Used by Blockly code generation - this is the runtime implementation
   * of the "move_forward" block.
   *
   * @async
   * @returns {Promise<boolean>} True if movement successful, false if blocked
   */
  async moveForward() {
    const target = this.getFrontCoordinates();

    if (this.board.isWalkable(target.row, target.col)) {
        if (this.scene.sound) this.scene.sound.play('tire_move', { volume: 0.35 });

        // Commit logical position and depth-sort metadata NOW, synchronously -
        // this is the tick boundary. Everything below is cosmetic only.
        this.gridRow = target.row;
        this.gridCol = target.col;
        this.sprite.isoRow = this.gridRow;
        this.sprite.isoCol = this.gridCol;

        const tickMs = this.scene.gameClock.tickMs;

        // Smooth cosmetic glide - does not gate collision/logical state.
        const pos = gridToScreen(target.row, target.col, this.board.tileWidth, this.board.tileHeight, this.zHeight);
        this.scene.tweens.add({
            targets: this.sprite,
            x: pos.x + this.visualOffsetX,
            y: pos.y + this.board.tileHeight / 2 + this.visualOffsetY,
            duration: tickMs,
            ease: 'Power1'
        });

        // Tween carried item too - also commits instantly (consistent with
        // everything else), tween is cosmetic only. Captured as a local
        // reference rather than closing over `this.carriedItem`, since
        // drop_object could run (and null out this.carriedItem) before this
        // tween's onComplete would otherwise fire - two independent Phaser
        // timers with the same nominal duration have no ordering guarantee.
        const carried = this.carriedItem;
        if (carried) {
           carried.gridRow = target.row;
           carried.gridCol = target.col;
           carried.sprite.isoRow = target.row;
           carried.sprite.isoCol = target.col;

           const itemPos = gridToScreen(target.row, target.col, this.board.tileWidth, this.board.tileHeight, this.zHeight + carried.carriedZOffset);
           this.scene.tweens.add({
               targets: carried.sprite,
               x: itemPos.x + this.visualOffsetX,
               y: itemPos.y + this.board.tileHeight / 2 + this.visualOffsetY + this.carriedItemYOffset,
               duration: tickMs,
               ease: 'Power1'
           });
        }

        await this.scene.gameClock.waitTicks(1);
        return true;
    } else {
        // Collision occurred - log it
        const collisionInfo = this.board.getCollisionInfo(target.row, target.col);

        // Log collision event if DataLogger is available
        if (window.dataLogger && window.LevelManager) {
            window.dataLogger.logCollision(
                window.LevelManager.currentLevelId,
                collisionInfo.type,
                {
                    playerRow: this.gridRow,
                    playerCol: this.gridCol,
                    playerDirection: this.getDirectionName(),
                    targetRow: target.row,
                    targetCol: target.col,
                    objectId: collisionInfo.objectId,
                    objectType: collisionInfo.objectType
                }
            );
        }

        // Crashing into another (NPC) robot is a hard fail - the robot is
        // meant to safely route around other robots, not drive into them.
        // Throwing (rather than just returning false, like other collisions)
        // halts the rest of the running program immediately, so it can't go
        // on to complete the delivery and overwrite this fail with a win.
        if (collisionInfo.type === 'robot') {
            if (this.scene.sound) this.scene.sound.play('robot_impact');
            const otherRobot = this.board.getMoveableAt(target.row, target.col);
            await this._playCrashAnimation(otherRobot);
            if (window.showResultModal) {
                window.showResultModal(
                    false,
                    window.LevelManager?.currentLevelId,
                    "You crashed into another robot! Robots must safely avoid each other while transporting boxes."
                );
            }
            throw new Error('Crashed into another robot!');
        }

        await this.scene.gameClock.waitTicks(1);
        return false; // Collision or OOB
    }
  }

  async turnCounterClockwise() {
      // CCW: North(3)->West(2)->South(0)->East(1)->North(3)
      const map = { 3: 2, 2: 0, 0: 1, 1: 3 };
      this.direction = map[this.direction];
      this.sprite.setFrame(this.direction);

      // Cosmetic squash-flash effect only, stretched across one tick - does
      // not gate anything, unlike movement this has no collision implication.
      const tickMs = this.scene.gameClock.tickMs;
      this.scene.tweens.add({
          targets: this.sprite,
          scaleX: this.sprite.scaleX * 0.9,
          scaleY: this.sprite.scaleY * 0.9,
          duration: tickMs / 2,
          yoyo: true
      });

      await this.scene.gameClock.waitTicks(1);
      return true;
  }

  async turnClockwise() {
      // CW: North(3)->East(1)->South(0)->West(2)->North(3)
      const map = { 3: 1, 1: 0, 0: 2, 2: 3 };
      this.direction = map[this.direction];
      this.sprite.setFrame(this.direction);

      const tickMs = this.scene.gameClock.tickMs;
      this.scene.tweens.add({
          targets: this.sprite,
          scaleX: this.sprite.scaleX * 0.9,
          scaleY: this.sprite.scaleY * 0.9,
          duration: tickMs / 2,
          yoyo: true
      });

      await this.scene.gameClock.waitTicks(1);
      return true;
  }

  // Interactions
  async pickUp() {
      // Every exit path below waits exactly 1 tick, success or failure alike -
      // so every action the player takes is uniformly paced, no exceptions.
      if (this.carriedItem) {
          await this.scene.gameClock.waitTicks(1);
          return false;
      }

      const front = this.getFrontCoordinates();
      const obj = this.board.getMoveableAt(front.row, front.col);

      // NEW: Check if location allows pickup
      const robotLocation = this.board.getStationaryAt(this.gridRow, this.gridCol);
      if (!robotLocation || robotLocation.isoType !== 'zone') {
          await this.scene.gameClock.waitTicks(1);
          return false;  // Cannot pick up from conveyor
      }

      // Check if object exists, is not already carried, and is pickupable
      if (obj && !obj.isCarried) {
          // Check pickupable flag (default to true if not set)
          const canPickup = obj.pickupable !== undefined ? obj.pickupable : true;
          if (canPickup) {
              if (this.scene.sound) this.scene.sound.play('box_sound', { volume: 1.4 });
              obj.pickUp(this);
              this.carriedItem = obj;

              // Update grid position to be on top of player
              obj.gridRow = this.gridRow;
              obj.gridCol = this.gridCol;

              // Calculate position on top of robot with z-offset
              const itemPos = gridToScreen(this.gridRow, this.gridCol, this.board.tileWidth, this.board.tileHeight, this.zHeight + obj.carriedZOffset);

              // Animate the pickup: lift the item up and onto the robot
              // (cosmetic only - carriedItem is already tracked above)
              this.scene.tweens.add({
                  targets: obj.sprite,
                  x: itemPos.x + this.visualOffsetX,
                  y: itemPos.y + this.board.tileHeight / 2 + this.visualOffsetY + this.carriedItemYOffset,
                  duration: this.scene.gameClock.tickMs,
                  ease: 'Back.easeOut',
                  onComplete: () => {
                      obj.sprite.isoRow = this.gridRow;
                      obj.sprite.isoCol = this.gridCol;
                      obj.sprite.isoZ = this.zHeight + obj.carriedZOffset; // Higher z = render on top
                  }
              });

              console.log(`Picked up object at (${front.row}, ${front.col})`);

              // Check fail conditions right away (e.g. picking up a flagged/
              // defective object without sensing it first) - don't wait for
              // a drop to catch it, mirroring the NPC-collision hard fail.
              this.checkLevelConditions();

              await this.scene.gameClock.waitTicks(1);
              return true;
          }
      }

      console.log(`No pickupable object at (${front.row}, ${front.col})`);
      await this.scene.gameClock.waitTicks(1);
      return false;
  }

  async drop() {
      // As with pickUp(), every exit path waits exactly 1 tick, success or
      // failure alike, for uniform pacing.
      if (!this.carriedItem) {
          await this.scene.gameClock.waitTicks(1);
          return false;
      }
      const front = this.getFrontCoordinates();

      if (!this.board.hasFloorAt(front.row, front.col)) {
          await this.scene.gameClock.waitTicks(1);
          return false;
      }

      // 1. Cannot drop if another moveable object is already there
      if (this.board.getMoveableAt(front.row, front.col)) {
          await this.scene.gameClock.waitTicks(1);
          return false;
      }

      // 2. Check Stationary Objects (like conveyors or walls)
      const stationary = this.board.getStationaryAt(front.row, front.col);
      const onConveyor = stationary && stationary.getAttribute('allowDrop');

      if (stationary) {
          const allowsDrop = stationary.getAttribute('allowDrop');

          // If target doesn't allow drop, check if it's a conveyor and player is on a zone
          if (!allowsDrop) {
               if (stationary.isoType === 'conveyor') {
                   // Can drop on conveyor only if player is standing on a zone
                   const playerLocation = this.board.getStationaryAt(this.gridRow, this.gridCol);
                   if (!playerLocation || playerLocation.isoType !== 'zone') {
                       await this.scene.gameClock.waitTicks(1);
                       return false; // Player must be on a zone to drop onto conveyor
                   }
                   // Player is on zone - allow drop on conveyor
               } else if (stationary.collidable) {
                   await this.scene.gameClock.waitTicks(1);
                   return false; // Other obstacles block drops
               }
          }
          // If allowsDrop is true, we proceed regardless of collidable status
      }

      // Get details about what's being dropped
      const droppedItem = this.carriedItem;
      const objectId = droppedItem.attributes?.id || null;
      const objectType = droppedItem.type || 'object';

      if (this.scene.sound) this.scene.sound.play('box_sound');

      this.carriedItem.drop(front.row, front.col);
      this.carriedItem = null;

      // Log the drop action
      if (window.dataLogger && this.scene.levelManager?.currentLevelId) {
          window.dataLogger.logDrop(this.scene.levelManager.currentLevelId, {
              dropRow: front.row,
              dropCol: front.col,
              onConveyor: onConveyor,
              objectId: objectId,
              objectType: objectType,
              conveyorId: onConveyor ? stationary.attributes?.id : null,
              playerRow: this.gridRow,
              playerCol: this.gridCol,
              playerDirection: this.direction
          });
      }

      // Check win/fail conditions after dropping
      this.checkLevelConditions();

      await this.scene.gameClock.waitTicks(1);
      return true;
  }

  checkLevelConditions() {
      // Delay check slightly to allow animations to complete
      this.scene.time.delayedCall(300, () => {
          const levelManager = this.scene.levelManager;
          if (!levelManager || !levelManager.currentLevelId) return;
          
          // Check fail conditions first
          const failResult = levelManager.checkFailConditions(
              levelManager.currentLevelId, 
              this.board, 
              this
          );
          
          if (failResult.failed) {
              console.log('Level Failed:', failResult.reason);
              // Show fail modal/notification
              if (window.showResultModal) {
                  window.showResultModal(false, levelManager.currentLevelId);
              }
              return;
          }
          
          // Check win conditions
          const won = levelManager.checkWinConditions(
              levelManager.currentLevelId,
              this.board
          );
          
          if (won) {
              console.log('Level Complete!');
              if (this.scene.sound) this.scene.sound.play('victory');
              // Mark level as complete
              levelManager.completeLevel(levelManager.currentLevelId);
              // Show win modal/notification
              if (window.showResultModal) {
                  window.showResultModal(true, levelManager.currentLevelId);
              }
          }
      });
  }

  /**
   * Shake + flash both robots red on a robot-vs-robot crash, before the fail
   * modal appears - purely cosmetic (a terminal "game over" beat, not part
   * of the simulation loop), so plain real-time tweens/timers are fine here.
   * @param {IsoObject|null} otherRobot - The NPC robot collided with, if found
   * @returns {Promise<void>} Resolves once the animation finishes
   */
  _playCrashAnimation(otherRobot) {
      return new Promise((resolve) => {
          const sprites = [this.sprite];
          if (otherRobot?.sprite) sprites.push(otherRobot.sprite);
          const originalTints = sprites.map((s) => s.tintTopLeft);

          this.scene.cameras.main.shake(400, 0.008);

          sprites.forEach((sprite) => {
              const originalX = sprite.x;
              this.scene.tweens.add({
                  targets: sprite,
                  x: { from: originalX - 3, to: originalX + 3 },
                  duration: 50,
                  yoyo: true,
                  repeat: 7,
                  onComplete: () => { sprite.x = originalX; }
              });
          });

          let toggles = 0;
          const maxToggles = 6; // 3 full red/normal flash cycles
          this.scene.time.addEvent({
              delay: 80,
              repeat: maxToggles - 1,
              callback: () => {
                  toggles++;
                  const showRed = toggles % 2 === 1;
                  sprites.forEach((sprite, i) => {
                      sprite.setTint(showRed ? 0xff0000 : originalTints[i]);
                  });
              }
          });

          this.scene.time.delayedCall(600, () => {
              sprites.forEach((sprite, i) => sprite.setTint(originalTints[i]));
              resolve();
          });
      });
  }

}
