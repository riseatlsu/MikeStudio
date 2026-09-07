import { NORTH } from '../../iso/DirectionConstants';
import {
    createEdgeWalls,
    createFullFloor,
    createHorizontalConveyor
} from './layoutHelpers';

const walls = createEdgeWalls([0, 2, 4], [1, 3, 5]);

export const TutorialE = {
    id: "tutorial_E",
    title: "Tutorial E: Quality Control",
    description: "Check each box before you load it — only good boxes should reach the output conveyor.",
    instructions: `Quality control just flagged a problem: one of the boxes on the input line is defective, and it must never reach a customer. Stand on each <span class="ui-ref">green pickup zone</span> and use <span class="ui-ref">Object Ahead is broken</span> inside an <span class="ui-ref">If / Else</span> block to check the box in front of you before deciding what to do. If the box is broken, leave it where it is. If it's good, use <span class="ui-ref">Pick Up Object</span> and carry it to the <span class="ui-ref">red dropoff zone</span>, then use <span class="ui-ref">Drop Object</span> to deliver it. Try dropping a <span class="ui-ref">Print</span> block in each branch so you can watch your decisions play out in the <span class="ui-ref">Terminal</span> panel.`,
    isExperiment: false,
    chatbotEnabled: false,

    dialogue: [
        "Got a call from quality control this morning — a batch came in with at least one defective unit mixed in, and it can not go out the door.",
        "I need you to have the robot check each box before it loads it. Anything flagged broken stays put. Everything else ships."
    ],

    map: {
        width: 6,
        height: 6,
        data: createFullFloor(6)
    },

    objects: {
        stationary: [
            ...createHorizontalConveyor(0, 1, "tutorial_e_input"),
            { type: "pickup_zone", row: 1, col: 1, id: "tutorial_e_pickup_good_zone", attributes: { allowDrop: true, frame: 2 } },
            { type: "pickup_zone", row: 1, col: 3, id: "tutorial_e_pickup_broken_zone", attributes: { allowDrop: true, frame: 2 } },

            ...createHorizontalConveyor(4, 2, "tutorial_e_output"),
            { type: "dropoff_zone", row: 3, col: 3, id: "tutorial_e_dropoff_zone", attributes: { allowDrop: true, frame: 0 } },

            ...walls,

            // Decorative clutter
            { type: "OilDrums", row: 5, col: 0, id: "tutorial_e_drum", attributes: { allowDrop: false, frame: 1 } }
        ],
        moveable: [
            { type: "box", id: "tutorial_e_box_good", row: 0, col: 1, attributes: {} },
            { type: "box", id: "tutorial_e_box_broken", row: 0, col: 3, attributes: { broken: true } }
        ]
    },

    player: {
        startRow: 1,
        startCol: 2,
        startDir: NORTH,
        scale: 1.5
    },

    winConditions: [
        { type: "itemAtPos", itemId: "tutorial_e_box_good", row: 4, col: 3 },
        { type: "itemNotAtPos", itemId: "tutorial_e_box_broken", row: 4, col: 3 }
    ],

    maxSteps: 20,

    allowedBlocks: {
        actions: ['move_forward', 'turn_clockwise', 'turn_counter_clockwise', 'pick_object', 'drop_object'],
        sensing: ['survey_front', 'check_attribute'],
        logic: ['controls_if'],
        math: false,
        text: ['print_message'],
        loops: false
    }
};
