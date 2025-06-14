/**
 * Qibla Compass Integration for PrayerSync
 * 
 * Integrates the complete Qibla Compass system with the main PrayerSync application.
 * Provides seamless user experience with automatic location synchronization and
 * professional workplace-appropriate interface.
 */

import { QiblaUI, UI_STATES, INTEGRATION_EVENTS } from './QiblaUI.js';

export class QiblaCompassIntegration {
    constructor() {
        this.qiblaUI = null;
        this.isInitialized = false;
        this.app = null;
        
        this.log('QiblaCompassIntegration created');
    }
    
    /**
     * Initialize Qibla Compass integration with PrayerSync
     * @param {Object} app - Reference to main PrayerSync app instance
     * @returns {Promise<boolean>} True if initialized successfully
     */
    async initialize(app) {
        if (this.isInitialized) {
            this.log('Qibla integration already initialized');
            return true;
        }
        
        try {
            this.app = app;
            
            // Add CSS styles to the page
            this.addQiblaStyles();
            
            // Create QiblaUI instance
            this.qiblaUI = new QiblaUI({
                enableKeyboardShortcuts: true,
                autoLocationUpdate: true,
                professionalMode: this.getProfessionalModePreference(),
                enableDebugLogging: this.isDebugMode()
            });
            
            // Initialize with app reference
            const initialized = await this.qiblaUI.initialize(app);
            
            if (initialized) {
                // Set up integration event listeners
                this.setupEventListeners();
                
                this.isInitialized = true;
                this.log('Qibla Compass integration initialized successfully');
                
                // Store global reference for debugging
                window.qiblaIntegration = this;
                
                return true;
            } else {
                throw new Error('Failed to initialize QiblaUI');
            }
            
        } catch (error) {
            console.error('Failed to initialize Qibla Compass integration:', error);
            return false;
        }
    }
    
    /**
     * Add Qibla Compass CSS styles to the page
     */
    addQiblaStyles() {
        // Check if styles are already loaded
        if (document.querySelector('#qibla-compass-styles')) {
            return;
        }
        
        // Create link element for CSS
        const link = document.createElement('link');
        link.id = 'qibla-compass-styles';
        link.rel = 'stylesheet';
        link.href = 'qibla-compass/qibla-compass.css';
        link.type = 'text/css';
        
        // Add to document head
        document.head.appendChild(link);
        
        this.log('Qibla Compass CSS styles added');
    }
    
    /**
     * Set up event listeners for integration
     */
    setupEventListeners() {
        if (!this.qiblaUI) return;
        
        // Listen for Qibla events
        this.qiblaUI.addEventListener(INTEGRATION_EVENTS.QIBLA_OPENED, (event) => {
            this.handleQiblaOpened(event.detail);
        });
        
        this.qiblaUI.addEventListener(INTEGRATION_EVENTS.QIBLA_CLOSED, () => {
            this.handleQiblaClosed();
        });
        
        // Listen for app events that might affect Qibla
        document.addEventListener('prayer-time-calculated', (event) => {
            this.handlePrayerTimeCalculated(event.detail);
        });
        
        document.addEventListener('settings-updated', (event) => {
            this.handleSettingsUpdated(event.detail);
        });
        
        this.log('Event listeners set up for Qibla integration');
    }
    
    /**
     * Handle Qibla compass being opened
     * @param {Object} detail - Event detail with location info
     */
    handleQiblaOpened(detail) {
        this.log('Qibla compass opened', detail);
        
        // Track usage analytics
        this.trackQiblaUsage('qibla_opened', {
            location: detail.location?.city || 'Unknown',
            source: 'header_button'
        });
    }
    
    /**
     * Handle Qibla compass being closed
     */
    handleQiblaClosed() {
        this.log('Qibla compass closed');
        
        // Track usage analytics
        this.trackQiblaUsage('qibla_closed');
    }
    
    /**
     * Handle prayer time calculations (sync location if needed)
     * @param {Object} detail - Prayer time calculation details
     */
    handlePrayerTimeCalculated(detail) {
        // Qibla UI will automatically sync with location changes
        this.log('Prayer times calculated, Qibla location sync handled automatically');
    }
    
    /**
     * Handle settings updates that might affect Qibla compass
     * @param {Object} detail - Settings update details
     */
    handleSettingsUpdated(detail) {
        if (detail.professionalMode !== undefined && this.qiblaUI) {
            // Update professional mode if setting changed
            this.qiblaUI.config.professionalMode = detail.professionalMode;
            this.log('Updated Qibla professional mode:', detail.professionalMode);
        }
    }
    
    /**
     * Get professional mode preference from PrayerSync settings
     * @returns {boolean} Professional mode enabled
     */
    getProfessionalModePreference() {
        // Check for existing professional mode setting
        const professionalModeCheckbox = document.getElementById('professionalMode');
        if (professionalModeCheckbox) {
            return professionalModeCheckbox.checked;
        }
        
        // Default to true for workplace appropriateness
        return true;
    }
    
