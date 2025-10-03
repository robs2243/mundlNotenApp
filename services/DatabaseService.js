import { getDatabase } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js';
import { FirebaseApp } from './FirebaseApp.js';

// DatabaseService centralises the creation of the realtime database instance.
// Repositories receive the database via this service which keeps wiring consistent.
export class DatabaseService {
    constructor(firebaseApp = FirebaseApp.getInstance()) {
        this.firebaseApp = firebaseApp;
        this.database = getDatabase(this.firebaseApp.getApp());
    }

    getDatabase() {
        return this.database;
    }
}
