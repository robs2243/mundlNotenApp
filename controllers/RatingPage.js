import { AuthService } from '../services/AuthService.js';
import { RedirectService } from '../services/RedirectService.js';
import { StatusBanner } from '../ui/StatusBanner.js';
import { CryptoService } from '../services/CryptoService.js';
import { PictureRepository } from '../repositories/PictureRepository.js';
import { GradesRepository } from '../repositories/GradesRepository.js';

// RatingPage is responsible for the dashboard where teachers select a student image and store encrypted grades.
// It glues together Firebase (auth + realtime database), the crypto helper and the UI elements on index.html.
export class RatingPage {
    constructor({
        authService = new AuthService(),
        redirectService = new RedirectService(),
        cryptoService = new CryptoService(),
        pictureRepository = new PictureRepository(),
        gradesRepository = new GradesRepository(),
        statusElement = document.getElementById('status'),
        dateSelector = document.getElementById('dateSelector'),
        gridElement = document.querySelector('.parent'),
        picsUploadButton = document.getElementById('picsUpload'),
        logoutButton = document.getElementById('logoutButton'),
        schoolYearInput = document.getElementById('schoolYear'),
        classSelector = document.getElementById('classSelector'),
        encryptionInput = document.getElementById('encryptionPassword'),
        excelExportButton = document.getElementById('excelExport')
    } = {}) {
        this.authService = authService;
        this.redirectService = redirectService;
        this.cryptoService = cryptoService;
        this.pictureRepository = pictureRepository;
        this.gradesRepository = gradesRepository;

        this.status = new StatusBanner(statusElement, {
            info: 'status-info',
            success: 'status-success',
            error: 'status-error'
        });

        this.dateSelector = dateSelector;
        this.grid = gridElement;
        this.picsUploadButton = picsUploadButton;
        this.logoutButton = logoutButton;
        this.schoolYearInput = schoolYearInput;
        this.classSelector = classSelector;
        this.encryptionInput = encryptionInput;
        this.excelExportButton = excelExportButton;

        this.commentHistory = new Set();
        this.localGradesCache = new Map();
        this.studentBoxes = Array.from(document.querySelectorAll('.redBox'));
    }

    async init() {
        this.registerEventHandlers();
        this.initialiseDefaults();
        this.authService.onAuthChange((user) => this.handleAuthStateChanged(user));

        const initialSchoolYear = this.schoolYearInput?.value.trim();
        if (initialSchoolYear) {
            await this.loadClassesForSchoolYear();
        }
    }

    registerEventHandlers() {
        if (this.picsUploadButton) {
            this.picsUploadButton.addEventListener('click', () => {
                window.location.href = 'picsupload.html';
            });
        }

        if (this.logoutButton) {
            this.logoutButton.addEventListener('click', () => this.handleLogout());
            this.logoutButton.disabled = true;
        }

        if (this.grid) {
            this.grid.addEventListener('click', (event) => this.handleGridClick(event));
        }

        if (this.schoolYearInput) {
            this.schoolYearInput.addEventListener('input', () => {
                this.resetAllImagesToDefault();
                this.loadClassesForSchoolYear();
            });
        }

        if (this.classSelector) {
            this.classSelector.addEventListener('change', () => {
                this.resetAllImagesToDefault();
                this.tryLoadStudentsForSelection();
            });
        }

        if (this.encryptionInput) {
            this.encryptionInput.addEventListener('input', () => {
                this.resetAllImagesToDefault();
                this.tryLoadStudentsForSelection();
            });
        }

        if (this.excelExportButton) {
            this.excelExportButton.addEventListener('click', () => {
                window.location.href = 'export.html';
            });
        }
    }

    initialiseDefaults() {
        if (this.dateSelector && !this.dateSelector.value) {
            this.dateSelector.valueAsDate = new Date();
        }
    }

    async handleAuthStateChanged(user) {
        if (user) {
            this.status.show(`Logged in as ${user.email}. Ready.`, 'success');
            if (this.logoutButton) {
                this.logoutButton.disabled = false;
            }
            this.tryLoadStudentsForSelection();
        } else {
            this.status.show('Not logged in. Redirecting...', 'error');
            if (this.logoutButton) {
                this.logoutButton.disabled = true;
            }
            this.redirectService.rememberCurrentLocation();
            window.location.href = 'login.html';
        }
    }

    async handleLogout() {
        if (this.logoutButton) {
            this.logoutButton.disabled = true;
        }
        this.status.show('Abmelden laeuft...', 'info');
        try {
            await this.authService.logout();
            this.status.show('Abmeldung erfolgreich. Bitte erneut anmelden.', 'success');
        } catch (error) {
            console.error('Logout error:', error);
            this.status.show('Abmeldung fehlgeschlagen: ' + (error.message || error.code), 'error');
            if (this.logoutButton) {
                this.logoutButton.disabled = false;
            }
        }
    }

