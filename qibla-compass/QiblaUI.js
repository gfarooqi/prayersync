/**
 * QiblaUI - PrayerSync Integration for Qibla Compass
 * 
 * Provides seamless integration of the Qibla Compass system with the existing
 * PrayerSync application. Handles UI integration, modal management, and
 * user interaction workflows.
 * 
 * Key Features:
 * - Modal-based Qibla compass interface
 * - Integration with existing PrayerSync location system
 * - Professional workplace-appropriate design
 * - Mobile-responsive interface
 * - Offline functionality for travel scenarios
 * - Settings integration with PrayerSync preferences
 */

import { QiblaCompassComponent, COMPASS_MODES, COMPASS_EVENTS } from './QiblaCompassComponent.js';

/**
 * UI States for Qibla integration
 */
const UI_STATES = {
    HIDDEN: 'hidden',
    LOADING: 'loading',
    READY: 'ready',
    ERROR: 'error'
};

/**
 * Integration events
 */
const INTEGRATION_EVENTS = {
    QIBLA_OPENED: 'qibla-opened',
    QIBLA_CLOSED: 'qibla-closed',
    LOCATION_CHANGED: 'location-changed',
    SETTINGS_UPDATED: 'settings-updated'
};

export class QiblaUI extends EventTarget {
    constructor(options = {}) {
        super();
        
        this.config = {
            modalId: options.modalId || 'qiblaModal',
            triggerId: options.triggerId || 'qiblaBtn',
            enableKeyboardShortcuts: options.enableKeyboardShortcuts !== false,
            autoLocationUpdate: options.autoLocationUpdate !== false,
            professionalMode: options.professionalMode !== false,
            ...options
        };
        
        // State
        this.currentState = UI_STATES.HIDDEN;
        this.compassComponent = null;
        this.modal = null;
        this.isInitialized = false;
        this.currentLocation = null;
        
        // Integration with existing PrayerSync app
        this.app = null;
        this.existingLocationService = null;
        
        // Bind event handlers
        this.handleLocationChange = this.handleLocationChange.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        
        this.log('QiblaUI created');
    }
    
    /**
     * Initialize Qibla UI integration
     * @param {Object} app - Reference to main PrayerSync app
     * @returns {Promise<boolean>} True if initialized successfully
     */
    async initialize(app) {
        if (this.isInitialized) {
            this.log('QiblaUI already initialized');
            return true;
        }
        
        try {
            this.app = app;
            
            // Create UI elements
            this.createQiblaButton();
            this.createQiblaModal();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Connect to existing location service if available
            if (this.config.autoLocationUpdate && app?.location) {
                this.connectToLocationService(app);
            }
            
            this.isInitialized = true;
            this.log('QiblaUI initialized successfully');
            
            return true;
            
        } catch (error) {
            console.error('Failed to initialize QiblaUI:', error);
            return false;
        }
    }
    
