/**
 * Integration layer between existing PrayerSync app and new calendar functionality
 * 
 * This file bridges the existing SalatApp class with the new PrayerSyncManager
 * to provide seamless calendar integration without breaking existing functionality.
 */

import { PrayerSyncManager } from './PrayerSyncManager.js';

// Extend the existing app with calendar integration
export function enhanceAppWithCalendarIntegration() {
    // Wait for the existing app to be initialized
    if (typeof window !== 'undefined') {
        // Add calendar integration when app is ready
        window.addEventListener('DOMContentLoaded', () => {
            initializeCalendarIntegration();
        });
    }
}

function initializeCalendarIntegration() {
    // Get reference to existing app instance
    const existingApp = window.app;
    if (!existingApp || !existingApp.calculator) {
        console.warn('Existing PrayerSync app not found, calendar integration disabled');
        return;
    }

    // Create calendar manager with existing calculator
    const calendarManager = new PrayerSyncManager(existingApp.calculator);
    
    // Store reference globally for easy access
    window.calendarManager = calendarManager;
    
    // Add calendar UI components
    addCalendarUIComponents();
    
    // Set up event listeners for calendar functionality
    setupCalendarEventListeners(calendarManager, existingApp);
    
    console.log('Calendar integration initialized successfully');
}

function addCalendarUIComponents() {
    // Add calendar connection section to the existing sync section
    const syncSection = document.querySelector('.sync-section');
    if (!syncSection) return;

    // Create calendar connection UI
    const calendarConnectionHTML = `
        <div class="calendar-connection-section">
            <h4>🔗 Live Calendar Sync</h4>
            <p class="calendar-description">Automatically sync prayer times to your calendar instead of manual downloads</p>
            
            <div class="calendar-status" id="calendarStatus">
                <div class="status-disconnected">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    <span>Calendar not connected</span>
                </div>
                <div class="status-connected" style="display: none;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <span id="connectedUserInfo">Connected</span>
                </div>
            </div>

            <div class="calendar-actions">
                <button class="btn-primary" id="connectCalendarBtn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/>
                    </svg>
                    Connect Google Calendar
                </button>
                
                <button class="btn-secondary" id="disconnectCalendarBtn" style="display: none;">
                    Disconnect Calendar
                </button>
            </div>

            <div class="sync-options" id="syncOptions" style="display: none;">
                <h5>Sync Prayer Schedule</h5>
                <div class="sync-period-buttons">
                    <button class="sync-btn" data-period="today">Today</button>
                    <button class="sync-btn" data-period="week">This Week</button>
                    <button class="sync-btn selected" data-period="month">This Month</button>
                </div>
                
                <div class="sync-advanced-options">
                    <label>
                        <input type="checkbox" id="replaceExistingEvents" checked>
                        Replace existing prayer events
                    </label>
                </div>
                
                <button class="btn-primary large" id="syncPrayersBtn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                    </svg>
                    Sync Prayer Times
                </button>
            </div>

            <div class="sync-status" id="syncStatus" style="display: none;">
                <div class="status-message"></div>
            </div>
        </div>
    `;

    // Insert after the direct calendar integration section
    const directIntegration = syncSection.querySelector('div[style*="margin-bottom: 2rem;"]:nth-of-type(2)');
    if (directIntegration) {
        directIntegration.insertAdjacentHTML('afterend', calendarConnectionHTML);
    }
}

