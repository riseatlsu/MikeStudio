/**
 * @fileoverview ChatbotManager - Controls AI chatbot behavior and experimental modes.
 * Manages chatbot visibility, message handling, and mode-specific behaviors.
 * @module chatbot/ChatbotManager
 */

/**
 * ChatbotManager.js
 * Manages chatbot visibility, initialization, and message handling based on experimental groups
 * Modular design for easy adaptation to future studies
 */

import { getSystemPrompt, getInitialGreeting } from './PromptConfig.js';
import { ChatbotUI } from './ChatbotUI.js';
import * as BlocklyActions from './BlocklyActions.js';
import { directionToString } from '../game/iso/DirectionConstants.js';
import { buildAsciiMap } from './LevelMapRenderer.js';
import { validateBlocks, estimateEndState } from './BlockSpecValidator.js';

// 1 initial attempt + this many retries if generated code fails validation
// (missing required inputs, or a move that collides with a mapped obstacle).
const MAX_CODE_GEN_ATTEMPTS = 3;

// Detects "just add this to what I have" style requests. Deliberately
// narrow (rather than trying to classify every possible phrasing) - a false
// negative just falls back to the old full-replacement behavior, while a
// false positive on a request that actually wanted a rewrite is the worse
// direction of error, so REPLACEMENT_INTENT_PATTERN below wins any conflict.
const ADDITIVE_INTENT_PATTERN = /\b(add|extend|append|on top of|in addition)\b/i;
const REPLACEMENT_INTENT_PATTERN = /\b(start over|from scratch|rewrite|redo|replace|scrap|clear (everything|it all)|instead of)\b/i;

/**
 * If `newBlocks` begins by faithfully replaying all of `prevBlocks` (matched
 * by type, in order) before anything new, strip that replayed prefix off.
 *
 * This guards append mode against the model ignoring the "send only the new
 * blocks" instruction and replaying the old program anyway out of habit -
 * without this, appending old+new after the already-present old blocks
 * would duplicate the old code instead of just adding to it.
 */
function stripReplayedPrefix(newBlocks, prevBlocks) {
    if (!Array.isArray(prevBlocks) || prevBlocks.length === 0 || !Array.isArray(newBlocks)) {
        return newBlocks;
    }
    let i = 0;
    while (i < prevBlocks.length && i < newBlocks.length && newBlocks[i]?.type === prevBlocks[i]?.type) {
        i++;
    }
    // Only strip on a FULL match of the previous program - a partial/
    // coincidental match isn't good enough evidence it was a replay.
    return i === prevBlocks.length ? newBlocks.slice(i) : newBlocks;
}

// Attribute keys whose per-instance VALUE is the answer to a puzzle the
// student is meant to discover via code (check_attribute) at runtime, not be
// told directly - stripped from every object's attributes before it ever
// reaches the model, regardless of value (so neither having nor lacking the
// key is itself a tell).
const SECRET_ATTRIBUTE_KEYS = ['broken'];

// Substrings in an object id that would give away a puzzle's answer just by
// naming it (e.g. "level2_box_broken"), even with the attribute value
// hidden - level authors use human-readable ids like this for their own
// clarity, but they can't be shown to the AI as-is.
const REVEALING_ID_SUBSTRINGS = ['broken', 'defective', 'good', 'bad'];

/**
 * Deep-clone a level's objects/winConditions and strip anything that would
 * hand the AI assistant the answer to a "sense before you act" puzzle
 * (e.g. which of two boxes is the defective one) instead of letting the
 * student's own check_attribute code discover it at runtime.
 * @param {Object} currentLevel
 * @returns {{objects: Object|null, winConditions: Array|null}}
 */
function redactSecrets(currentLevel) {
    const objects = currentLevel.objects ? JSON.parse(JSON.stringify(currentLevel.objects)) : null;
    const winConditions = currentLevel.winConditions ? JSON.parse(JSON.stringify(currentLevel.winConditions)) : null;

    const idMap = new Map();
    let anonCounter = 1;

    const stripSecrets = (obj) => {
        if (obj.attributes) {
            SECRET_ATTRIBUTE_KEYS.forEach(key => delete obj.attributes[key]);
        }
        if (typeof obj.id === 'string' && REVEALING_ID_SUBSTRINGS.some(s => obj.id.toLowerCase().includes(s))) {
            const anonId = `item_${anonCounter++}`;
            idMap.set(obj.id, anonId);
            obj.id = anonId;
        }
    };

    (objects?.stationary || []).forEach(stripSecrets);
    (objects?.moveable || []).forEach(stripSecrets);

    // Keep winConditions internally consistent with the ids we just renamed
    // (e.g. itemAtPos/itemNotAtPos reference the same ids as objects.moveable).
    if (idMap.size > 0 && winConditions) {
        winConditions.forEach(cond => {
            if (cond.itemId && idMap.has(cond.itemId)) {
                cond.itemId = idMap.get(cond.itemId);
            }
        });
    }

    return { objects, winConditions };
}

