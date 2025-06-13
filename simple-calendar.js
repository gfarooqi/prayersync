// Global variables for selected location
let selectedLocation = {
    lat: 40.7128, // Default to New York
    lon: -74.0060,
    cityName: "New York, NY",
    timezone: "America/New_York"
};

/**
 * Calculates the UTC offset in minutes for a given date and IANA timezone.
 * This is the core of our native timezone solution.
 * @param {string} dateString - The date in 'YYYY-MM-DD' format.
 * @param {string} timezone - The IANA timezone name, e.g., 'America/New_York'.
 * @returns {number} The UTC offset in minutes (e.g., -240 for EDT, 600 for AEST).
 */
function getUtcOffsetInMinutes(dateString, timezone) {
    // Create a reference date at noon UTC. Noon is a safe time that avoids most
    // DST transitions, which typically happen around midnight or early morning.
    const refUtcDate = new Date(`${dateString}T12:00:00Z`);

    // Use Intl.DateTimeFormat to determine the local time parts in the target timezone.
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false, // Use 24-hour clock for easier math
    });

    const parts = formatter.formatToParts(refUtcDate);
    const findPart = (type) => parseInt(parts.find(p => p.type === type)?.value || '0');

    // Reconstruct the local time using its parts, but create it as a UTC date.
    // This gives us a timestamp that we can directly compare with our reference UTC date.
    const localTimeAsUtc = Date.UTC(
        findPart('year'),
        findPart('month') - 1, // Date.UTC months are 0-indexed
        findPart('day'),
        findPart('hour'),
        findPart('minute'),
        findPart('second')
    );

    // The offset is the difference between the reference UTC time and the local time.
    // (e.g., 12:00Z - 08:00Z = 4 hours for New York)
    const offsetInMs = refUtcDate.getTime() - localTimeAsUtc;
    return offsetInMs / (1000 * 60);
}

/**
 * Converts a prayer time from its local timezone to a UTC string for the .ics file.
 * @param {string} apiDate - The date from the API, format 'DD-MM-YYYY'.
 * @param {string} prayerTime - The time from the API, format 'HH:mm'.
 * @param {string} timezone - The IANA timezone name from the API.
 * @returns {string} A UTC datetime string formatted for iCal, e.g., '20241015T230500Z'.
 */
function getIcsUtcString(apiDate, prayerTime, timezone) {
    // 1. Reformat API date from DD-MM-YYYY to YYYY-MM-DD for consistency.
    const [day, month, year] = apiDate.split('-');
    const isoDate = `${year}-${month}-${day}`;

    // 2. Calculate the specific offset for this day and timezone.
    const offsetInMinutes = getUtcOffsetInMinutes(isoDate, timezone);

    // 3. Parse prayer time and create a UTC timestamp as if it were local time.
    const [hours, minutes] = prayerTime.split(':').map(Number);
    const localTimeAsUtcMs = Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), hours, minutes);

    // 4. Calculate the correct UTC time by applying the offset.
    // The formula is: CorrectUTC = LocalTime - Offset
    // Example (New York, UTC-4): 19:05 - (-240 mins) = 19:05 + 4 hours = 23:05 UTC.
    const correctUtcMs = localTimeAsUtcMs - (offsetInMinutes * 60 * 1000);
    const correctUtcDate = new Date(correctUtcMs);

    // 5. Format the final date into the required iCal format (YYYYMMDDTHHmmssZ).
    return correctUtcDate.toISOString().replace(/[-:.]/g, '').substring(0, 15) + 'Z';
}

// Handle location selection from dropdown
function updateSelectedLocation() {
    const select = document.getElementById('citySelect');
    const buttonText = document.getElementById('downloadButtonText');
    
    if (select.value) {
        const [lat, lon, cityName, timezone] = select.value.split(',');
        selectedLocation = {
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            cityName: cityName,
            timezone: timezone
        };
        
        // Update button text
        buttonText.textContent = `Download ${cityName} Prayer Calendar`;
        
        // Update current prayer times display if app is loaded
        if (window.app) {
            window.app.setLocation({
                latitude: selectedLocation.lat,
                longitude: selectedLocation.lon,
                name: selectedLocation.cityName,
                timezone: selectedLocation.timezone
            });
        }
        
        showToast(`📍 Location set to ${cityName}`, 'success');
    } else {
        buttonText.textContent = 'Download Prayer Calendar Now';
    }
}

