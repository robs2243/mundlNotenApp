/**
 * ============================================================================
 * RATING PAGE CONTROLLER
 * ============================================================================
 * This module handles the main rating/grading page using OOP principles.
 *
 * Classes:
 * - StudentImageService: Manages loading and decrypting student images
 * - GradeService: Manages CRUD operations for grades
 * - ClassLoaderService: Loads available classes for a school year
 * - RatingUIController: Manages UI state and interactions
 * - RatingPageApp: Main application controller that coordinates everything
 * ============================================================================
 */

import { FirebaseService, AuthService, CryptoService, Student, Grade } from './services.js';

/**
 * ============================================================================
 * STUDENT IMAGE SERVICE CLASS
 * ============================================================================
 * Manages loading student images from Firebase and decrypting them.
 *
 * Responsibilities:
 * - Load encrypted student images from database
 * - Decrypt images using encryption password
 * - Populate student boxes with images and metadata
 */
class StudentImageService {
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
     * Load and display student images for a specific class and school year
     * @param {string} schoolYear - School year (e.g., "2024/2025")
     * @param {string} classId - Class ID (e.g., "5a")
     * @param {string} encryptionPassword - Password to decrypt images
     * @returns {Promise<void>}
     */
    async loadStudentImages(schoolYear, classId, encryptionPassword) {
        if (!schoolYear || !classId || !encryptionPassword) {
            console.log("Missing required parameters for loading images");
            return;
        }

        console.log(`Loading images for school year: "${schoolYear}", class: ${classId}`);

        try {
            // Get all students in the class for the school year
            const classRef = this.#firebaseService.getRef(`pictures/${schoolYear}/${classId}`);
            const snapshot = await this.#firebaseService.getData(classRef);

            if (!snapshot.exists()) {
                console.log(`No students found for class ${classId} in school year ${schoolYear}`);
                Swal.fire('Info', `Keine Schülerdaten für Klasse ${classId} im Schuljahr ${schoolYear} gefunden.`, 'info');
                return;
            }

            const students = snapshot.val();
            const studentIds = Object.keys(students);
            console.log(`Found ${studentIds.length} students in the database`);

            // Get all student boxes in order
            const studentBoxes = document.querySelectorAll('.redBox');
            console.log(`Found ${studentBoxes.length} student boxes to fill`);

            // Fill each box with the corresponding student image
            for (let i = 0; i < studentBoxes.length; i++) {
                const box = studentBoxes[i];

                if (i < studentIds.length) {
                    // We have a student for this box
                    const studentId = studentIds[i];
                    const studentData = students[studentId];
                    const student = Student.fromDatabase(studentData, classId);

                    await this.#loadStudentIntoBox(box, student, encryptionPassword);
                } else {
                    // No student for this box - clear it
                    this.#clearBox(box);
                }
            }
        } catch (error) {
            console.error("Error loading student images:", error);
            Swal.fire('Fehler', 'Fehler beim Laden der Bilder: ' + error.message, 'error');
        }
    }

    /**
     * Load a single student's image into a box
     * @param {HTMLElement} box - The student box element
     * @param {Student} student - Student instance
     * @param {string} encryptionPassword - Password to decrypt image
     * @private
     */
    async #loadStudentIntoBox(box, student, encryptionPassword) {
        const img = box.querySelector('img');
        const label = box.querySelector('.student-label');

        console.log(`Processing student: ${student.getFullName()} for box`);

        try {
            // Store student metadata in the box's dataset
            box.dataset.vorname = student.vorname;
            box.dataset.nachname = student.nachname;
            box.dataset.klasse = student.klasse;
            box.dataset.schuljahr = student.schuljahr;

            // Update the image alt text and label
            img.alt = student.getFullName();
            label.textContent = student.getFullName();

            // Decrypt the image
            const encryptedData = student.encryptedImage;
            const decryptedArrayBuffer = await this.#cryptoService.decryptBinary(
                encryptedData.encrypted,
                encryptedData.iv,
                encryptedData.salt,
                encryptionPassword
            );

            // Convert ArrayBuffer to base64 using Blob API
            const blob = new Blob([decryptedArrayBuffer]);
            const base64String = await this.#convertBlobToBase64(blob);

            // Set the image source and make it visible
            img.src = `data:image/jpeg;base64,${base64String}`;
            img.style.display = 'block';

