/**
 * SuggestionEngine - Smart Prayer Time Suggestions
 * 
 * Generates intelligent, ranked suggestions for resolving prayer time conflicts
 * with meeting schedules. Provides user-friendly alternatives with context.
 */

import { 
    SuggestionTypes, 
    ConflictSeverity,
    DataUtils,
    DataValidation 
} from './data-models.js';

export class SuggestionEngine {
    /**
     * Generate smart suggestions for resolving prayer conflicts
     * @param {Conflict} conflict - Detected conflict object
     * @param {ConflictConfig} config - User configuration
     * @returns {Suggestion[]} Array of ranked suggestions
     */
    static generateSuggestions(conflict, config) {
        // Validate input
        if (!DataValidation.isValidConflict(conflict)) {
            throw new Error('Invalid conflict object provided');
        }
        
        const suggestions = [];
        const { prayerWindow, conflictingEvents, analysis } = conflict;
        
        // Generate different types of suggestions based on conflict severity
        switch (analysis.conflictSeverity) {
            case ConflictSeverity.COMPLETE:
                suggestions.push(...this.generateCompleteConflictSuggestions(conflict, config));
                break;
                
            case ConflictSeverity.PARTIAL:
                suggestions.push(...this.generatePartialConflictSuggestions(conflict, config));
                break;
                
            case ConflictSeverity.MINOR:
                suggestions.push(...this.generateMinorConflictSuggestions(conflict, config));
                break;
        }
        
        // Add travel-specific suggestions if applicable
        if (config.travelMode) {
            suggestions.push(...this.generateTravelSuggestions(conflict, config));
        }
        
        // Rank and limit suggestions
        const rankedSuggestions = this.rankSuggestions(suggestions, conflict, config);
        
        // Add unique IDs and finalize
        return rankedSuggestions.slice(0, 5).map((suggestion, index) => ({
            ...suggestion,
            id: `${conflict.prayerName.toLowerCase()}_${suggestion.type.toLowerCase()}_${index}`,
            priority: index + 1
        }));
    }
    
    /**
     * Generate suggestions for complete conflicts (no available slots)
     */
    static generateCompleteConflictSuggestions(conflict, config) {
        const { prayerWindow, conflictingEvents } = conflict;
        const suggestions = [];
        
        // Sort events by start time
        const sortedEvents = [...conflictingEvents].sort(
            (a, b) => new Date(a.start) - new Date(b.start)
        );
        
        const firstEvent = sortedEvents[0];
        const lastEvent = sortedEvents[sortedEvents.length - 1];
        
        // Suggestion 1: Pray before first meeting
        const beforeTime = this.calculateBeforeTime(prayerWindow, firstEvent, config);
        if (beforeTime) {
            suggestions.push({
                type: SuggestionTypes.PRAY_BEFORE,
                displayText: this.generateDisplayText(SuggestionTypes.PRAY_BEFORE, beforeTime, firstEvent),
                newPrayerTime: beforeTime,
                reasoning: {
                    rationale: `Pray before your ${firstEvent.subject.toLowerCase()} to avoid scheduling conflicts`,
                    confidenceScore: 85,
                    preservesOnTime: this.isWithinOnTimeWindow(beforeTime, prayerWindow)
                }
            });
        }
        
        // Suggestion 2: Pray after last meeting  
        const afterTime = this.calculateAfterTime(prayerWindow, lastEvent, config);
        if (afterTime) {
            suggestions.push({
                type: SuggestionTypes.PRAY_AFTER,
                displayText: this.generateDisplayText(SuggestionTypes.PRAY_AFTER, afterTime, lastEvent),
                newPrayerTime: afterTime,
                reasoning: {
                    rationale: `Pray after your ${lastEvent.subject.toLowerCase()} completes`,
                    confidenceScore: 75,
                    preservesOnTime: this.isWithinOnTimeWindow(afterTime, prayerWindow)
                }
            });
        }
        
        // Suggestion 3: Pray at earliest possible time
        const earliestTime = this.calculateEarliestTime(prayerWindow, config);
        suggestions.push({
            type: SuggestionTypes.PRAY_EARLIEST,
            displayText: this.generateDisplayText(SuggestionTypes.PRAY_EARLIEST, earliestTime, null),
            newPrayerTime: earliestTime,
            reasoning: {
                rationale: `Pray as soon as ${conflict.prayerName} time begins for maximum virtue`,
                confidenceScore: 90,
                preservesOnTime: true
            }
        });
        
        return suggestions.filter(s => s !== null);
    }
    