const CHAT_FUNCTION_URL = import.meta.env.DEV
  ? '/api/getChatResponse'
  : 'https://us-central1-pair-studio-v1.cloudfunctions.net/getChatResponse';

/**
 * ChatbotManager - Manages AI chatbot functionality and experimental modes.
 * 
 * Modes:
 * - **Standard**: Passive AI assistant (for 'standard_ai' group)
 * 
 * Features:
 * - Automatic initialization based on experimental group
 * - Context-aware AI responses with game state
 * - Message history management per level
 * - Firebase logging of all interactions
 * 
 * @class ChatbotManager
 */
class ChatbotManager {
    constructor() {
        this.experimentManager = null;
        this.ui = null;
        this.chatHistory = [];
        this.isInitialized = false;
        this.currentMode = null; // 'standard'
    }

    /**
     * Initialize the chatbot manager
     * @param {Object} experimentManager - Reference to ExperimentManager
     */
    initialize(experimentManager) {
        this.experimentManager = experimentManager;

        // Determine if chatbot should be available based on experimental group
        const hasChatbot = this.experimentManager.hasFeature('chatbot');
        
        if (!hasChatbot) {
            console.log('ChatbotManager: Chatbot disabled for control group');
            this.isInitialized = true;
            return;
        }

        // Initialize UI (always create it if group has chatbot support)
        this.ui = new ChatbotUI();
        this.ui.initialize();

        // Set chatbot mode to standard
        this.currentMode = 'standard';
        
        console.log(`ChatbotManager: Mode set to 'standard'`);

        // Set up event listeners
        this.setupEventListeners();

        // Check if current level has chatbot disabled
        const currentLevel = window.LevelManager ? window.LevelManager.levels[window.LevelManager.currentLevelId] : null;
        const isChatbotDisabledForLevel = currentLevel?.chatbotEnabled === false;
        const shouldShowNow = !isChatbotDisabledForLevel;
        
        // Standard mode - workspace always enabled
        BlocklyActions.enableWorkspace();
        
        if (shouldShowNow) {
            // Load conversation history for current level
            this.loadHistory();

            // If no history, send initial greeting
            if (this.chatHistory.length === 0) {
                this.sendInitialGreeting();
            }

            // Show the chatbot
            this.show();
        } else {
            // Hide initially if current level has it disabled
            this.hide();
            console.log('ChatbotManager: Chatbot hidden for current level (will show on enabled levels)');
        }

        this.isInitialized = true;
        console.log(`ChatbotManager: Initialized in ${this.currentMode} mode`);
    }

    /**
     * Set up event listeners for chatbot interactions
     */
    setupEventListeners() {
        // Listen for user messages
        this.ui.onSendMessage((message) => {
            this.handleUserMessage(message);
        });
    }

    /**
     * Send initial greeting
     */
    sendInitialGreeting() {
        const greeting = getInitialGreeting();

        // Add to history
        this.chatHistory.push({
            role: 'assistant',
            content: greeting
        });
        
        // Save to localStorage
        this.saveHistory();

        if (this.ui) {
            this.ui.addBotMessage(greeting);
        }
    }