// Simple client-side calendar generation - traffic-first approach
async function quickDownloadCalendar() {
    try {
        // Show loading state
        const button = document.getElementById('quickDownload') || event.target;
        const originalText = button.innerHTML;
        button.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg> Generating...';
        button.disabled = true;

        // Use selected location
        const { lat, lon, cityName } = selectedLocation;

        // Fetch prayer times for the current month (quick approach)
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        
        const response = await fetch(`https://api.aladhan.com/v1/calendar/${currentYear}/${currentMonth}?latitude=${lat}&longitude=${lon}&method=2`);
        
        // Improved error handling
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.code !== 200 || !data.data) {
            throw new Error('Invalid response from prayer times API');
        }

        // Generate timezone-corrected iCal content
        const icalContent = generateSimpleICal(data.data, cityName, lat, lon);
        
        // Download the file
        downloadICalFile(icalContent, `PrayerSync-${cityName.replace(/[^a-zA-Z0-9]/g, '')}-${currentYear}-${currentMonth}.ics`);
        
        // Show success message
        showToast(`✅ Prayer calendar downloaded for ${cityName}!`, 'success');
        
    } catch (error) {
        console.error('Calendar generation error:', error);
        let errorMessage = '❌ Failed to generate calendar. ';
        
        if (error.message.includes('API request failed')) {
            errorMessage += 'Server temporarily unavailable. Please try again later.';
        } else if (error.message.includes('Invalid response')) {
            errorMessage += 'Invalid location data. Please select a different city.';
        } else {
            errorMessage += 'Please check your internet connection and try again.';
        }
        
        showToast(errorMessage, 'error');
    } finally {
        // Reset button state
        const button = document.getElementById('quickDownload') || event.target;
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

function generateSimpleICal(monthData, cityName, lat, lon) {
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    
    let icalContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//PrayerSync//PrayerSync Calendar v1.0//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Prayer Times - ${cityName}
X-WR-CALDESC:Islamic prayer times for ${cityName}
X-WR-TIMEZONE:UTC
`;

    const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    
    monthData.forEach(dayData => {
        if (!dayData.timings || !dayData.date || !dayData.meta) return;
        
        const gregorianDate = dayData.date.gregorian.date; // DD-MM-YYYY format
        const timezone = dayData.meta.timezone || selectedLocation.timezone;
        
        prayers.forEach(prayer => {
            const prayerTime = dayData.timings[prayer];
            if (!prayerTime) return;
            
            // Parse time (format: "HH:MM")
            const timeMatch = prayerTime.match(/^(\d{1,2}):(\d{2})/);
            if (!timeMatch) return;
            
            const cleanTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
            
            try {
                // Use our new timezone-aware conversion
                const dtStart = getIcsUtcString(gregorianDate, cleanTime, timezone);
                const dtEnd = dtStart; // For prayer times, we use the same start and end
                
                // Create unique UID for each prayer event
                const dateStr = gregorianDate.replace(/-/g, '');
                const uid = `${prayer.toLowerCase()}-${dateStr}@prayersync.app`;
                
                // Generate current timestamp in UTC for DTSTAMP
                const now = new Date();
                const dtStamp = now.toISOString().replace(/[-:.]/g, '').substring(0, 15) + 'Z';
                
                icalContent += `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dtStamp}
DTSTART:${dtStart}
DTEND:${dtEnd}
SUMMARY:${prayer} Prayer
DESCRIPTION:Time for ${prayer} prayer. May Allah accept your worship.
LOCATION:${cityName}
CATEGORIES:Prayer,Islamic
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:${prayer} prayer in 15 minutes
END:VALARM
END:VEVENT
`;
            } catch (error) {
                console.error(`Failed to process ${prayer} time for ${gregorianDate}:`, error);
                // Continue with other prayers even if one fails
            }
        });
    });
    
    icalContent += 'END:VCALENDAR';
    return icalContent;
}

function downloadICalFile(content, filename) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showToast(message, type = 'info') {
    // Remove any existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#006A4E'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        transform: translateY(100px);
        opacity: 0;
        transition: all 0.3s ease;
        z-index: 10001;
        max-width: 400px;
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
    }, 100);
    
    // Animate out
    setTimeout(() => {
        toast.style.transform = 'translateY(100px)';
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }, 4000);
}

// Calendar Connection Functions
async function connectGoogleCalendar() {
    try {
        // Generate calendar data
        const { lat, lon, cityName } = selectedLocation;
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        
        showToast('🔄 Generating calendar for Google Calendar...', 'info');
        
        const response = await fetch(`https://api.aladhan.com/v1/calendar/${currentYear}/${currentMonth}?latitude=${lat}&longitude=${lon}&method=2`);
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.code !== 200 || !data.data) {
            throw new Error('Invalid response from prayer times API');
        }

        const icalContent = generateSimpleICal(data.data, cityName, lat, lon);
        
        // For Google Calendar, download and show instructions
        downloadICalFile(icalContent, `PrayerSync-${cityName.replace(/[^a-zA-Z0-9]/g, '')}-GoogleCalendar.ics`);
        
        // Show Google Calendar specific instructions
        showGoogleCalendarInstructions();
        
    } catch (error) {
        console.error('Google Calendar connection error:', error);
        showToast('❌ Failed to generate Google Calendar. Please try download instead.', 'error');
    }
}

