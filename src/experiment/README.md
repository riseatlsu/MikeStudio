# Experimental Architecture Documentation

## Overview
This document describes the modular experimental group assignment system for pAIrStudio.

## Core Components

### 1. GroupConfig.js
Defines experimental groups and their features.

**Key Exports:**
- `GROUPS`: Enum-like object with group identifiers
- `GROUP_FEATURES`: Feature flags for each group
- `ASSIGNMENT_WEIGHTS`: Probability weights for random assignment

**Example Configuration:**
```javascript
export const GROUPS = {
    CONTROL: 'control',
    STANDARD_AI: 'standard_ai'
};

export const GROUP_FEATURES = {
    [GROUPS.CONTROL]: {
        chatbot: false
    },
    [GROUPS.STANDARD_AI]: {
        chatbot: true,
        chatbotMode: 'assistant'
    }
};
```

### 2. ExperimentManager.js
Singleton class that manages group assignment, persistence, and feature queries.

**Key Methods:**
- `initialize()`: Load existing cookies
- `assignGroup()`: Randomly assign a group (weighted)
- `getFeature(name)`: Query if a feature is enabled
- `hasFeature(name)`: Boolean check for feature
- `getCurrentGroup()`: Get current group ID

**Cookie Storage:**
- `pair_group`: Assigned group ID (30 days)
- `pair_participant_id`: Unique participant identifier
- `pair_consented`: Consent status

### 3. Consent Flow
HTML modal shown on first visit:
1. User reads consent information
2. Checks consent checkbox
3. Clicks "Accept and Continue"
4. ExperimentManager assigns group
5. Cookies saved
6. Modal hidden
7. Experiment begins

## Usage in Code

### Checking Features
```javascript
// Import the singleton
import { experimentManager } from './experiment/ExperimentManager.js';

// Check if chatbot should be available
if (experimentManager.hasFeature('chatbot')) {
    // Show chatbot UI
}

// Get specific feature value
const chatbotMode = experimentManager.getFeature('chatbotMode');
if (chatbotMode === 'assistant') {
    // Initialize standard AI mode
}

// Check current group
const group = experimentManager.getCurrentGroup();
console.log(`User is in group: ${group}`);
```

### Global Access
The manager is exposed globally as `window.ExperimentManager` for convenience in non-module scripts.

## Adding New Experimental Groups

### Step 1: Define the Group
Edit `src/experiment/GroupConfig.js`:

```javascript
export const GROUPS = {
    // ... existing groups
    NEW_GROUP: 'new_group_id'
};

export const GROUP_FEATURES = {
    // ... existing features
    [GROUPS.NEW_GROUP]: {
        featureA: true,
        featureB: 'custom_value',
        featureC: false
    }
};

export const ASSIGNMENT_WEIGHTS = [
    // ... existing weights
    { id: GROUPS.NEW_GROUP, weight: 1 }
];
```

### Step 2: Use Features in Code
```javascript
if (experimentManager.getFeature('featureA')) {
    // Implement feature A behavior
}
```

### Step 3: Test Assignment
To force assignment for testing:
```javascript
// In browser console
ExperimentManager.setGroup('new_group_id');
```

To clear cookies and reset:
```javascript
ExperimentManager.clearCookies();
location.reload();
```

## Current Experiment Configuration

### Groups
1. **Control** (`control`)
   - No AI assistance
   - Standard programming interface only

2. **Standard AI** (`standard_ai`)
   - AI chatbot available
   - "Assistant" mode (passive assistance)
   - No role switching

**Note**: Pair programming groups (PAIR_DRIVER, PAIR_NAVIGATOR) have been removed from the current experimental design.

