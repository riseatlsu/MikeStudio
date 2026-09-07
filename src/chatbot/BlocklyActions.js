/**
 * BlocklyActions.js
 * Utility module for manipulating Blockly workspace based on AI responses
 * Provides functions to add, delete, and manage code blocks programmatically
 */
import * as Blockly from 'blockly';
import { buildBlockChain } from '../game/blockly/BlockSpecBuilder';

/**
 * Get the Blockly workspace instance
 * @returns {Blockly.Workspace|null}
 */
function getWorkspace() {
    if (window.blocklyWorkspace) {
        return window.blocklyWorkspace;
    }
    if (window.Blockly && typeof window.Blockly.getMainWorkspace === 'function') {
        return window.Blockly.getMainWorkspace();
    }
    return null;
}

/**
 * Get the custom_start block (entry point for all programs)
 * @returns {Blockly.Block|null}
 */
function getStartBlock() {
    const workspace = getWorkspace();
    if (!workspace) return null;
    
    const startBlocks = workspace.getBlocksByType("custom_start");
    return startBlocks.length > 0 ? startBlocks[0] : null;
}

/**
 * Find the last block in the current program chain
 * @returns {Blockly.Block|null}
 */
function getLastBlock() {
    const startBlock = getStartBlock();
    if (!startBlock) return null;
    
    let lastBlock = startBlock;
    while (lastBlock.nextConnection && lastBlock.nextConnection.targetBlock()) {
        lastBlock = lastBlock.nextConnection.targetBlock();
    }
    
    return lastBlock;
}

/**
 * Clear all blocks except the start block
 */
export function clearWorkspace() {
    const workspace = getWorkspace();
    if (!workspace) {
        console.error('BlocklyActions: Workspace not found');
        return;
    }
    
    console.log('BlocklyActions: Starting workspace clear...');
    
    // CRITICAL: Disable ALL events FIRST before doing anything
    const Blockly = window.Blockly;
    let eventsWereEnabled = false;
    
    if (Blockly && Blockly.Events) {
        eventsWereEnabled = Blockly.Events.isEnabled ? Blockly.Events.isEnabled() : false;
        Blockly.Events.disable();
    }
    
    try {
        // Clear the entire workspace
        workspace.clear();
        
        // Re-create the start block
        const startBlock = workspace.newBlock('custom_start');
        startBlock.initSvg();
        startBlock.render();
        startBlock.setDeletable(false);
        startBlock.moveBy(20, 20);
        
        console.log('BlocklyActions: Workspace cleared and start block re-created');
    } catch (e) {
        console.error('BlocklyActions: Error clearing workspace:', e);
    } finally {
        // Re-enable events if they were enabled
        if (eventsWereEnabled && Blockly && Blockly.Events) {
            Blockly.Events.enable();
        }
    }
}

/**
 * Add blocks to the workspace based on AI response.
 *
 * Delegates the actual block/input construction to the shared
 * BlockSpecBuilder (see game/blockly/BlockSpecBuilder.js) so AI-generated
 * code supports the exact same spec format as level-authored starterBlocks
 * - including extraState (e.g. controls_if's hasElse) and named value/
 * statement inputs - rather than the old hardcoded-single-DO-input builder
 * that used to leave If/Else and sensing blocks disconnected.
 *
 * @param {Array<Object>} blockSpecs - Array of block specifications
 * @param {boolean} clearFirst - Whether to clear existing blocks first
 * @returns {number} Number of top-level blocks created
 */
export function addBlocks(blockSpecs, clearFirst = false) {
    if (!blockSpecs || blockSpecs.length === 0) {
        console.warn('BlocklyActions: No blocks to add');
        return 0;
    }

    const workspace = getWorkspace();
    if (!workspace) {
        console.error('BlocklyActions: Workspace not found');
        return 0;
    }

    // Clear workspace if requested
    if (clearFirst) {
        clearWorkspace();
    }

    // Get the last block in the current chain
    const lastBlock = getLastBlock();
    if (!lastBlock) {
        console.error('BlocklyActions: Start block not found');
        return 0;
    }

    // Skip any stray custom_start specs the AI might include - it's the
    // entry point block and already exists in the workspace.
    const specs = blockSpecs.filter(spec => spec.type !== 'custom_start');

    const firstBlock = buildBlockChain(workspace, specs);

    let created = 0;
    if (firstBlock) {
        if (lastBlock.nextConnection && firstBlock.previousConnection) {
            try {
                lastBlock.nextConnection.connect(firstBlock.previousConnection);
            } catch (connError) {
                console.error('BlocklyActions: Failed to connect AI-generated blocks to program:', connError);
            }
        } else {
            console.warn('BlocklyActions: Could not connect AI-generated blocks - missing connections');
        }

        // Count top-level blocks actually built (walking the chain, not
        // descending into nested if/loop bodies) for logging/UI feedback.
        let block = firstBlock;
        while (block) {
            created++;
            block = block.nextConnection?.targetBlock();
        }
    }

    // Center view on the start block
    const startBlock = getStartBlock();
    if (startBlock) {
        workspace.centerOnBlock(startBlock.id);
    }

    console.log(`BlocklyActions: Created ${created} block(s)`);
    return created;
}

