-- PrayerSync Database Schema
-- Supabase PostgreSQL setup for user management and analytics

-- Enable Row Level Security (RLS)
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users table for tracking user interactions
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    email_verified BOOLEAN DEFAULT FALSE,
    consent_given BOOLEAN DEFAULT FALSE,
    consent_timestamp TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    location_country VARCHAR(2), -- ISO country code
    location_city VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Privacy preferences
    marketing_consent BOOLEAN DEFAULT FALSE,
    analytics_consent BOOLEAN DEFAULT TRUE,
    data_retention_consent BOOLEAN DEFAULT TRUE,
    
    -- User engagement tracking
    total_downloads INTEGER DEFAULT 0,
    last_download_at TIMESTAMPTZ,
    referrer_source VARCHAR(100),
    
    -- GDPR/CCPA compliance
    data_deletion_requested BOOLEAN DEFAULT FALSE,
    data_deletion_requested_at TIMESTAMPTZ,
    
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Downloads table for tracking calendar downloads
CREATE TABLE IF NOT EXISTS public.downloads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    session_id VARCHAR(255), -- For anonymous tracking before email collection
    
    -- Download details
    city_name VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    calendar_type VARCHAR(20) DEFAULT 'ics', -- 'ics', 'google', 'outlook', 'apple'
    
    -- Technical details
    file_size_bytes INTEGER,
    download_duration_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    
    -- User context
    ip_address INET,
    user_agent TEXT,
    referrer VARCHAR(255),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email subscriptions for newsletter/updates
CREATE TABLE IF NOT EXISTS public.email_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    
    -- Subscription status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'unsubscribed'
    subscription_type VARCHAR(50) DEFAULT 'product_updates', -- 'product_updates', 'prayer_reminders', 'community'
    
    -- Double opt-in flow
    confirmation_token VARCHAR(255) UNIQUE,
    confirmation_sent_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    
    -- Communication preferences
    frequency VARCHAR(20) DEFAULT 'weekly', -- 'daily', 'weekly', 'monthly'
    timezone VARCHAR(50),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, subscription_type)
);

-- Analytics events for tracking user behavior
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    
    -- Event details
    event_name VARCHAR(100) NOT NULL, -- 'page_view', 'download_start', 'email_submitted', etc.
    event_category VARCHAR(50), -- 'engagement', 'conversion', 'error'
    event_properties JSONB DEFAULT '{}',
    
    -- Context
    page_url VARCHAR(500),
    referrer VARCHAR(500),
    user_agent TEXT,
    ip_address INET,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for data security

-- Users can only see their own data
CREATE POLICY "Users can view own data" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Downloads are viewable by the user who made them
CREATE POLICY "Users can view own downloads" ON public.downloads
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Anyone can insert downloads" ON public.downloads
    FOR INSERT WITH CHECK (true);

-- Email subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.email_subscriptions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own subscriptions" ON public.email_subscriptions
    FOR ALL USING (user_id = auth.uid());

-- Analytics events (read-only for users, insert-only)
CREATE POLICY "Users can view own analytics" ON public.analytics_events
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Anyone can insert analytics events" ON public.analytics_events
    FOR INSERT WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);
CREATE INDEX IF NOT EXISTS idx_downloads_user_id ON public.downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_downloads_session_id ON public.downloads(session_id);
CREATE INDEX IF NOT EXISTS idx_downloads_created_at ON public.downloads(created_at);
CREATE INDEX IF NOT EXISTS idx_email_subscriptions_user_id ON public.email_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_email_subscriptions_email ON public.email_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON public.analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at);

-- Functions for common operations

-- Function to track a download
CREATE OR REPLACE FUNCTION track_download(
    p_session_id VARCHAR(255),
    p_city_name VARCHAR(100),
    p_timezone VARCHAR(50),
    p_latitude DECIMAL(10, 8) DEFAULT NULL,
    p_longitude DECIMAL(11, 8) DEFAULT NULL,
    p_calendar_type VARCHAR(20) DEFAULT 'ics',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    download_id UUID;
BEGIN
    INSERT INTO public.downloads (
        session_id, city_name, timezone, latitude, longitude, 
        calendar_type, ip_address, user_agent
    ) VALUES (
        p_session_id, p_city_name, p_timezone, p_latitude, p_longitude,
        p_calendar_type, p_ip_address, p_user_agent
    ) RETURNING id INTO download_id;
    
    RETURN download_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get download statistics
CREATE OR REPLACE FUNCTION get_download_stats(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
    total_downloads BIGINT,
    unique_sessions BIGINT,
    top_cities TEXT[],
    success_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_downloads,
        COUNT(DISTINCT session_id)::BIGINT as unique_sessions,
        ARRAY_AGG(DISTINCT city_name)::TEXT[] as top_cities,
        (COUNT(*) FILTER (WHERE success = true)::DECIMAL / COUNT(*)::DECIMAL * 100) as success_rate
    FROM public.downloads 
    WHERE created_at >= NOW() - INTERVAL '1 day' * days_back;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;