// Prayer time calculation and app logic
class PrayerTimesCalculator {
    constructor() {
        this.date = new Date();
        this.coords = { latitude: 0, longitude: 0 };
        this.timezone = 0;
        this.calculationMethod = 'MWL';
        this.prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
        
        // Calculation method parameters
        this.methods = {
            'MWL': { fajr: 18, isha: 17 },
            'ISNA': { fajr: 15, isha: 15 },
            'Egypt': { fajr: 19.5, isha: 17.5 },
            'Makkah': { fajr: 18.5, isha: '90 min' },
            'Karachi': { fajr: 18, isha: 18 }
        };
    }

    // Convert degrees to radians
    degToRad(deg) {
        return deg * Math.PI / 180;
    }

    // Convert radians to degrees
    radToDeg(rad) {
        return rad * 180 / Math.PI;
    }

    // Calculate Julian date
    julianDate(year, month, day) {
        if (month <= 2) {
            year -= 1;
            month += 12;
        }
        const A = Math.floor(year / 100);
        const B = 2 - A + Math.floor(A / 4);
        return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
    }

    // Calculate sun's declination
    sunDeclination(jd) {
        const T = (jd - 2451545.0) / 36525;
        const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
        const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
        const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
        const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(this.degToRad(M))
                + (0.019993 - 0.000101 * T) * Math.sin(this.degToRad(2 * M))
                + 0.000289 * Math.sin(this.degToRad(3 * M));
        const sunLongitude = L0 + C;
        const lambda = this.degToRad(sunLongitude);
        const obliquity = this.degToRad(23.439 - 0.00000036 * T);
        return this.radToDeg(Math.asin(Math.sin(obliquity) * Math.sin(lambda)));
    }

    // Calculate equation of time
    equationOfTime(jd) {
        const T = (jd - 2451545.0) / 36525;
        const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
        const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
        const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
        const y = Math.tan(this.degToRad(23.439 - 0.00000036 * T) / 2);
        const y2 = y * y;
        const sin2L0 = Math.sin(2 * this.degToRad(L0));
        const sinM = Math.sin(this.degToRad(M));
        const cos2L0 = Math.cos(2 * this.degToRad(L0));
        const sin4L0 = Math.sin(4 * this.degToRad(L0));
        const sin2M = Math.sin(2 * this.degToRad(M));
        return 4 * this.radToDeg(y2 * sin2L0 - 2 * e * y * sinM + 4 * e * y * sin2M * cos2L0 
               - 0.5 * y2 * y2 * sin4L0 - 1.25 * e * e * sin2M);
    }

    // Calculate sun hour angle
    sunHourAngle(lat, decl, angle) {
        const latRad = this.degToRad(lat);
        const declRad = this.degToRad(decl);
        const angleRad = this.degToRad(angle);
        const cosH = -Math.tan(latRad) * Math.tan(declRad) + Math.cos(angleRad) / (Math.cos(latRad) * Math.cos(declRad));
        if (cosH > 1 || cosH < -1) return null;
        return this.radToDeg(Math.acos(cosH));
    }

    // Calculate prayer times
    calculate(date, coords, timezone) {
        this.date = date;
        this.coords = coords;
        this.timezone = timezone;

        const jd = this.julianDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
        const decl = this.sunDeclination(jd);
        const eqt = this.equationOfTime(jd);
        
        const noon = 12 - coords.longitude / 15 - eqt / 60 + timezone;
        
        const method = this.methods[this.calculationMethod];
        const fajrAngle = method.fajr;
        const ishaAngle = typeof method.isha === 'number' ? method.isha : 18;
        
        const times = {};
        
        // Fajr
        const fajrHourAngle = this.sunHourAngle(coords.latitude, decl, 90 + fajrAngle);
        times.fajr = noon - fajrHourAngle / 15;
        
        // Sunrise
        const sunriseHourAngle = this.sunHourAngle(coords.latitude, decl, 90.833);
        times.sunrise = noon - sunriseHourAngle / 15;
        
        // Dhuhr
        times.dhuhr = noon;
        
        // Asr (Shafi method)
        const asrAngle = this.radToDeg(Math.atan(1 + Math.tan(this.degToRad(Math.abs(coords.latitude - decl)))));
        const asrHourAngle = this.sunHourAngle(coords.latitude, decl, 90 - asrAngle);
        times.asr = noon + asrHourAngle / 15;
        
        // Sunset/Maghrib
        times.maghrib = noon + sunriseHourAngle / 15;
        
        // Isha
        const ishaHourAngle = this.sunHourAngle(coords.latitude, decl, 90 + ishaAngle);
        times.isha = noon + ishaHourAngle / 15;
        
        // Handle Isha time for high latitudes
        if (typeof method.isha === 'string' && method.isha.includes('min')) {
            const minutes = parseInt(method.isha);
            times.isha = times.maghrib + minutes / 60;
        }
        
        // Convert to proper time format
        for (let prayer in times) {
            times[prayer] = this.hoursToTime(times[prayer]);
        }
        
        return times;
    }

    // Convert decimal hours to time format
    hoursToTime(hours) {
        if (hours < 0) hours += 24;
        if (hours >= 24) hours -= 24;
        
        const h = Math.floor(hours);
        const m = Math.floor((hours - h) * 60);
        
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }
}

