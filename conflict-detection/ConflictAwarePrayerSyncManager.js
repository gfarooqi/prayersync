/**
 * ConflictAwarePrayerSyncManager - Enhanced Prayer Sync with Conflict Detection
 * 
 * Extends the existing PrayerSyncManager with intelligent conflict detection and resolution.
 * Provides seamless integration between prayer scheduling and meeting conflicts.
 */

import { ConflictDetector } from './ConflictDetector.js';
import { SuggestionEngine } from './SuggestionEngine.js';
import { ConflictResolutionUI } from './ConflictResolutionUI.js';
import { CalendarServiceFactory } from './CalendarService.js';
import { DefaultConflictConfig, DataUtils } from './data-models.js';

export class ConflictAwarePrayerSyncManager {
    constructor(prayerCalculator, options = {}) {
        this.prayerCalculator = prayerCalculator;
        this.config = { ...DefaultConflictConfig, ...options };
        
        // Calendar service for conflict detection
        this.calendarService = null;
        
        // Legacy calendar adapter for prayer creation (from existing system)
        this.legacyCalendarAdapter = null;
        
        // Conflict resolution UI
        this.conflictUI = new ConflictResolutionUI({
            showTimeline: true,
            maxSuggestions: 3,
            enableLogging: true
        });
        
        // Current state
        this.currentLocation = null;
        this.pendingConflicts = [];
        this.isInitialized = false;
        
        this.log('ConflictAwarePrayerSyncManager created');
    }
    
    /**
     * Initialize the conflict-aware prayer sync manager
     * @param {Object} legacyAdapter - Existing calendar adapter
     * @param {string} calendarProvider - 'google' | 'microsoft'
     * @param {Object} calendarConfig - Calendar service configuration
     */
    async initialize(legacyAdapter, calendarProvider = 'google', calendarConfig = {}) {
        try {
            this.legacyCalendarAdapter = legacyAdapter;
            
            // Create calendar service for conflict detection
            this.calendarService = CalendarServiceFactory.create(calendarProvider, calendarConfig);
            
            // Set up event listeners for conflict resolution
            this.setupEventListeners();
            
            this.isInitialized = true;
            this.log('ConflictAwarePrayerSyncManager initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize conflict-aware manager:', error);
            throw error;
        }
    }
    
    /**
     * Enhanced prayer schedule sync with conflict detection
     * @param {Object} location - {latitude, longitude, timezone, city}
     * @param {string} period - 'today', 'week', 'month'
     * @param {Object} options - Sync options
     * @returns {Promise<Object>} Enhanced sync results
     */
    async syncPrayerScheduleWithConflictDetection(location, period = 'month', options = {}) {
        if (!this.isInitialized) {
            throw new Error('Manager not initialized. Call initialize() first.');
        }
        
        this.currentLocation = location;
        const mergedConfig = { ...this.config, ...options };
        
        try {
            this.log('Starting conflict-aware prayer sync', { location, period, options });
            
            // Step 1: Calculate prayer times for the period
            const { startDate, endDate } = this.getDateRange(period);
            const prayerTimes = this.calculatePrayerTimesForPeriod(startDate, endDate, location, mergedConfig);
            
            // Step 2: Detect conflicts with existing calendar events
            const conflicts = await this.detectConflicts(prayerTimes, startDate, endDate, mergedConfig);
            
            if (conflicts.length > 0) {
                this.log(`Found ${conflicts.length} conflicts, showing resolution UI`);
                
                // Step 3: Show conflict resolution UI and wait for user decisions
                const resolutionResults = await this.resolveConflictsWithUser(conflicts, mergedConfig);
                
                // Step 4: Create prayer events with resolved times
                const finalPrayerEvents = this.applyConflictResolutions(prayerTimes, resolutionResults);
                const createdEvents = await this.createPrayerEvents(finalPrayerEvents, mergedConfig);
                
                return {
                    success: true,
                    period,
                    location: location.city,
                    eventsCreated: createdEvents.length,
                    conflictsDetected: conflicts.length,
                    conflictsResolved: resolutionResults.filter(r => r.resolved).length,
                    conflictSummary: this.generateConflictSummary(conflicts, resolutionResults),
                    startDate,
                    endDate
                };
                
            } else {
                this.log('No conflicts detected, proceeding with normal sync');
                
                // No conflicts - proceed with standard sync
                const prayerEvents = this.generatePrayerEvents(prayerTimes, mergedConfig);
                const createdEvents = await this.createPrayerEvents(prayerEvents, mergedConfig);
                
                return {
                    success: true,
                    period,
                    location: location.city,
                    eventsCreated: createdEvents.length,
                    conflictsDetected: 0,
                    conflictsResolved: 0,
                    startDate,
                    endDate
                };
            }
            
        } catch (error) {
            console.error('Conflict-aware sync failed:', error);
            return {
                success: false,
                error: error.message,
                period,
                location: location.city
            };
        }
    }
    
