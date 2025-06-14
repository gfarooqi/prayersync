/**
 * Conflict Detection Integration for PrayerSync
 * 
 * Integrates smart conflict detection and resolution with the existing PrayerSync app.
 * Enhances the calendar sync experience with intelligent meeting conflict handling.
 */

import { ConflictAwarePrayerSyncManager } from './ConflictAwarePrayerSyncManager.js';
import { GoogleCalendarService } from './CalendarService.js';

export class ConflictDetectionIntegration {
    constructor() {
        this.conflictAwareManager = null;
        this.existingApp = null;
        this.existingCalendarManager = null;
        this.isInitialized = false;
        
        this.log('ConflictDetectionIntegration created');
    }
    
    /**
     * Initialize conflict detection integration
     * @param {Object} existingApp - Reference to existing PrayerSync app
     * @param {Object} existingCalendarManager - Reference to existing calendar manager
     */
    async initialize(existingApp, existingCalendarManager) {
        if (this.isInitialized) {
            this.log('Already initialized');
            return;
        }
        
        try {
            this.existingApp = existingApp;
            this.existingCalendarManager = existingCalendarManager;
            
            // Create conflict-aware manager
            this.conflictAwareManager = new ConflictAwarePrayerSyncManager(
                existingApp.calculator,
                {
                    prayerDuration: 15,
                    bufferTime: 5,
                    considerTentative: false,
                    travelMode: false // Will be updated based on location changes
                }
            );
            
            // Initialize with existing calendar adapter and Google Calendar service
            await this.conflictAwareManager.initialize(
                existingCalendarManager,
                'google',
                {
                    clientId: this.getGoogleClientId(),
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                }
            );
            
            // Enhance existing calendar sync functionality
            this.enhanceCalendarSyncUI();
            
            // Set up event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            this.log('Conflict detection integration initialized successfully');
            
            // Store reference globally for debugging
            window.conflictDetectionIntegration = this;
            
        } catch (error) {
            console.error('Failed to initialize conflict detection:', error);
            throw error;
        }
    }
    
    /**
     * Enhance the existing calendar sync UI with conflict detection options
     */
    enhanceCalendarSyncUI() {
        const syncSection = document.querySelector('.sync-section');
        if (!syncSection) return;
        
        // Add conflict detection toggle to existing UI
        const conflictDetectionHTML = `
            <div class="conflict-detection-section">
                <h4>🚨 Smart Conflict Detection</h4>
                <p class="conflict-description">Automatically detect and resolve prayer time conflicts with your meetings</p>
                
                <div class="conflict-settings">
                    <label class="conflict-setting">
                        <input type="checkbox" id="enableConflictDetection" checked>
                        <span>Enable smart conflict detection</span>
                    </label>
                    
                    <label class="conflict-setting">
                        <input type="checkbox" id="considerTentativeMeetings">
                        <span>Consider tentative meetings as conflicts</span>
                    </label>
                    
                    <div class="conflict-setting">
                        <label for="prayerDuration">Prayer duration:</label>
                        <select id="prayerDuration">
                            <option value="10">10 minutes</option>
                            <option value="15" selected>15 minutes</option>
                            <option value="20">20 minutes</option>
                            <option value="30">30 minutes</option>
                        </select>
                    </div>
                </div>
                
                <div class="conflict-status" id="conflictDetectionStatus">
                    <div class="status-ready">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                        <span>Smart conflict detection ready</span>
                    </div>
                </div>
            </div>
        `;
        
        // Insert after the calendar connection section
        const calendarConnectionSection = syncSection.querySelector('.calendar-connection-section');
        if (calendarConnectionSection) {
            calendarConnectionSection.insertAdjacentHTML('afterend', conflictDetectionHTML);
        }
        
        this.addConflictDetectionStyles();
    }
    
