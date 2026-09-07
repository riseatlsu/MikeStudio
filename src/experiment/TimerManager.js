/**
 * @fileoverview TimerManager - Enforces a session time limit starting when the
 * participant accepts the consent form. Shows a live countdown in the header
 * and, when time runs out, tells participants it's not a problem and routes
 * them straight to the closing survey. Persists the deadline (not a countdown)
 * in localStorage so a page refresh mid-session doesn't grant extra time or
 * lose track of an already-expired session.
 *
 * Applies only to real study sessions - every entry point is gated on
 * `experimentManager.sandboxMode` so researchers previewing levels in
 * /sandbox never see or trigger it, even if the same browser has a real
 * session's timer state saved in localStorage.
 * @module experiment/TimerManager
 */

// Change this single value to adjust the session time limit for all participants.
export const TIME_LIMIT_MINUTES = 60;

const STORAGE_KEYS = {
    expiresAt: 'pair_studio_timer_expires_at',
    acknowledged: 'pair_studio_timer_acknowledged'
};

// Show the countdown in a warning color once this little time is left.
const LOW_TIME_THRESHOLD_MS = 5 * 60 * 1000;

export class TimerManager {
    constructor() {
        this.intervalId = null;
        this.expiresAt = null;
    }

    /**
     * Wire up the "time's up" modal and resume any in-progress timer found in
     * localStorage (e.g. after a page refresh). Safe to call once at startup
     * regardless of whether the participant has consented yet.
     */
    init() {
        const okBtn = document.getElementById('time-up-ok-btn');
        if (okBtn) {
            okBtn.addEventListener('click', () => this.acknowledge());
        }

        if (this._isSandbox()) return;

        const stored = localStorage.getItem(STORAGE_KEYS.expiresAt);
        if (stored) {
            this.expiresAt = parseInt(stored, 10);
            this.schedule();
        }
    }

    /**
     * Start (or restart) the session timer. Called once, right when the
     * participant accepts consent.
     */
    start(durationMinutes = TIME_LIMIT_MINUTES) {
        if (this._isSandbox()) return;

        this.expiresAt = Date.now() + durationMinutes * 60 * 1000;
        localStorage.setItem(STORAGE_KEYS.expiresAt, String(this.expiresAt));
        localStorage.removeItem(STORAGE_KEYS.acknowledged);
        this.schedule();
    }

    /**
     * Stop the timer without showing the expiration message - used once the
     * participant naturally reaches the survey before time runs out.
     */
    stop() {
        this._clearInterval();
        localStorage.setItem(STORAGE_KEYS.acknowledged, 'true');
        this._hideDisplay();
    }

    schedule() {
        if (this._isSandbox() || !this.expiresAt) return;

        if (this._alreadyHandled()) {
            this._hideDisplay();
            return;
        }

        this._clearInterval();
        this._tick();
        this.intervalId = setInterval(() => this._tick(), 1000);
    }

    _tick() {
        if (this._isSandbox() || this._alreadyHandled()) {
            this._clearInterval();
            this._hideDisplay();
            return;
        }

        const remaining = this.expiresAt - Date.now();
        this._updateDisplay(remaining);

        if (remaining <= 0) {
            this._clearInterval();
            this.showExpiredModal();
        }
    }

    _clearInterval() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    _alreadyHandled() {
        if (localStorage.getItem(STORAGE_KEYS.acknowledged) === 'true') return true;
        return localStorage.getItem('pair_studio_current_level') === 'survey_final';
    }

    _isSandbox() {
        return Boolean(window.experimentManager && window.experimentManager.sandboxMode);
    }

    _updateDisplay(remainingMs) {
        const el = document.getElementById('session-timer');
        const text = document.getElementById('session-timer-text');
        if (!el || !text) return;

        const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        text.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;

        el.style.display = 'flex';
        el.classList.toggle('session-timer-low', remainingMs <= LOW_TIME_THRESHOLD_MS);
    }

    _hideDisplay() {
        const el = document.getElementById('session-timer');
        if (el) el.style.display = 'none';
    }

    showExpiredModal() {
        if (this._isSandbox() || this._alreadyHandled()) return;

        if (window.dataLogger) {
            const levelId = localStorage.getItem('pair_studio_current_level');
            window.dataLogger.logEvent('time_limit_reached', { levelId });
        }

        const modal = document.getElementById('time-up-modal-overlay');
        if (modal) modal.classList.add('show');
    }

    acknowledge() {
        localStorage.setItem(STORAGE_KEYS.acknowledged, 'true');
        this._clearInterval();
        this._hideDisplay();

        const modal = document.getElementById('time-up-modal-overlay');
        if (modal) modal.classList.remove('show');

        this._goToSurvey();
    }

    _goToSurvey(attempt = 0) {
        if (window.LevelManager) {
            window.LevelManager.loadLevelById('survey_final');
        } else if (attempt < 50) {
            // LevelManager registers itself asynchronously with the Phaser
            // scene - keep retrying briefly rather than dropping the navigation.
            setTimeout(() => this._goToSurvey(attempt + 1), 200);
        }
    }
}

export const timerManager = new TimerManager();
window.timerManager = timerManager;