    /**
     * Detect conflicts between prayer times and calendar events
     * @param {Array} prayerTimes - Prayer time windows
     * @param {Date} startDate - Period start
     * @param {Date} endDate - Period end
     * @param {Object} config - Configuration
     * @returns {Promise<Array>} Detected conflicts
     */
    async detectConflicts(prayerTimes, startDate, endDate, config) {
        if (!this.calendarService?.isCalendarConnected()) {
            this.log('Calendar not connected for conflict detection, skipping');
            return [];
        }
        
        try {
            // Get busy events from calendar
            const busyEvents = await this.calendarService.getBusyEvents(startDate, endDate);
            this.log(`Retrieved ${busyEvents.length} busy events for conflict detection`);
            
            // Group prayer times by day for efficient conflict detection
            const conflictsByDay = [];
            const dayGroups = this.groupPrayerTimesByDay(prayerTimes);
            
            for (const [dayStr, dayPrayers] of dayGroups.entries()) {
                const dayStart = new Date(dayStr + 'T00:00:00Z');
                const dayEnd = new Date(dayStr + 'T23:59:59Z');
                
                // Filter events for this day
                const dayEvents = busyEvents.filter(event => {
                    const eventStart = new Date(event.start);
                    return eventStart >= dayStart && eventStart <= dayEnd;
                });
                
                if (dayEvents.length > 0) {
                    // Detect conflicts for this day
                    const dayConflicts = ConflictDetector.findConflicts({
                        prayerTimes: dayPrayers,
                        calendarEvents: dayEvents,
                        config: config
                    });
                    
                    conflictsByDay.push(...dayConflicts);
                }
            }
            
            return conflictsByDay;
            
        } catch (error) {
            console.error('Failed to detect conflicts:', error);
            return []; // Graceful fallback
        }
    }
    
    /**
     * Resolve conflicts with user interaction
     * @param {Array} conflicts - Detected conflicts
     * @param {Object} config - Configuration
     * @returns {Promise<Array>} Resolution results
     */
    async resolveConflictsWithUser(conflicts, config) {
        const resolutionResults = [];
        
        for (const conflict of conflicts) {
            try {
                // Generate suggestions for this conflict
                const suggestions = SuggestionEngine.generateSuggestions(conflict, config);
                this.log(`Generated ${suggestions.length} suggestions for ${conflict.prayerName} conflict`);
                
                // Show UI and wait for user decision
                const resolution = await this.showConflictResolutionUI(conflict, suggestions);
                
                resolutionResults.push({
                    conflict: conflict,
                    suggestions: suggestions,
                    resolution: resolution,
                    resolved: resolution !== null
                });
                
            } catch (error) {
                console.error(`Failed to resolve conflict for ${conflict.prayerName}:`, error);
                resolutionResults.push({
                    conflict: conflict,
                    suggestions: [],
                    resolution: null,
                    resolved: false,
                    error: error.message
                });
            }
        }
        
        return resolutionResults;
    }
    
