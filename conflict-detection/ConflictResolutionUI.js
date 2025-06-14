/**
 * ConflictResolutionUI - Smart Conflict Resolution Interface
 * 
 * Professional UI for displaying prayer time conflicts and smart suggestions
 * with timeline visualization and seamless resolution actions.
 */

import { SuggestionTypes, ConflictSeverity } from './data-models.js';

export class ConflictResolutionUI {
    constructor(options = {}) {
        this.config = {
            // UI behavior configuration
            autoDismissTimeout: options.autoDismissTimeout || 0, // 0 = no auto-dismiss
            showTimeline: options.showTimeline !== false,
            maxSuggestions: options.maxSuggestions || 3,
            cssPrefix: options.cssPrefix || 'conflict-resolution',
            enableLogging: options.enableLogging !== false,
            
            // Visual configuration
            animationDuration: options.animationDuration || 300,
            compactMode: options.compactMode || false,
            ...options
        };
        
        this.currentConflict = null;
        this.currentSuggestions = null;
        this.activeModal = null;
        this.autoDismissTimer = null;
        
        this.log('ConflictResolutionUI initialized');
    }
    
    /**
     * Show conflict resolution interface
     * @param {Conflict} conflict - Detected conflict
     * @param {Suggestion[]} suggestions - Ranked suggestions
     * @param {Function} onResolve - Callback when user selects suggestion
     * @param {Function} onDismiss - Callback when user dismisses conflict
     */
    showConflictResolution(conflict, suggestions, onResolve, onDismiss) {
        this.log('Showing conflict resolution', { conflict, suggestions });
        
        // Dismiss any existing conflict first
        this.dismissCurrentConflict();
        
        this.currentConflict = conflict;
        this.currentSuggestions = suggestions.slice(0, this.config.maxSuggestions);
        
        // Show appropriate UI based on conflict severity
        switch (conflict.analysis.conflictSeverity) {
            case ConflictSeverity.COMPLETE:
                this.showCompleteConflictUI(conflict, this.currentSuggestions, onResolve, onDismiss);
                break;
                
            case ConflictSeverity.PARTIAL:
                this.showPartialConflictUI(conflict, this.currentSuggestions, onResolve, onDismiss);
                break;
                
            case ConflictSeverity.MINOR:
                this.showMinorConflictUI(conflict, this.currentSuggestions, onResolve, onDismiss);
                break;
        }
        
        // Set up auto-dismiss if configured
        if (this.config.autoDismissTimeout > 0) {
            this.autoDismissTimer = setTimeout(() => {
                this.log('Auto-dismissing conflict');
                this.dismissCurrentConflict();
                onDismiss();
            }, this.config.autoDismissTimeout);
        }
    }
    
    /**
     * Show UI for complete conflicts (no available time)
     */
    showCompleteConflictUI(conflict, suggestions, onResolve, onDismiss) {
        const modal = this.createConflictModal({
            type: 'complete',
            icon: '🚨',
            title: `${conflict.prayerName} Prayer Completely Blocked`,
            message: this.generateConflictMessage(conflict),
            urgency: 'high',
            conflict,
            suggestions,
            onResolve,
            onDismiss
        });
        
        this.showModal(modal);
    }
    
    /**
     * Show UI for partial conflicts (limited time available)
     */
    showPartialConflictUI(conflict, suggestions, onResolve, onDismiss) {
        const modal = this.createConflictModal({
            type: 'partial',
            icon: '⚡',
            title: `${conflict.prayerName} Prayer Scheduling Challenge`,
            message: this.generateConflictMessage(conflict),
            urgency: 'medium',
            conflict,
            suggestions,
            onResolve,
            onDismiss
        });
        
        this.showModal(modal);
    }
    
    /**
     * Show UI for minor conflicts (easy to resolve)
     */
    showMinorConflictUI(conflict, suggestions, onResolve, onDismiss) {
        // For minor conflicts, show a less intrusive banner first
        const banner = this.createConflictBanner({
            conflict,
            suggestions,
            onViewDetails: () => {
                this.dismissCurrentConflict();
                this.showCompleteConflictUI(conflict, suggestions, onResolve, onDismiss);
            },
            onQuickResolve: (suggestion) => {
                this.dismissCurrentConflict();
                onResolve(suggestion);
            },
            onDismiss
        });
        
        this.showBanner(banner);
    }
    
