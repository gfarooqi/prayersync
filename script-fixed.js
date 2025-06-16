// AlAdhan API Prayer Times Service with timezone-aware caching and 3-layer fallback
class AlAdhanAPI {
    constructor() {
        this.baseUrl = 'http://api.aladhan.com/v1';
        this.methods = {
            'ISNA': 2,      // Islamic Society of North America
            'MWL': 3,       // Muslim World League (default)
            'Egypt': 5,     // Egyptian General Authority of Survey
            'Makkah': 4,    // Umm Al-Qura University, Makkah
            'Karachi': 1,   // University of Islamic Sciences, Karachi
            'Tehran': 7,    // Institute of Geophysics, University of Tehran
            'Jafari': 0     // Shia Ithna-Ashari, Leva Institute, Qum
        };
        this.defaultMethod = 3; // MWL
        this.cache = new Map();
        this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
    }

    // localStorage wrapper to handle JSON parsing and errors safely
    _storage = {
        getItem: (key) => {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : null;
            } catch (e) {
                console.error("Failed to read from localStorage", e);
                return null;
            }
        },
        setItem: (key, value) => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                console.error("Failed to write to localStorage", e);
            }
        }
    };

    // Generate timezone-aware cache key
    getCacheKey(latitude, longitude, dateStr, methodId) {
        return `times:${latitude}:${longitude}:${dateStr}:${methodId}`;
    }

    // Check if cached data is still valid
    isCacheValid(cacheEntry) {
        return cacheEntry && (Date.now() - cacheEntry.timestamp) < this.cacheTimeout;
    }

    // Get location metadata (especially timezone) to determine correct local date
    async getLocationMetadata(latitude, longitude) {
        const metaKey = `meta:${latitude}:${longitude}`;
        const cachedMeta = this._storage.getItem(metaKey);
        if (cachedMeta) return cachedMeta;

        // If no metadata is cached, fetch it (only happens ONCE per location)
        try {
            const todayStr = new Date().toLocaleDateString('en-CA');
            const url = `${this.baseUrl}/timings/${todayStr}?latitude=${latitude}&longitude=${longitude}&method=${this.defaultMethod}`;
            const response = await fetch(url);
            if (!response.ok) return null;
            const data = await response.json();

            if (data.code === 200 && data.data?.meta) {
                this._storage.setItem(metaKey, data.data.meta);
                return data.data.meta;
            }
            return null;
        } catch (e) {
            console.error("Could not fetch initial location metadata", e);
            return null;
        }
    }

    // Main function with robust 3-layer caching and timezone-aware logic
    async getPrayerTimes(latitude, longitude, date, method = 'MWL') {
        const methodId = this.methods[method] || this.defaultMethod;

        // Step 1: Get location metadata (especially timezone) for correct local date
        const meta = await this.getLocationMetadata(latitude, longitude);
        const timezone = meta ? meta.timezone : undefined;

        // Step 2: Get correct date string for the location's timezone
        const dateStr = new Date(date).toLocaleDateString('en-CA', { timeZone: timezone });
        const cacheKey = this.getCacheKey(latitude, longitude, dateStr, methodId);

        // === 3-LAYER CACHE/FALLBACK LOGIC ===

        // Layer 1: In-memory Map cache (fastest, current session only)
        const memoryCached = this.cache.get(cacheKey);
        if (this.isCacheValid(memoryCached)) {
            console.log(`Serving from memory cache for ${dateStr}`);
            return memoryCached.data;
        }

        // Layer 2: localStorage cache (persists across sessions - "last known good")
        const storageCached = this._storage.getItem(cacheKey);
        if (this.isCacheValid(storageCached)) {
            console.log(`Serving from localStorage cache for ${dateStr}`);
            this.cache.set(cacheKey, storageCached); // Re-hydrate memory cache
            return storageCached.data;
        }

        // Layer 3: Fetch from API or use generic fallback
        try {
            const url = `${this.baseUrl}/timings/${dateStr}?latitude=${latitude}&longitude=${longitude}&method=${methodId}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            
            const data = await response.json();
            if (data.code !== 200 || !data.data?.timings) throw new Error('Invalid API response format');

            const times = this.formatPrayerTimes(data.data.timings);
            const cachePayload = { data: times, timestamp: Date.now() };

            // Cache the fresh result in both memory and localStorage
            this.cache.set(cacheKey, cachePayload);
            this._storage.setItem(cacheKey, cachePayload);
            
            // Also cache metadata if we got it for next time
            if (!meta && data.data.meta) {
                this._storage.setItem(`meta:${latitude}:${longitude}`, data.data.meta);
            }

            console.log(`Fresh API data cached for ${dateStr}`);
            return times;

        } catch (error) {
            console.warn('AlAdhan API failed, using generic fallback:', error);
            return this.getFallbackTimes();
        }
    }

    // Format API response to standard format
    formatPrayerTimes(timings) {
        return {
            fajr: this.cleanTimeString(timings.Fajr),
            sunrise: this.cleanTimeString(timings.Sunrise),
            dhuhr: this.cleanTimeString(timings.Dhuhr),
            asr: this.cleanTimeString(timings.Asr),
            maghrib: this.cleanTimeString(timings.Maghrib),
            isha: this.cleanTimeString(timings.Isha)
        };
    }

    // Clean time string from API (remove timezone info)
    cleanTimeString(timeStr) {
        return timeStr.split(' ')[0]; // Remove timezone part like "(EST)"
    }

    // Generic fallback for "first visit while offline" scenario
    getFallbackTimes() {
        console.log('Using generic hardcoded fallback prayer times');
        return {
            fajr: '05:30',
            sunrise: '06:45',
            dhuhr: '12:00',
            asr: '15:30',
            maghrib: '17:15',
            isha: '18:45'
        };
    }

    // Wrapper method to maintain compatibility with old interface
    async calculate(date, coords, timezone, method = 'MWL') {
        return await this.getPrayerTimes(coords.latitude, coords.longitude, date, method);
    }
}