// Configuration for Experimental Groups

export const GROUPS = {
    CONTROL: 'control',           // No AI — solo participant
    STANDARD_AI: 'standard_ai',  // AI Chatbot available (passive) — solo participant
    HUMAN_HUMAN: 'human_human'   // Two human participants collaborating — no AI
};

// Features enabled for each group
export const GROUP_FEATURES = {
    [GROUPS.CONTROL]: {
        id: GROUPS.CONTROL,
        name: 'Control Group',
        chatbot: false,
        roleSwitching: false,
        dualParticipant: false
    },
    [GROUPS.STANDARD_AI]: {
        id: GROUPS.STANDARD_AI,
        name: 'Standard AI Support',
        chatbot: true,
        chatbotMode: 'assistant',
        roleSwitching: false,
        dualParticipant: false
    },
    [GROUPS.HUMAN_HUMAN]: {
        id: GROUPS.HUMAN_HUMAN,
        name: 'Human-Human Collaboration',
        chatbot: false,
        roleSwitching: false,
        dualParticipant: true  // Two participant IDs are generated for this group
    }
};

// Probability Weights for random assignment.
// HUMAN_HUMAN is intentionally excluded — it is only activated via the
// researcher-controlled URL parameter (?hh=1), never by random assignment.
export const ASSIGNMENT_WEIGHTS = [
    { id: GROUPS.CONTROL, weight: 1 },
    { id: GROUPS.STANDARD_AI, weight: 1 }
];

/**
 * Tutorial Level Progression Configuration
 * Defines which tutorial levels each group should complete
 *
 * Tutorial Types:
 * - tutorial_A: Basic movement and object manipulation (all groups)
 * - tutorial_B: Longer route planning with loops; chatbot-enabled groups also
 *   meet Otto and get their one guided chatbot practice rep here (all groups)
 * - tutorial_C: Sensing + conditional logic ("if wall ahead, turn") + the Print block (all groups)
 * - tutorial_D: Attribute-based sorting ("Object Ahead is broken") + If/Else (all groups)
 * - tutorial_E: NPC robot avoidance via sensing + While loop + the Wait block (all groups)
 *
 * Both groups run the same 5 tutorials - chatbot access for tutorial_B (and
 * everything after) is controlled by chatbotEnabled/group assignment, not by
 * an extra tutorial, so tutorial count and practice time stay identical
 * across groups.
 */
export const TUTORIAL_PROGRESSION = {
    [GROUPS.CONTROL]: [
        'tutorial_A',
        'tutorial_B',
        'tutorial_C',
        'tutorial_D',
        'tutorial_E'
    ],
    [GROUPS.STANDARD_AI]: [
        'tutorial_A',
        'tutorial_B',
        'tutorial_C',
        'tutorial_D',
        'tutorial_E'
    ]
};

/**
 * Experimental levels in their canonical order (index 0 = level_001, etc.)
 *
 * - level_001: Easy authoring code - write a delivery program from scratch
 *   (navigate around static obstacles, conveyor to conveyor).
 * - level_002: Hard authoring code - same from-scratch authoring, plus
 *   sensing a defective box before pickup and sensing/waiting past a patrol
 *   robot (both hard-fail if you act without checking).
 * - level_003: Easy debugging/editing code - fix a starter program with one
 *   missing block (same task shape as level_001).
 * - level_004: Hard debugging/editing code - starter code already handles the
 *   defective-box check correctly; finish the patrol-robot crossing and
 *   delivery (same task shape as level_002).
 */
export const EXPERIMENTAL_LEVELS = [
    'level_001',
    'level_002',
    'level_003',
    'level_004',
];

/**
 * Williams balanced Latin square for 4 conditions (Williams, 1949).
 * Each row is a permutation of indices 0–3 into EXPERIMENTAL_LEVELS.
 * Properties: every level appears once per position; every level precedes
 * every other level exactly once across the full square (first-order
 * carry-over balanced) - all 12 possible ordered pairs occur exactly once.
 */
export const LATIN_SQUARE = [
    [0, 1, 3, 2],
    [1, 2, 0, 3],
    [2, 3, 1, 0],
    [3, 0, 2, 1],
];

/**
 * Get the complete level progression for a specific group.
 * @param {string} groupId - The group ID
 * @param {number|null} latinSquareRow - Row index (0–3) for counter-balanced
 *   experimental level order. Null/undefined = canonical order (sandbox / fallback).
 * @returns {Array<string>} Array of level IDs in order
 */
export function getLevelProgression(groupId, latinSquareRow = null) {
    const tutorials = TUTORIAL_PROGRESSION[groupId] || TUTORIAL_PROGRESSION[GROUPS.CONTROL];

    let experimentalOrder;
    if (latinSquareRow !== null && latinSquareRow !== undefined && LATIN_SQUARE[latinSquareRow]) {
        experimentalOrder = LATIN_SQUARE[latinSquareRow].map(i => EXPERIMENTAL_LEVELS[i]);
    } else {
        experimentalOrder = [...EXPERIMENTAL_LEVELS];
    }

    return [
        ...tutorials,
        ...experimentalOrder,
        'survey_final',
    ];
}