            console.log(`Successfully loaded image for ${student.getFullName()}`);
        } catch (decryptError) {
            console.error(`Failed to decrypt image for ${student.getFullName()}:`, decryptError);

            // Clear metadata and label if decryption fails
            this.#clearBox(box);
        }
    }

    /**
     * Convert a Blob to base64 string
     * @param {Blob} blob - Blob to convert
     * @returns {Promise<string>} Base64 string
     * @private
     */
    #convertBlobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Clear a student box (hide image, clear metadata)
     * @param {HTMLElement} box - The student box element
     * @private
     */
    #clearBox(box) {
        const img = box.querySelector('img');
        const label = box.querySelector('.student-label');

        img.style.display = 'none';
        img.alt = '';
        label.textContent = '';

        delete box.dataset.vorname;
        delete box.dataset.nachname;
        delete box.dataset.klasse;
        delete box.dataset.schuljahr;
    }

    /**
     * Reset all student boxes to empty state
     */
    resetAllBoxes() {
        const studentBoxes = document.querySelectorAll('.redBox');

        studentBoxes.forEach((box) => {
            this.#clearBox(box);
            box.classList.remove('bild-selektiert');
        });

        console.log("All images, labels and metadata reset to empty boxes");
    }
}

/**
 * ============================================================================
 * GRADE SERVICE CLASS
 * ============================================================================
 * Manages CRUD operations for grades in the database.
 *
 * Responsibilities:
 * - Load existing grades from database
 * - Save new/updated grades to database
 * - Encrypt/decrypt grade data
 */
class GradeService {
    /**
     * Service instances
     */
    #firebaseService;
    #cryptoService;

    /**
     * Cache for decrypted grades (studentId -> grade data)
     */
    #gradesCache;

    /**
     * Constructor
     */
    constructor() {
        this.#firebaseService = FirebaseService.getInstance();
        this.#cryptoService = new CryptoService();
        this.#gradesCache = {};
    }

    /**
     * Load a grade for a specific student and date
     * @param {string} studentId - Student ID (format: Vorname_Nachname)
     * @param {string} classId - Class ID
     * @param {string} date - Date in YYYY-MM-DD format
     * @param {string} encryptionPassword - Password to decrypt grade
     * @returns {Promise<Object|null>} Grade data or null if not found
     */
    async loadGrade(studentId, classId, date, encryptionPassword) {
        try {
            // Query the database for the grade
            const gradesRef = this.#firebaseService.getRef('grades');
            const compositeKey = `${studentId}_${date}_${classId}`;
            const q = this.#firebaseService.createQuery(gradesRef, 'studentId_date_class', compositeKey);
            const snapshot = await this.#firebaseService.getData(q);

            if (!snapshot.exists()) {
                return null; // No grade found
            }

            // Decrypt the grade data
            const gradeData = Object.values(snapshot.val())[0];
            const decryptedPayload = await this.#cryptoService.decryptText(
                gradeData.encryptedData.encrypted,
                gradeData.encryptedData.iv,
                gradeData.encryptedData.salt,
                encryptionPassword
            );

            const parsedGrade = JSON.parse(decryptedPayload);

            // Cache the decrypted grade
            this.#gradesCache[studentId] = parsedGrade;

            return parsedGrade;
        } catch (error) {
            console.error("Error loading grade:", error);
            throw error;
        }
    }

    /**
     * Save a grade to the database
     * @param {Grade} grade - Grade instance to save
     * @param {string} encryptionPassword - Password to encrypt grade
     * @returns {Promise<void>}
     */
    async saveGrade(grade, encryptionPassword) {
        try {
            // Encrypt the grade data (note and comment)
            const payload = JSON.stringify(grade.toEncryptedPayload());
            const encryptedData = await this.#cryptoService.encryptText(payload, encryptionPassword);

            // Convert to database format
            const dbData = grade.toDatabaseFormat(encryptedData);

            // Save to database
            const gradeRef = this.#firebaseService.getRef('grades/' + grade.getGradeId());
            await this.#firebaseService.setData(gradeRef, dbData);

            // Update cache
            this.#gradesCache[grade.studentId] = {
                note: grade.note,
                comment: grade.comment
            };

            console.log(`Grade saved for ${grade.studentId}`);
        } catch (error) {
            console.error("Error saving grade:", error);
            throw error;
        }
    }

    /**
     * Get cached grade for a student
     * @param {string} studentId - Student ID
     * @returns {Object|null} Cached grade or null
     */
    getCachedGrade(studentId) {
        return this.#gradesCache[studentId] || null;
    }
}

/**
 * ============================================================================
 * CLASS LOADER SERVICE CLASS
 * ============================================================================
 * Loads available classes for a given school year.
 *
 * Responsibilities:
 * - Query database for available classes
 * - Populate class selector dropdown
 */
