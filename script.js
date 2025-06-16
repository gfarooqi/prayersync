// AlAdhan API Prayer Times Service with timezone-aware caching and 3-layer fallback (v2.0)
class AlAdhanAPI {
    constructor() {
        this.baseUrl = 'https://api.aladhan.com/v1';
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
            const url = `/api/getPrayerTimes?latitude=${latitude}&longitude=${longitude}&date=${todayStr}&method=${this.defaultMethod}`;
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

        // Layer 3: Fetch from API via our Vercel proxy (solves CORS issue)
        try {
            const url = `/api/getPrayerTimes?latitude=${latitude}&longitude=${longitude}&date=${dateStr}&method=${methodId}`;
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
}

class CalendarIntegration {
    constructor() {
        this.eventDuration = 30;
        this.eventReminder = 10;
        this.includeLocation = true;
        this.professionalMode = true; // Default to professional/discrete mode
        this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    // Generate iCal format for prayer events
    generateICalEvent(prayer, date, time, location) {
        const prayerName = prayer.charAt(0).toUpperCase() + prayer.slice(1);
        const [hours, minutes] = time.split(':').map(Number);
        
        const startDate = new Date(date);
        startDate.setHours(hours, minutes, 0, 0);
        
        const endDate = new Date(startDate);
        endDate.setMinutes(endDate.getMinutes() + this.eventDuration);
        
        // Improved timezone-aware date formatting
        const formatDateWithTZ = (d) => {
            // Use local time format for better compatibility
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hour = String(d.getHours()).padStart(2, '0');
            const minute = String(d.getMinutes()).padStart(2, '0');
            const second = String(d.getSeconds()).padStart(2, '0');
            return `${year}${month}${day}T${hour}${minute}${second}`;
        };
        
        // Professional vs personal mode
        const eventTitle = this.professionalMode ? 'Personal Time' : `${prayerName} Prayer`;
        const eventDescription = this.professionalMode 
            ? `Personal time block (${prayerName} prayer)`
            : `Time for ${prayerName} prayer`;
        
        let icalEvent = [
            'BEGIN:VEVENT',
            `UID:prayersync-${prayer}-${formatDateWithTZ(startDate)}@prayersync.app`,
            `DTSTAMP:${formatDateWithTZ(new Date())}`,
            `DTSTART;TZID=${this.timezone}:${formatDateWithTZ(startDate)}`,
            `DTEND;TZID=${this.timezone}:${formatDateWithTZ(endDate)}`,
            `SUMMARY:${eventTitle}`,
            `DESCRIPTION:${eventDescription}`,
            'STATUS:CONFIRMED',
            'TRANSP:BUSY'
        ];
        
        if (this.includeLocation && location) {
            icalEvent.push(`LOCATION:Lat: ${location.latitude.toFixed(2)}, Lon: ${location.longitude.toFixed(2)}`);
        }
        
        if (this.eventReminder > 0) {
            const reminderDesc = this.professionalMode 
                ? `Personal time in ${this.eventReminder} minutes`
                : `${prayerName} prayer in ${this.eventReminder} minutes`;
            
            icalEvent.push(
                'BEGIN:VALARM',
                'TRIGGER:-PT' + this.eventReminder + 'M',
                'ACTION:DISPLAY',
                `DESCRIPTION:${reminderDesc}`,
                'END:VALARM'
            );
        }
        
        icalEvent.push('END:VEVENT');
        
        return icalEvent.join('\r\n');
    }

    // Generate full iCal file
    generateICalFile(prayerEvents) {
        const icalHeader = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//PrayerSync//Prayer Times Calendar//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:Prayer Times - PrayerSync',
            'X-WR-TIMEZONE:' + this.timezone,
            'X-WR-CALDESC:Prayer times synchronized with your professional calendar'
        ].join('\r\n');
        
        const icalFooter = 'END:VCALENDAR';
        
        const events = prayerEvents.map(event => 
            this.generateICalEvent(event.prayer, event.date, event.time, event.location)
        ).join('\r\n');
        
        return `${icalHeader}\r\n${events}\r\n${icalFooter}`;
    }

    // Download iCal file
    downloadICalFile(filename, content) {
        const blob = new Blob([content], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Main app class
class PrayerSync {
    constructor() {
        this.calculator = new AlAdhanAPI();
        this.calculationMethod = 'MWL'; // Store method in main class
        this.calendarIntegration = new CalendarIntegration();
        this.prayerTimes = {};
        this.location = { latitude: 0, longitude: 0 };
        this.timezone = 0;
        this.notificationTime = 15;
        this.googleClientId = 'YOUR_GOOGLE_CLIENT_ID'; // Replace with actual client ID
        this.init();
    }

    // Helper method to get the current calculation method
    getCurrentCalculationMethod() {
        return this.calculationMethod || 'MWL'; // Default to MWL if not set
    }

    async init() {
        console.log('Initializing PrayerSync app...');
        this.loadSettings(); // Load settings before setting up listeners to avoid infinite loop
        this.setupEventListeners();
        await this.getLocation(); // This now calls updatePrayerTimes internally
        this.startCountdown();
        this.updateDate();
        console.log('PrayerSync app initialized successfully');
    }

    setupEventListeners() {
        // Only add listeners for elements that exist
        const calcMethodEl = document.getElementById('calcMethod');
        if (calcMethodEl) {
            calcMethodEl.addEventListener('change', () => {
                this.saveSettings();
            });
        }

        const professionalModeEl = document.getElementById('professionalMode');
        if (professionalModeEl) {
            professionalModeEl.addEventListener('change', (e) => {
                this.calendarIntegration.professionalMode = e.target.checked;
                this.saveSettings();
            });
        }

        const reminderTimeEl = document.getElementById('reminderTime');
        if (reminderTimeEl) {
            reminderTimeEl.addEventListener('change', (e) => {
                this.calendarIntegration.eventDuration = parseInt(e.target.value);
                this.saveSettings();
            });
        }
    }

    async getLocation() {
        const locationEl = document.getElementById('locationText');
        
        try {
            // Update UI to show loading
            if (locationEl) {
                locationEl.textContent = 'Detecting location...';
            }
            
            // Check for secure context (HTTPS requirement)
            if (window.isSecureContext === false) {
                throw new Error('Geolocation requires a secure context (HTTPS).');
            }
            
            if (!navigator.geolocation) {
                throw new Error('Geolocation not supported by this browser');
            }
            
            // Quick check for existing permissions to avoid hanging (Safari compatible)
            if (navigator.permissions && navigator.permissions.query) {
                try {
                    const permission = await navigator.permissions.query({name: 'geolocation'});
                    if (permission.state === 'denied') {
                        console.log('Geolocation permission is denied - skipping to IP fallback');
                        if (locationEl) {
                            locationEl.textContent = 'Location access denied. Using IP location...';
                        }
                        throw new Error('Permission denied by browser');
                    }
                } catch (permError) {
                    console.log('Could not check geolocation permissions (likely Safari):', permError.message);
                    // Continue with normal flow if permissions API fails (e.g., Safari)
                }
            } else {
                console.log('Permissions API not supported (likely Safari) - proceeding with standard geolocation');
            }
            
            // Tier 1: Try high-accuracy geolocation first
            console.log('Requesting high-accuracy geolocation...');
            try {
                const position = await this.fetchPosition({
                    enableHighAccuracy: true,
                    timeout: 8000, // Give GPS time to acquire signal
                    maximumAge: 300000 // 5 minutes
                });
                
                this.setLocationFromCoords(position.coords, 'GPS (High Accuracy)');
                console.log('High-accuracy location set successfully:', this.location);
                return;
                
            } catch (highAccError) {
                console.warn('High-accuracy location failed:', highAccError.message);
                
                // Handle permission denied specifically (GeolocationPositionError.PERMISSION_DENIED = 1)
                if (highAccError.code === 1 || highAccError.message?.includes('denied') || highAccError.message?.includes('User denied')) {
                    console.log('User denied geolocation permission - skipping to IP fallback');
                    if (locationEl) {
                        locationEl.textContent = 'Location access denied. Using IP location...';
                    }
                    throw new Error('Permission denied'); // Skip directly to IP fallback
                }
                
                // Tier 2: Try low-accuracy geolocation
                console.log('Trying low-accuracy geolocation...');
                try {
                    const position = await this.fetchPosition({
                        enableHighAccuracy: false,
                        timeout: 5000, // Network location should be faster
                        maximumAge: 600000 // 10 minutes
                    });
                    
                    this.setLocationFromCoords(position.coords, 'Network Location');
                    console.log('Low-accuracy location set successfully:', this.location);
                    return;
                    
                } catch (lowAccError) {
                    console.warn('Low-accuracy location also failed:', lowAccError.message);
                    throw lowAccError; // Proceed to IP fallback
                }
            }
            
        } catch (geoError) {
            console.error('All geolocation attempts failed:', geoError.message);
            
            // Tier 3: IP-based geolocation fallback
            try {
                if (locationEl) {
                    locationEl.textContent = 'Finding location by IP...';
                }
                
                console.log('Attempting IP-based geolocation...');
                
                // Try with a timeout to prevent hanging
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
                
                const response = await fetch('https://ipapi.co/json/', {
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`IP API returned status ${response.status}: ${response.statusText}`);
                }
                
                const ipData = await response.json();
                console.log('IP API response:', ipData);
                
                if (ipData && ipData.latitude && ipData.longitude) {
                    this.location = {
                        latitude: parseFloat(ipData.latitude),
                        longitude: parseFloat(ipData.longitude)
                    };
                    
                    // For IP-based location, use browser's timezone offset
                    // This is more reliable than trying to convert IANA timezone strings
                    this.timezone = -new Date().getTimezoneOffset() / 60;
                    console.log(`IP location: Using browser timezone offset ${this.timezone} hours`);
                    
                    if (locationEl) {
                        const cityCountry = ipData.city && ipData.country_name ? 
                            `${ipData.city}, ${ipData.country_name}` : 
                            `${this.location.latitude.toFixed(2)}, ${this.location.longitude.toFixed(2)}`;
                        locationEl.textContent = `${cityCountry} (IP Location)`;
                    }
                    
                    console.log('IP-based location set successfully:', this.location);
                    
                } else {
                    throw new Error(`IP API returned invalid data: ${JSON.stringify(ipData)}`);
                }
                
            } catch (ipError) {
                console.error('IP geolocation fallback failed:', ipError.message);
                
                // Handle specific error types
                if (ipError.name === 'AbortError') {
                    console.error('IP API request timed out after 10 seconds');
                } else if (ipError.message?.includes('fetch')) {
                    console.error('Network error accessing IP API (possibly blocked by ad-blocker or firewall)');
                }
                
                // Tier 4: Default to Mecca
                console.log('Using default location (Mecca)');
                this.location = { latitude: 21.4225, longitude: 39.8262 };
                this.timezone = 3;
                
                if (locationEl) {
                    locationEl.innerHTML = `
                        Mecca (default) 
                        <button onclick="window.prayerSyncApp.showLocationModal()" style="margin-left: 10px; padding: 2px 8px; font-size: 12px; background: #006A4E; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            Set Location
                        </button>
                    `;
                }
            }
        }
        
        // Always update prayer times after location is set
        await this.updatePrayerTimes();
    }

    // Helper function to wrap geolocation with manual timeout
    fetchPosition(options) {
        return new Promise((resolve, reject) => {
            // Balanced safeguard timeout (slightly longer than native timeout as backstop)
            const safeguardTimeout = options.timeout + 2000; // 2 seconds buffer for safety
            const timeoutId = setTimeout(() => {
                reject(new Error(`Geolocation safeguard timeout after ${safeguardTimeout}ms`));
            }, safeguardTimeout);

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    clearTimeout(timeoutId);
                    resolve(pos);
                },
                (err) => {
                    clearTimeout(timeoutId);
                    // Add more detailed error information
                    const errorDetails = {
                        code: err.code,
                        message: err.message,
                        PERMISSION_DENIED: err.code === 1,
                        POSITION_UNAVAILABLE: err.code === 2,
                        TIMEOUT: err.code === 3
                    };
                    console.log('Geolocation error details:', errorDetails);
                    reject(err);
                },
                {
                    ...options,
                    // Use the native timeout as primary mechanism
                    timeout: options.timeout
                }
            );
        });
    }

    // Helper to set location from coordinates
    setLocationFromCoords(coords, source) {
        this.location = {
            latitude: coords.latitude,
            longitude: coords.longitude
        };
        
        this.timezone = -new Date().getTimezoneOffset() / 60;
        
        const locationEl = document.getElementById('locationText');
        if (locationEl) {
            locationEl.textContent = `${this.location.latitude.toFixed(2)}, ${this.location.longitude.toFixed(2)} (${source})`;
        }
    }

    // Helper to convert timezone string to offset
    timezoneToOffset(timezone) {
        try {
            // Use the most reliable method: create two dates and compare
            const now = new Date();
            
            // Create formatter for the target timezone
            const formatter = new Intl.DateTimeFormat('en', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit', 
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
            
            // Get components in target timezone
            const parts = formatter.formatToParts(now);
            const year = parts.find(p => p.type === 'year').value;
            const month = parts.find(p => p.type === 'month').value;
            const day = parts.find(p => p.type === 'day').value;
            const hour = parts.find(p => p.type === 'hour').value;
            const minute = parts.find(p => p.type === 'minute').value;
            const second = parts.find(p => p.type === 'second').value;
            
            // Reconstruct as if it's local time
            const localEquivalent = new Date(year, month - 1, day, hour, minute, second);
            
            // Calculate offset
            const offsetMs = localEquivalent.getTime() - now.getTime();
            const offsetHours = offsetMs / (1000 * 60 * 60);
            
            console.log(`Timezone ${timezone}: offset = ${offsetHours} hours`);
            return offsetHours;
            
        } catch (e) {
            console.warn('Timezone calculation failed for:', timezone, e.message);
            
            // Fallback to simple mapping for known timezones
            const timezoneOffsets = {
                'America/Vancouver': -8,
                'America/Los_Angeles': -8,
                'America/New_York': -5,
                'America/Toronto': -5,
                'America/Chicago': -6,
                'Europe/London': 0,
                'Europe/Paris': 1,
                'Europe/Berlin': 1,
                'Asia/Dubai': 4,
                'Asia/Riyadh': 3,
                'Asia/Tokyo': 9,
                'Australia/Sydney': 10
            };
            
            const fallbackOffset = timezoneOffsets[timezone];
            if (fallbackOffset !== undefined) {
                console.log(`Using fallback offset for ${timezone}: ${fallbackOffset} hours`);
                return fallbackOffset;
            }
            
            // Ultimate fallback: use browser timezone
            const browserOffset = -new Date().getTimezoneOffset() / 60;
            console.log(`Using browser timezone offset: ${browserOffset} hours`);
            return browserOffset;
        }
    }

    // Show location selection modal (user-initiated)
    showLocationModal() {
        const modal = document.getElementById('locationModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    async updatePrayerTimes() {
        console.log('=== ENTERING updatePrayerTimes ===');
        console.log('Updating prayer times for location:', this.location, 'timezone:', this.timezone);
        
        const today = new Date();
        this.prayerTimes = await this.calculator.getPrayerTimes(this.location.latitude, this.location.longitude, today, this.calculationMethod || 'MWL');
        
        console.log('Calculated prayer times:', this.prayerTimes);
        
        // Check if any of the core prayer times are invalid to prevent infinite loops
        const hasInvalidTime = this.prayerTimes && Object.values(this.prayerTimes).some(time => {
            return !time || time === 'NaN' || time.includes('NaN') || time === '--:--';
        });
        
        if (hasInvalidTime) {
            console.error('Prayer calculation resulted in invalid times. Halting update to prevent infinite loop:', this.prayerTimes);
            // Display placeholder times and stop execution to break the loop
            ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(prayer => {
                const element = document.querySelector(`[data-prayer="${prayer}"] .prayer-time`);
                if (element) {
                    element.textContent = 'Error';
                }
            });
            return; // Exit the function to break the loop
        }
        
        // Update UI
        ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(prayer => {
            const element = document.querySelector(`[data-prayer="${prayer}"] .prayer-time`);
            console.log(`Updating ${prayer}:`, element, this.prayerTimes[prayer]);
            
            if (element) {
                if (this.prayerTimes[prayer]) {
                    element.textContent = this.prayerTimes[prayer];
                } else {
                    element.textContent = 'Calculating...';
                    console.warn(`No time calculated for ${prayer}`);
                }
            } else {
                console.warn(`Element not found for prayer: ${prayer}`);
            }
        });
        
        this.highlightCurrentPrayer();
    }

    highlightCurrentPrayer() {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const prayerMinutes = {};
        for (let prayer in this.prayerTimes) {
            const [h, m] = this.prayerTimes[prayer].split(':').map(Number);
            prayerMinutes[prayer] = h * 60 + m;
        }
        
        // Remove all active classes
        document.querySelectorAll('.prayer-card').forEach(item => {
            item.classList.remove('active');
        });
        
        // Find current prayer period
        const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
        for (let i = 0; i < prayers.length; i++) {
            const currentPrayer = prayers[i];
            const nextPrayer = prayers[(i + 1) % prayers.length];
            const currentPrayerTime = prayerMinutes[currentPrayer];
            const nextPrayerTime = prayerMinutes[nextPrayer];
            
            if ((currentPrayerTime <= currentTime && currentTime < nextPrayerTime) ||
                (currentPrayerTime > nextPrayerTime && (currentTime >= currentPrayerTime || currentTime < nextPrayerTime))) {
                document.querySelector(`[data-prayer="${currentPrayer}"]`).classList.add('active');
                break;
            }
        }
    }

    startCountdown() {
        // Clear any existing countdown
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
        
        this.countdownInterval = setInterval(() => {
            this.updateCountdown();
        }, 1000);
    }

    cleanup() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
    }

    updateCountdown() {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const prayerMinutes = {};
        const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
        
        for (let prayer of prayers) {
            const [h, m] = this.prayerTimes[prayer].split(':').map(Number);
            prayerMinutes[prayer] = h * 60 + m;
        }
        
        // Find next prayer
        let nextPrayer = '';
        let minDiff = 24 * 60;
        
        for (let prayer of prayers) {
            let diff = prayerMinutes[prayer] - currentTime;
            if (diff < 0) diff += 24 * 60;
            if (diff < minDiff) {
                minDiff = diff;
                nextPrayer = prayer;
            }
        }
        
        // Update UI
        const nextPrayerEl = document.getElementById('nextPrayerName');
        if (nextPrayerEl) {
            nextPrayerEl.textContent = nextPrayer.charAt(0).toUpperCase() + nextPrayer.slice(1);
        }
        
        const hours = Math.floor(minDiff / 60);
        const minutes = Math.floor(minDiff % 60);
        const seconds = 60 - now.getSeconds();
        
        const countdownEl = document.getElementById('countdownTimer');
        if (countdownEl) {
            countdownEl.textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // Check for notifications
        if (minDiff === this.notificationTime) {
            this.sendNotification(nextPrayer);
        }
    }

    updatePrayerStatus(prayer, checked) {
        const today = new Date().toDateString();
        const status = JSON.parse(localStorage.getItem('prayerStatus') || '{}');
        
        if (!status[today]) status[today] = {};
        status[today][prayer] = checked;
        
        localStorage.setItem('prayerStatus', JSON.stringify(status));
        
        if (checked) {
            document.querySelector(`[data-prayer="${prayer}"]`).classList.add('completed');
        } else {
            document.querySelector(`[data-prayer="${prayer}"]`).classList.remove('completed');
        }
        
        this.updateProgress();
    }

    loadPrayerStatus() {
        const today = new Date().toDateString();
        const status = JSON.parse(localStorage.getItem('prayerStatus') || '{}');
        const todayStatus = status[today] || {};
        
        for (let prayer in todayStatus) {
            if (todayStatus[prayer]) {
                document.getElementById(`${prayer}-check`).checked = true;
                document.querySelector(`[data-prayer="${prayer}"]`).classList.add('completed');
            }
        }
        
        this.updateProgress();
    }

    updateProgress() {
        const checkboxes = document.querySelectorAll('.prayer-check');
        const completed = Array.from(checkboxes).filter(cb => cb.checked).length;
        const percentage = (completed / 5) * 100;
        
        document.getElementById('progressFill').style.width = `${percentage}%`;
        document.getElementById('progressText').textContent = 
            `${completed} of 5 prayers completed`;
    }

    checkNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'granted') {
            document.getElementById('notificationBtn').textContent = 'Notifications Enabled';
            document.getElementById('notificationBtn').disabled = true;
        }
    }

    async requestNotificationPermission() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                document.getElementById('notificationBtn').textContent = 'Notifications Enabled';
                document.getElementById('notificationBtn').disabled = true;
                new Notification('Salat Planner', {
                    body: 'Notifications enabled! You will be reminded before each prayer.',
                    icon: '/icon-192x192.png'
                });
            }
        }
    }