    /**
     * Create conflict resolution modal
     */
    createConflictModal(config) {
        const modal = document.createElement('div');
        modal.className = `${this.config.cssPrefix}-modal ${this.config.cssPrefix}-${config.type}`;
        
        modal.innerHTML = `
            <div class="${this.config.cssPrefix}-modal-backdrop" role="dialog" aria-modal="true">
                <div class="${this.config.cssPrefix}-modal-content">
                    <div class="${this.config.cssPrefix}-modal-header">
                        <div class="${this.config.cssPrefix}-modal-icon">${config.icon}</div>
                        <h3 class="${this.config.cssPrefix}-modal-title">${config.title}</h3>
                        <button class="${this.config.cssPrefix}-modal-close" aria-label="Close">×</button>
                    </div>
                    
                    <div class="${this.config.cssPrefix}-modal-body">
                        <p class="${this.config.cssPrefix}-conflict-message">${config.message}</p>
                        
                        ${this.config.showTimeline ? this.createTimelineHTML(config.conflict) : ''}
                        
                        <div class="${this.config.cssPrefix}-suggestions">
                            <h4>Suggested Solutions:</h4>
                            ${this.createSuggestionsHTML(config.suggestions)}
                        </div>
                    </div>
                    
                    <div class="${this.config.cssPrefix}-modal-footer">
                        <button class="${this.config.cssPrefix}-btn ${this.config.cssPrefix}-btn-secondary dismiss-btn">
                            Ignore for Now
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Set up event listeners
        this.setupModalEventListeners(modal, config);
        
        return modal;
    }
    
    /**
     * Create conflict notification banner (for minor conflicts)
     */
    createConflictBanner(config) {
        const banner = document.createElement('div');
        banner.className = `${this.config.cssPrefix}-banner ${this.config.cssPrefix}-minor`;
        
        const topSuggestion = config.suggestions[0];
        
        banner.innerHTML = `
            <div class="${this.config.cssPrefix}-banner-content">
                <div class="${this.config.cssPrefix}-banner-icon">⏰</div>
                <div class="${this.config.cssPrefix}-banner-text">
                    <div class="${this.config.cssPrefix}-banner-title">
                        ${config.conflict.prayerName} prayer timing adjustment suggested
                    </div>
                    <div class="${this.config.cssPrefix}-banner-message">
                        ${topSuggestion ? topSuggestion.displayText : 'Schedule optimization available'}
                    </div>
                </div>
                <div class="${this.config.cssPrefix}-banner-actions">
                    ${topSuggestion ? `
                        <button class="${this.config.cssPrefix}-btn ${this.config.cssPrefix}-btn-primary quick-resolve">
                            ${this.getSuggestionActionText(topSuggestion)}
                        </button>
                    ` : ''}
                    <button class="${this.config.cssPrefix}-btn ${this.config.cssPrefix}-btn-secondary view-details">
                        View Options
                    </button>
                    <button class="${this.config.cssPrefix}-btn ${this.config.cssPrefix}-btn-close" aria-label="Dismiss">×</button>
                </div>
            </div>
        `;
        
        // Set up event listeners
        this.setupBannerEventListeners(banner, config);
        
        return banner;
    }
    
    /**
     * Create timeline visualization HTML
     */
    createTimelineHTML(conflict) {
        const prayerWindow = conflict.prayerWindow;
        const events = conflict.conflictingEvents;
        
        const startTime = new Date(prayerWindow.startTime);
        const endTime = new Date(prayerWindow.endTime);
        const totalMinutes = (endTime - startTime) / (1000 * 60);
        
        let timelineHTML = `
            <div class="${this.config.cssPrefix}-timeline-container">
                <h5>Prayer Window Timeline</h5>
                <div class="${this.config.cssPrefix}-timeline">
                    <div class="${this.config.cssPrefix}-timeline-track">
        `;
        
        // Add prayer window background
        timelineHTML += `
            <div class="${this.config.cssPrefix}-timeline-prayer" 
                 style="left: 0%; width: 100%;" 
                 title="${conflict.prayerName} Prayer Window">
                <span>${conflict.prayerName}</span>
            </div>
        `;
        
        // Add conflicting events
        events.forEach((event, index) => {
            const eventStart = new Date(event.start);
            const eventEnd = new Date(event.end);
            
            // Calculate position and width as percentages
            const leftPercent = Math.max(0, (eventStart - startTime) / (1000 * 60) / totalMinutes * 100);
            const widthPercent = Math.min(100 - leftPercent, (eventEnd - eventStart) / (1000 * 60) / totalMinutes * 100);
            
            timelineHTML += `
                <div class="${this.config.cssPrefix}-timeline-event" 
                     style="left: ${leftPercent}%; width: ${widthPercent}%;"
                     title="${event.subject}">
                    <span>${event.subject}</span>
                </div>
            `;
        });
        
        timelineHTML += `
                    </div>
                    <div class="${this.config.cssPrefix}-timeline-labels">
                        <span class="${this.config.cssPrefix}-timeline-start">
                            ${startTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                        <span class="${this.config.cssPrefix}-timeline-end">
                            ${endTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                    </div>
                </div>
            </div>
        `;
        
        return timelineHTML;
    }
    
    /**
     * Create suggestions list HTML
     */
    createSuggestionsHTML(suggestions) {
        if (!suggestions || suggestions.length === 0) {
            return '<p class="no-suggestions">No suggestions available.</p>';
        }
        
        return suggestions.map((suggestion, index) => `
            <div class="${this.config.cssPrefix}-suggestion" data-suggestion-id="${suggestion.id}">
                <div class="${this.config.cssPrefix}-suggestion-content">
                    <div class="${this.config.cssPrefix}-suggestion-icon">
                        ${this.getSuggestionIcon(suggestion.type)}
                    </div>
                    <div class="${this.config.cssPrefix}-suggestion-text">
                        <div class="${this.config.cssPrefix}-suggestion-title">
                            ${suggestion.displayText}
                        </div>
                        <div class="${this.config.cssPrefix}-suggestion-reason">
                            ${suggestion.reasoning.rationale}
                        </div>
                        ${suggestion.reasoning.preservesOnTime ? 
                            `<div class="${this.config.cssPrefix}-suggestion-badge">On Time</div>` : 
                            ''
                        }
                    </div>
                    <div class="${this.config.cssPrefix}-suggestion-action">
                        <button class="${this.config.cssPrefix}-btn ${this.config.cssPrefix}-btn-primary suggestion-accept" 
                                data-suggestion="${suggestion.id}">
                            ${this.getSuggestionActionText(suggestion)}
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    /**
     * Set up event listeners for modal
     */
    setupModalEventListeners(modal, config) {
        // Close button
        const closeBtn = modal.querySelector(`.${this.config.cssPrefix}-modal-close`);
        closeBtn?.addEventListener('click', () => {
            this.dismissCurrentConflict();
            config.onDismiss();
        });
        
        // Dismiss button
        const dismissBtn = modal.querySelector('.dismiss-btn');
        dismissBtn?.addEventListener('click', () => {
            this.dismissCurrentConflict();
            config.onDismiss();
        });
        
        // Suggestion accept buttons
        const acceptButtons = modal.querySelectorAll('.suggestion-accept');
        acceptButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const suggestionId = btn.dataset.suggestion;
                const suggestion = config.suggestions.find(s => s.id === suggestionId);
                if (suggestion) {
                    this.dismissCurrentConflict();
                    config.onResolve(suggestion);
                }
            });
        });
        
