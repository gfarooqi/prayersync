/**
 * LocationPromptUI - Smart location change prompts
 * 
 * Creates professional top banner notifications for location changes
 * with accept/dismiss functionality and seamless UX.
 */

export class LocationPromptUI {
    constructor(options = {}) {
        this.config = {
            // Animation duration in milliseconds
            animationDuration: options.animationDuration || 300,
            // Auto-dismiss timeout (set to 0 to disable)
            autoDismissTimeout: options.autoDismissTimeout || 30000, // 30 seconds
            // CSS class prefix for custom styling
            cssPrefix: options.cssPrefix || 'location-prompt',
            // Enable debug logging
            enableLogging: options.enableLogging !== false
        };
        
        this.currentPrompt = null;
        this.autoDismissTimer = null;
        
        this.log('LocationPromptUI initialized');
    }
    
    /**
     * Show location change prompt
     * @param {Object} locationChangeData - {previousLocation, newLocation, distance}
     * @param {Function} onAccept - Callback when user accepts change
     * @param {Function} onDismiss - Callback when user dismisses change
     */
    showLocationChangePrompt(locationChangeData, onAccept, onDismiss) {
        // Dismiss any existing prompt first
        this.dismissCurrentPrompt();
        
        const { previousLocation, newLocation, distance } = locationChangeData;
        
        this.log('Showing location change prompt', locationChangeData);
        
        // Create prompt banner
        const promptBanner = this.createPromptBanner({
            title: `You're now in ${newLocation.city}`,
            message: `${distance.toFixed(0)}km from ${previousLocation.city}. Update prayer times?`,
            primaryAction: {
                text: 'Update Prayer Times',
                icon: '📍',
                callback: () => {
                    this.log('User accepted location change');
                    this.dismissCurrentPrompt();
                    onAccept(newLocation);
                }
            },
            secondaryAction: {
                text: 'Keep Current',
                callback: () => {
                    this.log('User dismissed location change');
                    this.dismissCurrentPrompt();
                    onDismiss();
                }
            },
            icon: '✈️',
            type: 'location-change'
        });
        
        // Show the banner
        this.showBanner(promptBanner);
        
        // Set up auto-dismiss
        if (this.config.autoDismissTimeout > 0) {
            this.autoDismissTimer = setTimeout(() => {
                this.log('Auto-dismissing location prompt');
                this.dismissCurrentPrompt();
                onDismiss();
            }, this.config.autoDismissTimeout);
        }
    }
    
    /**
     * Show general location update notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, info)
     * @param {number} duration - Display duration (0 = no auto-dismiss)
     */
    showLocationNotification(message, type = 'info', duration = 5000) {
        this.log(`Showing location notification: ${type}`, { message });
        
        const notification = this.createPromptBanner({
            message: message,
            type: `location-notification ${type}`,
            icon: this.getNotificationIcon(type),
            autoDismiss: duration > 0,
            showCloseButton: true
        });
        
        this.showBanner(notification);
        
        if (duration > 0) {
            setTimeout(() => {
                this.dismissCurrentPrompt();
            }, duration);
        }
    }
    
    /**
     * Create prompt banner element
     * @param {Object} config - Banner configuration
     */
    createPromptBanner(config) {
        const banner = document.createElement('div');
        banner.className = `${this.config.cssPrefix}-banner ${this.config.cssPrefix}-${config.type}`;
        
        banner.innerHTML = `
            <div class="${this.config.cssPrefix}-content">
                <div class="${this.config.cssPrefix}-icon">
                    ${config.icon || '📱'}
                </div>
                <div class="${this.config.cssPrefix}-text">
                    ${config.title ? `<div class="${this.config.cssPrefix}-title">${config.title}</div>` : ''}
                    <div class="${this.config.cssPrefix}-message">${config.message}</div>
                </div>
                <div class="${this.config.cssPrefix}-actions">
                    ${config.primaryAction ? `
                        <button class="${this.config.cssPrefix}-btn ${this.config.cssPrefix}-btn-primary">
                            ${config.primaryAction.icon || ''} ${config.primaryAction.text}
                        </button>
                    ` : ''}
                    ${config.secondaryAction ? `
                        <button class="${this.config.cssPrefix}-btn ${this.config.cssPrefix}-btn-secondary">
                            ${config.secondaryAction.text}
                        </button>
                    ` : ''}
                    ${config.showCloseButton ? `
                        <button class="${this.config.cssPrefix}-btn ${this.config.cssPrefix}-btn-close" aria-label="Close">
                            ×
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        
        // Set up event listeners
        this.setupBannerEventListeners(banner, config);
        
        return banner;
    }
    
