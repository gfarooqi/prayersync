/**
 * PrayerSyncManager - Application orchestrator for PrayerSync calendar integration
 * 
 * This class provides the "smart" application logic for managing prayer times
 * across calendar providers. It uses CalendarService adapters to perform the
 * actual calendar operations while handling the business logic like:
 * - Syncing prayer schedules
 * - Handling location changes
 * - Managing calculation method updates
 * - Conflict detection and resolution
 */

import { GoogleCalendarAdapter } from './GoogleCalendarAdapter.js';

export class PrayerSyncManager {
    #calendarAdapter = null;
    #prayerCalculator = null;
    #currentLocation = null;
    #calculationMethod = 'ISNA';
    #professionalMode = true;
    #eventDuration = 30; // minutes

    constructor(prayerCalculator) {
        this.#prayerCalculator = prayerCalculator;
        // Default to Google Calendar - can be made configurable later
        this.#calendarAdapter = new GoogleCalendarAdapter();
    }

    // --- Calendar Connection Management ---

    /**
     * Connect to the user's calendar service
     * @returns {Promise<boolean>} true if connection successful
     */
    async connectCalendar() {
        try {
            const connected = await this.#calendarAdapter.connect();
            if (connected) {
                console.log(`Connected to ${this.#calendarAdapter.getProviderName()} Calendar`);
            }
            return connected;
        } catch (error) {
            console.error('Failed to connect to calendar:', error);
            return false;
        }
    }

    /**
     * Disconnect from calendar service
     */
    async disconnectCalendar() {
        await this.#calendarAdapter.disconnect();
    }

    /**
     * Check if calendar is connected
     * @returns {boolean}
     */
    isCalendarConnected() {
        return this.#calendarAdapter.isConnected();
    }

    /**
     * Get connected user information
     * @returns {Object|null} {email: string, name: string}
     */
    getConnectedUser() {
        return this.#calendarAdapter.getConnectedUser();
    }

    // --- Prayer Schedule Management ---

