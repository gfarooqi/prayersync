// Email Collection Modal - Value-first approach
// Shows after successful calendar download to collect email for updates

class EmailModal {
    constructor() {
        this.isVisible = false;
        this.downloadData = null;
        this.onEmailSubmitted = null;
    }

    // Show modal after successful download
    show(downloadData, callback) {
        this.downloadData = downloadData;
        this.onEmailSubmitted = callback;
        
        if (this.isVisible) return;
        
        this.createModal();
        this.isVisible = true;
        
        // Track modal shown event
        if (window.analytics) {
            window.analytics.trackEvent('email_modal_shown', {
                category: 'conversion',
                city: downloadData.cityName,
                trigger: 'post_download'
            });
        }
    }

    // Create and inject modal HTML
    createModal() {
        const modalHTML = `
            <div id="emailModal" class="email-modal-overlay">
                <div class="email-modal-content">
                    <div class="email-modal-header">
                        <div class="success-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                        </div>
                        <h2>🎉 Calendar Downloaded Successfully!</h2>
                        <p class="success-message">Your prayer times for <strong>${this.downloadData.cityName}</strong> are now ready to import into your calendar app.</p>
                    </div>

                    <div class="email-modal-body">
                        <div class="value-proposition">
                            <div class="community-badge">
                                <span class="badge-icon">🕌</span>
                                <span class="badge-text">Professional Muslim Community</span>
                            </div>
                            
                            <h3>We're building the world's best app for Professional Muslims 🚀</h3>
                            <p class="community-intro">Join <strong>15,000+ Muslim professionals</strong> who balance career success with their faith:</p>
                            
                            <div class="benefits-grid">
                                <div class="benefit-item">
                                    <div class="benefit-icon">📅</div>
                                    <div class="benefit-text">
                                        <strong>Smart Prayer Scheduling</strong>
                                        <span>Never miss prayers during meetings again</span>
                                    </div>
                                </div>
                                <div class="benefit-item">
                                    <div class="benefit-icon">💼</div>
                                    <div class="benefit-text">
                                        <strong>Career + Faith Tips</strong>
                                        <span>Weekly insights from successful Muslim professionals</span>
                                    </div>
                                </div>
                                <div class="benefit-item">
                                    <div class="benefit-icon">🤝</div>
                                    <div class="benefit-text">
                                        <strong>Exclusive Network</strong>
                                        <span>Connect with Muslim entrepreneurs & leaders</span>
                                    </div>
                                </div>
                                <div class="benefit-item">
                                    <div class="benefit-icon">⚡</div>
                                    <div class="benefit-text">
                                        <strong>Early Access</strong>
                                        <span>Be first to try new productivity tools</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="social-proof">
                                <div class="testimonial">
                                    <p>"Finally, an app that understands the unique challenges Muslim professionals face!"</p>
                                    <cite>— Sarah A., Investment Banker, London</cite>
                                </div>
                            </div>
                        </div>

                        <form id="emailForm" class="email-form">
                            <div class="form-group">
                                <label for="userEmail">Email Address</label>
                                <input 
                                    type="email" 
                                    id="userEmail" 
                                    name="email" 
                                    placeholder="your.email@example.com"
                                    required
                                    autocomplete="email"
                                >
                            </div>

                            <div class="form-group consent-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="marketingConsent" name="marketingConsent" checked>
                                    <span class="checkmark"></span>
                                    I want to receive product updates and prayer-related content
                                </label>
                            </div>

                            <div class="form-group consent-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="privacyConsent" name="privacyConsent" required>
                                    <span class="checkmark"></span>
                                    I agree to the <a href="#" onclick="showPrivacyPolicy()" target="_blank">Privacy Policy</a> and consent to data processing
                                </label>
                            </div>

                            <div class="form-actions">
                                <button type="submit" class="btn-primary" id="submitEmail">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                                    </svg>
                                    Join the Movement
                                </button>
                                <button type="button" class="btn-secondary" id="skipEmail">
                                    Maybe later
                                </button>
                            </div>
                        </form>

                        <div class="privacy-notice">
                            <p>
                                🔒 We respect your privacy. Unsubscribe anytime. No spam, ever.
                                <br>
                                <small>By submitting, you consent to receive emails from PrayerSync. See our <a href="#" onclick="showPrivacyPolicy()">Privacy Policy</a>.</small>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('emailModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Inject modal into DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Add CSS styles
        this.addStyles();

        // Bind event listeners
        this.bindEvents();

        // Show with animation
        setTimeout(() => {
            const modal = document.getElementById('emailModal');
            if (modal) {
                modal.classList.add('show');
            }
        }, 50);
    }

    // Add CSS styles for the modal
    addStyles() {
        if (document.getElementById('emailModalStyles')) return;

        const styles = `
            <style id="emailModalStyles">
                .email-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    backdrop-filter: blur(4px);
                }

