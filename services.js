/**
 * ============================================================================
 * SHARED SERVICES MODULE
 * ============================================================================
 * This module contains all shared service classes used throughout the app.
 * Following OOP principles, each service has a single responsibility.
 *
 * Classes:
 * - FirebaseConfig: Holds Firebase configuration constants
 * - FirebaseService: Manages Firebase app, auth, and database instances
 * - AuthService: Handles all authentication operations
 * - CryptoService: Handles encryption and decryption
 * - Student: Data model for student information
 * - Grade: Data model for grade information
 * ============================================================================
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import {
    getAuth,
    setPersistence,
    browserLocalPersistence,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
    getDatabase,
    ref,
    set,
    get,
    query,
    orderByChild,
    equalTo
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js';

/**
 * ============================================================================
 * FIREBASE CONFIGURATION CLASS
 * ============================================================================
 * Holds the Firebase configuration as a constant.
 * This ensures config is in one place and can be easily maintained.
 */
export class FirebaseConfig {
    static config = {
        apiKey: "AIzaSyCsI95RxiBk9GXaDpA39oJcyaPtVczr_Q4",
        authDomain: "mundlnotendb.firebaseapp.com",
        databaseURL: "https://mundlnotendb-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "mundlnotendb",
        storageBucket: "mundlnotendb.firebasestorage.app",
        messagingSenderId: "282603615680",
        appId: "1:282603615680:web:cfda956d14c3bcc6218425"
    };
}

/**
 * ============================================================================
 * FIREBASE SERVICE CLASS (Singleton Pattern)
 * ============================================================================
 * Manages Firebase initialization and provides access to Firebase services.
 * Uses Singleton pattern to ensure only one instance exists.
 *
 * Responsibilities:
 * - Initialize Firebase app
 * - Provide access to Auth service
 * - Provide access to Database service
 */
export class FirebaseService {
    /**
     * Private static instance for Singleton pattern
     * This ensures only one Firebase instance exists in the entire app
     */
    static #instance = null;

    /**
     * Private properties (using # prefix makes them truly private in modern JS)
     */
    #app = null;
    #auth = null;
    #database = null;

    /**
     * Private constructor - prevents direct instantiation
     * Use FirebaseService.getInstance() instead
     */
    constructor() {
        if (FirebaseService.#instance) {
            throw new Error("Use FirebaseService.getInstance() to get the instance");
        }

        // Initialize Firebase app (reuse existing if already initialized)
        this.#app = getApps().length ? getApps()[0] : initializeApp(FirebaseConfig.config);

        // Get references to Firebase services
        this.#auth = getAuth(this.#app);
        this.#database = getDatabase(this.#app);

        FirebaseService.#instance = this;
    }

    /**
     * Get the singleton instance of FirebaseService
     * @returns {FirebaseService} The singleton instance
     */
    static getInstance() {
        if (!FirebaseService.#instance) {
            FirebaseService.#instance = new FirebaseService();
        }
        return FirebaseService.#instance;
    }

    /**
     * Get the Firebase Auth instance
     * @returns {Auth} Firebase Auth instance
     */
    getAuth() {
        return this.#auth;
    }

    /**
     * Get the Firebase Database instance
     * @returns {Database} Firebase Database instance
     */
    getDatabase() {
        return this.#database;
    }

    /**
     * Get a reference to a specific path in the database
     * @param {string} path - Database path (e.g., 'grades', 'pictures/2024/5a')
     * @returns {DatabaseReference} Database reference
     */
    getRef(path) {
        return ref(this.#database, path);
    }

    /**
     * Create a query on the database
     * @param {DatabaseReference} reference - Database reference
     * @param {string} orderBy - Field to order by
     * @param {any} equalTo - Value to match
     * @returns {Query} Database query
     */
    createQuery(reference, orderBy, equalTo) {
        return query(reference, orderByChild(orderBy), equalTo(equalTo));
    }

    /**
     * Get data from a reference
     * @param {DatabaseReference} reference - Database reference
     * @returns {Promise<DataSnapshot>} Snapshot of the data
     */
    async getData(reference) {
        return await get(reference);
    }

    /**
     * Set data at a reference
     * @param {DatabaseReference} reference - Database reference
     * @param {any} data - Data to set
     * @returns {Promise<void>}
     */
    async setData(reference, data) {
        return await set(reference, data);
    }
}

/**
 * ============================================================================
 * AUTHENTICATION SERVICE CLASS
 * ============================================================================
 * Handles all authentication-related operations.
 * Separates auth logic from UI and business logic.
 *
 * Responsibilities:
 * - User login/logout
 * - Auth state monitoring
 * - Session persistence
 * - Error handling with localized messages
 */
export class AuthService {
    /**
     * Firebase authentication instance
     */
    #auth = null;

