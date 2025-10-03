import { RatingPage } from './controllers/RatingPage.js';

// Entry point for the main classroom rating dashboard.
document.addEventListener('DOMContentLoaded', () => {
    const page = new RatingPage();
    page.init();
});
