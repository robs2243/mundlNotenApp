/**
 * ============================================================================
 * EXPORT PAGE CONTROLLER
 * ============================================================================
 * This module handles the CSV export page using OOP principles.
 *
 * Classes:
 * - ExportService: Manages grade export to CSV
 * - ExportClassLoaderService: Loads available classes for export
 * - ExportUIController: Manages UI state and interactions
 * - ExportPageApp: Main application controller that coordinates everything
 * ============================================================================
 */

import { FirebaseService, AuthService, CryptoService, Grade } from './services.js';

/**
 * ============================================================================
 * EXPORT SERVICE CLASS
 * ============================================================================
 * Handles exporting grades to CSV format.
 *
 * Responsibilities:
 * - Load grades from database
 * - Decrypt grade data
 * - Format data as CSV
 * - Trigger CSV download
 */
class ExportService {
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
     * Export grades to CSV for a specific school year and class
     * @param {string} schoolYear - School year (e.g., "2024/2025")
     * @param {string} classId - Class ID (e.g., "5a")
     * @param {string} encryptionPassword - Password to decrypt grades
     * @returns {Promise<void>}
     */
    async exportToCSV(schoolYear, classId, encryptionPassword) {
        try {
            // Get all grades from database
            const gradesRef = this.#firebaseService.getRef('grades');
            const snapshot = await this.#firebaseService.getData(gradesRef);

            if (!snapshot.exists()) {
                throw new Error('NO_DATA');
            }

            // Filter grades by school year and class
            const allGrades = snapshot.val();
            const filteredGrades = this.#filterGrades(allGrades, schoolYear, classId);

            if (Object.keys(filteredGrades).length === 0) {
                throw new Error('NO_MATCHING_DATA');
            }

            console.log(`Found ${Object.keys(filteredGrades).length} grades for ${schoolYear} and class ${classId}`);

            // Decrypt and convert to CSV
            const csvData = await this.#convertGradesToCSV(filteredGrades, encryptionPassword);

            // Download CSV file
            this.#downloadCSV(csvData, classId, schoolYear);

            return; // Success
        } catch (error) {
            throw error;
        }
    }

    /**
     * Filter grades by school year and class
     * @param {Object} allGrades - All grades from database
     * @param {string} schoolYear - School year to filter
     * @param {string} classId - Class ID to filter
     * @returns {Object} Filtered grades
     * @private
     */
    #filterGrades(allGrades, schoolYear, classId) {
        const filtered = {};

        Object.entries(allGrades).forEach(([key, grade]) => {
            // Check if the grade matches the criteria
            if (grade && grade.schuljahr === schoolYear && grade.classId === classId) {
                filtered[key] = grade;
            }
        });

