import { NORTH } from '../../iso/DirectionConstants';
import {
    createEdgeWalls,
    createFullFloor,
    createHorizontalConveyor,
    createVerticalConveyor
} from './layoutHelpers';

const walls = createEdgeWalls([0, 2, 4, 6], [1, 3, 5, 7]);

// Which pickup zone (col 2 or col 3) holds the defective box is randomized
// per session so position alone can't stand in for actually checking each
// box - see failConditions below for what happens if you guess wrong.
const brokenOnA = Math.random() < 0.5;
const goodCol = brokenOnA ? 3 : 2;
const brokenCol = brokenOnA ? 2 : 3;

export const Level2 = {
    id: "level_002",
    title: "Level 2: Hard Code Development",
    description: "Navigate two obstacle walls, sort a defective box, and get past a patrolling robot — write the whole program yourself.",
    instructions: `Three jobs rolled into one today. First, two obstacle walls block the direct path from pickup to dropoff, so you'll need to plan a route around both. Second, one of the two boxes waiting at the pickup zones is defective — use <span class="ui-ref">Object Ahead is broken</span> inside an <span class="ui-ref">If / Else</span> block to check before you commit, because picking up the defective box without checking ends the level immediately. Third, a patrol robot walks back and forth across the floor further along your route — use <span class="ui-ref">Sense Object Ahead</span> inside a <span class="ui-ref">While</span> loop to wait for it to clear before crossing, since driving into it is also a hard fail. Once you've got the right box, stand on its <span class="ui-ref">green pickup zone</span>, face the input conveyor, and use <span class="ui-ref">Pick Up Object</span>; once you're clear of the patrol robot, stand on the <span class="ui-ref">red dropoff zone</span>, face the output conveyor, and use <span class="ui-ref">Drop Object</span>.`,
    isExperiment: true,
    chatbotEnabled: true,

    dialogue: [
        "Three things on this work order. Obstacle walls block the straight-line route, QC flagged a bad box on this line, and there's a patrol bot roaming the floor further down.",
        "Check what you're grabbing before you commit, and don't try to walk through the patrol bot — it won't move for you, and it won't end well for the robot that tries."
    ],

    map: {
        width: 8,
        height: 8,
        data: createFullFloor(8)
    },

    objects: {
        stationary: [
            ...createHorizontalConveyor(0, 1, "level2_input"),
            { type: "pickup_zone", row: 1, col: 2, id: "level2_pickup_zone_a", attributes: { allowDrop: true, frame: 1 } },
            { type: "pickup_zone", row: 1, col: 3, id: "level2_pickup_zone_b", attributes: { allowDrop: true, frame: 1 } },

            ...createVerticalConveyor(5, 7, "level2_output"),
            { type: "dropoff_zone", row: 6, col: 6, id: "level2_dropoff_zone", attributes: { allowDrop: true, frame: 0 } },

            ...walls,

            // Upper obstacle wall (rows 1-2, cols 4-6) — blocks east traversal after pickup
            { type: "pillars", row: 1, col: 4, id: "level2_pillar_a", attributes: { allowDrop: false, frame: 0 } },
            { type: "pillars", row: 1, col: 5, id: "level2_pillar_b", attributes: { allowDrop: false, frame: 0 } },
            { type: "pillars", row: 1, col: 6, id: "level2_pillar_c", attributes: { allowDrop: false, frame: 0 } },
            { type: "OilDrums", row: 2, col: 3, id: "level2_drum_a", attributes: { allowDrop: false, frame: 0 } },
            { type: "OilDrums", row: 2, col: 4, id: "level2_drum_b", attributes: { allowDrop: false, frame: 0 } },
            { type: "OilDrums", row: 0, col: 4, id: "level2_drum_c", attributes: { allowDrop: false, frame: 0 } },

            // Lower obstacle wall (rows 4-5, cols 1-4) — blocks direct south path through center
            { type: "OilDrums", row: 3, col: 0, id: "level2_drum_d", attributes: { allowDrop: false, frame: 0 } },
            { type: "OilDrums", row: 3, col: 2, id: "level2_drum_e", attributes: { allowDrop: false, frame: 0 } },
            { type: "OilDrums", row: 1, col: 1, id: "level2_drum_f", attributes: { allowDrop: false, frame: 0 } },
            { type: "shelves", row: 5, col: 1, id: "level2_shelf_a", attributes: { allowDrop: false, frame: 0 } },
            { type: "shelves", row: 5, col: 2, id: "level2_shelf_b", attributes: { allowDrop: false, frame: 5 } },
            { type: "shelves", row: 5, col: 3, id: "level2_shelf_c", attributes: { allowDrop: false, frame: 7 } },
            { type: "shelves", row: 5, col: 4, id: "level2_shelf_d", attributes: { allowDrop: false, frame: 3 } },

            // Decorative clutter in dead zones
            { type: "shelves", row: 7, col: 2, id: "level2_shelf_e", attributes: { allowDrop: false, frame: 5 } },
            { type: "shelves", row: 7, col: 3, id: "level2_shelf_f", attributes: { allowDrop: false, frame: 7 } }
        ],
        moveable: [
            { type: "box", id: "level2_box_good", row: 0, col: goodCol, attributes: {} },
            { type: "box", id: "level2_box_broken", row: 0, col: brokenCol, attributes: { broken: true } }
        ]
    },

    player: {
        startRow: 7,
        startCol: 1,
        startDir: NORTH,
        scale: 1.5
    },

    // The patrol robot's corridor (row 6, cols 1-4) sits directly between the
    // lower obstacle wall and the dropoff zone, so the route there naturally
    // has to cross it.
    npcRobots: [
        {
            id: "level2_guard",
            path: [
                { row: 6, col: 0 },
                { row: 6, col: 1 },
                { row: 6, col: 2 },
                { row: 6, col: 3 },
                { row: 6, col: 4 },
                { row: 6, col: 5 },
            ],
            ticksPerStep: 2,
            randomizeStart: true
        }
    ],

    winConditions: [
        { type: "itemAtPos", itemId: "level2_box_good", row: 6, col: 7 },
        { type: "itemNotAtPos", itemId: "level2_box_broken", row: 6, col: 7 }
    ],

    // Picking up the defective box at all is a hard fail, same as colliding
    // with the patrol robot - both push toward sensing before acting instead
    // of acting blind.
    failConditions: [
        { type: "carriedAttribute", itemId: "level2_box_broken", attribute: "broken", reason: "Picked up the defective box without checking it first!" }
    ],

    maxSteps: 55,

    allowedBlocks: {
        actions: true,
        sensing: true,
        logic: true,
        math: true,
        text: true,
        loops: true,
        variables: true
    }
};