    /**
     * Create Qibla compass button in the app header
     */
    createQiblaButton() {
        // Look for existing button first
        let qiblaBtn = document.getElementById(this.config.triggerId);
        
        if (!qiblaBtn) {
            // Create new button and add to header
            const headerRight = document.querySelector('.header-left') || 
                               document.querySelector('.app-header .header-content');
            
            if (headerRight) {
                qiblaBtn = document.createElement('button');
                qiblaBtn.id = this.config.triggerId;
                qiblaBtn.className = 'qibla-btn header-btn';
                qiblaBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    <span class="btn-text">${this.config.professionalMode ? 'Compass' : 'Qibla'}</span>
                `;
                qiblaBtn.title = this.config.professionalMode ? 
                    'Direction Compass' : 'Qibla Direction Compass';
                
                headerRight.appendChild(qiblaBtn);
                this.log('Created Qibla button in header');
            }
        }
        
        // Set up click handler
        if (qiblaBtn) {
            qiblaBtn.addEventListener('click', () => this.openQibla());
        }
    }
    
    /**
     * Create Qibla compass modal
     */
    createQiblaModal() {
        // Remove existing modal if present
        const existingModal = document.getElementById(this.config.modalId);
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal element
        this.modal = document.createElement('div');
        this.modal.id = this.config.modalId;
        this.modal.className = 'modal qibla-modal';
        this.modal.style.display = 'none';
        
        this.modal.innerHTML = this.generateModalHTML();
        
        // Add to document
        document.body.appendChild(this.modal);
        
        this.log('Created Qibla modal');
    }
    
    /**
     * Generate modal HTML structure
     * @returns {string} Modal HTML
     */
    generateModalHTML() {
        return `
            <div class="modal-overlay" onclick="window.qiblaUI?.closeQibla()"></div>
            <div class="modal-container qibla-modal-container">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" class="modal-icon">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        ${this.config.professionalMode ? 'Direction Compass' : 'Qibla Compass'}
                    </h2>
                    <button type="button" class="modal-close" onclick="window.qiblaUI?.closeQibla()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                </div>
                
                <div class="modal-body">
                    <!-- Location Display -->
                    <div class="qibla-location" id="qiblaLocation">
                        <div class="location-info">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                            </svg>
                            <span id="currentLocationText">Detecting location...</span>
                        </div>
                        <button type="button" class="location-change-btn" onclick="window.qiblaUI?.changeLocation()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                            </svg>
                            Change
                        </button>
                    </div>
                    
                    <!-- Compass Container -->
                    <div class="qibla-compass-wrapper" id="qiblaCompassWrapper">
                        <!-- Compass component will be rendered here -->
                    </div>
                    
                    <!-- Loading State -->
                    <div class="qibla-loading" id="qiblaLoading" style="display: none;">
                        <div class="loading-spinner"></div>
                        <p>Calculating Qibla direction...</p>
                    </div>
                    
                    <!-- Error State -->
                    <div class="qibla-error" id="qiblaError" style="display: none;">
                        <div class="error-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                        </div>
                        <h3>Compass Unavailable</h3>
                        <p id="errorMessage">Unable to determine Qibla direction. Please check your location settings.</p>
                        <button type="button" class="btn-primary" onclick="window.qiblaUI?.retryQibla()">
                            Try Again
                        </button>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <div class="qibla-tips">
                        <div class="tip-item">
                            <svg width="16" height="16" viewBox="0 0 24 24\" fill=\"currentColor\">
                                <path d=\"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z\"/>
                            </svg>
                            <span>Hold device flat for best accuracy</span>
                        </div>
                        <div class="tip-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                            <span>Switch to manual mode if live compass unavailable</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Keyboard shortcuts
        if (this.config.enableKeyboardShortcuts) {
            document.addEventListener('keydown', this.handleKeyPress);
        }
        
        // Listen for location changes from PrayerSync app
        document.addEventListener('location-change-accepted', this.handleLocationChange);
        
        // Store global reference for onclick handlers
        window.qiblaUI = this;
    }
    
    /**
     * Connect to existing location service
     * @param {Object} app - PrayerSync app instance
     */
    connectToLocationService(app) {
        if (app.location) {
            this.currentLocation = {
                latitude: app.location.latitude,
                longitude: app.location.longitude,
                timezone: app.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                city: this.getCurrentLocationName() || 'Current Location'
            };
            
            this.log('Connected to existing location service:', this.currentLocation);
        }
    }
    
    /**
     * Get current location name from PrayerSync UI
     * @returns {string|null} Location name or null
     */
    getCurrentLocationName() {
        const locationText = document.getElementById('locationText');
        if (locationText && !locationText.textContent.includes('Detecting')) {
            return locationText.textContent;
        }
        return null;
    }
    
    /**
     * Open Qibla compass modal
     */
    async openQibla() {
        if (!this.isInitialized) {
            this.log('QiblaUI not initialized');
            return;
        }
        
        this.log('Opening Qibla compass');
        
        // Show modal
        this.modal.style.display = 'flex';
        this.setState(UI_STATES.LOADING);
        
        // Get current location
        await this.updateLocation();
        
        // Initialize compass component
        await this.initializeCompass();
        
        // Dispatch event
        this.dispatchEvent(new CustomEvent(INTEGRATION_EVENTS.QIBLA_OPENED, {
            detail: { location: this.currentLocation }
        }));
        
        // Analytics tracking
        this.trackQiblaUsage();
    }
    
    /**
     * Close Qibla compass modal
     */
    closeQibla() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
        
        // Destroy compass component to stop orientation tracking
        if (this.compassComponent) {
            this.compassComponent.destroy();
            this.compassComponent = null;
        }
        
        this.setState(UI_STATES.HIDDEN);
        
        // Dispatch event
        this.dispatchEvent(new CustomEvent(INTEGRATION_EVENTS.QIBLA_CLOSED));
        
        this.log('Qibla compass closed');
    }
    
    /**
     * Update location information
     */
    async updateLocation() {
        try {
            // Get location from PrayerSync app
            if (this.app?.location) {
                this.currentLocation = {
                    latitude: this.app.location.latitude,
                    longitude: this.app.location.longitude,
                    timezone: this.app.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                    city: this.getCurrentLocationName() || 'Current Location'
                };
            } else {
                throw new Error('Location not available from PrayerSync app');
            }
            
            // Update location display
            this.updateLocationDisplay();
            
            this.log('Location updated:', this.currentLocation);
            
        } catch (error) {
            console.error('Failed to update location:', error);
            this.setState(UI_STATES.ERROR);
        }
    }
    
    /**
     * Update location display in modal
     */
    updateLocationDisplay() {
        const locationText = document.getElementById('currentLocationText');
        if (locationText && this.currentLocation) {
            locationText.textContent = this.currentLocation.city;
        }
    }
    
    /**
     * Initialize compass component
     */
    async initializeCompass() {
        if (!this.currentLocation) {
            this.setState(UI_STATES.ERROR);
            return;
        }
        
        try {
            const compassWrapper = document.getElementById('qiblaCompassWrapper');
            if (!compassWrapper) {
                throw new Error('Compass wrapper not found');
            }
            
            // Create compass component
            this.compassComponent = new QiblaCompassComponent(compassWrapper, {
                professionalMode: this.config.professionalMode,
                enableDebugLogging: this.config.enableDebugLogging
            });
            
            // Set up compass event listeners
            this.setupCompassListeners();
            
            // Initialize with current location
            const initialized = await this.compassComponent.initialize(this.currentLocation);
            
            if (initialized) {
                this.setState(UI_STATES.READY);
                this.log('Compass component initialized successfully');
            } else {
                throw new Error('Failed to initialize compass component');
            }
            
        } catch (error) {
            console.error('Failed to initialize compass:', error);
            this.setState(UI_STATES.ERROR);
            this.showError(error.message);
        }
    }
    
    /**
     * Set up compass component event listeners
     */
    setupCompassListeners() {
        if (!this.compassComponent) return;
        
        this.compassComponent.addEventListener(COMPASS_EVENTS.MODE_CHANGED, (event) => {
            this.log('Compass mode changed:', event.detail.mode);
        });
        
        this.compassComponent.addEventListener(COMPASS_EVENTS.QIBLA_CALCULATED, (event) => {
            this.log('Qibla calculated:', event.detail.qiblaData);
        });
        
        this.compassComponent.addEventListener(COMPASS_EVENTS.ERROR_OCCURRED, (event) => {
            this.showError(event.detail.error);
        });
    }
    
    /**
     * Handle location change events from PrayerSync
     * @param {CustomEvent} event - Location change event
     */
    handleLocationChange(event) {
        if (this.config.autoLocationUpdate && event.detail?.newLocation) {
            this.currentLocation = {
                latitude: event.detail.newLocation.latitude,
                longitude: event.detail.newLocation.longitude,
                timezone: event.detail.newLocation.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                city: event.detail.newLocation.city || 'Current Location'
            };
            
            this.updateLocationDisplay();
            
            // Reinitialize compass if modal is open
            if (this.currentState !== UI_STATES.HIDDEN && this.compassComponent) {
                this.initializeCompass();
            }
            
            this.log('Location updated from PrayerSync:', this.currentLocation);
        }
    }
    
    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyPress(event) {
        // Escape key to close modal
        if (event.key === 'Escape' && this.currentState !== UI_STATES.HIDDEN) {
            this.closeQibla();
        }
        
        // Ctrl/Cmd + Q to open Qibla compass
        if ((event.ctrlKey || event.metaKey) && event.key === 'q' && this.currentState === UI_STATES.HIDDEN) {
            event.preventDefault();
            this.openQibla();
        }
    }
    
    /**
     * Change location (opens PrayerSync location modal)
     */
    changeLocation() {
        // Close Qibla modal first
        this.closeQibla();
        
        // Open PrayerSync location modal if available
        if (typeof window.openLocationModal === 'function') {
            window.openLocationModal();
        } else {
            this.log('Location modal not available in PrayerSync');
        }
    }
    
    /**
     * Retry Qibla calculation
     */
    async retryQibla() {
        this.setState(UI_STATES.LOADING);
        await this.updateLocation();
        await this.initializeCompass();
    }
    
    /**
     * Set UI state and update display
     * @param {string} state - New UI state
     */
    setState(state) {
        this.currentState = state;
        
        // Update UI elements visibility
        const elements = {
            loading: document.getElementById('qiblaLoading'),
            error: document.getElementById('qiblaError'),
            wrapper: document.getElementById('qiblaCompassWrapper')
        };
        
        // Hide all elements first
        Object.values(elements).forEach(el => {
            if (el) el.style.display = 'none';
        });
        
        // Show appropriate element
        switch (state) {
            case UI_STATES.LOADING:
                if (elements.loading) elements.loading.style.display = 'block';
                break;
            case UI_STATES.ERROR:
                if (elements.error) elements.error.style.display = 'block';
                break;
            case UI_STATES.READY:
                if (elements.wrapper) elements.wrapper.style.display = 'block';
                break;
        }
        
        this.log('UI state changed to:', state);
    }
    
    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
            errorMessage.textContent = message;
        }
        
