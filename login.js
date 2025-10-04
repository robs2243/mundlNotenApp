import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';

const firebaseConfig = {
    apiKey: "AIzaSyCsI95RxiBk9GXaDpA39oJcyaPtVczr_Q4",
    authDomain: "mundlnotendb.firebaseapp.com",
    databaseURL: "https://mundlnotendb-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "mundlnotendb",
    storageBucket: "mundlnotendb.firebasestorage.app",
    messagingSenderId: "282603615680",
    appId: "1:282603615680:web:cfda956d14c3bcc6218425"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

const statusDiv = document.getElementById('status');
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('loginEmail');
const passwordInput = document.getElementById('loginPassword');
const submitButton = document.getElementById('loginSubmit');
const logoutButton = document.getElementById('logoutButton');

const STATUS_CLASSES = {
    info: 'status-info',
    success: 'status-success',
    error: 'status-error'
};

function setStatus(message, type = 'info') {
    statusDiv.textContent = message;
    Object.values(STATUS_CLASSES).forEach(cssClass => statusDiv.classList.remove(cssClass));
    const cssClass = STATUS_CLASSES[type] || STATUS_CLASSES.info;
    statusDiv.classList.add(cssClass);
}

function setInputsEnabled(enabled) {
    emailInput.disabled = !enabled;
    passwordInput.disabled = !enabled;
    submitButton.disabled = !enabled;
    submitButton.textContent = enabled ? 'Anmelden' : 'Anmeldung laeuft...';
}

function mapAuthError(error) {
    switch (error.code) {
        case 'auth/invalid-email':
            return 'Die E-Mail-Adresse ist ungueltig.';
        case 'auth/user-disabled':
            return 'Dieses Konto wurde deaktiviert. Bitte wenden Sie sich an den Administrator.';
        case 'auth/user-not-found':
            return 'Kein Konto mit dieser E-Mail-Adresse gefunden.';
        case 'auth/wrong-password':
            return 'Das Passwort ist falsch.';
        case 'auth/too-many-requests':
            return 'Zu viele fehlgeschlagene Versuche. Bitte warten Sie einen Moment.';
        default:
            return 'Anmeldung fehlgeschlagen: ' + (error.message || 'Unbekannter Fehler');
    }
}

async function ensurePersistence() {
    try {
        await setPersistence(auth, browserLocalPersistence);
    } catch (error) {
        console.warn('Konnte Anmeldespeicherung nicht setzen:', error);
    }
}

function resolveRedirectTarget() {
    const storedTarget = sessionStorage.getItem('mundl_redirectTo');
    if (storedTarget) {
        sessionStorage.removeItem('mundl_redirectTo');
        return storedTarget;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const queryTarget = urlParams.get('redirect');
    if (queryTarget) {
        return queryTarget;
    }

    return 'index.html';
}

authorun();

async function authorun() {
    await ensurePersistence();

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            setStatus('Bitte E-Mail und Passwort eingeben.', 'error');
            return;
        }

        setStatus('Anmeldung laeuft...', 'info');
        setInputsEnabled(false);

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error('Login error:', error);
            setStatus(mapAuthError(error), 'error');
            passwordInput.value = '';
            passwordInput.focus();
            setInputsEnabled(true);
        }
    });

    logoutButton.addEventListener('click', async () => {
        setInputsEnabled(false);
        setStatus('Melde ab...', 'info');
        try {
            await signOut(auth);
            setStatus('Abmeldung erfolgreich. Sie koennen sich erneut anmelden.', 'success');
            passwordInput.value = '';
            setInputsEnabled(true);
        } catch (error) {
            console.error('Logout error:', error);
            setStatus('Abmeldung fehlgeschlagen: ' + (error.message || error.code), 'error');
            setInputsEnabled(true);
        }
    });

    onAuthStateChanged(auth, (user) => {
        if (user) {
            setStatus(`Angemeldet als ${user.email}. Weiterleitung...`, 'success');
            logoutButton.hidden = false;
            setInputsEnabled(false);

            const target = resolveRedirectTarget();
            setTimeout(() => {
                window.location.href = target;
            }, 800);
        } else {
            setStatus('Bitte melden Sie sich an.', 'info');
            logoutButton.hidden = true;
            setInputsEnabled(true);
        }
    });
}