class ClassLoaderService {
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
     * Load classes for a specific school year
     * @param {string} schoolYear - School year (e.g., "2024/2025")
     * @returns {Promise<string[]>} Array of class IDs
     */
    async loadClassesForSchoolYear(schoolYear) {
        if (!schoolYear) {
            return [];
        }

        console.log(`Loading classes for school year: "${schoolYear}"`);

        try {
            // Get all classes for the school year from pictures database
            const classesRef = this.#firebaseService.getRef(`pictures/${schoolYear}`);
            const snapshot = await this.#firebaseService.getData(classesRef);

            if (!snapshot.exists()) {
                console.log(`No classes found for school year: ${schoolYear}`);
                return [];
            }

            const classes = snapshot.val();
            const classNames = Object.keys(classes);
            console.log(`Found ${classNames.length} classes: ${classNames.join(', ')}`);

            return classNames;
        } catch (error) {
            console.error("Error loading classes:", error);
            return [];
        }
    }
}

/**
 * ============================================================================
 * RATING UI CONTROLLER CLASS
 * ============================================================================
 * Manages all UI interactions for the rating page.
 *
 * Responsibilities:
 * - Update status messages
 * - Get form values
 * - Populate class selector
 * - Handle student box clicks
 * - Show grade input modal
 */
class RatingUIController {
    /**
     * DOM element references
     */
    #statusDiv;
    #dateSelector;
    #schoolYearInput;
    #classSelector;
    #encryptionPasswordInput;
    #grid;
    #picsUploadButton;
    #excelExportButton;
    #logoutButton;

    /**
     * Set of recent comments for autocomplete
     */
    #recentComments;