    /**
     * Check if debug mode is enabled
     * @returns {boolean} Debug mode enabled
     */
    isDebugMode() {
        // Check URL parameters or localStorage for debug mode
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.has('debug') || 
               localStorage.getItem('prayersync-debug') === 'true' ||
               window.location.hostname === 'localhost';
    }
    
    /**
     * Open Qibla compass programmatically
     * @returns {Promise<boolean>} True if opened successfully
     */
    async openQibla() {
        if (!this.isInitialized || !this.qiblaUI) {
            this.log('Qibla integration not initialized');
            return false;
        }
        
        try {
            await this.qiblaUI.openQibla();
            return true;
        } catch (error) {
            console.error('Failed to open Qibla compass:', error);
            return false;
        }
    }
    
    /**
     * Close Qibla compass programmatically
     */
    closeQibla() {
        if (this.qiblaUI) {
            this.qiblaUI.closeQibla();
        }
    }
    
    /**
     * Update Qibla compass location manually
     * @param {Object} location - Location object with lat, lon, city, timezone
     */
    updateLocation(location) {
        if (this.qiblaUI) {
            // Dispatch location change event for automatic sync
            document.dispatchEvent(new CustomEvent('location-change-accepted', {
                detail: { newLocation: location }
            }));
            
            this.log('Qibla location updated:', location);
        }
    }
    
    /**
     * Get current Qibla system status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            qiblaUIStatus: this.qiblaUI?.getStatus() || null,
            professionalMode: this.getProfessionalModePreference(),
            debugMode: this.isDebugMode()
        };
    }
    
    /**
     * Track Qibla compass usage for analytics
     * @param {string} event - Event name
     * @param {Object} properties - Additional properties
     */
    trackQiblaUsage(event, properties = {}) {
        try {
            // Vercel Analytics
            if (window.va) {
                window.va('track', event, {
                    feature: 'qibla_compass',
                    professionalMode: this.getProfessionalModePreference(),
                    ...properties
                });
            }
            
            // Google Analytics (if present)
            if (typeof gtag === 'function') {
                gtag('event', event, {
                    'event_category': 'qibla_compass',
                    'event_label': properties.location || 'unknown',
                    'custom_map': properties
                });
            }
            
            this.log('Analytics tracked:', event, properties);
            
        } catch (error) {
            this.log('Analytics tracking failed:', error);
        }
    }
    
    /**
     * Add Qibla compass to feature highlights (for landing page)
     */
    enhanceFeatureHighlights() {
        // Look for existing Qibla feature highlight
        const qiblaFeature = document.querySelector('.feature-card')?.parentNode
            ?.querySelector('.feature-card:has(.feature-icon svg path[d*="12 2l3.09 6.26"])');
        
        if (qiblaFeature && this.isInitialized) {
            // Add interactive demo button to Qibla feature card
            const demoBtn = document.createElement('button');
            demoBtn.className = 'feature-demo-btn';
            demoBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                </svg>
                Try Compass
            `;
            demoBtn.onclick = () => this.openQibla();
            
            qiblaFeature.appendChild(demoBtn);
            
            this.log('Enhanced Qibla feature highlight with demo button');
        }
    }
    
    /**
     * Clean up and destroy Qibla integration
     */
    destroy() {
        if (this.qiblaUI) {
            this.qiblaUI.destroy();
            this.qiblaUI = null;
        }
        
        // Remove CSS styles
        const stylesLink = document.querySelector('#qibla-compass-styles');
        if (stylesLink) {
            stylesLink.remove();
        }
        
        // Remove global reference
        if (window.qiblaIntegration === this) {
            delete window.qiblaIntegration;
        }
        
        this.isInitialized = false;
        this.log('Qibla Compass integration destroyed');
    }
    
    /**
     * Development logging
     */
    log(...args) {
        if (this.isDebugMode()) {
            console.log('[QiblaCompassIntegration]', ...args);
        }
    }
}

/**
 * Auto-initialize Qibla Compass integration when PrayerSync app is ready
 */
export function initializeQiblaCompass() {
    if (typeof window !== 'undefined') {
        window.addEventListener('DOMContentLoaded', () => {
            // Wait for PrayerSync app to be ready
            setTimeout(async () => {
                if (window.app) {
                    const qiblaIntegration = new QiblaCompassIntegration();
                    
                    try {
                        const initialized = await qiblaIntegration.initialize(window.app);
                        
                        if (initialized) {
                            // Enhance feature highlights if on landing page
                            qiblaIntegration.enhanceFeatureHighlights();
                            
                            console.log('✅ Qibla Compass integration ready');
                        } else {
                            console.warn('⚠️ Qibla Compass integration failed');
                        }
                        
                    } catch (error) {
                        console.error('❌ Failed to initialize Qibla Compass:', error);
                    }
                } else {
                    console.log('ℹ️ PrayerSync app not found, Qibla Compass will be available when app loads');
                }
            }, 1500); // Wait 1.5 seconds for app initialization
        });
    }
}

// Auto-initialize
initializeQiblaCompass();