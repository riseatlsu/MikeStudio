/**
 * @fileoverview BlockSpecBuilder - Shared builder for constructing Blockly
 * blocks (and arbitrarily nested inputs) from a plain-JSON block-spec tree.
 *
 * Used by BOTH level-authored starterBlocks (BlocklyManager) and
 * AI-generated code (BlocklyActions) so both paths support the exact same
 * spec format instead of two independently-maintained implementations that
 * can drift apart - which is what previously caused AI-generated `If/Else`
 * and `While` blocks to fail to connect (BlocklyActions had its own, much
 * more limited builder that only understood a single hardcoded `DO`
 * statement input and plain field values, with no support for `extraState`
 * or named/value inputs at all).
 *
 * Spec format: { type, fields?, extraState?, inputs? }
 *   fields     - { FIELD_NAME: value }   inline field values
 *   extraState - { ... }                 Blockly extra state
 *                                        (e.g. { hasElse: true } for controls_if)
 *   inputs     - keyed by input name:
 *                  array  -> statement input (sequence of block descriptors)
 *                  object -> value input     (single block descriptor)
 * @module game/blockly/BlockSpecBuilder
 */

/**
 * Build a linear chain of statement blocks.
 * @param {Blockly.Workspace} workspace
 * @param {Array<Object>} specs
 * @returns {Blockly.Block|null} The first block in the chain, or null.
 */
export function buildBlockChain(workspace, specs) {
    if (!Array.isArray(specs) || specs.length === 0) return null;
    let first = null;
    let prev = null;
    for (const spec of specs) {
        const block = buildBlockFromSpec(workspace, spec);
        if (!block) continue;
        if (!first) first = block;
        if (prev?.nextConnection && block.previousConnection) {
            prev.nextConnection.connect(block.previousConnection);
        }
        prev = block;
    }
    return first;
}

/**
 * Recursively build a single block and wire its fields/inputs.
 * @param {Blockly.Workspace} workspace
 * @param {Object} spec
 * @returns {Blockly.Block|null}
 */
export function buildBlockFromSpec(workspace, spec) {
    if (!spec?.type) return null;

    let block;
    try {
        block = workspace.newBlock(spec.type);
    } catch (error) {
        console.error(`BlockSpecBuilder: Unknown block type '${spec.type}':`, error);
        return null;
    }

    // Apply extra state before initSvg so dynamic inputs (e.g. controls_if's
    // ELSE slot) are created in time to be connected into below.
    if (spec.extraState && typeof block.loadExtraState === 'function') {
        block.loadExtraState(spec.extraState);
    }

    block.initSvg();
    block.render();

    if (spec.fields) {
        for (const [name, value] of Object.entries(spec.fields)) {
            try { block.setFieldValue(String(value), name); } catch (_) {}
        }
    }

    if (spec.inputs) {
        for (const [inputName, inputValue] of Object.entries(spec.inputs)) {
            const input = block.getInput(inputName);
            if (!input?.connection) continue;

            if (Array.isArray(inputValue)) {
                const firstInChain = buildBlockChain(workspace, inputValue);
                if (firstInChain?.previousConnection) {
                    input.connection.connect(firstInChain.previousConnection);
                }
            } else if (inputValue && typeof inputValue === 'object') {
                const valueBlock = buildBlockFromSpec(workspace, inputValue);
                if (valueBlock?.outputConnection) {
                    input.connection.connect(valueBlock.outputConnection);
                }
            }
        }
    }

    return block;
}
