import { NORTH } from '../../iso/DirectionConstants';
import {
    createEdgeWalls,
    createHorizontalConveyor,
    createVerticalConveyor
} from './layoutHelpers';

const walls = createEdgeWalls([0, 2, 4], [1, 3, 5]);

export const TutorialB = {
    id: "tutorial_B",
    title: "Tutorial B: Route Practice",
    description: "The floor manager hands you a longer route this time — plan the path from the green pickup zone to the red dropoff zone around the shelving, and meet Otto, your new AI assistant.",
    instructions: `Word travels fast on the warehouse floor — the manager liked your last delivery and handed you a longer route this time, with some shelving in the way. To pick up the box, stand on the <span class="ui-ref">green pickup zone</span>, face the conveyor belt, and use the <span class="ui-ref">Pick Up Object</span> block. To drop off the box, navigate to the <span class="ui-ref">red dropoff zone</span>, face the output conveyor belt, and use the <span class="ui-ref">Drop Object</span> block. Use the <span class="ui-ref">Movements</span> tab to drag blocks onto the canvas, connect them top to bottom under the <span class="ui-ref">When Program Starts</span> block, then press <span class="ui-ref">Run Code</span> to execute your program. Tip: check out the <span class="ui-ref">Loops</span> category to repeat actions and shorten your block code. You've also got a new assistant, Otto, in the chat panel — try asking it something like "What does the Repeat block do?" if you get stuck.`,
    isExperiment: false,
    chatbotEnabled: true,

    dialogue: [
        "Not bad for your first day. Word already got around — that first delivery ran clean.",
        "Ready for something with a bit more legwork? This next route's longer, so don't be afraid to lean on that Repeat block instead of writing every step by hand.",
        "Oh, and one more thing — HQ set you up with some extra help. Company's rolling out an AI assistant program floor-wide.",
        "Meet Otto. It can't write your whole program for you, but it's good for a second opinion when you're stuck. Try asking it something while you work out this route."
    ],

    map: {
        width: 6,
        height: 6,
        data: [
            [1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1],
            [1, 1, 1, 0, 1, 1],
            [1, 1, 1, 0, 1, 1],
            [1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1]
        ]
    },

    objects: {
        stationary: [
            ...createVerticalConveyor(1, 1, "tutorial_b_input"),
            { type: "pickup_zone", row: 2, col: 2, id: "tutorial_b_input_zone", attributes: { allowDrop: true, frame: 1 } },

            ...createHorizontalConveyor(5, 2, "tutorial_b_output"),
            { type: "dropoff_zone", row: 5, col: 5, id: "tutorial_b_output_zone", attributes: { allowDrop: true, frame: 0 } },

            ...walls,

            { type: "shelves", row: 1, col: 4, id: "tutorial_b_shelf_a", attributes: { allowDrop: false, frame: 0 } },
            { type: "shelves", row: 1, col: 5, id: "tutorial_b_shelf_b", attributes: { allowDrop: false, frame: 3 } },
            { type: "pillars", row: 2, col: 4, id: "tutorial_b_pillar", attributes: { allowDrop: false, frame: 1 } },
            { type: "OilDrums", row: 5, col: 1, id: "tutorial_b_drum", attributes: { allowDrop: false, frame: 2 } }
        ],
        moveable: [
            { type: "box", id: "tutorial_b_box", row: 2, col: 1, attributes: {} }
        ]
    },

    player: {
        startRow: 4,
        startCol: 1,
        startDir: NORTH,
        scale: 1.5
    },

    winConditions: [
        { type: "itemAtPos", itemId: "tutorial_b_box", row: 5, col: 4 }
    ],

    maxSteps: 18,

    allowedBlocks: {
        actions: ['move_forward', 'turn_clockwise', 'turn_counter_clockwise', 'pick_object', 'drop_object'],
        sensing: false,
        logic: false,
        math: false,
        text: false,
        loops: true
    }
};