    /**
     * Set up event listeners for conflict detection integration
     */
    setupEventListeners() {
        // Enhanced sync button that uses conflict detection
        const syncBtn = document.getElementById('syncPrayersBtn');
        if (syncBtn) {
            // Store original handler
            const originalHandler = syncBtn.onclick;
            
            // Replace with conflict-aware handler
            syncBtn.onclick = async (event) => {
                event.preventDefault();
                await this.handleConflictAwarePrayerSync();
            };
        }
        
        // Conflict detection settings
        const enableToggle = document.getElementById('enableConflictDetection');
        if (enableToggle) {
            enableToggle.addEventListener('change', (e) => {
                this.updateConflictDetectionStatus(e.target.checked);
            });
        }
        
        const tentativeToggle = document.getElementById('considerTentativeMeetings');
        if (tentativeToggle) {
            tentativeToggle.addEventListener('change', (e) => {
                this.conflictAwareManager.config.considerTentative = e.target.checked;
                this.log('Updated tentative meetings setting:', e.target.checked);
            });
        }
        
        const durationSelect = document.getElementById('prayerDuration');
        if (durationSelect) {
            durationSelect.addEventListener('change', (e) => {
                this.conflictAwareManager.config.prayerDuration = parseInt(e.target.value);
                this.log('Updated prayer duration:', e.target.value);
            });
        }
        
        // Listen for location changes to update travel mode
        document.addEventListener('location-change-accepted', (event) => {
            this.handleLocationChange(event.detail.newLocation);
        });
        
        // Listen for calendar connection changes
        document.addEventListener('calendar-connected', () => {
            this.updateConflictDetectionStatus(true);
        });
        
        document.addEventListener('calendar-disconnected', () => {
            this.updateConflictDetectionStatus(false);
        });
    }
    
    /**
     * Handle conflict-aware prayer sync
     */
    async handleConflictAwarePrayerSync() {
        const enableConflictDetection = document.getElementById('enableConflictDetection')?.checked ?? true;
        
        if (!enableConflictDetection) {
            this.log('Conflict detection disabled, using legacy sync');
            // Fall back to original sync method
            return this.handleLegacyPrayerSync();
        }
        
        if (!this.conflictAwareManager || !this.existingCalendarManager?.isCalendarConnected()) {
            this.showSyncStatus('Please connect your calendar first.', 'error');
            return;
        }
        
        try {
            const syncBtn = document.getElementById('syncPrayersBtn');
            if (syncBtn) {
                syncBtn.disabled = true;
                syncBtn.innerHTML = '<span>🔍 Detecting conflicts...</span>';
            }
            
            // Get current settings
            const selectedPeriod = document.querySelector('.sync-btn.selected')?.dataset.period || 'month';
            const replaceExisting = document.getElementById('replaceExistingEvents')?.checked ?? true;
            
            // Get current location
            const location = this.getCurrentLocation();
            
            // Update configuration
            this.updateConfigFromUI();
            
            // Perform conflict-aware sync
            this.log('Starting conflict-aware prayer sync...');
            const result = await this.conflictAwareManager.syncPrayerScheduleWithConflictDetection(
                location,
                selectedPeriod,
                {
                    replaceExisting: replaceExisting,
                    professionalMode: this.existingApp?.calendarIntegration?.professionalMode ?? true
                }
            );
            
            if (result.success) {
                this.showSyncStatus(
                    this.formatSyncSuccessMessage(result),
                    'success'
                );
                this.log('Conflict-aware sync completed successfully:', result);
            } else {
                throw new Error(result.error || 'Sync failed');
            }
            
        } catch (error) {
            console.error('Conflict-aware sync failed:', error);
            this.showSyncStatus('Sync failed. Please try again.', 'error');
        } finally {
            const syncBtn = document.getElementById('syncPrayersBtn');
            if (syncBtn) {
                syncBtn.disabled = false;
                syncBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                    </svg>
                    Sync Prayer Times
                `;
            }
        }
    }
    
    /**
     * Handle legacy prayer sync (fallback)
     */
    async handleLegacyPrayerSync() {
        if (!this.existingCalendarManager?.isCalendarConnected()) {
            this.showSyncStatus('Please connect your calendar first.', 'error');
            return;
        }
        
        try {
            const syncBtn = document.getElementById('syncPrayersBtn');
            if (syncBtn) {
                syncBtn.disabled = true;
                syncBtn.innerHTML = '<span>Syncing...</span>';
            }
            
            // Get current settings
            const selectedPeriod = document.querySelector('.sync-btn.selected')?.dataset.period || 'month';
            const replaceExisting = document.getElementById('replaceExistingEvents')?.checked ?? true;
            const location = this.getCurrentLocation();
            
            // Use existing calendar manager
            const result = await this.existingCalendarManager.syncPrayerSchedule(location, selectedPeriod, {
                replaceExisting: replaceExisting
            });
            
            if (result.success) {
                this.showSyncStatus(
                    `Successfully synced ${result.eventsCreated} prayer events for ${result.period}`,
                    'success'
                );
            } else {
                throw new Error(result.error || 'Sync failed');
            }
            
        } catch (error) {
            console.error('Legacy sync failed:', error);
            this.showSyncStatus('Failed to sync prayer times. Please try again.', 'error');
        } finally {
            // Reset button state
            const syncBtn = document.getElementById('syncPrayersBtn');
            if (syncBtn) {
                syncBtn.disabled = false;
                syncBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                    </svg>
                    Sync Prayer Times
                `;
            }
        }
    }
    