    sendNotification(prayer) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Prayer Reminder', {
                body: `${prayer.charAt(0).toUpperCase() + prayer.slice(1)} prayer in ${this.notificationTime} minutes`,
                icon: '/icon-192x192.png',
                tag: 'prayer-reminder',
                requireInteraction: true
            });
        }
    }

    loadSettings() {
        const settings = JSON.parse(localStorage.getItem('salatSettings') || '{}');
        
        if (settings.calculationMethod) {
            this.calculator.calculationMethod = settings.calculationMethod;
            document.getElementById('calcMethod').value = settings.calculationMethod;
        }
        
        if (settings.notificationTime !== undefined) {
            this.notificationTime = settings.notificationTime;
            if (document.getElementById('notificationTime')) {
                document.getElementById('notificationTime').value = settings.notificationTime;
            }
        }
        
        if (settings.professionalMode !== undefined) {
            this.calendarIntegration.professionalMode = settings.professionalMode;
            document.getElementById('professionalMode').checked = settings.professionalMode;
        }
        
        if (settings.eventDuration !== undefined) {
            this.calendarIntegration.eventDuration = settings.eventDuration;
            document.getElementById('eventDuration').value = settings.eventDuration;
        }
    }

    async saveSettings() {
        const calculationMethod = document.getElementById('calcMethod').value;
        const professionalMode = document.getElementById('professionalMode').checked;
        const eventDuration = parseInt(document.getElementById('eventDuration').value);
        const notificationTime = document.getElementById('notificationTime') ? 
            parseInt(document.getElementById('notificationTime').value) : this.notificationTime;
        
        this.calculator.calculationMethod = calculationMethod;
        this.calendarIntegration.professionalMode = professionalMode;
        this.calendarIntegration.eventDuration = eventDuration;
        this.notificationTime = notificationTime;
        
        localStorage.setItem('salatSettings', JSON.stringify({
            calculationMethod,
            professionalMode,
            eventDuration,
            notificationTime
        }));
        
        await this.updatePrayerTimes();
        if (document.getElementById('settingsModal')) {
            document.getElementById('settingsModal').style.display = 'none';
        }
    }

    updateDate() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const today = new Date().toLocaleDateString('en-US', options);
        const dateEl = document.getElementById('todayDate');
        if (dateEl) {
            dateEl.textContent = today;
        }
        
        // Update Hijri date if element exists
        const hijriEl = document.getElementById('hijriDate');
        if (hijriEl) {
            hijriEl.textContent = 'Islamic Calendar Date';
        }
    }

    // Calendar integration methods
    async exportPrayerTimes(period) {
        const events = [];
        const startDate = new Date();
        let endDate = new Date();
        
        switch(period) {
            case 'today':
                endDate = new Date(startDate);
                break;
            case 'week':
                endDate.setDate(startDate.getDate() + 7);
                break;
            case 'month':
                endDate.setMonth(startDate.getMonth() + 1);
                break;
        }
        
        // Generate events for each day
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dayPrayerTimes = await this.calculator.getPrayerTimes(this.location.latitude, this.location.longitude, new Date(d), this.calculationMethod || 'MWL');
            
            ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(prayer => {
                events.push({
                    prayer: prayer,
                    date: new Date(d),
                    time: dayPrayerTimes[prayer],
                    location: this.location
                });
            });
        }
        
        const icalContent = this.calendarIntegration.generateICalFile(events);
        const filename = `prayer-times-${period}-${startDate.toISOString().split('T')[0]}.ics`;
        this.calendarIntegration.downloadICalFile(filename, icalContent);
    }

    updateSubscriptionUrl() {
        // Generate a unique subscription URL (in a real app, this would be a server endpoint)
        const baseUrl = window.location.origin + window.location.pathname;
        const params = new URLSearchParams({
            lat: this.location.latitude.toFixed(4),
            lon: this.location.longitude.toFixed(4),
            method: this.calculator.calculationMethod,
            subscribe: 'true'
        });
        
        const subscriptionUrl = `${baseUrl}?${params.toString()}`;
        document.getElementById('subscriptionUrl').value = subscriptionUrl;
    }

    async connectGoogleCalendar() {
        const statusDiv = document.getElementById('googleStatus');
        
        try {
            // In a real implementation, you would:
            // 1. Load Google API client library
            // 2. Initialize with your client ID
            // 3. Authenticate the user
            // 4. Create calendar events using Google Calendar API
            
            statusDiv.textContent = 'To connect Google Calendar, you need to set up Google OAuth and Calendar API';
            statusDiv.className = 'status-message error';
            
            // Example of what the implementation would look like:
            /*
            await gapi.load('client:auth2');
            await gapi.client.init({
                clientId: this.googleClientId,
                scope: 'https://www.googleapis.com/auth/calendar.events'
            });
            
            const authInstance = gapi.auth2.getAuthInstance();
            await authInstance.signIn();
            
            // Create events in Google Calendar
            for (let prayer of this.prayers) {
                const event = {
                    summary: `${prayer} Prayer`,
                    start: { dateTime: startTime },
                    end: { dateTime: endTime },
                    recurrence: ['RRULE:FREQ=DAILY'],
                    reminders: {
                        useDefault: false,
                        overrides: [
                            { method: 'popup', minutes: this.calendarIntegration.eventReminder }
                        ]
                    }
                };
                
                await gapi.client.calendar.events.insert({
                    calendarId: 'primary',
                    resource: event
                });
            }
            */
            
        } catch (error) {
            statusDiv.textContent = 'Failed to connect to Google Calendar';
            statusDiv.className = 'status-message error';
        }
    }
}

