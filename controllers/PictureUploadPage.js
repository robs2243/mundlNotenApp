import { AuthService } from '../services/AuthService.js';
import { RedirectService } from '../services/RedirectService.js';
import { StatusBanner } from '../ui/StatusBanner.js';
import { CryptoService } from '../services/CryptoService.js';
import { PictureRepository } from '../repositories/PictureRepository.js';

// PictureUploadPage encrypts selected images and stores them in the realtime database.
export class PictureUploadPage {
    constructor({
        authService = new AuthService(),
        redirectService = new RedirectService(),
        cryptoService = new CryptoService(),
        pictureRepository = new PictureRepository(),
        statusElement = document.getElementById('status'),
        encryptionInput = document.getElementById('encryptionPassword'),
        schoolYearInput = document.getElementById('schoolYear'),
        classInput = document.getElementById('classSelector'),
        fileInput = document.getElementById('imageUpload'),
        previewContainer = document.getElementById('previewContainer'),
        uploadButton = document.getElementById('uploadButton'),
        backButton = document.getElementById('backButton'),
        logoutButton = document.getElementById('logoutButton')
    } = {}) {
        this.authService = authService;
        this.redirectService = redirectService;
        this.cryptoService = cryptoService;
        this.pictureRepository = pictureRepository;

        this.status = new StatusBanner(statusElement, {
            info: 'status-info',
            success: 'status-success',
            error: 'status-error'
        });

        this.encryptionInput = encryptionInput;
        this.schoolYearInput = schoolYearInput;
        this.classInput = classInput;
        this.fileInput = fileInput;
        this.previewContainer = previewContainer;
        this.uploadButton = uploadButton;
        this.backButton = backButton;
        this.logoutButton = logoutButton;
    }

    init() {
        this.registerEventHandlers();
        this.authService.onAuthChange((user) => this.handleAuthStateChanged(user));
    }

    registerEventHandlers() {
        if (this.logoutButton) {
            this.logoutButton.disabled = true;
            this.logoutButton.addEventListener('click', () => this.handleLogout());
        }

        if (this.fileInput) {
            this.fileInput.addEventListener('change', (event) => this.renderPreview(event));
        }

        if (this.uploadButton) {
            this.uploadButton.addEventListener('click', () => this.handleUpload());
        }

        if (this.backButton) {
            this.backButton.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }
    }

    async handleAuthStateChanged(user) {
        if (user) {
            this.status.show(`Logged in as ${user.email}. Ready.`, 'success');
            if (this.logoutButton) {
                this.logoutButton.disabled = false;
            }
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
            this.status.show('Abmeldung erfolgreich.', 'success');
        } catch (error) {
            console.error('Logout error:', error);
            this.status.show('Abmeldung fehlgeschlagen: ' + (error.message || error.code), 'error');
            if (this.logoutButton) {
                this.logoutButton.disabled = false;
            }
        }
    }

    renderPreview(event) {
        if (!this.previewContainer) {
            return;
        }
        this.previewContainer.innerHTML = '';
        const files = event.target.files || [];
        Array.from(files).forEach((file) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = document.createElement('img');
                img.src = ev.target.result;
                img.alt = file.name;
                img.style.maxWidth = '100px';
                img.style.maxHeight = '100px';
                img.style.border = '1px solid #ccc';
                img.style.borderRadius = '5px';
                img.title = file.name;
                this.previewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    }

    async handleUpload() {
        const password = this.encryptionInput?.value;
        if (!password) {
            Swal.fire('Fehler', 'Bitte ein Verschluesselungspasswort eingeben.', 'error');
            return;
        }

        const schoolYear = this.schoolYearInput?.value.trim();
        if (!schoolYear) {
            Swal.fire('Fehler', 'Bitte ein Schuljahr eingeben.', 'error');
            return;
        }

        const classId = this.classInput?.value.trim();
        if (!classId) {
            Swal.fire('Fehler', 'Bitte eine Klasse eingeben.', 'error');
            return;
        }

        if (!this.fileInput || !this.fileInput.files.length) {
            Swal.fire('Fehler', 'Bitte Bilder auswaehlen.', 'error');
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const file of Array.from(this.fileInput.files)) {
            const fileName = file.name.replace(/\.[^/.]+$/, '');
            const parts = fileName.split('_');
            if (parts.length !== 2) {
                Swal.fire('Fehler', `Ungueltiger Dateiname: ${file.name}. Erwartet: Nachname_Vorname.jpg`, 'error');
                errorCount++;
                continue;
            }

            const nachname = parts[0].trim();
            const vorname = parts[1].trim();
            const studentId = `${vorname}_${nachname}`;

            try {
                const arrayBuffer = await this.readFileAsArrayBuffer(file);
                const encryptedData = await this.cryptoService.encryptArrayBuffer(arrayBuffer, password);
                await this.pictureRepository.saveStudentPicture(schoolYear, classId, studentId, {
                    encryptedData,
                    nachname,
                    vorname,
                    schuljahr: schoolYear
                });
                successCount++;
            } catch (error) {
                console.error(`Fehler bei ${file.name}:`, error);
                errorCount++;
            }
        }

        Swal.fire('Fertig', `${successCount} Bilder erfolgreich hochgeladen, ${errorCount} Fehler.`, 'success');
        if (this.previewContainer) {
            this.previewContainer.innerHTML = '';
        }
        if (this.fileInput) {
            this.fileInput.value = '';
        }
    }

    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = () => reject(new Error('File reading failed'));
            reader.readAsArrayBuffer(file);
        });
    }
}
