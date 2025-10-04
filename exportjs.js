// Import necessary modules from Firebase SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { getDatabase, ref, set, get, query, orderByChild, equalTo } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js';

document.addEventListener('DOMContentLoaded', () => {
    // Firebase Configuration
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
    const encryptionPassword = document.getElementById('encryptionPassword');
    const schoolYearInput = document.getElementById('schoolYear');
    const classSelector = document.getElementById('classSelector');
    const exportButton = document.getElementById('exportButton');
    const backButton = document.getElementById('backButton');
    const logoutButton = document.getElementById('logoutButton');

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

    // --- 1. AUTHENTICATION & INITIALIZATION ---

    onAuthStateChanged(auth, (user) => {
        if (user) {
            statusDiv.textContent = `Logged in as ${user.email}. Ready.`;
            statusDiv.style.backgroundColor = '#4CAF50';
            if (logoutButton) {
                logoutButton.disabled = false;
            }
        } else {
            statusDiv.textContent = 'Not logged in. Redirecting...';
            statusDiv.style.backgroundColor = '#f44336';
            if (logoutButton) {
                logoutButton.disabled = true;
            }
            const target = window.location.pathname + window.location.search + window.location.hash;
            sessionStorage.setItem('mundl_redirectTo', target);
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

    async function decrypt(encryptedBase64, ivBase64, saltBase64, password) {
        const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
        const key = await deriveKey(password, salt);
        const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
        const ciphertext = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
        return new TextDecoder().decode(decrypted);
    }

    // --- 3. LOAD CLASSES FOR SCHOOL YEAR ---

    schoolYearInput.addEventListener('input', async () => {
        const schoolYear = schoolYearInput.value.trim();
        
        // Clear existing options
        classSelector.innerHTML = '<option value="">Klasse auswählen</option>';
        
        if (!schoolYear) {
            console.log("No school year entered");
            return;
        }
        
        console.log(`Loading classes for school year: ${schoolYear}`);
        
        try {
            // Get all grades (without filtering)
            const gradesRef = ref(database, 'grades');
            const snapshot = await get(gradesRef);
            
            console.log("Query executed, snapshot exists:", snapshot.exists());
            
            if (snapshot.exists()) {
                const grades = snapshot.val();
                console.log("Grades data retrieved");
                
                const classes = new Set();
                
                // Extract unique classes for the selected school year
                Object.entries(grades).forEach(([key, grade]) => {
                    console.log(`Processing grade ${key}:`, grade);
                    // Check if the grade has the required fields
                    if (grade && grade.schuljahr === schoolYear && grade.classId) {
                        classes.add(grade.classId);
                    }
                });
                
                console.log("Found classes:", Array.from(classes));
                
                // Convert to array and sort
                const sortedClasses = Array.from(classes).sort();
                
                if (sortedClasses.length === 0) {
                    // Add a "no classes found" option
                    const option = document.createElement('option');
                    option.value = "";
                    option.textContent = "Keine Klassen gefunden";
                    option.disabled = true;
                    classSelector.appendChild(option);
                } else {
                    // Add options to class selector
                    sortedClasses.forEach(cls => {
                        const option = document.createElement('option');
                        option.value = cls;
                        option.textContent = cls;
                        classSelector.appendChild(option);
                    });
                }
            } else {
                console.log("No grades found in the database");
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
    });

    // --- 4. EXPORT FUNCTIONALITY ---

    exportButton.addEventListener('click', async () => {
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
        
        const classId = classSelector.value;
        if (!classId) {
            Swal.fire('Fehler', 'Bitte eine Klasse auswählen.', 'error');
            return;
        }
        
        try {
            // Get all grades (without filtering)
            const gradesRef = ref(database, 'grades');
            const snapshot = await get(gradesRef);
            
            if (!snapshot.exists()) {
                Swal.fire('Info', 'Keine Noten in der Datenbank gefunden.', 'info');
                return;
            }
            
            const allGrades = snapshot.val();
            const grades = {};
            
            // Filter grades by school year and class
            Object.entries(allGrades).forEach(([key, grade]) => {
                // Check if the grade has the required fields and matches the criteria
                if (grade && grade.schuljahr === schoolYear && grade.classId === classId) {
                    grades[key] = grade;
                }
            });
            
            console.log(`Found ${Object.keys(grades).length} grades for ${schoolYear} and class ${classId}`);
            
            if (Object.keys(grades).length === 0) {
                Swal.fire('Info', `Keine Noten für Klasse ${classId} im Schuljahr ${schoolYear} gefunden.`, 'info');
                return;
            }
            
            const csvData = [];
            
            // Add CSV header
            csvData.push(['Vorname', 'Nachname', 'Datum', 'Thema', 'Note']);
            
            // Process each grade
            for (const [key, grade] of Object.entries(grades)) {
                try {
                    // Decrypt the grade data
                    const decryptedPayload = await decrypt(
                        grade.encryptedData.encrypted, 
                        grade.encryptedData.iv, 
                        grade.encryptedData.salt, 
                        encPassword
                    );
                    
                    const gradeData = JSON.parse(decryptedPayload);
                    
                    // Format date from YYYY-MM-DD to DD.MM.YYYY
                    const dateParts = grade.date.split('-');
                    const formattedDate = `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}`;
                    
                    // Add row to CSV data
                    csvData.push([
                        grade.vorname || '',
                        grade.nachname || '',
                        formattedDate,
                        gradeData.comment || '',
                        gradeData.note || ''
                    ]);
                } catch (decryptError) {
                    console.error(`Fehler beim Entschlüsseln der Note für ${key}:`, decryptError);
                }
            }
            
            // Generate CSV content
            const csvContent = csvData.map(row => 
                row.map(field => `"${field}"`).join(';')
            ).join('\n');
            
            // Create download link
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `Noten_${classId}_${schoolYear}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            Swal.fire('Erfolg', 'CSV-Datei wurde erfolgreich heruntergeladen.', 'success');
        } catch (error) {
            console.error("Export error:", error);
            Swal.fire('Fehler', 'Fehler beim Exportieren der Daten: ' + error.message, 'error');
        }
    });

    // --- 5. NAVIGATION ---

    backButton.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
});