// Global functions for HTML onclick handlers
async function exportToday() {
    if (window.prayerSyncApp) {
        await window.prayerSyncApp.exportPrayerTimes('today');
    }
}

async function exportWeek() {
    if (window.prayerSyncApp) {
        await window.prayerSyncApp.exportPrayerTimes('week');
    }
}

async function exportMonth() {
    if (window.prayerSyncApp) {
        await window.prayerSyncApp.exportPrayerTimes('month');
    }
}

async function quickDownloadCalendar() {
    if (window.prayerSyncApp) {
        await window.prayerSyncApp.exportPrayerTimes('month');
    }
}

async function connectAppleCalendar() {
    if (window.prayerSyncApp) {
        await window.prayerSyncApp.exportPrayerTimes('month');
    }
}

async function updateSelectedLocation() {
    const select = document.getElementById('citySelect');
    if (select && select.value && window.prayerSyncApp) {
        const [lat, lon, name, timezone] = select.value.split(',');
        window.prayerSyncApp.location = {
            latitude: parseFloat(lat),
            longitude: parseFloat(lon)
        };
        window.prayerSyncApp.timezone = timezone;
        await window.prayerSyncApp.updatePrayerTimes();
        
        const locationEl = document.getElementById('locationText');
        if (locationEl) {
            locationEl.textContent = name;
        }
    }
}

