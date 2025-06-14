/**
 * Google Calendar Adapter for PrayerSync
 * 
 * Implements the CalendarService interface using Google Calendar API and Google Identity Services.
 * Handles OAuth authentication, session persistence, and calendar event operations.
 */

import { GOOGLE_CLIENT_ID, API_CONFIG } from './config.js';
import { CalendarService } from './CalendarService.js';

// Promise-based Google Identity Services script loader
let gisScriptPromise = null;

/**
 * Loads the Google Identity Services script dynamically
 * @returns {Promise<void>} Resolves when script is loaded and ready
 */
function loadGisScript() {
    if (gisScriptPromise) {
        return gisScriptPromise;
    }
    
    gisScriptPromise = new Promise((resolve, reject) => {
        // Check if script is already loaded
        if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
            // Script tag exists, check if Google services are available
            if (typeof google !== 'undefined' && google.accounts) {
                return resolve();
            }
            // Script exists but not loaded yet, wait a bit and check again
            setTimeout(() => {
                if (typeof google !== 'undefined' && google.accounts) {
                    resolve();
                } else {
                    reject(new Error('Google Identity Services script loaded but API not available'));
                }
            }, 100);
            return;
        }
        
        // Load the script
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            // Wait a moment for the API to become available
            setTimeout(() => {
                if (typeof google !== 'undefined' && google.accounts) {
                    resolve();
                } else {
                    reject(new Error('Google Identity Services script loaded but API not available'));
                }
            }, 100);
        };
        script.onerror = () => reject(new Error('Failed to load Google Identity Services script'));
        document.head.appendChild(script);
    });
    
    return gisScriptPromise;
}

export class GoogleCalendarAdapter extends CalendarService {
    #tokenClient = null;
    #accessToken = null;
    #user = null;
    #isConnected = false;

    constructor() {
        super();
        // Restore session if available
        this.#restoreSession();
    }

    // --- Authentication & State ---