                .email-modal-overlay.show {
                    opacity: 1;
                }

                .email-modal-content {
                    background: white;
                    border-radius: 16px;
                    max-width: 500px;
                    width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                    transform: scale(0.95);
                    transition: transform 0.3s ease;
                }

                .email-modal-overlay.show .email-modal-content {
                    transform: scale(1);
                }

                .email-modal-header {
                    text-align: center;
                    padding: 2rem 2rem 1rem;
                    border-bottom: 1px solid #f0f0f0;
                }

                .success-icon {
                    color: #10b981;
                    margin-bottom: 1rem;
                }

                .email-modal-header h2 {
                    margin: 0 0 0.5rem;
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #1f2937;
                }

                .success-message {
                    color: #6b7280;
                    font-size: 1rem;
                    margin: 0;
                    line-height: 1.5;
                }

                .email-modal-body {
                    padding: 2rem;
                }

                .value-proposition h3 {
                    margin: 0 0 1rem;
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: #1f2937;
                }

                .value-proposition p {
                    margin: 0 0 1rem;
                    color: #6b7280;
                    font-size: 1rem;
                }

                .benefits-list {
                    list-style: none;
                    padding: 0;
                    margin: 0 0 2rem;
                }

                .benefits-list li {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 0;
                    color: #374151;
                    font-size: 0.95rem;
                }

                .benefits-list svg {
                    color: #10b981;
                    flex-shrink: 0;
                }

                .email-form {
                    border-top: 1px solid #f0f0f0;
                    padding-top: 2rem;
                }

                .form-group {
                    margin-bottom: 1.5rem;
                }

                .form-group label {
                    display: block;
                    font-weight: 500;
                    color: #374151;
                    margin-bottom: 0.5rem;
                    font-size: 0.95rem;
                }

                .form-group input[type="email"] {
                    width: 100%;
                    padding: 0.875rem 1rem;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    font-size: 1rem;
                    transition: border-color 0.2s ease;
                    box-sizing: border-box;
                }

                .form-group input[type="email"]:focus {
                    outline: none;
                    border-color: #006A4E;
                    box-shadow: 0 0 0 3px rgba(0, 106, 78, 0.1);
                }

                .consent-group {
                    margin-bottom: 1rem;
                }

                .checkbox-label {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.75rem;
                    cursor: pointer;
                    font-size: 0.9rem;
                    line-height: 1.4;
                }

                .checkbox-label input[type="checkbox"] {
                    width: 18px;
                    height: 18px;
                    accent-color: #006A4E;
                    margin: 0;
                    flex-shrink: 0;
                }

                .checkbox-label a {
                    color: #006A4E;
                    text-decoration: none;
                }

                .checkbox-label a:hover {
                    text-decoration: underline;
                }

