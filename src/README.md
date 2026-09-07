# Source Code Documentation

This directory contains the source code for the pAIrStudio experimental platform.

## Directory Overview

```
src/
├── main.js                    # Application entry point and initialization
├── styles.css                 # Global CSS styles
├── chatbot/                   # AI Assistant Module
│   ├── ChatbotManager.js      # Main chatbot controller
│   ├── ChatbotUI.js           # UI rendering and DOM manipulation
│   ├── PromptConfig.js        # System prompts for AI modes
│   ├── BlocklyActions.js      # Workspace lock/unlock utilities
│   ├── README.md              # Chatbot module documentation
│   └── CHATBOT_DEPLOYMENT_CHECKLIST.md
├── experiment/                # Experimental Group Management
│   ├── ExperimentManager.js   # Group assignment and feature flags
│   ├── GroupConfig.js         # Group definitions and settings
│   └── README.md              # Experiment module documentation
├── game/                      # Game Engine and Simulation
│   ├── blockly/               # Visual programming interface
│   │   ├── BlocklyManager.js  # Blockly workspace controller
│   │   └── GameAPI.js         # JavaScript API for robot control
│   ├── iso/                   # Isometric rendering engine
│   │   ├── IsoBoard.js        # Game board and grid system
│   │   ├── IsoPlayer.js       # Player robot entity
│   │   ├── IsoObjects.js      # Interactive game objects
│   │   ├── IsoUtils.js        # Coordinate conversion utilities
│   │   └── DirectionConstants.js # Direction enum (NORTH/SOUTH/EAST/WEST)
│   ├── levels/                # Level definitions and management
│   │   ├── LevelManager.js    # Level progression and state
│   │   ├── LevelBuilder.js    # Level instantiation from config
│   │   ├── LevelSchema.js     # Level configuration validator
│   │   ├── index.js           # Level registry
│   │   ├── data/              # Individual level definitions
│   │   │   ├── tutorial_A.js  # Basic movement tutorial
│   │   │   ├── tutorial_B.js  # Loops + chatbot (Otto) introduction
│   │   │   ├── tutorial_C.js  # Sensing + conditional logic tutorial
│   │   │   ├── tutorial_D.js  # Attribute-based sorting tutorial
│   │   │   ├── tutorial_E.js  # NPC avoidance / While+Wait tutorial
│   │   │   ├── level_001.js   # Easy development
│   │   │   ├── level_002.js   # Hard development (NPC + broken-box sensing)
│   │   │   ├── level_003.js   # Easy maintenance
│   │   │   ├── level_004.js   # Hard maintenance (NPC + broken-box sensing)
│   │   │   └── survey_final.js # Post-study survey level
│   │   ├── BLOCKS_CONFIG_GUIDE.md # Guide for level block restrictions
│   │   └── LEVEL_TYPES_GUIDE.md   # Level schema documentation
│   └── tools/                 # Development utilities (NOT used in runtime)
│       ├── isometric_mapping.js # ISO coordinate tools (dev only)
│       └── level_builder.js     # Level builder exports (dev only)
├── sandbox/                   # Testing interface utilities
│   └── sandbox.js             # Sandbox mode controller
├── scenes/                    # Phaser game scenes
│   └── MainScene.js           # Primary game scene
├── survey/                    # Post-Study Questionnaire
│   ├── SurveyManager.js       # Survey state and submission
│   ├── SurveyUI.js            # Survey form rendering
│   ├── SurveyConfig.js        # Question definitions
│   └── README.md              # Survey module documentation
└── utils/                     # Utility modules
    └── DataLogger.js          # Firebase logging singleton
```

## Module Dependency Graph

```
main.js
  ├─→ MainScene (Phaser)
  │     ├─→ IsoBoard
  │     ├─→ IsoPlayer
  │     ├─→ LevelBuilder
  │     └─→ LevelManager
  │           └─→ GroupConfig (level progression)
  ├─→ BlocklyManager
  │     ├─→ Blockly (library)
  │     └─→ GameAPI (runtime)
  ├─→ ExperimentManager
  │     └─→ GroupConfig
  ├─→ ChatbotManager
  │     ├─→ ChatbotUI
  │     ├─→ PromptConfig
  │     ├─→ BlocklyActions
  │     └─→ DirectionConstants
  └─→ DataLogger (Firebase)
        └─→ Firebase SDK
```

## Data Logging System

### Overview

