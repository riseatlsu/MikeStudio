/* Blockly Setup Integrado com GameAPI */

// --- Dropdown extension (manter) ---
Blockly.Extensions.register('move_block_created', function() {
    this.getInput('POSITION').appendField(
      new Blockly.FieldDropdown(function() {
        var options = [];
        for (let [name, key] of savedVariables) {
          options.push([name, key]);
        }
        return options;
      }), 'DROPDOWN_OPTIONS'
    );
  });
  
  function updateDropdownOptions(dropdownField) {
    var dropdownOptions = dropdownField.getOptions(false);
    for (let [name, key] of savedVariables) {
      let exists = dropdownOptions.some(([optName, optKey]) => optKey === key);
      if (!exists) dropdownOptions.push([name, key]);
    }
    dropdownField.menuGenerator_ = dropdownOptions;
  }
  
  function updateBlocklyBlocks() {
    Blockly.getMainWorkspace().getBlocksByType("move_to_position").forEach(function(block) {
      var dropdownField = block.getField('DROPDOWN_OPTIONS');
      updateDropdownOptions(dropdownField);
    });
  }
  
  // --- Definição de blocos ---
  Blockly.defineBlocksWithJsonArray([
    {
      "type": "custom_start",
      "message0": "When program starts:",
      "nextStatement": null,
      "colour": 210
    },
    {
      "type": "move_to_position",
      "message0": "%2 Move robot to %1",
      "args0": [
        { "type": "input_dummy", "name": "POSITION" },
        { "type": "field_checkbox", "name": "Breakpoint", "checked": false }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 0,
      "extensions": ["move_block_created"]
    },
    {
      "type": "pick_object",
      "message0": "Pick up object",
      "args0": [],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 42
    },
    {
      "type": "release_object",
      "message0": "Release object",
      "args0": [],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 120
    },
    {
      "type": "move_forward",
      "message0": "Move forward %1 steps",
      "args0": [{ "type": "field_number", "name": "STEPS", "value": 1, "min": 1 }],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 160
    },
    {
      "type": "rotate_left",
      "message0": "Turn counter-clockwise",
      "previousStatement": null,
      "nextStatement": null,
      "colour": 210
    },
    {
      "type": "rotate_right",
      "message0": "Turn clockwise",
      "previousStatement": null,
      "nextStatement": null,
      "colour": 210
    },
    {
      "type": "controls_repeat",
      "message0": "Repeat %1 times",
      "args0": [
        { "type": "field_number", "name": "TIMES", "value": 2, "min": 1, "max": 100 }
      ],
      "message1": "do %1",
      "args1": [
        { "type": "input_statement", "name": "DO" }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 120
    }
  ]);
  
  // --- Geradores JS (integração com GameAPI) ---
  Blockly.JavaScript['move_to_position'] = function(block) {
    var posName = block.getFieldValue('DROPDOWN_OPTIONS');
    var coords = savedCoordinates.get(posName);
    if (!coords) return '';
    return `await GameAPI.setPosition(${coords[0]}, ${coords[1]});\n`;
  };
  
  Blockly.JavaScript['pick_object'] = function() {
    return `await GameAPI.pickupItem();\n`;
  };
  
  Blockly.JavaScript['release_object'] = function() {
    return `await GameAPI.dropItem();\n`;
  };
  
  Blockly.JavaScript['move_forward'] = function(block) {
    const steps = block.getFieldValue('STEPS');
    return `await GameAPI.moveForward(${steps});\n`;
  };
  
  Blockly.JavaScript['rotate_left'] = function() {
    return `await GameAPI.rotateLeft();\n`;
  };
  
  Blockly.JavaScript['rotate_right'] = function() {
    return `await GameAPI.rotateRight();\n`;
  };

  Blockly.JavaScript['controls_repeat'] = function(block) {
    const times = block.getFieldValue('TIMES');
    const branch = Blockly.JavaScript.statementToCode(block, 'DO');
    return `for (let i = 0; i < ${times}; i++) {\n${branch}}\n`;
  };

  // Code generator for the starting block (generates no code, just serves as entry point)
  Blockly.JavaScript['custom_start'] = function(block) {
    // For hat blocks (starting blocks), we typically just return empty string
    // The workspace.getTopBlocks() or block traversal handles the execution
    return '';
  };
  
  // --- Toolbox ---
  const toolbox = {
    "kind": "flyoutToolbox",
    "contents": [
      { "kind": "label", "text": "Blocks" },
      { "kind": "block", "type": "move_forward" },
      { "kind": "block", "type": "rotate_left" },
      { "kind": "block", "type": "rotate_right" },
      { "kind": "block", "type": "pick_object" },
      { "kind": "block", "type": "release_object" },
      { "kind": "block", "type": "controls_repeat" }
    ]
  };
  
  const blocklyDiv = document.getElementById('blockly-workspace');
  const blocklyWorkspace = Blockly.inject(blocklyDiv, {
    toolbox: toolbox,
    zoom: {
      controls: true,
      startScale: 1.25,
      maxScale: 3,
      minScale: 0.3,
      scaleSpeed: 1.2,
      pinch: true
    },
    move: {
      scrollbars: { horizontal: true, vertical: true },
      drag: true,
      wheel: false
    },
    trashcan: true
  });
  
  // --- Workspace init ---
  var startingBlocks = document.getElementById("blocks");
  if (startingBlocks) {
    Blockly.Xml.domToWorkspace(startingBlocks, blocklyWorkspace);
    var startingBlock = Blockly.getMainWorkspace().getBlocksByType("custom_start")[0];
    if (startingBlock) {
      blocklyWorkspace.centerOnBlock(startingBlock.id);
      startingBlock.setDeletable(false);
    }
  }
  
  // --- Botões ---
  blocklyWorkspace.registerButtonCallback("create-position", loadCreatePositionModal);
  blocklyWorkspace.registerButtonCallback("delete-positions", loadPositionsForRemoval);
  
  // --- Execução do programa ---
  window.executeBlocklyCode = async function executeBlocklyCode() {
    const code = Blockly.JavaScript.workspaceToCode(blocklyWorkspace);
    console.log("Generated code:\n", code);
  
    try {
      await GameAPI.ready();
      
      // Reset level to starting position before running program
      GameAPI.resetLevel();
      
      // Wait a moment for reset to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await eval(`(async () => { ${code} })()`);
    } catch (e) {
      console.error("Blockly execution failed", e);
    }
  }

// Função que chama o backend
async function sendPromptToChatGPT(prompt) {
    const response = await fetch("http://localhost:3000/chatgpt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });
  
    return await response.json(); 
  }
  
  
  document.getElementById("ai-generate-btn").addEventListener("click", async () => {
    const prompt = document.getElementById("ai-prompt-input").value;
    if (!prompt) return alert("Type a command!");
  
    // Add loading state
    const generateBtn = document.getElementById("ai-generate-btn");
    const originalHTML = generateBtn.innerHTML;
    generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Generating...';
    generateBtn.disabled = true;
  
    console.log("➡️ Sending prompt:", prompt);
    
    try {
      const response = await sendPromptToChatGPT(prompt);
      console.log("⬅️ Response received:", response);
  
      const commands = response.commands || [];
      
      // Find the custom_start block
      const startBlock = blocklyWorkspace.getBlocksByType("custom_start")[0];
      if (!startBlock) {
        console.error("Start block not found!");
        alert("Error: Start block not found in workspace.");
        return;
      }
  
      // Find the last block in the chain connected to start block
      let lastBlock = startBlock;
      while (lastBlock.nextConnection && lastBlock.nextConnection.targetBlock()) {
        lastBlock = lastBlock.nextConnection.targetBlock();
      }
  
      commands.forEach(cmd => {
        let block = null;
  
        if (cmd.action === "move") {
          block = blocklyWorkspace.newBlock("move_forward");
          block.setFieldValue(cmd.steps || 1, "STEPS");
        }
        else if (cmd.action === "rotate" && (cmd.direction === "counter-clockwise" || cmd.direction === "left")) {
          block = blocklyWorkspace.newBlock("rotate_left");
        }
        else if (cmd.action === "rotate" && (cmd.direction === "clockwise" || cmd.direction === "right")) {
          block = blocklyWorkspace.newBlock("rotate_right");
        }
        else if (cmd.action === "pick") {
          block = blocklyWorkspace.newBlock("pick_object");
        }
        else if (cmd.action === "release") {
          block = blocklyWorkspace.newBlock("release_object");
        }
        else if (cmd.action === "repeat") {
          block = blocklyWorkspace.newBlock("controls_repeat");
          block.setFieldValue(cmd.times || 2, "TIMES");
          // Note: Nested commands in repeat blocks would need recursive handling
        }
  
        if (block) {
          block.initSvg();
          block.render();
  
          // Connect to the last block in the chain
          if (lastBlock.nextConnection) {
            lastBlock.nextConnection.connect(block.previousConnection);
          }
  
          lastBlock = block;
        }
      });
  
      // Center on the start block to show all generated blocks
      blocklyWorkspace.centerOnBlock(startBlock.id);
      
      // Clear the input
      document.getElementById("ai-prompt-input").value = '';
      
      console.log(`✅ Generated ${commands.length} blocks successfully`);
      
    } catch (err) {
      console.error("❌ Error processing ChatGPT response:", err);
      alert("Error generating blocks. Check console for details.");
    } finally {
      // Restore button state
      generateBtn.innerHTML = originalHTML;
      generateBtn.disabled = false;
    }
  });
  