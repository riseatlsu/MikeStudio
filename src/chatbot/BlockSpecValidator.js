/**
 * @fileoverview BlockSpecValidator - Programmatically checks an AI-generated
 * block-spec tree BEFORE it's applied to the workspace, instead of trusting
 * the model's self-reported chain-of-thought.
 *
 * Live testing showed the model reliably ignoring "critical" prose rules
 * under load (dropping the required Execution Trace, omitting a While
 * loop's condition input entirely, skipping the box-check logic) - prompt
 * wording alone wasn't catching this. This module does two checks that are
 * deterministic and don't depend on the model "remembering" anything:
 *
 *   1. Structural validation - does every block have the inputs/fields its
 *      type actually requires (e.g. controls_whileUntil needs BOOL and DO;
 *      controls_if needs IF0/DO0, plus ELSE if extraState.hasElse is set)?
 *   2. Collision validation - walking the plan's deterministic moves against
 *      the same mapGrid given to the model, does any move_forward land on a
 *      blocked tile?
 *
 * Collision checking is necessarily best-effort past a branch/loop whose
 * outcome depends on a runtime sensor value (controls_if, controls_whileUntil,
 * a non-literal repeat count) - each branch/body is checked independently
 * for *its own* internal collisions, but position tracking can't continue
 * deterministically past it since we don't know which branch actually runs.
 * @module chatbot/BlockSpecValidator
 */

import { buildGrid, COLLIDABLE_STATIONARY_TYPES } from './LevelMapRenderer.js';

// Which input on each block type is a value (single block) vs a statement
// (array of blocks), and which are required vs conditionally required.
// Keep in sync with the "Available Block Types" vocabulary in PromptConfig.js.
const BLOCK_SCHEMA = {
    move_forward: {},
    turn_clockwise: {},
    turn_counter_clockwise: {},
    pick_object: {},
    drop_object: {},
    survey_front: {},
    check_attribute: { requiredFields: ['ATTR'] },
    check_object_type: { requiredFields: ['TYPE'] },
    logic_compare: { requiredFields: ['OP'], requiredInputs: { A: 'value', B: 'value' } },
    logic_operation: { requiredFields: ['OP'], requiredInputs: { A: 'value', B: 'value' } },
    logic_boolean: { requiredFields: ['BOOL'] },
    logic_negate: { requiredInputs: { BOOL: 'value' } },
    controls_if: { requiredInputs: { IF0: 'value', DO0: 'statement' } }, // ELSE checked separately (conditional on extraState.hasElse)
    controls_repeat_ext: { requiredInputs: { TIMES: 'value', DO: 'statement' } },
    controls_whileUntil: { requiredFields: ['MODE'], requiredInputs: { BOOL: 'value', DO: 'statement' } },
    wait_loops: { requiredInputs: { LOOPS: 'value' } },
    math_number: { requiredFields: ['NUM'] },
    text: { requiredFields: ['TEXT'] },
    print_message: { requiredInputs: { MESSAGE: 'value' } }
};

const TURN_CW = { NORTH: 'EAST', EAST: 'SOUTH', SOUTH: 'WEST', WEST: 'NORTH' };
const TURN_CCW = { NORTH: 'WEST', WEST: 'SOUTH', SOUTH: 'EAST', EAST: 'NORTH' };
const FORWARD_DELTA = {
    NORTH: { dRow: -1, dCol: 0 },
    SOUTH: { dRow: 1, dCol: 0 },
    EAST: { dRow: 0, dCol: 1 },
    WEST: { dRow: 0, dCol: -1 }
};

/**
 * Validate a block-spec tree structurally and (best-effort) for collisions.
 * @param {Array<Object>} blocks - Top-level block specs (as sent by the AI)
 * @param {Object} rawLevelConfig - The unredacted level config, used only to
 *   rebuild the same grid the AI was shown (no secrets needed for this)
 * @param {Object} [options]
 * @param {{row:number,col:number,dir:string}} [options.startOverride] - Start
 *   collision-checking from here instead of the level's player start - used
 *   in append mode, where `blocks` is only the NEW snippet and actually runs
 *   starting from wherever the student's EXISTING code leaves the robot, not
 *   from program start.
 * @returns {{valid: boolean, issues: string[]}}
 */
