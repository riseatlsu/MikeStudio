/**
 * @fileoverview DataLogger - Singleton Firebase data collection service.
 * Handles participant registration, event logging, offline queueing, and network resilience.
 * @module utils/DataLogger
 */

// Firebase Data Logger for pAIrStudio
// 
// CONFIGURING COLLECTION NAMES:
// By default, data is stored in:
//   - 'participants' collection (main documents)
//   - 'events' sub-collection (under each participant)
//
// To change collection names, call setCollectionNames() before initialization:
//   import dataLogger from './utils/DataLogger.js';
//   dataLogger.setCollectionNames('experiment_participants', 'user_events');
//   dataLogger.initialize();
//
// Or modify the defaults in the constructor below:
//   this.participantsCollection = 'your_collection_name';
//   this.eventsCollection = 'your_events_name';
//

import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp, setDoc, doc, updateDoc, getDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

// Firebase configuration for pAIrStudio
const firebaseConfig = {
    apiKey: "AIzaSyB_dE4Vc6aUi4BNTClGfYtaDR73LHb4otc",
    authDomain: "pair-studio-v1.firebaseapp.com",
    projectId: "pair-studio-v1",
    storageBucket: "pair-studio-v1.firebasestorage.app",
    messagingSenderId: "536010377219",
    appId: "1:536010377219:web:637feea78b4d2bd34fe636"
};

// Singleton instance
let instance = null;

/**
 * DataLogger - Singleton service for Firebase data collection.
 * 
 * Features:
 * - Anonymous Firebase Authentication
 * - Participant registration with experimental group tracking
 * - Event logging with automatic timestamping
 * - Offline event queueing with localStorage persistence
 * - Network status monitoring with auto-reconnect
 * - Exponential backoff retry logic
 * - Zero data loss guarantee through robust queueing
 * 
 * Usage:
 * ```javascript
 * import dataLogger from './utils/DataLogger.js';
 * 
 * // Initialize after user consent
 * await dataLogger.initExperiment();
 * dataLogger.setParticipantId('cnt_abc123', 'standard_ai');
 * 
 * // Log events
 * await dataLogger.logLevelStart('level_001');
 * await dataLogger.logRun('level_001', workspaceXML);
 * await dataLogger.logLevelComplete('level_001', true);
 * ```
 * 
 * @class DataLogger
 */
class DataLogger {
    /**
     * Create the DataLogger singleton instance.
     * 
     * Private constructor - use the exported singleton instance instead.
     * Initializes Firebase, sets up event queue, and restores queued
     * events from localStorage if present.
     */
    constructor() {
        if (instance) return instance;
        instance = this;

        // Initialize Firebase
        this.app = initializeApp(firebaseConfig);
        this.db = getFirestore(this.app);
        this.auth = getAuth(this.app);

        // Collection names (configurable)
        this.participantsCollection = 'participants';
        this.eventsCollection = 'events';

        // State
        this.currentUserId = null;
        this.currentCondition = null;
        this.experimentStartTime = null;
        this.sessionData = {
            levels: {},
            chatHistory: [],
            runCounts: {},
            currentLevel: null,
            participantId: null
        };
        
        // Event queue for when Firebase isn't ready
        this.eventQueue = [];
        this.isFirebaseReady = false;
        
        // Load queued events from localStorage if any
        try {
            const savedQueue = localStorage.getItem('dataLogger_eventQueue');
            if (savedQueue) {
                this.eventQueue = JSON.parse(savedQueue);
                console.log(`DataLogger: Loaded ${this.eventQueue.length} queued events from localStorage`);
            }
        } catch (e) {
            console.warn('DataLogger: Could not load event queue from localStorage');
        }
        
        // Offline support
        this.isOnline = navigator.onLine;
        this.retryAttempts = 0;
        this.maxRetryAttempts = 5;
        this.retryTimeout = null;
        this.pendingParticipantData = null; // Store participant data when offline
        
        // Monitor network status
        this.setupNetworkMonitoring();
        
        // Bind methods
        this.initExperiment = this.initExperiment.bind(this);
        this.logEvent = this.logEvent.bind(this);
    }