    /**
     * Constructor - initializes all DOM element references
     */
    constructor() {
        this.#statusDiv = document.getElementById('status');
        this.#dateSelector = document.getElementById('dateSelector');
        this.#schoolYearInput = document.getElementById('schoolYear');
        this.#classSelector = document.getElementById('classSelector');
        this.#encryptionPasswordInput = document.getElementById('encryptionPassword');
        this.#grid = document.querySelector('.parent');
        this.#picsUploadButton = document.getElementById('picsUpload');
        this.#excelExportButton = document.getElementById('excelExport');
        this.#logoutButton = document.getElementById('logoutButton');

        this.#recentComments = new Set();

        // Set today's date in date picker
        this.#dateSelector.valueAsDate = new Date();
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
     * @returns {string} School year
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
     * Get selected date
     * @returns {string} Date in YYYY-MM-DD format
     */
    getDate() {
        return this.#dateSelector.value;
    }

    /**
     * Populate class selector with classes
     * @param {string[]} classes - Array of class IDs
     */
    populateClassSelector(classes) {
        // Clear existing options except the first one (placeholder)
        while (this.#classSelector.options.length > 1) {
            this.#classSelector.remove(1);
        }

        if (classes.length === 0) {
            // Add a "no classes found" option
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "Keine Klassen gefunden";
            option.disabled = true;
            this.#classSelector.appendChild(option);
            return null;
        }

        // Add each class as an option
        classes.forEach(className => {
            const option = document.createElement('option');
            option.value = className;
            option.textContent = className;
            this.#classSelector.appendChild(option);
        });

        // If there's only one class, select it automatically
        if (classes.length === 1) {
            this.#classSelector.value = classes[0];
            return classes[0];
        }

        return null;
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
     * Add event listener for school year input
     * @param {Function} handler - Event handler
     */
    onSchoolYearInput(handler) {
        this.#schoolYearInput.addEventListener('input', handler);
    }

    /**
     * Add event listener for class selector change
     * @param {Function} handler - Event handler
     */
    onClassChange(handler) {
        this.#classSelector.addEventListener('change', handler);
    }

    /**
     * Add event listener for encryption password input
     * @param {Function} handler - Event handler
     */
    onPasswordInput(handler) {
        this.#encryptionPasswordInput.addEventListener('input', handler);
    }

    /**
     * Add event listener for grid clicks (student box selection)
     * @param {Function} handler - Event handler
     */
    onGridClick(handler) {
        this.#grid.addEventListener('click', handler);
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

    /**
     * Add event listener for pics upload button
     * @param {Function} handler - Event handler
     */
    onPicsUploadClick(handler) {
        this.#picsUploadButton.addEventListener('click', handler);
    }

    /**
     * Add event listener for excel export button
     * @param {Function} handler - Event handler
     */
    onExcelExportClick(handler) {
        if (this.#excelExportButton) {
            this.#excelExportButton.addEventListener('click', handler);
        }
    }

    /**
     * Show grade input modal for a student
     * @param {string} studentName - Student's full name
     * @param {string} klasse - Class ID
     * @param {string} schuljahr - School year
     * @param {Object|null} existingGrade - Existing grade data (note, comment)
     * @returns {Promise<Object|null>} User input (note, comment) or null if cancelled
     */
    async showGradeModal(studentName, klasse, schuljahr, existingGrade) {
        const result = await Swal.fire({
            title: `Bewertung für ${studentName}`,
            html: `
                <div class="swal2-form">
                    <div style="margin-bottom: 10px; font-size: 14px; color: #666;">
                        <strong>Klasse:</strong> ${klasse || 'N/A'} |
                        <strong>Schuljahr:</strong> ${schuljahr || 'N/A'}
                    </div>
                    <div class="swal2-radio-group">
                        ${[1, 2, 3, 4, 5, 6].map(n =>
                            `<label><input type="radio" name="note" value="${n}" id="note-${n}"><span>Note ${n}</span></label>`
                        ).join('')}
                    </div>
                    <div>
                        <strong>Kommentar:</strong>
                        <input type="text" id="kommentar-input" class="swal2-input" placeholder="Kommentar oder Vorschlag klicken">
                        <div id="comment-suggestions-container"></div>
                    </div>
                </div>`,
            confirmButtonText: 'Speichern',
            cancelButtonText: 'Abbrechen',
            showCancelButton: true,
            didOpen: () => {
                const input = document.getElementById('kommentar-input');
                const container = document.getElementById('comment-suggestions-container');

                // Pre-fill existing grade if available
                if (existingGrade) {
                    if (existingGrade.note) {
                        const radio = document.getElementById(`note-${existingGrade.note}`);
                        if (radio) radio.checked = true;
                    }
                    input.value = existingGrade.comment || '';
                }

                // Show suggestion chips
                if (this.#recentComments.size) {
                    this.#recentComments.forEach(c => {
                        const span = document.createElement('span');
                        span.className = 'suggestion-item';
                        span.textContent = c;
                        container.appendChild(span);
                    });
                }

                // Handle suggestion chip clicks
                container.addEventListener('click', ev => {
                    if (ev.target.classList.contains('suggestion-item')) {
                        input.value = ev.target.textContent;
                        input.focus();
                    }
                });

                input.focus();
            },
            preConfirm: () => ({
                note: document.querySelector('input[name="note"]:checked')?.value || null,
                comment: document.getElementById('kommentar-input').value.trim()
            })
        });

        if (result.isConfirmed) {
            const { note, comment } = result.value;

            // Add comment to recent comments if not empty
            if (comment) {
                this.#recentComments.add(comment);
            }

            return { note, comment };
        }

        return null; // User cancelled
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
}

/**
 * ============================================================================
 * RATING PAGE APPLICATION CLASS
 * ============================================================================
 * Main controller for the rating page.
 * Coordinates between all services and UI controller.
 *
 * Responsibilities:
 * - Initialize the application
 * - Handle authentication state
 * - Coordinate student image loading
 * - Handle grade input and saving
 * - Handle navigation
 */
class RatingPageApp {
    /**
     * Service and controller instances
     */
    #authService;
    #studentImageService;
    #gradeService;
    #classLoaderService;
    #uiController;

    /**
     * Constructor - initializes all services and controllers
     */
    constructor() {
        this.#authService = new AuthService();
        this.#studentImageService = new StudentImageService();
        this.#gradeService = new GradeService();
        this.#classLoaderService = new ClassLoaderService();
        this.#uiController = new RatingUIController();
    }

    /**
     * Initialize the application
     * Sets up event listeners and auth state monitoring
     */
    initialize() {
        // Load classes if school year is already set
        const schoolYear = this.#uiController.getSchoolYear();
        if (schoolYear) {
            this.#handleSchoolYearChange();
        }

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
        this.#uiController.onSchoolYearInput(() => this.#handleSchoolYearChange());

        // Class selector change
        this.#uiController.onClassChange(() => this.#handleClassChange());

        // Encryption password input
        this.#uiController.onPasswordInput(() => this.#handlePasswordInput());

        // Grid click (student box selection)
        this.#uiController.onGridClick((e) => this.#handleGridClick(e));

        // Logout button
        this.#uiController.onLogoutClick(() => this.#handleLogout());

        // Pics upload button
        this.#uiController.onPicsUploadClick(() => {
            window.location.href = 'picsupload.html';
        });

        // Excel export button
        this.#uiController.onExcelExportClick(() => {
            window.location.href = 'export.html';
        });
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

                // Try to load images if all required inputs are available
                const encPassword = this.#uiController.getEncryptionPassword();
                const schoolYear = this.#uiController.getSchoolYear();
                const classId = this.#uiController.getClassId();

                if (encPassword && schoolYear && classId) {
                    this.#loadImages();
                }
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
    async #handleSchoolYearChange() {
        // Reset all images first
        this.#studentImageService.resetAllBoxes();

        // Load classes for the new school year
        const schoolYear = this.#uiController.getSchoolYear();
        const classes = await this.#classLoaderService.loadClassesForSchoolYear(schoolYear);
        const autoSelectedClass = this.#uiController.populateClassSelector(classes);

        // If a class was auto-selected and password is available, load images
        if (autoSelectedClass && this.#uiController.getEncryptionPassword()) {
            this.#loadImages();
        }
    }

    /**
     * Handle class selector change
     * @private
     */
    #handleClassChange() {
        // Reset all images first
        this.#studentImageService.resetAllBoxes();

        // Load images if password is available
        const encPassword = this.#uiController.getEncryptionPassword();
        const schoolYear = this.#uiController.getSchoolYear();
        const classId = this.#uiController.getClassId();

        if (encPassword && schoolYear && classId) {
            this.#loadImages();
        }
    }

    /**
     * Handle encryption password input
     * @private
     */
    #handlePasswordInput() {
        const schoolYear = this.#uiController.getSchoolYear();
        const classId = this.#uiController.getClassId();

        if (schoolYear && classId) {
            // Reset all images and metadata before loading with new password
            this.#studentImageService.resetAllBoxes();
            this.#loadImages();
        }
    }

    /**
     * Load student images
     * @private
     */
    async #loadImages() {
        const schoolYear = this.#uiController.getSchoolYear();
        const classId = this.#uiController.getClassId();
        const encPassword = this.#uiController.getEncryptionPassword();

        await this.#studentImageService.loadStudentImages(schoolYear, classId, encPassword);
    }

    /**
     * Handle grid click (student box selection)
     * @param {Event} e - Click event
     * @private
     */
    async #handleGridClick(e) {
        const box = e.target.closest('.redBox');
        if (!box) return;

        // Check for encryption password
        const encPassword = this.#uiController.getEncryptionPassword();
        if (!encPassword) {
            this.#uiController.showError('Fehler', 'Bitte zuerst ein Verschlüsselungspasswort eingeben.');
            return;
        }

        // Remove selection from all boxes and select this one
        document.querySelectorAll('.bild-selektiert').forEach(el => el.classList.remove('bild-selektiert'));
        box.classList.add('bild-selektiert');

        // Check if student data is loaded
        const vorname = box.dataset.vorname;
        const nachname = box.dataset.nachname;

        if (!vorname || !nachname) {
            this.#uiController.showInfo('No data loaded!', 'Keine Schülerdaten für dieses Feld geladen.');
            return;
        }

        // Get student metadata
        const klasse = box.dataset.klasse;
        const schuljahr = box.dataset.schuljahr;
        const studentName = `${vorname} ${nachname}`;
        const studentId = `${vorname}_${nachname}`;
        const classId = klasse || this.#uiController.getClassId();
        const date = this.#uiController.getDate();

        // Try to load existing grade
        let existingGrade = null;
        try {
            existingGrade = await this.#gradeService.loadGrade(studentId, classId, date, encPassword);
        } catch (dbError) {
            console.error("Firebase Database Read Error:", dbError);
            this.#uiController.showError('Datenbankfehler!', 'Die Daten konnten nicht gelesen werden.');
            return;
        } catch (decryptionError) {
            console.error("Decryption Error:", decryptionError);
            this.#uiController.showError('Entschlüsselungsfehler!', 'Falsches Passwort oder die Daten sind beschädigt.');
            return;
        }

        // Show grade input modal
        const result = await this.#uiController.showGradeModal(studentName, klasse, schuljahr, existingGrade);

        if (result) {
            const { note, comment } = result;

            // Don't save empty grades
            if (!note && !comment) {
                return;
            }

            // Create Grade instance
            const grade = new Grade(
                studentId,
                classId,
                date,
                note,
                comment,
                vorname,
                nachname,
                schuljahr
            );

            // Save the grade
            try {
                await this.#gradeService.saveGrade(grade, encPassword);
            } catch (error) {
                this.#uiController.showError('Fehler!', 'Daten konnten nicht gespeichert werden: ' + error.message);
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
    const app = new RatingPageApp();
    app.initialize();
});
