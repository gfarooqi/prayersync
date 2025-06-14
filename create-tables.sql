-- PrayerSync Database Schema
-- Create essential tables first

-- Users table for tracking user interactions
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    email_verified BOOLEAN DEFAULT FALSE,
    consent_given BOOLEAN DEFAULT FALSE,
    consent_timestamp TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    location_country VARCHAR(2),
    location_city VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    marketing_consent BOOLEAN DEFAULT FALSE,
    analytics_consent BOOLEAN DEFAULT TRUE,
    data_retention_consent BOOLEAN DEFAULT TRUE,
    total_downloads INTEGER DEFAULT 0,
    last_download_at TIMESTAMPTZ,
    referrer_source VARCHAR(100),
    data_deletion_requested BOOLEAN DEFAULT FALSE,
    data_deletion_requested_at TIMESTAMPTZ,
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);