async function connectOutlookCalendar() {
    try {
        const { lat, lon, cityName } = selectedLocation;
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        
        showToast('🔄 Generating calendar for Outlook...', 'info');
        
        const response = await fetch(`https://api.aladhan.com/v1/calendar/${currentYear}/${currentMonth}?latitude=${lat}&longitude=${lon}&method=2`);
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.code !== 200 || !data.data) {
            throw new Error('Invalid response from prayer times API');
        }

        const icalContent = generateSimpleICal(data.data, cityName, lat, lon);
        downloadICalFile(icalContent, `PrayerSync-${cityName.replace(/[^a-zA-Z0-9]/g, '')}-Outlook.ics`);
        
        showOutlookInstructions();
        
    } catch (error) {
        console.error('Outlook connection error:', error);
        showToast('❌ Failed to generate Outlook calendar. Please try download instead.', 'error');
    }
}

async function connectAppleCalendar() {
    try {
        const { lat, lon, cityName } = selectedLocation;
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        
        showToast('🔄 Generating calendar for Apple Calendar...', 'info');
        
        const response = await fetch(`https://api.aladhan.com/v1/calendar/${currentYear}/${currentMonth}?latitude=${lat}&longitude=${lon}&method=2`);
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.code !== 200 || !data.data) {
            throw new Error('Invalid response from prayer times API');
        }

        const icalContent = generateSimpleICal(data.data, cityName, lat, lon);
        downloadICalFile(icalContent, `PrayerSync-${cityName.replace(/[^a-zA-Z0-9]/g, '')}-Apple.ics`);
        
        showAppleCalendarInstructions();
        
    } catch (error) {
        console.error('Apple Calendar connection error:', error);
        showToast('❌ Failed to generate Apple calendar. Please try download instead.', 'error');
    }
}

// Calendar-specific instruction functions
function showGoogleCalendarInstructions() {
    const instructions = `
📱 Google Calendar Setup:

1. The calendar file has been downloaded
2. Go to calendar.google.com
3. Click the "+" next to "Other calendars"
4. Select "Import"
5. Click "Select file from your computer"
6. Choose the downloaded file
7. Select which calendar to add events to
8. Click "Import"

✅ Your prayer times will now appear in Google Calendar with 15-minute reminders!
    `;
    
    setTimeout(() => {
        if (confirm('📅 Google Calendar Instructions\n\n' + instructions + '\n\nClick OK to open Google Calendar now.')) {
            window.open('https://calendar.google.com/calendar/u/0/r', '_blank');
        }
    }, 1000);
}

function showOutlookInstructions() {
    const instructions = `
💼 Outlook Calendar Setup:

Desktop App:
1. Open Outlook
2. Go to File → Open & Export → Import/Export
3. Select "Import an iCalendar (.ics) or vCalendar file"
4. Browse and select the downloaded file
5. Click "OK"

Web Version:
1. Go to outlook.live.com
2. Click "Add calendar" in the sidebar
3. Select "Upload from file"
4. Choose the downloaded file
5. Click "Import"

✅ Your prayer times are now in Outlook!
    `;
    
    setTimeout(() => {
        if (confirm('💼 Outlook Instructions\n\n' + instructions + '\n\nClick OK to open Outlook Web now.')) {
            window.open('https://outlook.live.com/calendar/', '_blank');
        }
    }, 1000);
}

function showAppleCalendarInstructions() {
    const instructions = `
🍎 Apple Calendar Setup:

Mac:
1. Double-click the downloaded .ics file
2. Calendar app will open automatically
3. Choose which calendar to import to
4. Click "OK"

iPhone/iPad:
1. Email the file to yourself or save to Files app
2. Tap the .ics file
3. Select "Add to Calendar"
4. Choose which calendar to use
5. Tap "Add"

✅ Prayer times added to Apple Calendar with notifications!
    `;
    
    setTimeout(() => {
        alert('🍎 Apple Calendar Instructions\n\n' + instructions);
    }, 1000);
}

// Make functions globally available
window.quickDownloadCalendar = quickDownloadCalendar;
window.updateSelectedLocation = updateSelectedLocation;
window.connectGoogleCalendar = connectGoogleCalendar;
window.connectOutlookCalendar = connectOutlookCalendar;
window.connectAppleCalendar = connectAppleCalendar;