    /**
     * Sync prayer times to calendar for a specified period
     * @param {Object} location - {latitude, longitude, timezone, city}
     * @param {string} period - 'today', 'week', 'month'
     * @param {Object} options - Sync options
     * @returns {Promise<Object>} Sync results
     */
    async syncPrayerSchedule(location, period = 'month', options = {}) {
        if (!this.isCalendarConnected()) {
            throw new Error('Calendar not connected. Call connectCalendar() first.');
        }

        this.#currentLocation = location;
        const {
            calculationMethod = this.#calculationMethod,
            professionalMode = this.#professionalMode,
            eventDuration = this.#eventDuration,
            replaceExisting = true
        } = options;

        try {
            // Calculate date range based on period
            const { startDate, endDate } = this.#getDateRange(period);
            
            console.log(`Syncing ${period} prayer schedule for ${location.city || 'current location'}`);

            // Clear existing PrayerSync events if requested
            if (replaceExisting) {
                await this.#clearExistingEvents(startDate, endDate);
            }

            // Generate prayer events for the period
            const prayerEvents = this.#generatePrayerEvents(
                startDate, 
                endDate, 
                location, 
                calculationMethod,
                professionalMode,
                eventDuration
            );

            // Create events in calendar
            const createdEvents = await this.#calendarAdapter.createBatchEvents(prayerEvents);

            const result = {
                success: true,
                period,
                location: location.city || `${location.latitude}, ${location.longitude}`,
                eventsCreated: createdEvents.length,
                totalExpected: prayerEvents.length,
                startDate,
                endDate
            };

            console.log('Prayer schedule sync completed:', result);
            return result;

        } catch (error) {
            console.error('Failed to sync prayer schedule:', error);
            return {
                success: false,
                error: error.message,
                period,
                location: location.city
            };
        }
    }

    /**
     * Update prayer times when location changes
     * @param {Object} newLocation - New location data
     * @param {string} period - Period to update
     * @returns {Promise<Object>} Update results
     */
    async updateLocationPrayers(newLocation, period = 'month') {
        console.log(`Updating prayer times for location change to ${newLocation.city}`);
        
        // This will replace existing events with new location-based times
        return await this.syncPrayerSchedule(newLocation, period, {
            replaceExisting: true
        });
    }

    /**
     * Update calculation method and re-sync
     * @param {string} newMethod - New calculation method
     * @param {string} period - Period to update
     * @returns {Promise<Object>} Update results
     */
    async updateCalculationMethod(newMethod, period = 'month') {
        console.log(`Updating calculation method to ${newMethod}`);
        this.#calculationMethod = newMethod;
        
        return await this.syncPrayerSchedule(this.#currentLocation, period, {
            calculationMethod: newMethod,
            replaceExisting: true
        });
    }

    /**
     * Check for conflicts with existing calendar events
     * @param {string} startDate - ISO date string
     * @param {string} endDate - ISO date string
     * @returns {Promise<Array>} Array of conflicts
     */
    async checkPrayerConflicts(startDate, endDate) {
        if (!this.isCalendarConnected()) {
            return [];
        }

        try {
            // Get all events (not just PrayerSync ones)
            const allEvents = await this.#calendarAdapter.getEvents(startDate, endDate, false);
            const prayerEvents = await this.#calendarAdapter.getEvents(startDate, endDate, true);

            const conflicts = [];

            for (const prayerEvent of prayerEvents) {
                const conflictingEvents = allEvents.filter(event => {
                    // Skip if it's the same event
                    if (event.id === prayerEvent.id) return false;
                    
                    // Check for time overlap
                    const prayerStart = new Date(prayerEvent.startTime);
                    const prayerEnd = new Date(prayerEvent.endTime);
                    const eventStart = new Date(event.startTime);
                    const eventEnd = new Date(event.endTime);

                    return (prayerStart < eventEnd && prayerEnd > eventStart);
                });

                if (conflictingEvents.length > 0) {
                    conflicts.push({
                        prayerEvent,
                        conflictingEvents,
                        prayer: prayerEvent.prayerSyncMetadata?.prayer
                    });
                }
            }

            return conflicts;
        } catch (error) {
            console.error('Failed to check conflicts:', error);
            return [];
        }
    }

    // --- Private Helper Methods ---

    /**
     * Calculate date range based on period
     * @param {string} period
     * @returns {Object} {startDate, endDate}
     * @private
     */
    #getDateRange(period) {
        const now = new Date();
        let startDate, endDate;

        switch (period) {
            case 'today':
                startDate = new Date(now);
                endDate = new Date(now);
                break;
            case 'week':
                startDate = new Date(now);
                endDate = new Date(now);
                endDate.setDate(endDate.getDate() + 7);
                break;
            case 'month':
                startDate = new Date(now);
                endDate = new Date(now);
                endDate.setMonth(endDate.getMonth() + 1);
                break;
            default:
                throw new Error(`Invalid period: ${period}`);
        }

        // Normalize to start/end of day
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        return {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        };
    }

    /**
     * Clear existing PrayerSync events in date range
     * @param {string} startDate
     * @param {string} endDate
     * @private
     */
    async #clearExistingEvents(startDate, endDate) {
        try {
            const existingEvents = await this.#calendarAdapter.getEvents(startDate, endDate, true);
            
            if (existingEvents.length > 0) {
                console.log(`Clearing ${existingEvents.length} existing prayer events`);
                const eventIds = existingEvents.map(event => event.id);
                await this.#calendarAdapter.deleteBatchEvents(eventIds);
            }
        } catch (error) {
            console.warn('Failed to clear existing events:', error);
            // Continue with sync even if clearing fails
        }
    }

    /**
     * Generate prayer events for a date range
     * @param {string} startDate
     * @param {string} endDate
     * @param {Object} location
     * @param {string} calculationMethod
     * @param {boolean} professionalMode
     * @param {number} eventDuration
     * @returns {Array} Array of event data objects
     * @private
     */
    #generatePrayerEvents(startDate, endDate, location, calculationMethod, professionalMode, eventDuration) {
        const events = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Set calculator properties
        this.#prayerCalculator.calculationMethod = calculationMethod;

        // Generate events for each day in range
        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
            const prayerTimes = this.#prayerCalculator.calculate(
                new Date(date), 
                { latitude: location.latitude, longitude: location.longitude },
                this.#getTimezoneOffset(location.timezone)
            );

            // Create events for each prayer
            ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(prayer => {
                if (prayerTimes[prayer]) {
                    const eventData = this.#createPrayerEventData(
                        prayer,
                        prayerTimes[prayer],
                        new Date(date),
                        location,
                        calculationMethod,
                        professionalMode,
                        eventDuration
                    );
                    events.push(eventData);
                }
            });
        }

        return events;
    }

    /**
     * Create event data object for a single prayer
     * @param {string} prayer
     * @param {string} prayerTime
     * @param {Date} date
     * @param {Object} location
     * @param {string} calculationMethod
     * @param {boolean} professionalMode
     * @param {number} eventDuration
     * @returns {Object} Event data object
     * @private
     */
    #createPrayerEventData(prayer, prayerTime, date, location, calculationMethod, professionalMode, eventDuration) {
        const [hours, minutes] = prayerTime.split(':').map(Number);
        
        const startTime = new Date(date);
        startTime.setHours(hours, minutes, 0, 0);
        
        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + eventDuration);

        const prayerNames = {
            fajr: 'Fajr',
            dhuhr: 'Dhuhr', 
            asr: 'Asr',
            maghrib: 'Maghrib',
            isha: 'Isha'
        };

        return {
            title: professionalMode ? 'Personal Time' : `${prayerNames[prayer]} Prayer`,
            description: professionalMode 
                ? `Personal time block (${prayerNames[prayer]} prayer)`
                : `Time for ${prayerNames[prayer]} prayer`,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            visibility: professionalMode ? 'private' : 'default',
            prayerSyncMetadata: {
                app: 'PrayerSync',
                version: '1.0',
                prayer: prayer,
                calculationMethod: calculationMethod,
                location: location.city || `${location.latitude}, ${location.longitude}`
            }
        };
    }

    /**
     * Get timezone offset in hours
     * @param {string} timezone
     * @returns {number}
     * @private
     */
    #getTimezoneOffset(timezone) {
        if (!timezone) {
            return -new Date().getTimezoneOffset() / 60;
        }
        
        try {
            const now = new Date();
            const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
            const targetTime = new Date(utc.toLocaleString('en-US', { timeZone: timezone }));
            return (targetTime.getTime() - utc.getTime()) / (1000 * 60 * 60);
        } catch (error) {
            console.warn(`Invalid timezone ${timezone}, using local timezone`);
            return -new Date().getTimezoneOffset() / 60;
        }
    }

    // --- Settings Management ---

    /**
     * Update sync settings
     * @param {Object} settings
     */
    updateSettings(settings) {
        if (settings.calculationMethod) {
            this.#calculationMethod = settings.calculationMethod;
        }
        if (typeof settings.professionalMode === 'boolean') {
            this.#professionalMode = settings.professionalMode;
        }
        if (settings.eventDuration) {
            this.#eventDuration = settings.eventDuration;
        }
    }

    /**
     * Get current settings
     * @returns {Object}
     */
    getSettings() {
        return {
            calculationMethod: this.#calculationMethod,
            professionalMode: this.#professionalMode,
            eventDuration: this.#eventDuration,
            calendarProvider: this.#calendarAdapter.getProviderName()
        };
    }
}