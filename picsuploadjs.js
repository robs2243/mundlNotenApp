import { PictureUploadPage } from './controllers/PictureUploadPage.js';

// Entry point for the encrypted picture upload page.
document.addEventListener('DOMContentLoaded', () => {
    const page = new PictureUploadPage();
    page.init();
});
