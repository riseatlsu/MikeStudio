import { NORTH } from '../../iso/DirectionConstants';
import {
    createEdgeWalls,
    createFullFloor,
    createHorizontalConveyor
} from './layoutHelpers';

const walls = createEdgeWalls([0, 2, 4], [1, 3, 5]);

// Which pickup zone (col 1 or col 3) holds the defective box is randomized
// per session so position alone can't stand in for actually checking each
// box - see failConditions below for what happens if you guess wrong.
const brokenOnLeft = Math.random() < 0.5;
const goodCol = brokenOnLeft ? 3 : 1;
const brokenCol = brokenOnLeft ? 1 : 3;

export const TutorialD = {
    id: "tutorial_D",
    title: "Tutorial D: Quality Control",
    description: "Check each box before you load it — grabbing the wrong one ends your shift on the spot.",
    instructions: `Quality control just flagged a problem: one of the two boxes on the input line is defective, and it must never reach a customer. The defective box could be at either pickup zone this time, so don't guess by position. Stand on a <span class="ui-ref">green pickup zone</span> and use <span class="ui-ref">Object Ahead is broken</span> inside an <span class="ui-ref">If / Else</span> block to check the box in front of you <em>before</em> deciding what to do — picking up the defective box without checking first ends the level immediately. If the box is broken, leave it where it is. If it's good, use <span class="ui-ref">Pick Up Object</span> and carry it to the <span class="ui-ref">red dropoff zone</span>, then use <span class="ui-ref">Drop Object</span> to deliver it. Try dropping a <span class="ui-ref">Print</span> block in each branch so you can watch your decisions play out in the <span class="ui-ref">Terminal</span> panel.`,
    isExperiment: false,
    chatbotEnabled: false,

    dialogue: [
        "Got a call from quality control this morning — a batch came in with at least one defective unit mixed in, and it can not go out the door.",
        "I need you to have the robot check each box before it loads it. Anything flagged broken stays put. Everything else ships. Check first — if the robot grabs blind and it's the bad one, that shift's over right there."
    ],

    map: {
        width: 6,
        height: 6,
        data: createFullFloor(6)
    },

    objects: {
        stationary: [
            ...createHorizontalConveyor(0, 1, "tutorial_d_input"),
            { type: "pickup_zone", row: 1, col: 1, id: "tutorial_d_pickup_zone_a", attributes: { allowDrop: true, frame: 2 } },
            { type: "pickup_zone", row: 1, col: 3, id: "tutorial_d_pickup_zone_b", attributes: { allowDrop: true, frame: 2 } },

            ...createHorizontalConveyor(4, 2, "tutorial_d_output"),
            { type: "dropoff_zone", row: 3, col: 3, id: "tutorial_d_dropoff_zone", attributes: { allowDrop: true, frame: 0 } },

            ...walls,

            // Decorative clutter
            { type: "OilDrums", row: 5, col: 0, id: "tutorial_d_drum", attributes: { allowDrop: false, frame: 1 } }
        ],
        moveable: [
            { type: "box", id: "tutorial_d_box_good", row: 0, col: goodCol, attributes: {} },
            { type: "box", id: "tutorial_d_box_broken", row: 0, col: brokenCol, attributes: { broken: true } }
        ]
    },

    player: {
        startRow: 1,
        startCol: 2,
        startDir: NORTH,
        scale: 1.5
    },

    winConditions: [
        { type: "itemAtPos", itemId: "tutorial_d_box_good", row: 4, col: 3 },
        { type: "itemNotAtPos", itemId: "tutorial_d_box_broken", row: 4, col: 3 }
    ],

    // Picking up the defective box at all - even setting it back down after -
    // is a hard fail, the same way colliding with an NPC robot is in Tutorial
    // E. Without this, a participant could just avoid the broken box's zone
    // entirely and win without ever using check_attribute; this makes acting
    // without checking actively risky instead of merely unnecessary.
    failConditions: [
        { type: "carriedAttribute", itemId: "tutorial_d_box_broken", attribute: "broken", reason: "Picked up the defective box without checking it first!" }
    ],

    maxSteps: 20,

    allowedBlocks: {
        actions: ['move_forward', 'turn_clockwise', 'turn_counter_clockwise', 'pick_object', 'drop_object'],
        sensing: true,
        logic: ['controls_if'],
        math: false,
        text: ['print_message'],
        loops: true
    }
};
