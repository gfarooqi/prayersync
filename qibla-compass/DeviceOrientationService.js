/**
 * DeviceOrientationService - Cross-Browser Device Orientation Management
 * 
 * Handles device orientation API across different browsers and platforms with
 * proper normalization, calibration, and permissions management.
 * 
 * Key Features:
 * - Cross-browser compass heading normalization (iOS Safari vs Android/Others)
 * - Automatic permission handling for iOS 13+
 * - Calibration support for improved accuracy
 * - Real-time orientation updates with debouncing
 * - Fallback modes for unsupported devices
 */

// Browser compatibility constants
const ORIENTATION_CAPABILITIES = {
    DEVICE_ORIENTATION_SUPPORTED: 'DeviceOrientationEvent' in window,
    ABSOLUTE_ORIENTATION_SUPPORTED: 'DeviceOrientationEvent' in window && 'absolute' in DeviceOrientationEvent.prototype,
    WEBKIT_COMPASS_SUPPORTED: 'webkitCompassHeading' in (DeviceOrientationEvent.prototype || {}),
    PERMISSIONS_API_SUPPORTED: 'permissions' in navigator
};

// Orientation event types
const ORIENTATION_EVENTS = {
    HEADING_CHANGE: 'heading-change',
    ACCURACY_CHANGE: 'accuracy-change',
    CALIBRATION_NEEDED: 'calibration-needed',
    PERMISSION_DENIED: 'permission-denied',
    ORIENTATION_UNAVAILABLE: 'orientation-unavailable'
};

/**
 * Device orientation data structure
 * @typedef {Object} OrientationData
 * @property {number} heading - Compass heading in degrees (0-360)
 * @property {number} accuracy - Heading accuracy estimate (-1 if unknown)
 * @property {boolean} isAbsolute - Whether heading is absolute (true north) or relative
 * @property {string} source - Source of orientation data ('webkit', 'alpha', 'manual')
 * @property {boolean} needsCalibration - Whether device needs calibration
 * @property {number} timestamp - Timestamp of the reading
 */

export class DeviceOrientationService extends EventTarget {
    constructor(options = {}) {
        super();
        
        // Configuration
        this.config = {
            updateFrequency: options.updateFrequency || 100, // ms
            accuracyThreshold: options.accuracyThreshold || 15, // degrees
            calibrationTimeout: options.calibrationTimeout || 5000, // ms
            enableDebugLogging: options.enableDebugLogging || false,
            ...options
        };
        
        // State
        this.isActive = false;
        this.hasPermission = false;
        this.currentOrientation = null;
        this.calibrationOffset = 0;
        this.lastUpdateTime = 0;
        
        // Event handlers (bound for proper cleanup)
        this.handleDeviceOrientation = this.handleDeviceOrientation.bind(this);
        this.handleAbsoluteOrientation = this.handleAbsoluteOrientation.bind(this);
        
        this.log('DeviceOrientationService created', { capabilities: ORIENTATION_CAPABILITIES });
    }
    
    /**
     * Check if device orientation is supported
     * @returns {boolean} True if orientation is supported
     */
    static isSupported() {
        return ORIENTATION_CAPABILITIES.DEVICE_ORIENTATION_SUPPORTED;
    }
    
    /**
     * Get device capabilities
     * @returns {Object} Capability information
     */
    static getCapabilities() {
        return {
            ...ORIENTATION_CAPABILITIES,
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
            isAndroid: /Android/.test(navigator.userAgent),
            isSafari: /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
        };
    }
    
    /**
     * Request device orientation permissions and start orientation tracking
     * @param {Object} options - Startup options
     * @returns {Promise<boolean>} True if successfully started
     */
    async start(options = {}) {
        if (this.isActive) {
            this.log('Orientation service already active');
            return true;
        }
        
        if (!DeviceOrientationService.isSupported()) {
            this.log('Device orientation not supported');
            this.dispatchEvent(new CustomEvent(ORIENTATION_EVENTS.ORIENTATION_UNAVAILABLE, {
                detail: { reason: 'Device orientation API not supported' }
            }));
            return false;
        }
        
        try {
            // Request permissions (iOS 13+)
            const permissionGranted = await this.requestPermissions();
            if (!permissionGranted) {
                this.log('Permission denied for device orientation');
                this.dispatchEvent(new CustomEvent(ORIENTATION_EVENTS.PERMISSION_DENIED));
                return false;
            }
            
            // Start listening for orientation events
            this.startOrientationListening();
            this.isActive = true;
            
            this.log('Device orientation service started successfully');
            return true;
            
        } catch (error) {
            console.error('Failed to start device orientation service:', error);
            this.dispatchEvent(new CustomEvent(ORIENTATION_EVENTS.ORIENTATION_UNAVAILABLE, {
                detail: { reason: error.message }
            }));
            return false;
        }
    }
    
