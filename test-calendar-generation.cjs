// Test script to debug calendar generation locally
const fs = require('fs');

// Mock data similar to what Al-Adhan API returns
const mockApiResponse = {
    code: 200,
    data: [
        {
            timings: {
                Fajr: "05:42",
                Dhuhr: "12:05", 
                Asr: "14:23",
                Maghrib: "16:41",
                Isha: "18:15"
            },
            date: {
                gregorian: {
                    date: "13-06-2025"
                }
            },
            meta: {
                timezone: "Europe/London"
            }
        }
    ]
};

// Copy the timezone functions from our implementation
function getUtcOffsetInMinutes(dateString, timezone) {
    const refUtcDate = new Date(`${dateString}T12:00:00Z`);

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
    });

    const parts = formatter.formatToParts(refUtcDate);
    const findPart = (type) => parseInt(parts.find(p => p.type === type)?.value || '0');

    const localTimeAsUtc = Date.UTC(
        findPart('year'),
        findPart('month') - 1,
        findPart('day'),
        findPart('hour'),
        findPart('minute'),
        findPart('second')
    );

    const offsetInMs = refUtcDate.getTime() - localTimeAsUtc;
    return offsetInMs / (1000 * 60);
}

function getIcsUtcString(apiDate, prayerTime, timezone) {
    const [day, month, year] = apiDate.split('-');
    const isoDate = `${year}-${month}-${day}`;

    const offsetInMinutes = getUtcOffsetInMinutes(isoDate, timezone);
    console.log(`Offset for ${isoDate} in ${timezone}: ${offsetInMinutes} minutes`);

    const [hours, minutes] = prayerTime.split(':').map(Number);
    const localTimeAsUtcMs = Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), hours, minutes);

    const correctUtcMs = localTimeAsUtcMs - (offsetInMinutes * 60 * 1000);
    const correctUtcDate = new Date(correctUtcMs);

    const utcString = correctUtcDate.toISOString().replace(/[-:.]/g, '').substring(0, 15) + 'Z';
    console.log(`${prayerTime} ${timezone} -> ${utcString} (${correctUtcDate.toISOString()})`);
    
    return utcString;
}

function generateTestCalendar() {
    console.log('Testing calendar generation for London...\n');
    
    const dayData = mockApiResponse.data[0];
    const gregorianDate = dayData.date.gregorian.date;
    const timezone = dayData.meta.timezone;
    const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    
    console.log(`Date: ${gregorianDate}`);
    console.log(`Timezone: ${timezone}\n`);
    
    let icalContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//PrayerSync//PrayerSync Calendar v1.0//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Prayer Times - London, UK
X-WR-CALDESC:Islamic prayer times for London, UK
X-WR-TIMEZONE:UTC
`;

    prayers.forEach(prayer => {
        const prayerTime = dayData.timings[prayer];
        if (!prayerTime) return;

        const timeMatch = prayerTime.match(/^(\d{1,2}):(\d{2})/);
        if (!timeMatch) return;

        const cleanTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
        
        try {
            const dtStart = getIcsUtcString(gregorianDate, cleanTime, timezone);
            const dtEnd = dtStart;
            
            const dateStr = gregorianDate.replace(/-/g, '');
            const uid = `${prayer.toLowerCase()}-${dateStr}@prayersync.app`;
            
            const now = new Date();
            const dtStamp = now.toISOString().replace(/[-:.]/g, '').substring(0, 15) + 'Z';
            
            icalContent += `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dtStamp}
DTSTART:${dtStart}
DTEND:${dtEnd}
SUMMARY:${prayer} Prayer
DESCRIPTION:Time for ${prayer} prayer. May Allah accept your worship.
LOCATION:London, UK
CATEGORIES:Prayer,Islamic
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:${prayer} prayer in 15 minutes
END:VALARM
END:VEVENT
`;
        } catch (error) {
            console.error(`Failed to process ${prayer}:`, error);
        }
    });
    
    icalContent += 'END:VCALENDAR';
    
    // Save the generated calendar
    fs.writeFileSync('./test-london-calendar.ics', icalContent);
    console.log('\n✅ Calendar saved to test-london-calendar.ics');
    console.log('\nFirst few lines of generated calendar:');
    console.log(icalContent.split('\n').slice(0, 15).join('\n'));
}

generateTestCalendar();