// Calendar integration class
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
            `UID:prayersync-${prayer}-${formatDateWithTZ(startDate)}@prayersync.com`,
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
class SalatApp {
    constructor() {
        this.calculator = new PrayerTimesCalculator();
        this.calendarIntegration = new CalendarIntegration();
        this.prayerTimes = {};
        this.location = { latitude: 0, longitude: 0 };
        this.timezone = 0;
        this.notificationTime = 15;
        this.googleClientId = 'YOUR_GOOGLE_CLIENT_ID'; // Replace with actual client ID
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.getLocation();
        this.loadSettings();
        this.updatePrayerTimes();
        this.startCountdown();
        this.checkNotificationPermission();
        this.loadPrayerStatus();
        this.updateDate();
    }

    setupEventListeners() {
        // Settings modal
        document.getElementById('settingsBtn').addEventListener('click', () => {
            document.getElementById('settingsModal').style.display = 'block';
        });

        document.querySelector('.close').addEventListener('click', () => {
            document.getElementById('settingsModal').style.display = 'none';
        });

        document.getElementById('saveSettings').addEventListener('click', () => {
            this.saveSettings();
        });

        // Calendar modal
        document.getElementById('calendarBtn').addEventListener('click', () => {
            document.getElementById('calendarModal').style.display = 'block';
            this.updateSubscriptionUrl();
        });

        document.getElementById('calendarClose').addEventListener('click', () => {
            document.getElementById('calendarModal').style.display = 'none';
        });

        // Export buttons
        document.getElementById('exportToday').addEventListener('click', () => {
            this.exportPrayerTimes('today');
        });

        document.getElementById('exportWeek').addEventListener('click', () => {
            this.exportPrayerTimes('week');
        });

        document.getElementById('exportMonth').addEventListener('click', () => {
            this.exportPrayerTimes('month');
        });

        // Copy URL button
        document.getElementById('copyUrl').addEventListener('click', () => {
            const urlInput = document.getElementById('subscriptionUrl');
            urlInput.select();
            document.execCommand('copy');
            alert('URL copied to clipboard!');
        });

        // Google Calendar button
        document.getElementById('googleConnect').addEventListener('click', () => {
            this.connectGoogleCalendar();
        });

        // Prayer checkboxes
        document.querySelectorAll('.prayer-check').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.updatePrayerStatus(e.target.id.replace('-check', ''), e.target.checked);
            });
        });

        // Notification button
        document.getElementById('notificationBtn').addEventListener('click', () => {
            this.requestNotificationPermission();
        });

        // Calendar settings
        document.getElementById('eventDuration').addEventListener('change', (e) => {
            this.calendarIntegration.eventDuration = parseInt(e.target.value);
            this.saveSettings();
        });

        document.getElementById('professionalMode').addEventListener('change', (e) => {
            this.calendarIntegration.professionalMode = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('includeLocation').addEventListener('change', (e) => {
            this.calendarIntegration.includeLocation = e.target.checked;
        });
    }

    async getLocation() {
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });
            
            this.location = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };
            
            // Get timezone offset
            this.timezone = -new Date().getTimezoneOffset() / 60;
            
            // Update location display
            document.getElementById('location').textContent = 
                `Lat: ${this.location.latitude.toFixed(2)}, Lon: ${this.location.longitude.toFixed(2)}`;
        } catch (error) {
            console.error('Error getting location:', error);
            // Default to Mecca
            this.location = { latitude: 21.4225, longitude: 39.8262 };
            this.timezone = 3;
            document.getElementById('location').textContent = 'Mecca (default)';
        }
    }

    updatePrayerTimes() {
        const today = new Date();
        this.prayerTimes = this.calculator.calculate(today, this.location, this.timezone);
        
        // Update UI
        ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(prayer => {
            const element = document.querySelector(`[data-prayer="${prayer}"] .prayer-time`);
            if (element && this.prayerTimes[prayer]) {
                element.textContent = this.prayerTimes[prayer];
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
        document.querySelectorAll('.prayer-item').forEach(item => {
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
        setInterval(() => {
            this.updateCountdown();
        }, 1000);
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
        document.getElementById('nextPrayerName').textContent = 
            nextPrayer.charAt(0).toUpperCase() + nextPrayer.slice(1);
        
        const hours = Math.floor(minDiff / 60);
        const minutes = Math.floor(minDiff % 60);
        const seconds = 60 - now.getSeconds();
        
        document.getElementById('countdown').textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
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

    saveSettings() {
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
        
        this.updatePrayerTimes();
        if (document.getElementById('settingsModal')) {
            document.getElementById('settingsModal').style.display = 'none';
        }
    }

    updateDate() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const today = new Date().toLocaleDateString('en-US', options);
        document.getElementById('currentDate').textContent = today;
    }

    // Calendar integration methods
    exportPrayerTimes(period) {
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
            const dayPrayerTimes = this.calculator.calculate(new Date(d), this.location, this.timezone);
            
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

// App initialization moved to lazy loading in scrollToApp() function
// This improves landing page performance and prevents unnecessary calculations

// Register service worker for offline functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => console.log('ServiceWorker registered'))
            .catch(error => console.log('ServiceWorker registration failed:', error));
    });
}