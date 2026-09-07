import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import './GameAPI'; // Ensure API is loaded
import { buildBlockChain } from './BlockSpecBuilder';

// Monkey-patch deprecated function to silence console warning in v11/v12
if (Blockly.Workspace.prototype.getAllVariables && !Blockly.Workspace.prototype.getAllVariables.patched) {
    const original = Blockly.Workspace.prototype.getAllVariables;
    Blockly.Workspace.prototype.getAllVariables = function() {
        if (this.getVariableMap) {
            return this.getVariableMap().getAllVariables();
        }
        return original.apply(this, arguments);
    };
    Blockly.Workspace.prototype.getAllVariables.patched = true;
}

// Fixed, known set of attributes level designers can tag objects/boxes with
// (see LEVEL_TYPES_GUIDE.md / level data files' `attributes` fields). Used by
// the "Object Ahead is ___" dropdown so students pick from real options
// instead of free-typing a value that may not exist on anything.
const ATTRIBUTE_OPTIONS = [
    ["broken", "broken"],
    ["fragile", "fragile"],
    ["priority", "priority"],
    ["hazard", "hazard"]
];

// The exact set of strings GameAPI.survey().type can return (see GameAPI.js
// and IsoBoard.addStationaryObject's objType assignment). Used by
// check_object_type's dropdown so students pick from real options instead
// of having to know/free-type the exact survey_front string to compare
// against with a separate logic_compare + text block. Static obstacles each
// report their own specific type (a pillar reports 'pillars', NOT 'wall' -
// 'wall' is reserved for an out-of-bounds/off-map tile with no object at
// all), so they're listed individually rather than lumped under "wall".
const OBJECT_TYPE_OPTIONS = [
    ["wall (out of bounds)", "wall"],
    ["box", "box"],
    ["conveyor", "conveyor"],
    ["pillar", "pillars"],
    ["shelf", "shelves"],
    ["oil drum", "oilDrums"],
    ["floor", "floor"],
    ["robot", "robot"]
];

export class BlocklyManager {
    constructor() {
        this.workspace = null;
        this.currentLevelId = null;
        this.currentLevelConfig = null;
        this.autoSaveEnabled = true;
        this.isRunning = false;
        this.pendingLevelConfig = null;
        this.sandboxMode = false;
    }

    setSandboxMode(enable = true) {
        this.sandboxMode = enable;
    }

    init(containerId) {
        this.defineBlocks();
        this.defineGenerators();

        const container = document.getElementById(containerId);
        if (!container) return;

        // Preserve the lock overlay before clearing (it needs to stay in the DOM)
        const lockOverlay = document.getElementById('blockly-lock-overlay');
        const lockOverlayParent = lockOverlay ? lockOverlay.parentElement : null;
        const lockOverlayHTML = lockOverlay ? lockOverlay.outerHTML : null;
        
        // Clear placeholder content to prevent layout issues
        container.innerHTML = '';
        
        // Restore the lock overlay after clearing
        if (lockOverlayHTML && lockOverlayParent === container) {
            container.insertAdjacentHTML('beforeend', lockOverlayHTML);
        }

        this.workspace = Blockly.inject(container, {
            toolbox: this.getToolbox(),
            zoom: {
                controls: true,
                wheel: true,
                startScale: 1.0,
                maxScale: 3,
                minScale: 0.3,
                scaleSpeed: 1.2
            },
            trashcan: true
        });

        // Add Start Block by default
        const startBlock = this.workspace.newBlock('custom_start');
        startBlock.initSvg();
        startBlock.render();
        startBlock.setDeletable(false);
        startBlock.moveBy(50, 50);

        // Set up auto-save on workspace changes
        this.workspace.addChangeListener(() => {
            if (this.autoSaveEnabled && this.currentLevelId) {
                this.saveWorkspaceState();
            }
        });

        window.blocklyWorkspace = this.workspace; // For debug/external access
        
        // Apply pending level config if any (fixes race condition on refresh)
        if (this.pendingLevelConfig) {
            console.log('BlocklyManager: Applying pending level config...');
            this.updateToolboxForLevel(this.pendingLevelConfig);
            this.pendingLevelConfig = null;
        }
    }

