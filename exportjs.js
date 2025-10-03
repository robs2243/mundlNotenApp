import { ExportPage } from './controllers/ExportPage.js';

// Entry point for the grade export screen.
document.addEventListener('DOMContentLoaded', () => {
    const page = new ExportPage();
    page.init();
});
