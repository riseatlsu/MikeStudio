/**
 * @fileoverview LevelManager - Manages level progression, state, and UI updates.
 * Handles level registration, loading, completion tracking, and progression control.
 * @module game/levels/LevelManager
 */

// Level Manager - Handles State, Progression, and Persistence
import { getLevel } from './index';
import { getLevelProgression } from '../../experiment/GroupConfig.js';

/**
 * LevelManager - Manages level progression and user interface updates.
 * 
 * Responsibilities:
 * - Registering level definitions
 * - Loading and initializing levels
 * - Tracking completed levels
 * - Managing level progression UI (progress circles)
 * - Updating instruction banners
 * - Persisting progress to localStorage
 * - Group-specific level sequences
 * 
 * @class LevelManager
 */
export class LevelManager {
    constructor() {
        this.currentLevelId = null;
        this.levels = {}; // Registry of all loaded definitions
        this.sandboxMode = false;
        this.completedLevels = this.loadProgress();
        
        // Level progression is now dynamic based on experimental group
        // Will be set in setLevelProgression() after group assignment
        this.allLevelIds = [];
    }
    
    /**
     * Set the level progression based on the assigned experimental group
     * This should be called after group assignment
     * @param {string} groupId - The experimental group ID
     */
    setLevelProgression(groupId, latinSquareRow = null) {
        this.allLevelIds = getLevelProgression(groupId, latinSquareRow);
        console.log(`LevelManager: Set progression for group ${groupId} (Latin square row ${latinSquareRow}):`, this.allLevelIds);
        
        // Update progress UI if it exists
        if (document.getElementById('level-progress-container')) {
            this.updateProgressUI();
        }
    }

    /**
     * Enable or disable sandbox mode which bypasses persistence and locks
     * @param {boolean} enable
     */
    setSandboxMode(enable = true) {
        this.sandboxMode = enable;
        if (enable) {
            this.completedLevels = [];
            console.log('LevelManager: Sandbox mode enabled');
        }
    }

    /**
     * Directly set a custom level progression (used by sandbox UI)
     * @param {Array<string>} levelIds
     */
    setCustomProgression(levelIds = []) {
        this.allLevelIds = [...levelIds];
        if (document.getElementById('level-progress-container')) {
            this.updateProgressUI();
        }
    }
    
    /**
     * Get the level progression (for external access)
     */
    getLevelProgression() {
        return this.allLevelIds;
    }

    registerLevel(config) {
        this.levels[config.id] = config;
        console.log(`Level registered: ${config.id}`);
        
        // Update Blockly toolbox for this level FIRST (before UI updates)
        if (window.blocklyManager && window.blocklyManager.updateToolboxForLevel) {
            window.blocklyManager.updateToolboxForLevel(config);
            console.log(`Toolbox updated for level: ${config.id}`);
        }
        
        // Update UI after registering (currentLevelId should already be set)
        this.updateInstructionsUI(this.currentLevelId || config.id);
        this.updateProgressUI();
    }

    /**
     * Update the instructions banner with current level info
     */
    updateInstructionsUI(levelId) {
        const config = this.levels[levelId];
        if (!config) return;
        
        const titleElement = document.getElementById('instructions-title-text');
        const textElement = document.getElementById('instructions-text');

        if (titleElement && textElement) {
            const levelName = config.title || `Level ${levelId}`;
            titleElement.textContent = levelName;

            let instructions = config.instructions || config.description || 'Complete the level objectives.';

            // Instructions are now uniform for all groups
            // Role-specific instructions removed since pair programming mode is archived

            // Append the optional chatbot-only hint only for participants who
            // actually have Otto, same condition used for dialogue filtering
            // above - avoids telling control-group participants about an
            // assistant they don't have access to.
            if (config.chatbotHint) {
                const hasChatbot = config.chatbotEnabled !== false &&
                    !!window.experimentManager?.hasFeature('chatbot');
                if (hasChatbot) {
                    instructions += ' ' + config.chatbotHint;
                }
            }

            textElement.innerHTML = instructions;
        }

        this.updateHelpGifUI(config);
    }