    /**
     * Handle user message
     * @param {string} message - User's message
     */
    async handleUserMessage(message) {
        // Add to chat history
        this.chatHistory.push({
            role: 'user',
            content: message
        });

        // Save history to localStorage
        this.saveHistory();

        // Log message if logging is available
        const currentLevel = window.LevelManager?.currentLevelId || 'unknown';
        if (window.dataLogger) {
            window.dataLogger.logChatMessage('user', message, currentLevel);
        }

        // Get system prompt based on mode and role
        const systemPrompt = this.getSystemPrompt();

        // Get game state for context
        const gameState = this.getGameStateContext();

        try {
            // Call the backend API
            const aiResponse = await this.getAIResponse(message);
            
            // Add AI response to history
            this.chatHistory.push({
                role: 'assistant',
                content: aiResponse.message
            });

            // Save history to localStorage
            this.saveHistory();

            // Display message in UI
            this.ui.addBotMessage(aiResponse.message);
            
            // Handle code blocks if present
            if (aiResponse.blocks && aiResponse.blocks.length > 0) {
                this.handleCodeGeneration(aiResponse.blocks, aiResponse.appendMode);
            }

            // Log bot response with full context
            const currentLevel = window.LevelManager?.currentLevelId || 'unknown';
            if (window.dataLogger) {
                // Log the message
                window.dataLogger.logChatMessage('assistant', aiResponse.message, currentLevel);
                
                // Log the full AI interaction context (system prompt + level context) for analysis
                window.dataLogger.logEvent('ai_interaction_context', {
                    levelId: currentLevel,
                    systemPrompt: systemPrompt,
                    levelContext: this.getLevelContext(),
                    userMessage: message,
                    aiResponse: aiResponse.message,
                    hadCodeBlocks: (aiResponse.blocks && aiResponse.blocks.length > 0)
                });
            }
        } catch (error) {
            console.error('ChatbotManager: Error handling message', error);
            this.ui.addBotMessage('❌ Sorry, I encountered an error. Please try again.');
        }
    }

    /**
     * Get storage key for conversation history
     * @returns {string} Storage key
     */
    getStorageKey() {
        const participantId = this.experimentManager?.participantId || 'anonymous';
        const levelId = window.LevelManager?.currentLevelId || 'level_001';
        const key = `chatHistory_${participantId}_${levelId}`;
        console.log('ChatbotManager: Storage key:', key);
        return key;
    }

    /**
     * Save conversation history to localStorage
     */
    saveHistory() {
        try {
            const key = this.getStorageKey();
            console.log('ChatbotManager: Saving history with key:', key, 'Messages:', this.chatHistory.length);
            localStorage.setItem(key, JSON.stringify(this.chatHistory));
            console.log('ChatbotManager: History saved successfully');
        } catch (error) {
            console.error('ChatbotManager: Error saving history', error);
        }
    }

    /**
     * Load conversation history from localStorage
     */
    loadHistory() {
        try {
            const key = this.getStorageKey();
            console.log('ChatbotManager: Loading history with key:', key);
            const savedHistory = localStorage.getItem(key);
            console.log('ChatbotManager: Raw saved data:', savedHistory);
            
            if (savedHistory) {
                this.chatHistory = JSON.parse(savedHistory);
                console.log(`ChatbotManager: Loaded ${this.chatHistory.length} messages from history`);
                
                // Restore messages in UI (only if UI exists)
                if (this.ui) {
                    this.chatHistory.forEach(msg => {
                        if (msg.role === 'user') {
                            this.ui.addUserMessage(msg.content);
                        } else if (msg.role === 'assistant') {
                            this.ui.addBotMessage(msg.content);
                        }
                    });
                }
            } else {
                console.log('ChatbotManager: No saved history found');
                this.chatHistory = [];
            }
        } catch (error) {
            console.error('ChatbotManager: Error loading history', error);
            this.chatHistory = [];
        }
    }

    /**
     * Get system prompt for the chatbot
     * @returns {string} System prompt text
     */
    getSystemPrompt() {
        return getSystemPrompt();
    }

    /**
     * Get game state context for the chatbot
     * @returns {Object|null} Game state summary
     */
    getGameStateContext() {
        if (window.GameStateSerializer) {
            return window.GameStateSerializer.getInitialGameStateSummary();
        }
        return null;
    }