        // Backdrop click to close
        const backdrop = modal.querySelector(`.${this.config.cssPrefix}-modal-backdrop`);
        backdrop?.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                this.dismissCurrentConflict();
                config.onDismiss();
            }
        });
        
        // Escape key to close
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.dismissCurrentConflict();
                config.onDismiss();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }
    
    /**
     * Set up event listeners for banner
     */
    setupBannerEventListeners(banner, config) {
        // Quick resolve button
        const quickResolveBtn = banner.querySelector('.quick-resolve');
        quickResolveBtn?.addEventListener('click', () => {
            const topSuggestion = config.suggestions[0];
            if (topSuggestion) {
                config.onQuickResolve(topSuggestion);
            }
        });
        
        // View details button
        const viewDetailsBtn = banner.querySelector('.view-details');
        viewDetailsBtn?.addEventListener('click', config.onViewDetails);
        
        // Close button
        const closeBtn = banner.querySelector(`.${this.config.cssPrefix}-btn-close`);
        closeBtn?.addEventListener('click', () => {
            this.dismissCurrentConflict();
            config.onDismiss();
        });
    }
    
    /**
     * Show modal with animation
     */
    showModal(modal) {
        this.ensureStyles();
        document.body.appendChild(modal);
        
        // Store reference
        this.activeModal = modal;
        
        // Trigger animation
        requestAnimationFrame(() => {
            modal.classList.add(`${this.config.cssPrefix}-visible`);
        });
        
        // Focus management
        const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        firstFocusable?.focus();
        
        this.log('Conflict modal shown');
    }
    
    /**
     * Show banner with animation
     */
    showBanner(banner) {
        this.ensureStyles();
        document.body.insertBefore(banner, document.body.firstChild);
        
        // Store reference
        this.activeModal = banner;
        
        // Trigger animation
        requestAnimationFrame(() => {
            banner.classList.add(`${this.config.cssPrefix}-visible`);
        });
        
        // Adjust body padding
        this.adjustBodyPadding(true, banner.offsetHeight);
        
        this.log('Conflict banner shown');
    }
    
    /**
     * Dismiss current conflict UI
     */
    dismissCurrentConflict() {
        if (!this.activeModal) return;
        
        // Clear auto-dismiss timer
        if (this.autoDismissTimer) {
            clearTimeout(this.autoDismissTimer);
            this.autoDismissTimer = null;
        }
        
        // Animate out
        this.activeModal.classList.remove(`${this.config.cssPrefix}-visible`);
        
        // Remove from DOM after animation
        setTimeout(() => {
            if (this.activeModal && this.activeModal.parentNode) {
                this.activeModal.parentNode.removeChild(this.activeModal);
            }
            this.adjustBodyPadding(false);
            this.activeModal = null;
        }, this.config.animationDuration);
        
        this.currentConflict = null;
        this.currentSuggestions = null;
        
        this.log('Current conflict dismissed');
    }
    
    /**
     * Generate conflict message text
     */
    generateConflictMessage(conflict) {
        const eventCount = conflict.conflictingEvents.length;
        const eventText = eventCount === 1 ? 'meeting' : 'meetings';
        const eventNames = conflict.conflictingEvents
            .slice(0, 2)
            .map(e => `"${e.subject}"`)
            .join(' and ');
        
        switch (conflict.analysis.conflictSeverity) {
            case ConflictSeverity.COMPLETE:
                return `Your ${conflict.prayerName} prayer time is completely blocked by ${eventCount} ${eventText}${eventCount <= 2 ? `: ${eventNames}` : ''}. Choose an alternative time below.`;
                
            case ConflictSeverity.PARTIAL:
                return `Your ${conflict.prayerName} prayer time has limited availability due to ${eventCount} ${eventText}. We've found some good alternatives for you.`;
                
            case ConflictSeverity.MINOR:
                return `Your ${conflict.prayerName} prayer time has minor scheduling conflicts with ${eventCount} ${eventText}. Small adjustments can optimize your schedule.`;
                
            default:
                return `Your ${conflict.prayerName} prayer time has scheduling conflicts that need resolution.`;
        }
    }
    
    /**
     * Get icon for suggestion type
     */
    getSuggestionIcon(type) {
        const icons = {
            [SuggestionTypes.PRAY_BEFORE]: '⏰',
            [SuggestionTypes.PRAY_AFTER]: '⏰',
            [SuggestionTypes.PRAY_EARLIEST]: '🌅',
            [SuggestionTypes.PRAY_BETWEEN]: '⚡',
            [SuggestionTypes.PRAY_LATEST]: '🌆',
            [SuggestionTypes.COMBINE_PRAYERS]: '🧭'
        };
        return icons[type] || '📅';
    }
    
    /**
     * Get action text for suggestion
     */
    getSuggestionActionText(suggestion) {
        const actionTexts = {
            [SuggestionTypes.PRAY_BEFORE]: 'Pray Before',
            [SuggestionTypes.PRAY_AFTER]: 'Pray After',
            [SuggestionTypes.PRAY_EARLIEST]: 'Pray Early',
            [SuggestionTypes.PRAY_BETWEEN]: 'Use This Time',
            [SuggestionTypes.PRAY_LATEST]: 'Pray Later',
            [SuggestionTypes.COMBINE_PRAYERS]: 'Combine Prayers'
        };
        return actionTexts[suggestion.type] || 'Accept';
    }
    
    /**
     * Adjust body padding for banners
     */
    adjustBodyPadding(add, height = 0) {
        const body = document.body;
        body.style.paddingTop = add ? `${height}px` : '';
    }
    
    /**
     * Ensure CSS styles are added
     */
    ensureStyles() {
        const styleId = `${this.config.cssPrefix}-styles`;
        if (document.getElementById(styleId)) return;
        
        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = this.getCSS();
        document.head.appendChild(styles);
    }
    
    /**
     * Get CSS styles for conflict resolution UI
     */
    getCSS() {
        const prefix = this.config.cssPrefix;
        return `
            /* Modal Styles */
            .${prefix}-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 10000;
                opacity: 0;
                transform: scale(0.9);
                transition: all ${this.config.animationDuration}ms ease;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .${prefix}-modal.${prefix}-visible {
                opacity: 1;
                transform: scale(1);
            }
            
            .${prefix}-modal-backdrop {
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            
            .${prefix}-modal-content {
                background: white;
                border-radius: 12px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
                max-width: 600px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
            }
            
            .${prefix}-modal-header {
                display: flex;
                align-items: center;
                padding: 24px 24px 16px;
                border-bottom: 1px solid #f0f0f0;
            }
            
            .${prefix}-modal-icon {
                font-size: 24px;
                margin-right: 12px;
            }
            
            .${prefix}-modal-title {
                flex: 1;
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: #333;
            }
            
            .${prefix}-modal-close {
                background: none;
                border: none;
                font-size: 24px;
                color: #999;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
            }
            
            .${prefix}-modal-close:hover {
                background: #f5f5f5;
                color: #333;
            }
            
            .${prefix}-modal-body {
                padding: 24px;
            }
            
            .${prefix}-conflict-message {
                font-size: 16px;
                line-height: 1.5;
                color: #666;
                margin: 0 0 24px 0;
            }
            
            .${prefix}-modal-footer {
                padding: 16px 24px 24px;
                display: flex;
                justify-content: flex-end;
                gap: 12px;
            }
            
            /* Banner Styles */
            .${prefix}-banner {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 9999;
                background: linear-gradient(135deg, #fff8dc 0%, #f0f8ff 100%);
                border-bottom: 1px solid #ddd;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                transform: translateY(-100%);
                transition: transform ${this.config.animationDuration}ms ease;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .${prefix}-banner.${prefix}-visible {
                transform: translateY(0);
            }
            
            .${prefix}-banner-content {
                display: flex;
                align-items: center;
                max-width: 1200px;
                margin: 0 auto;
                padding: 12px 20px;
                gap: 12px;
            }
            
            .${prefix}-banner-icon {
                font-size: 20px;
                flex-shrink: 0;
            }
            
            .${prefix}-banner-text {
                flex: 1;
                min-width: 0;
            }
            
            .${prefix}-banner-title {
                font-weight: 600;
                font-size: 14px;
                color: #333;
                margin-bottom: 2px;
            }
            
            .${prefix}-banner-message {
                font-size: 13px;
                color: #666;
                line-height: 1.3;
            }
            
            .${prefix}-banner-actions {
                display: flex;
                gap: 8px;
                flex-shrink: 0;
            }
            
            /* Timeline Styles */
            .${prefix}-timeline-container {
                margin: 24px 0;
            }
            
            .${prefix}-timeline-container h5 {
                margin: 0 0 12px 0;
                font-size: 14px;
                font-weight: 600;
                color: #333;
            }
            
            .${prefix}-timeline {
                position: relative;
                height: 60px;
                background: #f8f8f8;
                border-radius: 8px;
                overflow: hidden;
            }
            
            .${prefix}-timeline-track {
                position: relative;
                width: 100%;
                height: 100%;
            }
            
            .${prefix}-timeline-prayer {
                position: absolute;
                height: 100%;
                background: rgba(0, 106, 78, 0.1);
                border: 2px solid #006A4E;
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #006A4E;
                font-weight: 600;
                font-size: 12px;
            }
            
            .${prefix}-timeline-event {
                position: absolute;
                height: 70%;
                top: 15%;
                background: #dc2626;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 500;
                font-size: 11px;
                text-overflow: ellipsis;
                overflow: hidden;
                white-space: nowrap;
                padding: 0 8px;
            }
            
            .${prefix}-timeline-labels {
                display: flex;
                justify-content: space-between;
                margin-top: 8px;
                font-size: 12px;
                color: #666;
            }
            
            /* Suggestions Styles */
            .${prefix}-suggestions h4 {
                margin: 0 0 16px 0;
                font-size: 16px;
                font-weight: 600;
                color: #333;
            }
            
            .${prefix}-suggestion {
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                margin-bottom: 12px;
                transition: all 200ms ease;
            }
            
            .${prefix}-suggestion:hover {
                border-color: #006A4E;
                box-shadow: 0 2px 8px rgba(0, 106, 78, 0.1);
            }
            
            .${prefix}-suggestion-content {
                display: flex;
                align-items: center;
                padding: 16px;
                gap: 12px;
            }
            
            .${prefix}-suggestion-icon {
                font-size: 18px;
                flex-shrink: 0;
            }
            
            .${prefix}-suggestion-text {
                flex: 1;
                min-width: 0;
            }
            
            .${prefix}-suggestion-title {
                font-weight: 600;
                font-size: 14px;
                color: #333;
                margin-bottom: 4px;
            }
            
            .${prefix}-suggestion-reason {
                font-size: 13px;
                color: #666;
                line-height: 1.3;
            }
            
            .${prefix}-suggestion-badge {
                display: inline-block;
                background: #16a34a;
                color: white;
                font-size: 11px;
                font-weight: 500;
                padding: 2px 6px;
                border-radius: 4px;
                margin-top: 4px;
            }
            
            .${prefix}-suggestion-action {
                flex-shrink: 0;
            }
            
            /* Button Styles */
            .${prefix}-btn {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 200ms ease;
                white-space: nowrap;
            }
            
            .${prefix}-btn-primary {
                background: #006A4E;
                color: white;
            }
            
            .${prefix}-btn-primary:hover {
                background: #005a42;
                transform: translateY(-1px);
            }
            
            .${prefix}-btn-secondary {
                background: #f5f5f5;
                color: #666;
                border: 1px solid #ddd;
            }
            
            .${prefix}-btn-secondary:hover {
                background: #eee;
                color: #333;
            }
            
            .${prefix}-btn-close {
                background: none;
                color: #999;
                padding: 4px 8px;
                font-size: 16px;
                line-height: 1;
            }
            
            .${prefix}-btn-close:hover {
                color: #333;
                background: #f0f0f0;
            }
            
            /* Severity-specific styles */
            .${prefix}-complete .${prefix}-modal-content {
                border-top: 4px solid #dc2626;
            }
            
            .${prefix}-partial .${prefix}-modal-content {
                border-top: 4px solid #f59e0b;
            }
            
            .${prefix}-minor {
                background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
                border-bottom-color: #0ea5e9;
            }
            
            /* Mobile responsive */
            @media (max-width: 768px) {
                .${prefix}-modal-content {
                    margin: 10px;
                    max-height: calc(100vh - 20px);
                }
                
                .${prefix}-banner-content {
                    padding: 10px 16px;
                    gap: 8px;
                }
                
                .${prefix}-banner-actions {
                    flex-direction: column;
                    gap: 4px;
                }
                
                .${prefix}-suggestion-content {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 8px;
                }
                
                .${prefix}-suggestion-action {
                    width: 100%;
                }
                
                .${prefix}-btn {
                    padding: 6px 12px;
                    font-size: 12px;
                }
            }
            
            /* Accessibility */
            @media (prefers-reduced-motion: reduce) {
                .${prefix}-modal,
                .${prefix}-banner {
                    transition: none;
                }
            }
        `;
    }
    
    /**
     * Check if there's currently a conflict shown
     */
    hasActiveConflict() {
        return this.activeModal !== null;
    }
    
    /**
     * Development logging
     */
    log(...args) {
        if (this.config.enableLogging) {
            console.log('[ConflictResolutionUI]', ...args);
        }
    }
}