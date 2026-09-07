import { NORTH } from '../../iso/DirectionConstants';
import {
    createEdgeWalls,
    createFullFloor,
    createHorizontalConveyor
} from './layoutHelpers';

const walls = createEdgeWalls([0, 2, 4], [1, 3, 5]);

export const TutorialD = {
    id: "tutorial_D",
    title: "Tutorial D: Sense and Decide",
    description: "Use the robot's sensor to detect obstacles and decide, on its own, whether to turn or move forward.",
    instructions: `The warehouse floor manager just wired motion sensors into your robot's chassis — time to put them to use. Use the <span class="ui-ref">Sense Object Ahead</span> block to see what's directly in front of the robot, then feed that result into an <span class="ui-ref">If / Else</span> block: if a pillar is blocking the way, turn; otherwise, keep moving forward. Wrap the check in a <span class="ui-ref">Repeat</span> loop so the robot re-checks its surroundings and reacts on its own each time, instead of you counting out every step by hand. Drop a <span class="ui-ref">Print</span> block in the loop too, so you can watch exactly what the sensor reports in the <span class="ui-ref">Terminal</span> panel as the robot moves. Start by standing on the <span class="ui-ref">green pickup zone</span> and using <span class="ui-ref">Pick Up Object</span>, then turn to face the route and build your sense-and-decide loop to steer around the pillar and reach the <span class="ui-ref">red dropoff zone</span>.`,
    isExperiment: false,
    chatbotEnabled: false,

    dialogue: [
        "Maintenance came through last night and wired motion sensors into the whole fleet. Fancy upgrade — figured you'd want to be the first to try it.",
        "Instead of memorizing every obstacle by eye, have the robot check what's in front of it and decide for itself. Wrap it in a loop and it'll keep reacting on its own."
    ],

    map: {
        width: 6,
        height: 6,
        data: createFullFloor(6)
    },

    objects: {
        stationary: [
            ...createHorizontalConveyor(0, 1, "tutorial_d_input"),
            { type: "pickup_zone", row: 1, col: 2, id: "tutorial_d_input_zone", attributes: { allowDrop: true, frame: 1 } },

            ...createHorizontalConveyor(4, 2, "tutorial_d_output"),
            { type: "dropoff_zone", row: 3, col: 3, id: "tutorial_d_output_zone", attributes: { allowDrop: true, frame: 0 } },

            ...walls,

            // The one obstacle the sense-and-decide loop needs to react to
            { type: "pillars", row: 1, col: 4, id: "tutorial_d_pillar", attributes: { allowDrop: false, frame: 0 } },

            // Decorative clutter
            { type: "OilDrums", row: 5, col: 0, id: "tutorial_d_drum", attributes: { allowDrop: false, frame: 1 } }
        ],
        moveable: [
            { type: "box", id: "tutorial_d_box", row: 0, col: 2, attributes: {} }
        ]
    },

    player: {
        startRow: 1,
        startCol: 2,
        startDir: NORTH,
        scale: 1.5
    },

    winConditions: [
        { type: "itemAtPos", itemId: "tutorial_d_box", row: 4, col: 3 }
    ],

    maxSteps: 15,

    allowedBlocks: {
        actions: ['move_forward', 'turn_clockwise', 'turn_counter_clockwise', 'pick_object', 'drop_object'],
        sensing: ['survey_front'],
        logic: ['controls_if', 'logic_compare'],
        math: false,
        text: ['text', 'print_message'],
        loops: ['controls_repeat_ext']
    }
};
