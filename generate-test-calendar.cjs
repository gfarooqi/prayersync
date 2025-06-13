const { ICalCalendar } = require('ical-generator');
const { getVtimezoneComponent } = require('@touch4it/ical-timezones');
const fs = require('fs');

async function generateCalendar() {
  try {
    // Test coordinates - New York (has DST changes)
    const lat = 40.7128;
    const lon = -74.0060;
    const year = new Date().getFullYear();
    
    console.log(`Generating calendar for New York (${lat}, ${lon}) for year ${year}...`);
    
    // Fetch prayer times from AlAdhan API
    console.log('Fetching prayer times from AlAdhan API...');
    const response = await fetch(`http://api.aladhan.com/v1/calendar/${year}?latitude=${lat}&longitude=${lon}&method=2`);
    
    if (!response.ok) {
      throw new Error(`AlAdhan API error: ${response.status} ${response.statusText}`);
    }
    
    const apiData = await response.json();
    
    if (apiData.code !== 200 || !apiData.data || apiData.data.length === 0) {
      throw new Error('Invalid response from AlAdhan API');
    }
    
    console.log(`Received data for ${apiData.data.length} months`);
    
    // Extract timezone from first day's metadata
    const timezone = apiData.data[0][0].meta.timezone;
    console.log(`Detected timezone: ${timezone}`);
    
    // Initialize calendar with timezone support
    const cal = new ICalCalendar();
    cal.timezone({
      name: timezone,
      generator: getVtimezoneComponent
    });
    cal.name('PrayerSync - Prayer Times');
    cal.description(`Islamic prayer times for New York, NY (${lat}, ${lon})`);
    
    // Prayer names
    const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    let eventCount = 0;
    
    // Process each month's data
    apiData.data.forEach((monthData, monthIndex) => {
      if (!Array.isArray(monthData)) return;
      
      console.log(`Processing month ${monthIndex + 1}...`);
      
      // Process each day in the month
      monthData.forEach((dayData) => {
        if (!dayData.timings || !dayData.date) return;
        
        const dateStr = dayData.date.gregorian.date; // Format: "DD-MM-YYYY"
        const [day, month, year] = dateStr.split('-');
        const baseDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        // Add events for each prayer
        prayerNames.forEach((prayerName) => {
          const prayerTime = dayData.timings[prayerName];
          
          if (!prayerTime) return;
          
          // Parse time (format: "HH:MM (TIMEZONE)")
          const timeMatch = prayerTime.match(/^(\d{1,2}):(\d{2})/);
          if (!timeMatch) return;
          
          const hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          
          // Create event date
          const eventDate = new Date(baseDate);
          eventDate.setHours(hours, minutes, 0, 0);
          
          // Add 30-minute event duration
          const endDate = new Date(eventDate);
          endDate.setMinutes(endDate.getMinutes() + 30);
          
          // Create calendar event
          cal.createEvent({
            start: eventDate,
            end: endDate,
            summary: `${prayerName} Prayer`,
            description: `Time for ${prayerName} prayer. May Allah accept your worship.`,
            location: `New York, NY (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
            timezone: timezone,
            categories: ['Prayer', 'Islamic'],
            // Add reminder 15 minutes before
            alarms: [{
              type: 'display',
              trigger: '-PT15M',
              description: `${prayerName} prayer in 15 minutes`
            }]
          });
          
          eventCount++;
        });
      });
    });
    
    console.log(`Generated ${eventCount} prayer events`);
    
    // Save to file for testing
    const filename = `PrayerSync-NewYork-${year}.ics`;
    fs.writeFileSync(filename, cal.toString());
    console.log(`✅ Successfully generated ${filename}`);
    console.log(`📋 File size: ${(fs.statSync(filename).size / 1024).toFixed(1)} KB`);
    
    // Also save a sample for today only for quick testing
    const todayEvents = [];
    const today = new Date();
    const todayStr = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;
    
    // Find today's data
    for (const monthData of apiData.data) {
      if (!Array.isArray(monthData)) continue;
      const todayData = monthData.find(dayData => dayData.date.gregorian.date === todayStr);
      if (todayData) {
        console.log(`\n📅 Today's Prayer Times (${todayStr}):`);
        prayerNames.forEach(prayer => {
          const time = todayData.timings[prayer];
          if (time) {
            console.log(`  ${prayer}: ${time}`);
          }
        });
        break;
      }
    }
    
    console.log(`\n🎯 Next steps:`);
    console.log(`1. Test ${filename} in Google Calendar, Apple Calendar, and Outlook`);
    console.log(`2. Verify DST transitions in March and November events`);
    console.log(`3. Check timezone display in calendar apps`);
    
  } catch (error) {
    console.error('❌ Calendar generation failed:', error);
    process.exit(1);
  }
}

// For Node.js versions without built-in fetch
if (typeof fetch === 'undefined') {
  console.log('Installing node-fetch for this Node version...');
  global.fetch = require('node-fetch');
}

generateCalendar();