All user interactions are captured by the **DataLogger** singleton (`utils/DataLogger.js`) and stored in Firebase Firestore. Data is organized into:

1. **Participant Documents** (`participants/{firebaseUserId}`)
   - Metadata about the participant and their session
2. **Event Subcollection** (`participants/{firebaseUserId}/events/{eventId}`)
   - Time-series log of all interactions

### Data Mapping Table

This table documents **every data point** captured by the system, organized by event type. The **Source (File Path)** column shows exactly where in the code each data point is logged.

---

#### Event: `participant_registration` (Once per session)
**Logged by:** `utils/DataLogger.js` → `setParticipantId()`  
**Triggered when:** User accepts consent form

| Data Point | Description | Source (File Path) | Firestore Destination |
|------------|-------------|-------------------|----------------------|
| **Participant ID** | User-facing identifier (e.g., `cnt_abc123xyz`) | `main.js` (calls `dataLogger.setParticipantId()`) | `participants/{uid}/participantId` |
| **Firebase User ID** | Anonymous Firebase Auth UID | `utils/DataLogger.js:148` (Firebase Auth) | `participants/{uid}/firebaseUserId` |
| **Experimental Group** | Assigned condition (e.g., `standard_ai`) | `main.js` (calls `dataLogger.setParticipantId()`) | `participants/{uid}/experimentalGroup` |
| **Start Time** | Session start timestamp (server time) | `main.js` (calls `dataLogger.setParticipantId()`) | `participants/{uid}/startTime` |
| **Start Time (Local)** | Session start timestamp (ISO client time) | `main.js` (calls `dataLogger.setParticipantId()`) | `participants/{uid}/startTimeLocal` |
| **Status** | Participant status (`in_progress`) | `main.js` (calls `dataLogger.setParticipantId()`) | `participants/{uid}/status` |

---

#### Event: `level_start` (Once per level)
**Logged by:** `game/levels/LevelManager.js` → `loadLevel()`  
**Triggered when:** User begins a new level

| Data Point | Description | Source (File Path) | Firestore Destination |
|------------|-------------|-------------------|----------------------|
| **Level ID** | Current level identifier | `game/levels/LevelManager.js:264` | `events/{id}/levelId` |
| **Timestamp** | When level started | Auto-added by `logEvent()` | `events/{id}/timestamp` |

---

#### Event: `level_complete` (Once per level, on success)
**Logged by:** `game/levels/LevelManager.js` → `checkWinConditions()`  
**Triggered when:** User successfully completes a level

| Data Point | Description | Source (File Path) | Firestore Destination |
|------------|-------------|-------------------|----------------------|
| **Level ID** | Completed level identifier | `game/levels/LevelManager.js:375` | `events/{id}/levelId` |
| **Success** | Whether level was completed successfully | `game/levels/LevelManager.js:375` | `events/{id}/success` |
| **Time Spent (ms)** | Duration on level in milliseconds | `game/levels/LevelManager.js:375` | `events/{id}/timeSpentMs` |
| **Time Spent (sec)** | Duration on level in seconds | `game/levels/LevelManager.js:375` | `events/{id}/timeSpentSeconds` |
| **Run Count** | Number of times "Run Code" was clicked | `game/levels/LevelManager.js:375` | `events/{id}/runCount` |

---

#### Event: `run_simulation` (Every "Run Code" click)
**Logged by:** `game/blockly/BlocklyManager.js` → `runCode()`  
**Triggered when:** User clicks "Run Code" button

| Data Point | Description | Source (File Path) | Firestore Destination |
|------------|-------------|-------------------|----------------------|
| **Level ID** | Current level identifier | `game/blockly/BlocklyManager.js:478` | `events/{id}/levelId` |
| **Run Number** | Sequential run number within level | `game/blockly/BlocklyManager.js:478` | `events/{id}/runNumber` |
| **Code Snapshot** | Complete Blockly workspace state (XML) | `game/blockly/BlocklyManager.js:478` | `events/{id}/codeSnapshot` |

---

#### Event: `chat_message` (Every chat interaction)
**Logged by:** `chatbot/ChatbotManager.js` → `handleUserMessage()`  
**Triggered when:** User sends message or AI responds

