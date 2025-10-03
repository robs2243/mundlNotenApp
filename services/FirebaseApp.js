import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { firebaseConfig } from './firebaseConfig.js';

// FirebaseApp wraps the SDK bootstrap so every consumer receives the same initialized app instance.
// The class acts as a tiny singleton helper that hides the global firebase state and centralises config usage.
export class FirebaseApp {
    constructor(config = firebaseConfig) {
        if (!FirebaseApp.instance) {
            const appCount = getApps().length;
            this.app = appCount ? getApp() : initializeApp(config);
            FirebaseApp.instance = this;
        }
        return FirebaseApp.instance;
    }

    static getInstance(config = firebaseConfig) {
        return FirebaseApp.instance || new FirebaseApp(config);
    }

    getApp() {
        return this.app;
    }
}