    /**
     * Show/hide the "Help" button in the instructions banner based on whether
     * the current level defines a helpGif, and wire up the modal that displays it.
     */
    updateHelpGifUI(config) {
        const helpBtn = document.getElementById('help-gif-btn');
        if (!helpBtn) return;

        if (config.helpGif) {
            helpBtn.style.display = '';
            helpBtn.dataset.gif = config.helpGif;
        } else {
            helpBtn.style.display = 'none';
            delete helpBtn.dataset.gif;
        }

        if (!this._helpGifModalInitialized) {
            this._helpGifModalInitialized = true;

            const modal = document.getElementById('help-gif-modal-overlay');
            const closeBtn = document.getElementById('help-gif-close-btn');
            const image = document.getElementById('help-gif-image');

            helpBtn.addEventListener('click', () => {
                if (!modal || !image || !helpBtn.dataset.gif) return;
                image.src = helpBtn.dataset.gif;
                modal.classList.add('show');
            });

            if (closeBtn && modal) {
                closeBtn.addEventListener('click', () => modal.classList.remove('show'));
            }
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) modal.classList.remove('show');
                });
            }
        }
    }

    /**
     * Update the level progress UI
     */
    updateProgressUI() {
        const container = document.getElementById('level-progress-container');
        if (!container) return;

        // Clear existing content
        container.innerHTML = '';

        // Create circles for each level
        this.allLevelIds.forEach((levelId, index) => {
            const circle = this.createLevelCircle(levelId, index + 1);
            container.appendChild(circle);
        });
    }

    /**
     * Create a level circle element
     */
    createLevelCircle(levelId, displayNumber) {
        const circle = document.createElement('div');
        circle.className = 'level-circle';
        circle.dataset.levelId = levelId;
        
        // Check if completed
        if (this.completedLevels.includes(levelId)) {
            circle.classList.add('completed');
        }
        
        // Check if active
        if (levelId === this.currentLevelId) {
            circle.classList.add('active');
        }
        
        // Check if locked (only allow current and completed levels)
        const isLocked = !this.isLevelUnlocked(levelId);
        if (isLocked) {
            circle.classList.add('locked');
        }
        
        // Set display text - extract letter/number from level ID
        let displayText = displayNumber;
        
        // Get the part after the last underscore
        const parts = levelId.split('_');
        const suffix = parts[parts.length - 1];
        
        // Check if suffix is a number (like '001') or a letter (like 'A') or 'final' for survey
        if (/^\d+$/.test(suffix)) {
            // It's a number - parse to remove leading zeros
            displayText = parseInt(suffix, 10);
        } else if (/^[a-zA-Z]+$/.test(suffix) && suffix.length === 1) {
            // It's a single letter - use uppercase
            displayText = suffix.toUpperCase();
        } else if (levelId.includes('survey')) {
            // It's a survey level - use 'S'
            displayText = 'S';
        }
        
        circle.textContent = displayText;
        
        // Add click handler for unlocked levels
        if (!isLocked) {
            circle.style.cursor = 'pointer';
            circle.addEventListener('click', () => {
                this.loadLevelById(levelId);
            });
        }
        
        return circle;
    }

    /**
     * Check if a level is unlocked
     * Only current level is accessible - no going back to completed levels
     */
    isLevelUnlocked(levelId) {
        if (this.sandboxMode) {
            return true;
        }
        // Only the current level is unlocked
        return levelId === this.currentLevelId;
    }

    /**
     * Load a level by its ID (for level circle clicks)
     */
    async loadLevelById(levelId) {
        let config = this.levels[levelId];

        // If level not registered yet, try to get it from the LEVELS registry
        if (!config) {
            config = getLevel(levelId);
            if (!config) {
                console.error(`Level not found: ${levelId}`);
                return;
            }
            // REGISTER IT NOW so other managers can see it
            this.levels[levelId] = config;
        }

        // Set current level ID FIRST
        this.currentLevelId = levelId;

        // Save current level to localStorage for persistence across page reloads (BEFORE survey check)
        this.saveCurrentLevel(levelId);

        // Show the NPC dialogue intro (once per participant per level) before
        // anything else loads. Covers both normal levels and the survey level
        // uniformly since it runs before the survey-type branch below.
        if (Array.isArray(config.dialogue) && window.dialogueUI) {
            if (!window.dialogueUI.hasSeen(levelId)) {
                const hasChatbot = config.chatbotEnabled !== false &&
                    !!window.experimentManager?.hasFeature('chatbot');
                // Dialogue entries are normally plain strings; an entry can
                // also be { text, requiresChatbot: true } to mark a line that
                // only makes sense for participants who actually have Otto
                // (e.g. tutorial_B's "meet your AI assistant" beat) - skip
                // those for everyone else instead of showing a line that
                // references a feature they don't have.
                const lines = config.dialogue
                    .filter(line => typeof line === 'string' || !line.requiresChatbot || hasChatbot)
                    .map(line => typeof line === 'string' ? line : line.text);

                if (lines.length > 0) {
                    await window.dialogueUI.show(lines, levelId);
                }
                window.dialogueUI.markSeen(levelId);
            }
        }

        // Check if this is a survey level
        if (config.type === 'survey') {
            console.log('Loading survey level');

            // Session timer's job is done once the survey is reached, whether
            // that happened naturally or via the "time's up" redirect
            if (window.timerManager) {
                window.timerManager.stop();
            }

            // Call survey's onLoad function
            if (config.onLoad && window.experimentManager) {
                config.onLoad(window.phaser_scene, window.experimentManager);
            }
            
            // Update UI elements
            this.updateInstructionsUI(levelId);
            this.updateProgressUI();
            
            console.log(`Switched to survey: ${levelId}`);
            return; // Skip game loading for surveys
        }
        
        // Trigger scene reload FIRST before any UI updates
        if (window.GameAPI && window.GameAPI.loadLevel) {
            window.GameAPI.loadLevel(config);
        }
        
        // Log level start
        if (window.dataLogger) {
            window.dataLogger.logLevelStart(levelId);
        }
        
        // Note: Group assignment now happens on consent, not on first experimental level
        // Chatbot initialization also happens on consent for groups with chatbot support
        
        // Update UI elements
        this.updateInstructionsUI(levelId);
        this.updateProgressUI();
        
        // Update Blockly toolbox for this level
        if (window.blocklyManager && window.blocklyManager.updateToolboxForLevel) {
            window.blocklyManager.updateToolboxForLevel(config);
        }
        
        // Update chatbot visibility and state for this level
        if (window.chatbotManager && window.chatbotManager.isInitialized) {
            window.chatbotManager.switchLevel(levelId, config);
        }
        
        console.log(`Switched to level: ${levelId}`);
    }

    // --- Persistence (Cookies/LocalStorage) ---

    /**
     * Get the saved current level from localStorage
     * @returns {string} The saved level ID or first level in progression as default
     */
    getCurrentLevel() {
        try {
            if (this.sandboxMode) {
                return this.allLevelIds.length > 0 ? this.allLevelIds[0] : 'tutorial_A';
            }
            const saved = localStorage.getItem('pair_studio_current_level');
            // If a level is saved and it exists in our progression, use it
            if (saved && this.allLevelIds.includes(saved)) {
                return saved;
            }
        } catch (e) {
            console.error('Failed to load current level', e);
        }
        // Default to first level in progression (or tutorial_A if progression not set yet)
        return this.allLevelIds.length > 0 ? this.allLevelIds[0] : 'tutorial_A';
    }

    /**
     * Save the current level to localStorage
     * @param {string} levelId - The level ID to save
     */
    saveCurrentLevel(levelId) {
        try {
            if (this.sandboxMode) {
                return;
            }
            localStorage.setItem('pair_studio_current_level', levelId);
        } catch (e) {
            console.error('Failed to save current level', e);
        }
    }

    loadProgress() {
        try {
            if (this.sandboxMode) {
                return [];
            }
            const stored = localStorage.getItem('pair_studio_progress');
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error("Failed to load progress", e);
            return [];
        }
    }

    saveProgress(levelId, gameStateSnapshot) {
        if (!this.completedLevels.includes(levelId)) {
            this.completedLevels.push(levelId);
        }
        
        if (!this.sandboxMode) {
            // Save simple list of completed IDs
            localStorage.setItem('pair_studio_progress', JSON.stringify(this.completedLevels));
            
            // Save specific level snapshot (end state)
            if (gameStateSnapshot) {
                localStorage.setItem(`pair_studio_snapshot_${levelId}`, JSON.stringify(gameStateSnapshot));
            }
        }
        
        // Update UI after completing level
        this.updateProgressUI();
    }

    /**
     * Mark a level as completed (alternative to saveProgress)
     */
    completeLevel(levelId) {
        if (!this.completedLevels.includes(levelId)) {
            this.completedLevels.push(levelId);
            if (!this.sandboxMode) {
                localStorage.setItem('pair_studio_progress', JSON.stringify(this.completedLevels));
            }
            this.updateProgressUI();
            
            // Log level completion
            if (window.dataLogger) {
                window.dataLogger.logLevelComplete(levelId, true, {
                    completedLevels: this.completedLevels.length
                });
            }
        }
    }

    /**
     * Go to next level in sequence
     */
    nextLevel() {
        const currentIndex = this.allLevelIds.indexOf(this.currentLevelId);
        if (currentIndex >= 0 && currentIndex < this.allLevelIds.length - 1) {
            const nextLevelId = this.allLevelIds[currentIndex + 1];
            this.loadLevelById(nextLevelId);
            return nextLevelId;
        }
        return null; // No more levels
    }

    // --- Level Flow ---

    getLevel(id) {
        return this.levels[id];
    }

    getNextLevel(currentId) {
        const ids = Object.keys(this.levels); // Assuming inserted in order
        const idx = ids.indexOf(currentId);
        if (idx > -1 && idx < ids.length - 1) {
            return ids[idx + 1];
        }
        return null; // End of game
    }

    // --- Win Condition Checking ---

    checkWinConditions(levelId, board) {
        const config = this.levels[levelId];
        if (!config) return false;

        // Iterate through all win conditions
        return config.winConditions.every(condition => {
            if (condition.type === 'itemAtPos') {
                // Find the item by ID in the moveable objects list
                const item = board.moveableObjects.find(o => o.id === condition.itemId);

                if (!item) return false; // Item missing?

                // Check position match
                return item.gridRow === condition.row && item.gridCol === condition.col && !item.isCarried;
            }
            if (condition.type === 'itemNotAtPos') {
                // Inverse of itemAtPos - used to require that an item (e.g. a
                // defective box) NOT be delivered to a given position.
                const item = board.moveableObjects.find(o => o.id === condition.itemId);

                if (!item) return true; // Missing item can't be "at" the forbidden tile

                return !(item.gridRow === condition.row && item.gridCol === condition.col && !item.isCarried);
            }
            return false;
        });
    }

    checkFailConditions(levelId, board, player) {
        const config = this.levels[levelId];

        // Level-specific hard-fail rules declared via config.failConditions.
        // Currently supports 'carriedAttribute': picking up (carrying) an
        // object flagged with a given attribute (e.g. a defective box) ends
        // the level immediately - mirrors the NPC-collision hard fail, so
        // sensing/checking before acting is required rather than optional.
        if (config && Array.isArray(config.failConditions)) {
            for (const rule of config.failConditions) {
                if (rule.type === 'carriedAttribute') {
                    const item = board.moveableObjects.find(o => o.id === rule.itemId);
                    if (item && item.isCarried && item.attributes?.[rule.attribute] === true) {
                        return { failed: true, reason: rule.reason || 'Picked up a flagged object!' };
                    }
                }
            }
        }

        // Example: Box dropped on floor (not conveyor)
        // This is tricky because we allow dropping on floor for re-arranging.
        // But the user request said: "conditions that should end the game like the box being placed on the floor instead of a conveyour belt"

        // Let's implement that specific strict rule:
        // Any box not on a conveyor = FAIL.
        
        // Filter for boxes only - must positively match isoType 'box' rather than
        // just excluding the player, since NPC robots (isoType 'robot') are also
        // MoveableObjects that spend most of their time on ordinary floor tiles;
        // an exclusion-based filter would false-positive-fail any level with an
        // NPC the instant a drop action re-checks conditions.
        const boxes = board.moveableObjects.filter(o => !o.isCarried && o.isoType === 'box');
        
        for (let box of boxes) {
             const stat = board.getStationaryAt(box.gridRow, box.gridCol);
             // If there is NO stationary object here, OR the stationary object is NOT a conveyor
             if (!stat || stat.isoType !== 'conveyor') {
                 return { failed: true, reason: "Box dropped on the floor!" };
             }
        }
        
        return { failed: false };
    }
}
