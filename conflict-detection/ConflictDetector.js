/**
 * ConflictDetector - Smart Prayer Time Conflict Detection
 * 
 * Pure function module that analyzes prayer windows against calendar events
 * to detect scheduling conflicts and calculate available time slots.
 */

import { 
    ConflictSeverity, 
    EventStatus, 
    DefaultConflictConfig,
    DataValidation,
    DataUtils 
} from './data-models.js';

export class ConflictDetector {
    /**
     * Find conflicts between prayer times and calendar events
     * @param {Object} params - Detection parameters
     * @param {PrayerWindow[]} params.prayerTimes - Array of prayer windows
     * @param {CalendarEvent[]} params.calendarEvents - Array of calendar events
     * @param {ConflictConfig} params.config - Configuration options
     * @returns {Conflict[]} Array of detected conflicts
     */
    static findConflicts({ prayerTimes, calendarEvents, config = {} }) {
        // Merge with default configuration
        const mergedConfig = { ...DefaultConflictConfig, ...config };
        
        // Validate inputs
        if (!Array.isArray(prayerTimes) || !Array.isArray(calendarEvents)) {
            throw new Error('prayerTimes and calendarEvents must be arrays');
        }
        
        // Filter valid prayer times
        const validPrayerTimes = prayerTimes.filter(prayer => 
            DataValidation.isValidPrayerWindow(prayer)
        );
        
        if (validPrayerTimes.length === 0) {
            return [];
        }
        
        // Filter and normalize calendar events
        const relevantEvents = this.filterRelevantEvents(calendarEvents, mergedConfig);
        
        const conflicts = [];
        
        // Check each prayer time for conflicts
        for (const prayer of validPrayerTimes) {
            const conflict = this.detectPrayerConflict(prayer, relevantEvents, mergedConfig);
            if (conflict) {
                conflicts.push(conflict);
            }
        }
        
        return conflicts;
    }
    
    /**
     * Filter calendar events to only relevant ones for conflict detection
     * @param {CalendarEvent[]} events - All calendar events
     * @param {ConflictConfig} config - Configuration
     * @returns {CalendarEvent[]} Filtered events
     */
    static filterRelevantEvents(events, config) {
        return events.filter(event => {
            // Skip invalid events
            if (!DataValidation.isValidCalendarEvent(event)) {
                return false;
            }
            
            // Only consider busy events (and tentative if configured)
            const busyStatuses = [EventStatus.BUSY, EventStatus.OUT_OF_OFFICE];
            if (config.considerTentative) {
                busyStatuses.push(EventStatus.TENTATIVE);
            }
            
            if (!busyStatuses.includes(event.status)) {
                return false;
            }
            
            // Skip events matching ignored patterns
            const subject = event.subject.toLowerCase();
            for (const pattern of config.ignoredEventPatterns) {
                if (subject.includes(pattern.toLowerCase())) {
                    return false;
                }
            }
            
            // Skip very short events (less than minimum slot size)
            const duration = DataUtils.getDurationMinutes(event.start, event.end);
            if (duration < config.minimumSlotSize) {
                return false;
            }
            
            return true;
        });
    }
    
    /**
     * Detect conflict for a specific prayer time
     * @param {PrayerWindow} prayer - Prayer window to check
     * @param {CalendarEvent[]} events - Relevant calendar events
     * @param {ConflictConfig} config - Configuration
     * @returns {Conflict|null} Conflict object or null if no conflict
     */
    static detectPrayerConflict(prayer, events, config) {
        // Find events that overlap with prayer window
        const overlappingEvents = events.filter(event => 
            DataUtils.rangesOverlap(
                { start: prayer.startTime, end: prayer.endTime },
                { start: event.start, end: event.end }
            )
        );
        
        if (overlappingEvents.length === 0) {
            return null; // No potential conflicts
        }
        
        // Calculate available time slots within prayer window
        const availableSlots = this.calculateAvailableSlots(prayer, overlappingEvents);
        
        // Determine if prayer can fit in available slots
        const requiredMinutes = config.prayerDuration + (config.bufferTime * 2);
        const hasValidSlot = availableSlots.some(slot => slot.duration >= requiredMinutes);
        
        if (hasValidSlot) {
            return null; // Conflict can be resolved, no blocking conflict
        }
        
        // Analyze the conflict in detail
        const analysis = this.analyzeConflict(prayer, overlappingEvents, config);
        
        return {
            prayerName: prayer.name,
            prayerWindow: prayer,
            conflictingEvents: overlappingEvents,
            analysis: analysis
        };
    }
    
