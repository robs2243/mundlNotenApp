/**
 * ============================================================================
 * PICTURE UPLOAD PAGE CONTROLLER
 * ============================================================================
 * This module handles the student picture upload page using OOP principles.
 *
 * Classes:
 * - ImageUploadService: Manages encrypting and uploading student images
 * - UploadUIController: Manages UI state and interactions
 * - UploadPageApp: Main application controller that coordinates everything
 * ============================================================================
 */

import { FirebaseService, AuthService, CryptoService, Student } from './services.js';

/**
 * ============================================================================
 * IMAGE UPLOAD SERVICE CLASS
 * ============================================================================
 * Handles encrypting and uploading student images to Firebase.
 *
 * Responsibilities:
 * - Validate image filenames
 * - Encrypt images
 * - Upload encrypted images to database
 * - Track upload progress
 */
class ImageUploadService {
    /**
     * Service instances
     */
    #firebaseService;
    #cryptoService;

    /**
     * Constructor
     */
    constructor() {
        this.#firebaseService = FirebaseService.getInstance();
        this.#cryptoService = new CryptoService();
    }

    /**
     * Upload multiple student images
     * @param {FileList} files - Files to upload
     * @param {string} schoolYear - School year (e.g., "2024/2025")
     * @param {string} classId - Class ID (e.g., "5a")
     * @param {string} encryptionPassword - Password to encrypt images
     * @returns {Promise<Object>} Upload results (successCount, errorCount, errors)
     */
    async uploadImages(files, schoolYear, classId, encryptionPassword) {
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        // Process each file
        for (let file of files) {
            try {
                // Parse filename to extract student name
                const studentInfo = this.#parseFilename(file.name);

                // Read file as binary data
                const arrayBuffer = await this.#readFileAsArrayBuffer(file);

                // Encrypt the binary data
                const encryptedData = await this.#cryptoService.encryptBinary(arrayBuffer, encryptionPassword);

                // Create Student instance
                const student = new Student(
                    studentInfo.vorname,
                    studentInfo.nachname,
                    classId,
                    schoolYear,
                    encryptedData
                );

                // Save to database
                await this.#saveStudentToDatabase(student, schoolYear, classId);

                successCount++;
                console.log(`Successfully uploaded: ${file.name}`);
            } catch (error) {
                errorCount++;
                errors.push({ filename: file.name, error: error.message });
                console.error(`Failed to upload ${file.name}:`, error);
            }
        }

        return { successCount, errorCount, errors };
    }

    /**
     * Parse filename to extract student information
     * Expected format: Nachname_Vorname.jpg
     * @param {string} filename - Filename to parse
     * @returns {Object} Object with vorname and nachname
     * @throws {Error} If filename format is invalid
     * @private
     */
    #parseFilename(filename) {
        // Remove file extension
        const nameWithoutExtension = filename.replace(/\.[^/.]+$/, "");

        // Split by underscore
        const parts = nameWithoutExtension.split('_');

        if (parts.length !== 2) {
            throw new Error(`Ungültiger Dateiname: ${filename}. Erwartet: Nachname_Vorname.jpg`);
        }

        return {
            nachname: parts[0].trim(),
            vorname: parts[1].trim()
        };
    }

    /**
     * Read file as ArrayBuffer
     * @param {File} file - File to read
     * @returns {Promise<ArrayBuffer>} File contents as ArrayBuffer
     * @private
     */
    #readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error("File reading failed"));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Save student to database
     * @param {Student} student - Student instance with encrypted image
     * @param {string} schoolYear - School year
     * @param {string} classId - Class ID
     * @returns {Promise<void>}
     * @private
     */
    async #saveStudentToDatabase(student, schoolYear, classId) {
        const studentId = student.getStudentId();
        const path = `pictures/${schoolYear}/${classId}/${studentId}`;

        const studentRef = this.#firebaseService.getRef(path);
        await this.#firebaseService.setData(studentRef, student.toJSON());

        console.log(`Saved student to database: ${path}`);
    }
}

/**
 * ============================================================================
 * UPLOAD UI CONTROLLER CLASS
 * ============================================================================
 * Manages all UI interactions for the upload page.
 *
 * Responsibilities:
 * - Update status messages
 * - Get form values
 * - Show image previews
 * - Show alerts
 * - Clear form
 */
