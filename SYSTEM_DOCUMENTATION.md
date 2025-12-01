# MikeBotStudio - System Documentation

## Overview
MikeBotStudio is an educational programming platform designed for research studies on computational thinking and visual programming education.

## System Architecture

### File Structure
```
MikeStudio/
├── index.html                 # Main application entry point
├── js/
│   ├── consent.js            # Consent & participant ID management
│   ├── level_manager.js      # Level progression & configuration
│   ├── iso_handler.js        # Isometric game engine
│   ├── isoMoveExample2.js    # Main game scene
│   ├── new_blockly_setup.js  # Blockly visual programming
│   ├── initial_setup.js      # Initial setup utilities
│   └── bootstrap_setup.js    # Bootstrap modal handlers
├── assets/                    # Game assets (maps, sprites)
├── blockly/                   # Blockly library files
└── phaser/                    # Phaser game engine
```

## Core Components

### 1. Consent System (`consent.js`)

**Purpose**: Manages user consent and generates unique participant IDs for research tracking.

**Key Features**:
- Generates unique participant IDs in format: `YYYYMMDD-HHMMSS-RANDOM`
- Stores consent in cookies (1-year expiration)
- Logs consent events to localStorage
- Checks for existing consent to avoid re-prompting

**API**:
```javascript
window.ConsentManager.hasConsented()      // Check if user consented
window.ConsentManager.getParticipantId()  // Get current participant ID
window.ConsentManager.processConsent()    // Process new consent
window.ConsentManager.logConsent(id)      // Log consent event
```

### 2. Level Manager (`level_manager.js`)

**Purpose**: Handles level progression, configuration, and state management.

**Key Features**:
- Supports 8 levels (expandable)
- Tracks completed levels in localStorage
- Updates UI progress indicators
- Manages level-specific configurations

**Level Configuration Structure**:
```javascript
{
  title: "Level X: Title",
  instructions: "Instructions text...",
  mapFile: "map.json",
  playerStart: { x: 2, y: 2, direction: 0 },
  itemSpawns: [{ spriteKey: 'boxes', x: 0, y: 7, frame: 0, scale: 1.5 }],
  goalConveyors: [{ x: 7, y: 0 }],
  conveyorLayer: 'Tile Layer 2'
}
```

**API**:
```javascript
window.LevelManager.getCurrentLevel()     // Get current level config
window.LevelManager.getLevel(num)         // Get specific level config
window.LevelManager.nextLevel()           // Advance to next level
window.LevelManager.goToLevel(num)        // Jump to specific level
window.LevelManager.completeLevel(num)    // Mark level as complete
window.LevelManager.updateProgressUI()    // Update UI indicators
```

### 3. Consent Screen

**UI Components**:
- Study information box
- Age & consent confirmation checkbox
- "Get Started with Experiment" button
- LSU branding and research study footer

**Behavior**:
- Shows on first visit (no cookie)
- Hides after consent given
- Generates participant ID on consent
- Checkbox must be checked to enable button

## Adding New Levels

### Step 1: Create Level Configuration
Edit `js/level_manager.js` and add a new level entry:

```javascript
initializeLevelData() {
  return {
    // ... existing levels ...
    9: {
      title: "Level 9: New Challenge",
      instructions: "Complete the new challenge by...",
      mapFile: "lvl9_v1.json",
      playerStart: { x: 3, y: 3, direction: 0 },
      itemSpawns: [
        { spriteKey: 'boxes', x: 1, y: 1, frame: 0, scale: 1.5 }
      ],
      goalConveyors: [{ x: 8, y: 8 }],
      conveyorLayer: 'Tile Layer 2'
    }
  };
}
```

### Step 2: Create Tilemap
- Design level in Tiled Map Editor
- Export as JSON to `assets/lvl9_v1.json`
- Ensure layer names match configuration

### Step 3: Update Max Levels
In `level_manager.js` constructor:
```javascript
this.maxLevels = 9; // Update from 8 to 9
```

### Step 4: Update Progress UI
Add new circle in `index.html`:
```html
<div class="level-progress">
  <!-- ... existing circles ... -->
  <div class="level-circle">9</div>
</div>
```

## Data Collection

### Participant ID Format
```
YYYYMMDD-HHMMSS-RANDOM
Example: 20251130-143022-7845
```

### Stored Data
**Cookies**:
- `mikebot_participant_id`: Unique participant identifier (1 year)

**LocalStorage**:
- `consent_log`: Array of consent events with timestamps
- `level_progress`: Current level and completed levels array

### Consent Log Entry Format
```javascript
{
  participantId: "20251130-143022-7845",
  timestamp: "2025-11-30T14:30:22.123Z",
  userAgent: "Mozilla/5.0...",
  screenResolution: "1920x1080"
}
```

### Progress Data Format
```javascript
{
  currentLevel: 1,
  completed: [1, 2, 3]  // Array of completed level numbers
}
```

## UI States

### State 1: Consent Screen
- Full-screen overlay
- Study information displayed
- Checkbox for consent
- Button disabled until checkbox checked

### State 2: Main Application
- Level progress indicator (8 circles)
- Instructions banner (dynamic per level)
- Simulation viewer (left panel)
- Visual programming (right panel)
- Action buttons (Run, Reset, Clear All)

### State 3: Level Progression
- Active level: Gold with glow effect
- Completed levels: Green gradient
- Inactive levels: Semi-transparent

## Integration Points

### Game Scene Integration
The level configuration can be accessed in game scenes:
```javascript
const levelConfig = window.LevelManager.getCurrentLevel();
// Use levelConfig.playerStart, itemSpawns, etc.
```

### Blockly Integration
Track user interactions and completions:
```javascript
// When user completes a level
window.LevelManager.completeLevel(levelNumber);
window.LevelManager.nextLevel();
window.LevelManager.updateProgressUI();
```

## Security & Privacy

- Participant IDs are anonymous (no PII)
- Data stored locally (cookies + localStorage)
- No server transmission implemented
- 18+ age verification via self-report
- Informed consent required before participation

## Future Enhancements

### Recommended Additions
1. **Server-side logging**: Send consent/progress data to research database
2. **Session tracking**: Log detailed interaction events (clicks, block usage, time)
3. **Export functionality**: Allow researchers to export participant data
4. **Level editor**: Visual tool for creating new levels
5. **Analytics dashboard**: View aggregate study results
6. **Tutorial system**: Guided introduction for first-time users

### Adding Server Integration
To add server-side data collection:

1. Create API endpoint for consent logging
2. Update `consent.js` to POST data:
```javascript
async logConsentToServer(consentData) {
  await fetch('/api/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(consentData)
  });
}
```

3. Add similar logging for level completions and interactions

## Development Workflow

### Testing Consent Flow
1. Clear cookies and localStorage
2. Reload page - consent screen should appear
3. Check checkbox and click button
4. Verify participant ID created in cookies
5. Reload page - consent screen should NOT appear

### Testing Level Progression
1. Complete level 1
2. Call `window.LevelManager.completeLevel(1)`
3. Call `window.LevelManager.nextLevel()`
4. Verify UI updates (level 1 green, level 2 gold)

### Debugging
```javascript
// Check participant ID
console.log(window.ConsentManager.getParticipantId());

// View consent log
console.log(JSON.parse(localStorage.getItem('consent_log')));

// View progress
console.log(window.LevelManager.getProgress());

// Reset for testing
document.cookie = 'mikebot_participant_id=; Max-Age=0';
localStorage.clear();
```

## Contact & Support

For questions about the system architecture or to report issues, contact the development team.

**Louisiana State University**
Educational Research Study Platform
Version 1.0