export function validateBlocks(blocks, rawLevelConfig, options = {}) {
    const issues = [];
    validateStructure(blocks, issues, []);

    const grid = buildGrid(rawLevelConfig);
    const player = rawLevelConfig?.player;
    const start = options.startOverride || (player && {
        row: player.startRow,
        col: player.startCol,
        dir: normalizeDirection(player.startDir)
    });
    if (grid && start) {
        walkForCollisions(blocks, start, grid, issues, [], rawLevelConfig);
    }

    return { valid: issues.length === 0, issues };
}

/**
 * Simulate a block-spec chain from a starting position and return where it
 * ends up (position tracking only - no issue collection). Used to estimate
 * the robot's real starting state for validating an appended snippet.
 * @returns {{row:number,col:number,dir:string,indeterminate?:boolean}|null}
 */
export function estimateEndState(blocks, rawLevelConfig) {
    const grid = buildGrid(rawLevelConfig);
    const player = rawLevelConfig?.player;
    if (!grid || !player) return null;
    const start = { row: player.startRow, col: player.startCol, dir: normalizeDirection(player.startDir) };
    return walkForCollisions(blocks, start, grid, [], [], rawLevelConfig);
}

function normalizeDirection(dir) {
    if (typeof dir === 'string' && FORWARD_DELTA[dir.toUpperCase()]) return dir.toUpperCase();
    // Numeric fallback matching DirectionConstants' DIRECTION_MAP (0=SOUTH,1=EAST,2=WEST,3=NORTH)
    const byNumber = { 0: 'SOUTH', 1: 'EAST', 2: 'WEST', 3: 'NORTH' };
    return byNumber[dir] || 'SOUTH';
}

function pathLabel(path) {
    return path.length ? ` (inside ${path.join(' > ')})` : '';
}

/** Recursively check every block against BLOCK_SCHEMA. */
function validateStructure(specs, issues, path) {
    if (!Array.isArray(specs)) return;
    specs.forEach((spec, i) => {
        if (!spec || typeof spec.type !== 'string') {
            issues.push(`Block at position ${i}${pathLabel(path)} is missing a "type".`);
            return;
        }

        const schema = BLOCK_SCHEMA[spec.type];
        if (!schema) {
            issues.push(`Unknown block type "${spec.type}"${pathLabel(path)} - not in the allowed vocabulary.`);
            return;
        }

        (schema.requiredFields || []).forEach(field => {
            if (!spec.fields || spec.fields[field] === undefined) {
                issues.push(`"${spec.type}"${pathLabel(path)} is missing required field "${field}".`);
            }
        });

        const requiredInputs = { ...(schema.requiredInputs || {}) };
        if (spec.type === 'controls_if' && spec.extraState?.hasElse) {
            requiredInputs.ELSE = 'statement';
        }

        Object.entries(requiredInputs).forEach(([name, kind]) => {
            const value = spec.inputs?.[name];
            if (value === undefined) {
                issues.push(`"${spec.type}"${pathLabel(path)} is missing required input "${name}" (a ${kind === 'value' ? 'value block' : 'list of statements'}).`);
                return;
            }
            if (kind === 'value' && Array.isArray(value)) {
                issues.push(`"${spec.type}"${pathLabel(path)} input "${name}" should be a single value block, not a statement list.`);
            }
            if (kind === 'statement' && !Array.isArray(value)) {
                issues.push(`"${spec.type}"${pathLabel(path)} input "${name}" should be a list of statements, not a single block.`);
            }
        });

        // Recurse into every nested input (statement arrays and value blocks alike)
        if (spec.inputs) {
            Object.entries(spec.inputs).forEach(([name, value]) => {
                if (Array.isArray(value)) {
                    validateStructure(value, issues, [...path, `${spec.type}.${name}`]);
                } else if (value && typeof value === 'object') {
                    validateStructure([value], issues, [...path, `${spec.type}.${name}`]);
                }
            });
        }
    });
}

function isBlocked(grid, row, col) {
    const cell = grid[row]?.[col];
    return cell === undefined || cell === '#';
}

