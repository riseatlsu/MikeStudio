import { EAST, NORTH } from '../../iso/DirectionConstants';
import {
    createEdgeWalls,
    createFullFloor,
    createHorizontalConveyor
} from './layoutHelpers';

const walls = createEdgeWalls([0, 2, 4, 6], [1, 3, 5, 7]);

export const Level1 = {
    id: "level_001",
    title: "Level 1: Easy Authoring Code",
    description: "Tutorials are over — write your first full delivery program from scratch, no starter code this time.",
    instructions: `This is your first real shift on the warehouse floor, and there's no starter code to lean on. Build the whole delivery program yourself: stand on the <span class="ui-ref">green pickup zone</span>, face the input conveyor, and use the <span class="ui-ref">Pick Up Object</span> block. Then navigate to the <span class="ui-ref">red dropoff zone</span>, face the output conveyor, and use the <span class="ui-ref">Drop Object</span> block.`,
    isExperiment: true,
    chatbotEnabled: true,

    dialogue: [
        "Here's a fresh work order — pickup on one side, dropoff on the other, open floor between them. Nothing fancy, but you're building the whole program yourself this time.",
        "No starter code to lean on. Get the box from A to B."
    ],

    map: {
        width: 8,
        height: 8,
        data: createFullFloor(8)
    },

    objects: {
        stationary: [
            ...createHorizontalConveyor(0, 2, "level1_input"),
            { type: "pickup_zone", row: 0 , col: 1, id: "level1_input_zone", attributes: { allowDrop: true, frame: 2 } },

            ...createHorizontalConveyor(7, 2, "level1_output"),
            { type: "dropoff_zone", row: 7, col: 1, id: "level1_output_zone", attributes: { allowDrop: true, frame: 0 } },

            ...walls,

            { type: "shelves", row: 2, col: 6, id: "level1_shelf_a", attributes: { allowDrop: false, frame: 0 } },
            { type: "shelves", row: 2, col: 7, id: "level1_shelf_b", attributes: { allowDrop: false, frame: 3 } },
            { type: "shelves", row: 5, col: 6, id: "level1_shelf_c", attributes: { allowDrop: false, frame: 5 } },
            { type: "shelves", row: 5, col: 7, id: "level1_shelf_d", attributes: { allowDrop: false, frame: 7 } },
            
            { type: "OilDrums", row: 1, col: 6, id: "level1_drum_a", attributes: { allowDrop: false, frame: 1 } },
            { type: "OilDrums", row: 6, col: 3, id: "level1_drum_b", attributes: { allowDrop: false, frame: 2 } },
            { type: "OilDrums", row: 2, col: 1, id: "level1_drum_c", attributes: { allowDrop: false, frame: 0 } },
            { type: "OilDrums", row: 5, col: 1, id: "level1_drum_d", attributes: { allowDrop: false, frame: 3 } },
            { type: "OilDrums", row: 1, col: 7, id: "level1_drum_e", attributes: { allowDrop: false, frame: 1 } },
            
            { type: "pillars", row: 0, col: 7, id: "level1_pillar_a", attributes: { allowDrop: false, frame: 3 } },
            { type: "pillars", row: 7, col: 0, id: "level1_pillar_b", attributes: { allowDrop: false, frame: 1 } },
            { type: "pillars", row: 0, col: 0, id: "level1_pillar_c", attributes: { allowDrop: false, frame: 2 } }
        ],
        moveable: [
            { type: "box", id: "level1_box", row: 0, col: 2, attributes: {} }
        ]
    },

    player: {
        startRow: 1,
        startCol: 1,
        startDir: NORTH,
        scale: 1.5
    },

    winConditions: [
         { type: "itemAtPos", itemId: "level1_box", row: 7, col: 2 }
    ],

    maxSteps: 18,

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