    /**
     * Update toolbox based on level configuration
     * @param {Object} levelConfig - The level configuration object
     */
    updateToolboxForLevel(levelConfig) {
        if (!this.workspace) {
            console.warn('BlocklyManager: Workspace not initialized yet, queueing toolbox update');
            this.pendingLevelConfig = levelConfig;
            return;
        }

        // Update current level ID and load saved state
        this.currentLevelId = levelConfig.id;
        this.currentLevelConfig = levelConfig;
        
        if (!levelConfig || !levelConfig.allowedBlocks) {
            // No restrictions - use default toolbox
            console.log('BlocklyManager: No block restrictions, using default toolbox');
            this.workspace.updateToolbox(this.getToolbox());
        } else {
            console.log('BlocklyManager: Updating toolbox with restrictions:', levelConfig.allowedBlocks);
            const toolbox = this.getToolbox(levelConfig.allowedBlocks);
            this.workspace.updateToolbox(toolbox);
            console.log('BlocklyManager: Toolbox updated successfully');
        }
        
        // Load saved workspace state for this level
        this.loadWorkspaceState();
    }

    /**
     * Get storage key for workspace state
     */
    getWorkspaceStorageKey() {
        const prefix = this.sandboxMode ? 'sandbox' : this.getParticipantId();
        return `blocklyWorkspace_${prefix}_${this.currentLevelId}`;
    }

