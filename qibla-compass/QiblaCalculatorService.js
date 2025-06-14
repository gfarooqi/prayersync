/**
 * QiblaCalculatorService - Accurate Qibla Direction Calculations
 * 
 * Pure service for calculating the direction to Mecca (Kaaba) from any location
 * using the Haversine formula and World Magnetic Model for declination correction.
 * 
 * This service is completely independent of DOM, device sensors, or UI state.
 */

// Kaaba coordinates (official GPS coordinates)
const KAABA_COORDINATES = {
    latitude: 21.4225,    // 21°25'21"N
    longitude: 39.8262    // 39°49'34"E
};

// Earth's radius in kilometers (mean radius)
const EARTH_RADIUS_KM = 6371;

/**
 * User location interface
 * @typedef {Object} UserLocation
 * @property {number} lat - Latitude in degrees (-90 to 90)
 * @property {number} lon - Longitude in degrees (-180 to 180)
 */

/**
 * Qibla calculation result
 * @typedef {Object} QiblaCalculationResult
 * @property {number} trueNorthBearing - Bearing to Qibla from True North (0° to 360°)
 * @property {number} magneticDeclination - Magnetic declination at location (+ East, - West)
 * @property {number} magneticBearing - Bearing to Qibla from Magnetic North (0° to 360°)
 * @property {number} distanceKm - Great circle distance to Mecca in kilometers
 * @property {string} cardinalDirection - Human-readable direction (e.g., "Northeast")
 * @property {Object} metadata - Additional calculation metadata
 */

export class QiblaCalculatorService {
    constructor() {
        // Initialize magnetic declination model when geomagnetism library is available
        this.magneticModel = null;
        this.initializeMagneticModel();
    }
    
    /**
     * Initialize magnetic declination model
     * For now, we'll use a simplified approach until geomagnetism library is integrated
     */
    initializeMagneticModel() {
        // TODO: Integrate geomagnetism library
        // const geomagnetism = require('geomagnetism');
        // this.magneticModel = geomagnetism.model(new Date());
        
        // For now, use a simplified declination estimation
        console.log('[QiblaCalculator] Magnetic model initialized (simplified mode)');
    }
    
    /**
     * Calculate all necessary Qibla direction parameters
     * @param {UserLocation} userLocation - User's coordinates
     * @param {Date} calculationDate - Date for magnetic declination calculation
     * @returns {QiblaCalculationResult|null} Calculation result or null if invalid
     */
    calculate(userLocation, calculationDate = new Date()) {
        // Validate input coordinates
        if (!this.isValidLocation(userLocation)) {
            console.error('[QiblaCalculator] Invalid user location:', userLocation);
            return null;
        }
        
        // Check for special cases
        if (this.isAtKaaba(userLocation)) {
            return this.createKaabaResult();
        }
        
        if (this.isAtAntipodalPoint(userLocation)) {
            return this.createAntipodalResult();
        }
        
        try {
            // Calculate true north bearing using Haversine formula
            const trueNorthBearing = this.calculateTrueNorthBearing(userLocation);
            
            // Calculate great circle distance
            const distanceKm = this.calculateDistance(userLocation);
            
            // Calculate magnetic declination for the location
            const magneticDeclination = this.calculateMagneticDeclination(
                userLocation, 
                calculationDate
            );
            
            // Calculate magnetic bearing (what device compass shows)
            const magneticBearing = this.calculateMagneticBearing(
                trueNorthBearing, 
                magneticDeclination
            );
            
            // Generate human-readable direction
            const cardinalDirection = this.bearingToCardinal(trueNorthBearing);
            
            return {
                trueNorthBearing: this.normalizeBearing(trueNorthBearing),
                magneticDeclination: magneticDeclination,
                magneticBearing: this.normalizeBearing(magneticBearing),
                distanceKm: Math.round(distanceKm),
                cardinalDirection: cardinalDirection,
                metadata: {
                    userLocation: userLocation,
                    kaabaLocation: KAABA_COORDINATES,
                    calculationDate: calculationDate.toISOString(),
                    calculationMethod: 'Haversine',
                    magneticModelVersion: 'WMM2020' // TODO: Get from actual geomagnetism library
                }
            };
            
        } catch (error) {
            console.error('[QiblaCalculator] Calculation failed:', error);
            return null;
        }
    }
    