    /**
     * Get response from backend API.
     *
     * Live testing showed the model dropping required structure (e.g. a
     * While loop with no condition input) or ignoring obstacles under the
     * combined weight of this task's constraints, even when the prompt says
     * not to - prose alone wasn't reliably catching it. Rather than trust
     * the model's self-reported chain-of-thought, any generated blocks are
     * run through validateBlocks() (structural + collision checks against
     * the same map data the model was given) before being accepted; on
     * failure, the SPECIFIC problems found are fed back to the model for a
     * corrected retry (up to MAX_CODE_GEN_ATTEMPTS total attempts) rather
     * than silently accepting broken code or giving up after one try.
     *
     * Separately: a plain "just add this to my code" request used to lose
     * the student's existing program, because the model was asked to
     * reconstruct the ENTIRE program from memory (including code it may
     * never echo back faithfully) and handleCodeGeneration() unconditionally
     * clears the workspace before applying whatever came back. When additive
     * intent is detected, this now tells the model to send ONLY the new
     * block(s), strips any old code it replays anyway despite that (a model
     * habit, not something to rely on it *not* doing), and returns
     * `appendMode: true` so the caller appends instead of replacing - the
     * student's prior code is preserved mechanically, not by hoping the
     * model remembered it correctly.
     * @param {string} userText - User message
     * @returns {Promise<Object>} Response object with message, optional blocks, and appendMode
     */
    async getAIResponse(userText) {
        const systemPrompt = this.getSystemPrompt();
        const levelContext = this.getLevelContext();
        const rawLevelConfig = window.LevelManager?.levels?.[window.LevelManager.currentLevelId];

        const previousBlocks = Array.isArray(levelContext?.currentWorkspace) ? levelContext.currentWorkspace : [];
        const appendMode = previousBlocks.length > 0
            && ADDITIVE_INTENT_PATTERN.test(userText)
            && !REPLACEMENT_INTENT_PATTERN.test(userText);

        // Only the OUTGOING network payload carries this extra instruction -
        // this.chatHistory (and what's displayed) keeps the student's exact
        // original wording.
        const initialContent = appendMode
            ? `${userText}\n\n[System note: the student wants to ADD to their existing code (see levelContext.currentWorkspace). Respond with ONLY the new block(s) to append after it - do NOT repeat their existing blocks in "blocks", those are kept automatically.]`
            : userText;

        // Working copy of the conversation for this request only - retry
        // "please fix this" turns are never written into this.chatHistory,
        // so the visible conversation just shows the final result.
        const recentHistory = this.chatHistory.slice(-10);
        const workingMessages = [
            ...recentHistory,
            { role: 'user', content: initialContent }
        ];

        // For append mode, collisions must be checked from wherever the
        // EXISTING code leaves the robot, not from the level's start -
        // estimateEndState() returns null/indeterminate for anything past a
        // branch/loop it can't resolve statically, in which case collision
        // checking is skipped for the new snippet (structural checks still apply).
        const appendStart = appendMode ? estimateEndState(previousBlocks, rawLevelConfig) : null;
        const startOverride = appendStart && !appendStart.indeterminate ? appendStart : null;

        let parsed = null;
        for (let attempt = 1; attempt <= MAX_CODE_GEN_ATTEMPTS; attempt++) {
            let data;
            try {
                const response = await fetch(CHAT_FUNCTION_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: workingMessages, systemPrompt, levelContext })
                });
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                data = await response.json();
            } catch (error) {
                console.error(`ChatbotManager: Request failed on attempt ${attempt}/${MAX_CODE_GEN_ATTEMPTS}:`, error);
                // A retry call failing (e.g. a slow-running correction attempt
                // timing out) shouldn't throw away a response we already have
                // - fall back to the last result rather than losing it.
                if (parsed) {
                    parsed.message = `${parsed.message}\n\n⚠️ Couldn't get a verified/corrected version (connection issue) - this may still have an issue, please double-check before relying on it.`;
                    return parsed;
                }
                return { message: "Sorry, I'm having trouble connecting to the brain right now." };
            }

            parsed = this.parseAIResponse(data.response, null);
            parsed.appendMode = appendMode;

            if (appendMode && Array.isArray(parsed.blocks)) {
                parsed.blocks = stripReplayedPrefix(parsed.blocks, previousBlocks);
            }

            // Nothing to validate for a plain hint (no blocks) - accept as-is.
            if (!parsed.blocks || parsed.blocks.length === 0 || !rawLevelConfig) {
                return parsed;
            }

            const { valid, issues } = validateBlocks(parsed.blocks, rawLevelConfig, { startOverride });
            if (valid) {
                return parsed;
            }

            console.warn(`ChatbotManager: Generated code failed validation (attempt ${attempt}/${MAX_CODE_GEN_ATTEMPTS}):`, issues);

            if (attempt === MAX_CODE_GEN_ATTEMPTS) {
                // Retries exhausted - surface the best-effort result, but
                // flag it rather than let the student trust broken code.
                parsed.message = `${parsed.message}\n\n⚠️ I couldn't fully verify this code - possible issue: ${issues[0]}${issues.length > 1 ? ` (+${issues.length - 1} more)` : ''}. Double-check it before relying on it.`;
                return parsed;
            }

            workingMessages.push({ role: 'assistant', content: data.response });
            workingMessages.push({
                role: 'user',
                content: appendMode
                    ? `That addition has problems - fix them and resend ONLY the corrected new block(s) to append (not the student's existing code):\n${issues.map(i => `- ${i}`).join('\n')}`
                    : `That code has problems - fix them and resend the COMPLETE corrected program as JSON:\n${issues.map(i => `- ${i}`).join('\n')}`
            });
        }

        return parsed;
    }

    /**
     * Parse AI response for JSON code blocks
     * @param {string} response - Raw response from AI
     * @param {string|null} aiRole - Current AI role (for permission filtering)
     * @returns {Object} Parsed response with message and optional blocks
     */
    parseAIResponse(response, aiRole = null) {
        // Check if response contains a JSON code block
        const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
        
        if (jsonMatch) {
            try {
                // Remove comments from JSON (AI sometimes adds them despite instructions)
                let jsonString = jsonMatch[1];
                
                // Remove single-line comments (// ...)
                jsonString = jsonString.replace(/\/\/.*$/gm, '');
                
                // Remove multi-line comments (/* ... */)
                jsonString = jsonString.replace(/\/\*[\s\S]*?\*\//g, '');
                
                // Parse the cleaned JSON
                const parsed = JSON.parse(jsonString);

                // The model occasionally sends a bare block array instead of
                // the documented {message, blocks} object (seen in practice
                // when asked to send "only the new blocks" for append mode) -
                // without this, parsed.message/.blocks are both undefined on
                // an array, so the response silently falls back to showing
                // raw JSON as the message and applying NO blocks at all.
                const blocks = Array.isArray(parsed) ? parsed : parsed.blocks;
                let message = Array.isArray(parsed) ? null : parsed.message;
                if (!message) {
                    const prose = response.replace(jsonMatch[0], '').trim();
                    message = prose || "Here's the code:";
                }

                // HARD AFFORDANCE RESTRICTION: Strip blocks if AI is navigator
                if (aiRole === 'navigator' && blocks) {
                    console.warn('ChatbotManager: AI Navigator attempted to send blocks - BLOCKED at parse level');
                    return { message, blocks: null };
                }

                return {
                    message,
                    blocks: blocks || null
                };
            } catch (error) {
                console.error('ChatbotManager: Failed to parse JSON code block:', error);
                console.error('Raw JSON:', jsonMatch[1]);
                return { message: response };
            }
        }
        
        return { message: response };
    }

    /**
     * Get level context for AI
     * @returns {Object|null} Level configuration and state
     */
    getLevelContext() {
        if (!window.LevelManager) return null;
        
        try {
            const currentLevel = window.LevelManager.levels[window.LevelManager.currentLevelId];
            if (!currentLevel) return null;
            
            // Get current workspace state (what blocks are already placed)
            const currentWorkspace = BlocklyActions.getWorkspaceState();
            
            // Get player start info and convert direction to string
            const playerStart = currentLevel.player ? { ...currentLevel.player } : null;
            if (playerStart && playerStart.startDir !== undefined) {
                // Convert direction to string for chatbot
                playerStart.startDirection = directionToString(playerStart.startDir);
                // Keep numeric startDir for backward compatibility if needed
            }
            
            // Strip anything that would hand the AI the answer to a
            // sense-before-you-act puzzle (e.g. which box is defective) -
            // see redactSecrets() for exactly what's removed and why.
            const { objects, winConditions } = redactSecrets(currentLevel);

            // Return ONLY initial level configuration (not dynamic game state)
            // This ensures the chatbot works from the starting conditions only
            return {
                id: currentLevel.id,
                title: currentLevel.title,
                description: currentLevel.description,
                instructions: currentLevel.instructions,
                allowedBlocks: currentLevel.allowedBlocks,
                winConditions: winConditions,
                mapSize: currentLevel.map ? { width: currentLevel.map.width, height: currentLevel.map.height } : null,
                objects: objects,
                playerStart: playerStart,
                // ASCII rendering of which tiles are actually walkable - the
                // raw `objects` list alone doesn't tell the model that e.g. a
                // pillar/shelf/oil-drum/conveyor tile is impassable while a
                // pickup/dropoff zone isn't (that's computed later from
                // `type` by LevelBuilder, not stored in the config), which
                // was causing generated routes to ignore obstacles entirely.
                mapGrid: buildAsciiMap(currentLevel),
                currentWorkspace: currentWorkspace
            };
        } catch (error) {
            console.error('ChatbotManager: Error getting level context:', error);
            return null;
        }
    }

    /**
     * Handle code generation from AI
     * @param {Array<Object>} blocks - Block specifications from AI
     * @param {boolean} [appendMode] - When true (additive request detected in
     *   getAIResponse), append after the student's existing code instead of
     *   replacing it - see getAIResponse()'s docstring for why this exists.
     */
    handleCodeGeneration(blocks, appendMode = false) {
        try {
            // Check if AI wants to clear workspace only (look for special 'clear' command)
            const shouldClear = blocks.some(b => b.type === 'clear_workspace');
            if (shouldClear) {
                BlocklyActions.clearWorkspace();
                // Filter out the clear command
                blocks = blocks.filter(b => b.type !== 'clear_workspace');

                // If only clearing (no blocks to add after), we're done
                if (blocks.length === 0) {
                    console.log('ChatbotManager: Workspace cleared successfully');
                    return;
                }
            } else if (blocks.length > 0 && !appendMode) {
                // Clear workspace before adding blocks to REPLACE code - the
                // default for a full/complete solution. Skipped in appendMode,
                // where these blocks are meant to go after the existing program.
                console.log('ChatbotManager: Clearing workspace before adding complete solution');
                BlocklyActions.clearWorkspace();
            } else if (appendMode) {
                console.log('ChatbotManager: Appending new blocks to existing program (append mode)');
            }

            // Add blocks from AI
            const count = BlocklyActions.addBlocks(blocks, false);
            if (count === 0 && blocks.length > 0) {
                this.ui.addBotMessage('⚠️ I tried to add blocks but encountered errors. Please check the console.');
            }
            console.log(`ChatbotManager: Added ${count} blocks from AI`);
        } catch (error) {
            console.error('ChatbotManager: Error handling code generation:', error);
            this.ui.addBotMessage('❌ Sorry, I encountered an error while adding blocks.');
        }
    }

    /**
     * Show the chatbot
     */
    show() {
        if (this.ui) {
            this.ui.show();
        }
    }

    /**
     * Hide the chatbot
     */
    hide() {
        if (this.ui) {
            this.ui.hide();
        } else {
            // Hide directly via DOM if UI not initialized
            const chatbotElement = document.getElementById('chatbot');
            if (chatbotElement) {
                chatbotElement.style.display = 'none';
            }
        }
    }

    /**
     * Clear chat history
     */
    clearHistory() {
        this.chatHistory = [];
        
        // Clear from localStorage
        try {
            const key = this.getStorageKey();
            localStorage.removeItem(key);
        } catch (error) {
            console.error('ChatbotManager: Error clearing history from storage', error);
        }
        
        if (this.ui) {
            this.ui.clearMessages();
            this.sendInitialGreeting();
        }
    }

    /**
     * Switch to a new level (reload history for that level)
     * @param {string} levelId - New level ID
     * @param {Object} levelConfig - Level configuration object
     */
    switchLevel(levelId, levelConfig = null) {
        console.log(`ChatbotManager: Switching to level ${levelId}`);
        
        // Check if chatbot should be disabled for this level
        if (levelConfig && levelConfig.chatbotEnabled === false) {
            console.log(`ChatbotManager: Chatbot disabled for level ${levelId}`);
            // Ensure Blockly toolbox/workspace is enabled in tutorials/baseline
            BlocklyActions.enableWorkspace();
            this.hide();
            return;
        }
        
        // Check if chatbot is enabled for user's experimental group
        const hasChatbot = this.experimentManager.hasFeature('chatbot');
        if (!hasChatbot) {
            this.hide();
            return;
        }
        
        // Show chatbot if it was hidden
        this.show();

        // Standard mode - workspace always enabled
        BlocklyActions.enableWorkspace();
        
        // Clear UI
        if (this.ui) {
            this.ui.clearMessages();
        }
        
        // Load history for new level
        this.loadHistory();
        
        // Send greeting if no history exists
        if (this.chatHistory.length === 0) {
            this.sendInitialGreeting();
        }
    }

    /**
     * Update chatbot when role changes (deprecated - kept for backwards compatibility)
     * @param {string} newRole - New role (deprecated)
     */
    onRoleChange(newRole) {
        // Pair programming has been removed - this method is a no-op
        console.log('ChatbotManager: onRoleChange called but pair programming is deprecated');
    }

    /**
     * Get conversation history
     * @returns {Array} Chat history
     */
    getHistory() {
        return this.chatHistory;
    }
}

// Create singleton instance
const chatbotManager = new ChatbotManager();

// Export singleton
export default chatbotManager;
export { chatbotManager };
