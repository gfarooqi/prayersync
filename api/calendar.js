module.exports = async function handler(req, res) {
  try {
    const { lat, lon, method = '2', asr = '0' } = req.query;

    // Input validation
    if (!lat || !lon) {
      return res.status(400).json({ 
        error: 'Missing required parameters: latitude and longitude' 
      });
    }

    // For now, return a simple working response to test the API
    const basicIcal = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//PrayerSync//Prayer Times//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Prayer Times - PrayerSync
X-WR-CALDESC:Islamic prayer times calendar
BEGIN:VEVENT
UID:test-prayer-${Date.now()}@prayersync.com
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTEND:${new Date(Date.now() + 30*60*1000).toISOString().replace(/[-:]/g, '').split('.')[0]}Z
SUMMARY:Test Prayer
DESCRIPTION:Test prayer event for API validation
END:VEVENT
END:VCALENDAR`;

    // Set proper headers for calendar download
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="PrayerSync-Test.ics"');
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    
    return res.status(200).send(basicIcal);
    
  } catch (error) {
    console.error('Calendar generation error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate calendar',
      details: error.message 
    });
  }
};