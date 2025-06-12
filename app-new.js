// Modern PrayerSync App with Location & Travel Management
class PrayerSync {
    constructor() {
        this.prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        this.location = null;
        this.prayerTimes = {};
        this.settings = {
            calculationMethod: 'MWL',
            reminderTime: 15
        };
        this.googleAuth = null;
        this.outlookAuth = null;
        this.travelMode = false;
        this.recentLocations = [];
        this.locationSearchTimeout = null;
        this.shareManager = new NativeShareManager();
        this.init();
    }

    async init() {
        await this.loadSettings();
        await this.loadRecentLocations();
        await this.getLocation();
        this.setupEventListeners();
        this.calculatePrayerTimes();
        this.updateUI();
        this.startCountdown();
        this.loadGoogleAPI();
        this.setupLocationSearch();
    }

    // Navigation functions
    showApp() {
        document.getElementById('landingPage').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
    }

    showLanding() {
        document.getElementById('landingPage').style.display = 'block';
        document.getElementById('mainApp').style.display = 'none';
    }

    scrollToFeatures() {
        document.getElementById('features').scrollIntoView({ behavior: 'smooth' });
    }

    // Enhanced Location Management
    async getLocation() {
        try {
            document.getElementById('locationText').textContent = 'Detecting location...';
            document.getElementById('locationBadge').classList.add('location-loading');
            
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5 minutes
                });
            });
            
            const locationData = await this.reverseGeocode(position.coords.latitude, position.coords.longitude);
            
            this.setLocation({
                name: locationData.city,
                country: locationData.country,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                timezone: locationData.timezone
            });
            
        } catch (error) {
            console.error('Location error:', error);
            // Default to Mecca
            await this.setLocation({
                name: 'Mecca',
                country: 'Saudi Arabia',
                latitude: 21.4225,
                longitude: 39.8262,
                timezone: 'Asia/Riyadh'
            });
        } finally {
            document.getElementById('locationBadge').classList.remove('location-loading');
        }
    }

    async reverseGeocode(lat, lon) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
            const data = await response.json();
            
            const city = data.address.city || data.address.town || data.address.village || 'Unknown';
            const country = data.address.country || 'Unknown';
            
            // Get timezone
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            
            return { city, country, timezone };
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            return { city: 'Unknown', country: 'Unknown', timezone: 'UTC' };
        }
    }

    async setLocation(locationData, saveToRecent = true) {
        this.location = locationData;
        
        // Update UI
        document.getElementById('locationText').textContent = locationData.name;
        
        // Save to recent locations
        if (saveToRecent) {
            this.addToRecentLocations(locationData);
        }
        
        // Recalculate prayer times
        this.calculatePrayerTimes();
        this.updateUI();
        
        // Update calendar if travel mode is active and user is synced
        if (this.travelMode && this.isCalendarSynced()) {
            await this.updateCalendarForNewLocation();
        }
        
        this.showToast(`Professional location updated to ${locationData.name}`, 'success');
    }

    // Location Search with Autocomplete
    setupLocationSearch() {
        const searchInput = document.getElementById('locationSearch');
        const suggestionsDiv = document.getElementById('searchSuggestions');
        
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            if (this.locationSearchTimeout) {
                clearTimeout(this.locationSearchTimeout);
            }
            
            if (query.length < 3) {
                suggestionsDiv.classList.remove('show');
                return;
            }
            
            this.locationSearchTimeout = setTimeout(() => {
                this.searchLocations(query);
            }, 300);
        });
        
        searchInput.addEventListener('blur', () => {
            // Delay hiding to allow click on suggestions
            setTimeout(() => {
                suggestionsDiv.classList.remove('show');
            }, 200);
        });
    }

    async searchLocations(query) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`);
            const results = await response.json();
            
            this.displaySearchSuggestions(results);
        } catch (error) {
            console.error('Location search error:', error);
        }
    }

    displaySearchSuggestions(results) {
        const suggestionsDiv = document.getElementById('searchSuggestions');
        
        if (results.length === 0) {
            suggestionsDiv.classList.remove('show');
            return;
        }
        
        suggestionsDiv.innerHTML = results.map(result => {
            const city = result.address.city || result.address.town || result.address.village || result.display_name.split(',')[0];
            const country = result.address.country || '';
            
            // Escape HTML to prevent XSS
            const escapeHtml = (str) => str.replace(/[&<>"']/g, match => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[match]);
            
            const safeCity = escapeHtml(city);
            const safeCountry = escapeHtml(country);
            
            return `
                <div class="suggestion-item" onclick="selectSearchResult('${safeCity}', '${safeCountry}', ${result.lat}, ${result.lon})">
                    <div class="suggestion-name">${safeCity}</div>
                    <div class="suggestion-country">${safeCountry}</div>
                </div>
            `;
        }).join('');
        
        suggestionsDiv.classList.add('show');
    }

    // Recent Locations Management
    addToRecentLocations(location) {
        // Remove if already exists
        this.recentLocations = this.recentLocations.filter(loc => 
            !(loc.latitude === location.latitude && loc.longitude === location.longitude)
        );
        
        // Add to beginning with timestamp
        this.recentLocations.unshift({
            ...location,
            lastUsed: new Date().toISOString()
        });
        
        // Keep only last 5 locations
        this.recentLocations = this.recentLocations.slice(0, 5);
        
        this.saveRecentLocations();
        this.updateRecentLocationsUI();
    }

    updateRecentLocationsUI() {
        const recentList = document.getElementById('recentList');
        const recentSection = document.getElementById('recentLocations');
        
        if (this.recentLocations.length === 0) {
            recentSection.style.display = 'none';
            return;
        }
        
        recentSection.style.display = 'block';
        
        recentList.innerHTML = this.recentLocations.map(location => {
            const timeAgo = this.getTimeAgo(new Date(location.lastUsed));
            
            // Escape HTML to prevent XSS
            const escapeHtml = (str) => str.replace(/[&<>"']/g, match => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[match]);
            
            const safeName = escapeHtml(location.name);
            const safeCountry = escapeHtml(location.country);
            const safeTimezone = escapeHtml(location.timezone);
            
            return `
                <div class="recent-item" onclick="selectRecentLocation('${safeName}', '${safeCountry}', ${location.latitude}, ${location.longitude}, '${safeTimezone}')">
                    <div class="recent-name">${safeName}, ${safeCountry}</div>
                    <div class="recent-time">${timeAgo}</div>
                </div>
            `;
        }).join('');
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
        
        if (diffInHours < 1) return 'Just now';
        if (diffInHours < 24) return `${diffInHours}h ago`;
        
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) return `${diffInDays}d ago`;
        
        return date.toLocaleDateString();
    }

    // Travel Mode Management
    toggleTravelMode() {
        this.travelMode = !this.travelMode;
        const btn = document.getElementById('travelModeBtn');
        const notification = document.getElementById('travelNotification');
        
        if (this.travelMode) {
            btn.classList.add('active');
            notification.classList.add('show');
            this.showToast('Business Travel Mode activated - Professional calendar syncs automatically across time zones', 'success');
            
            // Hide notification after 5 seconds
            setTimeout(() => {
                notification.classList.remove('show');
            }, 5000);
        } else {
            btn.classList.remove('active');
            notification.classList.remove('show');
            this.showToast('Business Travel Mode deactivated', 'info');
        }
        
        // Save travel mode preference
        localStorage.setItem('travelMode', this.travelMode);
    }

    // Calendar sync status check
    isCalendarSynced() {
        // Check if user has synced with any calendar
        return localStorage.getItem('googleSynced') === 'true' || localStorage.getItem('outlookSynced') === 'true';
    }

    async updateCalendarForNewLocation() {
        try {
            this.showToast('Updating calendar for new location...', 'info');
            
            // In production, this would call your backend API to update calendar events
            await this.simulateCalendarUpdate();
            
            this.showToast('Calendar updated successfully!', 'success');
        } catch (error) {
            console.error('Calendar update error:', error);
            this.showToast('Failed to update calendar', 'error');
        }
    }

    async simulateCalendarUpdate() {
        // Simulate API call
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('Calendar updated for new location:', this.location);
                resolve();
            }, 1500);
        });
    }

    // Prayer time calculation (simplified for demo)
    calculatePrayerTimes() {
        const now = new Date();
        const baseHour = 5; // Starting from 5 AM
        
        // Simplified calculation for demo
        this.prayerTimes = {
            Fajr: this.formatTime(baseHour, 0),
            Dhuhr: this.formatTime(baseHour + 7, 30),
            Asr: this.formatTime(baseHour + 10, 30),
            Maghrib: this.formatTime(baseHour + 13, 15),
            Isha: this.formatTime(baseHour + 15, 0)
        };
    }

    formatTime(hours, minutes) {
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }

    // UI Updates
    updateUI() {
        // Update date
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('todayDate').textContent = now.toLocaleDateString('en-US', options);
        
        // Update Hijri date (simplified)
        document.getElementById('hijriDate').textContent = this.getHijriDate();
        
        // Update prayer cards
        this.updatePrayerCards();
    }

    getHijriDate() {
        // Simplified Hijri date calculation
        const months = ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Jumada al-Awwal', 
                       'Jumada al-Thani', 'Rajab', 'Shaban', 'Ramadan', 'Shawwal', 'Dhul Qadah', 'Dhul Hijjah'];
        const date = new Date();
        const hijriMonth = months[date.getMonth()];
        const hijriDay = date.getDate();
        const hijriYear = date.getFullYear() - 579; // Simplified conversion
        return `${hijriDay} ${hijriMonth} ${hijriYear}`;
    }

    updatePrayerCards() {
        const container = document.getElementById('prayerCards');
        container.innerHTML = '';
        
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        this.prayers.forEach((prayer, index) => {
            const time = this.prayerTimes[prayer];
            const card = document.createElement('div');
            card.className = 'prayer-card';
            
            // Check if this is the current prayer
            const [hours, minutes] = this.parseTime(time);
            const prayerMinutes = hours * 60 + minutes;
            
            if (index === this.getCurrentPrayerIndex()) {
                card.classList.add('active');
            }
            
            card.innerHTML = `
                <div class="prayer-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L2 12L12 22L22 12L12 2Z" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </div>
                <div class="prayer-info">
                    <h4>${prayer}</h4>
                    <p>Prayer time</p>
                </div>
                <div class="prayer-time">${time}</div>
            `;
            
            container.appendChild(card);
        });
    }

    parseTime(timeStr) {
        const [time, period] = timeStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return [hours, minutes];
    }

    getCurrentPrayerIndex() {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        
        for (let i = this.prayers.length - 1; i >= 0; i--) {
            const [hours, minutes] = this.parseTime(this.prayerTimes[this.prayers[i]]);
            const prayerMinutes = hours * 60 + minutes;
            if (currentMinutes >= prayerMinutes) {
                return i;
            }
        }
        return 0;
    }

    // Countdown timer
    startCountdown() {
        setInterval(() => this.updateCountdown(), 1000);
    }

    updateCountdown() {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
        
        // Find next prayer
        let nextPrayerIndex = 0;
        let minDiff = 24 * 60;
        
        this.prayers.forEach((prayer, index) => {
            const [hours, minutes] = this.parseTime(this.prayerTimes[prayer]);
            const prayerMinutes = hours * 60 + minutes;
            let diff = prayerMinutes - currentMinutes;
            if (diff < 0) diff += 24 * 60;
            if (diff < minDiff) {
                minDiff = diff;
                nextPrayerIndex = index;
            }
        });
        
        const nextPrayer = this.prayers[nextPrayerIndex];
        document.getElementById('nextPrayerName').textContent = `${nextPrayer} Prayer`;
        
        // Calculate countdown
        const hours = Math.floor(minDiff / 60);
        const minutes = Math.floor(minDiff % 60);
        const seconds = Math.floor((minDiff * 60) % 60);
        
        document.getElementById('countdownTimer').textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Update progress bar
        const totalMinutes = 24 * 60;
        const progress = (1 - minDiff / totalMinutes) * 100;
        document.getElementById('progressBar').style.width = `${progress}%`;
    }

    // Google Calendar Integration
    loadGoogleAPI() {
        // Load Google API script
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => this.initGoogleClient();
        document.body.appendChild(script);
    }

    initGoogleClient() {
        // Initialize Google API client
        // In production, replace with your actual client ID and API key
        if (typeof gapi !== 'undefined') {
            gapi.load('client:auth2', () => {
                gapi.client.init({
                    apiKey: 'YOUR_API_KEY',
                    clientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
                    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
                    scope: 'https://www.googleapis.com/auth/calendar.events'
                }).then(() => {
                    this.googleAuth = gapi.auth2.getAuthInstance();
                }).catch(error => {
                    console.warn('Google API initialization failed:', error);
                });
            });
        } else {
            console.warn('Google API not available - calendar sync will be simulated');
        }
    }

    async syncWithGoogle() {
        const statusEl = document.getElementById('syncStatus');
        const button = document.getElementById('googleSyncBtn');
        
        try {
            button.classList.add('loading');
            statusEl.textContent = 'Connecting to Google Calendar...';
            statusEl.className = 'sync-status';
            
            // In production, this would actually authenticate and sync
            // For demo, we'll simulate the process
            await this.simulateSync();
            
            statusEl.textContent = 'Successfully synced prayer times to Google Calendar!';
            statusEl.className = 'sync-status success';
            
            // Mark as synced
            localStorage.setItem('googleSynced', 'true');
            
            this.showToast('Professional prayer schedule synced to Google Workspace', 'success');
            
        } catch (error) {
            statusEl.textContent = 'Failed to sync. Please try again.';
            statusEl.className = 'sync-status error';
            this.showToast('Sync failed. Please try again.', 'error');
        } finally {
            button.classList.remove('loading');
        }
    }

    async syncWithOutlook() {
        const statusEl = document.getElementById('syncStatus');
        const button = document.getElementById('outlookSyncBtn');
        
        try {
            button.classList.add('loading');
            statusEl.textContent = 'Connecting to Outlook...';
            statusEl.className = 'sync-status';
            
            // In production, this would use Microsoft Graph API
            await this.simulateSync();
            
            statusEl.textContent = 'Successfully synced prayer times to Outlook!';
            statusEl.className = 'sync-status success';
            
            // Mark as synced
            localStorage.setItem('outlookSynced', 'true');
            
            this.showToast('Professional prayer schedule synced to Microsoft 365', 'success');
            
        } catch (error) {
            statusEl.textContent = 'Failed to sync. Please try again.';
            statusEl.className = 'sync-status error';
            this.showToast('Sync failed. Please try again.', 'error');
        } finally {
            button.classList.remove('loading');
        }
    }

    async simulateSync() {
        // Simulate API call delay
        return new Promise((resolve) => {
            setTimeout(() => {
                // In production, this would create actual calendar events
                console.log('Creating calendar events for prayers:', this.prayerTimes);
                resolve();
            }, 2000);
        });
    }

    // Event Listeners
    setupEventListeners() {
        // Google sync
        document.getElementById('googleSyncBtn').addEventListener('click', () => {
            this.syncWithGoogle();
        });
        
        // Outlook sync
        document.getElementById('outlookSyncBtn').addEventListener('click', () => {
            this.syncWithOutlook();
        });
        
        // Settings
        document.getElementById('calcMethod').addEventListener('change', (e) => {
            this.settings.calculationMethod = e.target.value;
            this.saveSettings();
            this.calculatePrayerTimes();
            this.updateUI();
        });
        
        document.getElementById('reminderTime').addEventListener('change', (e) => {
            this.settings.reminderTime = parseInt(e.target.value);
            this.saveSettings();
        });
    }

    // Settings Management
    async loadSettings() {
        const saved = localStorage.getItem('prayerSyncSettings');
        if (saved) {
            this.settings = JSON.parse(saved);
            document.getElementById('calcMethod').value = this.settings.calculationMethod;
            document.getElementById('reminderTime').value = this.settings.reminderTime;
        }
        
        // Load travel mode preference
        this.travelMode = localStorage.getItem('travelMode') === 'true';
        if (this.travelMode) {
            document.getElementById('travelModeBtn').classList.add('active');
        }
    }

    saveSettings() {
        localStorage.setItem('prayerSyncSettings', JSON.stringify(this.settings));
    }

    // Recent Locations Storage
    async loadRecentLocations() {
        const saved = localStorage.getItem('recentLocations');
        if (saved) {
            this.recentLocations = JSON.parse(saved);
        }
    }

    saveRecentLocations() {
        localStorage.setItem('recentLocations', JSON.stringify(this.recentLocations));
    }

    // Toast Notifications
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize app
const app = new PrayerSync();

// Native Sharing System
class NativeShareManager {
    constructor() {
        this.baseUrl = 'https://prayersync.app';
        this.shareAnalytics = [];
    }

    // Generate smart links with tracking
    generateShareLink(type, userData = {}) {
        const params = new URLSearchParams({
            ref: type || 'share',
            uid: userData.userId || 'anonymous',
            city: userData.city || '',
            streak: userData.streak || 0,
            utm_source: 'app_share',
            utm_medium: 'social',
            utm_campaign: type
        });

        return `${this.baseUrl}?${params.toString()}`;
    }

    // Platform-specific share messages
    getShareMessage(platform, type, userData = {}) {
        const messages = {
            whatsapp: {
                streak_share: `🔥 ${userData.streak || 7}-Day Professional Prayer Consistency! Alhamdulillah! 🕌