    /**
     * Set up event listeners for banner buttons
     */
    setupBannerEventListeners(banner, config) {
        // Primary action button
        const primaryBtn = banner.querySelector(`.${this.config.cssPrefix}-btn-primary`);
        if (primaryBtn && config.primaryAction?.callback) {
            primaryBtn.addEventListener('click', config.primaryAction.callback);
        }
        
        // Secondary action button
        const secondaryBtn = banner.querySelector(`.${this.config.cssPrefix}-btn-secondary`);
        if (secondaryBtn && config.secondaryAction?.callback) {
            secondaryBtn.addEventListener('click', config.secondaryAction.callback);
        }
        
        // Close button
        const closeBtn = banner.querySelector(`.${this.config.cssPrefix}-btn-close`);
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.dismissCurrentPrompt();
            });
        }
    }
    
    /**
     * Show banner with animation
     */
    showBanner(banner) {
        // Add CSS styles if not already added
        this.ensureStyles();
        
        // Insert at top of body
        document.body.insertBefore(banner, document.body.firstChild);
        
        // Store reference
        this.currentPrompt = banner;
        
        // Trigger animation
        requestAnimationFrame(() => {
            banner.classList.add(`${this.config.cssPrefix}-visible`);
        });
        
        // Add body padding to prevent content jump
        this.adjustBodyPadding(true);
    }
    
    /**
     * Dismiss current prompt with animation
     */
    dismissCurrentPrompt() {
        if (!this.currentPrompt) return;
        
        // Clear auto-dismiss timer
        if (this.autoDismissTimer) {
            clearTimeout(this.autoDismissTimer);
            this.autoDismissTimer = null;
        }
        
        // Animate out
        this.currentPrompt.classList.remove(`${this.config.cssPrefix}-visible`);
        
        // Remove from DOM after animation
        setTimeout(() => {
            if (this.currentPrompt && this.currentPrompt.parentNode) {
                this.currentPrompt.parentNode.removeChild(this.currentPrompt);
            }
            this.currentPrompt = null;
            this.adjustBodyPadding(false);
        }, this.config.animationDuration);
        
        this.log('Current prompt dismissed');
    }
    
    /**
     * Adjust body padding to accommodate banner
     */
    adjustBodyPadding(add) {
        const body = document.body;
        const bannerHeight = add && this.currentPrompt ? 
            this.currentPrompt.offsetHeight : 0;
        
        body.style.paddingTop = add ? `${bannerHeight}px` : '';
    }
    
    /**
     * Get appropriate icon for notification type
     */
    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }
    
    /**
     * Ensure CSS styles are added to document
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
     * Get CSS styles for prompt banners
     */
    getCSS() {
        const prefix = this.config.cssPrefix;
        return `
            .${prefix}-banner {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 9999;
                background: #fff;
                border-bottom: 1px solid #e0e0e0;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                transform: translateY(-100%);
                transition: transform ${this.config.animationDuration}ms ease-out;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .${prefix}-banner.${prefix}-visible {
                transform: translateY(0);
            }
            
            .${prefix}-content {
                display: flex;
                align-items: center;
                max-width: 1200px;
                margin: 0 auto;
                padding: 12px 20px;
                gap: 12px;
            }
            
            .${prefix}-icon {
                font-size: 20px;
                flex-shrink: 0;
            }
            
            .${prefix}-text {
                flex: 1;
                min-width: 0;
            }
            
            .${prefix}-title {
                font-weight: 600;
                font-size: 14px;
                color: #333;
                margin-bottom: 2px;
            }
            
            .${prefix}-message {
                font-size: 14px;
                color: #666;
                line-height: 1.4;
            }
            
            .${prefix}-actions {
                display: flex;
                gap: 8px;
                flex-shrink: 0;
            }
            
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
                font-size: 18px;
                line-height: 1;
            }
            
            .${prefix}-btn-close:hover {
                color: #333;
                background: #f0f0f0;
            }
            
            /* Notification type styles */
            .${prefix}-location-change {
                background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
                border-bottom-color: #006A4E;
            }
            
            .${prefix}-location-notification.success {
                background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
                border-bottom-color: #16a34a;
            }
            
            .${prefix}-location-notification.error {
                background: linear-gradient(135deg, #fef2f2 0%, #fef1f1 100%);
                border-bottom-color: #dc2626;
            }
            
            .${prefix}-location-notification.warning {
                background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
                border-bottom-color: #f59e0b;
            }
            
            .${prefix}-location-notification.info {
                background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
                border-bottom-color: #2563eb;
            }
            
            /* Mobile responsive */
            @media (max-width: 768px) {
                .${prefix}-content {
                    padding: 10px 16px;
                    gap: 8px;
                }
                
                .${prefix}-text {
                    margin-right: 8px;
                }
                
                .${prefix}-title,
                .${prefix}-message {
                    font-size: 13px;
                }
                
                .${prefix}-btn {
                    padding: 6px 12px;
                    font-size: 12px;
                }
                
                .${prefix}-actions {
                    flex-direction: column;
                    gap: 4px;
                }
            }
            
            /* Accessibility */
            @media (prefers-reduced-motion: reduce) {
                .${prefix}-banner {
                    transition: none;
                }
            }
        `;
    }
    
    /**
     * Check if there's currently a prompt shown
     */
    hasActivePrompt() {
        return this.currentPrompt !== null;
    }
    
    /**
     * Development logging
     */
    log(...args) {
        if (this.config.enableLogging) {
            console.log('[LocationPromptUI]', ...args);
        }
    }
}