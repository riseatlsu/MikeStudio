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
    this.layers = {}; // Store all layers by name
    this.layerSprites = {}; // Store sprites organized by layer name
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
    // Process all layers from the tilemap
    const layers = this.mapData.layers;
    
    if (!layers || layers.length === 0) {
      console.warn('No layers found in tilemap');
      return;
    }
    
    // Sort layers by their depth/order for proper rendering
    const sortedLayers = [...layers].sort((a, b) => {
      // Layers are sorted by their index (order in Tiled)
      return layers.indexOf(a) - layers.indexOf(b);
    });
    
    // Create sprites for each layer
    sortedLayers.forEach((layer, layerIndex) => {
      if (layer.type !== 'tilelayer') return; // Only process tile layers
      
      this.layers[layer.name] = layer;
      this.layerSprites[layer.name] = [];
      
      // Special handling for backwards compatibility
      if (layer.name === 'Floor') {
        this.floorSprites = [];
      }
      
      for (let y = 0; y < this.mapHeight; y++) {
        if (layer.name === 'Floor') {
          this.floorSprites[y] = [];
        }
        
        for (let x = 0; x < this.mapWidth; x++) {
          const index = y * this.mapWidth + x;
          const tileId = layer.data[index];
          
          if (tileId > 0) {
            // Calculate Z offset based on layer order (higher layers get more offset)
            const zOffset = layerIndex > 0 ? 8 : 0;
            const screenPos = this.gridToScreen(x, y, zOffset);
            
            const sprite = this.scene.add.sprite(screenPos.x, screenPos.y, this.tilesetTexture);
            sprite.setFrame(tileId - 1);
            sprite.setOrigin(0.5, 0.5);
            sprite.gridX = x;
            sprite.gridY = y;
            sprite.gridZ = layerIndex; // Layer index determines depth priority
            sprite.layerName = layer.name;
            sprite.tileId = tileId;
            
            // Store in layer-specific array
            this.layerSprites[layer.name].push(sprite);
            this.allSprites.push(sprite);
            
            // Backwards compatibility - store floor tiles in grid
            if (layer.name === 'Floor') {
              this.floorSprites[y][x] = sprite;
            }
            
            // Backwards compatibility - store props
            if (layer.name === 'Props') {
              this.propSprites.push(sprite);
            }
          }
        }
      }
    });
    
    // Sort and set depth
    this.updateDepth();
  }
  
  /**
   * Update depth sorting for all sprites
   * Ensures proper back-to-front rendering order for isometric view
   */
  updateDepth() {
    this.allSprites.sort((a, b) => {
      // First priority: Z layer (floors vs props)
      // This ensures ALL floors render before ALL props
      if (a.gridZ !== b.gridZ) return a.gridZ - b.gridZ;
      
      // Within same layer, sort by grid Y (back to front)
      if (a.gridY !== b.gridY) return a.gridY - b.gridY;
      
      // Then by grid X
      if (a.gridX !== b.gridX) return a.gridX - b.gridX;
      
      return 0;
    });
    
    // Assign depth values
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
   * Get tile at a specific grid position and layer
   * @param {number} gridX - Grid X position
   * @param {number} gridY - Grid Y position
   * @param {string} layerName - Name of the layer to query
   * @returns {Object|null} Object with tileId and sprite, or null if no tile
   */
  getTileAt(gridX, gridY, layerName) {
    if (!this.layerSprites[layerName]) {
      console.warn(`Layer "${layerName}" not found`);
      return null;
    }
    
    const sprite = this.layerSprites[layerName].find(
      s => s.gridX === gridX && s.gridY === gridY
    );
    
    if (sprite) {
      return {
        tileId: sprite.tileId,
        sprite: sprite,
        gridX: gridX,
        gridY: gridY,
        layerName: layerName
      };
    }
    
    return null;
  }
  
  /**
   * Get all tiles at a specific grid position across all layers
   * @param {number} gridX - Grid X position
   * @param {number} gridY - Grid Y position
   * @returns {Array<Object>} Array of tile objects with tileId, sprite, and layerName
   */
  getAllTilesAt(gridX, gridY) {
    const tiles = [];
    
    Object.keys(this.layerSprites).forEach(layerName => {
      const tile = this.getTileAt(gridX, gridY, layerName);
      if (tile) {
        tiles.push(tile);
      }
    });
    
    return tiles;
  }
  
  /**
   * Get list of all layer names
   * @returns {Array<string>} Array of layer names
   */
  getLayerNames() {
    return Object.keys(this.layers);
  }
  
  /**
   * Check if a tile exists at a position on a specific layer
   * @param {number} gridX - Grid X position
   * @param {number} gridY - Grid Y position
   * @param {string} layerName - Name of the layer to check
   * @returns {boolean} True if a tile exists at that position
   */
  hasTileAt(gridX, gridY, layerName) {
    return this.getTileAt(gridX, gridY, layerName) !== null;
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
    this.frameOffset = config.frameOffset || 0; // Offset to select different rows in sprite sheet
    
    // Create the sprite
    const screenPos = isoMap.gridToScreen(gridX, gridY, config.zHeight || 8);
    this.sprite = scene.add.sprite(screenPos.x, screenPos.y, spriteKey);
    this.sprite.setFrame(this.direction + this.frameOffset);
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
      this.sprite.setFrame(this.direction + this.frameOffset);
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
    
    // Check if there's a blocking prop on the Props layer
    if (this.isoMap.hasTileAt(gridX, gridY, 'Props')) {
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
   * Get the grid position in front of the player based on current direction
   * @returns {{x: number, y: number}} Grid coordinates in front of player
   */
  getPositionInFront() {
    let x = this.gridX;
    let y = this.gridY;
    
    switch (this.direction) {
      case 0: y += 1; break; // South
      case 1: x += 1; break; // East
      case 2: x -= 1; break; // West
      case 3: y -= 1; break; // North
    }
    
    return { x, y };
  }
  
  /**
   * Get tile in front of player on a specific layer
   * @param {string} layerName - Name of the layer to query
   * @returns {Object|null} Tile object or null
   */
  getTileInFront(layerName) {
    const pos = this.getPositionInFront();
    return this.isoMap.getTileAt(pos.x, pos.y, layerName);
  }
  
  /**
   * Get all tiles in front of player across all layers
   * @returns {Array<Object>} Array of tile objects
   */
  getAllTilesInFront() {
    const pos = this.getPositionInFront();
    return this.isoMap.getAllTilesAt(pos.x, pos.y);
  }
  
  /**
   * Check if there's a tile in front of player on a specific layer
   * @param {string} layerName - Name of the layer to check
   * @returns {boolean} True if tile exists
   */
  hasTileInFront(layerName) {
    const pos = this.getPositionInFront();
    return this.isoMap.hasTileAt(pos.x, pos.y, layerName);
  }
  
  /**
   * Get tile at player's current position on a specific layer
   * @param {string} layerName - Name of the layer to query
   * @returns {Object|null} Tile object or null
   */
  getTileAtPosition(layerName) {
    return this.isoMap.getTileAt(this.gridX, this.gridY, layerName);
  }
  
  /**
   * Get all tiles at player's current position across all layers
   * @returns {Array<Object>} Array of tile objects
   */
  getAllTilesAtPosition() {
    return this.isoMap.getAllTilesAt(this.gridX, this.gridY);
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