        this.setState(UI_STATES.ERROR);
    }
    
    /**
     * Track Qibla compass usage for analytics
     */
    trackQiblaUsage() {
        try {
            // Vercel Analytics
            if (window.va) {
                window.va('track', 'Qibla Compass Opened', {
                    location: this.currentLocation?.city || 'Unknown',
                    professionalMode: this.config.professionalMode
                });
            }
            
            // Google Analytics (if present)
            if (typeof gtag === 'function') {
                gtag('event', 'qibla_compass_open', {
                    'event_category': 'engagement',
                    'event_label': this.currentLocation?.city || 'Unknown'
                });
            }
            
        } catch (error) {
            this.log('Analytics tracking failed:', error);
        }
    }
    
    /**
     * Get current UI status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            currentState: this.currentState,
            currentLocation: this.currentLocation,
            compassStatus: this.compassComponent?.getStatus(),
            modalVisible: this.modal?.style.display !== 'none'
        };
    }
    
    /**
     * Clean up and destroy QiblaUI
     */
    destroy() {
        // Remove event listeners
        document.removeEventListener('keydown', this.handleKeyPress);
        document.removeEventListener('location-change-accepted', this.handleLocationChange);
        
        // Destroy compass component
        if (this.compassComponent) {
            this.compassComponent.destroy();
        }
        
        // Remove modal from DOM
        if (this.modal && this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }
        
        // Remove global reference
        if (window.qiblaUI === this) {
            delete window.qiblaUI;
        }
        
        this.log('QiblaUI destroyed');
    }
    
    /**
     * Development logging
     */
    log(...args) {
        if (this.config.enableDebugLogging) {
            console.log('[QiblaUI]', ...args);
        }
    }
}

// Export constants for external use
export { UI_STATES, INTEGRATION_EVENTS };