import { LoginPage } from './controllers/LoginPage.js';

// Bootstraps the login page once the DOM is ready.
document.addEventListener('DOMContentLoaded', () => {
    const page = new LoginPage();
    page.init();
});
