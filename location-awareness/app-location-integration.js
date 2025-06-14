/**
 * Location Awareness Integration for PrayerSync
 * 
 * Integrates LocationService with the existing PrayerSync app to provide
 * seamless travel detection and prayer time updates.
 */

import { LocationService } from './LocationService.js';
import { LocationPromptUI } from './LocationPromptUI.js';
import { MockProvider } from './geocoding/MockProvider.js';

export class LocationAwarenessIntegration {
    constructor() {
        this.locationService = null;
        this.promptUI = null;
        this.existingApp = null;
        this.calendarManager = null;
        this.isInitialized = false;
        
        this.log('LocationAwarenessIntegration created');
    }
    
    /**
     * Initialize location awareness for PrayerSync app
     * @param {Object} existingApp - Reference to existing PrayerSync app
     * @param {Object} calendarManager - Reference to calendar manager (optional)
     */
    async initialize(existingApp, calendarManager = null) {
        if (this.isInitialized) {
            this.log('Already initialized');
            return;
        }
        
        try {
            this.existingApp = existingApp;
            this.calendarManager = calendarManager;
            
            // Initialize location service
            this.locationService = new LocationService({
                geocodingProvider: new MockProvider(), // TODO: Replace with NominatimProvider
                significantChangeThreshold: 50, // 50km threshold for travel
                enableLogging: true
            });
            
            // Initialize prompt UI
            this.promptUI = new LocationPromptUI({
                autoDismissTimeout: 30000, // 30 seconds
                enableLogging: true
            });
            
            // Set up event listeners
            this.setupLocationEventListeners();
            
            // Initialize with current app location if available
            const currentLocation = this.getCurrentAppLocation();
            if (currentLocation) {
                await this.locationService.initialize(currentLocation);
            } else {
                // Fallback to geolocation detection
                await this.locationService.initialize();
            }
            
            this.isInitialized = true;
            this.log('Location awareness initialized successfully');
            
            // Show initialization notification
            this.promptUI.showLocationNotification(
                'Travel detection enabled. Prayer times will auto-update when you move.',
                'info',
                5000
            );
            
        } catch (error) {
            console.error('Failed to initialize location awareness:', error);
            throw error;
        }
    }
    
    /**
     * Set up event listeners for location service events
     */
    setupLocationEventListeners() {
        // Listen for significant location changes
        document.addEventListener('significant-location-change', (event) => {
            this.handleSignificantLocationChange(event.detail);
        });
        
        // Listen for accepted location changes
        document.addEventListener('location-change-accepted', (event) => {
            this.handleLocationChangeAccepted(event.detail.newLocation);
        });
        
        // Listen for dismissed location changes
        document.addEventListener('location-change-dismissed', (event) => {
            this.handleLocationChangeDismissed();
        });
        
        // Listen for location service errors
        document.addEventListener('location-check-failed', (event) => {
            this.handleLocationCheckFailed(event.detail.error);
        });
        
        this.log('Location event listeners set up');
    }
    
    /**
     * Handle significant location change detection
     */
    handleSignificantLocationChange(changeData) {
        const { previousLocation, newLocation, distance } = changeData;
        
        this.log('Handling significant location change', changeData);
        
        // Show smart prompt to user
        this.promptUI.showLocationChangePrompt(
            changeData,
            // onAccept callback
            (acceptedLocation) => {
                this.locationService.acceptLocationChange(acceptedLocation);
            },
            // onDismiss callback
            () => {
                this.locationService.dismissLocationChange();
            }
        );
    }
    
    /**
     * Handle when user accepts location change
     */
    async handleLocationChangeAccepted(newLocation) {
        this.log('User accepted location change to', newLocation);
        
        try {
            // Update existing app location
            await this.updateAppLocation(newLocation);
            
            // Update calendar if connected
            if (this.calendarManager?.isCalendarConnected()) {
                await this.updateCalendarLocation(newLocation);
            }
            
            // Show success notification
            this.promptUI.showLocationNotification(
                `Prayer times updated for ${newLocation.city}`,
                'success',
                5000
            );
            
        } catch (error) {
            console.error('Failed to update location:', error);
            this.promptUI.showLocationNotification(
                'Failed to update prayer times. Please try manually.',
                'error',
                8000
            );
        }
    }
    
    /**
     * Handle when user dismisses location change
     */
    handleLocationChangeDismissed() {
        this.log('User dismissed location change');
        // No action needed, just log for analytics
    }
    
    /**
     * Handle location check failures
     */
    handleLocationCheckFailed(error) {
        this.log('Location check failed:', error);
        
        // Show user-friendly error if it's a permission issue
        if (error.includes('denied')) {
            this.promptUI.showLocationNotification(
                'Location access denied. Enable location services for automatic updates.',
                'warning',
                8000
            );
        }
    }
    
    /**
     * Update existing app with new location
     */
    async updateAppLocation(newLocation) {
        if (!this.existingApp) {
            throw new Error('Existing app reference not available');
        }
        
        // Update app location data
        this.existingApp.location = {
            latitude: newLocation.latitude,
            longitude: newLocation.longitude
        };
        
        // Update timezone if available
        if (newLocation.timezone) {
            this.existingApp.timezone = newLocation.timezone;
        }
        
        // Update location display in UI
        this.updateLocationDisplay(newLocation);
        
        // Recalculate prayer times for new location
        if (this.existingApp.calculator) {
            this.existingApp.calculator.calculatePrayerTimes(
                newLocation.latitude,
                newLocation.longitude,
                new Date()
            );
            
            // Update prayer times in UI
            if (typeof this.existingApp.updatePrayerTimes === 'function') {
                this.existingApp.updatePrayerTimes();
            }
        }
        
        this.log('App location updated successfully');
    }
    
