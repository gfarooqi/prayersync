-- PrayerSync Database Setup - Production Ready
-- Based on Supabase best practices 2024
-- This SQL is idempotent and handles existing tables

-- 1. PROFILES TABLE (instead of users to avoid conflict with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255), -- Could be pulled from auth.users, but kept for convenience
    consent_given BOOLEAN DEFAULT FALSE,
    marketing_consent BOOLEAN DEFAULT FALSE,
    analytics_consent BOOLEAN DEFAULT TRUE,
    location_country VARCHAR(2),
    location_city VARCHAR(100),
    total_downloads INTEGER DEFAULT 0,
    last_download_at TIMESTAMPTZ,
    referrer_source VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. DOWNLOADS TABLE
CREATE TABLE IF NOT EXISTS public.downloads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    city_name VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    calendar_type VARCHAR(20) DEFAULT 'ics',
    ip_address INET,
    user_agent TEXT,
    referrer VARCHAR(255),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    success BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. EMAIL SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.email_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'unsubscribed')),
    subscription_type VARCHAR(50) DEFAULT 'product_updates',
    confirmation_token VARCHAR(255) UNIQUE,
    confirmation_sent_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ANALYTICS EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    event_name VARCHAR(100) NOT NULL,
    event_category VARCHAR(50),
    event_properties JSONB DEFAULT '{}',
    page_url VARCHAR(500),
    referrer VARCHAR(500),
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_downloads_profile_id ON public.downloads(profile_id);
CREATE INDEX IF NOT EXISTS idx_downloads_session_id ON public.downloads(session_id);
CREATE INDEX IF NOT EXISTS idx_downloads_created_at ON public.downloads(created_at);
CREATE INDEX IF NOT EXISTS idx_email_subscriptions_profile_id ON public.email_subscriptions(profile_id);
CREATE INDEX IF NOT EXISTS idx_email_subscriptions_email ON public.email_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_analytics_events_profile_id ON public.analytics_events(profile_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON public.analytics_events(session_id);

-- 6. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- 7. PROFILES POLICIES (Secure)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated 
  USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated 
  USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated 
  WITH CHECK ((SELECT auth.uid()) = id);

-- 8. ANONYMOUS ACCESS POLICIES (for app functionality)
-- WARNING: These allow anonymous users to insert data. 
-- Consider rate limiting with Cloudflare or similar to prevent abuse.

DROP POLICY IF EXISTS "Allow anonymous downloads" ON public.downloads;
CREATE POLICY "Allow anonymous downloads" ON public.downloads
  FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous email subscriptions" ON public.email_subscriptions;
CREATE POLICY "Allow anonymous email subscriptions" ON public.email_subscriptions
  FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous analytics" ON public.analytics_events;
CREATE POLICY "Allow anonymous analytics" ON public.analytics_events
  FOR INSERT TO anon
  WITH CHECK (true);

-- 9. AUTHENTICATED USER READ ACCESS
DROP POLICY IF EXISTS "Authenticated users can view downloads" ON public.downloads;
CREATE POLICY "Authenticated users can view downloads" ON public.downloads
  FOR SELECT TO authenticated
  USING (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view subscriptions" ON public.email_subscriptions;
CREATE POLICY "Authenticated users can view subscriptions" ON public.email_subscriptions
  FOR SELECT TO authenticated
  USING (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view analytics" ON public.analytics_events;
CREATE POLICY "Authenticated users can view analytics" ON public.analytics_events
  FOR SELECT TO authenticated
  USING (profile_id = (SELECT auth.uid()));

-- 10. GRANT NECESSARY PERMISSIONS
GRANT INSERT ON TABLE public.downloads TO anon;
GRANT INSERT ON TABLE public.email_subscriptions TO anon;
GRANT INSERT ON TABLE public.analytics_events TO anon;

GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.downloads TO authenticated;
GRANT SELECT ON TABLE public.email_subscriptions TO authenticated;
GRANT SELECT ON TABLE public.analytics_events TO authenticated;

-- 11. AUTO-CREATE PROFILE TRIGGER (Best Practice)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at)
  VALUES (
    NEW.id, 
    NEW.email,
    NOW()
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Handle case where profile already exists
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- 12. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.get_download_stats(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
    total_downloads BIGINT,
    unique_sessions BIGINT,
    top_cities TEXT[],
    success_rate DECIMAL
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_downloads,
        COUNT(DISTINCT session_id)::BIGINT as unique_sessions,
        ARRAY_AGG(DISTINCT city_name)::TEXT[] as top_cities,
        (COUNT(*) FILTER (WHERE success = true)::DECIMAL / NULLIF(COUNT(*)::DECIMAL, 0) * 100) as success_rate
    FROM public.downloads 
    WHERE created_at >= NOW() - INTERVAL '1 day' * days_back;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_download_stats(INTEGER) TO authenticated;

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE 'PrayerSync database setup completed successfully! ✅';
    RAISE NOTICE 'Tables created: profiles, downloads, email_subscriptions, analytics_events';
    RAISE NOTICE 'RLS policies configured for security';
    RAISE NOTICE 'Auto-profile creation trigger activated';
    RAISE NOTICE 'Ready for PrayerSync app integration! 🚀';
END $$;