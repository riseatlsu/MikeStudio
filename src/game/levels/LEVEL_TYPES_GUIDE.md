# Level Configuration Guide: Tutorial vs Experimental Levels

## Overview
The pAIrStudio platform supports two types of levels:
1. **Tutorial Levels** - Non-experimental practice levels (no chatbot, no data collection)
2. **Experimental Levels** - Research study levels (chatbot based on group, data collected)

## Level Properties

### `isExperiment` (Optional)
- **Type**: Boolean
- **Default**: `true`
- **Purpose**: Mark whether level is part of experimental data collection
- **Values**:
  - `true` - Experimental level (performance data is logged)
  - `false` - Tutorial/practice level (data not included in study)

### `chatbotEnabled` (Optional)
- **Type**: Boolean  
- **Default**: `true`
- **Purpose**: Override chatbot visibility for specific levels
- **Behavior**:
  - `true` - Chatbot visibility follows experimental group assignment
  - `false` - Chatbot is **hidden for ALL groups** on this level (overrides group settings)

### `npcRobots` (Optional)
- **Type**: Array of `{ id, path, ticksPerStep?, tint? }`
- **Default**: none (no NPC robots)
- **Purpose**: Spawn one or more scripted robots that patrol a fixed grid path independently of the player, blocking movement into their current tile and reporting as `'robot'` to the player's sensing blocks (`Sense Object Ahead`). Colliding with an NPC robot is a hard fail (ends the level immediately) - the player must sense and wait rather than drive through it.
- **Ticks, not milliseconds**: NPC steps advance on the same shared `GameClock` (see `src/game/GameClock.js`) as the player's own actions, rather than an independent real-time timer - this is what guarantees a collision can never be missed due to one entity's visual position lagging its logical position.
- **Fields**:
  - `id` - Unique identifier for the robot
  - `path` - Ordered array of adjacent grid tiles (`{ row, col }`) to patrol; the robot spawns at `path[0]` and walks the list back and forth (ping-pong), pausing to retry if its next tile is currently occupied
  - `ticksPerStep` (default `2`) - Game-loop ticks between each step; higher = slower patrol
  - `tint` (default `0xffa500`, amber) - Sprite tint so the NPC reads as visually distinct from the player
  - `randomizeStart` (default `false`) - Spawn the NPC at a random point along `path` instead of always `path[0]`. Use this whenever the level's win condition depends on the player sensing/waiting for the NPC rather than moving through a fixed route - without it, the patrol is fully deterministic and a participant can hardcode a fixed turn-count "wait" that happens to dodge it every time, without ever using sensing.
- **Example**:
  ```javascript
  npcRobots: [
      { id: "guard_1", path: [{row:2,col:1},{row:2,col:2},{row:2,col:3}], ticksPerStep: 2 }
  ]
  ```

