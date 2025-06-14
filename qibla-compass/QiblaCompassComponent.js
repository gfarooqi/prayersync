/**
 * QiblaCompassComponent - Interactive Qibla Direction Compass
 * 
 * A comprehensive compass component that shows the direction to Mecca with both
 * live device orientation and static fallback modes. Features professional design
 * suitable for workplace use and offline conference room scenarios.
 * 
 * Key Features:
 * - Live compass mode with real-time device orientation
 * - Static compass mode for manual direction finding
 * - Accurate Qibla calculations using QiblaCalculatorService
 * - Professional, workplace-appropriate design
 * - Offline functionality for travel and conference rooms
 * - Calibration support for improved accuracy
 * - Distance display to Mecca
 */

import { QiblaCalculatorService } from './QiblaCalculatorService.js';
import { DeviceOrientationService, ORIENTATION_EVENTS } from './DeviceOrientationService.js';

/**
 * Compass modes
 */
const COMPASS_MODES = {
    LIVE: 'live',       // Real-time device orientation
    STATIC: 'static',   // Manual compass reading
    LOADING: 'loading', // Initializing
    ERROR: 'error'      // Error state
};

/**
 * Compass events
 */
const COMPASS_EVENTS = {
    MODE_CHANGED: 'mode-changed',
    QIBLA_CALCULATED: 'qibla-calculated',
    ORIENTATION_UPDATED: 'orientation-updated',
    CALIBRATION_REQUESTED: 'calibration-requested',
    ERROR_OCCURRED: 'error-occurred'
};

export class QiblaCompassComponent extends EventTarget {
    constructor(container, options = {}) {
        super();
        
        if (!container) {
            throw new Error('Container element is required');
        }
        
        this.container = container;
        this.config = {
            mode: options.mode || COMPASS_MODES.LIVE,
            enableCalibration: options.enableCalibration !== false,
            showDistance: options.showDistance !== false,
            showAccuracy: options.showAccuracy !== false,
            animationDuration: options.animationDuration || 300,
            updateFrequency: options.updateFrequency || 100,
            professionalMode: options.professionalMode !== false,
            ...options
        };
        
        // Services
        this.qiblaCalculator = new QiblaCalculatorService();
        this.orientationService = new DeviceOrientationService({
            updateFrequency: this.config.updateFrequency,
            enableDebugLogging: this.config.enableDebugLogging
        });
        
        // State
        this.currentMode = COMPASS_MODES.LOADING;
        this.qiblaData = null;
        this.deviceHeading = 0;
        this.isInitialized = false;
        this.lastOrientationUpdate = 0;
        
        // Bind event handlers
        this.handleOrientationChange = this.handleOrientationChange.bind(this);
        this.handleCalibrationNeeded = this.handleCalibrationNeeded.bind(this);
        this.handlePermissionDenied = this.handlePermissionDenied.bind(this);
        this.handleOrientationUnavailable = this.handleOrientationUnavailable.bind(this);
        
        this.log('QiblaCompassComponent created');
    }
    
    /**
     * Initialize the compass component
     * @param {Object} location - {latitude, longitude, timezone, city}
     * @returns {Promise<boolean>} True if initialized successfully
     */
    async initialize(location) {
        if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
            throw new Error('Valid location with latitude and longitude is required');
        }
        
