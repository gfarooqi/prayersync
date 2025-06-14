/**
 * OAuth Handler using Grant.js
 * 
 * Handles OAuth flows for Google Calendar and Microsoft Graph APIs.
 * This dynamic route handles all OAuth-related endpoints:
 * - /api/auth/google - Initiate Google OAuth
 * - /api/auth/microsoft - Initiate Microsoft OAuth
 * - /api/auth/google/callback - Google OAuth callback
 * - /api/auth/microsoft/callback - Microsoft OAuth callback
 */

import grant from 'grant';

// Grant.js configuration
const grantConfig = {
  defaults: {
    origin: process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : (process.env.APP_URL || 'http://localhost:3000'),
    transport: 'session',
    state: true, // Enable CSRF protection
    prefix: '/api/auth'
  },
  
  google: {
    key: process.env.GOOGLE_CLIENT_ID,
    secret: process.env.GOOGLE_CLIENT_SECRET,
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly'
    ],
    callback: '/api/auth/callback',
    custom_params: {
      access_type: 'offline', // Request refresh token
      prompt: 'consent'       // Force consent screen for refresh token
    }
  },
  
  microsoft: {
    key: process.env.MICROSOFT_CLIENT_ID,
    secret: process.env.MICROSOFT_CLIENT_SECRET,
    scope: ['Calendars.ReadWrite', 'offline_access'],
    callback: '/api/auth/callback',
    oauth: 2,
    authorize_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    access_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
  }
};

// Session configuration for Grant
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};

// Initialize Grant with session middleware
const grantHandler = grant.vercel({
  config: grantConfig,
  session: sessionConfig
});

export default async function handler(req, res) {
  try {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', grantConfig.defaults.origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    // Check if OAuth is configured (graceful degradation)
    const hasGoogleOAuth = process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID.includes('placeholder');
    const hasMicrosoftOAuth = process.env.MICROSOFT_CLIENT_ID && !process.env.MICROSOFT_CLIENT_ID.includes('placeholder');
    
    if (!hasGoogleOAuth && !hasMicrosoftOAuth) {
      console.log('OAuth not configured - showing coming soon message');
      const origin = grantConfig.defaults.origin;
      return res.redirect(`${origin}/?message=calendar_coming_soon`);
    }
    
    // Log OAuth attempt for debugging
    console.log('OAuth request:', {
      method: req.method,
      url: req.url,
      query: req.query,
      provider: req.query.grant?.[0] // First segment is provider
    });
    
    // Pass request to Grant handler
    return await grantHandler(req, res);
    
  } catch (error) {
    console.error('OAuth Handler Error:', error);
    
    // Redirect to error page instead of showing JSON error
    const errorUrl = `${grantConfig.defaults.origin}/?error=oauth_failed&message=${encodeURIComponent(error.message)}`;
    res.redirect(302, errorUrl);
  }
}