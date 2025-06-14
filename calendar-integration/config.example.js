// Configuration template for PrayerSync Calendar Integration
// Copy this file to config.js and fill in your actual credentials
// IMPORTANT: Add config.js to .gitignore to prevent committing credentials

export const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com';

// Future configuration for Microsoft Graph
export const MICROSOFT_CLIENT_ID = 'YOUR_MICROSOFT_CLIENT_ID_HERE';

// API configuration
export const API_CONFIG = {
    // Scopes for Google Calendar access
    GOOGLE_SCOPES: [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' '),
    
    // Scopes for Microsoft Graph access  
    MICROSOFT_SCOPES: [
        'https://graph.microsoft.com/calendars.readwrite',
        'https://graph.microsoft.com/user.read'
    ],
    
    // General settings
    TOKEN_STORAGE_KEY: 'prayersync_tokens',
    SESSION_TIMEOUT: 3600000 // 1 hour in milliseconds
};