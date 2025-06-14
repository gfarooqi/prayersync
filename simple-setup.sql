-- PrayerSync Essential Tables
-- Copy and paste this into Supabase SQL Editor

-- Users table
CREATE TABLE public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    consent_given BOOLEAN DEFAULT FALSE,
    marketing_consent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Downloads table  
CREATE TABLE public.downloads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id VARCHAR(255),
    city_name VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) NOT NULL,
    calendar_type VARCHAR(20) DEFAULT 'ics',
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email subscriptions table
CREATE TABLE public.email_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    confirmation_token VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics events table
CREATE TABLE public.analytics_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id VARCHAR(255),
    event_name VARCHAR(100) NOT NULL,
    event_properties JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow public access for our app
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (needed for our app)
CREATE POLICY "Allow anonymous inserts" ON public.downloads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous inserts" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous inserts" ON public.email_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous inserts" ON public.analytics_events FOR INSERT WITH CHECK (true);