    /**
     * Calculate available time slots within prayer window
     * @param {PrayerWindow} prayer - Prayer window
     * @param {CalendarEvent[]} overlappingEvents - Events that overlap
     * @returns {Array<{start: string, end: string, duration: number}>} Available slots
     */
    static calculateAvailableSlots(prayer, overlappingEvents) {
        if (overlappingEvents.length === 0) {
            const totalDuration = DataUtils.getDurationMinutes(prayer.startTime, prayer.endTime);
            return [{
                start: prayer.startTime,
                end: prayer.endTime,
                duration: totalDuration
            }];
        }
        
        // Sort events by start time
        const sortedEvents = [...overlappingEvents].sort((a, b) => 
            new Date(a.start) - new Date(b.start)
        );
        
        // Merge overlapping events to handle back-to-back meetings
        const mergedEvents = this.mergeOverlappingEvents(sortedEvents);
        
        const slots = [];
        const prayerStart = new Date(prayer.startTime);
        const prayerEnd = new Date(prayer.endTime);
        
        let currentTime = prayerStart;
        
        for (const event of mergedEvents) {
            const eventStart = new Date(event.start);
            const eventEnd = new Date(event.end);
            
            // Clamp event times to prayer window
            const clampedStart = eventStart < prayerStart ? prayerStart : eventStart;
            const clampedEnd = eventEnd > prayerEnd ? prayerEnd : eventEnd;
            
            // Add slot before this event
            if (currentTime < clampedStart) {
                const duration = (clampedStart - currentTime) / (1000 * 60);
                slots.push({
                    start: currentTime.toISOString(),
                    end: clampedStart.toISOString(),
                    duration: duration
                });
            }
            
            // Move current time to end of this event
            currentTime = clampedEnd > currentTime ? clampedEnd : currentTime;
        }
        
        // Add final slot after last event
        if (currentTime < prayerEnd) {
            const duration = (prayerEnd - currentTime) / (1000 * 60);
            slots.push({
                start: currentTime.toISOString(),
                end: prayerEnd.toISOString(),
                duration: duration
            });
        }
        
        return slots.filter(slot => slot.duration > 0);
    }
    
    /**
     * Merge overlapping calendar events
     * @param {CalendarEvent[]} events - Sorted events
     * @returns {CalendarEvent[]} Merged events
     */
    static mergeOverlappingEvents(events) {
        if (events.length <= 1) return events;
        
        const merged = [events[0]];
        
        for (let i = 1; i < events.length; i++) {
            const current = events[i];
            const lastMerged = merged[merged.length - 1];
            
            const lastEnd = new Date(lastMerged.end);
            const currentStart = new Date(current.start);
            
            // If events overlap or are adjacent (within 5 minutes), merge them
            const gapMinutes = (currentStart - lastEnd) / (1000 * 60);
            if (gapMinutes <= 5) {
                // Extend the last merged event
                const currentEnd = new Date(current.end);
                const lastMergedEnd = new Date(lastMerged.end);
                
                lastMerged.end = currentEnd > lastMergedEnd ? 
                    current.end : lastMerged.end;
                    
                // Combine subjects for context
                if (!lastMerged.subject.includes(current.subject)) {
                    lastMerged.subject += ` + ${current.subject}`;
                }
            } else {
                merged.push(current);
            }
        }
        
        return merged;
    }
    
    /**
     * Analyze conflict details for severity and context
     * @param {PrayerWindow} prayer - Prayer window
     * @param {CalendarEvent[]} conflictingEvents - Conflicting events
     * @param {ConflictConfig} config - Configuration
     * @returns {Object} Analysis object
     */
    static analyzeConflict(prayer, conflictingEvents, config) {
        const prayerDuration = DataUtils.getDurationMinutes(prayer.startTime, prayer.endTime);
        const requiredMinutes = config.prayerDuration + (config.bufferTime * 2);
        
        // Calculate total busy time
        let totalBusyMinutes = 0;
        const mergedEvents = this.mergeOverlappingEvents([...conflictingEvents].sort(
            (a, b) => new Date(a.start) - new Date(b.start)
        ));
        
        for (const event of mergedEvents) {
            const eventStart = new Date(event.start);
            const eventEnd = new Date(event.end);
            const prayerStart = new Date(prayer.startTime);
            const prayerEnd = new Date(prayer.endTime);
            
            // Calculate overlap with prayer window
            const overlapStart = eventStart > prayerStart ? eventStart : prayerStart;
            const overlapEnd = eventEnd < prayerEnd ? eventEnd : prayerEnd;
            
            if (overlapStart < overlapEnd) {
                totalBusyMinutes += (overlapEnd - overlapStart) / (1000 * 60);
            }
        }
        
        // Find largest available slot
        const availableSlots = this.calculateAvailableSlots(prayer, conflictingEvents);
        const largestSlot = Math.max(0, ...availableSlots.map(slot => slot.duration));
        
        // Determine conflict severity
        let severity;
        const freeTime = prayerDuration - totalBusyMinutes;
        
        if (largestSlot < config.minimumSlotSize) {
            severity = ConflictSeverity.COMPLETE;
        } else if (largestSlot < requiredMinutes) {
            severity = ConflictSeverity.PARTIAL;
        } else {
            severity = ConflictSeverity.MINOR;
        }
        
        return {
            totalBusyMinutes: Math.round(totalBusyMinutes),
            largestAvailableSlot: Math.round(largestSlot),
            requiredMinutes: requiredMinutes,
            conflictSeverity: severity,
            availableSlots: availableSlots.length,
            prayerWindowMinutes: Math.round(prayerDuration)
        };
    }
    
    /**
     * Get human-readable conflict summary
     * @param {Conflict} conflict - Conflict object
     * @returns {string} Human-readable summary
     */
    static getConflictSummary(conflict) {
        const { prayerName, analysis, conflictingEvents } = conflict;
        const eventCount = conflictingEvents.length;
        const eventText = eventCount === 1 ? 'meeting' : 'meetings';
        
        switch (analysis.conflictSeverity) {
            case ConflictSeverity.COMPLETE:
                return `${prayerName} prayer is completely blocked by ${eventCount} ${eventText}`;
            case ConflictSeverity.PARTIAL:
                return `${prayerName} prayer has limited time due to ${eventCount} ${eventText}`;
            case ConflictSeverity.MINOR:
                return `${prayerName} prayer has minor scheduling challenges with ${eventCount} ${eventText}`;
            default:
                return `${prayerName} prayer has scheduling conflicts`;
        }
    }
}