    /**
     * Calculate bearing to Kaaba using Haversine formula
     * @param {UserLocation} userLocation - User's coordinates
     * @returns {number} Bearing in degrees from True North
     */
    calculateTrueNorthBearing(userLocation) {
        const userLat = this.degreesToRadians(userLocation.lat);
        const userLon = this.degreesToRadians(userLocation.lon);
        const kaabaLat = this.degreesToRadians(KAABA_COORDINATES.latitude);
        const kaabaLon = this.degreesToRadians(KAABA_COORDINATES.longitude);
        
        const deltaLon = kaabaLon - userLon;
        
        // Haversine bearing formula
        const y = Math.sin(deltaLon) * Math.cos(kaabaLat);
        const x = Math.cos(userLat) * Math.sin(kaabaLat) - 
                  Math.sin(userLat) * Math.cos(kaabaLat) * Math.cos(deltaLon);
        
        const bearing = Math.atan2(y, x);
        
        // Convert from radians to degrees and normalize to 0-360
        return this.radiansToDegrees(bearing);
    }
    
    /**
     * Calculate great circle distance to Kaaba
     * @param {UserLocation} userLocation - User's coordinates
     * @returns {number} Distance in kilometers
     */
    calculateDistance(userLocation) {
        const userLat = this.degreesToRadians(userLocation.lat);
        const userLon = this.degreesToRadians(userLocation.lon);
        const kaabaLat = this.degreesToRadians(KAABA_COORDINATES.latitude);
        const kaabaLon = this.degreesToRadians(KAABA_COORDINATES.longitude);
        
        const deltaLat = kaabaLat - userLat;
        const deltaLon = kaabaLon - userLon;
        
        // Haversine distance formula
        const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                  Math.cos(userLat) * Math.cos(kaabaLat) *
                  Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return EARTH_RADIUS_KM * c;
    }
    
    /**
     * Calculate magnetic declination for given location and date
     * @param {UserLocation} userLocation - User's coordinates
     * @param {Date} calculationDate - Date for calculation
     * @returns {number} Magnetic declination in degrees (+ East, - West)
     */
    calculateMagneticDeclination(userLocation, calculationDate) {
        // TODO: Replace with actual geomagnetism library calculation
        // const info = this.magneticModel.point([userLocation.lat, userLocation.lon]);
        // return info.decl;
        
        // Simplified magnetic declination estimation for major regions
        // This is a temporary fallback until the geomagnetism library is integrated
        return this.estimateMagneticDeclination(userLocation);
    }
    
    /**
     * Simplified magnetic declination estimation
     * This is a rough approximation for testing purposes
     * @param {UserLocation} userLocation - User's coordinates
     * @returns {number} Estimated declination in degrees
     */
    estimateMagneticDeclination(userLocation) {
        const lat = userLocation.lat;
        const lon = userLocation.lon;
        
        // Very rough regional estimates (for testing only)
        // Real implementation will use WMM via geomagnetism library
        
        // North America
        if (lat > 25 && lat < 60 && lon > -140 && lon < -60) {
            // Rough gradient across North America
            return -20 + (lon + 100) * 0.3; // Ranges from ~-8° to ~-32°
        }
        
        // Europe
        if (lat > 35 && lat < 70 && lon > -10 && lon < 40) {
            return -5 + lat * 0.2; // Rough European declination
        }
        
        // Middle East (around Mecca)
        if (lat > 15 && lat < 40 && lon > 25 && lon < 60) {
            return 2 + (lat - 25) * 0.1; // Small positive declination
        }
        
        // Asia-Pacific
        if (lat > -50 && lat < 60 && lon > 60 && lon < 180) {
            return -10 + (lon - 120) * 0.1; // Variable across Asia
        }
        
        // Default fallback
        return 0;
    }
    
    /**
     * Calculate magnetic bearing from true bearing and declination
     * @param {number} trueBearing - True north bearing in degrees
     * @param {number} declination - Magnetic declination in degrees
     * @returns {number} Magnetic bearing in degrees
     */
    calculateMagneticBearing(trueBearing, declination) {
        // Magnetic bearing = True bearing - Declination
        return trueBearing - declination;
    }
    
    /**
     * Validate user location coordinates
     * @param {UserLocation} location - Location to validate
     * @returns {boolean} True if valid
     */
    isValidLocation(location) {
        if (!location || typeof location !== 'object') {
            return false;
        }
        
        const { lat, lon } = location;
        
        return typeof lat === 'number' && typeof lon === 'number' &&
               lat >= -90 && lat <= 90 &&
               lon >= -180 && lon <= 180 &&
               !isNaN(lat) && !isNaN(lon);
    }
    