    /**
     * Show conflict resolution UI and return user choice
     * @param {Object} conflict - Conflict object
     * @param {Array} suggestions - Suggested resolutions
     * @returns {Promise<Object|null>} User's chosen suggestion or null
     */
    showConflictResolutionUI(conflict, suggestions) {
        return new Promise((resolve) => {
            this.conflictUI.showConflictResolution(
                conflict,
                suggestions,
                // onResolve callback
                (chosenSuggestion) => {
                    this.log(`User chose suggestion: ${chosenSuggestion.displayText}`);
                    resolve(chosenSuggestion);
                },
                // onDismiss callback
                () => {
                    this.log(`User dismissed conflict for ${conflict.prayerName}`);
                    resolve(null);
                }
            );
        });
    }
    
    /**
     * Apply conflict resolutions to prayer times
     * @param {Array} originalPrayerTimes - Original prayer time windows
     * @param {Array} resolutionResults - User resolution choices
     * @returns {Array} Final prayer times with resolutions applied
     */
    applyConflictResolutions(originalPrayerTimes, resolutionResults) {
        const finalPrayerTimes = [...originalPrayerTimes];
        
        for (const result of resolutionResults) {
            if (result.resolved && result.resolution.newPrayerTime) {
                // Find and update the corresponding prayer time
                const conflictedPrayer = result.conflict.prayerName;
                const prayerIndex = finalPrayerTimes.findIndex(p => p.name === conflictedPrayer);
                
                if (prayerIndex >= 0) {
                    // Update with resolved time
                    finalPrayerTimes[prayerIndex] = {
                        ...finalPrayerTimes[prayerIndex],
                        resolvedStartTime: result.resolution.newPrayerTime.start,
                        resolvedEndTime: result.resolution.newPrayerTime.end,
                        resolutionApplied: true,
                        resolutionType: result.resolution.type,
                        resolutionReason: result.resolution.reasoning.rationale
                    };
                    
                    this.log(`Applied resolution for ${conflictedPrayer}: ${result.resolution.displayText}`);
                }
            }
        }
        
        return finalPrayerTimes;
    }
    
