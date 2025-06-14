/**
 * LocationService - Dynamic Location & Timezone Awareness
 * 
 * Automatically detects when user travels and prompts for prayer time updates.
 * Uses session-based checking and Page Visibility API for smart detection.
 */

import { MockProvider } from './geocoding/MockProvider.js';

export class LocationService {
    constructor(options = {}) {
        this.currentLocation = null;
        this.sessionStartLocation = null;
        this.isInitialized = false;
        
        // Configuration
        this.config = {
            // Distance threshold for "significant change" (in km)
            significantChangeThreshold: options.significantChangeThreshold || 50,
            // How often to check location when page becomes visible (ms)
            checkInterval: options.checkInterval || 30000, // 30 seconds
            // Geocoding provider
            geocodingProvider: options.geocodingProvider || new MockProvider(),
            // Enable console logging for development
            enableLogging: options.enableLogging !== false
        };
        
        // State tracking
        this.lastLocationCheck = null;
        this.isCheckingLocation = false;
        this.pendingLocationPrompt = false;
        
        // Bind methods for event listeners
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.performLocationCheck = this.performLocationCheck.bind(this);
        
        this.log('LocationService initialized with config:', this.config);
    }
    
    /**
     * Initialize the location service
     * @param {Object} initialLocation - {latitude, longitude, city?, timezone?}
     */
    async initialize(initialLocation = null) {
        if (this.isInitialized) {
            this.log('LocationService already initialized');
            return;
        }
        
        try {
            // Set up Page Visibility API listener
            document.addEventListener('visibilitychange', this.handleVisibilityChange);
            
            // Initialize with provided location or detect current location
            if (initialLocation) {
                await this.setLocation(initialLocation);
            } else {
                await this.detectCurrentLocation();
            }
            
            // Mark session start location
            this.sessionStartLocation = { ...this.currentLocation };
            this.isInitialized = true;
            
            this.log('LocationService initialized successfully');
            this.emitLocationEvent('location-service-initialized', {
                location: this.currentLocation,
                sessionStart: this.sessionStartLocation
            });
            
        } catch (error) {
            console.error('Failed to initialize LocationService:', error);
            throw error;
        }
    }
    
    /**
     * Handle Page Visibility API changes
     * Triggers location checks when user returns to the app
     */
    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            this.log('Page became visible, checking for location changes...');
            