    /**
     * Configure custom collection names (must be called before initExperiment)
     * @param {string} participantsCollection - Name for participants collection
     * @param {string} eventsCollection - Name for events sub-collection
     */
    setCollectionNames(participantsCollection, eventsCollection) {
        if (this.isFirebaseReady) {
            console.warn('DataLogger: Collection names should be set before initExperiment() is called');
        }
        this.participantsCollection = participantsCollection || 'participants';
        this.eventsCollection = eventsCollection || 'events';
        console.log(`DataLogger: Collection names set to '${this.participantsCollection}' and '${this.eventsCollection}'`);
    }

    /**
     * Set up network status monitoring for auto-reconnect
     */
    setupNetworkMonitoring() {
        window.addEventListener('online', () => {
            console.log('DataLogger: Network connection restored');
            this.isOnline = true;
            this.retryAttempts = 0; // Reset retry counter
            
            // Hide offline notification
            this.hideOfflineNotification();
            
            // Retry Firebase connection if not ready
            if (!this.isFirebaseReady && !this.retryTimeout) {
                console.log('DataLogger: Attempting to reconnect to Firebase...');
                this.initExperiment();
            }
        });
        
        window.addEventListener('offline', () => {
            console.log('DataLogger: Network connection lost - data will be queued');
            this.isOnline = false;
            
            // Show offline notification
            this.showOfflineNotification();
        });
    }

    /**
     * Show offline notification banner to user
     */
    showOfflineNotification() {
        const banner = document.getElementById('offline-notification');
        if (banner) {
            banner.style.display = 'block';
            document.body.classList.add('offline-mode');
        }
    }

    /**
     * Hide offline notification banner
     */
    hideOfflineNotification() {
        const banner = document.getElementById('offline-notification');
        if (banner) {
            banner.style.display = 'none';
            document.body.classList.remove('offline-mode');
        }
    }

    /**
     * Initialize the experiment and anonymous auth with retry logic
     */
    async initExperiment() {
        // Check if online before attempting
        if (!navigator.onLine) {
            console.warn('DataLogger: No internet connection - will retry when online');
            this.isFirebaseReady = false;
            return null;
        }

        try {
            const userCredential = await signInAnonymously(this.auth);
            this.currentUserId = userCredential.user.uid;
            this.experimentStartTime = Date.now();
            
            console.log("DataLogger: Connected to experiment. User ID:", this.currentUserId);
            
            this.isFirebaseReady = true;
            this.retryAttempts = 0; // Reset retry counter on success
            
            // Hide offline notification on successful connection
            this.hideOfflineNotification();
            
            // Save userId to localStorage as backup
            try {
                localStorage.setItem('dataLogger_userId', this.currentUserId);
            } catch (e) {
                console.warn('DataLogger: Could not save userId to localStorage');
            }
            
            // Process pending participant registration if any
            if (this.pendingParticipantData) {
                console.log('DataLogger: Processing pending participant registration...');
                const { participantId, group, options } = this.pendingParticipantData;
                this.pendingParticipantData = null;
                await this.setParticipantId(participantId, group, options || {});
            }
            
            // Process queued events
            if (this.eventQueue.length > 0) {
                console.log(`DataLogger: Processing ${this.eventQueue.length} queued events...`);
                while (this.eventQueue.length > 0) {
                    const { eventType, eventData } = this.eventQueue.shift();
                    await this.logEvent(eventType, eventData);
                }
                
                // Clear localStorage queue after successful processing
                try {
                    localStorage.removeItem('dataLogger_eventQueue');
                } catch (e) {
                    console.warn('DataLogger: Could not clear event queue from localStorage');
                }
            }

            return this.currentUserId;
        } catch (error) {
            console.error("DataLogger: Firebase connection error:", error);
            this.isFirebaseReady = false;
            
            // Show offline notification to user
            this.showOfflineNotification();
            
            // Implement exponential backoff retry
            if (this.retryAttempts < this.maxRetryAttempts) {
                this.retryAttempts++;
                const retryDelay = Math.min(1000 * Math.pow(2, this.retryAttempts), 30000); // Max 30 seconds
                console.log(`DataLogger: Will retry in ${retryDelay/1000} seconds (attempt ${this.retryAttempts}/${this.maxRetryAttempts})`);
                
                this.retryTimeout = setTimeout(() => {
                    this.retryTimeout = null;
                    this.initExperiment();
                }, retryDelay);
            } else {
                console.error('DataLogger: Max retry attempts reached. Data will be queued until manual reconnect.');
            }
            
            return null;
        }
    }