    /**
     * Update configuration from UI settings
     */
    updateConfigFromUI() {
        if (!this.conflictAwareManager) return;
        
        const tentativeToggle = document.getElementById('considerTentativeMeetings');
        const durationSelect = document.getElementById('prayerDuration');
        
        if (tentativeToggle) {
            this.conflictAwareManager.config.considerTentative = tentativeToggle.checked;
        }
        
        if (durationSelect) {
            this.conflictAwareManager.config.prayerDuration = parseInt(durationSelect.value);
        }
    }
    
    /**
     * Handle location changes for travel mode
     */
    handleLocationChange(newLocation) {
        if (!this.conflictAwareManager) return;
        
        // Enable travel mode when location changes significantly
        this.conflictAwareManager.config.travelMode = true;
        this.log('Enabled travel mode due to location change:', newLocation);
        
        // Reset travel mode after some time
        setTimeout(() => {
            if (this.conflictAwareManager) {
                this.conflictAwareManager.config.travelMode = false;
                this.log('Disabled travel mode');
            }
        }, 24 * 60 * 60 * 1000); // 24 hours
    }
    
    /**
     * Get current location from existing app
     */
    getCurrentLocation() {
        if (!this.existingApp?.location) {
            throw new Error('Current location not available');
        }
        
        return {
            latitude: this.existingApp.location.latitude,
            longitude: this.existingApp.location.longitude,
            timezone: this.existingApp.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            city: this.getCurrentLocationName() || 'Current Location'
        };
    }
    
    /**
     * Get current location name from UI
     */
    getCurrentLocationName() {
        const locationText = document.getElementById('locationText');
        if (locationText && !locationText.textContent.includes('Detecting')) {
            return locationText.textContent;
        }
        return null;
    }
    
    /**
     * Get Google Client ID from configuration
     */
    getGoogleClientId() {
        // This should match the client ID used by the existing calendar integration
        // For now, return a placeholder that should be configured
        return 'YOUR_GOOGLE_CLIENT_ID_HERE';
    }
    
    /**
     * Format sync success message with conflict details
     */
    formatSyncSuccessMessage(result) {
        let message = `Successfully synced ${result.eventsCreated} prayer events for ${result.period}`;
        
        if (result.conflictsDetected > 0) {
            message += `. Detected and resolved ${result.conflictsResolved}/${result.conflictsDetected} conflicts`;
        }
        
        return message;
    }
    