    /**
     * Get participant ID from cookies
     */
    getParticipantId() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'pair_participant_id') {
                return value;
            }
        }
        return 'default';
    }

    /**
     * Save current workspace state to localStorage
     */
    saveWorkspaceState() {
        if (!this.workspace || !this.currentLevelId) return;

        try {
            const xml = Blockly.Xml.workspaceToDom(this.workspace);
            const xmlText = Blockly.Xml.domToText(xml);
            const key = this.getWorkspaceStorageKey();
            localStorage.setItem(key, xmlText);
            console.log(`BlocklyManager: Workspace saved for ${this.currentLevelId}`);
        } catch (e) {
            console.error('BlocklyManager: Failed to save workspace', e);
        }
    }

    /**
     * Load workspace state from localStorage
     */
    loadWorkspaceState() {
        if (!this.workspace || !this.currentLevelId) return;

        try {
            const key = this.getWorkspaceStorageKey();
            const xmlText = localStorage.getItem(key);
            
            // Temporarily disable auto-save to prevent saving during load
            this.autoSaveEnabled = false;
            
            // Always clear existing blocks first
            this.workspace.clear();
            
            if (xmlText) {
                // Load saved state
                const xml = Blockly.utils.xml.textToDom(xmlText);
                Blockly.Xml.domToWorkspace(xml, this.workspace);
                
                console.log(`BlocklyManager: Workspace loaded for ${this.currentLevelId}`);
            } else {
                this.createDefaultWorkspace();
                console.log(`BlocklyManager: No saved workspace for ${this.currentLevelId}, created default workspace`);
            }
            
            // Re-enable auto-save
            this.autoSaveEnabled = true;
        } catch (e) {
            console.error('BlocklyManager: Failed to load workspace', e);
            this.autoSaveEnabled = true;
        }
    }

    /**
     * Populate the workspace with the START block and any starter blocks
     * defined in the level config.
     *
     * starterBlocks supports arbitrary nesting — loops, conditionals, etc.
     * Each item in the array is a block descriptor:
     *
     *   { type, fields?, extraState?, inputs? }
     *
     *   fields     – { FIELD_NAME: value }   inline field values
     *   extraState – { ... }                 Blockly extra state
     *                                        (e.g. { hasElse: true } for controls_if)
     *   inputs     – keyed by input name:
     *                  array  → statement input (sequence of block descriptors)
     *                  object → value input     (single block descriptor)
     *
     * Block reference:
     *   Actions  move_forward · turn_clockwise · turn_counter_clockwise
     *            pick_object · drop_object
     *   Sensing  survey_front (value→String: 'wall'|'box'|'conveyor'|'pillars'|'shelves'|'oilDrums'|'floor'|'robot')
     *            check_attribute  fields:{ ATTR:'broken' }  (value→Boolean)
     *            check_object_type  fields:{ TYPE:'wall'|'box'|'conveyor'|'pillars'|'shelves'|'oilDrums'|'floor'|'robot' }  (value→Boolean)
     *   Loops    controls_repeat_ext  inputs:{ TIMES:{math_number}, DO:[...] }
     *            controls_whileUntil  fields:{ MODE:'WHILE'|'UNTIL' }
     *                                 inputs:{ BOOL:{...}, DO:[...] }
     *   Logic    controls_if  extraState:{ hasElse:true }
     *                         inputs:{ IF0:{...}, DO0:[...], ELSE:[...] }
     *            logic_compare    fields:{ OP:'EQ'|'NEQ'|'LT'|'LTE'|'GT'|'GTE' }
     *                             inputs:{ A:{...}, B:{...} }
     *            logic_operation  fields:{ OP:'AND'|'OR' }  inputs:{ A:{...}, B:{...} }
     *            logic_boolean    fields:{ BOOL:'TRUE'|'FALSE' }
     *            logic_negate     inputs:{ BOOL:{...} }
     *   Math     math_number      fields:{ NUM: 5 }
     *            math_arithmetic  fields:{ OP:'ADD'|'MINUS'|'MULTIPLY'|'DIVIDE'|'POWER' }
     *                             inputs:{ A:{...}, B:{...} }
     *   Text     text             fields:{ TEXT:'hello' }
     */
    createDefaultWorkspace() {
        const startBlock = this.workspace.newBlock('custom_start');
        startBlock.initSvg();
        startBlock.render();
        startBlock.setDeletable(false);
        startBlock.moveBy(20, 20);

        const starterBlocks = this.currentLevelConfig?.starterBlocks;
        if (!Array.isArray(starterBlocks) || starterBlocks.length === 0) return;

        const firstBlock = buildBlockChain(this.workspace, starterBlocks);
        if (firstBlock && startBlock.nextConnection && firstBlock.previousConnection) {
            startBlock.nextConnection.connect(firstBlock.previousConnection);
        }
    }

    /**
     * Clear workspace state for current level
     */
    clearWorkspaceState() {
        if (!this.currentLevelId) return;

        const key = this.getWorkspaceStorageKey();
        localStorage.removeItem(key);
        console.log(`BlocklyManager: Cleared workspace for ${this.currentLevelId}`);
    }

    /**
     * Reset workspace to the level's configured defaults (starterBlocks or blank).
     * Clears any saved state first so createDefaultWorkspace runs fresh.
     */
    resetWorkspaceToDefault() {
        this.clearWorkspaceState();
        this.autoSaveEnabled = false;
        this.workspace.clear();
        this.createDefaultWorkspace();
        this.autoSaveEnabled = true;
        console.log(`BlocklyManager: Workspace reset to defaults for ${this.currentLevelId}`);
    }

    getToolbox(allowedBlocks = null) {
        // Helper function to filter blocks in a category
        const filterBlocks = (blocks, allowedList) => {
            if (allowedList === true) return blocks; // All blocks allowed
            if (allowedList === false || !allowedList) return []; // No blocks allowed
            if (Array.isArray(allowedList)) {
                return blocks.filter(block => allowedList.includes(block.type));
            }
            return blocks;
        };

        // Define all available blocks by category
        const allBlocks = {
            actions: [
                { kind: "block", type: "move_forward" },
                { kind: "block", type: "turn_counter_clockwise" },
                { kind: "block", type: "turn_clockwise" },
                { kind: "block", type: "pick_object" },
                { kind: "block", type: "drop_object" },
                {
                    kind: "block",
                    type: "wait_loops",
                    inputs: {
                        LOOPS: {
                            shadow: {
                                type: "math_number",
                                fields: { NUM: 1 }
                            }
                        }
                    }
                }
            ],
            sensing: [
                { kind: "block", type: "survey_front" },
                { kind: "block", type: "check_attribute" },
                { kind: "block", type: "check_object_type" }
            ],
            logic: [
                { kind: "block", type: "controls_if" },
                {
                    kind: "block",
                    type: "controls_if",
                    extraState: { hasElse: true }
                },
                { kind: "block", type: "logic_compare" },
                { kind: "block", type: "logic_operation" },
                { kind: "block", type: "logic_boolean" },
                { kind: "block", type: "logic_negate" }
            ],
            math: [
                { kind: "block", type: "math_number" },
                { kind: "block", type: "math_arithmetic" }
            ],
            text: [
                { kind: "block", type: "text" },
                {
                    kind: "block",
                    type: "print_message",
                    inputs: {
                        MESSAGE: {
                            shadow: {
                                type: "text",
                                fields: { TEXT: "Hello!" }
                            }
                        }
                    }
                }
            ],
            loops: [
                {
                    kind: "block",
                    type: "controls_repeat_ext",
                    inputs: {
                        TIMES: {
                            shadow: {
                                type: "math_number",
                                fields: { NUM: 10 }
                            }
                        }
                    }
                },
                { kind: "block", type: "controls_whileUntil" }
            ]
        };

        // Variables is a dynamic category (Blockly generates "Create Variable"
        // + get/set blocks from whatever variables exist in the workspace), so
        // it has no static block list to filter - it's just shown or hidden.
        const variablesCategory = { kind: "category", name: "Variables", colour: 330, custom: "VARIABLE" };

        // If no restrictions, return all blocks
        if (!allowedBlocks) {
            return {
                kind: "categoryToolbox",
                contents: [
                    { kind: "category", name: "Movements", colour: 160, contents: allBlocks.actions },
                    { kind: "category", name: "Sensing", colour: 210, contents: allBlocks.sensing },
                    { kind: "category", name: "Conditionals", colour: 290, contents: allBlocks.logic },
                    { kind: "category", name: "Math", colour: 230, contents: allBlocks.math },
                    { kind: "category", name: "Text", colour: 160, contents: allBlocks.text },
                    { kind: "category", name: "Loops", colour: 120, contents: allBlocks.loops },
                    variablesCategory
                ]
            };
        }

        // Filter blocks based on level configuration
        const categories = [];

        if (allowedBlocks.actions !== false) {
            const actionBlocks = filterBlocks(allBlocks.actions, allowedBlocks.actions);
            if (actionBlocks.length > 0) {
                categories.push({ kind: "category", name: "Movements", colour: 160, contents: actionBlocks });
            }
        }

        if (allowedBlocks.sensing !== false) {
            const sensingBlocks = filterBlocks(allBlocks.sensing, allowedBlocks.sensing);
            if (sensingBlocks.length > 0) {
                categories.push({ kind: "category", name: "Sensing", colour: 210, contents: sensingBlocks });
            }
        }

        if (allowedBlocks.logic !== false) {
            const logicBlocks = filterBlocks(allBlocks.logic, allowedBlocks.logic);
            if (logicBlocks.length > 0) {
                categories.push({ kind: "category", name: "Conditionals", colour: 290, contents: logicBlocks });
            }
        }

        if (allowedBlocks.math !== false) {
            const mathBlocks = filterBlocks(allBlocks.math, allowedBlocks.math);
            if (mathBlocks.length > 0) {
                categories.push({ kind: "category", name: "Math", colour: 230, contents: mathBlocks });
            }
        }

        if (allowedBlocks.text !== false) {
            const textBlocks = filterBlocks(allBlocks.text, allowedBlocks.text);
            if (textBlocks.length > 0) {
                categories.push({ kind: "category", name: "Text", colour: 160, contents: textBlocks });
            }
        }

        if (allowedBlocks.loops !== false) {
            const loopBlocks = filterBlocks(allBlocks.loops, allowedBlocks.loops);
            if (loopBlocks.length > 0) {
                categories.push({ kind: "category", name: "Loops", colour: 120, contents: loopBlocks });
            }
        }

        if (allowedBlocks.variables === true) {
            categories.push(variablesCategory);
        }

        return {
            kind: "categoryToolbox",
            contents: categories
        };
    }

    defineBlocks() {
        // 1. Start Block - Hat style with distinctive color
        Blockly.Blocks['custom_start'] = {
            init: function () {
                this.appendDummyInput()
                    .appendField("▶ WHEN PROGRAM STARTS");
                this.setNextStatement(true, null);
                this.setColour("#4CAF50"); // Green to stand out
                this.setTooltip("The entry point of your robot program.");
                this.setHelpUrl("");
                this.setStyle('hat_blocks'); // Hat-style visual
            }
        };

        // 2. Move Forward
        Blockly.Blocks['move_forward'] = {
            init: function () {
                this.appendDummyInput().appendField("Move Forward");
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setColour(160);
                this.setTooltip("Moves the robot one tile forward.");
            }
        };

        // 3. Turn Counter Clockwise (Left)
        Blockly.Blocks['turn_counter_clockwise'] = {
            init: function () {
                this.appendDummyInput().appendField("Turn Counter Clockwise ↺");
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setColour(160);
            }
        };

        // 4. Turn Clockwise (Right)
        Blockly.Blocks['turn_clockwise'] = {
            init: function () {
                this.appendDummyInput().appendField("Turn Clockwise ↻");
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setColour(160);
            }
        };

        // 5. Pick Object
        Blockly.Blocks['pick_object'] = {
            init: function () {
                this.appendDummyInput().appendField("Pick Up Object");
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setColour(42); // Greenish
            }
        };

        // 6. Drop Object
        Blockly.Blocks['drop_object'] = {
            init: function () {
                this.appendDummyInput().appendField("Drop Object");
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setColour(42);
            }
        };

        // 7. Sensing: Survey Front
        // Returns the TYPE of the object in front as a String ('box', 'conveyor', 'wall', 'floor')
        Blockly.Blocks['survey_front'] = {
            init: function () {
                this.appendDummyInput().appendField("Sense Object Ahead");
                this.setOutput(true, "String");
                this.setColour(210);
                this.setTooltip("Returns the type of object in front: 'wall', 'box', 'conveyor', 'pillars', 'shelves', 'oilDrums', 'floor', or 'robot'.");
            }
        };

        // 8. Sensing: Check Attribute
        // Does the object in front have attribute X?
        // E.g. "Object Ahead has attribute 'broken'"
        // ATTR is a dropdown rather than free text since it's a fixed, known
        // set of attributes level designers actually use (see ATTRIBUTE_OPTIONS).
        Blockly.Blocks['check_attribute'] = {
            init: function () {
                this.appendDummyInput()
                    .appendField("Object Ahead is")
                    .appendField(new Blockly.FieldDropdown(ATTRIBUTE_OPTIONS), "ATTR");
                this.setOutput(true, "Boolean");
                this.setColour(210);
                this.setTooltip("Checks if the object in front has a specific tag/attribute.");
            }
        };

        // 8b. Sensing: Check Object Type
        // Does the object in front match a specific type? A dropdown-based
        // shortcut for the common "am I facing a wall/robot/etc." check, so
        // students pick a real option instead of needing to know the exact
        // string survey_front returns and wire up a separate logic_compare +
        // text block to compare against it.
        Blockly.Blocks['check_object_type'] = {
            init: function () {
                this.appendDummyInput()
                    .appendField("Object Ahead is a")
                    .appendField(new Blockly.FieldDropdown(OBJECT_TYPE_OPTIONS), "TYPE");
                this.setOutput(true, "Boolean");
                this.setColour(210);
                this.setTooltip("Checks if the object directly in front matches the selected type (wall, box, conveyor, floor, or robot).");
            }
        };

        // 9. Print Message - displays a message in the on-screen terminal
        Blockly.Blocks['print_message'] = {
            init: function () {
                this.appendValueInput("MESSAGE")
                    .setCheck(null)
                    .appendField("Print");
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setColour(160);
                this.setTooltip("Prints a message to the terminal on screen.");
            }
        };

        // 10. Wait - pauses the program for a number of game-loop ticks
        Blockly.Blocks['wait_loops'] = {
            init: function () {
                this.appendValueInput("LOOPS")
                    .setCheck("Number")
                    .appendField("Wait");
                this.appendDummyInput()
                    .appendField("loops");
                this.setInputsInline(true);
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setColour(160);
                this.setTooltip("Pauses the robot's program for the given number of game loops, so it stays in sync with everything else moving.");
            }
        };
    }

    defineGenerators() {
        // Use forBlock for newer Blockly versions
        javascriptGenerator.forBlock['custom_start'] = function (block) {
            return '// Program Start\n';
        };

        javascriptGenerator.forBlock['move_forward'] = function (block) {
            return `await GameAPI.moveForward(1);\n`;
        };

        javascriptGenerator.forBlock['turn_counter_clockwise'] = function (block) {
            return `await GameAPI.rotateCounterClockwise();\n`;
        };

        javascriptGenerator.forBlock['turn_clockwise'] = function (block) {
            return `await GameAPI.rotateClockwise();\n`;
        };

        javascriptGenerator.forBlock['pick_object'] = function (block) {
            return `await GameAPI.pickupItem();\n`;
        };

        javascriptGenerator.forBlock['drop_object'] = function (block) {
            return `await GameAPI.dropItem();\n`;
        };

        javascriptGenerator.forBlock['survey_front'] = function (block) {
            return [`(await GameAPI.survey()).type`, javascriptGenerator.ORDER_ATOMIC];
        };

        javascriptGenerator.forBlock['check_attribute'] = function (block) {
            const attr = block.getFieldValue('ATTR');
            return [`((await GameAPI.survey()).attributes['${attr}'] === true)`, javascriptGenerator.ORDER_ATOMIC];
        };

        javascriptGenerator.forBlock['check_object_type'] = function (block) {
            const type = block.getFieldValue('TYPE');
            return [`((await GameAPI.survey()).type === '${type}')`, javascriptGenerator.ORDER_ATOMIC];
        };

        javascriptGenerator.forBlock['print_message'] = function (block) {
            const message = javascriptGenerator.valueToCode(block, 'MESSAGE', javascriptGenerator.ORDER_NONE) || "''";
            return `await GameAPI.printMessage(${message});\n`;
        };

        javascriptGenerator.forBlock['wait_loops'] = function (block) {
            const loops = javascriptGenerator.valueToCode(block, 'LOOPS', javascriptGenerator.ORDER_NONE) || '1';
            return `await GameAPI.waitLoops(${loops});\n`;
        };
    }

    async runCode() {
        // Prevent running if already executing
        if (this.isRunning) {
            console.warn("Code is already running!");
            return;
        }
        
        // Find the custom_start block
        const allBlocks = this.workspace.getAllBlocks(false);
        const startBlock = allBlocks.find(block => block.type === 'custom_start');
        
        if (!startBlock) {
            console.error("No start block found!");
            return;
        }

        // Set running state and update UI
        this.isRunning = true;
        this.updateRunButtonState(true);
        
        // Log run event with workspace state
        if (window.dataLogger && this.currentLevelId) {
            const workspaceState = this.getWorkspaceStateForLogging();
            window.dataLogger.logRun(this.currentLevelId, workspaceState);
        }

        try {
            // Initialize the code generator with the workspace
            javascriptGenerator.init(this.workspace);

            // Generate code only from blocks connected to the start block.
            // finish() prepends variable declarations (e.g. `let x;`) that
            // Blockly's variable blocks rely on - blockToCode() alone only
            // compiles the block chain and skips that step, since finish()
            // is normally only called by workspaceToCode().
            let code = javascriptGenerator.blockToCode(startBlock);
            code = javascriptGenerator.finish(code);
            console.log("Generated Code:\n", code);

            // Reset Level First
            await GameAPI.resetLevel();
            
            // Ensure Scene is Ready
            const ready = await GameAPI.ready();
            if (!ready) {
                console.error("Game not ready!");
                this.isRunning = false;
                this.updateRunButtonState(false);
                return;
            }

            // Wrap in Async IIFE
            const finalCode = `
                (async () => {
                    try {
                        ${code}
                        console.log("Program Completed");
                        if (window.terminalUI) window.terminalUI.runEnd(true);
                    } catch (e) {
                        if (e.message === 'Stopped by user') {
                            // User-initiated (Stop button), not a bug - don't
                            // log it as an error or show a scary message.
                            console.log('Program stopped by user');
                            if (window.terminalUI) window.terminalUI.runEnd(false, 'Stopped by user.');
                        } else {
                            console.error("Runtime Error:", e);
                            if (window.terminalUI) window.terminalUI.runEnd(false, e.message);
                        }
                    }
                })();
            `;

            if (window.terminalUI) {
                window.terminalUI.runStart(this.currentLevelId);
            }

            // Execute
            // Eval is used here as it's a simulation sandbox client-side.
            await eval(finalCode);
            
            // Small delay to ensure all animations complete
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
            console.error("Eval Error:", e);
        } finally {
            // Reset running state and update UI
            this.isRunning = false;
            this.updateRunButtonState(false);
        }
    }

    /**
     * Abort the currently running program (e.g. the user hit "Stop" on an
     * accidental infinite loop). Works by requesting a stop on the shared
     * GameClock, which every player action and the "Wait" block already
     * await - the next one to check in rejects, unwinding back up through
     * the running program's own try/catch inside runCode()'s eval'd IIFE.
     */
    stopExecution() {
        if (!this.isRunning) return;
        const scene = window.game?.scene?.getScene('MainScene');
        if (scene?.gameClock) {
            scene.gameClock.requestStop();
        }
    }

    /**
     * Update the run button state to show running/ready status
     * @param {boolean} isRunning - Whether code is currently executing
     */
    updateRunButtonState(isRunning) {
        const runBtn = document.getElementById('run-code-btn');
        const stopBtn = document.getElementById('stop-code-btn');

        if (stopBtn) stopBtn.disabled = !isRunning;

        if (!runBtn) return;

        if (isRunning) {
            runBtn.disabled = true;
            runBtn.classList.add('running');
            runBtn.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                Running...
            `;
        } else {
            runBtn.disabled = false;
            runBtn.classList.remove('running');
            runBtn.innerHTML = `
                <i class="fas fa-play"></i>
                Run Code
            `;
        }
    }
    
    /**
     * Get workspace state for logging as JSON string
     */
    getWorkspaceStateForLogging() {
        const blocks = this.workspace.getAllBlocks(false);
        const blockData = blocks.map(block => {
            const blockInfo = {
                type: block.type,
                id: block.id,
                disabled: block.disabled
            };
            
            // Only add fields if there are any
            const fields = {};
            block.inputList.forEach(input => {
                input.fieldRow.forEach(field => {
                    if (field.name && field.getValue() !== undefined) {
                        fields[field.name] = field.getValue();
                    }
                });
            });
            
            if (Object.keys(fields).length > 0) {
                blockInfo.fields = fields;
            }
            
            return blockInfo;
        });
        
        // Return as JSON string for clean storage
        return JSON.stringify(blockData, null, 2);
    }
}
