import { ref, set, get, query, orderByChild, equalTo } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js';
import { DatabaseService } from '../services/DatabaseService.js';

// GradesRepository owns every realtime database call for the grades collection.
// Controllers ask the repository for data which keeps database specific code out of the UI layer.
export class GradesRepository {
    constructor(databaseService = new DatabaseService()) {
        this.database = databaseService.getDatabase();
    }

    buildGradeId(studentId, date, classId) {
        return `${studentId}_${date}_${classId}`;
    }

    async findGrade(studentId, date, classId) {
        const gradesRef = ref(this.database, 'grades');
        const key = this.buildGradeId(studentId, date, classId);
        const gradeQuery = query(gradesRef, orderByChild('studentId_date_class'), equalTo(key));
        const snapshot = await get(gradeQuery);
        if (!snapshot.exists()) {
            return null;
        }
        const value = snapshot.val();
        const firstKey = Object.keys(value)[0];
        return value[firstKey];
    }

    async saveGrade(gradeRecord) {
        if (!gradeRecord.studentId || !gradeRecord.date || !gradeRecord.classId) {
            throw new Error('gradeRecord requires studentId, date and classId');
        }
        const gradeId = this.buildGradeId(gradeRecord.studentId, gradeRecord.date, gradeRecord.classId);
        const recordWithKey = {
            ...gradeRecord,
            studentId_date_class: gradeId
        };
        await set(ref(this.database, `grades/${gradeId}`), recordWithKey);
        return recordWithKey;
    }

    async fetchGradesForClass(schoolYear, classId) {
        const gradesRef = ref(this.database, 'grades');
        const snapshot = await get(gradesRef);
        if (!snapshot.exists()) {
            return [];
        }
        const allGrades = Object.values(snapshot.val());
        return allGrades.filter((grade) => grade.schuljahr === schoolYear && grade.classId === classId);
    }

    async fetchClassesForSchoolYear(schoolYear) {
        const gradesRef = ref(this.database, 'grades');
        const snapshot = await get(gradesRef);
        if (!snapshot.exists()) {
            return [];
        }
        const classes = new Set();
        Object.values(snapshot.val()).forEach((grade) => {
            if (grade && grade.schuljahr === schoolYear && grade.classId) {
                classes.add(grade.classId);
            }
        });
        return Array.from(classes);
    }
}