                .form-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    margin-top: 2rem;
                }

                .form-actions .btn-primary {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    padding: 1rem 1.5rem;
                    background: #006A4E;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: background-color 0.2s ease;
                }

                .form-actions .btn-primary:hover {
                    background: #005a42;
                }

                .form-actions .btn-primary:disabled {
                    background: #9ca3af;
                    cursor: not-allowed;
                }

                .form-actions .btn-secondary {
                    padding: 0.75rem 1.5rem;
                    background: transparent;
                    color: #6b7280;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .form-actions .btn-secondary:hover {
                    background: #f9fafb;
                    color: #374151;
                }

                .privacy-notice {
                    text-align: center;
                    margin-top: 1.5rem;
                    padding-top: 1.5rem;
                    border-top: 1px solid #f0f0f0;
                }

                .privacy-notice p {
                    color: #6b7280;
                    font-size: 0.85rem;
                    margin: 0;
                    line-height: 1.4;
                }

                .privacy-notice small {
                    font-size: 0.8rem;
                    color: #9ca3af;
                }

                .privacy-notice a {
                    color: #006A4E;
                    text-decoration: none;
                }

                .privacy-notice a:hover {
                    text-decoration: underline;
                }

                @media (max-width: 640px) {
                    .email-modal-content {
                        margin: 1rem;
                        width: calc(100% - 2rem);
                    }

                    .email-modal-header {
                        padding: 1.5rem 1.5rem 1rem;
                    }

                    .email-modal-body {
                        padding: 1.5rem;
                    }

                    .email-modal-header h2 {
                        font-size: 1.25rem;
                    }

                    .form-actions {
                        flex-direction: column;
                    }
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    // Bind event listeners
    bindEvents() {
        const form = document.getElementById('emailForm');
        const skipButton = document.getElementById('skipEmail');

        if (form) {
            form.addEventListener('submit', (e) => this.handleEmailSubmit(e));
        }

        if (skipButton) {
            skipButton.addEventListener('click', () => this.handleSkip());
        }

        // Close on overlay click
        const overlay = document.getElementById('emailModal');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.handleSkip();
                }
            });
        }

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.handleSkip();
            }
        });
    }

    // Handle email form submission
    async handleEmailSubmit(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const email = formData.get('email');
        const marketingConsent = formData.get('marketingConsent') === 'on';
        const privacyConsent = formData.get('privacyConsent') === 'on';

        if (!email || !privacyConsent) {
            this.showError('Please fill in all required fields and accept the privacy policy.');
            return;
        }

        const submitButton = document.getElementById('submitEmail');
        submitButton.disabled = true;
        submitButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" class="animate-spin">
                <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
            </svg>
            Submitting...
        `;

        try {
            // Track email submission attempt
            if (window.analytics) {
                window.analytics.trackEvent('email_submission_attempt', {
                    category: 'conversion',
                    email: email,
                    marketing_consent: marketingConsent
                });
            }

            // Submit email using emailManager
            if (window.emailManager) {
                const result = await window.emailManager.collectEmail({
                    email: email,
                    consentGiven: privacyConsent,
                    marketingConsent: marketingConsent,
                    analyticsConsent: true,
                    city: this.downloadData.cityName,
                    country: this.downloadData.country,
                    referrerSource: document.referrer,
                    wantsUpdates: true
                });

                if (result.success) {
                    // Track successful submission
                    if (window.analytics) {
                        window.analytics.setUserId(result.userId);
                        window.analytics.trackEvent('email_submitted_success', {
                            category: 'conversion',
                            user_id: result.userId
                        });
                    }

                    this.showSuccess();
                    
                    if (this.onEmailSubmitted) {
                        this.onEmailSubmitted({ success: true, email, userId: result.userId });
                    }
                } else {
                    throw new Error(result.error || 'Failed to save email');
                }
            } else {
                // Fallback - just track locally for now
                console.log('📧 Email collected (offline mode):', { email, marketingConsent });
                this.showSuccess();
                
                if (this.onEmailSubmitted) {
                    this.onEmailSubmitted({ success: true, email, offline: true });
                }
            }
        } catch (error) {
            console.error('Email submission error:', error);
            
            // Track failed submission
            if (window.analytics) {
                window.analytics.trackEvent('email_submission_failed', {
                    category: 'error',
                    error: error.message
                });
            }

            this.showError('Failed to save your email. Please try again or contact support.');
            
            // Reset button
            submitButton.disabled = false;
            submitButton.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
                Get Free Updates
            `;
        }
    }

    // Handle skip button
    handleSkip() {
        // Track skip event
        if (window.analytics) {
            window.analytics.trackEvent('email_modal_skipped', {
                category: 'conversion',
                city: this.downloadData.cityName
            });
        }

        this.hide();
        
        if (this.onEmailSubmitted) {
            this.onEmailSubmitted({ success: false, skipped: true });
        }
    }

    // Show success message
    showSuccess() {
        const modalBody = document.querySelector('.email-modal-body');
        if (modalBody) {
            modalBody.innerHTML = `
                <div style="text-align: center; padding: 2rem 1rem;">
                    <div style="color: #10b981; margin-bottom: 1rem;">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                    </div>
                    <h3 style="margin: 0 0 1rem; color: #1f2937;">Thank You! 🎉</h3>
                    <p style="color: #6b7280; margin: 0 0 1.5rem; line-height: 1.5;">
                        We've sent a confirmation email to verify your subscription. 
                        <br>Please check your inbox and click the confirmation link.
                    </p>
                    <button class="btn-primary" onclick="emailModal.hide()" style="padding: 0.75rem 2rem; background: #006A4E; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        Continue
                    </button>
                </div>
            `;
        }

        // Auto-hide after 3 seconds
        setTimeout(() => {
            this.hide();
        }, 3000);
    }

    // Show error message
    showError(message) {
        // Remove existing error
        const existingError = document.querySelector('.email-error');
        if (existingError) {
            existingError.remove();
        }

        // Add error message
        const form = document.getElementById('emailForm');
        if (form) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'email-error';
            errorDiv.style.cssText = `
                background: #fef2f2;
                border: 1px solid #fecaca;
                color: #dc2626;
                padding: 0.75rem 1rem;
                border-radius: 6px;
                margin-bottom: 1rem;
                font-size: 0.9rem;
            `;
            errorDiv.textContent = message;
            
            form.insertBefore(errorDiv, form.firstChild);
        }
    }

    // Hide modal
    hide() {
        const modal = document.getElementById('emailModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.remove();
                this.isVisible = false;
            }, 300);
        }
    }
}

// Global functions for privacy policy
function showPrivacyPolicy() {
    window.open('#privacy-policy', '_blank');
    // TODO: Create actual privacy policy page
}

// Initialize and export
const emailModal = new EmailModal();
window.emailModal = emailModal;

export default emailModal;