    /**
     * Stop orientation tracking
     */
    stop() {
        if (!this.isActive) {
            return;
        }
        
        // Remove event listeners
        window.removeEventListener('deviceorientation', this.handleDeviceOrientation);
        window.removeEventListener('deviceorientationabsolute', this.handleAbsoluteOrientation);
        
        this.isActive = false;
        this.currentOrientation = null;
        
        this.log('Device orientation service stopped');
    }
    
    /**
     * Request device orientation permissions (iOS 13+)
     * @returns {Promise<boolean>} True if permission granted
     */
    async requestPermissions() {
        // Check if we need to request permissions (iOS 13+)
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                this.hasPermission = permission === 'granted';
                this.log('iOS permission result:', permission);
                return this.hasPermission;
            } catch (error) {
                this.log('Permission request failed:', error);
                return false;
            }
        }
        
        // For other platforms, assume permission is granted
        this.hasPermission = true;
        return true;
    }
    
    /**
     * Start listening for device orientation events
     */
    startOrientationListening() {
        // Prefer absolute orientation if available
        if (ORIENTATION_CAPABILITIES.ABSOLUTE_ORIENTATION_SUPPORTED) {
            this.log('Using deviceorientationabsolute events');
            window.addEventListener('deviceorientationabsolute', this.handleAbsoluteOrientation, true);
        }
        
        // Always listen to regular orientation as fallback
        this.log('Using deviceorientation events');
        window.addEventListener('deviceorientation', this.handleDeviceOrientation, true);
    }
    
    /**
     * Handle device orientation events (primary handler)
     * @param {DeviceOrientationEvent} event - Orientation event
     */
    handleDeviceOrientation(event) {
        // Skip if we already have absolute orientation
        if (this.currentOrientation?.source === 'absolute') {
            return;
        }
        
        const now = Date.now();
        
        // Throttle updates based on configuration
        if (now - this.lastUpdateTime < this.config.updateFrequency) {
            return;
        }
        
        this.lastUpdateTime = now;
        
        try {
            const orientation = this.processOrientationEvent(event, false);
            if (orientation) {
                this.updateCurrentOrientation(orientation);
            }
        } catch (error) {
            console.error('Error processing device orientation:', error);
        }
    }
    
    /**
     * Handle absolute device orientation events (preferred)
     * @param {DeviceOrientationEvent} event - Absolute orientation event
     */
    handleAbsoluteOrientation(event) {
        const now = Date.now();
        
        // Throttle updates
        if (now - this.lastUpdateTime < this.config.updateFrequency) {
            return;
        }
        
        this.lastUpdateTime = now;
        
        try {
            const orientation = this.processOrientationEvent(event, true);
            if (orientation) {
                this.updateCurrentOrientation(orientation);
            }
        } catch (error) {
            console.error('Error processing absolute orientation:', error);
        }
    }
    
    /**
     * Process orientation event and normalize heading
     * @param {DeviceOrientationEvent} event - Orientation event
     * @param {boolean} isAbsolute - Whether event is absolute orientation
     * @returns {OrientationData|null} Processed orientation data
     */
    processOrientationEvent(event, isAbsolute) {
        let heading = null;
        let accuracy = -1;
        let source = 'unknown';
        let needsCalibration = false;
        
        // iOS Safari - webkitCompassHeading (preferred for iOS)
        if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
            heading = event.webkitCompassHeading;
            accuracy = event.webkitCompassAccuracy || -1;
            source = 'webkit';
            
            // Check if calibration is needed (iOS specific)
            if (accuracy < 0 || accuracy > this.config.accuracyThreshold) {
                needsCalibration = true;
            }
            
            this.log('iOS compass heading:', heading, 'accuracy:', accuracy);
        }
        // Android/Others - use alpha with normalization
        else if (event.alpha !== undefined && event.alpha !== null) {
            // Normalize alpha to compass heading
            // Alpha: 0° = North, 90° = East, 180° = South, 270° = West
            // Compass: 0° = North, 90° = East, 180° = South, 270° = West
            heading = (360 - event.alpha) % 360;
            source = isAbsolute ? 'absolute' : 'alpha';
            
            // Estimate accuracy based on device motion stability
            accuracy = this.estimateAccuracy(event);
            
            this.log('Alpha heading:', event.alpha, 'normalized:', heading, 'absolute:', isAbsolute);
        }
        
        if (heading === null) {
            this.log('No valid heading data in orientation event');
            return null;
        }
        
        // Apply calibration offset if available
        if (this.calibrationOffset !== 0) {
            heading = (heading + this.calibrationOffset) % 360;
            if (heading < 0) heading += 360;
        }
        
        return {
            heading: Math.round(heading * 10) / 10, // Round to 1 decimal place
            accuracy: accuracy,
            isAbsolute: isAbsolute || source === 'webkit',
            source: source,
            needsCalibration: needsCalibration,
            timestamp: Date.now()
        };
    }
    
    /**
     * Estimate heading accuracy for non-iOS devices
     * @param {DeviceOrientationEvent} event - Orientation event
     * @returns {number} Estimated accuracy in degrees
     */
    estimateAccuracy(event) {
        // Use beta and gamma to estimate device stability
        const beta = Math.abs(event.beta || 0);
        const gamma = Math.abs(event.gamma || 0);
        
        // More tilt = less accurate compass heading
        const tiltFactor = Math.sqrt(beta * beta + gamma * gamma);
        
        if (tiltFactor < 10) {
            return 5; // Good accuracy when device is relatively flat
        } else if (tiltFactor < 30) {
            return 15; // Medium accuracy
        } else {
            return 30; // Poor accuracy when device is tilted
        }
    }
    
    /**
     * Update current orientation and dispatch events
     * @param {OrientationData} orientation - New orientation data
     */
    updateCurrentOrientation(orientation) {
        const previousOrientation = this.currentOrientation;
        this.currentOrientation = orientation;
        
        // Dispatch heading change event
        this.dispatchEvent(new CustomEvent(ORIENTATION_EVENTS.HEADING_CHANGE, {
            detail: {
                heading: orientation.heading,
                accuracy: orientation.accuracy,
                isAbsolute: orientation.isAbsolute,
                source: orientation.source,
                previousHeading: previousOrientation?.heading,
                timestamp: orientation.timestamp
            }
        }));
        
        // Dispatch accuracy change if significant
        if (!previousOrientation || 
            Math.abs(orientation.accuracy - previousOrientation.accuracy) > 5) {
            this.dispatchEvent(new CustomEvent(ORIENTATION_EVENTS.ACCURACY_CHANGE, {
                detail: {
                    accuracy: orientation.accuracy,
                    previousAccuracy: previousOrientation?.accuracy,
                    source: orientation.source
                }
            }));
        }
        
        // Dispatch calibration needed event
        if (orientation.needsCalibration && 
            (!previousOrientation || !previousOrientation.needsCalibration)) {
            this.dispatchEvent(new CustomEvent(ORIENTATION_EVENTS.CALIBRATION_NEEDED, {
                detail: {
                    accuracy: orientation.accuracy,
                    source: orientation.source
                }
            }));
        }
    }
    
    /**
     * Manually calibrate the compass using a known direction
     * @param {number} actualHeading - Known actual heading in degrees
     */
    calibrate(actualHeading) {
        if (!this.currentOrientation) {
            this.log('No orientation data available for calibration');
            return false;
        }
        
        const measuredHeading = this.currentOrientation.heading;
        this.calibrationOffset = (actualHeading - measuredHeading + 360) % 360;
        
        this.log('Calibrated compass:', {
            measured: measuredHeading,
            actual: actualHeading,
            offset: this.calibrationOffset
        });
        
        return true;
    }
    
    /**
     * Reset calibration offset
     */
    resetCalibration() {
        this.calibrationOffset = 0;
        this.log('Calibration reset');
    }
    
    /**
     * Get current orientation data
     * @returns {OrientationData|null} Current orientation or null if not available
     */
    getCurrentOrientation() {
        return this.currentOrientation;
    }
    
    /**
     * Get current compass heading
     * @returns {number|null} Current heading in degrees or null if not available
     */
    getCurrentHeading() {
        return this.currentOrientation?.heading ?? null;
    }
    
    /**
     * Check if orientation data is available and reliable
     * @returns {boolean} True if orientation is reliable
     */
    isOrientationReliable() {
        if (!this.currentOrientation) {
            return false;
        }
        
        const { accuracy, source, timestamp } = this.currentOrientation;
        const now = Date.now();
        
        // Check if data is recent (within 2 seconds)
        if (now - timestamp > 2000) {
            return false;
        }
        
        // Check accuracy threshold
        if (accuracy > 0 && accuracy > this.config.accuracyThreshold) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Get orientation service status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            isActive: this.isActive,
            hasPermission: this.hasPermission,
            isSupported: DeviceOrientationService.isSupported(),
            capabilities: DeviceOrientationService.getCapabilities(),
            currentOrientation: this.currentOrientation,
            calibrationOffset: this.calibrationOffset,
            isReliable: this.isOrientationReliable()
        };
    }
    
    /**
     * Development logging
     */
    log(...args) {
        if (this.config.enableDebugLogging) {
            console.log('[DeviceOrientationService]', ...args);
        }
    }
}

// Export constants for external use
export { ORIENTATION_EVENTS, ORIENTATION_CAPABILITIES };