As a Muslim professional, I'm leading with faith while advancing my career.

Join the network! Both get +3 bonus streak days when you join:`,
                
                professional_network: `💼 Found an amazing tool for Muslim professionals!

PrayerSync helps me maintain prayer consistency during demanding work schedules with automatic calendar integration and meeting conflict resolution.

Join thousands of Muslim professionals balancing deen and dunya:`,
                
                prayer_partner: `🤝 Be my Prayer Accountability Partner!

I'm inviting you to join PrayerSync and support each other's prayer journey.

Let's help each other stay consistent with our 5 daily prayers:`,
                
                community_challenge: `🏆 December Prayer Challenge

Join 2,847 Muslims in this month's prayer challenge!

Let's design our December around our prayers together:`,
                
                location_share: `🕌 Prayer times in ${userData.city || 'your city'}

Never miss a prayer while traveling!

Get accurate prayer times anywhere in the world:`
            },
            
            facebook: {
                streak_share: `🔥 ${userData.streak || 7} days of professional prayer consistency! Alhamdulillah for PrayerSync helping me balance career success with spiritual obligations. Leading with faith in the corporate world! 💼🕌✨`,
                
                professional_impact: `Game-changer for Muslim professionals! 💼 PrayerSync solved my biggest challenge: maintaining prayer consistency with demanding work schedules. Calendar integration + meeting conflict alerts = spiritual discipline meets professional excellence. #MuslimProfessionals #LeadingWithFaith`,
                
                community_impact: `Amazing to see 12,000+ Muslims using PrayerSync to prioritize their prayers! 🤲 This app is changing how we balance deen and dunya. #PrayerFirst #MuslimTech`,
                
                professional_muslim: `As a Muslim professional, PrayerSync solved my biggest challenge: maintaining prayer consistency with a demanding work schedule. Game changer! 💼🕌 #MuslimProfessionals`
            },
            
            telegram: {
                islamic_study_group: `📚 Sharing a beneficial app: PrayerSync helps maintain prayer consistency while balancing work/studies. Thought it might benefit the community! 🤲`,
                
                community_channel: `🕌 For our Muslim community: Found this prayer time app that helps coordinate with work schedules. Multiple calculation methods and travel features. Barakallahu feekum! 🌟`
            },
            
            sms: {
                family_invite: `Assalamu alaikum! I recommended PrayerSync app for prayer times & reminders. Helps with consistency MashaAllah!`,
                
                simple_share: `Found this helpful Islamic app: PrayerSync. Prayer times, Qibla direction, travel mode. Free download:`,
                
                elder_friendly: `Islamic prayer app recommendation: PrayerSync. Simple to use, accurate times, helpful reminders. Download free:`
            },
            
            linkedin: {
                professional_story: `As a Muslim professional, maintaining prayer consistency while advancing my career was my biggest challenge.

PrayerSync transformed this by:
✅ Automatic enterprise calendar integration (Google Workspace, O365)
✅ Intelligent meeting conflict detection and resolution
✅ Business travel mode with cross-timezone support
✅ Professional notification system

Result: ${userData.streak || 30}-day streak of spiritual discipline while achieving career milestones.

Leadership principle: Excellence in deen enables excellence in dunya. It's about designing professional life to honor both spiritual obligations and career aspirations.

#MuslimProfessionals #SpiritualLeadership #WorkLifeIntegration #LeadingWithFaith #ProfessionalExcellence`
            }
        };

        return messages[platform]?.[type] || messages[platform]?.simple_share || 'Check out PrayerSync - the Islamic prayer app for busy professionals!';
    }

    // Native platform sharing
    async shareToWhatsApp(shareData) {
        const message = encodeURIComponent(`${shareData.text}\n\n${shareData.url}`);
        
        if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            window.open(`whatsapp://send?text=${message}`, '_blank');
        } else {
            window.open(`https://web.whatsapp.com/send?text=${message}`, '_blank');
        }
        
        this.trackShare('whatsapp', shareData.type);
    }

    shareToFacebook(shareData) {
        const facebookUrl = `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({
            u: shareData.url,
            quote: shareData.text
        }).toString()}`;
        
        window.open(facebookUrl, 'facebook-share', 'width=580,height=296');
        this.trackShare('facebook', shareData.type);
    }

    shareToTelegram(shareData) {
        const telegramUrl = `https://t.me/share/url?${new URLSearchParams({
            url: shareData.url,
            text: shareData.text
        }).toString()}`;
        
        window.open(telegramUrl, '_blank');
        this.trackShare('telegram', shareData.type);
    }

    shareViaSMS(shareData) {
        const smsBody = encodeURIComponent(`${shareData.text}\n\n${shareData.url}`);
        window.open(`sms:?body=${smsBody}`, '_self');
        this.trackShare('sms', shareData.type);
    }

    shareToLinkedIn(shareData) {
        const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({
            url: shareData.url,
            title: shareData.title,
            summary: shareData.text
        }).toString()}`;
        
        window.open(linkedinUrl, '_blank');
        this.trackShare('linkedin', shareData.type);
    }

    async shareNatively(shareData) {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: shareData.title,
                    text: shareData.text,
                    url: shareData.url
                });
                this.trackShare('native', shareData.type);
                return true;
            } catch (error) {
                console.log('Native sharing failed, falling back to custom modal');
                return false;
            }
        }
        return false;
    }

    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
        
        this.trackShare('clipboard', 'copy_link');
        app.showToast('Link copied to clipboard!', 'success');
    }

    trackShare(platform, shareType) {
        const event = {
            timestamp: new Date().toISOString(),
            platform: platform,
            shareType: shareType,
            userId: app.getUserId?.() || 'anonymous',
            city: app.location?.name || 'unknown'
        };

        this.shareAnalytics.push(event);
        
        // Store locally
        localStorage.setItem('shareEvents', JSON.stringify(this.shareAnalytics));
        
        // Send to analytics (if backend available)
        if (window.gtag) {
            gtag('event', 'share', {
                method: platform,
                content_type: shareType,
                content_id: shareType
            });
        }
    }
}

// Global functions for onclick handlers
function showApp() {
    app.showApp();
}

function showLanding() {
    app.showLanding();
}

function scrollToFeatures() {
    app.scrollToFeatures();
}

// Location Modal Functions
function openLocationModal() {
    document.getElementById('locationModal').style.display = 'block';
    app.updateRecentLocationsUI();
}

function closeLocationModal() {
    document.getElementById('locationModal').style.display = 'none';
    document.getElementById('searchSuggestions').classList.remove('show');
}

function useCurrentLocation() {
    closeLocationModal();
    app.getLocation();
}

function selectCity(name, country, lat, lon, timezone) {
    app.setLocation({
        name: name,
        country: country,
        latitude: lat,
        longitude: lon,
        timezone: timezone
    });
    closeLocationModal();
}

function selectSearchResult(name, country, lat, lon) {
    // Get timezone based on coordinates (simplified)
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    app.setLocation({
        name: name,
        country: country,
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        timezone: timezone
    });
    closeLocationModal();
}

function selectRecentLocation(name, country, lat, lon, timezone) {
    app.setLocation({
        name: name,
        country: country,
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        timezone: timezone
    }, false); // Don't add to recent again
    closeLocationModal();
}

function toggleTravelMode() {
    app.toggleTravelMode();
}

// Initialize share manager
const shareManager = new NativeShareManager();

// Viral Sharing Functions
function showStreakShare() {
    document.getElementById('streakShareModal').style.display = 'block';
}

function closeStreakShare() {
    document.getElementById('streakShareModal').style.display = 'none';
}

function showInviteOptions() {
    document.getElementById('inviteModal').style.display = 'block';
}

function closeInviteModal() {
    document.getElementById('inviteModal').style.display = 'none';
}

function showCommunityChallenge() {
    document.getElementById('challengeModal').style.display = 'block';
}

function closeChallengeModal() {
    document.getElementById('challengeModal').style.display = 'none';
}

// Native Platform Sharing Functions
function shareToWhatsApp() {
    const userData = {
        streak: 7,
        city: app.location?.name || 'your city',
        userId: 'user123'
    };
    
    const shareData = {
        title: 'PrayerSync - Islamic Prayer App',
        text: shareManager.getShareMessage('whatsapp', 'streak_share', userData),
        url: shareManager.generateShareLink('streak_share', userData),
        type: 'streak_share'
    };
    
    shareManager.shareToWhatsApp(shareData);
    closeStreakShare();
}

function shareToInstagram() {
    const userData = { streak: 7, city: app.location?.name };
    const shareData = {
        title: 'PrayerSync Achievement',
        text: `🔥 7-Day Prayer Streak! Designing life around prayers 🕌`,
        url: shareManager.generateShareLink('streak_share', userData),
        type: 'streak_share'
    };
    
    // For Instagram, we'll copy to clipboard with instructions
    const fullText = `${shareData.text}\n\n${shareData.url}`;
    shareManager.copyToClipboard(fullText);
    app.showToast('Text copied! Paste in Instagram Story', 'success');
    closeStreakShare();
}

function shareToTwitter() {
    const userData = { streak: 7, city: app.location?.name };
    const shareData = {
        title: 'PrayerSync',
        text: `🔥 7-day prayer streak Alhamdulillah! Designing my life around prayers, not the other way around. Join the movement! 🕌`,
        url: shareManager.generateShareLink('streak_share', userData),
        type: 'streak_share'
    };
    
    const twitterUrl = `https://twitter.com/intent/tweet?${new URLSearchParams({
        text: `${shareData.text} ${shareData.url}`
    }).toString()}`;
    
    window.open(twitterUrl, '_blank');
    shareManager.trackShare('twitter', shareData.type);
    closeStreakShare();
}

function shareToTelegram() {
    const userData = { streak: 7, city: app.location?.name };
    const shareData = {
        title: 'PrayerSync Achievement',
        text: shareManager.getShareMessage('telegram', 'streak_share', userData),
        url: shareManager.generateShareLink('streak_share', userData),
        type: 'streak_share'
    };
    
    shareManager.shareToTelegram(shareData);
    closeStreakShare();
}

function shareViaSMS() {
    const userData = { streak: 7, city: app.location?.name };
    const shareData = {
        title: 'PrayerSync Achievement',
        text: shareManager.getShareMessage('sms', 'streak_share', userData),
        url: shareManager.generateShareLink('streak_share', userData),
        type: 'streak_share'
    };
    
    shareManager.shareViaSMS(shareData);
    closeStreakShare();
}

function shareToFacebook() {
    const userData = { streak: 7, city: app.location?.name };
    const shareData = {
        title: 'PrayerSync Professional Achievement',
        text: shareManager.getShareMessage('facebook', 'streak_share', userData),
        url: shareManager.generateShareLink('streak_share', userData),
        type: 'streak_share'
    };
    
    shareManager.shareToFacebook(shareData);
    closeStreakShare();
}

function shareNatively() {
    const userData = { streak: 7, city: app.location?.name };
    const shareData = {
        title: 'PrayerSync - Professional Prayer Management',
        text: `🔥 7-day professional prayer consistency! Leading with faith while advancing my career.`,
        url: shareManager.generateShareLink('streak_share', userData),
        type: 'streak_share'
    };
    
    shareManager.shareNatively(shareData).then(success => {
        if (success) {
            closeStreakShare();
        }
    });
}

function inviteViaWhatsApp() {
    const userData = { city: app.location?.name, userId: 'user123' };
    const shareData = {
        title: 'Join PrayerSync',
        text: shareManager.getShareMessage('whatsapp', 'prayer_partner', userData),
        url: shareManager.generateShareLink('prayer_partner', userData),
        type: 'prayer_partner'
    };
    
    shareManager.shareToWhatsApp(shareData);
    closeInviteModal();
}

function inviteViaEmail() {
    const userData = { city: app.location?.name, userId: 'user123' };
    const shareData = {
        title: 'Prayer Accountability Partner Invitation',
        text: `I'd love for you to be my prayer accountability partner! 

