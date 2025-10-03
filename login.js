/**
 * ============================================================================
 * LOGIN PAGE CONTROLLER
 * ============================================================================
 * This module handles the login page using OOP principles.
 *
 * Classes:
 * - LoginUIController: Manages UI state and interactions
 * - LoginPageApp: Main application controller that coordinates everything
 * ============================================================================
 */

import { AuthService } from './services.js';

/**
 * ============================================================================
 * LOGIN UI CONTROLLER CLASS
 * ============================================================================
 * Manages all UI interactions for the login page.
 * Separates UI logic from business logic.
 *
 * Responsibilities:
 * - Update status messages
 * - Enable/disable form inputs
 * - Get form values
 * - Clear form inputs
 */
class LoginUIController {
    /**
     * CSS classes for different status types
     */
    static STATUS_CLASSES = {
        info: 'status-info',
        success: 'status-success',
        error: 'status-error'
    };

    /**
     * DOM element references
     */
    #statusDiv;
    #loginForm;
    #emailInput;
    #passwordInput;
    #submitButton;
    #logoutButton;

    /**
     * Constructor - initializes all DOM element references
     * Throws error if required elements are not found
     */
    constructor() {
        // Get references to all required DOM elements
        this.#statusDiv = document.getElementById('status');
        this.#loginForm = document.getElementById('loginForm');
        this.#emailInput = document.getElementById('loginEmail');
        this.#passwordInput = document.getElementById('loginPassword');
        this.#submitButton = document.getElementById('loginSubmit');
        this.#logoutButton = document.getElementById('logoutButton');

        // Validate that all elements exist
        if (!this.#statusDiv || !this.#loginForm || !this.#emailInput ||
            !this.#passwordInput || !this.#submitButton) {
            throw new Error('Required DOM elements not found');
        }
    }

    /**
     * Set status message with appropriate styling
     * @param {string} message - Status message to display
     * @param {string} type - Type of status: 'info', 'success', or 'error'
     */
    setStatus(message, type = 'info') {
        this.#statusDiv.textContent = message;

        // Remove all status classes
        Object.values(LoginUIController.STATUS_CLASSES).forEach(cssClass => {
            this.#statusDiv.classList.remove(cssClass);
        });

        // Add the appropriate status class
        const cssClass = LoginUIController.STATUS_CLASSES[type] || LoginUIController.STATUS_CLASSES.info;
        this.#statusDiv.classList.add(cssClass);
    }

    /**
     * Enable or disable form inputs
     * @param {boolean} enabled - True to enable, false to disable
     */
    setInputsEnabled(enabled) {
        this.#emailInput.disabled = !enabled;
        this.#passwordInput.disabled = !enabled;
        this.#submitButton.disabled = !enabled;

        // Update button text based on state
        this.#submitButton.textContent = enabled ? 'Anmelden' : 'Anmeldung laeuft...';
    }

    /**
     * Get email input value (trimmed)
     * @returns {string} Email value
     */
    getEmail() {
        return this.#emailInput.value.trim();
    }

    /**
     * Get password input value
     * @returns {string} Password value
     */
    getPassword() {
        return this.#passwordInput.value;
    }

    /**
     * Clear password input and focus it
     */
    clearPasswordAndFocus() {
        this.#passwordInput.value = '';
        this.#passwordInput.focus();
    }

    /**
     * Show or hide logout button
     * @param {boolean} visible - True to show, false to hide
     */
    setLogoutButtonVisible(visible) {
        if (this.#logoutButton) {
            this.#logoutButton.hidden = !visible;
        }
    }

    /**
     * Add event listener to login form submit
     * @param {Function} handler - Form submit handler
     */
    onLoginSubmit(handler) {
        this.#loginForm.addEventListener('submit', handler);
    }

    /**
     * Add event listener to logout button click
     * @param {Function} handler - Logout click handler
     */
    onLogoutClick(handler) {
        if (this.#logoutButton) {
            this.#logoutButton.addEventListener('click', handler);
        }
    }
}

/**
 * ============================================================================
 * LOGIN PAGE APPLICATION CLASS
 * ============================================================================
 * Main controller for the login page.
 * Coordinates between UI and authentication service.
 *
 * Responsibilities:
 * - Initialize the application
 * - Handle login flow
 * - Handle logout flow
 * - Monitor authentication state
 * - Manage redirects
 */
class LoginPageApp {
    /**
     * Service and controller instances
     */
    #authService;
    #uiController;

