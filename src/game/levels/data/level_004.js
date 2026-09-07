import { NORTH } from '../../iso/DirectionConstants';
import {
    createEdgeWalls,
    createFullFloor,
    createHorizontalConveyor,
    createVerticalConveyor
} from './layoutHelpers';

const walls = createEdgeWalls([0, 2, 4, 6], [1, 3, 5, 7]);

// Which pickup zone (col 3 or col 4) holds the defective box is randomized
// per session - the starter code below checks correctly either way, so this
// only matters if you break the box-check logic while adding your own code.
const brokenOnA = Math.random() < 0.5;
const goodCol = brokenOnA ? 4 : 3;
const brokenCol = brokenOnA ? 3 : 4;

export const Level4 = {
    id: "level_004",
    title: "Level 4: Hard Code Maintenance",
    description: "The starter code already sorts the defective box correctly — finish the job by getting past the patrol robot and completing the delivery.",
    instructions: `The starter code navigates to the pickup zones and correctly figures out which box is safe to grab — read through it, it checks <span class="ui-ref">Object Ahead is broken</span> before ever picking anything up. That part's done. What's missing is everything after: the program stops the moment the box is in hand. There's a central obstacle wall to route around, and further on a patrol robot walking back and forth across the floor — use <span class="ui-ref">Sense Object Ahead</span> inside a <span class="ui-ref">While</span> loop and the <span class="ui-ref">Wait</span> block to hold until it's clear before crossing, since driving into it is a hard fail. Once you're past it, navigate to the <span class="ui-ref">red dropoff zone</span>, face the output conveyor, and use <span class="ui-ref">Drop Object</span> to finish the job.`,
    isExperiment: true,
    chatbotEnabled: true,

    dialogue: [
        "Another inherited job, but a cleaner one than usual — whoever had this before you actually got the box-checking logic right. Read it over, it's solid.",
        "They just never got past the patrol bot corporate added to the floor. That part's still on you, along with the rest of the delivery."
    ],

    map: {
        width: 8,
        height: 8,
        data: createFullFloor(8)
    },

    objects: {
        stationary: [
            ...createHorizontalConveyor(0, 2, "level4_input"),
            { type: "pickup_zone", row: 1, col: 3, id: "level4_pickup_zone_a", attributes: { allowDrop: true, frame: 1 } },
            { type: "pickup_zone", row: 1, col: 4, id: "level4_pickup_zone_b", attributes: { allowDrop: true, frame: 1 } },

            ...createVerticalConveyor(5, 7, "level4_output"),
            { type: "dropoff_zone", row: 6, col: 6, id: "level4_dropoff_zone", attributes: { allowDrop: true, frame: 0 } },

            ...walls,

            // Central obstacle wall — blocks direct south path from pickup, forces east then south via col 5
            { type: "shelves", row: 3, col: 3, id: "level4_shelf_a", attributes: { allowDrop: false, frame: 0 } },
            { type: "shelves", row: 3, col: 4, id: "level4_shelf_b", attributes: { allowDrop: false, frame: 3 } },
            { type: "OilDrums", row: 4, col: 3, id: "level4_drum_a", attributes: { allowDrop: false, frame: 1 } },
            { type: "OilDrums", row: 4, col: 4, id: "level4_drum_b", attributes: { allowDrop: false, frame: 2 } },
            { type: "shelves", row: 5, col: 3, id: "level4_shelf_c", attributes: { allowDrop: false, frame: 4 } },
            { type: "shelves", row: 5, col: 4, id: "level4_shelf_d", attributes: { allowDrop: false, frame: 7 } },

            // Decorative obstacles in dead zones
            { type: "pillars", row: 2, col: 6, id: "level4_pillar_a", attributes: { allowDrop: false, frame: 0 } },
            { type: "pillars", row: 2, col: 7, id: "level4_pillar_b", attributes: { allowDrop: false, frame: 1 } },
            { type: "OilDrums", row: 6, col: 2, id: "level4_drum_c", attributes: { allowDrop: false, frame: 0 } },
            { type: "shelves", row: 7, col: 3, id: "level4_shelf_e", attributes: { allowDrop: false, frame: 5 } },
            { type: "shelves", row: 7, col: 4, id: "level4_shelf_f", attributes: { allowDrop: false, frame: 6 } }
        ],
        moveable: [
            { type: "box", id: "level4_box_good", row: 0, col: goodCol, attributes: {} },
            { type: "box", id: "level4_box_broken", row: 0, col: brokenCol, attributes: { broken: true } }
        ]
    },

    player: {
        startRow: 7,
        startCol: 1,
        startDir: NORTH,
        scale: 1.5
    },

    // The patrol robot's corridor (row 6, cols 3-5) sits directly between the
    // central obstacle wall and the dropoff zone, so the route there
    // naturally has to cross it.
    npcRobots: [
        {
            id: "level4_guard",
            path: [
                { row: 6, col: 3 },
                { row: 6, col: 4 },
                { row: 6, col: 5 }
            ],
            ticksPerStep: 2,
            randomizeStart: true
        }
    ],

    // Starter navigates to zone A, checks the box there, and picks up
    // whichever box is actually safe (zone A if good, zone B if zone A's box
    // is broken) - correct and complete regardless of which side the
    // defective box randomizes to. It stops the instant the box is in hand;
    // there's no code at all for crossing the patrol robot's corridor or
    // reaching the dropoff zone - that's the piece to add.
    starterBlocks: [
        { type: "controls_repeat_ext", inputs: {
            TIMES: { type: "math_number", fields: { NUM: 6 } },
            DO: [{ type: "move_forward" }]
        }},
        { type: "turn_clockwise" },
        { type: "controls_repeat_ext", inputs: {
            TIMES: { type: "math_number", fields: { NUM: 2 } },
            DO: [{ type: "move_forward" }]
        }},
        { type: "turn_counter_clockwise" },
        { type: "controls_if", extraState: { hasElse: true }, inputs: {
            IF0: { type: "check_attribute", fields: { ATTR: "broken" } },
            DO0: [
                { type: "turn_clockwise" },
                { type: "move_forward" },
                { type: "turn_counter_clockwise" },
                { type: "pick_object" }
            ],
            ELSE: [
                { type: "pick_object" }
            ]
        }}
    ],

    winConditions: [
        { type: "itemAtPos", itemId: "level4_box_good", row: 6, col: 7 },
        { type: "itemNotAtPos", itemId: "level4_box_broken", row: 6, col: 7 }
    ],

    // Picking up the defective box at all is a hard fail, same as colliding
    // with the patrol robot - shouldn't trigger from the unmodified starter
    // code, but guards against a student accidentally breaking the
    // already-correct box-check logic while extending the program.
    failConditions: [
        { type: "carriedAttribute", itemId: "level4_box_broken", attribute: "broken", reason: "Picked up the defective box without checking it first!" }
    ],

    maxSteps: 45,

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