        try {
            this.log('Initializing Qibla compass for location:', location);
            
            // Calculate Qibla direction
            this.qiblaData = this.qiblaCalculator.calculate(location);
            
            if (!this.qiblaData) {
                throw new Error('Failed to calculate Qibla direction');
            }
            
            this.log('Qibla calculation result:', this.qiblaData);
            
            // Create UI
            this.createCompassUI();
            
            // Set up orientation service event listeners
            this.setupOrientationListeners();
            
            // Attempt to start live mode if requested
            if (this.config.mode === COMPASS_MODES.LIVE) {
                const orientationStarted = await this.startLiveMode();
                if (!orientationStarted) {
                    this.log('Falling back to static mode');
                    this.setMode(COMPASS_MODES.STATIC);
                }
            } else {
                this.setMode(this.config.mode);
            }
            
            this.isInitialized = true;
            
            // Dispatch initialization event
            this.dispatchEvent(new CustomEvent(COMPASS_EVENTS.QIBLA_CALCULATED, {
                detail: { qiblaData: this.qiblaData, location }
            }));
            
            this.log('Qibla compass initialized successfully');
            return true;
            
        } catch (error) {
            console.error('Failed to initialize Qibla compass:', error);
            this.setMode(COMPASS_MODES.ERROR);
            this.dispatchEvent(new CustomEvent(COMPASS_EVENTS.ERROR_OCCURRED, {
                detail: { error: error.message }
            }));
            return false;
        }
    }
    
    /**
     * Create the compass UI
     */
    createCompassUI() {
        this.container.innerHTML = this.generateCompassHTML();
        this.cacheUIElements();
        this.setupUIEventListeners();
        this.updateQiblaDisplay();
    }
    
    /**
     * Generate compass HTML structure
     * @returns {string} HTML string
     */
    generateCompassHTML() {
        const distanceText = this.qiblaData ? 
            `${this.qiblaData.distanceKm.toLocaleString()} km` : '';
        const directionText = this.qiblaData ? 
            this.qiblaData.cardinalDirection : '';
        
        return `
            <div class="qibla-compass-container">
                <!-- Header -->
                <div class="compass-header">
                    <h3 class="compass-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" class="compass-icon">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        ${this.config.professionalMode ? 'Direction Finder' : 'Qibla Direction'}
                    </h3>
                    <div class="compass-modes">
                        <button class="mode-btn" data-mode="${COMPASS_MODES.LIVE}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                            </svg>
                            Live
                        </button>
                        <button class="mode-btn" data-mode="${COMPASS_MODES.STATIC}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                            Manual
                        </button>
                    </div>
                </div>
                
                <!-- Status Display -->
                <div class="compass-status" id="compassStatus">
                    <div class="status-item">
                        <span class="status-label">Direction:</span>
                        <span class="status-value" id="directionText">${directionText}</span>
                    </div>
                    ${this.config.showDistance ? `
                        <div class="status-item">
                            <span class="status-label">Distance:</span>
                            <span class="status-value" id="distanceText">${distanceText}</span>
                        </div>
                    ` : ''}
                    ${this.config.showAccuracy ? `
                        <div class="status-item">
                            <span class="status-label">Accuracy:</span>
                            <span class="status-value" id="accuracyText">--</span>
                        </div>
                    ` : ''}
                </div>
                
                <!-- Main Compass -->
                <div class="compass-main">
                    <div class="compass-circle" id="compassCircle">
                        <!-- Compass Rose -->
                        <div class="compass-rose" id="compassRose">
                            <!-- Cardinal directions -->
                            <div class="cardinal-mark north" style="transform: rotate(0deg)">
                                <span>N</span>
                            </div>
                            <div class="cardinal-mark east" style="transform: rotate(90deg)">
                                <span>E</span>
                            </div>
                            <div class="cardinal-mark south" style="transform: rotate(180deg)">
                                <span>S</span>
                            </div>
                            <div class="cardinal-mark west" style="transform: rotate(270deg)">
                                <span>W</span>
                            </div>
                            
                            <!-- Degree markings -->
                            ${this.generateDegreeMarkings()}
                        </div>
                        
                        <!-- Qibla Direction Indicator -->
                        <div class="qibla-indicator" id="qiblaIndicator" 
                             style="transform: rotate(${this.qiblaData?.magneticBearing || 0}deg)">
                            <div class="qibla-arrow">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                </svg>
                            </div>
                            <div class="qibla-label">
                                ${this.config.professionalMode ? 'Target' : 'Qibla'}
                            </div>
                        </div>
                        
                        <!-- Device Direction Indicator (for live mode) -->
                        <div class="device-indicator" id="deviceIndicator">
                            <div class="device-arrow">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M7 10l5 5 5-5z"/>
                                </svg>
                            </div>
                        </div>
                        
                        <!-- Center Dot -->
                        <div class="compass-center"></div>
                    </div>
                    
                    <!-- Bearing Display -->
                    <div class="bearing-display">
                        <div class="bearing-value" id="bearingValue">
                            ${Math.round(this.qiblaData?.magneticBearing || 0)}°
                        </div>
                        <div class="bearing-label">to ${this.config.professionalMode ? 'Target' : 'Mecca'}</div>
                    </div>
                </div>
                
                <!-- Mode-specific Content -->
                <div class="mode-content" id="modeContent">
                    <!-- Content will be populated based on current mode -->
                </div>
                
                <!-- Calibration Panel -->
                <div class="calibration-panel" id="calibrationPanel" style="display: none;">
                    <div class="calibration-content">
                        <h4>Compass Calibration</h4>
                        <p>Move your device in a figure-8 pattern to improve accuracy.</p>
                        <div class="calibration-buttons">
                            <button class="btn-secondary" id="skipCalibration">Skip</button>
                            <button class="btn-primary" id="recalibrate">Recalibrate</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Generate degree markings for compass rose
     * @returns {string} HTML for degree markings
     */
    generateDegreeMarkings() {
        let markings = '';
        
        for (let deg = 0; deg < 360; deg += 10) {
            const isMajor = deg % 30 === 0;
            const className = isMajor ? 'degree-mark major' : 'degree-mark minor';
            
            markings += `
                <div class="${className}" style="transform: rotate(${deg}deg)">
                    ${isMajor ? `<span class="degree-text">${deg}</span>` : ''}
                </div>
            `;
        }
        
        return markings;
    }
    
    /**
     * Cache UI elements for efficient access
     */
    cacheUIElements() {
        this.ui = {
            compassCircle: this.container.querySelector('#compassCircle'),
            compassRose: this.container.querySelector('#compassRose'),
            qiblaIndicator: this.container.querySelector('#qiblaIndicator'),
            deviceIndicator: this.container.querySelector('#deviceIndicator'),
            bearingValue: this.container.querySelector('#bearingValue'),
            directionText: this.container.querySelector('#directionText'),
            distanceText: this.container.querySelector('#distanceText'),
            accuracyText: this.container.querySelector('#accuracyText'),
            modeContent: this.container.querySelector('#modeContent'),
            calibrationPanel: this.container.querySelector('#calibrationPanel'),
            modeButtons: this.container.querySelectorAll('.mode-btn'),
            status: this.container.querySelector('#compassStatus')
        };
    }
    
    /**
     * Set up UI event listeners
     */
    setupUIEventListeners() {
        // Mode selection buttons
        this.ui.modeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.switchMode(mode);
            });
        });
        
        // Calibration controls
        const skipBtn = this.container.querySelector('#skipCalibration');
        const recalibrateBtn = this.container.querySelector('#recalibrate');
        
        if (skipBtn) {
            skipBtn.addEventListener('click', () => this.hideCalibration());
        }
        
        if (recalibrateBtn) {
            recalibrateBtn.addEventListener('click', () => this.requestCalibration());
        }
    }
    
    /**
     * Set up orientation service event listeners
     */
    setupOrientationListeners() {
        this.orientationService.addEventListener(ORIENTATION_EVENTS.HEADING_CHANGE, this.handleOrientationChange);
        this.orientationService.addEventListener(ORIENTATION_EVENTS.CALIBRATION_NEEDED, this.handleCalibrationNeeded);
        this.orientationService.addEventListener(ORIENTATION_EVENTS.PERMISSION_DENIED, this.handlePermissionDenied);
        this.orientationService.addEventListener(ORIENTATION_EVENTS.ORIENTATION_UNAVAILABLE, this.handleOrientationUnavailable);
    }
    
    /**
     * Handle device orientation changes
     * @param {CustomEvent} event - Orientation change event
     */
    handleOrientationChange(event) {
        const { heading, accuracy, source } = event.detail;
        
        this.deviceHeading = heading;
        this.lastOrientationUpdate = Date.now();
        
        // Update device indicator rotation
        this.updateDeviceIndicator(heading);
        
        // Update accuracy display
        if (this.config.showAccuracy && this.ui.accuracyText) {
            const accuracyText = accuracy > 0 ? `±${Math.round(accuracy)}°` : 'Unknown';
            this.ui.accuracyText.textContent = accuracyText;
        }
        
        // Dispatch orientation update event
        this.dispatchEvent(new CustomEvent(COMPASS_EVENTS.ORIENTATION_UPDATED, {
            detail: { heading, accuracy, source }
        }));
    }
    
    /**
     * Handle calibration needed
     * @param {CustomEvent} event - Calibration needed event
     */
    handleCalibrationNeeded(event) {
        if (this.config.enableCalibration) {
            this.showCalibration();
        }
    }
    
    /**
     * Handle permission denied
     * @param {CustomEvent} event - Permission denied event
     */
    handlePermissionDenied(event) {
        this.log('Device orientation permission denied');
        this.setMode(COMPASS_MODES.STATIC);
        this.showModeMessage('Permission denied. Using manual mode.');
    }
    
    /**
     * Handle orientation unavailable
     * @param {CustomEvent} event - Orientation unavailable event
     */
    handleOrientationUnavailable(event) {
        this.log('Device orientation unavailable:', event.detail.reason);
        this.setMode(COMPASS_MODES.STATIC);
        this.showModeMessage('Live compass unavailable. Using manual mode.');
    }
    
    /**
     * Start live compass mode
     * @returns {Promise<boolean>} True if started successfully
     */
    async startLiveMode() {
        if (!DeviceOrientationService.isSupported()) {
            return false;
        }
        
        try {
            const started = await this.orientationService.start();
            if (started) {
                this.setMode(COMPASS_MODES.LIVE);
                return true;
            }
        } catch (error) {
            this.log('Failed to start live mode:', error);
        }
        
        return false;
    }
    
    /**
     * Stop live compass mode
     */
    stopLiveMode() {
        this.orientationService.stop();
        this.setMode(COMPASS_MODES.STATIC);
    }
    
    /**
     * Switch compass mode
     * @param {string} mode - Target mode
     */
    async switchMode(mode) {
        if (mode === this.currentMode) {
            return;
        }
        
        this.log('Switching to mode:', mode);
        
        if (mode === COMPASS_MODES.LIVE) {
            const started = await this.startLiveMode();
            if (!started) {
                this.showModeMessage('Live compass not available on this device.');
                return;
            }
        } else if (this.currentMode === COMPASS_MODES.LIVE) {
            this.stopLiveMode();
        }
        
        this.setMode(mode);
    }
    
    /**
     * Set compass mode and update UI
     * @param {string} mode - New mode
     */
    setMode(mode) {
        const previousMode = this.currentMode;
        this.currentMode = mode;
        
        // Update mode button states
        this.ui.modeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        // Update mode-specific content
        this.updateModeContent(mode);
        
        // Update UI visibility
        this.updateUIForMode(mode);
        
        // Dispatch mode change event
        this.dispatchEvent(new CustomEvent(COMPASS_EVENTS.MODE_CHANGED, {
            detail: { mode, previousMode }
        }));
        
        this.log('Mode changed to:', mode);
    }
    
    /**
     * Update mode-specific content
     * @param {string} mode - Current mode
     */
    updateModeContent(mode) {
        let content = '';
        
        switch (mode) {
            case COMPASS_MODES.LIVE:
                content = `
                    <div class="mode-info live-mode">
                        <div class="mode-status">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="status-icon">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
                                <path d="M12 6v6l4 2"/>
                            </svg>
                            <span>Live compass active</span>
                        </div>
                        <p class="mode-description">
                            Hold your device flat and point it toward the highlighted direction.
                        </p>
                    </div>
                `;
                break;
                
            case COMPASS_MODES.STATIC:
                content = `
                    <div class="mode-info static-mode">
                        <div class="mode-status">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="status-icon">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                            <span>Manual compass</span>
                        </div>
                        <p class="mode-description">
                            Use a physical compass or known landmarks to find the ${this.qiblaData?.cardinalDirection} direction (${Math.round(this.qiblaData?.magneticBearing || 0)}°).
                        </p>
                    </div>
                `;
                break;
                
            case COMPASS_MODES.LOADING:
                content = `
                    <div class="mode-info loading-mode">
                        <div class="loading-spinner"></div>
                        <span>Initializing compass...</span>
                    </div>
                `;
                break;
                
            case COMPASS_MODES.ERROR:
                content = `
                    <div class="mode-info error-mode">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="status-icon error">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                        <span>Compass unavailable</span>
                    </div>
                `;
                break;
        }
        
        if (this.ui.modeContent) {
            this.ui.modeContent.innerHTML = content;
        }
    }
    
    /**
     * Update UI elements based on current mode
     * @param {string} mode - Current mode
     */
    updateUIForMode(mode) {
        // Show/hide device indicator based on mode
        if (this.ui.deviceIndicator) {
            this.ui.deviceIndicator.style.display = mode === COMPASS_MODES.LIVE ? 'block' : 'none';
        }
        
        // Update compass circle class for styling
        if (this.ui.compassCircle) {
            this.ui.compassCircle.className = `compass-circle mode-${mode}`;
        }
    }
    
    /**
     * Update device orientation indicator
     * @param {number} heading - Device heading in degrees
     */
    updateDeviceIndicator(heading) {
        if (this.ui.deviceIndicator && this.currentMode === COMPASS_MODES.LIVE) {
            // Smooth rotation with CSS transition
            this.ui.deviceIndicator.style.transform = `rotate(${heading}deg)`;
        }
    }
    
    /**
     * Update Qibla direction display
     */
    updateQiblaDisplay() {
        if (!this.qiblaData) return;
        
        const { magneticBearing, cardinalDirection, distanceKm } = this.qiblaData;
        
        // Update bearing value
        if (this.ui.bearingValue) {
            this.ui.bearingValue.textContent = `${Math.round(magneticBearing)}°`;
        }
        
        // Update direction text
        if (this.ui.directionText) {
            this.ui.directionText.textContent = cardinalDirection;
        }
        
        // Update distance text
        if (this.ui.distanceText && this.config.showDistance) {
            this.ui.distanceText.textContent = `${distanceKm.toLocaleString()} km`;
        }
        
        // Update Qibla indicator position
        if (this.ui.qiblaIndicator) {
            this.ui.qiblaIndicator.style.transform = `rotate(${magneticBearing}deg)`;
        }
    }
    
    /**
     * Show calibration panel
     */
    showCalibration() {
        if (this.ui.calibrationPanel) {
            this.ui.calibrationPanel.style.display = 'block';
        }
        
        this.dispatchEvent(new CustomEvent(COMPASS_EVENTS.CALIBRATION_REQUESTED));
    }
    
    /**
     * Hide calibration panel
     */
    hideCalibration() {
        if (this.ui.calibrationPanel) {
            this.ui.calibrationPanel.style.display = 'none';
        }
    }
    
    /**
     * Request compass calibration
     */
    requestCalibration() {
        // This would trigger device-specific calibration
        this.orientationService.resetCalibration();
        this.hideCalibration();
        this.showModeMessage('Calibration reset. Move device in figure-8 pattern.');
    }
    
    /**
     * Show temporary mode message
     * @param {string} message - Message to show
     */
    showModeMessage(message) {
        if (this.ui.status) {
            const messageEl = document.createElement('div');
            messageEl.className = 'mode-message';
            messageEl.textContent = message;
            
            this.ui.status.appendChild(messageEl);
            
            // Remove after 3 seconds
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 3000);
        }
    }
    
    /**
     * Get current compass status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            currentMode: this.currentMode,
            qiblaData: this.qiblaData,
            deviceHeading: this.deviceHeading,
            orientationStatus: this.orientationService.getStatus(),
            lastUpdate: this.lastOrientationUpdate
        };
    }
    
    /**
     * Destroy the compass component
     */
    destroy() {
        // Stop orientation service
        this.orientationService.stop();
        
        // Remove event listeners
        this.orientationService.removeEventListener(ORIENTATION_EVENTS.HEADING_CHANGE, this.handleOrientationChange);
        this.orientationService.removeEventListener(ORIENTATION_EVENTS.CALIBRATION_NEEDED, this.handleCalibrationNeeded);
        this.orientationService.removeEventListener(ORIENTATION_EVENTS.PERMISSION_DENIED, this.handlePermissionDenied);
        this.orientationService.removeEventListener(ORIENTATION_EVENTS.ORIENTATION_UNAVAILABLE, this.handleOrientationUnavailable);
        
        // Clear container
        this.container.innerHTML = '';
        
        this.log('QiblaCompassComponent destroyed');
    }
    
    /**
     * Development logging
     */
    log(...args) {
        if (this.config.enableDebugLogging) {
            console.log('[QiblaCompassComponent]', ...args);
        }
    }
}

// Export constants for external use
export { COMPASS_MODES, COMPASS_EVENTS };