    /**
     * Set participant ID and create initial document
     * @param {string} participantId - The user-facing participant ID
     * @param {string} group - Experimental group/condition
     * @param {Object} [options] - Optional extra data
     * @param {string} [options.participantIdB] - Second participant ID (human-human condition)
     */
    async setParticipantId(participantId, group, options = {}) {
        // Skip in sandbox mode
        if (window.experimentManager?.sandboxMode) {
            return;
        }

        // Store locally regardless of connection status
        this.sessionData.participantId = participantId;
        this.currentCondition = group;

        // Save to localStorage as backup
        try {
            localStorage.setItem('dataLogger_participantId', participantId);
            localStorage.setItem('dataLogger_group', group);
        } catch (e) {
            console.warn('DataLogger: Could not save participant data to localStorage');
        }

        // If not connected, queue for later
        if (!this.currentUserId) {
            console.warn("DataLogger: Offline - queueing participant registration");
            this.pendingParticipantData = { participantId, group, options };

            // Try to initialize Firebase
            await this.initExperiment();

            // If still offline, data will be processed when connection is restored
            if (!this.currentUserId) {
                return;
            }
        }

        try {
            const userRef = doc(this.db, this.participantsCollection, this.currentUserId);

            // Check if exists to avoid overwriting if called multiple times
            const docSnap = await getDoc(userRef);

            const userData = {
                participantId: participantId,
                firebaseUserId: this.currentUserId,
                experimentalGroup: group,
                lastUpdated: serverTimestamp()
            };

            // Store second participant ID for human-human condition
            if (options.participantIdB) {
                userData.participantIdB = options.participantIdB;
            }

            if (!docSnap.exists()) {
                userData.startTime = serverTimestamp();
                userData.startTimeLocal = new Date().toISOString();
                userData.status = 'in_progress';
                await setDoc(userRef, userData);
            } else {
                await updateDoc(userRef, userData);
            }

            console.log("DataLogger: Participant registered:", participantId, group);
        } catch (error) {
            console.error("DataLogger: Error creating participant doc:", error);
            this.pendingParticipantData = { participantId, group, options };
        }
    }

    /**
     * Save Prolific and Qualtrics IDs to the participant's Firebase document
     * @param {string|null} prolificId - Participant's Prolific PID
     * @param {string|null} qualtricsResponseId - Qualtrics response UID
     */
    async setProlificData(prolificId, qualtricsResponseId) {
        // Skip in sandbox mode
        if (window.experimentManager?.sandboxMode) return;

        // Persist locally
        if (prolificId) localStorage.setItem('prolific_pid', prolificId);
        if (qualtricsResponseId) localStorage.setItem('qualtrics_uid', qualtricsResponseId);

        if (!this.currentUserId) {
            console.warn('DataLogger: setProlificData called before Firebase ready — data already in localStorage');
            return;
        }

        try {
            const userRef = doc(this.db, this.participantsCollection, this.currentUserId);
            const update = { lastUpdated: serverTimestamp() };
            if (prolificId) update.prolificId = prolificId;
            if (qualtricsResponseId) update.qualtricsResponseId = qualtricsResponseId;
            await setDoc(userRef, update, { merge: true });
            console.log('DataLogger: Prolific/Qualtrics IDs saved to database');
        } catch (error) {
            console.error('DataLogger: Error saving prolific data:', error);
        }
    }