class UploadUIController {
    /**
     * DOM element references
     */
    #statusDiv;
    #encryptionPasswordInput;
    #schoolYearInput;
    #classSelectorInput;
    #imageUploadInput;
    #previewContainer;
    #uploadButton;
    #backButton;
    #logoutButton;

    /**
     * Constructor - initializes all DOM element references
     */
    constructor() {
        this.#statusDiv = document.getElementById('status');
        this.#encryptionPasswordInput = document.getElementById('encryptionPassword');
        this.#schoolYearInput = document.getElementById('schoolYear');
        this.#classSelectorInput = document.getElementById('classSelector');
        this.#imageUploadInput = document.getElementById('imageUpload');
        this.#previewContainer = document.getElementById('previewContainer');
        this.#uploadButton = document.getElementById('uploadButton');
        this.#backButton = document.getElementById('backButton');
        this.#logoutButton = document.getElementById('logoutButton');
    }

    /**
     * Set status message with background color
     * @param {string} message - Status message
     * @param {string} color - Background color (hex)
     */
    setStatus(message, color) {
        this.#statusDiv.textContent = message;
        this.#statusDiv.style.backgroundColor = color;
    }

    /**
     * Get encryption password
     * @returns {string} Encryption password
     */
    getEncryptionPassword() {
        return this.#encryptionPasswordInput.value;
    }

    /**
     * Get school year
     * @returns {string} School year (trimmed)
     */
    getSchoolYear() {
        return this.#schoolYearInput.value.trim();
    }

    /**
     * Get class ID
     * @returns {string} Class ID (trimmed)
     */
    getClassId() {
        return this.#classSelectorInput.value.trim();
    }

    /**
     * Get selected files
     * @returns {FileList} Selected files
     */
    getFiles() {
        return this.#imageUploadInput.files;
    }

    /**
     * Show image previews
     * @param {FileList} files - Files to preview
     */
    showImagePreviews(files) {
        // Clear existing previews
        this.#previewContainer.innerHTML = '';

        // Create preview for each file
        for (let file of files) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = document.createElement('img');
                img.src = ev.target.result;
                img.alt = file.name;
                img.style.maxWidth = '100px';
                img.style.maxHeight = '100px';
                img.style.border = '1px solid #ccc';
                img.style.borderRadius = '5px';
                img.title = file.name;
                this.#previewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        }
    }

    /**
     * Clear all form inputs and previews
     */
    clearForm() {
        this.#previewContainer.innerHTML = '';
        this.#imageUploadInput.value = '';
    }

    /**
     * Enable/disable logout button
     * @param {boolean} enabled - True to enable, false to disable
     */
    setLogoutButtonEnabled(enabled) {
        if (this.#logoutButton) {
            this.#logoutButton.disabled = !enabled;
        }
    }

    /**
     * Show error alert
     * @param {string} title - Alert title
     * @param {string} message - Alert message
     */
    showError(title, message) {
        Swal.fire(title, message, 'error');
    }

    /**
     * Show success alert
     * @param {string} title - Alert title
     * @param {string} message - Alert message
     */
    showSuccess(title, message) {
        Swal.fire(title, message, 'success');
    }

    /**
     * Add event listener for image upload input change
     * @param {Function} handler - Event handler
     */
    onImageUploadChange(handler) {
        this.#imageUploadInput.addEventListener('change', handler);
    }

    /**
     * Add event listener for upload button click
     * @param {Function} handler - Event handler
     */
    onUploadClick(handler) {
        this.#uploadButton.addEventListener('click', handler);
    }

    /**
     * Add event listener for back button click
     * @param {Function} handler - Event handler
     */
    onBackClick(handler) {
        this.#backButton.addEventListener('click', handler);
    }

    /**
     * Add event listener for logout button click
     * @param {Function} handler - Event handler
     */
    onLogoutClick(handler) {
        if (this.#logoutButton) {
            this.#logoutButton.addEventListener('click', handler);
        }
    }
}

/**
 * ============================================================================
 * UPLOAD PAGE APPLICATION CLASS
 * ============================================================================
 * Main controller for the picture upload page.
 * Coordinates between upload service and UI controller.
 *
 * Responsibilities:
 * - Initialize the application
 * - Handle authentication state
 * - Handle image selection and preview
 * - Handle image upload
 * - Handle navigation
 */
class UploadPageApp {
    /**
     * Service and controller instances
     */
    #authService;
    #imageUploadService;
    #uiController;