    /**
     * Handles the complete Google OAuth flow
     * @returns {Promise<boolean>} true on successful authentication
     */
    async connect() {
        try {
            // Load Google Identity Services
            await loadGisScript();

            return new Promise((resolve, reject) => {
                // Initialize the OAuth token client
                this.#tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_CLIENT_ID,
                    scope: API_CONFIG.GOOGLE_SCOPES,
                    callback: async (tokenResponse) => {
                        if (tokenResponse.error) {
                            console.error('OAuth error:', tokenResponse.error);
                            return reject(new Error(`OAuth failed: ${tokenResponse.error}`));
                        }
                        
                        this.#accessToken = tokenResponse.access_token;
                        
                        // Verify the token and get user info
                        const userInfo = await this.#fetchUserInfo();
                        if (userInfo) {
                            this.#user = { 
                                email: userInfo.email, 
                                name: userInfo.name || userInfo.email.split('@')[0]
                            };
                            this.#isConnected = true;
                            
                            // Store token and user info for session persistence
                            this.#saveSession();
                            
                            console.log('Successfully connected to Google Calendar:', this.#user.email);
                            resolve(true);
                        } else {
                            reject(new Error('Could not fetch user information'));
                        }
                    },
                });

                // If we have a stored token from a previous session, try to use it first
                const storedToken = this.#getStoredToken();
                if (storedToken) {
                    this.#accessToken = storedToken;
                    
                    // Test if the stored token is still valid
                    this.#fetchUserInfo().then(userInfo => {
                        if (userInfo) {
                            this.#user = { 
                                email: userInfo.email, 
                                name: userInfo.name || userInfo.email.split('@')[0]
                            };
                            this.#isConnected = true;
                            console.log('Restored Google Calendar session:', this.#user.email);
                            resolve(true);
                        } else {
                            // Stored token is invalid, request a new one
                            console.log('Stored token invalid, requesting new authorization');
                            this.#clearSession();
                            this.#tokenClient.requestAccessToken({ prompt: '' });
                        }
                    }).catch(() => {
                        // Error checking stored token, request new authorization
                        console.log('Error validating stored token, requesting new authorization');
                        this.#clearSession();
                        this.#tokenClient.requestAccessToken({ prompt: '' });
                    });
                } else {
                    // No stored token, request authorization
                    console.log('No stored token, requesting authorization');
                    this.#tokenClient.requestAccessToken({ prompt: 'select_account' });
                }
            });
        } catch (error) {
            console.error('Connection failed:', error);
            this.#clearSession();
            return false;
        }
    }

    /**
     * Disconnect from Google Calendar and clear all stored data
     * @returns {Promise<void>}
     */
    async disconnect() {
        try {
            // Revoke the access token if we have one
            if (this.#accessToken) {
                await fetch(`https://oauth2.googleapis.com/revoke?token=${this.#accessToken}`, {
                    method: 'POST',
                });
            }
        } catch (error) {
            console.warn('Error revoking token:', error);
        } finally {
            // Clear all local state regardless of revocation success
            this.#clearSession();
            console.log('Disconnected from Google Calendar');
        }
    }

    /**
     * Check if currently connected to Google Calendar
     * @returns {boolean}
     */
    isConnected() {
        return this.#isConnected && this.#accessToken && this.#user;
    }

    /**
     * Get information about the connected user
     * @returns {Object|null}
     */
    getConnectedUser() {
        return this.isConnected() ? { ...this.#user } : null;
    }

    /**
     * Get the provider name
     * @returns {string}
     */
    getProviderName() {
        return 'Google';
    }

    // --- Private Helper Methods ---

    /**
     * Fetch user information from Google to validate token
     * @returns {Promise<Object|null>}
     * @private
     */
    async #fetchUserInfo() {
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { 
                    'Authorization': `Bearer ${this.#accessToken}` 
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    // Token is invalid/expired
                    console.log('Access token is invalid or expired');
                    this.#clearSession();
                }
                return null;
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching user info:', error);
            return null;
        }
    }

    /**
     * Make an authenticated API call with automatic token refresh handling
     * @param {string} url - API endpoint URL
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>}
     * @private
     */
    async #makeApiCall(url, options = {}) {
        if (!this.#accessToken) {
            throw new Error('Not authenticated - call connect() first');
        }

        // Add authorization header
        const headers = {
            'Authorization': `Bearer ${this.#accessToken}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        // Handle token expiration
        if (response.status === 401) {
            console.log('Access token expired, attempting to refresh');
            this.#clearSession();
            
            // Try to get a new token silently
            if (this.#tokenClient) {
                return new Promise((resolve, reject) => {
                    this.#tokenClient.callback = async (tokenResponse) => {
                        if (tokenResponse.error) {
                            reject(new Error('Failed to refresh token'));
                            return;
                        }
                        
                        this.#accessToken = tokenResponse.access_token;
                        this.#saveSession();
                        
                        // Retry the original request with new token
                        const retryHeaders = {
                            'Authorization': `Bearer ${this.#accessToken}`,
                            'Content-Type': 'application/json',
                            ...options.headers
                        };
                        
                        const retryResponse = await fetch(url, {
                            ...options,
                            headers: retryHeaders
                        });
                        
                        resolve(retryResponse);
                    };
                    
                    this.#tokenClient.requestAccessToken({ prompt: '' });
                });
            } else {
                throw new Error('Token expired and no token client available for refresh');
            }
        }

        return response;
    }

    /**
     * Save authentication session to storage
     * @private
     */
    #saveSession() {
        const sessionData = {
            accessToken: this.#accessToken,
            user: this.#user,
            timestamp: Date.now()
        };
        
        sessionStorage.setItem(`${API_CONFIG.TOKEN_STORAGE_KEY}_google`, JSON.stringify(sessionData));
    }

    /**
     * Restore authentication session from storage
     * @private
     */
    #restoreSession() {
        try {
            const stored = sessionStorage.getItem(`${API_CONFIG.TOKEN_STORAGE_KEY}_google`);
            if (stored) {
                const sessionData = JSON.parse(stored);
                
                // Check if session hasn't expired (1 hour)
                if (Date.now() - sessionData.timestamp < API_CONFIG.SESSION_TIMEOUT) {
                    this.#accessToken = sessionData.accessToken;
                    this.#user = sessionData.user;
                    this.#isConnected = true;
                } else {
                    // Session expired, clear it
                    this.#clearSession();
                }
            }
        } catch (error) {
            console.warn('Error restoring session:', error);
            this.#clearSession();
        }
    }

    /**
     * Get stored access token
     * @returns {string|null}
     * @private
     */
    #getStoredToken() {
        try {
            const stored = sessionStorage.getItem(`${API_CONFIG.TOKEN_STORAGE_KEY}_google`);
            if (stored) {
                const sessionData = JSON.parse(stored);
                if (Date.now() - sessionData.timestamp < API_CONFIG.SESSION_TIMEOUT) {
                    return sessionData.accessToken;
                }
            }
        } catch (error) {
            console.warn('Error getting stored token:', error);
        }
        return null;
    }

    /**
     * Clear all stored session data
     * @private
     */
    #clearSession() {
        this.#accessToken = null;
        this.#user = null;
        this.#isConnected = false;
        sessionStorage.removeItem(`${API_CONFIG.TOKEN_STORAGE_KEY}_google`);
    }

    // --- Calendar Event Methods ---

    /**
     * Get user's primary calendar timezone
     * @returns {Promise<string>} Timezone string (e.g., 'America/New_York')
     * @private
     */
    async #getUserTimezone() {
        try {
            const response = await this.#makeApiCall(
                'https://www.googleapis.com/calendar/v3/calendars/primary'
            );
            
            if (response.ok) {
                const calendar = await response.json();
                return calendar.timeZone || 'UTC';
            }
        } catch (error) {
            console.warn('Failed to get user timezone, using UTC:', error);
        }
        return 'UTC';
    }

    /**
     * Transform our eventData format to Google Calendar API format
     * @param {Object} eventData - Our standard event data
     * @param {string} userTimezone - User's timezone
     * @returns {Object} Google Calendar API event object
     * @private
     */
    #transformToGoogleEvent(eventData, userTimezone = 'UTC') {
        const googleEvent = {
            summary: eventData.title,
            description: eventData.description,
            start: {
                dateTime: eventData.startTime, // ISO 8601 format
                timeZone: userTimezone,
            },
            end: {
                dateTime: eventData.endTime, // ISO 8601 format  
                timeZone: userTimezone,
            },
            visibility: eventData.visibility || 'default'
        };

        // Store our app-specific metadata in private extended properties
        if (eventData.prayerSyncMetadata) {
            googleEvent.extendedProperties = {
                private: {
                    prayerSync: JSON.stringify(eventData.prayerSyncMetadata)
                }
            };
        }

        return googleEvent;
    }

    /**
     * Transform Google Calendar event back to our format
     * @param {Object} googleEvent - Google Calendar API event
     * @returns {Object} Our standard event data format
     * @private
     */
    #transformFromGoogleEvent(googleEvent) {
        const eventData = {
            id: googleEvent.id,
            title: googleEvent.summary,
            description: googleEvent.description || '',
            startTime: googleEvent.start?.dateTime || googleEvent.start?.date,
            endTime: googleEvent.end?.dateTime || googleEvent.end?.date,
            visibility: googleEvent.visibility || 'default'
        };

        // Extract our metadata from extended properties
        if (googleEvent.extendedProperties?.private?.prayerSync) {
            try {
                eventData.prayerSyncMetadata = JSON.parse(
                    googleEvent.extendedProperties.private.prayerSync
                );
            } catch (error) {
                console.warn('Failed to parse PrayerSync metadata:', error);
            }
        }

        return eventData;
    }

    /**
     * Create a single calendar event
     * @param {Object} eventData - Event data in our standard format
     * @returns {Promise<Object>} The created event object with provider-specific ID
     */
    async createEvent(eventData) {
        const userTimezone = await this.#getUserTimezone();
        const googleEvent = this.#transformToGoogleEvent(eventData, userTimezone);
        
        const response = await this.#makeApiCall(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events',
            {
                method: 'POST',
                body: JSON.stringify(googleEvent)
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to create event: ${response.status} ${error}`);
        }

        const createdEvent = await response.json();
        return this.#transformFromGoogleEvent(createdEvent);
    }

    /**
     * Get events in a date range, optionally filtered to PrayerSync events only
     * @param {string} startDate - ISO 8601 date string
     * @param {string} endDate - ISO 8601 date string
     * @param {boolean} prayerSyncOnly - If true, only return events created by PrayerSync
     * @returns {Promise<Array>} Array of event objects
     */
    async getEvents(startDate, endDate, prayerSyncOnly = false) {
        const params = new URLSearchParams({
            timeMin: startDate,
            timeMax: endDate,
            singleEvents: 'true',
            orderBy: 'startTime'
        });

        // Filter to only PrayerSync events if requested
        if (prayerSyncOnly) {
            params.append('privateExtendedProperty', 'prayerSync');
        }

        const response = await this.#makeApiCall(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to get events: ${response.status} ${error}`);
        }

        const data = await response.json();
        const events = data.items || [];
        
        // Transform and filter events
        return events
            .map(event => this.#transformFromGoogleEvent(event))
            .filter(event => !prayerSyncOnly || event.prayerSyncMetadata);
    }

    /**
     * Update an existing calendar event
     * @param {string} eventId - Provider-specific event ID
     * @param {Object} eventData - Updated event data
     * @returns {Promise<Object>} The updated event object
     */
    async updateEvent(eventId, eventData) {
        const userTimezone = await this.#getUserTimezone();
        const googleEvent = this.#transformToGoogleEvent(eventData, userTimezone);
        
        const response = await this.#makeApiCall(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
            {
                method: 'PUT',
                body: JSON.stringify(googleEvent)
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to update event: ${response.status} ${error}`);
        }

        const updatedEvent = await response.json();
        return this.#transformFromGoogleEvent(updatedEvent);
    }

    /**
     * Delete a calendar event
     * @param {string} eventId - Provider-specific event ID
     * @returns {Promise<void>}
     */
    async deleteEvent(eventId) {
        const response = await this.#makeApiCall(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
            {
                method: 'DELETE'
            }
        );

        if (!response.ok && response.status !== 404) {
            const error = await response.text();
            throw new Error(`Failed to delete event: ${response.status} ${error}`);
        }
    }

    /**
     * Create multiple events with rate limiting and error handling
     * @param {Array} eventsArray - Array of event data objects
     * @returns {Promise<Array>} Array of created event objects with provider-specific IDs
     */
    async createBatchEvents(eventsArray) {
        const results = [];
        const errors = [];
        const DELAY_MS = 100; // Rate limiting delay between requests

        console.log(`Creating ${eventsArray.length} prayer events...`);

        for (let i = 0; i < eventsArray.length; i++) {
            try {
                const eventData = eventsArray[i];
                const createdEvent = await this.createEvent(eventData);
                results.push(createdEvent);
                
                // Progress feedback
                if ((i + 1) % 10 === 0) {
                    console.log(`Created ${i + 1}/${eventsArray.length} events`);
                }
                
                // Rate limiting delay (except for last request)
                if (i < eventsArray.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
                }
            } catch (error) {
                console.error(`Failed to create event ${i + 1}:`, error.message);
                errors.push({ index: i, event: eventsArray[i], error: error.message });
            }
        }

        console.log(`Batch creation completed: ${results.length} created, ${errors.length} failed`);
        
        if (errors.length > 0) {
            console.warn('Some events failed to create:', errors);
        }

        return results;
    }

    /**
     * Delete multiple events with rate limiting and error handling
     * @param {Array} eventIds - Array of provider-specific event IDs
     * @returns {Promise<void>}
     */
    async deleteBatchEvents(eventIds) {
        const errors = [];
        const DELAY_MS = 50; // Faster for deletions

        console.log(`Deleting ${eventIds.length} prayer events...`);

        for (let i = 0; i < eventIds.length; i++) {
            try {
                await this.deleteEvent(eventIds[i]);
                
                // Progress feedback
                if ((i + 1) % 10 === 0) {
                    console.log(`Deleted ${i + 1}/${eventIds.length} events`);
                }
                
                // Rate limiting delay (except for last request)
                if (i < eventIds.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
                }
            } catch (error) {
                console.error(`Failed to delete event ${eventIds[i]}:`, error.message);
                errors.push({ eventId: eventIds[i], error: error.message });
            }
        }

        console.log(`Batch deletion completed: ${eventIds.length - errors.length} deleted, ${errors.length} failed`);
        
        if (errors.length > 0) {
            console.warn('Some events failed to delete:', errors);
        }
    }

    getCapabilities() {
        return {
            batchCreate: true,
            batchDelete: true,
            freeBusy: true,
            recurrence: true,
            reminders: true
        };
    }
}