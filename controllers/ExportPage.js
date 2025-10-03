import { AuthService } from '../services/AuthService.js';
import { RedirectService } from '../services/RedirectService.js';
import { StatusBanner } from '../ui/StatusBanner.js';
import { CryptoService } from '../services/CryptoService.js';
import { GradesRepository } from '../repositories/GradesRepository.js';

// ExportPage takes care of assembling a CSV export of encrypted grades for a given class and school year.
export class ExportPage {
    constructor({
        authService = new AuthService(),
        redirectService = new RedirectService(),
        cryptoService = new CryptoService(),
        gradesRepository = new GradesRepository(),
        statusElement = document.getElementById('status'),
        encryptionInput = document.getElementById('encryptionPassword'),
        schoolYearInput = document.getElementById('schoolYear'),
        classSelector = document.getElementById('classSelector'),
        exportButton = document.getElementById('exportButton'),
        backButton = document.getElementById('backButton'),
        logoutButton = document.getElementById('logoutButton')
    } = {}) {
        this.authService = authService;
        this.redirectService = redirectService;
        this.cryptoService = cryptoService;
        this.gradesRepository = gradesRepository;

        this.status = new StatusBanner(statusElement, {
            info: 'status-info',
            success: 'status-success',
            error: 'status-error'
        });

        this.encryptionInput = encryptionInput;
        this.schoolYearInput = schoolYearInput;
        this.classSelector = classSelector;
        this.exportButton = exportButton;
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

        if (this.schoolYearInput) {
            this.schoolYearInput.addEventListener('input', () => this.handleSchoolYearChanged());
        }

        if (this.exportButton) {
            this.exportButton.addEventListener('click', () => this.handleExportClick());
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

    async handleSchoolYearChanged() {
        const schoolYear = this.schoolYearInput?.value.trim();
        if (!this.classSelector) {
            return;
        }
        this.classSelector.innerHTML = '<option value="">Klasse auswaehlen</option>';

        if (!schoolYear) {
            return;
        }

        this.status.show(`Suche Klassen fuer ${schoolYear}...`, 'info');

        try {
            const classes = await this.gradesRepository.fetchClassesForSchoolYear(schoolYear);
            if (!classes.length) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'Keine Klassen gefunden';
                option.disabled = true;
                this.classSelector.appendChild(option);
                this.status.show('Keine Klassen mit Noten gefunden.', 'info');
                return;
            }

            classes.forEach((classId) => {
                const option = document.createElement('option');
                option.value = classId;
                option.textContent = classId;
                this.classSelector.appendChild(option);
            });
            this.status.show('Klassen gefunden. Waehlen Sie eine Klasse fuer den Export.', 'success');
        } catch (error) {
            console.error('Error loading classes:', error);
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Fehler beim Laden';
            option.disabled = true;
            this.classSelector.appendChild(option);
            this.status.show('Fehler beim Laden der Klassen: ' + error.message, 'error');
        }
    }

    async handleExportClick() {
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

        const classId = this.classSelector?.value;
        if (!classId) {
            Swal.fire('Fehler', 'Bitte eine Klasse auswaehlen.', 'error');
            return;
        }

        try {
            this.status.show('Noten werden fuer den Export vorbereitet...', 'info');
            const grades = await this.gradesRepository.fetchGradesForClass(schoolYear, classId);
            if (!grades.length) {
                Swal.fire('Info', `Keine Noten fuer Klasse ${classId} im Schuljahr ${schoolYear} gefunden.`, 'info');
                this.status.show('Keine Noten gefunden.', 'info');
                return;
            }

            const csvData = [['Vorname', 'Nachname', 'Datum', 'Thema', 'Note']];

            for (const grade of grades) {
                try {
                    const decryptedPayload = await this.cryptoService.decryptText(
                        grade.encryptedData.encrypted,
                        grade.encryptedData.iv,
                        grade.encryptedData.salt,
                        password
                    );
                    const gradeData = JSON.parse(decryptedPayload);
                    const formattedDate = this.formatDate(grade.date);
                    csvData.push([
                        grade.vorname || '',
                        grade.nachname || '',
                        formattedDate,
                        gradeData.comment || '',
                        gradeData.note || ''
                    ]);
                } catch (decryptError) {
                    console.error('Decrypt grade failed:', decryptError);
                }
            }

            const csvContent = csvData.map((row) => row.map((field) => `"${field}"`).join(';')).join('\n');
            this.downloadCsv(csvContent, `Noten_${classId}_${schoolYear}.csv`);
            this.status.show('CSV-Datei heruntergeladen.', 'success');
            Swal.fire('Erfolg', 'CSV-Datei wurde erfolgreich heruntergeladen.', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.status.show('Fehler beim Exportieren der Daten: ' + error.message, 'error');
            Swal.fire('Fehler', 'Fehler beim Exportieren der Daten: ' + error.message, 'error');
        }
    }

    formatDate(dateString) {
        if (!dateString) {
            return '';
        }
        const [year, month, day] = dateString.split('-');
        if (!year || !month || !day) {
            return dateString;
        }
        return `${day}.${month}.${year}`;
    }

    downloadCsv(content, filename) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}
