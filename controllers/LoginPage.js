import { AuthService } from '../services/AuthService.js';
import { RedirectService } from '../services/RedirectService.js';
import { StatusBanner } from '../ui/StatusBanner.js';

// LoginPage coordinates the login form, status banner and redirect logic.
// The controller exposes an init method that wires every event listener in one place.
export class LoginPage {
    constructor({
        authService = new AuthService(),
        redirectService = new RedirectService(),
        statusElement = document.getElementById('status'),
        formElement = document.getElementById('loginForm'),
        emailInput = document.getElementById('loginEmail'),
        passwordInput = document.getElementById('loginPassword'),
        submitButton = document.getElementById('loginSubmit'),
        logoutButton = document.getElementById('logoutButton')
    } = {}) {
        this.authService = authService;
        this.redirectService = redirectService;
        this.status = new StatusBanner(statusElement);
        this.form = formElement;
        this.emailInput = emailInput;
        this.passwordInput = passwordInput;
        this.submitButton = submitButton;
        this.logoutButton = logoutButton;
    }

    async init() {
        this.registerEventHandlers();
        await this.authService.ensureLocalPersistence();
        this.authService.onAuthChange((user) => this.handleAuthStateChanged(user));
    }

    registerEventHandlers() {
        if (this.form) {
            this.form.addEventListener('submit', (event) => {
                event.preventDefault();
                this.handleSubmit();
            });
        }

        if (this.logoutButton) {
            this.logoutButton.addEventListener('click', () => this.handleLogout());
        }
    }

    async handleSubmit() {
        const email = this.emailInput?.value.trim();
        const password = this.passwordInput?.value || '';

        if (!email || !password) {
            this.status.show('Bitte E-Mail und Passwort eingeben.', 'error');
            return;
        }

        this.setInputsEnabled(false);
        this.status.show('Anmeldung laeuft...', 'info');

        try {
            await this.authService.login(email, password);
        } catch (error) {
            console.error('Login error:', error);
            this.status.show(this.mapAuthError(error), 'error');
            if (this.passwordInput) {
                this.passwordInput.value = '';
                this.passwordInput.focus();
            }
            this.setInputsEnabled(true);
        }
    }

    async handleLogout() {
        this.setInputsEnabled(false);
        this.status.show('Melde ab...', 'info');
        try {
            await this.authService.logout();
            this.status.show('Abmeldung erfolgreich. Sie koennen sich erneut anmelden.', 'success');
        } catch (error) {
            console.error('Logout error:', error);
            this.status.show('Abmeldung fehlgeschlagen: ' + (error.message || error.code), 'error');
        } finally {
            if (this.passwordInput) {
                this.passwordInput.value = '';
            }
            this.setInputsEnabled(true);
        }
    }

    handleAuthStateChanged(user) {
        if (user) {
            this.status.show(`Angemeldet als ${user.email}. Weiterleitung...`, 'success');
            this.toggleLogoutVisibility(true);
            this.setInputsEnabled(false);
            const target = this.redirectService.resolveTarget('index.html');
            window.setTimeout(() => {
                window.location.href = target;
            }, 800);
        } else {
            this.status.show('Bitte melden Sie sich an.', 'info');
            this.toggleLogoutVisibility(false);
            this.setInputsEnabled(true);
        }
    }

    setInputsEnabled(enabled) {
        if (this.emailInput) this.emailInput.disabled = !enabled;
        if (this.passwordInput) this.passwordInput.disabled = !enabled;
        if (this.submitButton) {
            this.submitButton.disabled = !enabled;
            this.submitButton.textContent = enabled ? 'Anmelden' : 'Anmeldung laeuft...';
        }
    }

    toggleLogoutVisibility(visible) {
        if (this.logoutButton) {
            this.logoutButton.hidden = !visible;
            this.logoutButton.disabled = !visible;
        }
    }

    mapAuthError(error) {
        switch (error?.code) {
            case 'auth/invalid-email':
                return 'Die E-Mail-Adresse ist ungueltig.';
            case 'auth/user-disabled':
                return 'Dieses Konto wurde deaktiviert. Bitte wenden Sie sich an den Administrator.';
            case 'auth/user-not-found':
                return 'Kein Konto mit dieser E-Mail-Adresse gefunden.';
            case 'auth/wrong-password':
                return 'Das Passwort ist falsch.';
            case 'auth/too-many-requests':
                return 'Zu viele fehlgeschlagene Versuche. Bitte warten Sie einen Moment.';
            default:
                return 'Anmeldung fehlgeschlagen: ' + (error?.message || 'Unbekannter Fehler');
        }
    }
}