function setupCalendarEventListeners(calendarManager, existingApp) {
    const connectBtn = document.getElementById('connectCalendarBtn');
    const disconnectBtn = document.getElementById('disconnectCalendarBtn');
    const syncBtn = document.getElementById('syncPrayersBtn');
    const syncOptions = document.getElementById('syncOptions');
    const calendarStatus = document.getElementById('calendarStatus');
    const syncStatus = document.getElementById('syncStatus');

    if (!connectBtn || !calendarManager) return;

    // Connect calendar button
    connectBtn.addEventListener('click', async () => {
        try {
            connectBtn.disabled = true;
            connectBtn.innerHTML = '<span>Connecting...</span>';
            
            const connected = await calendarManager.connectCalendar();
            if (connected) {
                updateCalendarConnectionUI(true, calendarManager);
            } else {
                throw new Error('Failed to connect to calendar');
            }
        } catch (error) {
            console.error('Calendar connection failed:', error);
            showSyncStatus('Failed to connect to calendar. Please try again.', 'error');
        } finally {
            connectBtn.disabled = false;
            connectBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/>
                </svg>
                Connect Google Calendar
            `;
        }
    });

    // Disconnect calendar button
    disconnectBtn?.addEventListener('click', async () => {
        await calendarManager.disconnectCalendar();
        updateCalendarConnectionUI(false);
    });

    // Sync prayers button
    syncBtn?.addEventListener('click', async () => {
        if (!calendarManager.isCalendarConnected()) {
            showSyncStatus('Please connect your calendar first.', 'error');
            return;
        }

        try {
            syncBtn.disabled = true;
            const originalText = syncBtn.innerHTML;
            syncBtn.innerHTML = '<span>Syncing...</span>';

            // Get current settings
            const selectedPeriod = document.querySelector('.sync-btn.selected')?.dataset.period || 'month';
            const replaceExisting = document.getElementById('replaceExistingEvents')?.checked ?? true;

            // Get current location from existing app
            const location = {
                latitude: existingApp.location.latitude,
                longitude: existingApp.location.longitude,
                timezone: existingApp.timezone,
                city: getCurrentLocationName()
            };

            // Get current settings
            const calculationMethod = existingApp.calculator.calculationMethod;
            const professionalMode = existingApp.calendarIntegration?.professionalMode ?? true;
            const eventDuration = existingApp.calendarIntegration?.eventDuration ?? 30;

            // Perform sync
            const result = await calendarManager.syncPrayerSchedule(location, selectedPeriod, {
                calculationMethod,
                professionalMode,
                eventDuration,
                replaceExisting
            });

            if (result.success) {
                showSyncStatus(
                    `Successfully synced ${result.eventsCreated} prayer events for ${result.period}`,
                    'success'
                );
            } else {
                throw new Error(result.error || 'Sync failed');
            }

        } catch (error) {
            console.error('Prayer sync failed:', error);
            showSyncStatus('Failed to sync prayer times. Please try again.', 'error');
        } finally {
            syncBtn.disabled = false;
            syncBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                </svg>
                Sync Prayer Times
            `;
        }
    });

    // Period selection buttons
    document.querySelectorAll('.sync-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sync-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });

    // Check if already connected on page load
    if (calendarManager.isCalendarConnected()) {
        updateCalendarConnectionUI(true, calendarManager);
    }
}

function updateCalendarConnectionUI(connected, calendarManager = null) {
    const connectBtn = document.getElementById('connectCalendarBtn');
    const disconnectBtn = document.getElementById('disconnectCalendarBtn');
    const syncOptions = document.getElementById('syncOptions');
    const calendarStatus = document.getElementById('calendarStatus');

    if (!calendarStatus) return;

    const disconnectedStatus = calendarStatus.querySelector('.status-disconnected');
    const connectedStatus = calendarStatus.querySelector('.status-connected');
    const userInfo = document.getElementById('connectedUserInfo');

    if (connected && calendarManager) {
        // Show connected state
        disconnectedStatus.style.display = 'none';
        connectedStatus.style.display = 'flex';
        connectBtn.style.display = 'none';
        disconnectBtn.style.display = 'inline-flex';
        syncOptions.style.display = 'block';

        // Update user info
        const user = calendarManager.getConnectedUser();
        if (user) {
            userInfo.textContent = `Connected as ${user.email}`;
        }
    } else {
        // Show disconnected state
        disconnectedStatus.style.display = 'flex';
        connectedStatus.style.display = 'none';
        connectBtn.style.display = 'inline-flex';
        disconnectBtn.style.display = 'none';
        syncOptions.style.display = 'none';
    }
}

function showSyncStatus(message, type = 'info') {
    const syncStatus = document.getElementById('syncStatus');
    const statusMessage = syncStatus?.querySelector('.status-message');
    
    if (!syncStatus || !statusMessage) return;

    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    syncStatus.style.display = 'block';

    // Hide after 5 seconds for success messages
    if (type === 'success') {
        setTimeout(() => {
            syncStatus.style.display = 'none';
        }, 5000);
    }
}

function getCurrentLocationName() {
    // Try to get location name from existing UI
    const locationText = document.getElementById('locationText');
    if (locationText) {
        return locationText.textContent.replace('Detecting location...', '').trim();
    }
    return 'Current Location';
}

// CSS styles for calendar integration
function addCalendarStyles() {
    const styles = `
        <style>
        .calendar-connection-section {
            margin: 2rem 0;
            padding: 1.5rem;
            border: 2px solid var(--border);
            border-radius: var(--radius-lg);
            background: var(--surface-elevated);
        }
        
        .calendar-description {
            color: var(--text-secondary);
            margin-bottom: 1rem;
        }
        
        .calendar-status {
            margin: 1rem 0;
        }
        
        .status-disconnected,
        .status-connected {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem;
            border-radius: var(--radius-md);
        }
        
        .status-disconnected {
            background: #fef2f2;
            color: #dc2626;
            border: 1px solid #fecaca;
        }
        
        .status-connected {
            background: #f0fdf4;
            color: #16a34a;
            border: 1px solid #bbf7d0;
        }
        
        .calendar-actions {
            margin: 1rem 0;
        }
        
        .sync-options {
            margin-top: 1.5rem;
            padding-top: 1.5rem;
            border-top: 1px solid var(--border);
        }
        
        .sync-period-buttons {
            display: flex;
            gap: 0.5rem;
            margin: 1rem 0;
        }
        
        .sync-btn {
            padding: 0.5rem 1rem;
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            background: var(--surface);
            color: var(--text-primary);
            cursor: pointer;
            transition: var(--transition);
        }
        
        .sync-btn:hover {
            background: var(--surface-hover);
        }
        
        .sync-btn.selected {
            background: var(--primary);
            color: white;
            border-color: var(--primary);
        }
        
        .sync-advanced-options {
            margin: 1rem 0;
        }
        
        .sync-advanced-options label {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.875rem;
            color: var(--text-secondary);
        }
        
        .sync-status {
            margin-top: 1rem;
        }
        
        .status-message {
            padding: 0.75rem;
            border-radius: var(--radius-md);
            font-size: 0.875rem;
        }
        
        .status-message.success {
            background: #f0fdf4;
            color: #16a34a;
            border: 1px solid #bbf7d0;
        }
        
        .status-message.error {
            background: #fef2f2;
            color: #dc2626;
            border: 1px solid #fecaca;
        }
        
        .status-message.info {
            background: #eff6ff;
            color: #2563eb;
            border: 1px solid #bfdbfe;
        }
        </style>
    `;
    
    document.head.insertAdjacentHTML('beforeend', styles);
}

// Initialize everything
enhanceAppWithCalendarIntegration();
addCalendarStyles();