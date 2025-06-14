/**
 * CalendarService - Abstract Calendar API Adapter
 * 
 * Provides a unified interface for calendar operations across different providers
 * (Google Calendar, Microsoft Graph, etc.) with normalized data models.
 */

import { EventStatus, DataUtils, DataValidation } from './data-models.js';

/**
 * Abstract base class for calendar service adapters
 */
export class CalendarService {
    constructor(config = {}) {
        this.config = {
            timeZone: config.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            maxEvents: config.maxEvents || 100,
            cacheTimeout: config.cacheTimeout || 300000, // 5 minutes
            ...config
        };
        
        this.cache = new Map();
        this.isAuthenticated = false;
    }
    
    /**
     * Abstract methods to be implemented by specific providers
     */
    
    async authenticate() {
        throw new Error('authenticate() must be implemented by provider');
    }
    
    async getEvents(startDate, endDate) {
        throw new Error('getEvents() must be implemented by provider');
    }
    
    async createEvent(eventData) {
        throw new Error('createEvent() must be implemented by provider');
    }
    
    async updateEvent(eventId, eventData) {
        throw new Error('updateEvent() must be implemented by provider');
    }
    
    async deleteEvent(eventId) {
        throw new Error('deleteEvent() must be implemented by provider');
    }
    
    /**
     * Get free/busy information for conflict detection
     * @param {Date} startDate - Start of time range
     * @param {Date} endDate - End of time range
     * @returns {Promise<CalendarEvent[]>} Array of busy events
     */
    async getBusyEvents(startDate, endDate) {
        const cacheKey = `busy_${startDate.toISOString()}_${endDate.toISOString()}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.config.cacheTimeout) {
                return cached.data;
            }
        }
        
        try {
            const allEvents = await this.getEvents(startDate, endDate);
            const busyEvents = allEvents.filter(event => 
                event.status === EventStatus.BUSY || 
                event.status === EventStatus.OUT_OF_OFFICE
            );
            
            // Cache the result
            this.cache.set(cacheKey, {
                data: busyEvents,
                timestamp: Date.now()
            });
            
            return busyEvents;
        } catch (error) {
            console.error('Failed to get busy events:', error);
            throw error;
        }
    }
    
    /**
     * Create a prayer event in the calendar
     * @param {Object} prayerData - Prayer event data
     * @returns {Promise<CalendarEvent>} Created event
     */
    async createPrayerEvent(prayerData) {
        const eventData = this.formatPrayerEvent(prayerData);
        return await this.createEvent(eventData);
    }
    
    /**
     * Format prayer data for calendar event creation
     * @param {Object} prayerData - Raw prayer data
     * @returns {Object} Formatted event data
     */
    formatPrayerEvent(prayerData) {
        const {
            prayerName,
            startTime,
            endTime,
            location,
            professionalMode = true,
            notes = ''
        } = prayerData;
        
        // Use professional mode by default for workplace privacy
        const title = professionalMode ? 'Personal Time' : `${prayerName} Prayer`;
        const description = professionalMode ? 
            'Personal commitment' : 
            `${prayerName} prayer time${notes ? '\n\n' + notes : ''}`;
        
        return {
            summary: title,
            description: description,
            start: {
                dateTime: startTime,
                timeZone: this.config.timeZone
            },
            end: {
                dateTime: endTime,
                timeZone: this.config.timeZone
            },
            location: location || '',
            visibility: professionalMode ? 'private' : 'default',
            status: 'confirmed',
            // Add metadata for prayer sync identification
            extendedProperties: {
                private: {
                    prayerSyncId: `${prayerName.toLowerCase()}_${Date.now()}`,
                    prayerName: prayerName,
                    createdBy: 'PrayerSync'
                }
            }
        };
    }
    
    /**
     * Check if user is authenticated with calendar service
     * @returns {boolean} Authentication status
     */
    isCalendarConnected() {
        return this.isAuthenticated;
    }
    
    /**
     * Get connected user information
     * @returns {Object|null} User info or null
     */
    getConnectedUser() {
        return null; // Override in specific providers
    }
    
    /**
     * Clear authentication and cache
     */
    async disconnect() {
        this.isAuthenticated = false;
        this.cache.clear();
    }
    
    /**
     * Validate date range for API calls
     * @param {Date} startDate 
     * @param {Date} endDate 
     */
    validateDateRange(startDate, endDate) {
        if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
            throw new Error('Start and end dates must be Date objects');
        }
        
        if (startDate >= endDate) {
            throw new Error('Start date must be before end date');
        }
        
        const maxRangeDays = 365; // 1 year maximum
        const rangeDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
        
        if (rangeDays > maxRangeDays) {
            throw new Error(`Date range too large. Maximum ${maxRangeDays} days allowed`);
        }
    }
    
    /**
     * Clear cache entries older than timeout
     */
    cleanCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.config.cacheTimeout) {
                this.cache.delete(key);
            }
        }
    }
}

/**
 * Google Calendar Service Implementation
 */
export class GoogleCalendarService extends CalendarService {
    constructor(config = {}) {
        super(config);
        this.clientId = config.clientId;
        this.apiKey = config.apiKey;
        this.gapi = null;
        this.auth2 = null;
        this.currentUser = null;
    }
    
    /**
     * Authenticate with Google Calendar
     */
    async authenticate() {
        if (!this.clientId) {
            throw new Error('Google Client ID not configured');
        }
        
        try {
            // Load Google API if not already loaded
            if (!window.gapi) {
                await this.loadGoogleAPI();
            }
            
            // Initialize Google API
            await new Promise((resolve, reject) => {
                window.gapi.load('auth2:client', {
                    callback: resolve,
                    onerror: reject
                });
            });
            
            await window.gapi.client.init({
                clientId: this.clientId,
                scope: 'https://www.googleapis.com/auth/calendar'
            });
            
            this.auth2 = window.gapi.auth2.getAuthInstance();
            
            // Check if already signed in
            if (this.auth2.isSignedIn.get()) {
                this.currentUser = this.auth2.currentUser.get();
                this.isAuthenticated = true;
                return true;
            }
            
            // Sign in user
            this.currentUser = await this.auth2.signIn();
            this.isAuthenticated = true;
            
            return true;
            
        } catch (error) {
            console.error('Google Calendar authentication failed:', error);
            throw new Error('Failed to authenticate with Google Calendar');
        }
    }
    
    /**
     * Load Google API script
     */
    loadGoogleAPI() {
        return new Promise((resolve, reject) => {
            if (window.gapi) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load Google API'));
            document.head.appendChild(script);
        });
    }
    
    /**
     * Get events from Google Calendar
     */
    async getEvents(startDate, endDate) {
        this.validateDateRange(startDate, endDate);
        
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with Google Calendar');
        }
        
        try {
            const response = await window.gapi.client.request({
                path: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
                params: {
                    timeMin: startDate.toISOString(),
                    timeMax: endDate.toISOString(),
                    singleEvents: true,
                    orderBy: 'startTime',
                    maxResults: this.config.maxEvents
                }
            });
            
            return response.result.items.map(event => this.normalizeGoogleEvent(event));
            
        } catch (error) {
            console.error('Failed to get Google Calendar events:', error);
            throw new Error('Failed to retrieve calendar events');
        }
    }
    
    /**
     * Get free/busy information using Google's freebusy API
     */
    async getBusyEvents(startDate, endDate) {
        this.validateDateRange(startDate, endDate);
        
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with Google Calendar');
        }
        
        try {
            const response = await window.gapi.client.request({
                path: 'https://www.googleapis.com/calendar/v3/freeBusy',
                method: 'POST',
                body: {
                    timeMin: startDate.toISOString(),
                    timeMax: endDate.toISOString(),
                    items: [{ id: 'primary' }]
                }
            });
            
            const busyTimes = response.result.calendars.primary.busy || [];
            
            // Convert busy times to normalized events
            return busyTimes.map((busyTime, index) => ({
                id: `busy_${index}_${Date.now()}`,
                start: busyTime.start,
                end: busyTime.end,
                status: EventStatus.BUSY,
                subject: 'Busy',
                isPrivate: true,
                originalData: busyTime
            }));
            
        } catch (error) {
            console.error('Failed to get Google Calendar free/busy:', error);
            // Fallback to regular events if freebusy fails
            return super.getBusyEvents(startDate, endDate);
        }
    }
    
    /**
     * Create event in Google Calendar
     */
    async createEvent(eventData) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with Google Calendar');
        }
        
        try {
            const response = await window.gapi.client.request({
                path: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
                method: 'POST',
                body: eventData
            });
            
            return this.normalizeGoogleEvent(response.result);
            
        } catch (error) {
            console.error('Failed to create Google Calendar event:', error);
            throw new Error('Failed to create calendar event');
        }
    }
    
    /**
     * Update event in Google Calendar
     */
    async updateEvent(eventId, eventData) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with Google Calendar');
        }
        
        try {
            const response = await window.gapi.client.request({
                path: `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
                method: 'PUT',
                body: eventData
            });
            
            return this.normalizeGoogleEvent(response.result);
            
        } catch (error) {
            console.error('Failed to update Google Calendar event:', error);
            throw new Error('Failed to update calendar event');
        }
    }
    
    /**
     * Delete event from Google Calendar
     */
    async deleteEvent(eventId) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated with Google Calendar');
        }
        
        try {
            await window.gapi.client.request({
                path: `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
                method: 'DELETE'
            });
            
            return true;
            
        } catch (error) {
            console.error('Failed to delete Google Calendar event:', error);
            throw new Error('Failed to delete calendar event');
        }
    }
    
    /**
     * Normalize Google Calendar event to standard format
     */
    normalizeGoogleEvent(googleEvent) {
        const startTime = googleEvent.start?.dateTime || googleEvent.start?.date;
        const endTime = googleEvent.end?.dateTime || googleEvent.end?.date;
        
        // Determine event status
        let status = EventStatus.BUSY;
        if (googleEvent.transparency === 'transparent') {
            status = EventStatus.FREE;
        } else if (googleEvent.status === 'tentative') {
            status = EventStatus.TENTATIVE;
        }
        
        return {
            id: googleEvent.id,
            start: startTime,
            end: endTime,
            status: status,
            subject: googleEvent.summary || 'Untitled Event',
            isPrivate: googleEvent.visibility === 'private',
            location: googleEvent.location || '',
            description: googleEvent.description || '',
            originalData: googleEvent
        };
    }
    
    /**
     * Get connected user information
     */
    getConnectedUser() {
        if (!this.currentUser) return null;
        
        const profile = this.currentUser.getBasicProfile();
        return {
            id: profile.getId(),
            email: profile.getEmail(),
            name: profile.getName(),
            imageUrl: profile.getImageUrl()
        };
    }
    
    /**
     * Disconnect from Google Calendar
     */
    async disconnect() {
        if (this.auth2) {
            await this.auth2.signOut();
        }
        
        this.currentUser = null;
        await super.disconnect();
    }
}

/**
 * Microsoft Graph Calendar Service Implementation
 * TODO: Implement when Microsoft Graph integration is needed
 */
export class MicrosoftGraphService extends CalendarService {
    constructor(config = {}) {
        super(config);
        // Implementation placeholder
        console.warn('MicrosoftGraphService not yet implemented');
    }
    
    async authenticate() {
        throw new Error('Microsoft Graph service not yet implemented');
    }
    
    async getEvents(startDate, endDate) {
        throw new Error('Microsoft Graph service not yet implemented');
    }
    
    async createEvent(eventData) {
        throw new Error('Microsoft Graph service not yet implemented');
    }
    
    async updateEvent(eventId, eventData) {
        throw new Error('Microsoft Graph service not yet implemented');
    }
    
    async deleteEvent(eventId) {
        throw new Error('Microsoft Graph service not yet implemented');
    }
}

/**
 * Calendar Service Factory
 */
export class CalendarServiceFactory {
    /**
     * Create a calendar service instance
     * @param {string} provider - 'google' | 'microsoft' | 'apple'
     * @param {Object} config - Provider configuration
     * @returns {CalendarService} Service instance
     */
    static create(provider, config = {}) {
        switch (provider.toLowerCase()) {
            case 'google':
                return new GoogleCalendarService(config);
                
            case 'microsoft':
                return new MicrosoftGraphService(config);
                
            default:
                throw new Error(`Unsupported calendar provider: ${provider}`);
        }
    }
    
    /**
     * Get list of supported providers
     * @returns {string[]} Supported provider names
     */
    static getSupportedProviders() {
        return ['google', 'microsoft'];
    }
}