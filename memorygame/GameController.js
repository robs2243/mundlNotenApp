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
    }

    initialize() {
        this.firebaseService.initialize();
        this.setupEventListeners();
        this.checkAuthentication();
    }

    checkAuthentication() {
        this.firebaseService.checkAuth((user) => {
            if (user) {
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

            // Render UI
            this.uiManager.renderPictures(
                this.gameBoard.shuffledPictures,
                (id) => this.handlePictureClick(id)
            );
            this.uiManager.renderNames(
                this.gameBoard.shuffledNames,
                (id) => this.handleNameClick(id)
            );

            this.uiManager.showStatus(`Spiel gestartet! ${this.students.length} Schüler geladen`, 'success');

        } catch (error) {
            console.error("Error starting game:", error);
            await this.uiManager.showError('Fehler beim Starten des Spiels: ' + error.message);
        }
    }

    handlePictureClick(studentId) {
        if (!this.isGameActive) return;

        const clicked = this.gameBoard.handlePictureClick(studentId);
        if (!clicked) return;

        this.uiManager.highlightSelection(
            this.gameBoard.selectedPicture,
            this.gameBoard.selectedName
        );

        this.checkForMatch();
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

    checkForMatch() {
        const matchResult = this.gameBoard.checkMatch();

        if (matchResult) {
            if (matchResult.isMatch) {
                this.uiManager.markAsMatched(matchResult.pictureId);

                const progress = this.gameBoard.getProgress();
                this.uiManager.showStatus(
                    `Richtig! ${progress.matched} von ${progress.total} gefunden`,
                    'success'
                );

                if (this.gameBoard.isComplete()) {
                    this.isGameActive = false;
                    setTimeout(() => {
                        this.uiManager.showVictory(progress.total);
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

    resetGame() {
        this.isGameActive = false;
        this.students = [];
        this.gameBoard = new GameBoard();
        this.uiManager.clearGame();
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
