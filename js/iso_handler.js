/**
 * IsometricTilemap - Custom isometric tilemap renderer for Phaser
 * Handles conversion between grid and screen coordinates, tile rendering, and depth sorting
 */
export class IsometricTilemap {
  constructor(scene, mapData, tilesetTexture) {
    this.scene = scene;
    this.mapData = mapData;
    this.tilesetTexture = tilesetTexture;
    this.tileWidth = mapData.tilewidth;
    this.tileHeight = mapData.tileheight;
    this.mapWidth = mapData.width;
    this.mapHeight = mapData.height;
    
    this.floorSprites = [];
    this.propSprites = [];
    this.allSprites = [];
  }
  
  /**
   * Convert grid coordinates to screen coordinates using isometric projection
   * @param {number} gridX - Grid X position
   * @param {number} gridY - Grid Y position
   * @param {number} z - Height offset (default 0)
   * @returns {{x: number, y: number}} Screen coordinates
   */
  gridToScreen(gridX, gridY, z = 0) {
    const x = (gridX - gridY) * (this.tileWidth / 2);
    const y = (gridX + gridY) * (this.tileHeight / 2) - z;
    return { x, y };
  }
  
  /**
   * Convert screen coordinates to grid coordinates
   * @param {number} screenX - Screen X position
   * @param {number} screenY - Screen Y position
   * @returns {{x: number, y: number}} Grid coordinates
   */
  screenToGrid(screenX, screenY) {
    const gridX = (screenX / (this.tileWidth / 2) + screenY / (this.tileHeight / 2)) / 2;
    const gridY = (screenY / (this.tileHeight / 2) - screenX / (this.tileWidth / 2)) / 2;
    return { x: Math.floor(gridX), y: Math.floor(gridY) };
  }
  
  /**
   * Build the entire tilemap from the loaded Tiled JSON data
   * Creates sprites for all tiles and applies depth sorting
   */
  build() {
    const floorLayer = this.mapData.layers.find(layer => layer.name === 'Floor');
    const propsLayer = this.mapData.layers.find(layer => layer.name === 'Props');
    
    if (!floorLayer) {
      console.warn('No Floor layer found in tilemap');
      return;
    }
    
    // Create all sprites first
    for (let y = 0; y < this.mapHeight; y++) {
      this.floorSprites[y] = [];
      for (let x = 0; x < this.mapWidth; x++) {
        const index = y * this.mapWidth + x;
        const screenPos = this.gridToScreen(x, y, 0);
        
        // Create floor tile
        const floorTileId = floorLayer.data[index];
        if (floorTileId > 0) {
          const sprite = this.scene.add.sprite(screenPos.x, screenPos.y, this.tilesetTexture);
          sprite.setFrame(floorTileId - 1);
          sprite.setOrigin(0.5, 0.5);
          sprite.gridX = x;
          sprite.gridY = y;
          sprite.gridZ = 0;
          this.floorSprites[y][x] = sprite;
          this.allSprites.push(sprite);
        }
        
        // Create prop tile if props layer exists
        if (propsLayer) {
          const propTileId = propsLayer.data[index];
          if (propTileId > 0) {
            const propPos = this.gridToScreen(x, y, 16);
            const sprite = this.scene.add.sprite(propPos.x, propPos.y, this.tilesetTexture);
            sprite.setFrame(propTileId - 1);
            sprite.setOrigin(0.5, 0.5);
            sprite.gridX = x;
            sprite.gridY = y;
            sprite.gridZ = 16;
            this.propSprites.push(sprite);
            this.allSprites.push(sprite);
          }
        }
      }
    }
    
    // Sort and set depth
    this.updateDepth();
  }
  
  /**
   * Update depth sorting for all sprites
   * Ensures proper back-to-front rendering order for isometric view
   */
  updateDepth() {
    this.allSprites.sort((a, b) => {
      // Sort by Y first (back to front)
      if (a.gridY !== b.gridY) return a.gridY - b.gridY;
      // Then by X
      if (a.gridX !== b.gridX) return a.gridX - b.gridX;
      // Then by Z (height)
      return a.gridZ - b.gridZ;
    });
    
    // Assign depth values based on sort order
    this.allSprites.forEach((sprite, index) => {
      sprite.setDepth(index);
    });
  }
  
  /**
   * Get floor tile sprite at grid position
   * @param {number} gridX - Grid X position
   * @param {number} gridY - Grid Y position
   * @returns {Phaser.GameObjects.Sprite|null} The floor tile sprite or null
   */
  getFloorTile(gridX, gridY) {
    if (gridY >= 0 && gridY < this.floorSprites.length &&
        gridX >= 0 && gridX < this.floorSprites[gridY].length) {
      return this.floorSprites[gridY][gridX];
    }
    return null;
  }
  
  /**
   * Get all prop sprites at a grid position
   * @param {number} gridX - Grid X position
   * @param {number} gridY - Grid Y position
   * @returns {Array<Phaser.GameObjects.Sprite>} Array of prop sprites at that position
   */
  getPropsAtPosition(gridX, gridY) {
    return this.propSprites.filter(sprite => sprite.gridX === gridX && sprite.gridY === gridY);
  }
  
  /**
   * Center the camera on the map
   * @param {Phaser.Cameras.Scene2D.Camera} camera - The camera to center
   * @param {number} zoom - Optional zoom level (default 1)
   */
  centerCamera(camera, zoom = 1) {
    const centerPos = this.gridToScreen(this.mapWidth / 2, this.mapHeight / 2);
    camera.centerOn(centerPos.x, centerPos.y);
    camera.setZoom(zoom);
  }
  