| Data Point | Description | Source (File Path) | Firestore Destination |
|------------|-------------|-------------------|----------------------|
| **Role** | Who sent message (`user` or `assistant`) | `chatbot/ChatbotManager.js:195, 229` | `events/{id}/role` |
| **Content** | Text content of message | `chatbot/ChatbotManager.js:195, 229` | `events/{id}/content` |
| **Level ID** | Current level context | `chatbot/ChatbotManager.js:195, 229` | `events/{id}/levelId` |
| **Timestamp** | When message was sent | Auto-added by `logEvent()` | `events/{id}/timestamp` |
| **Conversation History** | Full conversation per level (stored in doc) | `chatbot/ChatbotManager.js:195, 229` | `participants/{uid}/chatConversations.{levelId}` |

---

#### Event: `ai_interaction_context` (Every AI response)
**Logged by:** `chatbot/ChatbotManager.js` → `getAIResponse()`  
**Triggered when:** AI generates a response (logs game context sent to AI)

| Data Point | Description | Source (File Path) | Firestore Destination |
|------------|-------------|-------------------|----------------------|
| **Level Context** | Game state sent to AI (player pos, objects, etc.) | `chatbot/ChatbotManager.js:460-471` | `events/{id}/levelContext` |
| **System Prompt** | System prompt used (identifies AI mode) | `chatbot/ChatbotManager.js:199` (from `PromptConfig.js`) | `events/{id}/systemPrompt` |
| **AI Model** | Model used (e.g., `gpt-4o-mini`) | `functions/index.js:30` (Firebase Function) | `events/{id}/model` |

---

#### Event: `survey_submission` (Once per survey)
**Logged by:** `survey/SurveyManager.js` → `submitSurvey()`  
**Triggered when:** User submits survey

| Data Point | Description | Source (File Path) | Firestore Destination |
|------------|-------------|-------------------|----------------------|
| **Survey ID** | Survey identifier (e.g., `final_survey`) | `survey/SurveyManager.js:152` | `events/{id}/surveyId` |
| **Responses** | Complete answer set (all questions) | `survey/SurveyManager.js:152` | `events/{id}/responses` |
| **Answers (Document)** | Also stored in participant document | `survey/SurveyManager.js:152` | `participants/{uid}/surveys.{surveyId}` |

---

#### Event: `collision` (Every movement into obstacle)
**Logged by:** `game/iso/IsoPlayer.js` → `moveForward()`  
**Triggered when:** Player attempts to move into an obstacle or boundary

| Data Point | Description | Source (File Path) | Firestore Destination |
|------------|-------------|-------------------|----------------------|
| **Level ID** | Current level identifier | `game/iso/IsoPlayer.js:184` | `events/{id}/levelId` |
| **Collision Type** | Type (`boundary`, `conveyor`, `box`, etc.) | `game/iso/IsoPlayer.js:184` | `events/{id}/collisionType` |
| **Player Position** | Player's row/col when collision occurs | `game/iso/IsoPlayer.js:184` | `events/{id}/playerRow`, `playerCol` |
| **Player Direction** | Player's facing direction | `game/iso/IsoPlayer.js:184` | `events/{id}/playerDirection` |
| **Target Position** | Attempted target row/col | `game/iso/IsoPlayer.js:184` | `events/{id}/targetRow`, `targetCol` |
| **Object ID** | ID of object collided with (if any) | `game/iso/IsoPlayer.js:184` | `events/{id}/objectId` |
| **Object Type** | Type of object hit | `game/iso/IsoPlayer.js:184` | `events/{id}/objectType` |

---

#### Event: `drop_action` (Every box drop)
**Logged by:** `game/iso/IsoPlayer.js` → `drop()`  
**Triggered when:** Player drops an object

| Data Point | Description | Source (File Path) | Firestore Destination |
|------------|-------------|-------------------|----------------------|
| **Level ID** | Current level identifier | `game/iso/IsoPlayer.js:332` | `events/{id}/levelId` |
| **Drop Location** | Row/col where item was dropped | `game/iso/IsoPlayer.js:333-334` | `events/{id}/dropRow`, `dropCol` |
| **On Conveyor** | Whether dropped on conveyor (vs floor) | `game/iso/IsoPlayer.js:335` | `events/{id}/onConveyor` (boolean) |
| **Object ID** | ID of dropped object | `game/iso/IsoPlayer.js:336` | `events/{id}/objectId` |
| **Object Type** | Type of dropped object | `game/iso/IsoPlayer.js:337` | `events/{id}/objectType` |
| **Conveyor ID** | ID of conveyor if dropped on one | `game/iso/IsoPlayer.js:338` | `events/{id}/conveyorId` |
| **Player State** | Player position and direction | `game/iso/IsoPlayer.js:339-341` | `events/{id}/playerRow`, `playerCol`, `playerDirection` |