    /**
     * Constructor - initializes services and UI controller
     */
    constructor() {
        this.#authService = new AuthService();
        this.#uiController = new LoginUIController();
    }

    /**
     * Initialize the application
     * Sets up event listeners and auth state monitoring
     */
    async initialize() {
        // Ensure authentication persistence (keep user logged in)
        await this.#authService.ensurePersistence();

        // Set up event listeners
        this.#setupEventListeners();

        // Monitor authentication state changes
        this.#setupAuthStateMonitoring();
    }

    /**
     * Set up all event listeners
     * @private
     */
    #setupEventListeners() {
        // Handle login form submission
        this.#uiController.onLoginSubmit((event) => this.#handleLogin(event));

        // Handle logout button click
        this.#uiController.onLogoutClick(() => this.#handleLogout());
    }

    /**
     * Handle login form submission
     * @param {Event} event - Form submit event
     * @private
     */
    async #handleLogin(event) {
        // Prevent default form submission
        event.preventDefault();

        // Get form values
        const email = this.#uiController.getEmail();
        const password = this.#uiController.getPassword();

        // Validate inputs
        if (!email || !password) {
            this.#uiController.setStatus('Bitte E-Mail und Passwort eingeben.', 'error');
            return;
        }

        // Update UI to show loading state
        this.#uiController.setStatus('Anmeldung laeuft...', 'info');
        this.#uiController.setInputsEnabled(false);

        try {
            // Attempt to sign in
            await this.#authService.signIn(email, password);

            // Success - onAuthStateChanged will handle the redirect
            // No need to do anything here
        } catch (error) {
            // Login failed - show error message
            console.error('Login error:', error);

            const errorMessage = this.#authService.mapAuthError(error);
            this.#uiController.setStatus(errorMessage, 'error');

            // Clear password and re-enable form
            this.#uiController.clearPasswordAndFocus();
            this.#uiController.setInputsEnabled(true);
        }
    }

    /**
     * Handle logout button click
     * @private
     */
    async #handleLogout() {
        // Disable inputs during logout
        this.#uiController.setInputsEnabled(false);
        this.#uiController.setStatus('Melde ab...', 'info');

        try {
            // Sign out
            await this.#authService.signOut();

            // Show success message
            this.#uiController.setStatus('Abmeldung erfolgreich. Sie koennen sich erneut anmelden.', 'success');
            this.#uiController.clearPasswordAndFocus();
            this.#uiController.setInputsEnabled(true);
        } catch (error) {
            // Logout failed
            console.error('Logout error:', error);
            this.#uiController.setStatus(`Abmeldung fehlgeschlagen: ${error.message || error.code}`, 'error');
            this.#uiController.setInputsEnabled(true);
        }
    }

    /**
     * Set up authentication state monitoring
     * Redirects to target page when user is logged in
     * @private
     */
    #setupAuthStateMonitoring() {
        this.#authService.onAuthStateChanged((user) => {
            if (user) {
                // User is logged in
                this.#uiController.setStatus(`Angemeldet als ${user.email}. Weiterleitung...`, 'success');
                this.#uiController.setLogoutButtonVisible(true);
                this.#uiController.setInputsEnabled(false);

                // Determine redirect target
                const target = this.#resolveRedirectTarget();

                // Redirect after a short delay for better UX
                setTimeout(() => {
                    window.location.href = target;
                }, 800);
            } else {
                // User is not logged in
                this.#uiController.setStatus('Bitte melden Sie sich an.', 'info');
                this.#uiController.setLogoutButtonVisible(false);
                this.#uiController.setInputsEnabled(true);
            }
        });
    }

    /**
     * Determine where to redirect after successful login
     * Checks sessionStorage and URL params for redirect target
     * @returns {string} Redirect target URL
     * @private
     */
    #resolveRedirectTarget() {
        // First, check sessionStorage (set when user was redirected to login)
        const storedTarget = sessionStorage.getItem('redirectTo');
        if (storedTarget) {
            sessionStorage.removeItem('redirectTo');
            return storedTarget;
        }

        // Second, check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const queryTarget = urlParams.get('redirect');
        if (queryTarget) {
            return queryTarget;
        }

        // Default: redirect to index page
        return 'index.html';
    }
}

/**
 * ============================================================================
 * APPLICATION ENTRY POINT
 * ============================================================================
 * Create and initialize the application when the script loads
 */
const app = new LoginPageApp();
app.initialize().catch(error => {
    console.error('Failed to initialize login page:', error);
});
