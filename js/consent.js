/**
 * Consent and User ID Management
 * Handles user consent, participant ID generation, and cookie management
 */

class ConsentManager {
  constructor() {
    this.cookieName = 'mikebot_participant_id';
    this.cookieExpireDays = 365; // 1 year
  }

  /**
   * Generate a unique participant ID
   * Format: YYYYMMDD-HHMMSS-RANDOM
   */
  generateParticipantId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    return `${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
  }

  /**
   * Set a cookie
   */
  setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
  }

  /**
   * Get a cookie value
   */
  getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  /**
   * Check if user has already consented
   */
  hasConsented() {
    return this.getCookie(this.cookieName) !== null;
  }

  /**
   * Get existing participant ID or null
   */
  getParticipantId() {
    return this.getCookie(this.cookieName);
  }

  /**
   * Create or retrieve participant ID
   */
  processConsent() {
    let participantId = this.getParticipantId();
    
    if (!participantId) {
      // Generate new ID
      participantId = this.generateParticipantId();
      this.setCookie(this.cookieName, participantId, this.cookieExpireDays);
      console.log('New participant ID created:', participantId);
    } else {
      console.log('Existing participant ID:', participantId);
    }
    
    return participantId;
  }

  /**
   * Log consent event
   */
  logConsent(participantId) {
    const consentData = {
      participantId: participantId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`
    };
    
    console.log('Consent logged:', consentData);
    
    // Store in localStorage for tracking
    try {
      const consentLog = JSON.parse(localStorage.getItem('consent_log') || '[]');
      consentLog.push(consentData);
      localStorage.setItem('consent_log', JSON.stringify(consentLog));
    } catch (e) {
      console.error('Error logging consent:', e);
    }
    
    return consentData;
  }
}

// Initialize consent manager
window.ConsentManager = new ConsentManager();