### Assignment Weights
Currently equal probability (50% each):
```javascript
[
    { id: 'control', weight: 1 },
    { id: 'standard_ai', weight: 1 }
]
```
```

To change probabilities, adjust weights:
```javascript
// Example: 75% control, 25% standard_ai
[
    { id: 'control', weight: 3 },
    { id: 'standard_ai', weight: 1 }
]
```

## Modularity & Extensibility

### Easy Adjustments
- **Add groups**: Edit `GroupConfig.js` GROUPS object
- **Add features**: Add properties to GROUP_FEATURES
- **Change probabilities**: Modify ASSIGNMENT_WEIGHTS
- **Customize consent**: Edit HTML in index.html

### No Code Changes Needed For:
- Adding/removing groups
- Changing assignment weights
- Modifying feature flags
- Adjusting cookie expiry

### Code Changes Required For:
- Implementing new feature behaviors
- Changing consent form content
- Modifying cookie strategy (e.g., server-side storage)

## Data Collection
The participant ID (`cnt_XXXXXXXXX`) should be used to link:
- Group assignment
- Interaction logs
- Survey responses
- Performance metrics

Store in your analytics/database:
```javascript
{
    participantId: experimentManager.participantId,
    group: experimentManager.groupId,
    features: experimentManager.features,
    timestamp: new Date().toISOString()
}
```

## Best Practices

1. **Always check features before showing UI**
   ```javascript
   if (experimentManager.hasFeature('chatbot')) {
       showChatbot();
   }
   ```

2. **Log group assignment for analytics**
   ```javascript
   analytics.log({
       event: 'group_assigned',
       group: experimentManager.groupId,
       participantId: experimentManager.participantId
   });
   ```

3. **Test all group configurations**
   - Use `setGroup()` to manually test each group
   - Verify features enable/disable correctly
   - Check UI adapts appropriately

4. **Don't hard-code group names**
   - Use `GROUPS` constants
   - Avoids typos and makes refactoring easier

## Debugging

### View Current State
```javascript
// In browser console
console.log('Group:', ExperimentManager.groupId);
console.log('Features:', ExperimentManager.features);
console.log('Participant ID:', ExperimentManager.participantId);
```

## Dynamic Tutorial Progression (NEW)

### Overview
Groups now receive different tutorial sequences based on their assigned experimental condition. This prepares participants appropriately for their specific group's features.

### Tutorial Configuration

**TUTORIAL_PROGRESSION** in `GroupConfig.js`:
```javascript
export const TUTORIAL_PROGRESSION = {
    [GROUPS.CONTROL]: ['tutorial_A', 'tutorial_B', 'tutorial_C', 'tutorial_D', 'tutorial_E'],
    [GROUPS.STANDARD_AI]: ['tutorial_A', 'tutorial_B', 'tutorial_C', 'tutorial_D', 'tutorial_E']
};
```

Both groups run the same 5 tutorials. `chatbotEnabled` (per level, gated by group) controls whether the chatbot appears - it's not a separate tutorial - so tutorial count and practice time stay identical across groups.

### Tutorial Levels

- **tutorial_A**: Basic movement and object manipulation (all groups)
- **tutorial_B**: Loops/repeat blocks; chatbot-enabled groups also meet Otto and get their one guided chatbot practice rep here (all groups)
- **tutorial_C**: Sensing + conditional logic + the Print block (all groups)
- **tutorial_D**: Attribute-based sorting ("Object Ahead is broken") + If/Else (all groups)
- **tutorial_E**: NPC robot avoidance via sensing + While loop + the Wait block (all groups)

### Level Progression Flow

1. **Consent Accepted** → Group assigned → Progression configured
2. **Tutorials** → Same 5-level sequence for all groups (chatbot access varies from `tutorial_B` on)
3. **Experimental Levels** → Same 4 levels for all groups, in a counterbalanced order
4. **Survey** → Post-study questionnaire

### Adding Tutorials

1. Create `src/game/levels/data/tutorial_X.js`
2. Register in `src/game/levels/index.js`
3. Add to relevant group progressions in `GroupConfig.js`

### Adding Experimental Levels

Update `EXPERIMENTAL_LEVELS` in `GroupConfig.js`:
```javascript
export const EXPERIMENTAL_LEVELS = [
    'level_001',
    'level_002'  // Add new levels here
];
```

ExperimentManager.setGroup('standard_ai');
location.reload();
```

### Reset Everything
```javascript
ExperimentManager.clearCookies();
location.reload();
```

### Check Cookies
```javascript
document.cookie.split('; ').forEach(c => console.log(c));
```
