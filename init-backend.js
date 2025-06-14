// Initialize backend services for PrayerSync
// This file sets up analytics, email collection, and Supabase integration

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Initializing PrayerSync backend services...');

    try {
        // Check if we're in development mode (localhost or file://)
        const isDevelopment = window.location.hostname === 'localhost' || 
                            window.location.hostname === '127.0.0.1' || 
                            window.location.protocol === 'file:';

        if (isDevelopment) {
            console.log('🔧 Development mode detected - using offline mode');
            initializeOfflineMode();
        } else {
            console.log('🌐 Production mode - initializing Supabase');
            await initializeSupabase();
        }

        // Initialize email modal
        await initializeEmailModal();

        // Track page view
        if (window.analytics) {
            window.analytics.trackEvent('page_view', {
                category: 'engagement',
                page: window.location.pathname,
                referrer: document.referrer
            });
        }

        console.log('✅ Backend services initialized successfully');

    } catch (error) {
        console.error('❌ Failed to initialize backend services:', error);
        // Continue without backend services
        initializeOfflineMode();
    }
});

// Initialize offline mode (for development and fallback)
function initializeOfflineMode() {
    console.log('📱 Running in offline mode');

    // Create mock analytics
    window.analytics = {
        trackDownload: (data) => {
            console.log('📊 [OFFLINE] Download tracked:', data);
            return Promise.resolve({ success: true });
        },
        trackEvent: (eventName, properties) => {
            console.log('📊 [OFFLINE] Event tracked:', eventName, properties);
            return Promise.resolve({ success: true });
        },
        setUserId: (userId) => {
            console.log('👤 [OFFLINE] User ID set:', userId);
        },
        sessionId: 'offline_session_' + Date.now()
    };

    // Create mock email manager
    window.emailManager = {
        collectEmail: (data) => {
            console.log('📧 [OFFLINE] Email collected:', data);
            return Promise.resolve({ 
                success: true, 
                userId: 'offline_user_' + Date.now()
            });
        }
    };
}

// Initialize services in production
async function initializeSupabase() {
    try {
        // Load configuration from secure API endpoint
        const configResponse = await fetch('/api/config');
        const config = await configResponse.json();
        
        // Set configuration globally
        window.APP_CONFIG = config;
        window.SUPABASE_URL = config.supabaseUrl;
        window.SUPABASE_ANON_KEY = config.supabaseAnonKey;

        // Load the Supabase library and create instances
        const module = await import('./lib/supabase.js');
        window.analytics = new module.PrayerSyncAnalytics();
        window.emailManager = new module.EmailManager();

        console.log('🗄️ Services initialized with secure configuration');
    } catch (error) {
        console.warn('⚠️ Service initialization failed, falling back to offline mode:', error);
        initializeOfflineMode();
    }
}

// Initialize email modal
async function initializeEmailModal() {
    try {
        // Import email modal
        const emailModalModule = await import('./components/email-modal.js');
        window.emailModal = emailModalModule.default;
        console.log('📧 Email modal initialized');
    } catch (error) {
        console.warn('⚠️ Email modal initialization failed:', error);
        // Create a dummy modal for graceful degradation
        window.emailModal = {
            show: () => console.log('📧 Email modal would show here'),
            hide: () => console.log('📧 Email modal would hide here')
        };
    }
}

// Global error handler for better debugging
window.addEventListener('error', function(e) {
    console.error('💥 Global error:', e.error);
    
    // Track error if analytics is available
    if (window.analytics && typeof window.analytics.trackEvent === 'function') {
        window.analytics.trackEvent('javascript_error', {
            category: 'error',
            error_message: e.message,
            error_filename: e.filename,
            error_line: e.lineno
        });
    }
});

// Export for manual initialization if needed
window.initializePrayerSyncBackend = {
    initializeOfflineMode,
    initializeSupabase,
    initializeEmailModal
};