---

#### Event: `experiment_complete` (Once per session)
**Logged by:** `utils/DataLogger.js` → `completeExperiment()`  
**Triggered when:** User completes final survey

| Data Point | Description | Source (File Path) | Firestore Destination |
|------------|-------------|-------------------|----------------------|
| **Status** | Updated to `completed` | `survey/SurveyManager.js:158` (calls `completeExperiment()`) | `participants/{uid}/status` |
| **Completion Time** | Server timestamp | `survey/SurveyManager.js:158` (calls `completeExperiment()`) | `participants/{uid}/completionTime` |
| **Total Time (ms)** | Total session duration | `survey/SurveyManager.js:158` (calls `completeExperiment()`) | `participants/{uid}/totalTimeMs` |
| **Total Time (seconds)** | Duration in seconds | `survey/SurveyManager.js:158` (calls `completeExperiment()`) | `participants/{uid}/totalTimeSeconds` |
| **Total Time (minutes)** | Duration in minutes | `survey/SurveyManager.js:158` (calls `completeExperiment()`) | `participants/{uid}/totalTimeMinutes` |
| **Levels Completed** | Count of completed levels | `survey/SurveyManager.js:158` (calls `completeExperiment()`) | `events/{id}/levelsCompleted` |

---

#### Metadata (Included in all events)
**Added automatically by:** `utils/DataLogger.js` → `logEvent()`

| Data Point | Description | Source (File Path) | Firestore Destination |
|------------|-------------|-------------------|----------------------|
| **Timestamp (Server)** | Firestore server timestamp | Auto-added by `logEvent()` | `events/{id}/timestamp` |
| **Local Time** | Client timestamp (ISO 8601) | Auto-added by `logEvent()` | `events/{id}/localTime` |
| **Experimental Group** | Participant's assigned group | Auto-added by `logEvent()` | `events/{id}/experimentalGroup` |
| **Is Experiment** | `true` if the event's level is part of the experimental dataset, `false` for tutorial/practice levels | Auto-added by `logEvent()` from the level's `isExperiment` flag | `events/{id}/isExperiment` |
| **Level Phase** | `'experimental'` or `'tutorial'` — human-readable version of `isExperiment`, lets you filter tutorial-level data (e.g. `tutorial_A`, `tutorial_D`) from the Firestore console without a separate level-ID lookup | Auto-added by `logEvent()` | `events/{id}/levelPhase` |

### Event Types Summary

| Event Type | Frequency | Data Captured |
|------------|-----------|---------------|
| `participant_registration` | Once per session | Participant ID, group, start time |
| `level_start` | Once per level | Level ID |
| `level_complete` | Once per level (on success) | Level ID, success, time spent, run count |
| `run_simulation` | Every "Run Code" click | Level ID, run number, code snapshot |
| `chat_message` | Every chat interaction | Role, content, timestamp, level ID |
| `ai_interaction_context` | Every AI response | Context data, system prompt, model |
| `survey_submission` | Once per survey | Survey ID, all responses |
| `collision` | Every movement into obstacle | Collision type, player position, target position, object info |
| `drop_action` | Every box drop | Drop location, on conveyor (boolean), object info, player state |
| `experiment_complete` | Once per session | Total time, levels completed |

### Firestore Schema

```
participants/{firebaseUserId}
├── participantId: string
├── firebaseUserId: string
├── experimentalGroup: string
├── startTime: timestamp
├── startTimeLocal: string (ISO 8601)
├── status: string ('in_progress' | 'completed')
├── completionTime?: timestamp
├── totalTimeMs?: number
├── totalTimeSeconds?: number
├── totalTimeMinutes?: number
├── surveys: map
│   └── {surveyId}: map
│       ├── responses: map
│       └── completedAt: timestamp
├── chatConversations: map
│   └── {levelId}: map
│       ├── messages: array
│       ├── lastUpdated: timestamp
│       └── messageCount: number
└── lastUpdated: timestamp

events/{eventId} (subcollection)
├── eventType: string
├── timestamp: timestamp (server)
├── localTime: string (ISO 8601)
├── currentLevel?: string
├── experimentalGroup: string
└── ...event-specific fields
```