    /**
     * Generate suggestions for partial conflicts (limited time available)
     */
    static generatePartialConflictSuggestions(conflict, config) {
        const { prayerWindow, conflictingEvents, analysis } = conflict;
        const suggestions = [];
        
        // Find available slots
        const availableSlots = this.calculateAvailableSlots(prayerWindow, conflictingEvents);
        const viableSlots = availableSlots.filter(slot => 
            slot.duration >= (config.prayerDuration + config.bufferTime * 2)
        );
        
        if (viableSlots.length > 0) {
            // Suggest the best available slot
            const bestSlot = this.findBestSlot(viableSlots, prayerWindow);
            const slotTime = this.calculateSlotTime(bestSlot, config);
            
            suggestions.push({
                type: SuggestionTypes.PRAY_BETWEEN,
                displayText: this.generateDisplayText(SuggestionTypes.PRAY_BETWEEN, slotTime, null, bestSlot),
                newPrayerTime: slotTime,
                reasoning: {
                    rationale: `Use the ${Math.round(bestSlot.duration)}-minute window between meetings`,
                    confidenceScore: 80,
                    preservesOnTime: this.isWithinOnTimeWindow(slotTime, prayerWindow)
                }
            });
        }
        
        // Add before/after suggestions as backup
        suggestions.push(...this.generateCompleteConflictSuggestions(conflict, config));
        
        return suggestions;
    }
    
    /**
     * Generate suggestions for minor conflicts (easy to resolve)
     */
    static generateMinorConflictSuggestions(conflict, config) {
        const suggestions = [];
        
        // For minor conflicts, offer gentle adjustments
        const { prayerWindow, conflictingEvents } = conflict;
        
        // Find the best natural slots
        const availableSlots = this.calculateAvailableSlots(prayerWindow, conflictingEvents);
        const bestSlots = availableSlots
            .filter(slot => slot.duration >= (config.prayerDuration + config.bufferTime * 2))
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 2);
        
        bestSlots.forEach((slot, index) => {
            const slotTime = this.calculateSlotTime(slot, config);
            suggestions.push({
                type: SuggestionTypes.PRAY_BETWEEN,
                displayText: this.generateDisplayText(SuggestionTypes.PRAY_BETWEEN, slotTime, null, slot),
                newPrayerTime: slotTime,
                reasoning: {
                    rationale: index === 0 ? 
                        `Use the largest available window (${Math.round(slot.duration)} minutes)` :
                        `Alternative ${Math.round(slot.duration)}-minute window available`,
                    confidenceScore: 90 - (index * 10),
                    preservesOnTime: this.isWithinOnTimeWindow(slotTime, prayerWindow)
                }
            });
        });
        