    /**
     * Core logging function
     * @param {string} eventType
     * @param {object} eventData
     */
    async logEvent(eventType, eventData = {}) {
        // Skip logging in sandbox mode
        if (window.experimentManager?.sandboxMode) {
            return;
        }

        if (!this.isFirebaseReady || !this.currentUserId) {
            console.log(`DataLogger: Queueing event: ${eventType} (offline or not authenticated)`);
            this.eventQueue.push({ eventType, eventData });

            // Save queue to localStorage as backup
            try {
                const queueData = JSON.stringify(this.eventQueue.slice(-100)); // Keep last 100 events
                localStorage.setItem('dataLogger_eventQueue', queueData);
            } catch (e) {
                console.warn('DataLogger: Could not save event queue to localStorage');
            }

            return;
        }

        try {
            const { isExperiment, levelPhase } = this.getLevelPhaseInfo(eventData.levelId || this.sessionData.currentLevel);

            const logEntry = {
                eventType: eventType,
                timestamp: serverTimestamp(),
                localTime: new Date().toISOString(),
                currentLevel: this.sessionData.currentLevel || null,
                experimentalGroup: this.currentCondition || null,
                participantId: this.sessionData.participantId || null,
                isExperiment: isExperiment,
                levelPhase: levelPhase,
                ...eventData
            };

            // Deep clean to remove all undefined values (Firestore doesn't support them)
            const cleanedEntry = this.deepClean(logEntry);

            await addDoc(collection(this.db, `${this.participantsCollection}/${this.currentUserId}/${this.eventsCollection}`), cleanedEntry);
            // console.log(`DataLogger: Logged ${eventType}`);
        } catch (error) {
            console.error("DataLogger: Logging error:", error);
            
            // Re-queue event if it failed (network issue during write)
            if (error.code === 'unavailable' || error.message.includes('network')) {
                console.log(`DataLogger: Re-queueing event due to network error: ${eventType}`);
                this.eventQueue.push({ eventType, eventData });
            }
        }
    }
    
    /**
     * Look up whether a level is part of the experimental dataset or a tutorial/practice level.
     * Reads the level's `isExperiment` flag (default true) via the global LevelManager registry
     * so every logged event can be filtered by phase without a separate level-ID lookup table.
     * @param {string} levelId
     * @returns {{isExperiment: boolean, levelPhase: 'tutorial'|'experimental'}}
     */
    getLevelPhaseInfo(levelId) {
        const config = levelId ? window.LevelManager?.levels?.[levelId] : null;
        const isExperiment = config?.isExperiment !== false;
        return {
            isExperiment,
            levelPhase: isExperiment ? 'experimental' : 'tutorial'
        };
    }

    /**
     * Recursively remove undefined and null values from objects and arrays
     * @param {*} obj - Object to clean
     * @returns {*} Cleaned object
     */
    deepClean(obj) {
        if (obj === null || obj === undefined) {
            return null;
        }
        
        if (Array.isArray(obj)) {
            return obj
                .map(item => this.deepClean(item))
                .filter(item => item !== null && item !== undefined);
        }
        
        if (typeof obj === 'object' && obj !== null) {
            // Handle Firestore Timestamp objects - don't clean them
            if (obj.constructor && obj.constructor.name === 'Timestamp') {
                return obj;
            }
            
            const cleaned = {};
            for (const [key, value] of Object.entries(obj)) {
                const cleanedValue = this.deepClean(value);
                if (cleanedValue !== null && cleanedValue !== undefined) {
                    cleaned[key] = cleanedValue;
                }
            }
            return cleaned;
        }
        
        return obj;
    }

    /**
     * Log level start
     */
    async logLevelStart(levelId) {
        this.sessionData.currentLevel = levelId;
        
        if (!this.sessionData.levels[levelId]) {
            this.sessionData.levels[levelId] = {
                startTime: Date.now(),
                runCount: 0,
                chatMessages: []
            };
        }
        
        // Reset run count for this level if not exists
        if (this.sessionData.runCounts[levelId] === undefined) {
            this.sessionData.runCounts[levelId] = 0;
        }

        await this.logEvent('level_start', {
            levelId: levelId
        });
    }

