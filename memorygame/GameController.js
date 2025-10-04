import { FirebaseService } from './FirebaseService.js';
import { CryptoService } from './CryptoService.js';
import { Student } from './Student.js';
import { GameBoard } from './GameBoard.js';
import { UIManager } from './UIManager.js';

export class GameController {
    constructor() {
        this.firebaseService = new FirebaseService();
        this.cryptoService = new CryptoService();
        this.gameBoard = new GameBoard();
        this.uiManager = new UIManager();

        this.students = [];
        this.isGameActive = false;
        this.timerInterval = null;
        this.currentUser = null;
        this.currentClass = null;
        this.currentSchoolYear = null;
        this.isMobileMode = false;
        this.firstNameOnly = false;
    }

    isMobileDevice() {
        return window.innerWidth <= 768;
    }

    initialize() {
        this.firebaseService.initialize();
        this.setupEventListeners();
        this.checkAuthentication();
    }

    checkAuthentication() {
        this.firebaseService.checkAuth((user) => {
            if (user) {
                this.currentUser = user;
                this.uiManager.showStatus(`Eingeloggt als ${user.email}`, 'success');
                document.getElementById('logoutButton').disabled = false;
            } else {
                this.uiManager.showStatus('Nicht eingeloggt. Weiterleitung...', 'error');
                document.getElementById('logoutButton').disabled = true;
                const target = window.location.pathname + window.location.search + window.location.hash;
                sessionStorage.setItem('redirectTo', target);
                window.location.href = '../login.html';
            }
        });
    }

    setupEventListeners() {
        // School year input - load classes
        document.getElementById('schoolYear').addEventListener('input', async () => {
            await this.loadClasses();
        });

        // Start game button
        document.getElementById('startGame').addEventListener('click', async () => {
            await this.startGame();
        });

        // Reset game button
        document.getElementById('resetGame').addEventListener('click', () => {
            this.resetGame();
        });

        // Back button
        document.getElementById('backButton').addEventListener('click', () => {
            window.location.href = '../index.html';
        });

        // Logout button
        document.getElementById('logoutButton').addEventListener('click', async () => {
            await this.logout();
        });
    }

    async loadClasses() {
        const schoolYear = document.getElementById('schoolYear').value.trim();
        const classSelector = document.getElementById('classSelector');

        // Clear existing options
        classSelector.innerHTML = '<option value="">Klasse auswählen</option>';

        if (!schoolYear) return;

        try {
            const classes = await this.firebaseService.getClassesForSchoolYear(schoolYear);

            if (classes.length === 0) {
                const option = document.createElement('option');
                option.value = "";
                option.textContent = "Keine Klassen gefunden";
                option.disabled = true;
                classSelector.appendChild(option);
            } else {
                classes.forEach(className => {
                    const option = document.createElement('option');
                    option.value = className;
                    option.textContent = className;
                    classSelector.appendChild(option);
                });
            }
        } catch (error) {
            console.error("Error loading classes:", error);
            this.uiManager.showError('Fehler beim Laden der Klassen');
        }
    }

    async startGame() {
        const password = document.getElementById('encryptionPassword').value;
        const schoolYear = document.getElementById('schoolYear').value.trim();
        const classId = document.getElementById('classSelector').value;

        if (!password) {
            await this.uiManager.showError('Bitte Verschlüsselungspasswort eingeben');
            return;
        }

        if (!schoolYear) {
            await this.uiManager.showError('Bitte Schuljahr eingeben');
            return;
        }

        if (!classId) {
            await this.uiManager.showError('Bitte Klasse auswählen');
            return;
        }

        this.currentSchoolYear = schoolYear;
        this.currentClass = classId;

        this.uiManager.showStatus('Lade Schülerdaten...', 'info');

        try {
            const studentsData = await this.firebaseService.getStudentsForClass(schoolYear, classId);

            if (!studentsData) {
                await this.uiManager.showError('Keine Schüler in dieser Klasse gefunden');
                return;
            }

            // Create Student objects
            this.students = [];
            for (const [studentId, data] of Object.entries(studentsData)) {
                const student = new Student(
                    studentId,
                    data.vorname,
                    data.nachname,
                    data.schuljahr,
                    data.encryptedData
                );

                const decrypted = await student.decrypt(this.cryptoService, password);

                if (decrypted) {
                    this.students.push(student);
                }
            }

            if (this.students.length === 0) {
                await this.uiManager.showError('Keine Bilder konnten entschlüsselt werden. Falsches Passwort?');
                return;
            }

            // Initialize game
            this.gameBoard.initialize(this.students);
            this.isGameActive = true;

            // Start timer display update
            this.startTimerDisplay();

            // Get checkbox state
            this.firstNameOnly = document.getElementById('firstNameOnly').checked;

            // Detect mobile mode
            this.isMobileMode = this.isMobileDevice();

            // Render UI
            this.uiManager.renderPictures(
                this.gameBoard.shuffledPictures,
                (id) => this.handlePictureClick(id)
            );

            if (this.isMobileMode) {
                // Hide names section on mobile
                this.uiManager.hideNamesSection();
            } else {
                // Show names section on desktop
                this.uiManager.showNamesSection();
                this.uiManager.renderNames(
                    this.gameBoard.shuffledNames,
                    (id) => this.handleNameClick(id),
                    this.firstNameOnly
                );
            }

            this.uiManager.showStatus(`Spiel gestartet! ${this.students.length} Schüler geladen`, 'success');

        } catch (error) {
            console.error("Error starting game:", error);
            await this.uiManager.showError('Fehler beim Starten des Spiels: ' + error.message);
        }
    }

