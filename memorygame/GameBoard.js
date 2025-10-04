export class GameBoard {
    constructor() {
        this.students = [];
        this.shuffledPictures = [];
        this.shuffledNames = [];
        this.selectedPicture = null;
        this.selectedName = null;
        this.matchedStudents = new Set();
        this.isProcessing = false;
        this.tries = 0;
        this.startTime = null;
        this.endTime = null;
        this.timerInterval = null;
    }

    initialize(students) {
        this.students = students;
        this.shuffledPictures = this.shuffle([...students]);
        this.shuffledNames = this.shuffle([...students]);
        this.matchedStudents.clear();
        this.selectedPicture = null;
        this.selectedName = null;
        this.isProcessing = false;
        this.tries = 0;
        this.startTime = Date.now();
        this.endTime = null;
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

        this.tries++; // Increment try counter

        const isMatch = this.selectedPicture === this.selectedName;

        if (isMatch) {
            this.matchedStudents.add(this.selectedPicture);
        }

        const result = {
            isMatch,
            pictureId: this.selectedPicture,
            nameId: this.selectedName,
            tries: this.tries
        };

        if (isMatch) {
            this.selectedPicture = null;
            this.selectedName = null;
        }

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
            total: this.students.length,
            tries: this.tries
        };
    }

    getElapsedTime() {
        if (!this.startTime) return 0;
        const endTime = this.endTime || Date.now();
        return Math.floor((endTime - this.startTime) / 1000); // Return seconds
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    stopTimer() {
        this.endTime = Date.now();
    }
}