    /**
     * Log level completion
     */
    async logLevelComplete(levelId, success, metrics = {}) {
        const levelData = this.sessionData.levels[levelId];
        const timeSpent = levelData ? Date.now() - levelData.startTime : 0;
        
        const data = {
            levelId: levelId,
            success: success,
            timeSpentMs: timeSpent,
            timeSpentSeconds: Math.round(timeSpent / 1000),
            runCount: this.sessionData.runCounts[levelId] || 0,
            ...metrics
        };

        // Update local session tracking
        if (levelData) {
            levelData.completed = true;
            levelData.timeSpent = timeSpent;
            levelData.success = success;
        }

        await this.logEvent('level_complete', data);
    }

    /**
     * Log code execution (Run button)
     * @param {string} levelId 
     * @param {string|object} blocklyCode - The code or workspace state
     */
    async logRun(levelId, blocklyCode) {
        this.sessionData.runCounts[levelId] = (this.sessionData.runCounts[levelId] || 0) + 1;
        
        await this.logEvent('run_simulation', {
            levelId: levelId,
            runNumber: this.sessionData.runCounts[levelId],
            codeSnapshot: blocklyCode
        });
    }

    /**
     * Log chat message and update full conversation history
     */
    async logChatMessage(role, content, levelId) {
        const entry = {
            role, 
            content,
            timestamp: new Date().toISOString(),
            levelId: levelId || this.sessionData.currentLevel
        };
        
        if (this.sessionData.levels[entry.levelId]) {
            this.sessionData.levels[entry.levelId].chatMessages.push(entry);
        } else {
            this.sessionData.chatHistory.push(entry);
        }

        // Log individual message as event
        await this.logEvent('chat_message', entry);
        
        // Also update the full conversation in participant document
        await this.updateChatHistory(entry.levelId);
    }
    
    /**
     * Update full chat conversation history in participant document
     * This provides easy access to complete conversations per level
     */
    async updateChatHistory(levelId) {
        if (!this.currentUserId || !levelId) return;
        
        try {
            const userRef = doc(this.db, this.participantsCollection, this.currentUserId);
            const levelMessages = this.sessionData.levels[levelId]?.chatMessages || [];
            
            await updateDoc(userRef, {
                [`chatConversations.${levelId}`]: {
                    messages: levelMessages,
                    lastUpdated: serverTimestamp(),
                    messageCount: levelMessages.length
                }
            });
        } catch (error) {
            console.error("DataLogger: Error updating chat history:", error);
        }
    }

    /**
     * Log survey submission
     */
    async logSurvey(surveyId, responses) {
        await this.logEvent('survey_submission', {
            surveyId,
            responses
        });

        // Also update the main participant doc with survey data
        if (this.currentUserId) {
            try {
                const userRef = doc(this.db, this.participantsCollection, this.currentUserId);
                await updateDoc(userRef, {
                    [`surveys.${surveyId}`]: {
                        responses,
                        completedAt: serverTimestamp()
                    }
                });
            } catch (e) {
                console.error("DataLogger: Error updating participant survey data:", e);
            }
        }
    }
    
    /**
     * Log collision events when player attempts to move into an obstacle
     * @param {string} levelId - Current level ID
     * @param {string} collisionType - Type of collision: 'boundary', 'conveyor', 'box', 'wall', 'object'
     * @param {Object} details - Additional collision details
     * @param {number} details.playerRow - Player's current row
     * @param {number} details.playerCol - Player's current column
     * @param {string} details.playerDirection - Player's current direction
     * @param {number} details.targetRow - Attempted target row
     * @param {number} details.targetCol - Attempted target column
     * @param {string} [details.objectId] - ID of object collided with (if applicable)
     */
    async logCollision(levelId, collisionType, details = {}) {
        await this.logEvent('collision', {
            levelId,
            collisionType,
            ...details
        });
    }
    
    /**
     * Log workspace changes (for detailed interaction analysis)
     */
    async logWorkspaceChange(levelId, changeType, blockType = null) {
        await this.logEvent('workspace_change', {
            levelId,
            changeType, // 'create', 'delete', 'move', 'edit'
            blockType
        });
    }
    