    async loadClassesForSchoolYear() {
        const schoolYear = this.schoolYearInput?.value.trim();
        if (!schoolYear) {
            this.clearClassSelector();
            return;
        }

        this.status.show(`Klassen fuer ${schoolYear} werden geladen...`, 'info');
        this.clearClassSelector();

        try {
            const classes = await this.pictureRepository.fetchClassesForSchoolYear(schoolYear);
            if (!classes.length) {
                this.addClassOption('', 'Keine Klassen gefunden', true);
                this.status.show('Keine Klassen im ausgewaehlten Schuljahr gefunden.', 'info');
                return;
            }

            classes.forEach((className) => this.addClassOption(className, className));
            this.status.show('Klassen erfolgreich geladen.', 'success');

            if (classes.length === 1) {
                this.classSelector.value = classes[0];
                this.tryLoadStudentsForSelection();
            }
        } catch (error) {
            console.error('Error loading classes:', error);
            this.addClassOption('', 'Fehler beim Laden', true);
            this.status.show('Fehler beim Laden der Klassen: ' + error.message, 'error');
        }
    }

    clearClassSelector() {
        if (!this.classSelector) {
            return;
        }
        while (this.classSelector.options.length > 1) {
            this.classSelector.remove(1);
        }
    }

    addClassOption(value, label, disabled = false) {
        if (!this.classSelector) {
            return;
        }
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        option.disabled = disabled;
        this.classSelector.appendChild(option);
    }

    tryLoadStudentsForSelection() {
        const encPassword = this.encryptionInput?.value;
        const schoolYear = this.schoolYearInput?.value.trim();
        const classId = this.classSelector?.value;

        if (encPassword && schoolYear && classId) {
            this.loadStudentImages(encPassword, schoolYear, classId);
        }
    }

    async loadStudentImages(encPassword, schoolYear, classId) {
        this.resetAllImagesToDefault();
        this.status.show('Schuelerbilder werden geladen...', 'info');

        try {
            const students = await this.pictureRepository.fetchStudentsForClass(schoolYear, classId);
            const studentIds = Object.keys(students);
            if (!studentIds.length) {
                this.status.show(`Keine Schueler fuer ${classId} im Schuljahr ${schoolYear} gefunden.`, 'info');
                return;
            }

            const tasks = this.studentBoxes.map(async (box, index) => {
                const img = box.querySelector('img');
                const label = box.querySelector('.student-label');
                if (index >= studentIds.length) {
                    this.clearBox(box, img, label);
                    return;
                }

                const studentId = studentIds[index];
                const studentData = students[studentId];
                box.dataset.vorname = studentData.vorname;
                box.dataset.nachname = studentData.nachname;
                box.dataset.klasse = classId;
                box.dataset.schuljahr = studentData.schuljahr || schoolYear;

                label.textContent = `${studentData.vorname} ${studentData.nachname}`;
                img.alt = `${studentData.vorname} ${studentData.nachname}`;

                try {
                    const decryptedBuffer = await this.cryptoService.decryptArrayBuffer(
                        studentData.encryptedData.encrypted,
                        studentData.encryptedData.iv,
                        studentData.encryptedData.salt,
                        encPassword
                    );
                    img.src = this.arrayBufferToBase64Src(decryptedBuffer);
                    img.style.display = 'block';
                } catch (decryptError) {
                    console.error(`Failed to decrypt image for ${studentId}:`, decryptError);
                    this.clearBox(box, img, label);
                }
            });

            await Promise.all(tasks);
            this.status.show('Schuelerbilder geladen.', 'success');
        } catch (error) {
            console.error('Error loading student images:', error);
            this.status.show('Fehler beim Laden der Bilder: ' + error.message, 'error');
        }
    }

    clearBox(box, img, label) {
        if (img) {
            img.style.display = 'none';
            img.alt = '';
            img.src = '';
        }
        if (label) {
            label.textContent = '';
        }
        delete box.dataset.vorname;
        delete box.dataset.nachname;
        delete box.dataset.klasse;
        delete box.dataset.schuljahr;
        box.classList.remove('bild-selektiert');
    }

    resetAllImagesToDefault() {
        this.studentBoxes.forEach((box) => {
            const img = box.querySelector('img');
            const label = box.querySelector('.student-label');
            this.clearBox(box, img, label);
        });
    }

    async handleGridClick(event) {
        const box = event.target.closest('.redBox');
        if (!box) {
            return;
        }

        const encPassword = this.encryptionInput?.value;
        if (!encPassword) {
            Swal.fire('Fehler', 'Bitte zuerst ein Verschluesselungspasswort eingeben.', 'error');
            return;
        }

        const vorname = box.dataset.vorname;
        const nachname = box.dataset.nachname;
        if (!vorname || !nachname) {
            Swal.fire('Info', 'Keine Schuelerdaten fuer dieses Feld geladen.', 'info');
            return;
        }

        this.studentBoxes.forEach((el) => el.classList.remove('bild-selektiert'));
        box.classList.add('bild-selektiert');

        const classId = box.dataset.klasse || this.classSelector?.value;
        const schuljahr = box.dataset.schuljahr || this.schoolYearInput?.value.trim();
        const studentId = `${vorname}_${nachname}`;
        const date = this.dateSelector?.value;

        const existingGrade = await this.fetchExistingGrade(studentId, date, classId, encPassword);
        this.showGradeDialog({
            studentId,
            vorname,
            nachname,
            classId,
            schuljahr,
            date,
            password: encPassword,
            datasetBox: box,
            existingGrade
        });
    }

