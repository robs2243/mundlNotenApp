import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { getDatabase, ref, get } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js';

export class FirebaseService {
    constructor() {
        this.firebaseConfig = {
            apiKey: "AIzaSyCsI95RxiBk9GXaDpA39oJcyaPtVczr_Q4",
            authDomain: "mundlnotendb.firebaseapp.com",
            databaseURL: "https://mundlnotendb-default-rtdb.europe-west1.firebasedatabase.app",
            projectId: "mundlnotendb",
            storageBucket: "mundlnotendb.firebasestorage.app",
            messagingSenderId: "282603615680",
            appId: "1:282603615680:web:cfda956d14c3bcc6218425"
        };

        this.app = null;
        this.auth = null;
        this.database = null;
    }

    initialize() {
        this.app = initializeApp(this.firebaseConfig);
        this.auth = getAuth(this.app);
        this.database = getDatabase(this.app);
        console.log('Firebase initialized');
    }

    checkAuth(onAuthCallback) {
        onAuthStateChanged(this.auth, (user) => {
            onAuthCallback(user);
        });
    }

    async signOut() {
        await signOut(this.auth);
    }

    async getStudentsForClass(schoolYear, classId) {
        try {
            const classRef = ref(this.database, `pictures/${schoolYear}/${classId}`);
            const snapshot = await get(classRef);

            if (snapshot.exists()) {
                return snapshot.val();
            } else {
                return null;
            }
        } catch (error) {
            console.error("Error loading students:", error);
            throw error;
        }
    }

    async getClassesForSchoolYear(schoolYear) {
        try {
            const classesRef = ref(this.database, `pictures/${schoolYear}`);
            const snapshot = await get(classesRef);

            if (snapshot.exists()) {
                return Object.keys(snapshot.val());
            } else {
                return [];
            }
        } catch (error) {
            console.error("Error loading classes:", error);
            throw error;
        }
    }
}
