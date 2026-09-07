import { NORTH } from '../../iso/DirectionConstants';
import {
    createEdgeWalls,
    createFullFloor,
    createHorizontalConveyor
} from './layoutHelpers';

const walls = createEdgeWalls([0, 2, 4], [1, 3, 5]);

export const TutorialF = {
    id: "tutorial_F",
    title: "Tutorial F: Share the Floor",
    description: "Another robot is patrolling the corridor ahead — sense when it's clear before crossing.",
    instructions: `You're not the only robot on the warehouse floor today. A patrol robot is walking back and forth across the corridor between you and the dropoff zone, and driving straight into it will get you both stuck. Pick up the box, then use <span class="ui-ref">Sense Object Ahead</span> inside a <span class="ui-ref">While</span> loop to check whether a <span class="ui-ref">robot</span> is blocking your path — if it is, use the new <span class="ui-ref">Wait</span> block to pause a moment and check again, instead of guessing when it'll be safe to move. Once the loop ends, the way is clear: move forward to the <span class="ui-ref">red dropoff zone</span> and use <span class="ui-ref">Drop Object</span> to finish the delivery.`,
    isExperiment: false,
    chatbotEnabled: false,

    dialogue: [
        "Careful today — corporate leased us a second unit to help with the backlog, and it's already out there running its own patrol route.",
        "Robots don't yield to each other, so if yours drives straight into it, you'll both be stuck till someone walks over and resets things. Sense it, wait it out, then go.",
        "That's the last of your training runs, by the way. Everything after this is real work — actual orders, actual deadlines. You ready?"
    ],

    map: {
        width: 6,
        height: 6,
        data: createFullFloor(6)
    },

    objects: {
        stationary: [
            ...createHorizontalConveyor(0, 2, "tutorial_f_input"),
            { type: "pickup_zone", row: 1, col: 3, id: "tutorial_f_pickup_zone", attributes: { allowDrop: true, frame: 2 } },

            ...createHorizontalConveyor(5, 2, "tutorial_f_output"),
            { type: "dropoff_zone", row: 4, col: 3, id: "tutorial_f_dropoff_zone", attributes: { allowDrop: true, frame: 0 } },

            ...walls,

            // Shelving forces single-file travel down column 3, while row 2
            // stays fully open as the patrol robot's corridor.
            { type: "shelves", row: 1, col: 2, id: "tutorial_f_shelf_a", attributes: { allowDrop: false, frame: 0 } },
            { type: "shelves", row: 1, col: 4, id: "tutorial_f_shelf_b", attributes: { allowDrop: false, frame: 3 } },
            { type: "shelves", row: 3, col: 2, id: "tutorial_f_shelf_c", attributes: { allowDrop: false, frame: 5 } },
            { type: "shelves", row: 3, col: 4, id: "tutorial_f_shelf_d", attributes: { allowDrop: false, frame: 7 } },
            { type: "shelves", row: 4, col: 2, id: "tutorial_f_shelf_e", attributes: { allowDrop: false, frame: 0 } },
            { type: "shelves", row: 4, col: 4, id: "tutorial_f_shelf_f", attributes: { allowDrop: false, frame: 3 } }
        ],
        moveable: [
            { type: "box", id: "tutorial_f_box", row: 0, col: 3, attributes: {} }
        ]
    },

    player: {
        startRow: 1,
        startCol: 3,
        startDir: NORTH,
        scale: 1.5
    },

    npcRobots: [
        {
            id: "tutorial_f_guard",
            path: [
                { row: 2, col: 1 },
                { row: 2, col: 2 },
                { row: 2, col: 3 },
                { row: 2, col: 4 },
                { row: 2, col: 5 }
            ],
            ticksPerStep: 2
        }
    ],

    winConditions: [
        { type: "itemAtPos", itemId: "tutorial_f_box", row: 5, col: 3 }
    ],

    maxSteps: 20,

    // All blocks unlocked - this is the last tutorial before the graded
    // levels, so the full toolbox opens up here.
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
