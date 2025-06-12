# PrayerSync Deployment Guide

## Overview
PrayerSync is a modern web application that helps Muslims integrate their 5 daily prayers into their work calendars with one-click synchronization.

## Architecture

### Frontend
- Pure HTML/CSS/JavaScript (no framework dependencies)
- Progressive Web App (PWA) capabilities
- Responsive design for all devices

### Backend Requirements
- Node.js server for OAuth handling
- Express.js for API routes
- Session management for token storage
- HTTPS required for production

## Deployment Steps

### 1. Prerequisites
- Domain name with SSL certificate
- Node.js hosting (Vercel, Heroku, AWS, etc.)
- Google Cloud Console account
- Microsoft Azure account

### 2. Google Calendar Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable Google Calendar API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `https://yourdomain.com/auth/google/callback`
5. Save Client ID and Client Secret

### 3. Microsoft Outlook Setup

1. Go to [Azure Portal](https://portal.azure.com)
2. Register a new application
3. Add Calendar permissions:
   - `Calendars.ReadWrite`
   - `offline_access`
4. Add redirect URI: `https://yourdomain.com/auth/microsoft/callback`
5. Create client secret and save it

### 4. Environment Configuration

Create `.env` file:
```env
# Server
PORT=3000
SESSION_SECRET=your_random_session_secret

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google/callback

# Microsoft OAuth
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
MICROSOFT_REDIRECT_URI=https://yourdomain.com/auth/microsoft/callback

# Database (optional, for user preferences)
DATABASE_URL=your_database_url
```

### 5. Frontend Updates

Update `app-new.js`:
```javascript
// Replace with your actual API endpoints
const API_BASE_URL = 'https://yourdomain.com/api';

// Update Google client initialization
gapi.client.init({
    apiKey: 'YOUR_API_KEY',
    clientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
    scope: 'https://www.googleapis.com/auth/calendar.events'
});
```

### 6. Server Setup

Install dependencies:
```bash
npm init -y
npm install express googleapis @microsoft/microsoft-graph-client
npm install express-session cookie-parser cors helmet
npm install dotenv
```

Create `server.js`:
```javascript
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();

// Security
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));

// Session
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true, // HTTPS only
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Import routes from backend-api.js
const apiRoutes = require('./backend-api');
app.use(apiRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
```

### 7. Deployment Options

#### Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in project directory
3. Set environment variables in Vercel dashboard

#### Heroku
1. Install Heroku CLI
2. Create `Procfile`: `web: node server.js`
3. Deploy:
   ```bash
   heroku create your-app-name
   heroku config:set GOOGLE_CLIENT_ID=...
   git push heroku main
   ```

#### AWS/DigitalOcean
1. Set up EC2/Droplet instance
2. Install Node.js, nginx
3. Configure nginx as reverse proxy
4. Use PM2 for process management
5. Set up SSL with Let's Encrypt

### 8. Post-Deployment

1. Test OAuth flows for both providers
2. Verify prayer time calculations
3. Test calendar synchronization
4. Monitor error logs
5. Set up analytics (optional)

## Security Considerations

1. **HTTPS Only**: OAuth requires secure connections
2. **Token Storage**: Never store tokens in frontend
3. **Rate Limiting**: Implement API rate limiting
4. **CORS**: Configure proper CORS policies
5. **Input Validation**: Validate all user inputs
6. **CSP Headers**: Set Content Security Policy

## Monitoring

1. Set up error tracking (Sentry, LogRocket)
2. Monitor API usage and quotas
3. Track user engagement metrics
4. Set up uptime monitoring

## Scaling Considerations

1. **Caching**: Cache prayer calculations
2. **CDN**: Use CDN for static assets
3. **Database**: Add database for user preferences
4. **Queue**: Use job queue for calendar sync
5. **Load Balancing**: For high traffic

## Support

- Create comprehensive FAQ page
- Add in-app help tooltips
- Provide email support option
- Consider chat support for premium users