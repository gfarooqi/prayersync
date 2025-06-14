/**
 * Mock Geocoding Provider for testing and development
 * 
 * Provides fake city names based on coordinates for testing
 * the LocationService logic without making real API calls.
 */

export class MockProvider {
    constructor() {
        // Predefined mock locations for testing
        this.mockLocations = {
            // New York area
            '40.7,-74.0': 'New York, NY',
            '40.7128,-74.0060': 'New York, NY',
            
            // London area  
            '51.5,-0.1': 'London, UK',
            '51.5074,-0.1278': 'London, UK',
            
            // Dubai area
            '25.2,55.3': 'Dubai, UAE',
            '25.2048,55.2708': 'Dubai, UAE',
            
            // Los Angeles area
            '34.1,-118.2': 'Los Angeles, CA',
            '34.0522,-118.2437': 'Los Angeles, CA',
            
            // Toronto area
            '43.7,-79.4': 'Toronto, ON',
            '43.6532,-79.3832': 'Toronto, ON'
        };
    }

    /**
     * Mock reverse geocoding - returns city name for coordinates
     * @param {Object} coordinates - {latitude, longitude}
     * @returns {Promise<string>} City name
     */
    async reverseGeocode({ latitude, longitude }) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Find closest match in mock data
        const coordKey = `${latitude.toFixed(1)},${longitude.toFixed(1)}`;
        const exactKey = `${latitude},${longitude}`;
        
        // Try exact match first, then rounded match
        const cityName = this.mockLocations[exactKey] || 
                         this.mockLocations[coordKey] || 
                         this._findClosestCity(latitude, longitude);
        
        console.log(`[MockProvider] Geocoded (${latitude}, ${longitude}) → ${cityName}`);
        return cityName;
    }

    /**
     * Find the closest mock city to given coordinates
     * @param {number} latitude 
     * @param {number} longitude 
     * @returns {string} Closest city name
     * @private
     */
    _findClosestCity(latitude, longitude) {
        let closestCity = 'Unknown Location';
        let minDistance = Infinity;
        
        for (const [coordStr, cityName] of Object.entries(this.mockLocations)) {
            const [lat, lon] = coordStr.split(',').map(Number);
            const distance = Math.sqrt(
                Math.pow(latitude - lat, 2) + Math.pow(longitude - lon, 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestCity = cityName;
            }
        }
        
        return closestCity;
    }

    /**
     * Add a mock location for testing
     * @param {number} latitude 
     * @param {number} longitude 
     * @param {string} cityName 
     */
    addMockLocation(latitude, longitude, cityName) {
        const key = `${latitude},${longitude}`;
        this.mockLocations[key] = cityName;
    }
}