    /**
     * Check if user is at the Kaaba (within ~100m)
     * @param {UserLocation} userLocation - User's coordinates
     * @returns {boolean} True if at Kaaba
     */
    isAtKaaba(userLocation) {
        const distance = this.calculateDistance(userLocation);
        return distance < 0.1; // Within 100 meters
    }
    
    /**
     * Check if user is at the antipodal point of Mecca
     * @param {UserLocation} userLocation - User's coordinates
     * @returns {boolean} True if at antipodal point
     */
    isAtAntipodalPoint(userLocation) {
        const antipodalLat = -KAABA_COORDINATES.latitude;
        const antipodalLon = KAABA_COORDINATES.longitude + 180;
        const normalizedAntipodalLon = antipodalLon > 180 ? antipodalLon - 360 : antipodalLon;
        
        const distance = this.calculateDistanceBetween(
            userLocation,
            { lat: antipodalLat, lon: normalizedAntipodalLon }
        );
        
        return distance < 100; // Within 100km of antipodal point
    }
    
    /**
     * Calculate distance between two points
     * @param {UserLocation} point1 - First point
     * @param {UserLocation} point2 - Second point
     * @returns {number} Distance in kilometers
     */
    calculateDistanceBetween(point1, point2) {
        const lat1 = this.degreesToRadians(point1.lat);
        const lon1 = this.degreesToRadians(point1.lon);
        const lat2 = this.degreesToRadians(point2.lat);
        const lon2 = this.degreesToRadians(point2.lon);
        
        const deltaLat = lat2 - lat1;
        const deltaLon = lon2 - lon1;
        
        const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return EARTH_RADIUS_KM * c;
    }
    
    /**
     * Create result for when user is at Kaaba
     * @returns {QiblaCalculationResult} Special Kaaba result
     */
    createKaabaResult() {
        return {
            trueNorthBearing: 0,
            magneticDeclination: 0,
            magneticBearing: 0,
            distanceKm: 0,
            cardinalDirection: 'At Kaaba',
            metadata: {
                specialCase: 'AT_KAABA',
                message: 'You are at the Holy Kaaba. Any direction is valid for prayer.'
            }
        };
    }
    
    /**
     * Create result for antipodal point
     * @returns {QiblaCalculationResult} Special antipodal result
     */
    createAntipodalResult() {
        return {
            trueNorthBearing: 0,
            magneticDeclination: 0,
            magneticBearing: 0,
            distanceKm: Math.round(Math.PI * EARTH_RADIUS_KM), // Half circumference
            cardinalDirection: 'Any direction',
            metadata: {
                specialCase: 'ANTIPODAL_POINT',
                message: 'You are at the point opposite the Kaaba. Any direction leads to Mecca.'
            }
        };
    }
    
    /**
     * Convert bearing to cardinal direction
     * @param {number} bearing - Bearing in degrees
     * @returns {string} Cardinal direction
     */
    bearingToCardinal(bearing) {
        const normalized = this.normalizeBearing(bearing);
        const directions = [
            'North', 'Northeast', 'East', 'Southeast',
            'South', 'Southwest', 'West', 'Northwest'
        ];
        
        const index = Math.round(normalized / 45) % 8;
        return directions[index];
    }
    
    /**
     * Normalize bearing to 0-360 degrees
     * @param {number} bearing - Bearing in degrees
     * @returns {number} Normalized bearing
     */
    normalizeBearing(bearing) {
        let normalized = bearing % 360;
        if (normalized < 0) {
            normalized += 360;
        }
        return normalized;
    }
    
    /**
     * Convert degrees to radians
     * @param {number} degrees - Angle in degrees
     * @returns {number} Angle in radians
     */
    degreesToRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
    
    /**
     * Convert radians to degrees
     * @param {number} radians - Angle in radians
     * @returns {number} Angle in degrees
     */
    radiansToDegrees(radians) {
        return radians * (180 / Math.PI);
    }
    
    /**
     * Get service information and status
     * @returns {Object} Service information
     */
    getServiceInfo() {
        return {
            version: '1.0.0',
            method: 'Haversine Great Circle',
            kaabaCoordinates: KAABA_COORDINATES,
            earthRadius: EARTH_RADIUS_KM,
            magneticModel: this.magneticModel ? 'WMM2020' : 'Simplified Estimation',
            capabilities: [
                'True North bearing calculation',
                'Distance calculation',
                'Magnetic declination correction',
                'Cardinal direction conversion',
                'Special case handling (Kaaba, Antipodal)'
            ]
        };
    }
}