/**
 * Get current workspace state as an array of block specifications, in the
 * SAME {type, fields, extraState?, inputs?} format the AI is asked to write
 * (see BlockSpecBuilder.js) - this is a full recursive serialization, not
 * just the top-level chain, so Otto can actually see what's inside an
 * existing If/Else branch or loop body rather than being told the student's
 * code is empty past the first level of nesting.
 * @returns {Array<Object>} Array of block specs
 */
export function getWorkspaceState() {
    const workspace = getWorkspace();
    if (!workspace) {
        console.error('BlocklyActions: Workspace not found');
        return [];
    }

    const startBlock = getStartBlock();
    if (!startBlock) return [];

    return serializeBlockChain(startBlock.nextConnection?.targetBlock());
}

/** Serialize a statement-block chain (following nextConnection) into specs. */
function serializeBlockChain(block) {
    const specs = [];
    let current = block;
    while (current) {
        specs.push(serializeBlock(current));
        current = current.nextConnection?.targetBlock();
    }
    return specs;
}

/** Serialize a single block, recursing into any connected statement/value inputs. */
function serializeBlock(block) {
    const spec = { type: block.type };

    const fields = {};
    block.inputList.forEach(input => {
        input.fieldRow.forEach(field => {
            if (field.name && field.getValue) {
                fields[field.name] = field.getValue();
            }
        });
    });
    if (Object.keys(fields).length > 0) {
        spec.fields = fields;
    }

    if (typeof block.saveExtraState === 'function') {
        try {
            const extraState = block.saveExtraState();
            if (extraState && Object.keys(extraState).length > 0) {
                spec.extraState = extraState;
            }
        } catch (_) { /* block has no meaningful extra state */ }
    }

    const inputs = {};
    block.inputList.forEach(input => {
        if (!input.connection) return;
        const target = input.connection.targetBlock();
        if (!target) return;

        if (Blockly && input.connection.type === Blockly.NEXT_STATEMENT) {
            inputs[input.name] = serializeBlockChain(target);
        } else if (Blockly && input.connection.type === Blockly.INPUT_VALUE) {
            inputs[input.name] = serializeBlock(target);
        }
    });
    if (Object.keys(inputs).length > 0) {
        spec.inputs = inputs;
    }

    return spec;
}

/**
 * Disable workspace interaction
 * (Deprecated - was used for Pair Programming Driver mode)
 */
export function disableWorkspace() {
    const workspace = getWorkspace();
    if (!workspace) {
        console.error('BlocklyActions: Workspace not found');
        return;
    }
    
    // Make all blocks non-editable and non-deletable
    workspace.getAllBlocks(false).forEach(block => {
        block.setEditable(false);
        block.setMovable(false);
        block.setDeletable(false);
    });
    
    // Keep toolbox visible but disable interactions
    const toolbox = workspace.getToolbox();
    if (toolbox) {
        toolbox.setVisible(true);
    }
    const container = document.getElementById('blockly-workspace');
    if (container) {
        container.classList.add('blockly-disabled');
    }
    
    console.log('BlocklyActions: Workspace interaction disabled');
}

/**
 * Enable workspace interaction (normal mode)
 */
export function enableWorkspace() {
    const workspace = getWorkspace();
    if (!workspace) {
        console.error('BlocklyActions: Workspace not found');
        return;
    }
    
    // Make blocks editable again (except start block)
    workspace.getAllBlocks(false).forEach(block => {
        block.setEditable(true);
        block.setMovable(true);
        block.setDeletable(block.type !== 'custom_start');
    });
    
    // Enable toolbox
    const toolbox = workspace.getToolbox();
    if (toolbox) {
        toolbox.setVisible(true);
    }
    const container = document.getElementById('blockly-workspace');
    if (container) {
        container.classList.remove('blockly-disabled');
    }
    
    console.log('BlocklyActions: Workspace interaction enabled');
}
