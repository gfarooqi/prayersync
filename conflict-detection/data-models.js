/**
 * Data Models for Smart Conflict Detection & Resolution
 * 
 * Defines the standardized data structures used across all conflict detection
 * components to ensure type safety and clear contracts.
 */

/**
 * Normalized calendar event (output from CalendarService)
 * @typedef {Object} CalendarEvent
 * @property {string} id - Unique event identifier
 * @property {string} start - ISO 8601 datetime string
 * @property {string} end - ISO 8601 datetime string  
 * @property {string} status - "busy" | "free" | "tentative" | "outOfOffice"
 * @property {string} subject - Event title/summary
 * @property {boolean} isPrivate - Whether event details are private
 * @property {string} [location] - Optional location
 * @property {string} [description] - Optional description
 * @property {Object} [originalData] - Original API response for debugging
 */

/**
 * Prayer time window for conflict detection
 * @typedef {Object} PrayerWindow
 * @property {string} name - Prayer name (Fajr, Dhuhr, Asr, Maghrib, Isha)
 * @property {string} startTime - ISO 8601 datetime when prayer window begins
 * @property {string} endTime - ISO 8601 datetime when prayer window ends
 * @property {boolean} isCurrent - Whether this is the current prayer time
 * @property {number} preferredStartMinutes - Minutes after startTime for optimal prayer (default: 0)
 */

/**
 * Detected conflict between prayer and calendar events
 * @typedef {Object} Conflict
 * @property {string} prayerName - Name of conflicting prayer
 * @property {PrayerWindow} prayerWindow - Full prayer time window
 * @property {CalendarEvent[]} conflictingEvents - Array of overlapping busy events
 * @property {Object} analysis - Detailed conflict analysis
 * @property {number} analysis.totalBusyMinutes - Minutes blocked by meetings
 * @property {number} analysis.largestAvailableSlot - Largest continuous free slot (minutes)
 * @property {number} analysis.requiredMinutes - Minutes needed for prayer + buffer
 * @property {string} analysis.conflictSeverity - "complete" | "partial" | "minor"
 */

/**
 * Smart suggestion for resolving conflicts
 * @typedef {Object} Suggestion
 * @property {string} id - Unique suggestion identifier
 * @property {string} type - Suggestion type
 * @property {string} displayText - User-friendly description
 * @property {Object} newPrayerTime - Suggested prayer time
 * @property {string} newPrayerTime.start - ISO 8601 datetime
 * @property {string} newPrayerTime.end - ISO 8601 datetime
 * @property {number} priority - Suggestion ranking (1 = highest priority)
 * @property {Object} reasoning - Why this suggestion was made
 * @property {string} reasoning.rationale - Brief explanation
 * @property {number} reasoning.confidenceScore - 0-100 confidence in suggestion
 * @property {boolean} reasoning.preservesOnTime - Whether prayer is still on time
 */

/**
 * Suggestion types enum
 */
export const SuggestionTypes = {
    PRAY_BEFORE: 'PRAY_BEFORE',           // Pray before conflicting meeting
    PRAY_AFTER: 'PRAY_AFTER',             // Pray after conflicting meeting  
    PRAY_EARLIEST: 'PRAY_EARLIEST',       // Pray at start of window
    PRAY_BETWEEN: 'PRAY_BETWEEN',         // Pray in gap between meetings
    PRAY_LATEST: 'PRAY_LATEST',           // Pray at end of window
    COMBINE_PRAYERS: 'COMBINE_PRAYERS'    // Combine with next prayer (travelers)
};

/**
 * Conflict severity levels
 */
export const ConflictSeverity = {
    COMPLETE: 'complete',    // No time available in prayer window
    PARTIAL: 'partial',      // Some time available but challenging
    MINOR: 'minor'           // Plenty of time available with minor adjustments
};

/**
 * Calendar event statuses (normalized across providers)
 */
export const EventStatus = {
    BUSY: 'busy',
    FREE: 'free', 
    TENTATIVE: 'tentative',
    OUT_OF_OFFICE: 'outOfOffice'
};

/**
 * User configuration for conflict detection
 * @typedef {Object} ConflictConfig
 * @property {number} prayerDuration - Prayer duration in minutes (default: 15)
 * @property {number} bufferTime - Buffer before/after prayer in minutes (default: 5)
 * @property {boolean} considerTentative - Whether to treat tentative events as conflicts (default: false)
 * @property {number} minimumSlotSize - Minimum acceptable prayer slot in minutes (default: 10)
 * @property {string[]} ignoredEventPatterns - Event titles to ignore (e.g., ["Lunch", "Break"])
 * @property {boolean} travelMode - Whether user is traveling (enables prayer combining)
 */

/**
 * Default configuration values
 */
