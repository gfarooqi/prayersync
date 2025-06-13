const { ical } = require('ical-generator');
const { getVtimezoneComponent } = require('@touch4it/ical-timezones');

module.exports = async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { lat, lon, method = '2', asr = '0' } = req.query;

    // Input validation
    if (!lat || !lon) {
      return res.status(400).json({ 
        error: 'Missing required parameters: latitude and longitude' 
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ 
        error: 'Invalid latitude or longitude values' 
      });
    }

    // Get current year for full year calendar
    const currentYear = new Date().getFullYear();
    
    // Fetch prayer times for the entire year from AlAdhan API
    console.log(`Fetching prayer times for ${latitude}, ${longitude} for year ${currentYear}`);
    
    const aladhanUrl = `http://api.aladhan.com/v1/calendar/${currentYear}?latitude=${latitude}&longitude=${longitude}&method=${method}&school=${asr}`;
    
    const response = await fetch(aladhanUrl);
    
    if (!response.ok) {
      throw new Error(`AlAdhan API error: ${response.status} ${response.statusText}`);
    }
    
    const apiData = await response.json();
    
    if (apiData.code !== 200 || !apiData.data || apiData.data.length === 0) {
      throw new Error('Invalid response from AlAdhan API');
    }

    // Extract timezone from the first day's metadata
    const timezone = apiData.data[0]?.[0]?.meta?.timezone || 'UTC';
    console.log(`Detected timezone: ${timezone}`);

    // Initialize calendar with proper timezone support
    const calendar = ical({
      name: 'PrayerSync - Prayer Times',
      description: `Islamic prayer times for ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
      timezone: {
        name: timezone,
        generator: getVtimezoneComponent
      }
    });

    // Prayer names mapping
    const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    let eventCount = 0;

    // Process each month's data
    apiData.data.forEach((monthData, monthIndex) => {
      if (!Array.isArray(monthData)) return;
      
      // Process each day in the month
      monthData.forEach((dayData) => {
        if (!dayData.timings || !dayData.date) return;
        
        const dateStr = dayData.date.gregorian.date; // Format: "DD-MM-YYYY"
        const [day, month, year] = dateStr.split('-');
        const baseDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        // Add events for each prayer
        prayerNames.forEach((prayerName) => {
          const prayerKey = prayerName.toLowerCase();
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
          calendar.createEvent({
            start: eventDate,
            end: endDate,
            summary: `${prayerName} Prayer`,
            description: `Time for ${prayerName} prayer. May Allah accept your worship.`,
            location: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            timezone: timezone,
            categories: ['Prayer', 'Islamic'],
            // Add reminder 15 minutes before
            alarms: [{
              trigger: '-PT15M',
              description: `${prayerName} prayer in 15 minutes`
            }]
          });
          
          eventCount++;
        });
      });
    });

    console.log(`Generated ${eventCount} prayer events for ${timezone}`);

    // Set proper headers for calendar download
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="PrayerSync-${currentYear}.ics"`);
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    
    // Return the calendar
    return res.status(200).send(calendar.toString());
    
  } catch (error) {
    console.error('Calendar generation error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate calendar',
      details: error.message 
    });
  }
}