    /**
     * Update conflict detection status UI
     */
    updateConflictDetectionStatus(enabled) {
        const statusEl = document.getElementById('conflictDetectionStatus');
        if (!statusEl) return;
        
        const readyEl = statusEl.querySelector('.status-ready');
        const disabledEl = statusEl.querySelector('.status-disabled');
        
        if (enabled && this.existingCalendarManager?.isCalendarConnected()) {
            statusEl.innerHTML = `
                <div class="status-ready">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <span>Smart conflict detection ready</span>
                </div>
            `;
        } else {
            statusEl.innerHTML = `
                <div class="status-disabled">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 5h2v6h-2zm0 8h2v2h-2z"/>
                    </svg>
                    <span>${enabled ? 'Calendar not connected' : 'Conflict detection disabled'}</span>
                </div>
            `;
        }
    }
    
    /**
     * Show sync status message
     */
    showSyncStatus(message, type = 'info') {
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
    
    /**
     * Add CSS styles for conflict detection UI
     */
    addConflictDetectionStyles() {
        const styles = `
            <style>
            .conflict-detection-section {
                margin: 2rem 0;
                padding: 1.5rem;
                border: 2px solid #f59e0b;
                border-radius: var(--radius-lg);
                background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
            }
            
            .conflict-detection-section h4 {
                margin: 0 0 0.5rem 0;
                color: #92400e;
                font-size: 1rem;
            }
            
            .conflict-description {
                color: #78350f;
                margin-bottom: 1rem;
                font-size: 0.875rem;
            }
            
            .conflict-settings {
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
            }
            
            .conflict-setting {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 0.875rem;
                color: #78350f;
            }
            
            .conflict-setting input[type="checkbox"] {
                margin: 0;
            }
            
            .conflict-setting select {
                padding: 0.25rem 0.5rem;
                border: 1px solid #d97706;
                border-radius: 4px;
                background: white;
                color: #78350f;
            }
            
            .conflict-status {
                margin-top: 1rem;
                padding: 0.75rem;
                border-radius: 6px;
            }
            
            .status-ready {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                background: #dcfce7;
                color: #166534;
                padding: 0.5rem;
                border-radius: 4px;
                border: 1px solid #bbf7d0;
            }
            
            .status-disabled {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                background: #fef2f2;
                color: #991b1b;
                padding: 0.5rem;
                border-radius: 4px;
                border: 1px solid #fecaca;
            }
            
            .status-ready svg,
            .status-disabled svg {
                flex-shrink: 0;
            }
            
            @media (max-width: 768px) {
                .conflict-detection-section {
                    margin: 1rem 0;
                    padding: 1rem;
                }
                
                .conflict-settings {
                    gap: 0.5rem;
                }
                
                .conflict-setting {
                    font-size: 0.8rem;
                }
            }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }
    
    /**
     * Get integration status for debugging
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            conflictAwareManagerReady: this.conflictAwareManager !== null,
            calendarConnected: this.existingCalendarManager?.isCalendarConnected() ?? false,
            conflictDetectionEnabled: document.getElementById('enableConflictDetection')?.checked ?? false
        };
    }
    
    /**
     * Development logging
     */
    log(...args) {
        console.log('[ConflictDetectionIntegration]', ...args);
    }
}

// Auto-initialize when app is ready
export function initializeConflictDetection() {
    if (typeof window !== 'undefined') {
        window.addEventListener('DOMContentLoaded', () => {
            // Wait for existing integrations to be ready
            setTimeout(async () => {
                if (window.app && window.calendarManager) {
                    const conflictIntegration = new ConflictDetectionIntegration();
                    
                    try {
                        await conflictIntegration.initialize(window.app, window.calendarManager);
                        
                        // Store reference globally
                        window.conflictIntegration = conflictIntegration;
                        
                        console.log('✅ Conflict detection integration ready');
                        
                    } catch (error) {
                        console.error('❌ Failed to initialize conflict detection:', error);
                    }
                } else {
                    console.warn('⚠️ PrayerSync app or calendar manager not found, conflict detection disabled');
                }
            }, 2000); // Wait 2 seconds for other integrations
        });
    }
}

// Auto-initialize
initializeConflictDetection();