## Key Modules Documentation

### main.js

**Purpose**: Application initialization and global manager setup

**Responsibilities**:
- Initialize Phaser game engine
- Create Blockly workspace
- Expose managers globally (`window.dataLogger`, `window.experimentManager`, etc.)
- Set up "Run Code" and "Reset" button handlers

**Initialization Flow**:
1. Create Phaser game instance
2. Initialize BlocklyManager
3. Expose DataLogger (initialized after consent)
4. Bind UI button events

### DataLogger (utils/DataLogger.js)

**Purpose**: Singleton service for Firebase data collection

**Key Features**:
- Anonymous Firebase Authentication
- Automatic event queueing when offline
- localStorage persistence for offline events
- Network status monitoring with auto-reconnect
- Exponential backoff retry logic

**Core Methods**:
- `initExperiment()`: Initialize Firebase and auth
- `setParticipantId(id, group)`: Create participant document
- `logEvent(type, data)`: Generic event logger
- `logLevelStart(levelId)`: Log level start
- `logLevelComplete(levelId, success, metrics)`: Log level completion
- `logRun(levelId, code)`: Log code execution
- `logChatMessage(role, content, levelId)`: Log chat interaction
- `logSurvey(surveyId, responses)`: Log survey submission

### ExperimentManager (experiment/ExperimentManager.js)

**Purpose**: Manage experimental group assignment and feature flags

**Key Features**:
- Weighted random group assignment
- Cookie-based persistence (30 days)
- Feature flag queries

**Core Methods**:
- `initialize()`: Load existing cookies
- `assignGroup()`: Randomly assign a group
- `getFeature(name)`: Query feature value
- `hasFeature(name)`: Boolean feature check
- `getCurrentGroup()`: Get current group ID

### ChatbotManager (chatbot/ChatbotManager.js)

**Purpose**: Control chatbot visibility and AI assistant interactions

**Mode**:
- **Standard**: AI assistant for the `standard_ai` experimental group

**Core Methods**:
- `initialize(experimentManager)`: Setup based on group
- `handleUserMessage(message)`: Process user input
- `sendInitialGreeting()`: Send greeting message
- `show()` / `hide()`: Control visibility

**Note**: Pair programming modes (driver/navigator) have been removed from the current experimental design.

### LevelManager (game/levels/LevelManager.js)

**Purpose**: Manage level progression, state, and UI

**Core Methods**:
- `setLevelProgression(groupId)`: Set level order based on group
- `registerLevel(config)`: Register a level definition
- `loadLevel(levelId)`: Load and initialize a level
- `markLevelComplete(levelId)`: Track completion
- `advanceToNextLevel()`: Progress to next level

### BlocklyManager (game/blockly/BlocklyManager.js)

**Purpose**: Manage Blockly workspace and code execution

**Core Methods**:
- `init(containerId)`: Create Blockly workspace
- `updateToolboxForLevel(levelConfig)`: Update available blocks
- `runCode()`: Generate and execute JavaScript
- `saveWorkspaceState()`: Persist workspace to localStorage
- `loadWorkspaceState()`: Restore workspace from localStorage

### SurveyManager (survey/SurveyManager.js)

**Purpose**: Handle survey questions, responses, and submission

**Core Methods**:
- `initialize(experimentManager)`: Load group-specific questions
- `setAnswer(questionId, answer)`: Save answer
- `getAnswer(questionId)`: Retrieve answer
- `validateAnswers()`: Check all required questions answered
- `submitSurvey()`: Submit to DataLogger and mark complete

## Adding Logging to New Features

To add data collection for new features:

```javascript
// Import DataLogger
import dataLogger from './utils/DataLogger.js';

// Or use global reference
window.dataLogger.logEvent('new_event_type', {
    customField: 'value',
    metadata: { key: 'data' }
});
```

## Testing Locally

Use the sandbox mode for rapid testing without consent flow:

1. Navigate to `http://localhost:5173/sandbox/`
2. Select experimental group manually
3. Test features without Firebase logging (optional)

---

**For additional module-specific documentation, see:**
- `chatbot/README.md` - Chatbot architecture
- `experiment/README.md` - Experimental framework
- `survey/README.md` - Survey system
- `game/levels/LEVEL_TYPES_GUIDE.md` - Level configuration
- `game/levels/BLOCKS_CONFIG_GUIDE.md` - Block restrictions