    /**
     * Update calendar with new location's prayer times
     */
    async updateCalendarLocation(newLocation) {
        if (!this.calendarManager?.isCalendarConnected()) {
            this.log('Calendar not connected, skipping calendar update');
            return;
        }
        
        try {
            this.log('Updating calendar for new location:', newLocation);
            
            // Get current settings
            const settings = this.getCalendarSettings();
            
            // Sync prayer schedule for new location
            const result = await this.calendarManager.syncPrayerSchedule(newLocation, 'month', {
                ...settings,
                replaceExisting: true // Replace existing events with new location times
            });
            
            if (result.success) {
                this.log(`Calendar updated: ${result.eventsCreated} events for ${newLocation.city}`);
            }
            
        } catch (error) {
            console.error('Failed to update calendar:', error);
            throw error;
        }
    }
    
    /**
     * Get current app location data
     */
    getCurrentAppLocation() {
        if (!this.existingApp?.location) {
            return null;
        }
        
        const appLocation = this.existingApp.location;
        const timezone = this.existingApp.timezone || this.detectTimezone();
        const cityName = this.getCurrentLocationName();
        
        return {
            latitude: appLocation.latitude,
            longitude: appLocation.longitude,
            timezone: timezone,
            city: cityName || 'Current Location'
        };
    }
    
    /**
     * Get current calendar settings from existing app
     */
    getCalendarSettings() {
        const settings = {\n            calculationMethod: 'MWL', // Default\n            professionalMode: true,\n            eventDuration: 30\n        };\n        \n        // Try to get settings from existing app\n        if (this.existingApp?.calculator?.calculationMethod) {\n            settings.calculationMethod = this.existingApp.calculator.calculationMethod;\n        }\n        \n        if (this.existingApp?.calendarIntegration) {\n            settings.professionalMode = this.existingApp.calendarIntegration.professionalMode ?? true;\n            settings.eventDuration = this.existingApp.calendarIntegration.eventDuration ?? 30;\n        }\n        \n        return settings;\n    }\n    \n    /**\n     * Update location display in existing app UI\n     */\n    updateLocationDisplay(newLocation) {\n        // Update location badge in header\n        const locationText = document.getElementById('locationText');\n        if (locationText) {\n            locationText.textContent = newLocation.city;\n        }\n        \n        // Update city select dropdown if it exists\n        const citySelect = document.getElementById('citySelect');\n        if (citySelect) {\n            // Try to find matching option\n            const matchingOption = Array.from(citySelect.options).find(option => {\n                const [lat, lon] = option.value.split(',');\n                return lat && lon && \n                       Math.abs(parseFloat(lat) - newLocation.latitude) < 0.1 &&\n                       Math.abs(parseFloat(lon) - newLocation.longitude) < 0.1;\n            });\n            \n            if (matchingOption) {\n                citySelect.value = matchingOption.value;\n            }\n        }\n        \n        this.log('Location display updated');\n    }\n    \n    /**\n     * Get current location name from UI\n     */\n    getCurrentLocationName() {\n        const locationText = document.getElementById('locationText');\n        if (locationText && !locationText.textContent.includes('Detecting')) {\n            return locationText.textContent;\n        }\n        return null;\n    }\n    \n    /**\n     * Detect current timezone\n     */\n    detectTimezone() {\n        try {\n            return Intl.DateTimeFormat().resolvedOptions().timeZone;\n        } catch {\n            return 'UTC';\n        }\n    }\n    \n    /**\n     * Manually trigger location check (for testing/debugging)\n     */\n    checkLocationNow() {\n        if (this.locationService?.isReady()) {\n            this.locationService.performLocationCheck();\n        } else {\n            this.log('Location service not ready');\n        }\n    }\n    \n    /**\n     * Get current location service status\n     */\n    getStatus() {\n        return {\n            initialized: this.isInitialized,\n            locationServiceReady: this.locationService?.isReady() ?? false,\n            currentLocation: this.locationService?.getCurrentLocation(),\n            hasPendingPrompt: this.locationService?.hasPendingLocationPrompt() ?? false\n        };\n    }\n    \n    /**\n     * Clean up resources\n     */\n    destroy() {\n        if (this.locationService) {\n            this.locationService.destroy();\n        }\n        \n        if (this.promptUI?.currentPrompt) {\n            this.promptUI.dismissCurrentPrompt();\n        }\n        \n        this.isInitialized = false;\n        this.log('Location awareness integration destroyed');\n    }\n    \n    /**\n     * Development logging\n     */\n    log(...args) {\n        console.log('[LocationIntegration]', ...args);\n    }\n}\n\n// Auto-initialize when existing app is ready\nexport function initializeLocationAwareness() {\n    // Wait for existing app to be ready\n    if (typeof window !== 'undefined') {\n        window.addEventListener('DOMContentLoaded', () => {\n            // Give existing app time to initialize\n            setTimeout(() => {\n                if (window.app && window.app.calculator) {\n                    const locationIntegration = new LocationAwarenessIntegration();\n                    \n                    // Store reference globally\n                    window.locationIntegration = locationIntegration;\n                    \n                    // Initialize with existing app and calendar manager\n                    locationIntegration.initialize(\n                        window.app,\n                        window.calendarManager || null\n                    ).catch(error => {\n                        console.error('Failed to initialize location awareness:', error);\n                    });\n                } else {\n                    console.warn('PrayerSync app not found, location awareness disabled');\n                }\n            }, 1000); // Wait 1 second for app initialization\n        });\n    }\n}\n\n// Auto-initialize\ninitializeLocationAwareness();"