    async handlePictureClick(studentId) {
        console.log('=== PICTURE CLICKED ===');
        console.log('Student ID:', studentId);
        console.log('Is Game Active:', this.isGameActive);
        console.log('Is Mobile Mode:', this.isMobileMode);
        console.log('Is Processing:', this.gameBoard.isProcessing);
        console.log('Already Matched:', this.gameBoard.matchedStudents.has(studentId));
        console.log('Matched Students:', Array.from(this.gameBoard.matchedStudents));

        if (!this.isGameActive) return;

        if (this.isMobileMode) {
            // Check if student is already matched
            if (this.gameBoard.matchedStudents.has(studentId)) {
                console.log('→ BLOCKED: Student already matched');
                return;
            }

            // Prevent multiple popups
            if (this.gameBoard.isProcessing) {
                console.log('→ BLOCKED: Already processing');
                return;
            }

            console.log('→ SHOWING POPUP');
            this.gameBoard.isProcessing = true;

            // Mobile mode: show popup with name choices (only unmatched students)
            const unmatchedStudents = this.gameBoard.shuffledNames.filter(
                student => !this.gameBoard.matchedStudents.has(student.id)
            );

            console.log('Unmatched students count:', unmatchedStudents.length);
            console.log('Unmatched student IDs:', unmatchedStudents.map(s => s.id));

            const selectedNameId = await this.uiManager.showMobileNameSelector(
                unmatchedStudents,
                this.firstNameOnly
            );

            console.log('User selected name ID:', selectedNameId);

            if (!selectedNameId) {
                // User cancelled
                console.log('→ USER CANCELLED');
                this.gameBoard.isProcessing = false;
                return;
            }

            // Set both selections
            this.gameBoard.selectedPicture = studentId;
            this.gameBoard.selectedName = selectedNameId;

            // Debug logging
            console.log('Mobile Match Check:');
            console.log('  Picture ID:', studentId);
            console.log('  Selected Name ID:', selectedNameId);
            console.log('  Match:', studentId === selectedNameId);

            // Check match immediately
            this.checkForMatchMobile();

        } else {
            // Desktop mode: normal selection
            const clicked = this.gameBoard.handlePictureClick(studentId);
            if (!clicked) return;

            this.uiManager.highlightSelection(
                this.gameBoard.selectedPicture,
                this.gameBoard.selectedName
            );

            this.checkForMatch();
        }
    }

    handleNameClick(studentId) {
        if (!this.isGameActive) return;

        const clicked = this.gameBoard.handleNameClick(studentId);
        if (!clicked) return;

        this.uiManager.highlightSelection(
            this.gameBoard.selectedPicture,
            this.gameBoard.selectedName
        );

        this.checkForMatch();
    }

