// Import necessary modules from Firebase SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { getDatabase, ref, set, get, query, orderByChild, equalTo } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js';

document.addEventListener('DOMContentLoaded', () => {

    // Your Firebase Configuration
    const firebaseConfig = {
        apiKey: "AIzaSyCsI95RxiBk9GXaDpA39oJcyaPtVczr_Q4",
        authDomain: "mundlnotendb.firebaseapp.com",
        databaseURL: "https://mundlnotendb-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "mundlnotendb",
        storageBucket: "mundlnotendb.firebasestorage.app",
        messagingSenderId: "282603615680",
        appId: "1:282603615680:web:cfda956d14c3bcc6218425"
    };

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const database = getDatabase(app);

    // DOM Elements
    const statusDiv = document.getElementById('status');
    const dateSelector = document.getElementById('dateSelector');
    const grid = document.querySelector('.parent');

    //Button for uploading pictures
    const picsUploadButton = document.getElementById('picsUpload');

    // App State
    const letzteKommentare = new Set();
    let localGradesCache = {}; // Cache for decrypted grades for the current session

    // --- 1. AUTHENTICATION & INITIALIZATION ---

    picsUploadButton.addEventListener('click', () => {
         window.location.href = 'picsupload.html';
    })

    async function autoLogin() {
        try {
            const response = await fetch('settings.json');
            if (!response.ok) throw new Error('settings.json not found');
            const settings = await response.json();
            await signInWithEmailAndPassword(auth, settings.email, settings.password);
            //await signInWithEmailAndPassword(auth, 'test@test.de', '123456');
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

    // Set today's date in date picker
    dateSelector.valueAsDate = new Date();
    autoLogin();

    // --- 2. CRYPTOGRAPHY FUNCTIONS ---

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

    async function decrypt(encryptedBase64, ivBase64, saltBase64, password) {
        const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
        const key = await deriveKey(password, salt);
        const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
        const ciphertext = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
        return new TextDecoder().decode(decrypted);
    }

    // --- 3. CORE APPLICATION LOGIC ---

    grid.addEventListener('click', async (e) => {
    const box = e.target.closest('.redBox');
    if (!box) return;

    // Check for necessary inputs
    const encPassword = document.getElementById('encryptionPassword').value;
    if (!encPassword) {
        Swal.fire('Fehler', 'Bitte zuerst ein Verschlüsselungspasswort eingeben.', 'error');
        return;
    }

    document.querySelectorAll('.bild-selektiert').forEach(el => el.classList.remove('bild-selektiert'));
    box.classList.add('bild-selektiert');

    const studentId = box.dataset.studentId;
    const classId = document.getElementById('classSelector').value;
    const date = document.getElementById('dateSelector').value;

    let existingGrade = null;
    let snapshot;

    // --- Step 1: Try to read from the database ---
    try {
        const gradesRef = ref(database, 'grades');
        const q = query(gradesRef, orderByChild('studentId_date_class'), equalTo(`${studentId}_${date}_${classId}`));
        snapshot = await get(q);
    } catch (dbError) {
        console.error("Firebase Database Read Error:", dbError);
        Swal.fire('Datenbankfehler!', 'Die Daten konnten nicht gelesen werden. Prüfen Sie die Konsolenausgabe und stellen Sie sicher, dass der Index in den Firebase-Regeln gesetzt ist.', 'error');
        return;
    }

    // --- Step 2: If data exists, try to decrypt it ---
    if (snapshot.exists()) {
        try {
            const gradeData = Object.values(snapshot.val())[0];
            const decryptedPayload = await decrypt(gradeData.encryptedData.encrypted, gradeData.encryptedData.iv, gradeData.encryptedData.salt, encPassword);
            existingGrade = JSON.parse(decryptedPayload);
            localGradesCache[studentId] = existingGrade;
        } catch (decryptionError) {
            console.error("Decryption Error:", decryptionError);
            Swal.fire('Entschlüsselungsfehler!', 'Falsches Passwort oder die Daten sind beschädigt.', 'error');
            return;
        }
    }

    // --- Step 3: Show the SweetAlert Modal ---
    Swal.fire({
        title: `Bewertung für ${studentId.replace('_', ' ')}`,
        html: `
            <div class="swal2-form">
                <div class="swal2-radio-group">
                    ${[1, 2, 3, 4, 5, 6].map(n => `<label><input type="radio" name="note" value="${n}" id="note-${n}"><span>Note ${n}</span></label>`).join('')}
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

            if (existingGrade) {
                if (existingGrade.note) {
                    const radio = document.getElementById(`note-${existingGrade.note}`);
                    if (radio) radio.checked = true;
                }
                input.value = existingGrade.comment || '';
            }

            // Suggestion chips logic
            if (letzteKommentare.size) {
                letzteKommentare.forEach(c => {
                    const span = document.createElement('span');
                    span.className = 'suggestion-item';
                    span.textContent = c;
                    container.appendChild(span);
                });
            }
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
    }).then(async (res) => {
        if (res.isConfirmed) {
            const { note, comment } = res.value;
            if (!note && !comment) return; // Don't save empty grades

            const payload = JSON.stringify({ note, comment });
            try {
                const encryptedData = await encrypt(payload, encPassword);
                const gradeId = `${studentId}_${date}_${classId}`;
                const newGradeData = {
                    studentId,
                    classId,
                    date,
                    studentId_date_class: gradeId,
                    encryptedData
                };
                await set(ref(database, 'grades/' + gradeId), newGradeData);
                if (comment) letzteKommentare.add(comment);
                localGradesCache[studentId] = { note, comment };
                //Swal.fire('Gespeichert!', 'Die Note wurde sicher in der Datenbank gespeichert.', 'success');
            } catch (error) {
                Swal.fire('Fehler!', 'Daten konnten nicht gespeichert werden: ' + error.message, 'error');
            }
        }
    });
    });
});