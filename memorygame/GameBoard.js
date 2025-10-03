export class GameBoard {
    constructor() {
        this.students = [];
        this.shuffledPictures = [];
        this.shuffledNames = [];
        this.selectedPicture = null;
        this.selectedName = null;
        this.matchedStudents = new Set();
        this.isProcessing = false;
    }

    initialize(students) {
        this.students = students;
        this.shuffledPictures = this.shuffle([...students]);
        this.shuffledNames = this.shuffle([...students]);
        this.matchedStudents.clear();
        this.selectedPicture = null;
        this.selectedName = null;
        this.isProcessing = false;
        console.log(`GameBoard initialized with ${students.length} students`);
    }

    shuffle(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    handlePictureClick(studentId) {
        if (this.isProcessing || this.matchedStudents.has(studentId)) {
            return false;
        }

        if (this.selectedPicture === studentId) {
            this.selectedPicture = null;
        } else {
            this.selectedPicture = studentId;
        }

        return true;
    }

    handleNameClick(studentId) {
        if (this.isProcessing || this.matchedStudents.has(studentId)) {
            return false;
        }

        if (this.selectedName === studentId) {
            this.selectedName = null;
        } else {
            this.selectedName = studentId;
        }

        return true;
    }

    checkMatch() {
        if (!this.selectedPicture || !this.selectedName) {
            return null;
        }

        this.isProcessing = true;

        const isMatch = this.selectedPicture === this.selectedName;

        if (isMatch) {
            this.matchedStudents.add(this.selectedPicture);
        }

        const result = {
            isMatch,
            pictureId: this.selectedPicture,
            nameId: this.selectedName
        };

        if (isMatch) {
            this.selectedPicture = null;
            this.selectedName = null;
        }

        this.isProcessing = false;

        return result;
    }

    reset() {
        this.selectedPicture = null;
        this.selectedName = null;
    }

    isComplete() {
        return this.matchedStudents.size === this.students.length;
    }

    getProgress() {
        return {
            matched: this.matchedStudents.size,
            total: this.students.length
        };
    }
}