    /**
     * Constructor - initializes all services and controllers
     */
    constructor() {
        this.#authService = new AuthService();
        this.#imageUploadService = new ImageUploadService();
        this.#uiController = new UploadUIController();
    }

    /**
     * Initialize the application
     * Sets up event listeners and auth state monitoring
     */
    initialize() {
        // Set up event listeners
        this.#setupEventListeners();

        // Monitor authentication state
        this.#setupAuthStateMonitoring();
    }

    /**
     * Set up all event listeners
     * @private
     */
    #setupEventListeners() {
        // Image upload input change (show previews)
        this.#uiController.onImageUploadChange((e) => this.#handleImageSelection(e));

        // Upload button click
        this.#uiController.onUploadClick(() => this.#handleUpload());

        // Back button click
        this.#uiController.onBackClick(() => {
            window.location.href = 'index.html';
        });

        // Logout button click
        this.#uiController.onLogoutClick(() => this.#handleLogout());
    }

    /**
     * Set up authentication state monitoring
     * @private
     */
    #setupAuthStateMonitoring() {
        this.#authService.onAuthStateChanged((user) => {
            if (user) {
                // User is logged in
                this.#uiController.setStatus(`Logged in as ${user.email}. Ready.`, '#4CAF50');
                this.#uiController.setLogoutButtonEnabled(true);
            } else {
                // User is not logged in - redirect to login page
                this.#uiController.setStatus('Not logged in. Redirecting...', '#f44336');
                this.#uiController.setLogoutButtonEnabled(false);

                const target = window.location.pathname + window.location.search + window.location.hash;
                sessionStorage.setItem('redirectTo', target);
                window.location.href = 'login.html';
            }
        });
    }

    /**
     * Handle image selection (show previews)
     * @param {Event} e - Change event
     * @private
     */
    #handleImageSelection(e) {
        const files = e.target.files;
        this.#uiController.showImagePreviews(files);
    }

    /**
     * Handle upload button click
     * @private
     */
    async #handleUpload() {
        // Validate inputs
        const encPassword = this.#uiController.getEncryptionPassword();
        if (!encPassword) {
            this.#uiController.showError('Fehler', 'Bitte ein Verschlüsselungspasswort eingeben.');
            return;
        }

        const schoolYear = this.#uiController.getSchoolYear();
        if (!schoolYear) {
            this.#uiController.showError('Fehler', 'Bitte ein Schuljahr eingeben.');
            return;
        }

        const classId = this.#uiController.getClassId();
        if (!classId) {
            this.#uiController.showError('Fehler', 'Bitte eine Klasse eingeben.');
            return;
        }

        const files = this.#uiController.getFiles();
        if (files.length === 0) {
            this.#uiController.showError('Fehler', 'Bitte Bilder auswählen.');
            return;
        }

        try {
            // Upload images
            const result = await this.#imageUploadService.uploadImages(files, schoolYear, classId, encPassword);

            // Show result message
            if (result.errorCount === 0) {
                // All uploads successful
                this.#uiController.showSuccess('Fertig', `${result.successCount} Bilder erfolgreich hochgeladen.`);
            } else if (result.successCount === 0) {
                // All uploads failed
                this.#uiController.showError('Fehler', `Alle ${result.errorCount} Uploads sind fehlgeschlagen.`);
            } else {
                // Some uploads failed
                this.#uiController.showSuccess('Fertig', `${result.successCount} Bilder erfolgreich hochgeladen, ${result.errorCount} Fehler.`);
            }

            // Clear form
            this.#uiController.clearForm();

            // Log errors if any
            if (result.errors.length > 0) {
                console.error('Upload errors:', result.errors);
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.#uiController.showError('Fehler', 'Fehler beim Hochladen: ' + error.message);
        }
    }

    /**
     * Handle logout button click
     * @private
     */
    async #handleLogout() {
        this.#uiController.setLogoutButtonEnabled(false);
        this.#uiController.setStatus('Abmelden laeuft...', '#ff9800');

        try {
            await this.#authService.signOut();
        } catch (error) {
            console.error('Logout error:', error);
            this.#uiController.setStatus('Abmelden fehlgeschlagen. Bitte erneut versuchen.', '#f44336');
            this.#uiController.setLogoutButtonEnabled(true);
        }
    }
}

/**
 * ============================================================================
 * APPLICATION ENTRY POINT
 * ============================================================================
 * Create and initialize the application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    const app = new UploadPageApp();
    app.initialize();
});