### `dialogue` (Optional)
- **Type**: Array of strings, or objects `{ text, requiresChatbot }`
- **Default**: none (no dialogue shown)
- **Purpose**: Pokemon-style NPC dialogue box shown once per participant before this level loads, telling the "new hire training at Ironhaul Logistics" story (see `src/game/dialogue/DialogueUI.js`). Blocking - the player must click through every line before the level becomes interactive.
- **Behavior**:
  - Each array entry is one click-through page of dialogue, spoken by the single hardcoded character ("Mack", portrait at `public/assets/construction-worker.jpg`, set independently by each HTML page's own `<img>` tag since root vs sandbox pages need different relative paths - only the speaker name is hardcoded in `DialogueUI.js`).
  - Shown once per participant per level, persisted via a participant-scoped localStorage key (`dialogueSeen_${participantId}_${levelId}`, mirroring `BlocklyManager`'s workspace-storage key convention). Reloading, resetting, or re-running the level (`Run Code`) will **not** replay it - only navigating to the level fresh will, and only if it hasn't been seen yet.
  - In sandbox mode, always shows fresh (never persisted) so researchers can preview any level's dialogue on demand.
  - **Chatbot-only lines**: a plain string entry is always shown to every participant. Use an object entry `{ text: "...", requiresChatbot: true }` instead for a line that only makes sense when the participant actually has Otto (e.g. tutorial_B's "meet your AI assistant" beat) - `LevelManager.loadLevelById()` filters these out before display for anyone where `chatbotEnabled === false` or their experimental group lacks the `chatbot` feature (control group). Filtering happens at display time, not level-load time, since group assignment isn't known when level config modules are first evaluated.
- **Writing dialogue for graded levels**: the four experimental levels (`level_001`-`level_004`) are shown to each participant in a **counterbalanced order** (see `GroupConfig.js`'s `LATIN_SQUARE`), not always 1→2→3→4. Don't write dialogue that references relative sequence ("last time," "your final job") for these levels - each one's dialogue must stand alone. Tutorials, by contrast, always run in the same fixed order per group, so sequential callbacks are safe there.
- **Example**:
  ```javascript
  dialogue: [
      "Here's a fresh work order — pickup on one side, dropoff on the other.",
      "No starter code to lean on this time.",
      { text: "Oh, and Otto's here if you want a second opinion.", requiresChatbot: true }
  ]
  ```

### `chatbotHint` (Optional)
- **Type**: String (HTML allowed, same as `instructions`)
- **Default**: none
- **Purpose**: Same idea as `dialogue`'s `requiresChatbot` entries, but for the static `instructions` banner instead of the dialogue box. Appended to `instructions` (with a leading space) only for participants who currently have the chatbot, per the same `chatbotEnabled`/group-feature check - use it for a sentence like "try asking Otto if you get stuck" that shouldn't appear for the control group. Leave the base `instructions` string itself chatbot-agnostic.

## Naming Conventions

### Tutorial Levels
- **ID Format**: `tutorial_A`, `tutorial_B`, `practice_intro`, etc.
- **Title**: Descriptive name (e.g., "Tutorial: Basic Movement")
- **Properties**: 
  - `isExperiment: false`
  - `chatbotEnabled: false` (usually)

### Experimental Levels
- **ID Format**: `level_001`, `level_002`, `level_003`, etc.
- **Title**: Short descriptive name (e.g., "First Steps", "Loop Challenge")
- **Properties**:
  - `isExperiment: true` (or omit - default)
  - `chatbotEnabled: true` (or omit - default)

## Example Configurations

### Tutorial Level (No Chatbot, No Experiment)
```javascript
export const TutorialA = {
    id: "tutorial_A",
    title: "Tutorial: Basic Movement",
    description: "Learn how to move the robot.",
    instructions: "Move forward 3 times. No chatbot help - learn by doing!",
    
    isExperiment: false,      // Don't collect data
    chatbotEnabled: false,    // Hide chatbot for everyone
    
    map: { /* ... */ },
    objects: { /* ... */ },
    player: { /* ... */ },
    winConditions: [ /* ... */ ],
    
    allowedBlocks: {
        actions: ['move_forward'],  // Very limited
        sensing: false,
        logic: false,
        math: false,
        text: false,
        loops: false
    }
};
```

### Experimental Level with Chatbot
```javascript
export const Level1 = {
    id: "level_001",
    title: "First Steps",
    description: "Pick up and deliver the package.",
    instructions: "Move the robot to pick up the box...",
    
    // isExperiment: true,     // Can omit (default)
    // chatbotEnabled: true,   // Can omit (default)
    
    map: { /* ... */ },
    objects: { /* ... */ },
    player: { /* ... */ },
    winConditions: [ /* ... */ ],
    
    allowedBlocks: {
        actions: true,  // All action blocks
        sensing: false,
        logic: false,
        math: false,
        text: false,
        loops: false
    }
};
```

### Experimental Level WITHOUT Chatbot (Special Case)
```javascript
export const Level5 = {
    id: "level_005",
    title: "Final Challenge",
    description: "Complete this level without AI assistance.",
    instructions: "This is the final test - no chatbot help!",
    
    isExperiment: true,       // Still collect data
    chatbotEnabled: false,    // But disable chatbot for everyone
    
    // ... rest of config
};
```

## Level Progression Setup

### 1. Create Level Files
Place level definitions in `src/game/levels/data/`:
- `tutorial_A.js` - First tutorial
- `tutorial_B.js` - Second tutorial
- `level_001.js` - First experimental level
- `level_002.js` - Second experimental level
- etc.

### 2. Register Levels in `index.js`
```javascript
// Import tutorial levels
import { TutorialA } from './data/tutorial_A';
import { TutorialB } from './data/tutorial_B';

// Import experimental levels
import { Level1 } from './data/level_001';
import { Level2 } from './data/level_002';

export const LEVELS = {
    // Tutorials first
    [TutorialA.id]: TutorialA,
    [TutorialB.id]: TutorialB,
    
    // Then experimental levels
    [Level1.id]: Level1,
    [Level2.id]: Level2
};
```

### 3. Set Progression Order in `LevelManager.js`
```javascript
constructor() {
    // ...
    this.allLevelIds = [
        'tutorial_A',   // Tutorial 1
        'tutorial_B',   // Tutorial 2
        'level_001',    // Experiment level 1
        'level_002',    // Experiment level 2
        'level_003'     // Experiment level 3
    ];
}
```

### 4. Set Starting Level in `MainScene.js`
```javascript
create() {
    // ...
    this.loadLevel('tutorial_A');  // Start with first tutorial
}
```

## How It Works

### Chatbot Visibility Logic
```
For each level:
  1. Check if level.chatbotEnabled === false
     → If yes: HIDE chatbot (overrides everything)
     → If no: Continue to step 2
  
  2. Check user's experimental group
     → CONTROL group: HIDE chatbot
     → STANDARD_AI group: SHOW chatbot (assistant mode)

Note: Pair programming modes (PAIR_DRIVER/PAIR_NAVIGATOR) have been removed from the current experimental design.
```

### Data Collection
- Only levels with `isExperiment: true` (or undefined) are included in analytics
- Tutorial levels (`isExperiment: false`) don't affect experimental results
- Useful for practice levels, onboarding, or post-experiment challenges

## Use Cases

### 1. Onboarding Flow
```
tutorial_A → tutorial_B → tutorial_C → tutorial_D → tutorial_E → level_001 → ...
(no chatbot, no data)    (chatbot per group, from B on)
```

### 2. Baseline Measurement
```
level_001 (chatbotEnabled: false) → level_002 → level_003 → ...
(measure without AI)                (measure with AI per group)
```

### 3. Mixed Approach
```
tutorial_A → level_001 → level_002 → practice_X → level_003
(tutorial)   (experiment with chatbot)  (practice)  (experiment)
```

## Best Practices

1. **Start with Tutorials**: Use 1-2 tutorial levels to familiarize users
2. **Clear Instructions**: Tutorial levels should have detailed instructions since there's no chatbot
3. **Progressive Difficulty**: Tutorial → Easy Experimental → Medium → Hard
4. **Consistent Naming**: Use consistent prefixes (`tutorial_`, `level_`, `practice_`)
5. **Document Purpose**: Add comments explaining why chatbot is disabled if using `chatbotEnabled: false`

## Modifying for Future Studies

### To Add New Tutorial Level:
1. Create `src/game/levels/data/tutorial_X.js`
2. Set `isExperiment: false` and `chatbotEnabled: false`
3. Import in `index.js`
4. Add ID to `allLevelIds` array in `LevelManager.js`

### To Add Experimental Level:
1. Create `src/game/levels/data/level_00X.js`
2. Omit `isExperiment` and `chatbotEnabled` (defaults are correct)
3. Import in `index.js`
4. Add ID to `allLevelIds` array in `LevelManager.js`

### To Disable Chatbot for Specific Experimental Level:
1. Open the level file (e.g., `level_005.js`)
2. Add `chatbotEnabled: false`
3. No other changes needed - system handles rest automatically

This modular design allows easy reconfiguration for different study designs without touching core system code!