    /**
     * Log UI interactions
     */
    async logUIAction(actionType, target, context = {}) {
        await this.logEvent('ui_action', {
            actionType, // 'click', 'focus', 'scroll', etc.
            target, // element identifier
            ...context
        });
    }
    
    /**
     * Log errors or failures
     */
    async logError(errorType, message, context = {}) {
        await this.logEvent('error', {
            errorType,
            message,
            ...context
        });
    }
    
    /**
     * Log drop actions (placing objects on conveyor or floor)
     * @param {string} levelId - Current level ID
     * @param {Object} details - Drop details
     * @param {number} details.dropRow - Row where item was dropped
     * @param {number} details.dropCol - Column where item was dropped
     * @param {boolean} details.onConveyor - Whether dropped on conveyor (true) or floor (false)
     * @param {string} [details.objectId] - ID of dropped object
     * @param {string} [details.objectType] - Type of dropped object
     * @param {string} [details.conveyorId] - ID of conveyor if dropped on one
     */
    async logDrop(levelId, details = {}) {
        await this.logEvent('drop_action', {
            levelId,
            ...details
        });
    }
    
    /**
     * Mark experiment as complete and update participant document
     */
    async completeExperiment() {
        if (!this.currentUserId) return;
        
        const totalTime = Date.now() - this.experimentStartTime;
        
        try {
            const userRef = doc(this.db, this.participantsCollection, this.currentUserId);
            await updateDoc(userRef, {
                status: 'completed',
                completionTime: serverTimestamp(),
                totalTimeMs: totalTime,
                totalTimeSeconds: Math.round(totalTime / 1000),
                totalTimeMinutes: Math.round(totalTime / 60000)
            });
            
            await this.logEvent('experiment_complete', {
                totalTimeMs: totalTime,
                totalTimeSeconds: Math.round(totalTime / 1000),
                totalTimeMinutes: Math.round(totalTime / 60000),
                levelsCompleted: Object.keys(this.sessionData.levels).length
            });
            
            console.log('DataLogger: Experiment marked complete');
        } catch (error) {
            console.error("DataLogger: Error completing experiment:", error);
        }
    }

    /**
     * Record that a participant voluntarily quit the study before completing it.
     * Always logs a `participant_quit` event (through the normal auto-queueing
     * `logEvent` pipeline, so it's captured even if currently offline), and
     * best-effort updates the participant document with quit status, the level
     * they quit on, and total time spent — unless the experiment was already
     * marked `completed`, in which case the completed record is left alone.
     * @param {string|null} levelId - The level the participant was on when they quit
     * @returns {Promise<{levelId: string|null, quitTimeMs: number, quitTimeSeconds: number, quitTimeMinutes: number}>}
     */
    async logQuit(levelId) {
        const totalTime = Date.now() - (this.experimentStartTime || Date.now());
        const quitInfo = {
            levelId: levelId || this.sessionData.currentLevel || null,
            quitTimeMs: totalTime,
            quitTimeSeconds: Math.round(totalTime / 1000),
            quitTimeMinutes: Math.round(totalTime / 60000)
        };

        await this.logEvent('participant_quit', quitInfo);

        if (!this.currentUserId) return quitInfo;

        try {
            const userRef = doc(this.db, this.participantsCollection, this.currentUserId);
            const docSnap = await getDoc(userRef);

            if (docSnap.exists() && docSnap.data().status === 'completed') {
                console.warn('DataLogger: Ignoring quit — experiment was already marked completed.');
                return quitInfo;
            }

            await updateDoc(userRef, {
                status: 'quit',
                quitTime: serverTimestamp(),
                quitLevelId: quitInfo.levelId,
                totalTimeMs: totalTime,
                totalTimeSeconds: quitInfo.quitTimeSeconds,
                totalTimeMinutes: quitInfo.quitTimeMinutes
            });

            console.log('DataLogger: Participant quit recorded:', quitInfo);
        } catch (error) {
            console.error("DataLogger: Error recording quit:", error);
        }

        return quitInfo;
    }
}

// Export singleton
const dataLogger = new DataLogger();
export default dataLogger;