/**
 * Give a specific, teachable description of what's blocking a tile instead
 * of a generic "obstacle" - in particular, conveyor tiles need calling out
 * explicitly, since live testing showed the model trying to move_forward
 * onto a conveyor to "reach" a box sitting on it, instead of using
 * pick_object/drop_object from the adjacent zone tile. A generic "route
 * around this obstacle" message doesn't correct that misconception; naming
 * the conveyor and restating the actual mechanic does.
 */
function describeBlockedTile(rawLevelConfig, row, col) {
    const stationary = (rawLevelConfig?.objects?.stationary || [])
        .find(obj => obj.row === row && obj.col === col && COLLIDABLE_STATIONARY_TYPES.has(obj.type));

    if (stationary?.type === 'conveyor') {
        return "that tile is the conveyor belt itself - you can NEVER move_forward onto it, whether or not a box is sitting there. pick_object/drop_object act on whatever's directly in front of you; stand on the adjacent zone tile and use those blocks instead of walking onto the conveyor.";
    }
    if (stationary) {
        const label = { pillars: 'a pillar', shelves: 'a shelf', OilDrums: 'an oil drum' }[stationary.type] || 'an obstacle';
        return `that tile has ${label} on it - route around it instead.`;
    }
    return 'route around this obstacle instead.';
}

/**
 * Walk a statement chain tracking position, flagging any move_forward that
 * would land on a blocked tile. Returns the ending {row, col, dir}, with
 * `indeterminate: true` set once execution passes through a branch/loop
 * whose taken path can't be known statically (further collision-checking
 * after that point is skipped, not asserted correct).
 */
function walkForCollisions(specs, pos, grid, issues, path, rawLevelConfig) {
    let { row, col, dir } = pos;
    if (!Array.isArray(specs)) return { row, col, dir };

    for (const spec of specs) {
        if (!spec?.type) continue;

        switch (spec.type) {
            case 'move_forward': {
                const { dRow, dCol } = FORWARD_DELTA[dir];
                const nextRow = row + dRow;
                const nextCol = col + dCol;
                if (isBlocked(grid, nextRow, nextCol)) {
                    issues.push(
                        `move_forward${pathLabel(path)} would move from (${row},${col}) facing ${dir} onto a BLOCKED tile at (${nextRow},${nextCol}) - ${describeBlockedTile(rawLevelConfig, nextRow, nextCol)}`
                    );
                }
                row = nextRow;
                col = nextCol;
                break;
            }
            case 'turn_clockwise':
                dir = TURN_CW[dir];
                break;
            case 'turn_counter_clockwise':
                dir = TURN_CCW[dir];
                break;
            case 'controls_repeat_ext': {
                const times = literalNumber(spec.inputs?.TIMES);
                const body = spec.inputs?.DO || [];
                if (times !== null) {
                    for (let i = 0; i < times; i++) {
                        ({ row, col, dir } = walkForCollisions(body, { row, col, dir }, grid, issues, [...path, `repeat x${times}`], rawLevelConfig));
                    }
                } else {
                    walkForCollisions(body, { row, col, dir }, grid, issues, [...path, 'repeat (non-literal count)'], rawLevelConfig);
                    return { row, col, dir, indeterminate: true };
                }
                break;
            }
            case 'controls_if': {
                walkForCollisions(spec.inputs?.DO0 || [], { row, col, dir }, grid, issues, [...path, 'if-branch'], rawLevelConfig);
                if (spec.inputs?.ELSE) {
                    walkForCollisions(spec.inputs.ELSE, { row, col, dir }, grid, issues, [...path, 'else-branch'], rawLevelConfig);
                }
                return { row, col, dir, indeterminate: true };
            }
            case 'controls_whileUntil': {
                walkForCollisions(spec.inputs?.DO || [], { row, col, dir }, grid, issues, [...path, 'while-body'], rawLevelConfig);
                return { row, col, dir, indeterminate: true };
            }
            default:
                break; // pick_object/drop_object/print_message/wait_loops/etc. don't move the robot
        }
    }

    return { row, col, dir };
}

function literalNumber(valueBlock) {
    if (!valueBlock || valueBlock.type !== 'math_number') return null;
    const n = Number(valueBlock.fields?.NUM);
    return Number.isFinite(n) ? n : null;
}