    /**
     * Constructor initializes the auth instance from FirebaseService
     */
    constructor() {
        this.#auth = FirebaseService.getInstance().getAuth();
    }

    /**
     * Ensure authentication persistence (keep user logged in)
     * @returns {Promise<void>}
     */
    async ensurePersistence() {
        try {
            await setPersistence(this.#auth, browserLocalPersistence);
        } catch (error) {
            console.warn('Could not set auth persistence:', error);
        }
    }

    /**
     * Sign in with email and password
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<UserCredential>} User credential
     * @throws {Error} If login fails
     */
    async signIn(email, password) {
        return await signInWithEmailAndPassword(this.#auth, email, password);
    }

    /**
     * Sign out the current user
     * @returns {Promise<void>}
     */
    async signOut() {
        return await signOut(this.#auth);
    }

    /**
     * Monitor authentication state changes
     * @param {Function} callback - Callback function that receives user object
     */
    onAuthStateChanged(callback) {
        onAuthStateChanged(this.#auth, callback);
    }

    /**
     * Get current authenticated user
     * @returns {User|null} Current user or null if not authenticated
     */
    getCurrentUser() {
        return this.#auth.currentUser;
    }

    /**
     * Map Firebase auth error codes to user-friendly German messages
     * @param {Error} error - Firebase auth error
     * @returns {string} Localized error message
     */
    mapAuthError(error) {
        const errorMap = {
            'auth/invalid-email': 'Die E-Mail-Adresse ist ungueltig.',
            'auth/user-disabled': 'Dieses Konto wurde deaktiviert. Bitte wenden Sie sich an den Administrator.',
            'auth/user-not-found': 'Kein Konto mit dieser E-Mail-Adresse gefunden.',
            'auth/wrong-password': 'Das Passwort ist falsch.',
            'auth/too-many-requests': 'Zu viele fehlgeschlagene Versuche. Bitte warten Sie einen Moment.'
        };

        return errorMap[error.code] || `Anmeldung fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`;
    }
}

/**
 * ============================================================================
 * CRYPTOGRAPHY SERVICE CLASS
 * ============================================================================
 * Handles all encryption and decryption operations using AES-GCM.
 * Provides secure encryption for sensitive data (grades, images).
 *
 * Encryption Standard: AES-GCM with 256-bit keys
 * Key Derivation: PBKDF2 with 100,000 iterations
 *
 * Responsibilities:
 * - Derive encryption keys from passwords
 * - Encrypt text and binary data
 * - Decrypt text and binary data
 */
export class CryptoService {
    /**
     * Number of iterations for PBKDF2 key derivation
     * Higher = more secure but slower
     */
    static ITERATIONS = 100000;

    /**
     * Derive an encryption key from a password using PBKDF2
     * @param {string} password - User password
     * @param {Uint8Array} salt - Random salt (should be unique per encryption)
     * @returns {Promise<CryptoKey>} Derived encryption key
     */
    async deriveKey(password, salt) {
        const encoder = new TextEncoder();

        // Import password as key material
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            encoder.encode(password),
            "PBKDF2",
            false,
            ["deriveKey"]
        );

        // Derive actual encryption key using PBKDF2
        return await crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt,
                iterations: CryptoService.ITERATIONS,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
    }

    /**
     * Encrypt text data
     * @param {string} text - Plain text to encrypt
     * @param {string} password - Encryption password
     * @returns {Promise<Object>} Object with encrypted data, IV, and salt (all base64)
     */
    async encryptText(text, password) {
        // Generate random salt and IV (initialization vector)
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));

        // Derive key from password and salt
        const key = await this.deriveKey(password, salt);

        // Encrypt the text
        const encoder = new TextEncoder();
        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            encoder.encode(text)
        );

        // Return as base64 strings for easy storage
        return {
            encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
            iv: btoa(String.fromCharCode(...iv)),
            salt: btoa(String.fromCharCode(...salt))
        };
    }

