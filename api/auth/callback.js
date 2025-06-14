/**
 * OAuth Callback Handler
 * 
 * Processes OAuth tokens after successful authentication and stores them securely.
 * This endpoint receives tokens from Grant.js and associates them with users.
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client (has elevated permissions)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // Add CORS headers
    const origin = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : (process.env.APP_URL || 'http://localhost:3000');
      
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    // Only allow GET requests (OAuth callbacks are GET)
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    
    console.log('OAuth Callback received:', {
      query: req.query,
      session: req.session ? 'present' : 'missing'
    });
    
    // Check if Grant.js session contains OAuth response
    if (!req.session?.grant?.response) {
      console.error('No OAuth response in session');
      return res.redirect(`${origin}/?error=no_oauth_response`);
    }
    
    const { response } = req.session.grant;
    const { 
      access_token, 
      refresh_token, 
      provider,
      id_token,
      expires_in 
    } = response;
    
    if (!access_token || !provider) {
      console.error('Invalid OAuth response:', { access_token: !!access_token, provider });
      return res.redirect(`${origin}/?error=invalid_oauth_response`);
    }
    
    // Calculate token expiration
    const expiresAt = expires_in 
      ? new Date(Date.now() + (expires_in * 1000))
      : new Date(Date.now() + (3600 * 1000)); // Default 1 hour
    
    // For now, we'll create a simple session without user authentication
    // In a full implementation, you'd get the user ID from a JWT or session
    // For demo purposes, we'll use a combination of IP and timestamp as user identifier
    const userIdentifier = `${req.connection?.remoteAddress || 'unknown'}_${Date.now()}`;
    
    try {
      // Store the OAuth tokens in Supabase
      // First, check if we have a user_connections table
      const { data: existingConnection, error: selectError } = await supabaseAdmin
        .from('user_connections')
        .select('*')
        .eq('user_identifier', userIdentifier)
        .eq('provider', provider)
        .single();
      
      // Prepare connection data
      const connectionData = {
        user_identifier: userIdentifier,
        provider: provider,
        access_token: access_token,
        refresh_token: refresh_token,
        id_token: id_token,
        expires_at: expiresAt.toISOString(),
        connected_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
        is_active: true
      };
      
      let result;
      if (existingConnection && !selectError) {
        // Update existing connection
        result = await supabaseAdmin
          .from('user_connections')
          .update(connectionData)
          .eq('id', existingConnection.id);
      } else {
        // Create new connection
        result = await supabaseAdmin
          .from('user_connections')
          .insert([connectionData]);
      }
      
      if (result.error) {
        console.error('Supabase error:', result.error);
        // Continue anyway - don't block the OAuth flow
      } else {
        console.log('Successfully stored OAuth tokens for provider:', provider);
      }
      
    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      // Continue anyway - don't block the OAuth flow for database issues
    }
    
    // Set a secure cookie to remember the connection
    const cookieOptions = [
      `prayersync_${provider}=connected`,
      `Path=/`,
      `Max-Age=${24 * 60 * 60}`, // 24 hours
      process.env.NODE_ENV === 'production' ? 'Secure' : '',
      'HttpOnly',
      'SameSite=Lax'
    ].filter(Boolean).join('; ');
    
    res.setHeader('Set-Cookie', cookieOptions);
    
    // Clear the Grant session to prevent token leakage
    if (req.session) {
      req.session.grant = null;
    }
    
    // Redirect back to the app with success message
    const successUrl = `${origin}/?connected=${provider}&success=true`;
    console.log('Redirecting to:', successUrl);
    
    res.redirect(302, successUrl);
    
  } catch (error) {
    console.error('OAuth Callback Error:', error);
    
    const origin = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : (process.env.APP_URL || 'http://localhost:3000');
      
    const errorUrl = `${origin}/?error=callback_failed&message=${encodeURIComponent(error.message)}`;
    res.redirect(302, errorUrl);
  }
}