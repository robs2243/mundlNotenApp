// Import necessary modules from Firebase SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
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
    const logoutButton = document.getElementById('logoutButton');

    // App State
    const letzteKommentare = new Set();
    let localGradesCache = {}; // Cache for decrypted grades for the current session

    // --- 1. AUTHENTICATION & INITIALIZATION ---

    picsUploadButton.addEventListener('click', () => {
        window.location.href = 'picsupload.html';
    });

    if (logoutButton) {
        logoutButton.disabled = true;
        logoutButton.addEventListener('click', async () => {
            logoutButton.disabled = true;
            statusDiv.textContent = 'Abmelden laeuft...';
            statusDiv.style.backgroundColor = '#ff9800';
            try {
                await signOut(auth);
            } catch (error) {
                console.error('Logout error:', error);
                statusDiv.textContent = 'Abmelden fehlgeschlagen. Bitte erneut versuchen.';
                statusDiv.style.backgroundColor = '#f44336';
                logoutButton.disabled = false;
            }
        });
    }
    // Set today's date in date picker
    dateSelector.valueAsDate = new Date();

        
    // Initialize class selector if school year is already set
    const schoolYear = document.getElementById('schoolYear').value.trim();
    if (schoolYear) {
        loadClassesForSchoolYear();
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            statusDiv.textContent = `Logged in as ${user.email}. Ready.`;
            statusDiv.style.backgroundColor = '#4CAF50';
            if (logoutButton) {
                logoutButton.disabled = false;
            }

            const encPassword = document.getElementById('encryptionPassword').value;
            const selectedSchoolYear = document.getElementById('schoolYear').value.trim();
            const classId = document.getElementById('classSelector').value;
            if (encPassword && selectedSchoolYear && classId) {
                loadStudentImages();
            }
        } else {
            statusDiv.textContent = 'Not logged in. Redirecting...';
            statusDiv.style.backgroundColor = '#f44336';
            if (logoutButton) {
                logoutButton.disabled = true;
            }
            const target = window.location.pathname + window.location.search + window.location.hash;
            sessionStorage.setItem('redirectTo', target);
            window.location.href = 'login.html';
        }
    });

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

    // --- 3. STUDENT IMAGE LOADING ---

    async function loadStudentImages() {
        const encPassword = document.getElementById('encryptionPassword').value;
        if (!encPassword) {
            console.log("No encryption password provided");
            return;
        }
        
        const classId = document.getElementById('classSelector').value;
        if (!classId) {
            console.log("No class selected");
            return;
        }
        
        const schoolYear = document.getElementById('schoolYear').value.trim();
        if (!schoolYear) {
            console.log("No school year entered");
            return;
        }
        
        // Use the school year as entered (with spaces if that's how it's stored)
        const schoolYearPath = schoolYear;
        
        console.log(`Loading images for school year: "${schoolYearPath}", class: ${classId}`);
        
        try {
            // Get all students in the class for the school year
            const classRef = ref(database, `pictures/${schoolYearPath}/${classId}`);
            const snapshot = await get(classRef);
            
            if (snapshot.exists()) {
                const students = snapshot.val();
                const studentIds = Object.keys(students);
                console.log(`Found ${studentIds.length} students in the database`);
                
                // Get all student boxes in order
                const studentBoxes = document.querySelectorAll('.redBox');
                const totalBoxes = studentBoxes.length;
                console.log(`Found ${totalBoxes} student boxes to fill`);
                
                // Fill each box with the corresponding student image
                for (let i = 0; i < totalBoxes; i++) {
                    const box = studentBoxes[i];
                    const img = box.querySelector('img');
                    const label = box.querySelector('.student-label');
                    
                    // If we have a student for this box index
                    if (i < studentIds.length) {
                        const studentId = studentIds[i];
                        const studentData = students[studentId];
                        const { vorname, nachname, encryptedData, schuljahr } = studentData;
                        
                        console.log(`Processing student: ${vorname} ${nachname} (ID: ${studentId}) for box ${i}`);
                        
                        try {
                            // Store student metadata in the box
                            box.dataset.vorname = vorname;
                            box.dataset.nachname = nachname;
                            box.dataset.klasse = classId;
                            box.dataset.schuljahr = schuljahr; // Add school year
                            
                            // Update the alt text to show the actual student name
                            img.alt = `${vorname} ${nachname}`;
                            
                            // Set the label text
                            label.textContent = `${vorname} ${nachname}`;
                            
                            // Decrypt the image
                            const decryptedArrayBuffer = await decryptBinary(
                                encryptedData.encrypted,
                                encryptedData.iv,
                                encryptedData.salt,
                                encPassword
                            );
                            
                            // Convert ArrayBuffer to base64 using Blob API
                            const blob = new Blob([decryptedArrayBuffer]);
                            const base64String = await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = () => {
                                    const base64 = reader.result.split(',')[1];
                                    resolve(base64);
                                };
                                reader.onerror = reject;
                                reader.readAsDataURL(blob);
                            });
                            
                            // Set the image source and make it visible
                            img.src = `data:image/jpeg;base64,${base64String}`;
                            img.style.display = 'block'; // Show the image
                            console.log(`Successfully loaded image for ${vorname} ${nachname} in box ${i}`);
                        } catch (decryptError) {
                            console.error(`Failed to decrypt image for ${vorname} ${nachname}:`, decryptError);
                            
                            // IMPORTANT: Clear metadata and label if decryption fails
                            delete box.dataset.vorname;
                            delete box.dataset.nachname;
                            delete box.dataset.klasse;
                            delete box.dataset.schuljahr;
                            label.textContent = '';
                            
                            // Keep the image hidden
                            img.style.display = 'none';
                            img.alt = '';
                        }
                    } else {
                        // If we have more boxes than students, keep the image hidden
                        console.log(`No student available for box ${i}, keeping box empty`);
                        
                        // Ensure the image is hidden
                        img.style.display = 'none';
                        img.alt = '';
                        
                        // Clear the label text
                        label.textContent = '';
                        
                        // Clear any existing metadata for empty boxes
                        delete box.dataset.vorname;
                        delete box.dataset.nachname;
                        delete box.dataset.klasse;
                        delete box.dataset.schuljahr;
                    }
                }
            } else {
                console.log(`No students found for class ${classId} in school year ${schoolYearPath}`);
                Swal.fire('Info', `Keine Schülerdaten für Klasse ${classId} im Schuljahr ${schoolYearPath} gefunden.`, 'info');
            }
        } catch (error) {
            console.error("Error loading student images:", error);
            Swal.fire('Fehler', 'Fehler beim Laden der Bilder: ' + error.message, 'error');
        }
    }

    // Add this new function for binary data (images)
    async function decryptBinary(encryptedBase64, ivBase64, saltBase64, password) {
        const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
        const key = await deriveKey(password, salt);
        const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
        const ciphertext = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
        return decrypted; // Returns ArrayBuffer
    }

    // --- 4. CORE APPLICATION LOGIC ---
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
        
        // Check if student data is loaded
        const vorname = box.dataset.vorname;
        const nachname = box.dataset.nachname;
        
        // If no student metadata is available, show "No data loaded!" message
        if (!vorname || !nachname) {
            Swal.fire({
                title: 'No data loaded!',
                text: 'Keine Schülerdaten für dieses Feld geladen.',
                icon: 'info',
                confirmButtonText: 'OK'
            });
            return;
        }
        
        // Get student metadata from the box
        const klasse = box.dataset.klasse;
        const schuljahr = box.dataset.schuljahr;
        const studentName = `${vorname} ${nachname}`;
        const studentId = `${vorname}_${nachname}`;
        const classId = klasse || document.getElementById('classSelector').value;
        
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
            title: `Bewertung für ${studentName}`,
            html: `
                <div class="swal2-form">
                    <div style="margin-bottom: 10px; font-size: 14px; color: #666;">
                        <strong>Klasse:</strong> ${klasse || 'N/A'} | 
                        <strong>Schuljahr:</strong> ${schuljahr || 'N/A'}
                    </div>
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
                    
                    // Get student data from the box dataset
                    const nachname = box.dataset.nachname;
                    const vorname = box.dataset.vorname;
                    const schuljahr = box.dataset.schuljahr;
                    
                    const newGradeData = {
                        studentId,
                        classId,
                        date,
                        studentId_date_class: gradeId,
                        encryptedData,
                        nachname,        // Add last name
                        vorname,         // Add first name
                        schuljahr        // Add school year
                    };
                    
                    await set(ref(database, 'grades/' + gradeId), newGradeData);
                    if (comment) letzteKommentare.add(comment);
                    localGradesCache[studentId] = { note, comment };
                } catch (error) {
                    Swal.fire('Fehler!', 'Daten konnten nicht gespeichert werden: ' + error.message, 'error');
                }
            }
        });
    });

    // --- 5. EVENT LISTENERS ---

    // Load classes when school year changes
    document.getElementById('schoolYear').addEventListener('input', () => {
        // Reset all images to default first
        resetAllImagesToDefault();
        
        // Then load classes for the new school year
        loadClassesForSchoolYear();
    });

    // Load images when class is changed
    document.getElementById('classSelector').addEventListener('change', () => {
        // Reset all images to default first
        resetAllImagesToDefault();
        
        const encPassword = document.getElementById('encryptionPassword').value;
        const schoolYear = document.getElementById('schoolYear').value.trim();
        const classId = document.getElementById('classSelector').value;
        
        if (encPassword && schoolYear && classId) {
            loadStudentImages();
        }
    });

    // Load images when password is entered
    document.getElementById('encryptionPassword').addEventListener('input', () => {
        const schoolYear = document.getElementById('schoolYear').value.trim();
        const classId = document.getElementById('classSelector').value;
        
        if (schoolYear && classId) {
            // Reset all images and metadata before loading with new password
            resetAllImagesToDefault();
            loadStudentImages();
        }
    });

    // Excel Export Button
    const excelExportButton = document.getElementById('excelExport');
        if (excelExportButton) {
            excelExportButton.addEventListener('click', () => {
                window.location.href = 'export.html';
            });
    }
    // --- 6. HELPER FUNCTIONS ---

    async function loadClassesForSchoolYear() {
        const schoolYear = document.getElementById('schoolYear').value.trim();
        const classSelector = document.getElementById('classSelector');
        
        // Clear existing options except the first one
        while (classSelector.options.length > 1) {
            classSelector.remove(1);
        }
        
        // Reset images to default when school year changes
        resetAllImagesToDefault();
        
        if (!schoolYear) {
            return;
        }
        
        console.log(`Loading classes for school year: "${schoolYear}"`);
        
        try {
            // Get all classes for the school year
            const classesRef = ref(database, `pictures/${schoolYear}`);
            const snapshot = await get(classesRef);
            
            if (snapshot.exists()) {
                const classes = snapshot.val();
                const classNames = Object.keys(classes);
                console.log(`Found ${classNames.length} classes: ${classNames.join(', ')}`);
                
                // Add each class as an option
                classNames.forEach(className => {
                    const option = document.createElement('option');
                    option.value = className;
                    option.textContent = className;
                    classSelector.appendChild(option);
                });
                
                // If there's only one class, select it automatically
                if (classNames.length === 1) {
                    classSelector.value = classNames[0];
                    // Trigger the change event to load images if password is available
                    if (document.getElementById('encryptionPassword').value) {
                        loadStudentImages();
                    }
                }
            } else {
                console.log(`No classes found for school year: ${schoolYear}`);
                
                // Add a "no classes found" option
                const option = document.createElement('option');
                option.value = "";
                option.textContent = "Keine Klassen gefunden";
                option.disabled = true;
                classSelector.appendChild(option);
            }
        } catch (error) {
            console.error("Error loading classes:", error);
            
            // Add an error option
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "Fehler beim Laden";
            option.disabled = true;
            classSelector.appendChild(option);
        }
    }

    function resetAllImagesToDefault() {
        const studentBoxes = document.querySelectorAll('.redBox');
        
        studentBoxes.forEach((box) => {
            const img = box.querySelector('img');
            const label = box.querySelector('.student-label');
            
            // Hide the image element completely
            img.style.display = 'none';
            
            // Clear the alt text
            img.alt = '';
            
            // Clear the label text
            label.textContent = '';
            
            // Remove ALL student metadata
            delete box.dataset.vorname;
            delete box.dataset.nachname;
            delete box.dataset.klasse;
            delete box.dataset.schuljahr;
            
            // Remove selection class if present
            box.classList.remove('bild-selektiert');
        });
        
        console.log("All images, labels and metadata reset to empty boxes");
    }
});