/**
 * @fileoverview LevelMapRenderer - Renders a level's layout as an ASCII grid
 * for the AI assistant's context.
 *
 * The raw `objects.stationary` array sent to the chatbot has no notion of
 * which object types actually block movement - `collidable` is computed
 * later by LevelBuilder.js from each object's `type`, not stored in the
 * level config itself. Without this, the model has no reliable way to know
 * that a pillar/shelf/oil-drum/conveyor tile blocks the robot while a
 * pickup/dropoff zone doesn't, and (per report) was writing straight-line
 * paths that ignored obstacles entirely. A textual grid, rather than a flat
 * list of {row,col} objects the model has to mentally plot, is also just a
 * much easier representation for an LLM to path-plan against.
 * @module chatbot/LevelMapRenderer
 */

// Mirrors the `collidable` assignment in LevelBuilder.js's build() - keep in
// sync with that mapping if new stationary object types are added there.
// Exported so BlockSpecValidator.js can give type-aware collision messages
// (e.g. "that's the conveyor, not a wall") instead of a generic "obstacle".
export const COLLIDABLE_STATIONARY_TYPES = new Set(['conveyor', 'pillars', 'shelves', 'OilDrums']);

/**
 * Build the raw 2D character grid for a level (no formatting/legend) - the
 * single source of truth shared by buildAsciiMap() (for the AI's prompt
 * context) and BlockSpecValidator.js (for programmatically checking a
 * generated plan against the same obstacle data, rather than just trusting
 * the model's self-reported reasoning).
 * @param {Object} levelConfig - The level config (map, objects, player, npcRobots)
 * @returns {string[][]|null} 2D array of single-character cells, or null if map data is missing
 */
export function buildGrid(levelConfig) {
    const map = levelConfig?.map;
    if (!map || !map.width || !map.height) return null;

    const grid = Array.from({ length: map.height }, () => Array(map.width).fill('.'));

    const setCell = (row, col, symbol) => {
        if (grid[row] !== undefined && grid[row][col] !== undefined) {
            grid[row][col] = symbol;
        }
    };

    // Floor holes: map.data uses 1 = floor, anything else = no tile at all
    if (Array.isArray(map.data)) {
        map.data.forEach((rowArr, r) => {
            rowArr.forEach((cell, c) => {
                if (cell !== 1) setCell(r, c, '#');
            });
        });
    }

    // Stationary objects - obstacles first, then walkable zones (which
    // should never overlap an obstacle tile, but obstacles take priority if
    // a level config ever does overlap them)
    const stationary = levelConfig.objects?.stationary || [];
    stationary.forEach(obj => {
        if (COLLIDABLE_STATIONARY_TYPES.has(obj.type)) {
            setCell(obj.row, obj.col, '#');
        }
    });
    stationary.forEach(obj => {
        if (obj.type === 'pickup_zone') setCell(obj.row, obj.col, 'U');
        else if (obj.type === 'dropoff_zone') setCell(obj.row, obj.col, 'D');
    });

    // Patrol robot corridors - walkable, but dynamically occupied; marked
    // separately from '#' since the fix is sensing+waiting, not routing
    // around them permanently.
    (levelConfig.npcRobots || []).forEach(npc => {
        (npc.path || []).forEach(({ row, col }) => {
            if (grid[row]?.[col] === '.') setCell(row, col, '~');
        });
    });

    // Player start goes last so it always renders even on a zone tile
    if (levelConfig.player) {
        setCell(levelConfig.player.startRow, levelConfig.player.startCol, 'P');
    }

    return grid;
}

/**
 * Build an ASCII grid representation of the current level layout.
 * @param {Object} levelConfig - The level config (map, objects, player, npcRobots)
 * @returns {string|null} Multi-line grid string, or null if map data is missing
 */
export function buildAsciiMap(levelConfig) {
    const grid = buildGrid(levelConfig);
    if (!grid) return null;

    const legend = [
        'Legend: . = walkable floor | # = BLOCKED (wall/pillar/shelf/oil drum/conveyor - cannot walk here)',
        'U = pickup zone (walkable) | D = dropoff zone (walkable) | P = player start',
        '~ = patrol robot corridor (walkable, but sense before crossing - do not treat as blocked)',
        'Rows are Y (NORTH decreases row / SOUTH increases row), columns are X (WEST decreases col / EAST increases col), both 0-indexed from the top-left.'
    ].join('\n');

    const rows = grid.map((rowArr, r) => `${r}: ${rowArr.join(' ')}`).join('\n');

    return `${legend}\n\n${rows}`;
}
