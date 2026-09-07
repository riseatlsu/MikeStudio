import { NORTH } from '../../iso/DirectionConstants';
import {
    createEdgeWalls,
    createFullFloor,
    createHorizontalConveyor,
    createVerticalConveyor
} from './layoutHelpers';

const walls = createEdgeWalls([0, 2, 4, 6], [1, 3, 5, 7]);

export const Level6 = {
    id: "level_006",
    title: "Level 6: Hard Code Maintenance",
    description: "Complete the delivery half of the program — the starter code handles pickup, you handle the rest.",
    instructions: `The starter code navigates the robot to the <span class="ui-ref">green pickup zone</span> and picks up the box. Your job is to complete the program by adding the block code that delivers the box to the <span class="ui-ref">red dropoff zone</span>. Important: an obstacle wall blocks the direct south path from the pickup zone — you will need to go <strong>east first</strong>, then south, then east again to reach the dropoff zone. Use <span class="ui-ref">Loops</span> repeat blocks to keep your code concise. When finished, press <span class="ui-ref">Run Code</span> to test the full program.`,
    isExperiment: true,
    chatbotEnabled: true,

    dialogue: [
        "Another inherited job — the toughest one on my clipboard today. Whoever had this before you got the robot to the box and picked it up clean, then never finished the delivery.",
        "There's a wall blocking the direct path back that they never routed around, either. Finish what they started."
    ],

    map: {
        width: 8,
        height: 8,
        data: createFullFloor(8)
    },

    objects: {
        stationary: [
            ...createHorizontalConveyor(0, 2, "level6_input"),
            { type: "pickup_zone", row: 1, col: 3, id: "level6_input_zone", attributes: { allowDrop: true, frame: 1 } },

            ...createVerticalConveyor(5, 7, "level6_output"),
            { type: "dropoff_zone", row: 6, col: 6, id: "level6_output_zone", attributes: { allowDrop: true, frame: 0 } },

            ...walls,

            // Central obstacle wall — blocks direct south path from pickup, forces east then south via col 5
            { type: "shelves", row: 3, col: 3, id: "level6_shelf_a", attributes: { allowDrop: false, frame: 0 } },
            { type: "shelves", row: 3, col: 4, id: "level6_shelf_b", attributes: { allowDrop: false, frame: 3 } },
            { type: "OilDrums", row: 4, col: 3, id: "level6_drum_a", attributes: { allowDrop: false, frame: 1 } },
            { type: "OilDrums", row: 4, col: 4, id: "level6_drum_b", attributes: { allowDrop: false, frame: 2 } },
            { type: "shelves", row: 5, col: 3, id: "level6_shelf_c", attributes: { allowDrop: false, frame: 4 } },
            { type: "shelves", row: 5, col: 4, id: "level6_shelf_d", attributes: { allowDrop: false, frame: 7 } },

            // Decorative obstacles in dead zones
            { type: "pillars", row: 2, col: 6, id: "level6_pillar_a", attributes: { allowDrop: false, frame: 0 } },
            { type: "pillars", row: 2, col: 7, id: "level6_pillar_b", attributes: { allowDrop: false, frame: 1 } },
            { type: "OilDrums", row: 6, col: 2, id: "level6_drum_c", attributes: { allowDrop: false, frame: 0 } },
            { type: "shelves", row: 7, col: 3, id: "level6_shelf_e", attributes: { allowDrop: false, frame: 5 } },
            { type: "shelves", row: 7, col: 4, id: "level6_shelf_f", attributes: { allowDrop: false, frame: 6 } }
        ],
        moveable: [
            { type: "box", id: "level6_box", row: 0, col: 3, attributes: {} }
        ]
    },

    player: {
        startRow: 7,
        startCol: 1,
        startDir: NORTH,
        scale: 1.5
    },

    // Starter navigates to pickup zone and picks up the box.
    // Student must complete the delivery: turn E, repeat 2 E, turn S, repeat 5 S, turn E, move E, drop.
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
        { type: "pick_object" }
    ],

    winConditions: [
        { type: "itemAtPos", itemId: "level6_box", row: 6, col: 7 }
    ],

    maxSteps: 35,

    allowedBlocks: {
        actions: ['move_forward', 'turn_clockwise', 'turn_counter_clockwise', 'pick_object', 'drop_object'],
        sensing: false,
        logic: false,
        math: false,
        text: false,
        loops: true
    }
};
