/**
 * ================================================
 * GRIDS - Login Handler
 * ================================================
 *
 * Handles the login form UI interactions:
 * - Form submission
 * - Loading states
 * - Error/success messages
 * - Redirect after successful login
 *
 * Implement the actual event handlers and logic
 */

// ================================================
// Login Handler Class
// ================================================

class LoginHandler {
    constructor() {
        // UI Elements
        this.form = null;
        this.keyInput = null;
        this.loginBtn = null;
        this.errorDisplay = null;
        this.successDisplay = null;

        // State
        this.isLoading = false;

        //Initialize when DOM is ready
        this.initialize();
    }

    /**
     * Initialize login handler
     * Sets up event listeners and UI references
     */
    initialize() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupUI());
        } else {
            this.setupUI();
        }
    }

    /**
     * Setup UI elements and event listeners
     */
    setupUI() {
        // Get UI element references
        this.form = document.getElementById('loginForm');
        this.keyInput = document.getElementById('accessKey');
        this.loginBtn = document.getElementById('loginBtn');
        this.errorDisplay = document.getElementById('loginError');
        this.successDisplay = document.getElementById('loginSuccess');

        // Validate all elements exist
        if (!this.form || !this.keyInput || !this.loginBtn) {
            console.error('Required UI elements not found');
            return;
        }

        // Attach event listeners
        this.attachEventListeners();

        // Check for existing session
        this.checkExistingSession();
    }

    /**
     * Attach event listeners to UI elements
     */
    attachEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Input changes (clear errors on typing)
        this.keyInput.addEventListener('input', () => {
            this.clearMessages();
        });

        // Enter key in input field
        this.keyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.isLoading) {
                this.handleLogin();
            }
        });

        // Add paste event listener to handle pasted keys
        this.keyInput.addEventListener('paste', (e) => {
            // Allow paste but will be handled by form submit
            setTimeout(() => this.clearMessages(), 100);
        });
    }

    /**
     * Handle login process
     * Main authentication flow
     */
    async handleLogin() {
        // Validate input
        const rawKey = this.keyInput.value.trim();

        if (!rawKey) {
            this.showError('Please enter your access key');
            return;
        }

        // Set loading state
        this.setLoadingState(true);

        try {
            // Call authentication manager
            const result = await window.authManager.authenticate(rawKey);

            if (result.success) {
                // Handle successful login
                this.handleSuccess(result);
            } else {
                // Handle failed login
                this.showError(result.error || 'Authentication failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('An unexpected error occurred. Please try again.');
        } finally {
            // Reset loading state
            this.setLoadingState(false);
        }
    }

    /**
     * Handle successful authentication
     *
     * @param {Object} result - Authentication result
     */
    handleSuccess(result) {
        // Show success message
        const message = result.isNewUser
            ? 'Account created successfully! Redirecting...'
            : 'Welcome back! Redirecting...';

        this.showSuccess(message);

        // Store the user data
        // This is already handled by authManager

        // Redirect to home page immediately
        window.location.href = '/grids/home.html';
    }

    /**
     * Set loading state for UI
     *
     * @param {boolean} loading - Loading state
     */
    setLoadingState(loading) {
        this.isLoading = loading;

        // Disable/enable form elements
        this.keyInput.disabled = loading;
        this.loginBtn.disabled = loading;

        // Update button text
        const btnText = this.loginBtn.querySelector('.btn-text');
        const btnLoading = this.loginBtn.querySelector('.btn-loading');

        if (loading) {
            btnText.style.display = 'none';
            btnLoading.style.display = 'inline-flex';
        } else {
            btnText.style.display = 'inline';
            btnLoading.style.display = 'none';
        }
    }

    /**
     * Show error message
     *
     * @param {string} message - Error message to display
     */
    showError(message) {
        this.clearMessages();

        if (this.errorDisplay) {
            this.errorDisplay.textContent = message;
            this.errorDisplay.style.display = 'block';

            // Add animation
            this.errorDisplay.style.animation = 'none';
            this.errorDisplay.offsetHeight; // Trigger reflow
            this.errorDisplay.style.animation = 'shake 0.5s ease';
        }
    }

    /**
     * Show success message
     *
     * @param {string} message - Success message to display
     */
    showSuccess(message) {
        this.clearMessages();

        if (this.successDisplay) {
            this.successDisplay.textContent = message;
            this.successDisplay.style.display = 'block';
        }
    }

    /**
     * Clear all messages
     */
    clearMessages() {
        if (this.errorDisplay) {
            this.errorDisplay.style.display = 'none';
            this.errorDisplay.textContent = '';
        }

        if (this.successDisplay) {
            this.successDisplay.style.display = 'none';
            this.successDisplay.textContent = '';
        }
    }

    /**
     * Check for existing session
     * Auto-redirect if user is already logged in
     */
    async checkExistingSession() {
        // Check if user is already authenticated
        if (window.authManager && window.authManager.isAuthenticated()) {
            // Auto-redirect immediately
            window.location.href = '/grids/home.html';
        }
    }

    /**
     * Reset form to initial state
     */
    resetForm() {
        this.clearMessages();
        this.keyInput.value = '';
        this.setLoadingState(false);
    }
}

// ================================================
// Initialize Login Handler
// ================================================

// Create login handler instance when DOM is ready
let loginHandler;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loginHandler = new LoginHandler();
    });
} else {
    loginHandler = new LoginHandler();
}

// Export for potential use in other modules
if (typeof window !== 'undefined') {
    window.LoginHandler = LoginHandler;
    window.loginHandler = loginHandler;
}