PrayerSync helps busy professionals maintain consistent prayer schedules by integrating with work calendars and providing gentle reminders.

Join me in designing our lives around our prayers:`,
        url: shareManager.generateShareLink('prayer_partner', userData),
        type: 'prayer_partner'
    };
    
    const emailUrl = `mailto:?subject=${encodeURIComponent(shareData.title)}&body=${encodeURIComponent(`${shareData.text}\n\n${shareData.url}`)}`;
    window.open(emailUrl, '_self');
    shareManager.trackShare('email', shareData.type);
    closeInviteModal();
}

function copyInviteLink() {
    const userData = { city: app.location?.name, userId: 'user123' };
    const shareUrl = shareManager.generateShareLink('prayer_partner', userData);
    const fullMessage = `Join me on PrayerSync! 🕌 I'm designing my daily life around prayers instead of letting life get in the way. Let's support each other's prayer journey: ${shareUrl}`;
    
    shareManager.copyToClipboard(fullMessage);
    closeInviteModal();
}

function invitePrayerPartner() {
    showInviteOptions();
}

function showMakeupModal() {
    document.getElementById('makeupModal').style.display = 'block';
}

function closeMakeupModal() {
    document.getElementById('makeupModal').style.display = 'none';
}

function showMissedList() {
    app.showToast('Missed prayers list feature coming soon!', 'info');
}

