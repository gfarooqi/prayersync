// Simple client-side calendar generation - traffic-first approach
async function quickDownloadCalendar() {
    try {
        // Show loading state
        const button = document.getElementById('quickDownload') || event.target;
        const originalText = button.innerHTML;
        button.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg> Generating...';
        button.disabled = true;

        // Get current location (simplified for quick deployment)
        let lat = 40.7128; // Default to New York
        let lon = -74.0060;
        let cityName = "New York, NY";

        // Try to get actual location if available
        if (window.app && window.app.location) {
            lat = window.app.location.latitude;
            lon = window.app.location.longitude;
            cityName = window.app.location.name || "Your Location";
        }

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

// Make function globally available
window.quickDownloadCalendar = quickDownloadCalendar;