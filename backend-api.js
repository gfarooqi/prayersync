// Backend API Structure for OAuth Integration
// This file demonstrates how to implement the server-side OAuth flow

const express = require('express');
const { google } = require('googleapis');
const { Client } = require('@microsoft/microsoft-graph-client');
require('dotenv').config();

const app = express();

// Google Calendar OAuth Configuration
const googleOAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// Microsoft Graph Configuration
const msalConfig = {
    auth: {
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        redirectUri: process.env.MICROSOFT_REDIRECT_URI
    }
};

// Google Calendar Routes
app.get('/auth/google', (req, res) => {
    const authUrl = googleOAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/calendar.events']
    });
    res.redirect(authUrl);
});

app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    
    try {
        const { tokens } = await googleOAuth2Client.getToken(code);
        googleOAuth2Client.setCredentials(tokens);
        
        // Store tokens securely (in production, use proper session management)
        req.session.googleTokens = tokens;
        
        res.redirect('/sync-success?provider=google');
    } catch (error) {
        res.redirect('/sync-error?provider=google');
    }
});

app.post('/api/sync/google', async (req, res) => {
    try {
        const { prayers, location, settings } = req.body;
        const tokens = req.session.googleTokens;
        
        if (!tokens) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        googleOAuth2Client.setCredentials(tokens);
        const calendar = google.calendar({ version: 'v3', auth: googleOAuth2Client });
        
        // Create recurring events for each prayer
        const events = [];
        for (const prayer of prayers) {
            const event = {
                summary: `${prayer.name} Prayer`,
                description: `Daily ${prayer.name} prayer time`,
                location: `${location.city}, ${location.country}`,
                start: {
                    dateTime: prayer.startTime,
                    timeZone: location.timezone
                },
                end: {
                    dateTime: prayer.endTime,
                    timeZone: location.timezone
                },
                recurrence: ['RRULE:FREQ=DAILY'],
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'popup', minutes: settings.reminderTime }
                    ]
                },
                colorId: '9' // Blue color for prayer events
            };
            
            const response = await calendar.events.insert({
                calendarId: 'primary',
                resource: event
            });
            
            events.push(response.data);
        }
        
        res.json({ success: true, events });
        
    } catch (error) {
        console.error('Google sync error:', error);
        res.status(500).json({ error: 'Failed to sync with Google Calendar' });
    }
});

// Microsoft Outlook Routes
app.get('/auth/microsoft', (req, res) => {
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
        `client_id=${process.env.MICROSOFT_CLIENT_ID}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(process.env.MICROSOFT_REDIRECT_URI)}` +
        `&scope=${encodeURIComponent('calendars.readwrite offline_access')}`;
    
    res.redirect(authUrl);
});

app.get('/auth/microsoft/callback', async (req, res) => {
    const { code } = req.query;
    
    try {
        // Exchange code for tokens
        const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.MICROSOFT_CLIENT_ID,
                client_secret: process.env.MICROSOFT_CLIENT_SECRET,
                code: code,
                redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
                grant_type: 'authorization_code'
            })
        });
        
        const tokens = await tokenResponse.json();
        req.session.microsoftTokens = tokens;
        
        res.redirect('/sync-success?provider=microsoft');
    } catch (error) {
        res.redirect('/sync-error?provider=microsoft');
    }
});

app.post('/api/sync/microsoft', async (req, res) => {
    try {
        const { prayers, location, settings } = req.body;
        const tokens = req.session.microsoftTokens;
        
        if (!tokens) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const client = Client.init({
            authProvider: (done) => {
                done(null, tokens.access_token);
            }
        });
        
        // Create recurring events for each prayer
        const events = [];
        for (const prayer of prayers) {
            const event = {
                subject: `${prayer.name} Prayer`,
                body: {
                    contentType: 'HTML',
                    content: `<p>Daily ${prayer.name} prayer time</p>`
                },
                start: {
                    dateTime: prayer.startTime,
                    timeZone: location.timezone
                },
                end: {
                    dateTime: prayer.endTime,
                    timeZone: location.timezone
                },
                location: {
                    displayName: `${location.city}, ${location.country}`
                },
                recurrence: {
                    pattern: {
                        type: 'daily',
                        interval: 1
                    },
                    range: {
                        type: 'noEnd',
                        startDate: new Date().toISOString().split('T')[0]
                    }
                },
                isReminderOn: true,
                reminderMinutesBeforeStart: settings.reminderTime,
                categories: ['Prayer Time']
            };
            
            const response = await client
                .api('/me/events')
                .post(event);
            
            events.push(response);
        }
        
        res.json({ success: true, events });
        
    } catch (error) {
        console.error('Microsoft sync error:', error);
        res.status(500).json({ error: 'Failed to sync with Outlook' });
    }
});

// Prayer Time Calculation API
app.post('/api/prayer-times', (req, res) => {
    const { latitude, longitude, date, method } = req.body;
    
    // Use your prayer time calculation logic here
    const prayerTimes = calculatePrayerTimes(latitude, longitude, date, method);
    
    res.json(prayerTimes);
});

// Webhook for calendar updates
app.post('/api/webhook/calendar-update', async (req, res) => {
    // Handle calendar updates/changes
    // Update prayer times if location changes
    // Send notifications if needed
    
    res.json({ received: true });
});

// Environment variables needed:
/*
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://yourapp.com/auth/google/callback

MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
MICROSOFT_REDIRECT_URI=https://yourapp.com/auth/microsoft/callback

SESSION_SECRET=your_session_secret
*/

module.exports = app;