    /**
     * Decrypt text data
     * @param {string} encryptedBase64 - Base64 encoded encrypted data
     * @param {string} ivBase64 - Base64 encoded IV
     * @param {string} saltBase64 - Base64 encoded salt
     * @param {string} password - Decryption password
     * @returns {Promise<string>} Decrypted text
     * @throws {Error} If decryption fails (wrong password or corrupted data)
     */
    async decryptText(encryptedBase64, ivBase64, saltBase64, password) {
        // Convert base64 strings back to Uint8Arrays
        const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
        const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
        const ciphertext = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

        // Derive key from password and salt
        const key = await this.deriveKey(password, salt);

        // Decrypt the data
        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            ciphertext
        );

        // Convert decrypted ArrayBuffer back to text
        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    }

    /**
     * Encrypt binary data (e.g., images)
     * @param {ArrayBuffer} arrayBuffer - Binary data to encrypt
     * @param {string} password - Encryption password
     * @returns {Promise<Object>} Object with encrypted data, IV, and salt (all base64)
     */
    async encryptBinary(arrayBuffer, password) {
        // Generate random salt and IV
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));

        // Derive key from password and salt
        const key = await this.deriveKey(password, salt);

        // Encrypt the binary data
        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            new Uint8Array(arrayBuffer)
        );

        // Convert encrypted data to base64 using Blob API (handles large data better)
        const blob = new Blob([new Uint8Array(encrypted)]);
        const base64String = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Remove the data URL prefix to get just the base64
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

        return {
            encrypted: base64String,
            iv: btoa(String.fromCharCode(...iv)),
            salt: btoa(String.fromCharCode(...salt))
        };
    }

    /**
     * Decrypt binary data (e.g., images)
     * @param {string} encryptedBase64 - Base64 encoded encrypted data
     * @param {string} ivBase64 - Base64 encoded IV
     * @param {string} saltBase64 - Base64 encoded salt
     * @param {string} password - Decryption password
     * @returns {Promise<ArrayBuffer>} Decrypted binary data
     * @throws {Error} If decryption fails (wrong password or corrupted data)
     */
    async decryptBinary(encryptedBase64, ivBase64, saltBase64, password) {
        // Convert base64 strings back to Uint8Arrays
        const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
        const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
        const ciphertext = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

        // Derive key from password and salt
        const key = await this.deriveKey(password, salt);

        // Decrypt the data and return as ArrayBuffer
        return await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            ciphertext
        );
    }
}

/**
 * ============================================================================
 * STUDENT DATA MODEL CLASS
 * ============================================================================
 * Represents a student with their basic information.
 * Encapsulates student data and provides validation.
 */
export class Student {
    /**
     * Student's first name
     */
    #vorname;

    /**
     * Student's last name
     */
    #nachname;

    /**
     * Class ID (e.g., "5a", "10b")
     */
    #klasse;

    /**
     * School year (e.g., "2024/2025")
     */
    #schuljahr;

    /**
     * Encrypted image data
     */
    #encryptedImage;

    /**
     * Constructor
     * @param {string} vorname - First name
     * @param {string} nachname - Last name
     * @param {string} klasse - Class ID
     * @param {string} schuljahr - School year
     * @param {Object} encryptedImage - Encrypted image data (optional)
     */
    constructor(vorname, nachname, klasse, schuljahr, encryptedImage = null) {
        this.#vorname = vorname;
        this.#nachname = nachname;
        this.#klasse = klasse;
        this.#schuljahr = schuljahr;
        this.#encryptedImage = encryptedImage;
    }

    /**
     * Get student ID (format: Vorname_Nachname)
     * @returns {string} Student ID
     */
    getStudentId() {
        return `${this.#vorname}_${this.#nachname}`;
    }

    /**
     * Get full name (format: Vorname Nachname)
     * @returns {string} Full name
     */
    getFullName() {
        return `${this.#vorname} ${this.#nachname}`;
    }

