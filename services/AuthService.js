import { getAuth, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { FirebaseApp } from './FirebaseApp.js';

// AuthService encapsulates every authentication related call, giving pages a tiny OOP façade around Firebase Auth.
// All pages talk to AuthService instead of importing firebase-auth directly which reduces duplication and eases testing.
export class AuthService {
    constructor(firebaseApp = FirebaseApp.getInstance()) {
        this.firebaseApp = firebaseApp;
        this.auth = getAuth(this.firebaseApp.getApp());
    }

    async ensureLocalPersistence() {
        try {
            await setPersistence(this.auth, browserLocalPersistence);
            return true;
        } catch (error) {
            console.warn('Konnte Anmeldespeicherung nicht setzen:', error);
            return false;
        }
    }

    login(email, password) {
        return signInWithEmailAndPassword(this.auth, email, password);
    }

    logout() {
        return signOut(this.auth);
    }

    onAuthChange(callback) {
        return onAuthStateChanged(this.auth, callback);
    }

    getCurrentUser() {
        return this.auth.currentUser;
    }
}