export const DefaultConflictConfig = {
    prayerDuration: 15,        // 15 minutes for prayer
    bufferTime: 5,             // 5 minutes buffer for preparation/ablution
    considerTentative: false,   // Don't block on tentative meetings
    minimumSlotSize: 10,       // Need at least 10 minutes
    ignoredEventPatterns: ['lunch', 'break', 'personal time'],
    travelMode: false
};

/**
 * Validation helpers for data models
 */
export class DataValidation {
    /**
     * Validate CalendarEvent object
     * @param {Object} event - Event to validate
     * @returns {boolean} True if valid
     */
    static isValidCalendarEvent(event) {
        return event &&
               typeof event.id === 'string' &&
               typeof event.start === 'string' &&
               typeof event.end === 'string' &&
               Object.values(EventStatus).includes(event.status) &&
               typeof event.subject === 'string' &&
               typeof event.isPrivate === 'boolean';
    }
    
    /**
     * Validate PrayerWindow object
     * @param {Object} prayer - Prayer window to validate
     * @returns {boolean} True if valid
     */
    static isValidPrayerWindow(prayer) {
        const validNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        return prayer &&
               validNames.includes(prayer.name) &&
               typeof prayer.startTime === 'string' &&
               typeof prayer.endTime === 'string' &&
               new Date(prayer.startTime) < new Date(prayer.endTime);
    }
    
    /**
     * Validate Conflict object
     * @param {Object} conflict - Conflict to validate
     * @returns {boolean} True if valid
     */
    static isValidConflict(conflict) {
        return conflict &&
               typeof conflict.prayerName === 'string' &&
               this.isValidPrayerWindow(conflict.prayerWindow) &&
               Array.isArray(conflict.conflictingEvents) &&
               conflict.conflictingEvents.every(e => this.isValidCalendarEvent(e)) &&
               conflict.analysis &&
               typeof conflict.analysis.totalBusyMinutes === 'number';
    }
    
    /**
     * Validate Suggestion object
     * @param {Object} suggestion - Suggestion to validate
     * @returns {boolean} True if valid
     */
    static isValidSuggestion(suggestion) {
        return suggestion &&
               typeof suggestion.id === 'string' &&
               Object.values(SuggestionTypes).includes(suggestion.type) &&
               typeof suggestion.displayText === 'string' &&
               suggestion.newPrayerTime &&
               typeof suggestion.newPrayerTime.start === 'string' &&
               typeof suggestion.newPrayerTime.end === 'string' &&
               typeof suggestion.priority === 'number' &&
               suggestion.reasoning &&
               typeof suggestion.reasoning.rationale === 'string';
    }
}

/**
 * Utility functions for working with data models
 */
export class DataUtils {
    /**
     * Convert minutes to milliseconds
     * @param {number} minutes 
     * @returns {number} Milliseconds
     */
    static minutesToMs(minutes) {
        return minutes * 60 * 1000;
    }
    
    /**
     * Get duration between two datetime strings in minutes
     * @param {string} start - ISO 8601 datetime
     * @param {string} end - ISO 8601 datetime
     * @returns {number} Duration in minutes
     */
    static getDurationMinutes(start, end) {
        return (new Date(end) - new Date(start)) / (1000 * 60);
    }
    
    /**
     * Check if two time ranges overlap
     * @param {Object} range1 - {start, end}
     * @param {Object} range2 - {start, end}
     * @returns {boolean} True if overlapping
     */
    static rangesOverlap(range1, range2) {
        const start1 = new Date(range1.start);
        const end1 = new Date(range1.end);
        const start2 = new Date(range2.start);
        const end2 = new Date(range2.end);
        
        return start1 < end2 && start2 < end1;
    }
    
    /**
     * Add minutes to a datetime string
     * @param {string} datetime - ISO 8601 datetime
     * @param {number} minutes - Minutes to add
     * @returns {string} New ISO 8601 datetime
     */
    static addMinutes(datetime, minutes) {
        const date = new Date(datetime);
        date.setMinutes(date.getMinutes() + minutes);
        return date.toISOString();
    }
    
    /**
     * Create a normalized CalendarEvent from API response
     * @param {Object} apiEvent - Raw API event data
     * @param {string} provider - "google" | "microsoft"
     * @returns {CalendarEvent} Normalized event
     */
    static normalizeCalendarEvent(apiEvent, provider) {
        // This will be implemented based on specific API responses
        // For now, return a template structure
        return {
            id: apiEvent.id || 'unknown',
            start: apiEvent.start || new Date().toISOString(),
            end: apiEvent.end || new Date().toISOString(),
            status: EventStatus.BUSY,
            subject: apiEvent.subject || apiEvent.summary || 'Untitled Event',
            isPrivate: apiEvent.isPrivate || false,
            location: apiEvent.location,
            description: apiEvent.description,
            originalData: apiEvent
        };
    }
}