    // Getters for all properties
    get vorname() { return this.#vorname; }
    get nachname() { return this.#nachname; }
    get klasse() { return this.#klasse; }
    get schuljahr() { return this.#schuljahr; }
    get encryptedImage() { return this.#encryptedImage; }

    // Setter for encrypted image (used when loading from database)
    set encryptedImage(data) { this.#encryptedImage = data; }

    /**
     * Convert to plain object for database storage
     * @returns {Object} Plain object representation
     */
    toJSON() {
        const obj = {
            vorname: this.#vorname,
            nachname: this.#nachname,
            schuljahr: this.#schuljahr
        };

        if (this.#encryptedImage) {
            obj.encryptedData = this.#encryptedImage;
        }

        return obj;
    }

    /**
     * Create a Student instance from database data
     * @param {Object} data - Database data
     * @param {string} klasse - Class ID
     * @returns {Student} Student instance
     */
    static fromDatabase(data, klasse) {
        return new Student(
            data.vorname,
            data.nachname,
            klasse,
            data.schuljahr,
            data.encryptedData || null
        );
    }
}

/**
 * ============================================================================
 * GRADE DATA MODEL CLASS
 * ============================================================================
 * Represents a grade with associated metadata.
 * Encapsulates grade data and provides validation.
 */
export class Grade {
    /**
     * Student ID
     */
    #studentId;

    /**
     * Class ID
     */
    #classId;

    /**
     * Date (YYYY-MM-DD format)
     */
    #date;

    /**
     * Grade number (1-6)
     */
    #note;

    /**
     * Comment/topic
     */
    #comment;

    /**
     * Student's first name
     */
    #vorname;

    /**
     * Student's last name
     */
    #nachname;

    /**
     * School year
     */
    #schuljahr;

    /**
     * Constructor
     * @param {string} studentId - Student ID
     * @param {string} classId - Class ID
     * @param {string} date - Date (YYYY-MM-DD)
     * @param {number|string|null} note - Grade (1-6)
     * @param {string} comment - Comment/topic
     * @param {string} vorname - First name
     * @param {string} nachname - Last name
     * @param {string} schuljahr - School year
     */
    constructor(studentId, classId, date, note, comment, vorname, nachname, schuljahr) {
        this.#studentId = studentId;
        this.#classId = classId;
        this.#date = date;
        this.#note = note;
        this.#comment = comment;
        this.#vorname = vorname;
        this.#nachname = nachname;
        this.#schuljahr = schuljahr;
    }

    /**
     * Get composite key for database (format: studentId_date_classId)
     * @returns {string} Composite key
     */
    getGradeId() {
        return `${this.#studentId}_${this.#date}_${this.#classId}`;
    }

    // Getters for all properties
    get studentId() { return this.#studentId; }
    get classId() { return this.#classId; }
    get date() { return this.#date; }
    get note() { return this.#note; }
    get comment() { return this.#comment; }
    get vorname() { return this.#vorname; }
    get nachname() { return this.#nachname; }
    get schuljahr() { return this.#schuljahr; }

    /**
     * Format date from YYYY-MM-DD to DD.MM.YYYY
     * @returns {string} Formatted date
     */
    getFormattedDate() {
        const parts = this.#date.split('-');
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }

    /**
     * Check if grade is empty (no note and no comment)
     * @returns {boolean} True if empty
     */
    isEmpty() {
        return !this.#note && !this.#comment;
    }

    /**
     * Convert to plain object for encryption/storage
     * The encrypted payload only contains note and comment
     * @returns {Object} Plain object for encryption
     */
    toEncryptedPayload() {
        return {
            note: this.#note,
            comment: this.#comment
        };
    }

    /**
     * Convert to database format (with encrypted data)
     * @param {Object} encryptedData - Encrypted payload
     * @returns {Object} Database object
     */
    toDatabaseFormat(encryptedData) {
        return {
            studentId: this.#studentId,
            classId: this.#classId,
            date: this.#date,
            studentId_date_class: this.getGradeId(),
            encryptedData,
            vorname: this.#vorname,
            nachname: this.#nachname,
            schuljahr: this.#schuljahr
        };
    }

    /**
     * Create a Grade instance from database data and decrypted payload
     * @param {Object} dbData - Database data
     * @param {Object} decryptedPayload - Decrypted grade data
     * @returns {Grade} Grade instance
     */
    static fromDatabase(dbData, decryptedPayload) {
        return new Grade(
            dbData.studentId,
            dbData.classId,
            dbData.date,
            decryptedPayload.note,
            decryptedPayload.comment,
            dbData.vorname,
            dbData.nachname,
            dbData.schuljahr
        );
    }
}