function completeMakeupPrayer() {
    // Add makeup prayer completion logic
    app.showToast('Makeup prayer completed! May Allah accept it.', 'success');
    closeMakeupModal();
}

function showMeetingSuggestions() {
    document.getElementById('meetingSuggestionsModal').style.display = 'block';
}

function closeMeetingSuggestions() {
    document.getElementById('meetingSuggestionsModal').style.display = 'none';
}

function dismissConflict() {
    document.getElementById('conflictAlert').style.display = 'none';
}

function copySuggestions() {
    const suggestions = "Alternative meeting times:\n• 1:00 PM - 1:30 PM (before Asr)\n• 4:00 PM - 4:30 PM (after Asr)\n• 5:00 PM - 5:30 PM (before Maghrib)";
    shareManager.copyToClipboard(suggestions);
}

function emailSuggestions() {
    const suggestions = `I have a prior commitment from 3:30-4:00 PM. Would any of these alternative times work?

• 1:00 PM - 1:30 PM
• 4:00 PM - 4:30 PM  
• 5:00 PM - 5:30 PM

Thank you for understanding!`;
    
    const emailUrl = `mailto:?subject=Meeting Time Alternatives&body=${encodeURIComponent(suggestions)}`;
    window.open(emailUrl, '_self');
}

function joinChallenge() {
    app.showToast('Welcome to the December Prayer Challenge! 🏆', 'success');
    closeChallengeModal();
}

function inviteToChallenge() {
    const userData = { city: app.location?.name };
    const shareData = {
        title: 'Join December Prayer Challenge',
        text: shareManager.getShareMessage('whatsapp', 'community_challenge', userData),
        url: shareManager.generateShareLink('community_challenge', userData),
        type: 'community_challenge'
    };
    
    shareManager.shareToWhatsApp(shareData);
    closeChallengeModal();
}

function closeQiblaModal() {
    document.getElementById('qiblaModal').style.display = 'none';
}

function toggleIslamicCalendar() {
    const calendar = document.getElementById('islamicCalendar');
    calendar.classList.toggle('show');
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modals = ['locationModal', 'streakShareModal', 'inviteModal', 'challengeModal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
});