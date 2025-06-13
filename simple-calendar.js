// Global variables for selected location
let selectedLocation = {
    lat: 40.7128, // Default to New York
    lon: -74.0060,
    cityName: "New York, NY",
    timezone: "America/New_York"
};

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
        
        if (!response.ok) {
            throw new Error('Failed to fetch prayer times');
        }
        
        const data = await response.json();
        
        if (data.code !== 200 || !data.data) {
            throw new Error('Invalid response from prayer times API');
        }

        // Generate simple iCal content
        const icalContent = generateSimpleICal(data.data, cityName, lat, lon);
        
        // Download the file
        downloadICalFile(icalContent, `PrayerSync-${cityName.replace(/[^a-zA-Z0-9]/g, '')}-${currentYear}-${currentMonth}.ics`);
        
        // Show success message
        showToast(`✅ Prayer calendar downloaded for ${cityName}!`, 'success');
        
    } catch (error) {
        console.error('Calendar generation error:', error);
        showToast('❌ Failed to generate calendar. Please try again.', 'error');
    } finally {
        // Reset button
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
PRODID:-//PrayerSync//Prayer Times Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Prayer Times - ${cityName}
X-WR-CALDESC:Islamic prayer times for ${cityName}
X-WR-TIMEZONE:${Intl.DateTimeFormat().resolvedOptions().timeZone}
`;

    const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    
    monthData.forEach(dayData => {
        if (!dayData.timings || !dayData.date) return;
        
        const [day, month, year] = dayData.date.gregorian.date.split('-');
        const baseDate = new Date(year, month - 1, day);
        
        prayers.forEach(prayer => {
            const prayerTime = dayData.timings[prayer];
            if (!prayerTime) return;
            
            // Parse time (format: "HH:MM")
            const timeMatch = prayerTime.match(/^(\d{1,2}):(\d{2})/);
            if (!timeMatch) return;
            
            const hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            
            const startDate = new Date(baseDate);
            startDate.setHours(hours, minutes, 0, 0);
            
            const endDate = new Date(startDate);
            endDate.setMinutes(endDate.getMinutes() + 30);
            
            // Format dates for iCal (YYYYMMDDTHHMMSS)
            const formatDate = (date) => {
                return date.getFullYear() +
                       (date.getMonth() + 1).toString().padStart(2, '0') +
                       date.getDate().toString().padStart(2, '0') + 'T' +
                       date.getHours().toString().padStart(2, '0') +
                       date.getMinutes().toString().padStart(2, '0') +
                       date.getSeconds().toString().padStart(2, '0');
            };
            
            icalContent += `BEGIN:VEVENT
UID:prayersync-${prayer.toLowerCase()}-${formatDate(startDate)}@prayersync.com
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
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
        const data = await response.json();
        
        if (data.code !== 200 || !data.data) {
            throw new Error('Failed to fetch prayer times');
        }

        const icalContent = generateSimpleICal(data.data, cityName, lat, lon);
        
        // Create a webcal:// URL for direct Google Calendar import
        const blob = new Blob([icalContent], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        
        // For Google Calendar, we'll download and show instructions
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
        const data = await response.json();
        
        if (data.code !== 200 || !data.data) {
            throw new Error('Failed to fetch prayer times');
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
        const data = await response.json();
        
        if (data.code !== 200 || !data.data) {
            throw new Error('Failed to fetch prayer times');
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