/**
 * @fileoverview main.js - Application entry point for pAIrStudio.
 * Initializes Phaser game engine, Blockly workspace, and global managers.
 * @module main
 */

import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';
import { BlocklyManager } from './game/blockly/BlocklyManager';
import { experimentManager } from './experiment/ExperimentManager.js';
import { chatbotManager } from './chatbot/ChatbotManager.js';
import { quitManager } from './experiment/QuitManager.js';
import { timerManager } from './experiment/TimerManager.js';
import dataLogger from './utils/DataLogger.js';
import terminalUI from './game/terminal/TerminalUI.js';
import { dialogueUI } from './game/dialogue/DialogueUI.js';

const config = {
  type: Phaser.AUTO,
  width: '100%',
  height: '100%',
  parent: 'game-canvas',
  transparent: true,
  pixelArt: true, // Fixes blurry scaling
  scale: {
    mode: Phaser.Scale.RESIZE, // Fill the container
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [MainScene],
  physics: {
      default: 'arcade',
      arcade: {
          gravity: { y: 0 }
      }
  }
};

const game = new Phaser.Game(config);
window.game = game; // Expose for GameAPI

// Initialize Blockly
const blocklyManager = new BlocklyManager();

function initializeUI() {
    console.log('🚀 Initializing pAIrStudio...');
    
    // Expose DataLogger globally (but don't initialize until consent)
    window.dataLogger = dataLogger;

    // Note: DataLogger and Chatbot are initialized in index.html after consent
    // to ensure they initialize after group assignment and user has accepted terms

    // Init simulated terminal (prints from the "Print" block show up here)
    terminalUI.init('terminal-body');
    window.terminalUI = terminalUI;

    // Wire up the "Quit Study" button/confirmation flow
    quitManager.init();

    // Wire up the session timer / "time's up" modal, resuming an
    // already-running timer from localStorage if one exists
    timerManager.init();

    // Init the NPC dialogue box (shown before each level loads)
    dialogueUI.init();
    window.dialogueUI = dialogueUI;

    // Init Blockly Workspace
    blocklyManager.init('blockly-workspace');

    // Bind Buttons
    const runBtn = document.getElementById('run-code-btn');
    if (runBtn) {
        runBtn.addEventListener('click', () => {
            blocklyManager.runCode();
        });
    }

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
             // Reset Level via GameAPI helper or Scene logic
             import('./game/blockly/GameAPI').then(m => m.GameAPI.resetLevel());
        });
    }

    const stopBtn = document.getElementById('stop-code-btn');
    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            blocklyManager.stopExecution();
        });
    }

    console.log('✅ pAIrStudio initialization complete');
}

// Initialize immediately if DOM is ready, otherwise wait
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUI);
} else {
    // DOM already loaded (e.g., when dynamically imported in sandbox mode)
    initializeUI();
}

// Export managers for global access
window.ChatbotManager = chatbotManager;
window.ExperimentManager = experimentManager;
window.blocklyManager = blocklyManager;

// Also export lowercase for consistency
window.chatbotManager = chatbotManager;
window.experimentManager = experimentManager;
