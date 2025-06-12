# Salat Planner - 5 Daily Prayers App

A web-based prayer time calculator and planner that helps busy Muslim professionals manage their 5 daily prayers with calendar integration.

## Features

- **Accurate Prayer Times**: Calculates prayer times based on your location using various calculation methods
- **Prayer Tracking**: Mark prayers as completed and track daily progress
- **Calendar Integration**: 
  - Export prayer times to any calendar app (Google Calendar, Outlook, Apple Calendar)
  - Download .ics files for today, this week, or this month
  - Calendar subscription URL for automatic updates
- **Notifications**: Browser notifications to remind you before each prayer
- **Offline Support**: Works offline once loaded (Progressive Web App)
- **Mobile Friendly**: Responsive design that works on all devices

## How to Use

1. **Open the App**: Simply open `index.html` in your web browser
2. **Allow Location**: Grant location access for accurate prayer times in your area
3. **Enable Notifications**: Click "Enable Notifications" to get prayer reminders
4. **Calendar Integration**:
   - Click "Calendar Integration" button
   - Choose to export today's, this week's, or this month's prayer times
   - The .ics file will download and can be imported into any calendar app
   - For automatic updates, copy the subscription URL and add it to your calendar

## Calendar Setup Instructions

### Google Calendar
1. Export prayer times using the "Export This Month" button
2. Go to Google Calendar
3. Click the gear icon → Settings
4. Select "Import & Export" from the left menu
5. Click "Select file from your computer" and choose the downloaded .ics file
6. Select which calendar to add the events to
7. Click "Import"

### Apple Calendar
1. Export prayer times or copy the subscription URL
2. Open Calendar app
3. File → Import (for .ics file) or File → New Calendar Subscription (for URL)
4. Follow the prompts to add prayer times

### Microsoft Outlook
1. Export prayer times using any export button
2. Open Outlook
3. File → Open & Export → Import/Export
4. Choose "Import an iCalendar (.ics) file"
5. Select the downloaded file

## Calculation Methods

The app supports multiple prayer calculation methods:
- Muslim World League
- Islamic Society of North America (ISNA)
- Egyptian General Authority
- Umm al-Qura, Makkah
- University of Islamic Sciences, Karachi

## Technical Details

- Pure JavaScript (no framework dependencies)
- Uses browser's Geolocation API
- Local storage for settings and prayer tracking
- Service Worker for offline functionality
- iCal format for universal calendar compatibility

## Privacy

- All calculations are done locally in your browser
- Location data is only used for prayer calculations
- No data is sent to any server
- Settings and prayer tracking data stored locally

## Future Enhancements

To fully integrate with Google Calendar automatically:
1. Set up a Google Cloud Project
2. Enable Google Calendar API
3. Create OAuth 2.0 credentials
4. Replace `YOUR_GOOGLE_CLIENT_ID` in script.js with your actual client ID
5. Add authorized JavaScript origins and redirect URIs

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (notifications may require additional permissions)
- Mobile browsers: Full support with PWA installation option