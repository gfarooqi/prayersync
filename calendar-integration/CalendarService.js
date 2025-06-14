/**
 * Abstract CalendarService Interface
 * 
 * This class defines the contract that all calendar provider adapters must implement.
 * It provides a consistent API for calendar operations regardless of the underlying provider
 * (Google Calendar, Microsoft Graph, etc.).
 * 
 * Design Principle: The CalendarService adapter is a "dumb" layer responsible only for 
 * translating our app's generic commands into provider-specific API calls. Application 
 * logic should live in higher-level manager classes like PrayerSyncManager.
 */
export class CalendarService {
    
    // --- Authentication & State ---
    
    /**
     * Handles the entire OAuth flow for the calendar provider
     * @returns {Promise<boolean>} true on successful authentication
     */
    async connect() {
        throw new Error('connect() must be implemented by subclass');
    }
    
    /**
     * Revokes tokens and clears local authentication state
     * @returns {Promise<void>}
     */
    async disconnect() {
        throw new Error('disconnect() must be implemented by subclass');
    }
    
    /**
     * Synchronous check for current authentication status
     * @returns {boolean} true if currently connected and authenticated
     */
    isConnected() {
        throw new Error('isConnected() must be implemented by subclass');
    }
    
    /**
     * Get information about the currently connected user
     * @returns {Object|null} {email: string, name: string} or null if not connected
     */
    getConnectedUser() {
        throw new Error('getConnectedUser() must be implemented by subclass');
    }
    
    /**
     * Get the name of the calendar provider
     * @returns {string} e.g., 'Google', 'Microsoft'
     */
    getProviderName() {
        throw new Error('getProviderName() must be implemented by subclass');
    }

    // --- Core Event CRUD ---
    // Note: All date arguments should be ISO 8601 strings for timezone safety

    /**
     * Creates a single calendar event
     * @param {Object} eventData - Event data in standardized format
     * @returns {Promise<Object>} The created event object with provider-specific ID
     */
    async createEvent(eventData) {
        throw new Error('createEvent() must be implemented by subclass');
    }

    /**
     * Fetches calendar events between two dates
     * @param {string} startDate - ISO 8601 date string
     * @param {string} endDate - ISO 8601 date string  
     * @returns {Promise<Array>} Array of event objects
     */
    async getEvents(startDate, endDate) {
        throw new Error('getEvents() must be implemented by subclass');
    }

    /**
     * Updates an existing calendar event
     * @param {string} eventId - Provider-specific event ID
     * @param {Object} eventData - Updated event data
     * @returns {Promise<Object>} The updated event object
     */
    async updateEvent(eventId, eventData) {
        throw new Error('updateEvent() must be implemented by subclass');
    }

    /**
     * Deletes a calendar event
     * @param {string} eventId - Provider-specific event ID
     * @returns {Promise<void>}
     */
    async deleteEvent(eventId) {
        throw new Error('deleteEvent() must be implemented by subclass');
    }

    // --- Batch Operations ---
    // Essential for performance and avoiding rate limits

    /**
     * Creates multiple calendar events in a single operation
     * @param {Array} eventsArray - Array of event data objects
     * @returns {Promise<Array>} Array of created event objects with provider-specific IDs
     */
    async createBatchEvents(eventsArray) {
        throw new Error('createBatchEvents() must be implemented by subclass');
    }

    /**
     * Deletes multiple calendar events in a single operation
     * @param {Array} eventIds - Array of provider-specific event IDs
     * @returns {Promise<void>}
     */
    async deleteBatchEvents(eventIds) {
        throw new Error('deleteBatchEvents() must be implemented by subclass');
    }

    // --- Advanced Capabilities (Optional) ---

    /**
     * Fetches free/busy information for efficient conflict checking
     * @param {string} startDate - ISO 8601 date string
     * @param {string} endDate - ISO 8601 date string
     * @returns {Promise<Array>} Array of busy time blocks
     */
    async getFreeBusy(startDate, endDate) {
        // Default implementation - can be overridden for more efficient provider-specific methods
        const events = await this.getEvents(startDate, endDate);
        return events.map(event => ({
            start: event.startTime,
            end: event.endTime
        }));
    }

    /**
     * Returns capabilities supported by this provider
     * @returns {Object} Object describing supported features
     */
    getCapabilities() {
        return {
            batchCreate: false,
            batchDelete: false,
            freeBusy: false,
            recurrence: false,
            reminders: false
        };
    }
}

/**
 * Standard eventData format for all calendar providers:
 * 
 * {
 *   title: string,                    // Event title
 *   startTime: string,                // ISO 8601 datetime string
 *   endTime: string,                  // ISO 8601 datetime string  
 *   description: string,              // Event description
 *   visibility: 'private'|'public'|'default', // Event visibility
 *   
 *   // PrayerSync-specific metadata stored in provider's custom fields
 *   prayerSyncMetadata: {
 *     app: 'PrayerSync',              // App identifier
 *     version: '1.0',                 // App version
 *     prayer: 'fajr'|'dhuhr'|'asr'|'maghrib'|'isha', // Prayer type
 *     calculationMethod: string       // e.g., 'ISNA', 'MWL'
 *   }
 * }
 */