  /**
   * Destroy all sprites created by this tilemap
   */
  destroy() {
    this.allSprites.forEach(sprite => sprite.destroy());
    this.floorSprites = [];
    this.propSprites = [];
    this.allSprites = [];
  }
}

/**
 * IsometricPlayer - Helper class for managing a player sprite in isometric space
 */
export class IsometricPlayer {
  constructor(scene, isoMap, spriteKey, gridX, gridY, config = {}) {
    this.scene = scene;
    this.isoMap = isoMap;
    this.gridX = gridX;
    this.gridY = gridY;
    this.direction = config.startDirection || 0; // 0=South, 1=East, 2=West, 3=North
    this.isMoving = false;
    
    // Create the sprite
    const screenPos = isoMap.gridToScreen(gridX, gridY, config.zHeight || 8);
    this.sprite = scene.add.sprite(screenPos.x, screenPos.y, spriteKey);
    this.sprite.setFrame(this.direction);
    this.sprite.setScale(config.scale || 1.6);
    this.sprite.setDepth(config.depth || 10000);
    
    // Highlighting
    this.currentTileHighlight = null;
    if (config.highlightTile) {
      this.highlightCurrentTile(config.highlightColor || 0x0066cc);
    }
    
    this.zHeight = config.zHeight || 8;
    this.moveDuration = config.moveDuration || 300;
  }
  
  /**
   * Highlight the current tile the player is on
   * @param {number} color - Hex color for the tint (default 0x0066cc)
   */
  highlightCurrentTile(color = 0x0066cc) {
    // Remove previous highlight
    if (this.currentTileHighlight) {
      this.currentTileHighlight.clearTint();
    }
    
    // Highlight the tile the player is on
    const tile = this.isoMap.getFloorTile(this.gridX, this.gridY);
    if (tile) {
      this.currentTileHighlight = tile;
      tile.setTint(color);
    }
  }
  
  /**
   * Update the sprite frame based on current direction
   */
  updateFrame() {
    if (this.sprite) {
      this.sprite.setFrame(this.direction);
    }
  }
  
  /**
   * Rotate the player
   * @param {number} delta - Negative for left, positive for right
   * @returns {Promise<boolean>}
   */
  async rotate(delta) {
    // Rotation mapping for sprite frames: 0=South, 1=East, 2=West, 3=North
    if (delta < 0) { // Turn left (counterclockwise)
      const leftSequence = [0, 1, 3, 2]; // South -> East -> North -> West
      const currentIndex = leftSequence.indexOf(this.direction);
      this.direction = leftSequence[(currentIndex + 1) % 4];
    } else { // Turn right (clockwise)
      const rightSequence = [0, 2, 3, 1]; // South -> West -> North -> East
      const currentIndex = rightSequence.indexOf(this.direction);
      this.direction = rightSequence[(currentIndex + 1) % 4];
    }
    
    this.updateFrame();
    
    return new Promise(resolve => {
      this.scene.time.delayedCall(100, () => resolve(true));
    });
  }
  
  /**
   * Move to a specific grid position
   * @param {number} gridX - Target grid X
   * @param {number} gridY - Target grid Y
   * @returns {Promise<boolean>}
   */
  async moveTo(gridX, gridY) {
    if (this.isMoving) return false;
    if (gridX < 0 || gridX >= this.isoMap.mapWidth || gridY < 0 || gridY >= this.isoMap.mapHeight) {
      return false;
    }
    
    this.isMoving = true;
    
    const screenPos = this.isoMap.gridToScreen(gridX, gridY, this.zHeight);
    
    return new Promise(resolve => {
      this.scene.tweens.add({
        targets: this.sprite,
        x: screenPos.x,
        y: screenPos.y,
        duration: this.moveDuration,
        ease: 'Power2',
        onComplete: () => {
          this.gridX = gridX;
          this.gridY = gridY;
          this.isMoving = false;
          this.highlightCurrentTile();
          resolve(true);
        }
      });
    });
  }
  
  /**
   * Move forward based on current direction
   * @returns {Promise<boolean>}
   */
  async moveForward() {
    let newX = this.gridX;
    let newY = this.gridY;
    
    switch (this.direction) {
      case 0: newY += 1; break; // South
      case 1: newX += 1; break; // East
      case 2: newX -= 1; break; // West
      case 3: newY -= 1; break; // North
    }
    
    return this.moveTo(newX, newY);
  }
  
  /**
   * Move backward based on current direction
   * @returns {Promise<boolean>}
   */
  async moveBackward() {
    let newX = this.gridX;
    let newY = this.gridY;
    
    switch (this.direction) {
      case 0: newY -= 1; break; // South (go North)
      case 1: newX -= 1; break; // East (go West)
      case 2: newX += 1; break; // West (go East)
      case 3: newY += 1; break; // North (go South)
    }
    
    return this.moveTo(newX, newY);
  }
  
  /**
   * Face a specific direction
   * @param {string} dirName - Direction name (south/down, east/right, west/left, north/up)
   * @returns {boolean}
   */
  face(dirName) {
    const dirMap = { 
      south: 0, down: 0,
      east: 1, right: 1,
      west: 2, left: 2,
      north: 3, up: 3
    };
    
    if (!(dirName in dirMap)) return false;
    
    this.direction = dirMap[dirName];
    this.updateFrame();
    return true;
  }
  
  /**
   * Get current player state
   * @returns {{direction: number, gridX: number, gridY: number, isMoving: boolean}}
   */
  getState() {
    return {
      direction: this.direction,
      gridX: this.gridX,
      gridY: this.gridY,
      isMoving: this.isMoving
    };
  }
  
  /**
   * Destroy the player sprite
   */
  destroy() {
    if (this.currentTileHighlight) {
      this.currentTileHighlight.clearTint();
    }
    this.sprite.destroy();
  }
}
