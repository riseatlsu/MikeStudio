/**
 * @fileoverview IsoNPC - A scripted, patrolling non-player robot.
 * Walks a fixed grid path on the shared GameClock (see src/game/GameClock.js),
 * independent of the player's own Blockly-driven movement, blocking movement
 * into its current tile and reporting as 'robot' to the player's sensing
 * blocks. Its logical grid position commits on the same tick boundary the
 * player's does, so a collision check can never read a stale position for
 * either side - the tween is purely cosmetic.
 * @module game/iso/IsoNPC
 */
import { MoveableObject } from './IsoObjects';
import { gridToScreen } from './IsoUtils';

// Robot_TileSet.png is a 96x32 sheet of 24x16 frames -> 4 columns x 2 rows.
// Row 0 (frames 0-3, S/E/W/N) is the player's look; row 1 (frames 4-7, same
// S/E/W/N order) is a visually distinct robot design reserved for NPCs, so
// they read as a different robot on sight without needing a tint.
const NPC_FRAME_ROW_OFFSET = 4;

export class IsoNPC extends MoveableObject {
    /**
     * @param {Phaser.Scene} scene
     * @param {IsoBoard} board
     * @param {number} gridRow - Starting row (should match path[0].row)
     * @param {number} gridCol - Starting col (should match path[0].col)
     * @param {string} texture - Texture key (reuses the player's 'robot' spritesheet)
     * @param {Object} config
     * @param {string} config.id
     * @param {Array<{row:number,col:number}>} config.path - Ordered, adjacent grid tiles to patrol
     * @param {number} [config.ticksPerStep=2] - Game-loop ticks between each step (patrol speed)
     * @param {number} [config.startIndex=0] - Index into path the NPC spawns/resumes at (gridRow/gridCol
     *   passed in should match path[startIndex]). Lets the caller randomize where in the patrol the NPC
     *   begins (see MainScene's randomizeStart handling) so a fixed hardcoded wait can't reliably predict
     *   when the corridor is clear.
     */
    constructor(scene, board, gridRow, gridCol, texture, config = {}) {
        super(scene, board, gridRow, gridCol, texture, {
            ...config,
            zHeight: config.zHeight ?? 10,
            collidable: true,
            pickupable: false, // Can't be picked up like a box
            visualOffsetX: -2,
            visualOffsetY: 4
        });

        this.type = 'npc';
        this.id = config.id || null;

        // Distinct isoType so GameAPI.survey()/getCollisionInfo() report 'robot'
        this.isoType = 'robot';
        this.sprite.isoType = 'robot';

        this.path = Array.isArray(config.path) && config.path.length > 0
            ? config.path
            : [{ row: gridRow, col: gridCol }];
        // caller spawns the NPC at path[startIndex] (default path[0])
        this.pathIndex = config.startIndex ?? 0;
        this.pathDirection = 1; // +1 forward, -1 backward (ping-pong); self-corrects at either end

        // Face the next step's direction (falling back to SOUTH if the
        // patrol path is a single tile) so the NPC shows its row-1 look from
        // the moment it spawns, not just after its first step.
        let initialDirFrame = 0;
        if (this.path.length > 1) {
            const first = this.path[this.pathIndex];
            const second = this.path[this.pathIndex + 1] ?? this.path[this.pathIndex - 1];
            initialDirFrame = this._directionFrame(second.row - first.row, second.col - first.col);
        }
        this.sprite.setFrame(initialDirFrame + NPC_FRAME_ROW_OFFSET);
        this.ticksPerStep = config.ticksPerStep ?? 2;
        this._ticksSinceLastStep = 0;
        this._unsubscribeTick = null;
    }

    /** Subscribe to the shared GameClock. Safe to call once per spawn. */
    startPatrol() {
        if (this._unsubscribeTick || this.path.length < 2) return;
        this._ticksSinceLastStep = 0;
        this._unsubscribeTick = this.scene.gameClock.onTick(() => this._onTick());
    }

    /**
     * Unsubscribe from the clock AND cancel any in-flight cosmetic tween.
     * Must be called before the level tears down (isoBoard.clear() nulls
     * sprites but has no awareness of tweens) - without killing the tween
     * too, an NPC mid-glide when "Run Code" is clicked (which is effectively
     * always, since NPCs move independently of the player's program) would
     * have its tween's onComplete fire after the sprite is already null.
     */
    stopPatrol() {
        if (this._unsubscribeTick) {
            this._unsubscribeTick();
            this._unsubscribeTick = null;
        }
        if (this.sprite) {
            this.scene.tweens.killTweensOf(this.sprite);
        }
    }

    _onTick() {
        this._ticksSinceLastStep++;
        if (this._ticksSinceLastStep < this.ticksPerStep) return;
        this._ticksSinceLastStep = 0;
        this._tryStep();
    }

    /** Maps a row/col movement delta to the S/E/W/N frame index (0-3) used by row 0. */
    _directionFrame(dRow, dCol) {
        if (dCol > 0) return 1;        // EAST
        if (dCol < 0) return 2;        // WEST
        if (dRow < 0) return 3;        // NORTH
        return 0;                      // SOUTH (default, includes dRow > 0)
    }

    _computeNextIndex() {
        let next = this.pathIndex + this.pathDirection;
        if (next < 0 || next >= this.path.length) {
            this.pathDirection *= -1;
            next = this.pathIndex + this.pathDirection;
        }
        return next;
    }

    _tryStep() {
        const nextIndex = this._computeNextIndex();
        const target = this.path[nextIndex];

        // If blocked (e.g. by the player), stall and retry on the next
        // scheduled step. No pathfinding - this is a fixed patrol route.
        if (!this.board.isWalkable(target.row, target.col)) return;

        this.pathIndex = nextIndex;

        const dRow = target.row - this.gridRow;
        const dCol = target.col - this.gridCol;
        const dirFrame = this._directionFrame(dRow, dCol);
        this.sprite.setFrame(dirFrame + NPC_FRAME_ROW_OFFSET);

        // Commit logical position IMMEDIATELY - this tick is the sync point
        // with the player. The tween below is cosmetic only.
        this.gridRow = target.row;
        this.gridCol = target.col;
        this.sprite.isoRow = target.row;
        this.sprite.isoCol = target.col;

        const pos = gridToScreen(target.row, target.col, this.board.tileWidth, this.board.tileHeight, this.zHeight);
        this.scene.tweens.add({
            targets: this.sprite,
            x: pos.x + this.visualOffsetX,
            y: pos.y + this.board.tileHeight / 2 + this.visualOffsetY,
            duration: this.ticksPerStep * this.scene.gameClock.tickMs,
            ease: 'Power1'
        });
    }
}
