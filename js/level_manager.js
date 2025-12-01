/**
 * Level Manager
 * Handles level progression, state management, and level configuration
 */

class LevelManager {
  constructor() {
    // Restore saved progress or start at level 1
    const progress = this.getProgress();
    this.currentLevel = progress.currentLevel || 1;
    this.maxLevels = 8;
    this.levelData = this.initializeLevelData();
  }

  /**
   * Initialize level configurations
   */
  initializeLevelData() {
    return {
      1: {
        title: "Level 1: Getting Started",
        instructions: "Welcome to your first challenge! Move the box from the starting conveyor belt to the goal position. Use the blocks on the right to program the robot's movements.",
        mapFile: "lvl1_v2.json",
        playerStart: { x: 1, y: 6, direction: 0 },
        itemSpawns: [
          { spriteKey: 'boxes', x: 0, y: 7, frame: 0, scale: 1.5 }
        ],
        goalConveyors: [{ x: 7, y: 0 }],
        conveyorLayer: 'Tile Layer 2'
      },
      2: {
        title: "Level 2: Move Two",
        instructions: "In this level, you will be tasked to move each box from on conveyour belt to the conveyour belt right across from it.",
        mapFile: "lvl2.json", // Placeholder
        playerStart: { x: 1, y: 4, direction: 0 },
        itemSpawns: [
            { spriteKey: 'boxes', x: 0, y: 7, frame: 0, scale: 1.5 },
            { spriteKey: 'boxes', x: 0, y: 5, frame: 0, scale: 1.5 }
        ],
        goalConveyors: [{ x: 7, y: 7 },{ x: 7, y: 5 } ],
        conveyorLayer: 'Tile Layer 2'
      },
      // Levels 3-8 can be added here
      3: { title: "Level 3: Coming Soon", instructions: "To be implemented..." },
      4: { title: "Level 4: Coming Soon", instructions: "To be implemented..." },
      5: { title: "Level 5: Coming Soon", instructions: "To be implemented..." },
      6: { title: "Level 6: Coming Soon", instructions: "To be implemented..." },
      7: { title: "Level 7: Coming Soon", instructions: "To be implemented..." },
      8: { title: "Level 8: Coming Soon", instructions: "To be implemented..." }
    };
  }

  /**
   * Get current level configuration
   */
  getCurrentLevel() {
    return this.levelData[this.currentLevel];
  }

  /**
   * Get level configuration by number
   */
  getLevel(levelNumber) {
    return this.levelData[levelNumber];
  }

  /**
   * Advance to next level
   */
  nextLevel() {
    if (this.currentLevel < this.maxLevels) {
      this.currentLevel++;
      this.saveProgress();
      return true;
    }
    return false;
  }

  /**
   * Go to specific level
   */
  goToLevel(levelNumber) {
    if (levelNumber >= 1 && levelNumber <= this.maxLevels) {
      this.currentLevel = levelNumber;
      this.saveProgress();
      return true;
    }
    return false;
  }

  /**
   * Mark level as completed
   */
  completeLevel(levelNumber) {
    const progress = this.getProgress();
    if (!progress.completed.includes(levelNumber)) {
      progress.completed.push(levelNumber);
      progress.completed.sort((a, b) => a - b);
      this.saveProgressData(progress);
    }
  }

  /**
   * Get progress data
   */
  getProgress() {
    try {
      const saved = localStorage.getItem('level_progress');
      return saved ? JSON.parse(saved) : { currentLevel: 1, completed: [] };
    } catch (e) {
      return { currentLevel: 1, completed: [] };
    }
  }

  /**
   * Save progress
   */
  saveProgress() {
    const progress = this.getProgress();
    progress.currentLevel = this.currentLevel;
    this.saveProgressData(progress);
  }

  /**
   * Save progress data to localStorage
   */
  saveProgressData(progress) {
    try {
      localStorage.setItem('level_progress', JSON.stringify(progress));
    } catch (e) {
      console.error('Error saving progress:', e);
    }
  }

  /**
   * Update UI with level progress
   */
  updateProgressUI() {
    const progress = this.getProgress();
    const highestCompleted = progress.completed.length > 0 
      ? Math.max(...progress.completed) 
      : 0;
    
    console.log('Updating UI - Current:', this.currentLevel, 'Completed:', progress.completed);
    
    // Update level circles
    for (let i = 1; i <= this.maxLevels; i++) {
      const circle = document.querySelector(`.level-circle:nth-child(${i})`);
      if (circle) {
        circle.classList.remove('active', 'completed', 'locked');
        
        if (i === this.currentLevel) {
          circle.classList.add('active');
        } else if (progress.completed.includes(i)) {
          circle.classList.add('completed');
        } else if (i > highestCompleted + 1) {
          // Lock levels beyond the next available level
          circle.classList.add('locked');
        }
      }
    }

    // Update instructions
    const level = this.getCurrentLevel();
    const titleEl = document.querySelector('.instructions-title');
    const textEl = document.querySelector('.instructions-text');
    
    if (titleEl && level) {
      titleEl.innerHTML = `<i class="fas fa-info-circle"></i> ${level.title}`;
    }
    if (textEl && level) {
      textEl.textContent = level.instructions;
    }
  }
}

// Initialize level manager
window.LevelManager = new LevelManager();