    checkForMatchMobile() {
        console.log('→ CHECKING MATCH (Mobile)');
        const matchResult = this.gameBoard.checkMatch();
        console.log('Match result:', matchResult);

        if (matchResult) {
            if (matchResult.isMatch) {
                console.log('✓ CORRECT MATCH!');
                // Mark as matched (fade out)
                this.uiManager.markAsMatched(matchResult.pictureId);

                const progress = this.gameBoard.getProgress();
                this.uiManager.showStatus(
                    `Richtig! ${progress.matched} von ${progress.total} gefunden. Du hast ${progress.tries} Versuche gebraucht.`,
                    'success'
                );

                // Release processing lock
                console.log('→ Releasing processing lock (correct match)');
                this.gameBoard.isProcessing = false;

                if (this.gameBoard.isComplete()) {
                    this.isGameActive = false;
                    this.gameBoard.stopTimer();
                    this.stopTimerDisplay();

                    const elapsedTime = this.gameBoard.getElapsedTime();

                    setTimeout(async () => {
                        const previousBestTime = await this.firebaseService.getBestTimeForUserAndClass(
                            this.currentUser.uid,
                            this.currentSchoolYear,
                            this.currentClass
                        );

                        await this.saveHighscore(progress.total, progress.tries, elapsedTime);

                        const isNewHighscore = previousBestTime === null || elapsedTime < previousBestTime;

                        await this.uiManager.showVictory(
                            progress.total,
                            progress.tries,
                            elapsedTime,
                            isNewHighscore,
                            previousBestTime
                        );
                    }, 500);
                }
            } else {
                // Wrong match
                console.log('✗ WRONG MATCH!');
                this.uiManager.showStatus('Nicht richtig! Versuche es nochmal', 'error');

                // Release processing lock after delay
                setTimeout(() => {
                    console.log('→ Releasing processing lock (wrong match)');
                    this.gameBoard.reset();
                    this.gameBoard.isProcessing = false;
                    const progress = this.gameBoard.getProgress();
                    this.uiManager.showStatus(
                        `${progress.matched} von ${progress.total} gefunden`,
                        'info'
                    );
                }, 1000);
            }
        }
    }

    checkForMatch() {
        const matchResult = this.gameBoard.checkMatch();

        if (matchResult) {
            if (matchResult.isMatch) {
                this.uiManager.markAsMatched(matchResult.pictureId);

                const progress = this.gameBoard.getProgress();
                this.uiManager.showStatus(
                    `Richtig! ${progress.matched} von ${progress.total} gefunden. Du hast ${progress.tries} Versuche gebraucht.`,
                    'success'
                );

                if (this.gameBoard.isComplete()) {
                    this.isGameActive = false;
                    this.gameBoard.stopTimer();
                    this.stopTimerDisplay();

                    const elapsedTime = this.gameBoard.getElapsedTime();

                    setTimeout(async () => {
                        // Get previous best time BEFORE saving the new score
                        const previousBestTime = await this.firebaseService.getBestTimeForUserAndClass(
                            this.currentUser.uid,
                            this.currentSchoolYear,
                            this.currentClass
                        );

                        // Save the new score
                        await this.saveHighscore(progress.total, progress.tries, elapsedTime);

                        // Check if it's a new highscore
                        const isNewHighscore = previousBestTime === null || elapsedTime < previousBestTime;

                        // Show victory message with highscore info
                        await this.uiManager.showVictory(
                            progress.total,
                            progress.tries,
                            elapsedTime,
                            isNewHighscore,
                            previousBestTime
                        );
                    }, 500);
                }
            } else {
                this.uiManager.showStatus('Nicht richtig! Versuche es nochmal', 'error');
                setTimeout(() => {
                    this.gameBoard.reset();
                    this.uiManager.clearSelections();
                    const progress = this.gameBoard.getProgress();
                    this.uiManager.showStatus(
                        `${progress.matched} von ${progress.total} gefunden`,
                        'info'
                    );
                }, 1000);
            }
        }
    }

    startTimerDisplay() {
        const timerElement = document.getElementById('timer');
        this.timerInterval = setInterval(() => {
            const elapsedTime = this.gameBoard.getElapsedTime();
            const formattedTime = this.gameBoard.formatTime(elapsedTime);
            timerElement.textContent = `Zeit: ${formattedTime}`;
        }, 1000);
    }

    stopTimerDisplay() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    async saveHighscore(totalStudents, tries, timeInSeconds) {
        try {
            const highscoreData = {
                userEmail: this.currentUser.email,
                userId: this.currentUser.uid,
                schoolYear: this.currentSchoolYear,
                classId: this.currentClass,
                totalStudents: totalStudents,
                tries: tries,
                timeInSeconds: timeInSeconds,
                date: new Date().toISOString(),
                timestamp: Date.now()
            };

            await this.firebaseService.saveHighscore(highscoreData);
            console.log("Highscore saved:", highscoreData);
        } catch (error) {
            console.error("Error saving highscore:", error);
        }
    }

    resetGame() {
        this.isGameActive = false;
        this.students = [];
        this.gameBoard = new GameBoard();
        this.uiManager.clearGame();
        this.stopTimerDisplay();
        document.getElementById('timer').textContent = 'Zeit: 0:00';
        this.uiManager.showStatus('Spiel zurückgesetzt', 'info');
    }

    async logout() {
        try {
            await this.firebaseService.signOut();
        } catch (error) {
            console.error("Logout error:", error);
        }
    }
}
