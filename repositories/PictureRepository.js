import { ref, get, set } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js';
import { DatabaseService } from '../services/DatabaseService.js';

// PictureRepository centralises all interactions with the pictures branch in the database.
// Both the rating page (for display) and the upload page (for writes) rely on the same helper.
export class PictureRepository {
    constructor(databaseService = new DatabaseService()) {
        this.database = databaseService.getDatabase();
    }

    async fetchClassesForSchoolYear(schoolYear) {
        const classesRef = ref(this.database, pictures/);
        const snapshot = await get(classesRef);
        if (!snapshot.exists()) {
            return [];
        }
        return Object.keys(snapshot.val());
    }

    async fetchStudentsForClass(schoolYear, classId) {
        const classRef = ref(this.database, pictures//);
        const snapshot = await get(classRef);
        if (!snapshot.exists()) {
            return {};
        }
        return snapshot.val();
    }

    saveStudentPicture(schoolYear, classId, studentId, payload) {
        const studentRef = ref(this.database, pictures///);
        return set(studentRef, payload);
    }
}