    /**
     * Calculate prayer times for a period
     * @param {Date} startDate - Period start
     * @param {Date} endDate - Period end
     * @param {Object} location - Location data
     * @param {Object} config - Configuration
     * @returns {Array} Prayer time windows
     */
    calculatePrayerTimesForPeriod(startDate, endDate, location, config) {
        const prayerTimes = [];\n        const currentDate = new Date(startDate);\n        \n        while (currentDate <= endDate) {\n            // Calculate prayer times for this date\n            const dayPrayers = this.calculateDayPrayerTimes(currentDate, location, config);\n            prayerTimes.push(...dayPrayers);\n            \n            // Move to next day\n            currentDate.setDate(currentDate.getDate() + 1);\n        }\n        \n        return prayerTimes;\n    }\n    \n    /**\n     * Calculate prayer times for a specific day\n     * @param {Date} date - Target date\n     * @param {Object} location - Location data\n     * @param {Object} config - Configuration\n     * @returns {Array} Prayer windows for the day\n     */\n    calculateDayPrayerTimes(date, location, config) {\n        // Use existing prayer calculator\n        const dayTimes = this.prayerCalculator.calculatePrayerTimes(\n            location.latitude,\n            location.longitude,\n            date\n        );\n        \n        const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];\n        const prayerWindows = [];\n        \n        for (let i = 0; i < prayerNames.length; i++) {\n            const prayerName = prayerNames[i];\n            const prayerTime = dayTimes[prayerName.toLowerCase()];\n            \n            if (prayerTime) {\n                const startTime = new Date(prayerTime);\n                const endTime = this.calculatePrayerEndTime(startTime, prayerName, dayTimes);\n                \n                prayerWindows.push({\n                    name: prayerName,\n                    startTime: startTime.toISOString(),\n                    endTime: endTime.toISOString(),\n                    date: date.toISOString().split('T')[0],\n                    isCurrent: false,\n                    preferredStartMinutes: 0\n                });\n            }\n        }\n        \n        return prayerWindows;\n    }\n    \n    /**\n     * Calculate when a prayer window ends\n     * @param {Date} startTime - Prayer start time\n     * @param {string} prayerName - Name of prayer\n     * @param {Object} dayTimes - All prayer times for the day\n     * @returns {Date} Prayer end time\n     */\n    calculatePrayerEndTime(startTime, prayerName, dayTimes) {\n        const prayerOrder = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];\n        const currentIndex = prayerOrder.indexOf(prayerName);\n        \n        if (currentIndex < prayerOrder.length - 1) {\n            // End time is start of next prayer\n            const nextPrayerName = prayerOrder[currentIndex + 1];\n            const nextPrayerTime = dayTimes[nextPrayerName.toLowerCase()];\n            return new Date(nextPrayerTime);\n        } else {\n            // Last prayer (Isha) - give 4 hour window\n            const endTime = new Date(startTime);\n            endTime.setHours(endTime.getHours() + 4);\n            return endTime;\n        }\n    }\n    \n    /**\n     * Group prayer times by day for efficient processing\n     * @param {Array} prayerTimes - Prayer time windows\n     * @returns {Map} Map of date string to prayer times\n     */\n    groupPrayerTimesByDay(prayerTimes) {\n        const dayGroups = new Map();\n        \n        for (const prayer of prayerTimes) {\n            const dayStr = prayer.date || prayer.startTime.split('T')[0];\n            \n            if (!dayGroups.has(dayStr)) {\n                dayGroups.set(dayStr, []);\n            }\n            dayGroups.get(dayStr).push(prayer);\n        }\n        \n        return dayGroups;\n    }\n    \n    /**\n     * Generate prayer events for calendar creation\n     * @param {Array} prayerTimes - Prayer times (possibly with resolutions)\n     * @param {Object} config - Configuration\n     * @returns {Array} Calendar event data\n     */\n    generatePrayerEvents(prayerTimes, config) {\n        return prayerTimes.map(prayer => {\n            const startTime = prayer.resolvedStartTime || prayer.startTime;\n            const endTime = prayer.resolvedEndTime || \n                DataUtils.addMinutes(startTime, config.prayerDuration);\n            \n            return {\n                prayerName: prayer.name,\n                startTime: startTime,\n                endTime: endTime,\n                location: this.currentLocation?.city || '',\n                professionalMode: config.professionalMode,\n                notes: prayer.resolutionApplied ? \n                    `Adjusted: ${prayer.resolutionReason}` : ''\n            };\n        });\n    }\n    \n    /**\n     * Create prayer events using legacy calendar adapter\n     * @param {Array} prayerEvents - Prayer event data\n     * @param {Object} config - Configuration\n     * @returns {Promise<Array>} Created events\n     */\n    async createPrayerEvents(prayerEvents, config) {\n        if (!this.legacyCalendarAdapter?.isConnected()) {\n            throw new Error('Legacy calendar adapter not connected');\n        }\n        \n        // Convert to legacy format and create events\n        const legacyEvents = prayerEvents.map(event => \n            this.convertToLegacyFormat(event, config)\n        );\n        \n        return await this.legacyCalendarAdapter.createBatchEvents(legacyEvents);\n    }\n    \n    /**\n     * Convert prayer event to legacy calendar adapter format\n     * @param {Object} prayerEvent - Prayer event data\n     * @param {Object} config - Configuration\n     * @returns {Object} Legacy format event\n     */\n    convertToLegacyFormat(prayerEvent, config) {\n        // This matches the format expected by GoogleCalendarAdapter\n        return {\n            summary: config.professionalMode ? 'Personal Time' : `${prayerEvent.prayerName} Prayer`,\n            description: config.professionalMode ? \n                'Personal commitment' : \n                `${prayerEvent.prayerName} prayer time${prayerEvent.notes ? '\\n\\n' + prayerEvent.notes : ''}`,\n            start: {\n                dateTime: prayerEvent.startTime,\n                timeZone: this.currentLocation?.timezone || 'UTC'\n            },\n            end: {\n                dateTime: prayerEvent.endTime,\n                timeZone: this.currentLocation?.timezone || 'UTC'\n            },\n            location: prayerEvent.location,\n            extendedProperties: {\n                private: {\n                    prayerSyncId: `${prayerEvent.prayerName.toLowerCase()}_${Date.now()}`,\n                    prayerName: prayerEvent.prayerName,\n                    createdBy: 'PrayerSync'\n                }\n            }\n        };\n    }\n    \n    /**\n     * Generate conflict summary for results\n     * @param {Array} conflicts - Original conflicts\n     * @param {Array} resolutionResults - Resolution results\n     * @returns {Object} Summary object\n     */\n    generateConflictSummary(conflicts, resolutionResults) {\n        const summary = {\n            totalConflicts: conflicts.length,\n            resolved: 0,\n            dismissed: 0,\n            byPrayer: {},\n            bySeverity: { complete: 0, partial: 0, minor: 0 }\n        };\n        \n        for (const result of resolutionResults) {\n            const prayerName = result.conflict.prayerName;\n            const severity = result.conflict.analysis.conflictSeverity;\n            \n            if (!summary.byPrayer[prayerName]) {\n                summary.byPrayer[prayerName] = { total: 0, resolved: 0 };\n            }\n            \n            summary.byPrayer[prayerName].total++;\n            summary.bySeverity[severity]++;\n            \n            if (result.resolved) {\n                summary.resolved++;\n                summary.byPrayer[prayerName].resolved++;\n            } else {\n                summary.dismissed++;\n            }\n        }\n        \n        return summary;\n    }\n    \n    /**\n     * Get date range for period\n     * @param {string} period - 'today', 'week', 'month'\n     * @returns {Object} {startDate, endDate}\n     */\n    getDateRange(period) {\n        const now = new Date();\n        const startDate = new Date(now);\n        const endDate = new Date(now);\n        \n        switch (period) {\n            case 'today':\n                // Just today\n                startDate.setHours(0, 0, 0, 0);\n                endDate.setHours(23, 59, 59, 999);\n                break;\n                \n            case 'week':\n                // This week (Sunday to Saturday)\n                const dayOfWeek = startDate.getDay();\n                startDate.setDate(startDate.getDate() - dayOfWeek);\n                startDate.setHours(0, 0, 0, 0);\n                endDate.setDate(startDate.getDate() + 6);\n                endDate.setHours(23, 59, 59, 999);\n                break;\n                \n            case 'month':\n            default:\n                // This month\n                startDate.setDate(1);\n                startDate.setHours(0, 0, 0, 0);\n                endDate.setMonth(endDate.getMonth() + 1);\n                endDate.setDate(0); // Last day of current month\n                endDate.setHours(23, 59, 59, 999);\n                break;\n        }\n        \n        return { startDate, endDate };\n    }\n    \n    /**\n     * Set up event listeners for conflict resolution\n     */\n    setupEventListeners() {\n        // Listen for conflict resolution events\n        document.addEventListener('prayer-conflict-resolved', (event) => {\n            this.log('Prayer conflict resolved', event.detail);\n        });\n        \n        document.addEventListener('prayer-conflict-dismissed', (event) => {\n            this.log('Prayer conflict dismissed', event.detail);\n        });\n    }\n    \n    /**\n     * Check if calendar service is connected for conflict detection\n     * @returns {boolean}\n     */\n    isConflictDetectionEnabled() {\n        return this.calendarService?.isCalendarConnected() ?? false;\n    }\n    \n    /**\n     * Get legacy calendar adapter (for backward compatibility)\n     * @returns {Object} Legacy adapter\n     */\n    getLegacyAdapter() {\n        return this.legacyCalendarAdapter;\n    }\n    \n    /**\n     * Development logging\n     */\n    log(...args) {\n        console.log('[ConflictAwarePrayerSyncManager]', ...args);\n    }\n}"