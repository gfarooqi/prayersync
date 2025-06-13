// Supabase client configuration for PrayerSync
// This handles all database operations and user management

// Configuration - these will be loaded from window variables
const supabaseUrl = window.SUPABASE_URL || 'https://pvpwfothhggjxbdcvwzu.supabase.co';
const supabaseAnonKey = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cHdmb3RoaGdnanhiZGN2d3p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MDE3MDEsImV4cCI6MjA2NTM3NzcwMX0.uuDgD-bsNWlMXkZDQDLy_IUXxQi45dW7O_zYZRMQMl0';

// Simple Supabase client using fetch API (no external dependencies)
class SimpleSupabaseClient {
    constructor(url, key) {
        this.url = url;
        this.key = key;
        this.headers = {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };
    }

    // Simple insert operation
    async insert(table, data) {
        try {
            const response = await fetch(`${this.url}/rest/v1/${table}`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `Insert failed: ${response.status}`);
            }

            return { data: await response.json(), error: null };
        } catch (error) {
            console.error('Supabase insert error:', error);
            return { data: null, error };
        }
    }

    // Simple select operation
    async select(table, filters = {}) {
        try {
            let url = `${this.url}/rest/v1/${table}`;
            const params = new URLSearchParams();
            
            Object.entries(filters).forEach(([key, value]) => {
                params.append(key, `eq.${value}`);
            });

            if (params.toString()) {
                url += `?${params.toString()}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: this.headers
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `Select failed: ${response.status}`);
            }

            return { data: await response.json(), error: null };
        } catch (error) {
            console.error('Supabase select error:', error);
            return { data: null, error };
        }
    }

    // Simple update operation  
    async update(table, data, filters = {}) {
        try {
            let url = `${this.url}/rest/v1/${table}`;
            const params = new URLSearchParams();
            
            Object.entries(filters).forEach(([key, value]) => {
                params.append(key, `eq.${value}`);
            });

            if (params.toString()) {
                url += `?${params.toString()}`;
            }

            const response = await fetch(url, {
                method: 'PATCH',
                headers: this.headers,
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `Update failed: ${response.status}`);
            }

            return { data: await response.json(), error: null };
        } catch (error) {
            console.error('Supabase update error:', error);
            return { data: null, error };
        }
    }

    // Table helper
    from(table) {
        return {
            insert: (data) => this.insert(table, data),
            select: (filters) => this.select(table, filters),
            update: (data, filters) => this.update(table, data, filters)
        };
    }
}

// Create Supabase client
const supabase = new SimpleSupabaseClient(supabaseUrl, supabaseAnonKey);

// Analytics and tracking functions
export class PrayerSyncAnalytics {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.userId = null;
    }

    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    // Track calendar download
    async trackDownload(downloadData) {
        try {
            const { data, error } = await supabase.from('downloads').insert({
                    session_id: this.sessionId,
                    user_id: this.userId,
                    city_name: downloadData.cityName,
                    timezone: downloadData.timezone,
                    latitude: downloadData.latitude,
                    longitude: downloadData.longitude,
                    calendar_type: downloadData.calendarType || 'ics',
                    ip_address: await this.getClientIP(),
                    user_agent: navigator.userAgent,
                    referrer: document.referrer,
                    utm_source: this.getUrlParam('utm_source'),
                    utm_medium: this.getUrlParam('utm_medium'),
                    utm_campaign: this.getUrlParam('utm_campaign')
                });

            if (error) {
                console.error('Download tracking error:', error);
                return null;
            }

            console.log('📊 Download tracked successfully:', data);
            return data;
        } catch (error) {
            console.error('Failed to track download:', error);
            return null;
        }
    }

    // Track analytics events
    async trackEvent(eventName, properties = {}) {
        try {
            const { data, error } = await supabase.from('analytics_events').insert({
                    session_id: this.sessionId,
                    user_id: this.userId,
                    event_name: eventName,
                    event_category: properties.category || 'engagement',
                    event_properties: properties,
                    page_url: window.location.href,
                    referrer: document.referrer,
                    user_agent: navigator.userAgent,
                    ip_address: await this.getClientIP()
                });

            if (error) {
                console.error('Event tracking error:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('Failed to track event:', error);
            return null;
        }
    }

    // Get URL parameters
    getUrlParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    // Get client IP (best effort)
    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return null;
        }
    }

    // Set user ID when user provides email
    setUserId(userId) {
        this.userId = userId;
    }
}

// Email collection and subscription management
export class EmailManager {
    // Collect email after download (value-first approach)
    async collectEmail(emailData) {
        try {
            // First check if user already exists
            const { data: existingUser } = await supabase
                .from('users')
                .select('id, email')
                .eq('email', emailData.email)
                .single();

            let userId;

            if (existingUser) {
                userId = existingUser.id;
                console.log('📧 Existing user found:', existingUser.email);
            } else {
                // Create new user
                const { data: newUser, error: userError } = await supabase
                    .from('users')
                    .insert({
                        email: emailData.email,
                        consent_given: emailData.consentGiven || false,
                        consent_timestamp: new Date().toISOString(),
                        ip_address: await this.getClientIP(),
                        user_agent: navigator.userAgent,
                        location_country: emailData.country,
                        location_city: emailData.city,
                        marketing_consent: emailData.marketingConsent || false,
                        analytics_consent: emailData.analyticsConsent !== false, // Default true
                        referrer_source: emailData.referrerSource
                    })
                    .select()
                    .single();

                if (userError) {
                    console.error('User creation error:', userError);
                    throw userError;
                }

                userId = newUser.id;
                console.log('📧 New user created:', newUser.email);
            }

            // Create email subscription for double opt-in
            if (emailData.wantsUpdates) {
                await this.createEmailSubscription(userId, emailData.email);
            }

            return { success: true, userId };
        } catch (error) {
            console.error('Email collection failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Create email subscription with double opt-in
    async createEmailSubscription(userId, email) {
        try {
            const confirmationToken = this.generateConfirmationToken();

            const { data, error } = await supabase
                .from('email_subscriptions')
                .insert({
                    user_id: userId,
                    email: email,
                    status: 'pending',
                    subscription_type: 'product_updates',
                    confirmation_token: confirmationToken,
                    confirmation_sent_at: new Date().toISOString()
                });

            if (error) {
                console.error('Subscription creation error:', error);
                throw error;
            }

            // Send confirmation email (you'll implement this with Resend or similar)
            await this.sendConfirmationEmail(email, confirmationToken);

            return data;
        } catch (error) {
            console.error('Failed to create email subscription:', error);
            throw error;
        }
    }

    // Generate secure confirmation token
    generateConfirmationToken() {
        return 'token_' + Math.random().toString(36).substr(2, 15) + '_' + Date.now();
    }

    // Send confirmation email (placeholder - implement with Resend)
    async sendConfirmationEmail(email, token) {
        console.log(`📧 Confirmation email would be sent to ${email} with token ${token}`);
        // TODO: Implement with Resend API
        return true;
    }

    // Confirm email subscription
    async confirmSubscription(token) {
        try {
            const { data, error } = await supabase
                .from('email_subscriptions')
                .update({
                    status: 'confirmed',
                    confirmed_at: new Date().toISOString()
                })
                .eq('confirmation_token', token)
                .select();

            if (error) {
                console.error('Subscription confirmation error:', error);
                return { success: false, error: error.message };
            }

            return { success: true, data };
        } catch (error) {
            console.error('Failed to confirm subscription:', error);
            return { success: false, error: error.message };
        }
    }

    // Unsubscribe from emails
    async unsubscribe(email) {
        try {
            const { data, error } = await supabase
                .from('email_subscriptions')
                .update({
                    status: 'unsubscribed',
                    unsubscribed_at: new Date().toISOString()
                })
                .eq('email', email);

            if (error) {
                console.error('Unsubscribe error:', error);
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error) {
            console.error('Failed to unsubscribe:', error);
            return { success: false, error: error.message };
        }
    }

    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return null;
        }
    }
}

// GDPR/CCPA compliance functions
export class PrivacyManager {
    // Request data deletion (GDPR Right to be forgotten)
    async requestDataDeletion(email) {
        try {
            const { data, error } = await supabase
                .from('users')
                .update({
                    data_deletion_requested: true,
                    data_deletion_requested_at: new Date().toISOString()
                })
                .eq('email', email);

            if (error) {
                console.error('Data deletion request error:', error);
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error) {
            console.error('Failed to request data deletion:', error);
            return { success: false, error: error.message };
        }
    }

    // Get user data (GDPR Right to access)
    async getUserData(email) {
        try {
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            if (userError) {
                console.error('User data retrieval error:', userError);
                return { success: false, error: userError.message };
            }

            const { data: downloadsData } = await supabase
                .from('downloads')
                .select('*')
                .eq('user_id', userData.id);

            const { data: subscriptionsData } = await supabase
                .from('email_subscriptions')
                .select('*')
                .eq('user_id', userData.id);

            return {
                success: true,
                data: {
                    user: userData,
                    downloads: downloadsData || [],
                    subscriptions: subscriptionsData || []
                }
            };
        } catch (error) {
            console.error('Failed to get user data:', error);
            return { success: false, error: error.message };
        }
    }
}

// Initialize analytics
export const analytics = new PrayerSyncAnalytics();
export const emailManager = new EmailManager();
export const privacyManager = new PrivacyManager();

// Export default client
export default supabase;