    async fetchExistingGrade(studentId, date, classId, encPassword) {
        if (!studentId || !date || !classId) {
            return null;
        }

        if (this.localGradesCache.has(studentId)) {
            return this.localGradesCache.get(studentId);
        }

        try {
            const gradeRecord = await this.gradesRepository.findGrade(studentId, date, classId);
            if (!gradeRecord) {
                return null;
            }
            const decryptedPayload = await this.cryptoService.decryptText(
                gradeRecord.encryptedData.encrypted,
                gradeRecord.encryptedData.iv,
                gradeRecord.encryptedData.salt,
                encPassword
            );
            const parsed = JSON.parse(decryptedPayload);
            this.localGradesCache.set(studentId, parsed);
            return parsed;
        } catch (error) {
            console.error('Decrypting existing grade failed:', error);
            Swal.fire('Entschluesselungsfehler', 'Falsches Passwort oder beschaedigte Daten.', 'error');
            return null;
        }
    }

    showGradeDialog({ studentId, vorname, nachname, classId, schuljahr, date, password, datasetBox, existingGrade }) {
        const studentName = `${vorname} ${nachname}`;
        Swal.fire({
            title: `Bewertung fuer ${studentName}`,
            html: `
                <div class="swal2-form">
                    <div style="margin-bottom: 10px; font-size: 14px; color: #666;">
                        <strong>Klasse:</strong> ${classId || 'N/A'} |
                        <strong>Schuljahr:</strong> ${schuljahr || 'N/A'}
                    </div>
                    <div class="swal2-radio-group">
                        ${[1, 2, 3, 4, 5, 6].map((n) => `<label><input type="radio" name="note" value="${n}" id="note-${n}"><span>Note ${n}</span></label>`).join('')}
                    </div>
                    <div>
                        <strong>Kommentar:</strong>
                        <input type="text" id="kommentar-input" class="swal2-input" placeholder="Kommentar oder Vorschlag klicken">
                        <div id="comment-suggestions-container"></div>
                    </div>
                </div>` ,
            confirmButtonText: 'Speichern',
            cancelButtonText: 'Abbrechen',
            showCancelButton: true,
            didOpen: () => this.populateDialog(existingGrade),
            preConfirm: () => ({
                note: document.querySelector('input[name="note"]:checked')?.value || null,
                comment: document.getElementById('kommentar-input').value.trim()
            })
        }).then(async (result) => {
            if (!result.isConfirmed) {
                return;
            }
            const { note, comment } = result.value;
            if (!note && !comment) {
                return;
            }
            await this.persistGrade({ studentId, vorname, nachname, classId, schuljahr, date, note, comment, password, datasetBox });
        });
    }

    populateDialog(existingGrade) {
        const input = document.getElementById('kommentar-input');
        const container = document.getElementById('comment-suggestions-container');
        if (!input || !container) {
            return;
        }

        container.innerHTML = '';

        if (existingGrade) {
            if (existingGrade.note) {
                const radio = document.getElementById(`note-${existingGrade.note}`);
                if (radio) {
                    radio.checked = true;
                }
            }
            input.value = existingGrade.comment || '';
        }

        this.commentHistory.forEach((comment) => {
            const span = document.createElement('span');
            span.className = 'suggestion-item';
            span.textContent = comment;
            container.appendChild(span);
        });

        container.addEventListener('click', (event) => {
            if (event.target.classList.contains('suggestion-item')) {
                input.value = event.target.textContent;
                input.focus();
            }
        });

        input.focus();
    }

    async persistGrade({ studentId, vorname, nachname, classId, schuljahr, date, note, comment, password, datasetBox }) {
        try {
            const payload = JSON.stringify({ note, comment });
            const encryptedData = await this.cryptoService.encryptText(payload, password);
            const gradeRecord = {
                studentId,
                classId,
                date,
                encryptedData,
                nachname,
                vorname,
                schuljahr
            };
            await this.gradesRepository.saveGrade(gradeRecord);
            if (comment) {
                this.commentHistory.add(comment);
            }
            this.localGradesCache.set(studentId, { note, comment });
            datasetBox.dataset.lastSaved = new Date().toISOString();
        } catch (error) {
            console.error('Persist grade failed:', error);
            Swal.fire('Fehler', 'Daten konnten nicht gespeichert werden: ' + error.message, 'error');
        }
    }

    arrayBufferToBase64Src(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        bytes.forEach((byte) => {
            binary += String.fromCharCode(byte);
        });
        return 'data:image/jpeg;base64,' + btoa(binary);
    }
}