        return filtered;
    }

    /**
     * Convert grades to CSV format
     * @param {Object} grades - Filtered grades
     * @param {string} encryptionPassword - Password to decrypt grades
     * @returns {Promise<string>} CSV content
     * @private
     */
    async #convertGradesToCSV(grades, encryptionPassword) {
        const csvRows = [];

        // Add CSV header
        csvRows.push(['Vorname', 'Nachname', 'Datum', 'Thema', 'Note']);

        // Process each grade
        for (const [key, grade] of Object.entries(grades)) {
            try {
                // Decrypt the grade data
                const decryptedPayload = await this.#cryptoService.decryptText(
                    grade.encryptedData.encrypted,
                    grade.encryptedData.iv,
                    grade.encryptedData.salt,
                    encryptionPassword
                );

                const gradeData = JSON.parse(decryptedPayload);

                // Format date from YYYY-MM-DD to DD.MM.YYYY
                const formattedDate = this.#formatDate(grade.date);

                // Add row to CSV
                csvRows.push([
                    grade.vorname || '',
                    grade.nachname || '',
                    formattedDate,
                    gradeData.comment || '',
                    gradeData.note || ''
                ]);
            } catch (decryptError) {
                console.error(`Failed to decrypt grade for ${key}:`, decryptError);
                // Skip this grade if decryption fails
            }
        }

        // Convert rows to CSV string (semicolon-separated, with quotes)
        const csvContent = csvRows.map(row =>
            row.map(field => `"${field}"`).join(';')
        ).join('\n');

        return csvContent;
    }

    /**
     * Format date from YYYY-MM-DD to DD.MM.YYYY
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {string} Formatted date
     * @private
     */
    #formatDate(date) {
        const parts = date.split('-');
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }

    /**
     * Download CSV file
     * @param {string} csvContent - CSV content
     * @param {string} classId - Class ID for filename
     * @param {string} schoolYear - School year for filename
     * @private
     */
    #downloadCSV(csvContent, classId, schoolYear) {
        // Create Blob with CSV content
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        // Create temporary download link
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Noten_${classId}_${schoolYear}.csv`);
        link.style.visibility = 'hidden';

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log('CSV download triggered');
    }
}

/**
 * ============================================================================
 * EXPORT CLASS LOADER SERVICE CLASS
 * ============================================================================
 * Loads available classes for a given school year from grades database.
 *
 * Responsibilities:
 * - Query database for available classes in grades
 * - Extract unique class IDs
 */
class ExportClassLoaderService {
    /**
     * Firebase service instance
     */
    #firebaseService;

    /**
     * Constructor
     */
    constructor() {
        this.#firebaseService = FirebaseService.getInstance();
    }

    /**
     * Load classes for a specific school year from grades database
     * @param {string} schoolYear - School year (e.g., "2024/2025")
     * @returns {Promise<string[]>} Array of class IDs
     */
    async loadClassesForSchoolYear(schoolYear) {
        if (!schoolYear) {
            return [];
        }

        console.log(`Loading classes for school year: ${schoolYear}`);

        try {
            // Get all grades (without filtering)
            const gradesRef = this.#firebaseService.getRef('grades');
            const snapshot = await this.#firebaseService.getData(gradesRef);

            console.log("Query executed, snapshot exists:", snapshot.exists());

            if (!snapshot.exists()) {
                console.log("No grades found in the database");
                return [];
            }

            const grades = snapshot.val();
            const classes = new Set();

            // Extract unique classes for the selected school year
            Object.entries(grades).forEach(([key, grade]) => {
                // Check if the grade has the required fields
                if (grade && grade.schuljahr === schoolYear && grade.classId) {
                    classes.add(grade.classId);
                }
            });

            console.log("Found classes:", Array.from(classes));

            // Convert to array and sort
            const sortedClasses = Array.from(classes).sort();

            return sortedClasses;
        } catch (error) {
            console.error("Error loading classes:", error);
            return [];
        }
    }
}

/**
 * ============================================================================
 * EXPORT UI CONTROLLER CLASS
 * ============================================================================
 * Manages all UI interactions for the export page.
 *
 * Responsibilities:
 * - Update status messages
 * - Get form values
 * - Populate class selector
 * - Show alerts
 * - Handle navigation
 */
class ExportUIController {
    /**
     * DOM element references
     */
    #statusDiv;
    #encryptionPasswordInput;
    #schoolYearInput;
    #classSelector;
    #exportButton;
    #backButton;
    #logoutButton;

    /**
     * Constructor - initializes all DOM element references
     */
    constructor() {
        this.#statusDiv = document.getElementById('status');
        this.#encryptionPasswordInput = document.getElementById('encryptionPassword');
        this.#schoolYearInput = document.getElementById('schoolYear');
        this.#classSelector = document.getElementById('classSelector');
        this.#exportButton = document.getElementById('exportButton');
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
     * Get selected class ID
     * @returns {string} Class ID
     */
    getClassId() {
        return this.#classSelector.value;
    }

    /**
     * Populate class selector with classes
     * @param {string[]} classes - Array of class IDs
     */
    populateClassSelector(classes) {
        // Clear existing options (except the first placeholder)
        this.#classSelector.innerHTML = '<option value="">Klasse auswählen</option>';

        if (classes.length === 0) {
            // Add a "no classes found" option
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "Keine Klassen gefunden";
            option.disabled = true;
            this.#classSelector.appendChild(option);
            return;
        }

        // Add options to class selector
        classes.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls;
            option.textContent = cls;
            this.#classSelector.appendChild(option);
        });
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
     * Show info alert
     * @param {string} title - Alert title
     * @param {string} message - Alert message
     */
    showInfo(title, message) {
        Swal.fire(title, message, 'info');
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
     * Add event listener for school year input
     * @param {Function} handler - Event handler
     */
    onSchoolYearInput(handler) {
        this.#schoolYearInput.addEventListener('input', handler);
    }

    /**
     * Add event listener for export button
     * @param {Function} handler - Event handler
     */
    onExportClick(handler) {
        this.#exportButton.addEventListener('click', handler);
    }

    /**
     * Add event listener for back button
     * @param {Function} handler - Event handler
     */
    onBackClick(handler) {
        this.#backButton.addEventListener('click', handler);
    }

    /**
     * Add event listener for logout button
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
 * EXPORT PAGE APPLICATION CLASS
 * ============================================================================
 * Main controller for the export page.
 * Coordinates between all services and UI controller.
 *
 * Responsibilities:
 * - Initialize the application
 * - Handle authentication state
 * - Load classes when school year changes
 * - Handle export button click
 * - Handle navigation
 */
class ExportPageApp {
    /**
     * Service and controller instances
     */
    #authService;
    #exportService;
    #classLoaderService;
    #uiController;

    /**
     * Constructor - initializes all services and controllers
     */
    constructor() {
        this.#authService = new AuthService();
        this.#exportService = new ExportService();
        this.#classLoaderService = new ExportClassLoaderService();
        this.#uiController = new ExportUIController();
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
        // School year input
        this.#uiController.onSchoolYearInput(() => this.#handleSchoolYearInput());

        // Export button
        this.#uiController.onExportClick(() => this.#handleExport());

        // Back button
        this.#uiController.onBackClick(() => {
            window.location.href = 'index.html';
        });

        // Logout button
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
     * Handle school year input change
     * @private
     */
    async #handleSchoolYearInput() {
        const schoolYear = this.#uiController.getSchoolYear();

        if (!schoolYear) {
            console.log("No school year entered");
            this.#uiController.populateClassSelector([]);
            return;
        }

        // Load classes for the school year
        const classes = await this.#classLoaderService.loadClassesForSchoolYear(schoolYear);
        this.#uiController.populateClassSelector(classes);
    }

    /**
     * Handle export button click
     * @private
     */
    async #handleExport() {
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
            this.#uiController.showError('Fehler', 'Bitte eine Klasse auswählen.');
            return;
        }

        try {
            // Export to CSV
            await this.#exportService.exportToCSV(schoolYear, classId, encPassword);

            // Show success message
            this.#uiController.showSuccess('Erfolg', 'CSV-Datei wurde erfolgreich heruntergeladen.');
        } catch (error) {
            console.error("Export error:", error);

            // Handle specific error cases
            if (error.message === 'NO_DATA') {
                this.#uiController.showInfo('Info', 'Keine Noten in der Datenbank gefunden.');
            } else if (error.message === 'NO_MATCHING_DATA') {
                this.#uiController.showInfo('Info', `Keine Noten für Klasse ${classId} im Schuljahr ${schoolYear} gefunden.`);
            } else {
                this.#uiController.showError('Fehler', 'Fehler beim Exportieren der Daten: ' + error.message);
            }
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
    const app = new ExportPageApp();
    app.initialize();
});