function openLocationModal() {
    const modal = document.getElementById('locationModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeLocationModal() {
    const modal = document.getElementById('locationModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function useCurrentLocation() {
    if (window.prayerSyncApp) {
        window.prayerSyncApp.getLocation();
    }
    closeLocationModal();
}

async function selectCity(name, country, lat, lon, timezone) {
    if (window.prayerSyncApp) {
        window.prayerSyncApp.location = { latitude: lat, longitude: lon };
        window.prayerSyncApp.timezone = timezone;
        await window.prayerSyncApp.updatePrayerTimes();
        
        const locationEl = document.getElementById('locationText');
        if (locationEl) {
            locationEl.textContent = `${name}, ${country}`;
        }
    }
    closeLocationModal();
}

// App initialization moved to lazy loading in scrollToApp() function
// This improves landing page performance and prevents unnecessary calculations

// Function to initialize the app when user clicks "Try Free App"
function scrollToApp() {
    // Scroll to app section
    const appSection = document.getElementById('app');
    if (appSection) {
        appSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Initialize the app if not already initialized
    if (!window.prayerSyncApp) {
        console.log('Initializing PrayerSync app...');
        window.prayerSyncApp = new PrayerSync();
    }
}

// Register service worker for offline functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => console.log('ServiceWorker registered'))
            .catch(error => console.log('ServiceWorker registration failed:', error));
    });
}