        return suggestions;
    }
    
    /**
     * Generate travel-specific suggestions (prayer combining, etc.)
     */
    static generateTravelSuggestions(conflict, config) {
        const suggestions = [];
        
        // For travelers, suggest combining prayers if applicable
        const combinablePrayers = this.getCombinablePrayers(conflict.prayerName);
        
        if (combinablePrayers.length > 0) {
            combinablePrayers.forEach(combinePrayer => {
                suggestions.push({
                    type: SuggestionTypes.COMBINE_PRAYERS,
                    displayText: `Combine ${conflict.prayerName} with ${combinePrayer} (travel provision)`,
                    newPrayerTime: null, // Special case - handled differently
                    reasoning: {
                        rationale: `Islamic travel provision allows combining prayers during travel`,
                        confidenceScore: 70,
                        preservesOnTime: true
                    }
                });
            });
        }
        
        return suggestions;
    }
    
    /**
     * Calculate suggested prayer time before a meeting
     */
    static calculateBeforeTime(prayerWindow, event, config) {
        const eventStart = new Date(event.start);
        const prayerStart = new Date(prayerWindow.startTime);
        const requiredDuration = config.prayerDuration + config.bufferTime;
        
        // Calculate when prayer should start to finish before meeting
        const suggestedEnd = new Date(eventStart.getTime() - (config.bufferTime * 60 * 1000));
        const suggestedStart = new Date(suggestedEnd.getTime() - (config.prayerDuration * 60 * 1000));
        
        // Ensure it's within prayer window
        if (suggestedStart >= prayerStart && suggestedEnd <= eventStart) {
            return {
                start: suggestedStart.toISOString(),
                end: suggestedEnd.toISOString()
            };
        }
        
        return null;
    }
    
    /**
     * Calculate suggested prayer time after a meeting
     */
    static calculateAfterTime(prayerWindow, event, config) {
        const eventEnd = new Date(event.end);
        const prayerEnd = new Date(prayerWindow.endTime);
        const requiredDuration = config.prayerDuration + config.bufferTime;
        
        // Calculate when prayer should start after meeting ends
        const suggestedStart = new Date(eventEnd.getTime() + (config.bufferTime * 60 * 1000));
        const suggestedEnd = new Date(suggestedStart.getTime() + (config.prayerDuration * 60 * 1000));
        
        // Ensure it's within prayer window
        if (suggestedStart >= eventEnd && suggestedEnd <= prayerEnd) {
            return {
                start: suggestedStart.toISOString(),
                end: suggestedEnd.toISOString()
            };
        }
        
        return null;
    }
    
    /**
     * Calculate earliest possible prayer time
     */
    static calculateEarliestTime(prayerWindow, config) {
        const prayerStart = new Date(prayerWindow.startTime);
        const prayerEnd = new Date(prayerStart.getTime() + (config.prayerDuration * 60 * 1000));
        
        return {
            start: prayerStart.toISOString(),
            end: prayerEnd.toISOString()
        };
    }
    
    /**
     * Calculate prayer time within a specific slot
     */
    static calculateSlotTime(slot, config) {
        // Start prayer 5 minutes into the slot for comfort
        const slotStart = new Date(slot.start);
        const bufferStart = new Date(slotStart.getTime() + (5 * 60 * 1000));
        const prayerEnd = new Date(bufferStart.getTime() + (config.prayerDuration * 60 * 1000));
        
        return {
            start: bufferStart.toISOString(),
            end: prayerEnd.toISOString()
        };
    }
    
    /**
     * Calculate available slots (duplicate from ConflictDetector for independence)
     */
    static calculateAvailableSlots(prayerWindow, conflictingEvents) {
        if (conflictingEvents.length === 0) {
            const totalDuration = DataUtils.getDurationMinutes(prayerWindow.startTime, prayerWindow.endTime);
            return [{
                start: prayerWindow.startTime,
                end: prayerWindow.endTime,
                duration: totalDuration
            }];
        }
        
        // Sort events and merge overlapping ones
        const sortedEvents = [...conflictingEvents].sort((a, b) => 
            new Date(a.start) - new Date(b.start)
        );
        
        const slots = [];
        const prayerStart = new Date(prayerWindow.startTime);
        const prayerEnd = new Date(prayerWindow.endTime);
        
        let currentTime = prayerStart;
        
        for (const event of sortedEvents) {
            const eventStart = new Date(event.start);
            const eventEnd = new Date(event.end);
            
            // Clamp to prayer window
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
            
            currentTime = clampedEnd > currentTime ? clampedEnd : currentTime;
        }
        
        // Add final slot
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
     * Find the best slot from available options
     */
    static findBestSlot(slots, prayerWindow) {
        // Prefer slots that are:
        // 1. Earlier in the prayer window (for virtue)
        // 2. Longer duration (for comfort)
        // 3. Not too close to prayer end time
        
        return slots.reduce((best, current) => {
            const currentScore = this.scoreSlot(current, prayerWindow);
            const bestScore = this.scoreSlot(best, prayerWindow);
            return currentScore > bestScore ? current : best;
        });
    }
    
    /**
     * Score a slot for ranking (higher is better)
     */
    static scoreSlot(slot, prayerWindow) {
        const prayerStart = new Date(prayerWindow.startTime);
        const prayerEnd = new Date(prayerWindow.endTime);
        const slotStart = new Date(slot.start);
        
        const prayerDuration = (prayerEnd - prayerStart) / (1000 * 60);
        const slotPosition = (slotStart - prayerStart) / (1000 * 60);
        
        // Score components
        const earlinessScore = Math.max(0, 100 - (slotPosition / prayerDuration) * 50);
        const durationScore = Math.min(100, slot.duration * 2);
        const comfortScore = slot.duration > 30 ? 20 : 0;
        
        return earlinessScore + durationScore + comfortScore;
    }
    
    /**
     * Check if prayer time is within the preferred "on time" window
     */
    static isWithinOnTimeWindow(prayerTime, prayerWindow) {
        const prayerStart = new Date(prayerWindow.startTime);
        const suggestedStart = new Date(prayerTime.start);
        const windowMinutes = 30; // First 30 minutes considered "on time"
        
        return (suggestedStart - prayerStart) <= (windowMinutes * 60 * 1000);
    }
    
    /**
     * Generate user-friendly display text
     */
    static generateDisplayText(type, prayerTime, relatedEvent = null, slot = null) {
        const timeStr = prayerTime ? new Date(prayerTime.start).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }) : '';
        
        switch (type) {
            case SuggestionTypes.PRAY_BEFORE:
                return `Pray at ${timeStr} (before ${relatedEvent.subject})`;
                
            case SuggestionTypes.PRAY_AFTER:
                return `Pray at ${timeStr} (after ${relatedEvent.subject})`;
                
            case SuggestionTypes.PRAY_EARLIEST:
                return `Pray at ${timeStr} (as soon as prayer time begins)`;
                
            case SuggestionTypes.PRAY_BETWEEN:
                const duration = slot ? Math.round(slot.duration) : '';
                return `Pray at ${timeStr} (${duration}-minute window available)`;
                
            case SuggestionTypes.PRAY_LATEST:
                return `Pray at ${timeStr} (before prayer time ends)`;
                
            default:
                return `Pray at ${timeStr}`;
        }
    }
    
    /**
     * Get prayers that can be combined with the given prayer (for travelers)
     */
    static getCombinablePrayers(prayerName) {
        const combinations = {
            'Dhuhr': ['Asr'],
            'Asr': ['Dhuhr'],
            'Maghrib': ['Isha'],
            'Isha': ['Maghrib']
        };
        
        return combinations[prayerName] || [];
    }
    
    /**
     * Rank suggestions by priority and user preferences
     */
    static rankSuggestions(suggestions, conflict, config) {
        return suggestions.sort((a, b) => {
            // Primary: Preserve on-time prayer
            if (a.reasoning.preservesOnTime !== b.reasoning.preservesOnTime) {
                return b.reasoning.preservesOnTime ? 1 : -1;
            }
            
            // Secondary: Confidence score
            if (a.reasoning.confidenceScore !== b.reasoning.confidenceScore) {
                return b.reasoning.confidenceScore - a.reasoning.confidenceScore;
            }
            
            // Tertiary: Preference order (before > between > after > earliest)
            const typePreference = {
                [SuggestionTypes.PRAY_BEFORE]: 4,
                [SuggestionTypes.PRAY_BETWEEN]: 3,
                [SuggestionTypes.PRAY_AFTER]: 2,
                [SuggestionTypes.PRAY_EARLIEST]: 1,
                [SuggestionTypes.COMBINE_PRAYERS]: 0
            };
            
            return (typePreference[b.type] || 0) - (typePreference[a.type] || 0);
        });
    }
}