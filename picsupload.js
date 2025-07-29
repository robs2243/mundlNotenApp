// Import necessary modules from Firebase SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { getDatabase, ref, set } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js';

document.addEventListener('DOMContentLoaded', () => {
    // Firebase Config (kopiert)
    const firebaseConfig = {
        apiKey: "AIzaSyCsI95RxiBk9GXaDpA39oJcyaPtVczr_Q4",
        authDomain: "mundlnotendb.firebaseapp.com",
        databaseURL: "https://mundlnotendb-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "mundlnotendb",
        storageBucket: "mundlnotendb.firebasestorage.app",
        messagingSenderId: "282603615680",
        appId: "1:282603615680:web:cfda956d14c3bcc6218425"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const database = getDatabase(app);

    // DOM Elements
    const statusDiv = document.getElementById('status');
    const encryptionPassword = document.getElementById('encryptionPassword');
    const schoolYearInput = document.getElementById('schoolYear');
    const classSelector = document.getElementById('classSelector');
    const imageUpload = document.getElementById('imageUpload');
    const previewContainer = document.getElementById('previewContainer');
    const uploadButton = document.getElementById('uploadButton');
    const backButton = document.getElementById('backButton');

    // Auto-Login (kopiert)
    async function autoLogin() {
        try {
            const response = await fetch('settings.json');
            if (!response.ok) throw new Error('settings.json not found');
            const settings = await response.json();
            await signInWithEmailAndPassword(auth, settings.email, settings.password);
        } catch (error) {
            statusDiv.textContent = `Auto-Login failed: ${error.message}`;
            statusDiv.style.backgroundColor = '#f44336'; // Red
        }
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            statusDiv.textContent = `Logged in as ${user.email}. Ready.`;
            statusDiv.style.backgroundColor = '#4CAF50'; // Green
        } else {
            statusDiv.textContent = 'Not logged in.';
            statusDiv.style.backgroundColor = '#f44336'; // Red
        }
    });

    autoLogin();

    // Crypto-Funktionen (kopiert)
    async function deriveKey(password, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
        return await crypto.subtle.deriveKey(
            { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
            keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
        );
    }

    async function encrypt(text, password) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const key = await deriveKey(password, salt);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv }, key, new TextEncoder().encode(text)
        );
        return {
            encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
            iv: btoa(String.fromCharCode(...iv)),
            salt: btoa(String.fromCharCode(...salt)),
        };
    }

    // Vorschau für mehrere Bilder anzeigen
    imageUpload.addEventListener('change', (e) => {
        previewContainer.innerHTML = '';
        const files = e.target.files;
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
                img.title = file.name; // Tooltip mit Dateiname
                previewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        }
    });

    // Batch-Upload-Logik
    uploadButton.addEventListener('click', async () => {
        const encPassword = encryptionPassword.value;
        if (!encPassword) {
            Swal.fire('Fehler', 'Bitte ein Verschlüsselungspasswort eingeben.', 'error');
            return;
        }
        const schoolYear = schoolYearInput.value.trim();
        if (!schoolYear) {
            Swal.fire('Fehler', 'Bitte ein Schuljahr eingeben.', 'error');
            return;
        }
        const classId = classSelector.value.trim();
        if (!classId) {
            Swal.fire('Fehler', 'Bitte eine Klasse eingeben.', 'error');
            return;
        }
        const files = imageUpload.files;
        if (files.length === 0) {
            Swal.fire('Fehler', 'Bitte Bilder auswählen.', 'error');
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (let file of files) {
            const fileName = file.name.replace(/\.[^/.]+$/, ""); // Entferne .jpg
            const parts = fileName.split('_');
            if (parts.length !== 2) {
                Swal.fire('Fehler', `Ungültiger Dateiname: ${file.name}. Erwartet: Nachname_Vorname.jpg`, 'error');
                errorCount++;
                continue;
            }
            const nachname = parts[0].trim();
            const vorname = parts[1].trim();
            const studentId = `${vorname}_${nachname}`; // Vorname_Nachname

            // Bild als Base64 lesen
            const reader = new FileReader();
            await new Promise((resolve) => {
                reader.onload = async (ev) => {
                    const base64Image = ev.target.result;
                    const base64Content = base64Image.split(',')[1]; // Reiner Base64

                    try {
                        const encryptedData = await encrypt(base64Content, encPassword);

                        // DB-Eintrag setzen
                        const studentRef = ref(database, `pictures/${schoolYear}/${classId}/${studentId}`);
                        await set(studentRef, {
                            encryptedData,
                            nachname,
                            vorname
                        });

                        successCount++;
                    } catch (error) {
                        errorCount++;
                        console.error(`Fehler bei ${file.name}:`, error);
                    }
                    resolve();
                };
                reader.readAsDataURL(file);
            });
        }

        Swal.fire('Fertig', `${successCount} Bilder erfolgreich hochgeladen, ${errorCount} Fehler.`, 'success');
        previewContainer.innerHTML = '';
        imageUpload.value = '';
    });

    // Zurück-Button
    backButton.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
});