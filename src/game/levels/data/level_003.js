import { NORTH } from '../../iso/DirectionConstants';
import {
    createEdgeWalls,
    createFullFloor,
    createHorizontalConveyor
} from './layoutHelpers';

const walls = createEdgeWalls([0, 2, 4, 6], [1, 3, 5, 7]);

export const Level4 = {
    id: "level_004",
    title: "Level 4: Easy Code Maintenance",
    description: "Find the missing block that prevents the robot from picking up the box.",
    instructions: `The starter code moves the robot to the <span class="ui-ref">green pickup zone</span> and then all the way to the <span class="ui-ref">red dropoff zone</span> — but the box never moves. Press <span class="ui-ref">Run Code</span> to watch what happens, then figure out which block is missing and drag it into the right spot in the program. Once the fix is in place, run the code again to confirm the box reaches the output conveyor.`,
    isExperiment: true,
    chatbotEnabled: true,

    dialogue: [
        "Different kind of job this time. Somebody started this program before you got here and never finished it — you're picking up where they left off.",
        "It gets the robot to the box, then just... doesn't grab it. One block's missing in there. Find it."
    ],

    map: {
        width: 8,
        height: 8,
        data: createFullFloor(8)
    },

    objects: {
        stationary: [
            ...createHorizontalConveyor(0, 2, "level4_input"),
            { type: "pickup_zone", row: 1, col: 3, id: "level4_input_zone", attributes: { allowDrop: true, frame: 1 } },

            ...createHorizontalConveyor(7, 2, "level4_output"),
            { type: "dropoff_zone", row: 6, col: 3, id: "level4_output_zone", attributes: { allowDrop: true, frame: 0 } },

            ...walls,

            { type: "shelves", row: 2, col: 6, id: "level4_shelf_a", attributes: { allowDrop: false, frame: 0 } },
            { type: "shelves", row: 2, col: 7, id: "level4_shelf_b", attributes: { allowDrop: false, frame: 3 } },
            { type: "OilDrums", row: 3, col: 6, id: "level4_drum_a", attributes: { allowDrop: false, frame: 1 } },
            { type: "OilDrums", row: 4, col: 1, id: "level4_drum_b", attributes: { allowDrop: false, frame: 0 } },
            { type: "pillars", row: 4, col: 5, id: "level4_pillar_a", attributes: { allowDrop: false, frame: 1 } }
        ],
        moveable: [
            { type: "box", id: "level4_box", row: 0, col: 3, attributes: {} }
        ]
    },

    player: {
        startRow: 2,
        startCol: 3,
        startDir: NORTH,
        scale: 1.5
    },

    // Bug: pick_object is missing after the first move_forward.
    // The robot reaches the pickup zone and walks away without the box.
    starterBlocks: [
        { type: "move_forward" },
        { type: "turn_clockwise" },
        { type: "turn_clockwise" },
        { type: "move_forward" },
        { type: "move_forward" },
        { type: "move_forward" },
        { type: "move_forward" },
        { type: "move_forward" },
        { type: "drop_object" }
    ],

    winConditions: [
        { type: "itemAtPos", itemId: "level4_box", row: 7, col: 3 }
    ],

    maxSteps: 14,

    allowedBlocks: {
        actions: ['move_forward', 'turn_clockwise', 'turn_counter_clockwise', 'pick_object', 'drop_object'],
        sensing: false,
        logic: false,
        math: false,
        text: false,
        loops: false
    }
};