            // Debounce rapid visibility changes
            clearTimeout(this.visibilityTimeout);
            this.visibilityTimeout = setTimeout(() => {
                this.performLocationCheck();
            }, 2000); // Wait 2 seconds after page becomes visible
        } else {
            this.log('Page became hidden');
        }
    }
    
    /**
     * Perform location check and detect significant changes
     */
    async performLocationCheck() {
        if (this.isCheckingLocation || this.pendingLocationPrompt) {
            this.log('Location check already in progress or prompt pending');
            return;
        }
        
        try {
            this.isCheckingLocation = true;
            this.log('Starting location check...');
            
            // Get current position
            const newPosition = await this.getCurrentPosition();
            const newCoords = {
                latitude: newPosition.coords.latitude,
                longitude: newPosition.coords.longitude
            };
            
            // Calculate distance from current location
            const distance = this.calculateDistance(
                this.currentLocation.latitude,
                this.currentLocation.longitude,
                newCoords.latitude,
                newCoords.longitude
            );
            
            this.log(`Distance from current location: ${distance.toFixed(2)}km`);
            
            // Check if change is significant
            if (distance >= this.config.significantChangeThreshold) {
                this.log('Significant location change detected!');
                
                // Geocode new location
                const newLocationName = await this.config.geocodingProvider.reverseGeocode(newCoords);
                
                const newLocation = {
                    ...newCoords,
                    city: newLocationName,
                    detectedAt: new Date().toISOString(),
                    distanceFromPrevious: distance
                };
                
                // Emit location change event
                this.emitLocationEvent('significant-location-change', {
                    previousLocation: this.currentLocation,
                    newLocation: newLocation,
                    distance: distance
                });
                
                this.pendingLocationPrompt = true;
                
            } else {
                this.log('Location change not significant, no action needed');
                this.emitLocationEvent('location-check-completed', {
                    distance: distance,
                    significant: false
                });
            }
            
            this.lastLocationCheck = Date.now();
            
        } catch (error) {
            this.log('Location check failed:', error.message);
            this.emitLocationEvent('location-check-failed', { error: error.message });
        } finally {
            this.isCheckingLocation = false;
        }
    }
    
    /**
     * Detect current location using browser geolocation
     * @returns {Promise<Object>} Location with city name
     */
    async detectCurrentLocation() {
        try {
            this.log('Detecting current location...');
            
            const position = await this.getCurrentPosition();
            const coords = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };
            
            // Geocode to get city name
            const cityName = await this.config.geocodingProvider.reverseGeocode(coords);
            
            const location = {
                ...coords,
                city: cityName,
                detectedAt: new Date().toISOString()
            };
            
            await this.setLocation(location);
            this.log('Current location detected:', location);
            
            return location;
            
        } catch (error) {
            this.log('Failed to detect current location:', error.message);
            throw new Error(`Location detection failed: ${error.message}`);
        }
    }
    
    /**
     * Set the current location
     * @param {Object} location - {latitude, longitude, city?, timezone?}
     */
    async setLocation(location) {
        const previousLocation = this.currentLocation;
        
        this.currentLocation = {
            latitude: location.latitude,
            longitude: location.longitude,
            city: location.city || 'Unknown Location',
            timezone: location.timezone || this.detectTimezone(),
            updatedAt: new Date().toISOString()
        };
        
        this.log('Location updated:', this.currentLocation);
        
        this.emitLocationEvent('location-updated', {
            previousLocation,
            currentLocation: this.currentLocation
        });
        
        // Clear pending prompt if location was manually updated
        this.pendingLocationPrompt = false;
    }
    
    /**
     * Accept a detected location change
     * @param {Object} newLocation - The new location to accept
     */
    async acceptLocationChange(newLocation) {
        await this.setLocation(newLocation);
        this.pendingLocationPrompt = false;
        
        this.emitLocationEvent('location-change-accepted', {
            newLocation: this.currentLocation
        });
        
        this.log('Location change accepted:', this.currentLocation);
    }
    
    /**
     * Dismiss a detected location change
     */
    dismissLocationChange() {
        this.pendingLocationPrompt = false;
        
        this.emitLocationEvent('location-change-dismissed', {
            currentLocation: this.currentLocation
        });
        
        this.log('Location change dismissed');
    }
    
    /**
     * Get current position using browser geolocation
     * @returns {Promise<Position>}
     */
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                resolve,
                (error) => {
                    let message = 'Location access failed';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            message = 'Location access denied by user';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            message = 'Location information unavailable';
                            break;
                        case error.TIMEOUT:
                            message = 'Location request timed out';
                            break;
                    }
                    reject(new Error(message));
                },
                {
                    enableHighAccuracy: false, // Faster, less battery drain
                    timeout: 10000, // 10 second timeout
                    maximumAge: 300000 // Accept 5-minute old position
                }
            );
        });
    }
    
    /**
     * Calculate distance between two coordinates using Haversine formula
     * @param {number} lat1 
     * @param {number} lon1 
     * @param {number} lat2 
     * @param {number} lon2 
     * @returns {number} Distance in kilometers
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    /**
     * Convert degrees to radians
     */
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
    
    /**
     * Detect current timezone
     * @returns {string} Timezone identifier
     */
    detectTimezone() {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch {
            return 'UTC';
        }
    }
    
    /**
     * Emit custom location events
     * @param {string} eventType 
     * @param {Object} detail 
     */
    emitLocationEvent(eventType, detail) {
        const event = new CustomEvent(eventType, {
            detail: {
                timestamp: new Date().toISOString(),
                ...detail
            }
        });
        
        document.dispatchEvent(event);
        this.log(`Event emitted: ${eventType}`, detail);
    }
    
    /**
     * Get current location information
     * @returns {Object|null} Current location
     */
    getCurrentLocation() {
        return this.currentLocation;
    }
    
    /**
     * Check if location service is initialized
     * @returns {boolean}
     */
    isReady() {
        return this.isInitialized && this.currentLocation !== null;
    }
    
    /**
     * Check if there's a pending location prompt
     * @returns {boolean}
     */
    hasPendingLocationPrompt() {
        return this.pendingLocationPrompt;
    }
    
    /**
     * Clean up event listeners
     */
    destroy() {
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        clearTimeout(this.visibilityTimeout);
        this.isInitialized = false;
        this.log('LocationService destroyed');
    }
    
    /**
     * Development logging
     */
    log(...args) {
        if (this.config.enableLogging) {
            console.log('[LocationService]', ...args);
        }
    }
}