/**
 * Configuration API Endpoint
 * 
 * Provides public environment variables to the frontend safely.
 * Only exposes variables that are safe for client-side use.
 */

export default function handler(req, res) {
  // Set CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  
  try {
    // Only expose PUBLIC environment variables
    // NEVER expose secrets like CLIENT_SECRET or SERVICE_ROLE_KEY
    const config = {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      appUrl: process.env.APP_URL || 'https://prayersync.vercel.app',
      appName: process.env.APP_NAME || 'PrayerSync',
      environment: process.env.NODE_ENV || 'production',
      // Analytics IDs are safe to expose
      googleAnalyticsId: process.env.GOOGLE_ANALYTICS_ID,
      vercelAnalyticsId: process.env.VERCEL_ANALYTICS_ID,
      // Note: OAuth Client IDs are not needed here since we handle auth server-side
    };
    
    // Remove undefined values
    Object.keys(config).forEach(key => {
      if (config[key] === undefined) {
        delete config[key];
      }
    });
    
    res.status(200).json(config);
    
  } catch (error) {
    console.error('Config API Error:', error);
    res.status(500).json({ 
      error: 'Failed to load configuration',
      message: 'Please try again later'
    });
  }
}