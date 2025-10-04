export class UIManager {
    constructor() {
        this.statusDiv = document.getElementById('status');
        this.picturesGrid = document.getElementById('picturesGrid');
        this.namesGrid = document.getElementById('namesGrid');
    }

    showStatus(message, type = 'info') {
        this.statusDiv.textContent = message;

        const colors = {
            info: '#2196F3',
            success: '#4CAF50',
            error: '#f44336',
            warning: '#ff9800'
        };

        this.statusDiv.style.backgroundColor = colors[type] || colors.info;
    }

    renderPictures(students, onClickCallback) {
        this.picturesGrid.innerHTML = '';

        students.forEach(student => {
            const pictureDiv = document.createElement('div');
            pictureDiv.className = 'picture-item';
            pictureDiv.dataset.studentId = student.id;

            const img = document.createElement('img');
            img.src = student.decryptedImageUrl;
            img.alt = student.getFullName();

            pictureDiv.appendChild(img);
            pictureDiv.addEventListener('click', () => onClickCallback(student.id));

            this.picturesGrid.appendChild(pictureDiv);
        });
    }

    renderNames(students, onClickCallback, firstNameOnly = false) {
        this.namesGrid.innerHTML = '';

        students.forEach(student => {
            const nameDiv = document.createElement('div');
            nameDiv.className = 'name-item';
            nameDiv.dataset.studentId = student.id;
            nameDiv.textContent = student.getDisplayName(firstNameOnly);

            nameDiv.addEventListener('click', () => onClickCallback(student.id));

            this.namesGrid.appendChild(nameDiv);
        });
    }

    highlightSelection(pictureId, nameId) {
        // Remove all previous selections
        document.querySelectorAll('.picture-item.selected').forEach(el => {
            el.classList.remove('selected');
        });
        document.querySelectorAll('.name-item.selected').forEach(el => {
            el.classList.remove('selected');
        });

        // Add new selections
        if (pictureId) {
            const pictureEl = this.picturesGrid.querySelector(`[data-student-id="${pictureId}"]`);
            if (pictureEl) pictureEl.classList.add('selected');
        }

        if (nameId) {
            const nameEl = this.namesGrid.querySelector(`[data-student-id="${nameId}"]`);
            if (nameEl) nameEl.classList.add('selected');
        }
    }

    markAsMatched(studentId) {
        const pictureEl = this.picturesGrid.querySelector(`[data-student-id="${studentId}"]`);
        const nameEl = this.namesGrid.querySelector(`[data-student-id="${studentId}"]`);

        if (pictureEl) {
            pictureEl.classList.remove('selected');
            pictureEl.classList.add('matched');
        }
        if (nameEl) {
            nameEl.classList.remove('selected');
            nameEl.classList.add('matched');
        }
    }

    clearSelections() {
        document.querySelectorAll('.picture-item.selected').forEach(el => {
            el.classList.remove('selected');
        });
        document.querySelectorAll('.name-item.selected').forEach(el => {
            el.classList.remove('selected');
        });
    }

    async showVictory(matchCount, tries, timeInSeconds, isNewHighscore, previousBestTime) {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = timeInSeconds % 60;
        const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        let htmlMessage = `
            <p>Du hast alle ${matchCount} Schüler richtig zugeordnet!</p>
            <p>Du hast ${tries} Versuche gebraucht und ${timeText} Minuten benötigt.</p>
        `;

        // Add highscore message with special styling
        if (isNewHighscore) {
            if (previousBestTime === null) {
                htmlMessage += `
                    <div class="highscore-message">
                        <p class="highscore-flash">🏆 Erste Bestzeit: ${timeInSeconds} Sek.! 🏆</p>
                    </div>
                `;
            } else {
                htmlMessage += `
                    <div class="highscore-message">
                        <p class="highscore-flash">🎉 Neue Bestzeit: ${timeInSeconds} Sek.! 🎉</p>
                        <p class="old-time">Die alte war: ${previousBestTime} Sek.</p>
                    </div>
                `;
            }
        }

        await Swal.fire({
            title: 'Herzlichen Glückwunsch!',
            html: htmlMessage,
            icon: 'success',
            confirmButtonText: 'OK',
            customClass: {
                popup: 'victory-popup'
            }
        });
    }

    async showError(message) {
        await Swal.fire({
            title: 'Fehler',
            text: message,
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }

    clearGame() {
        this.picturesGrid.innerHTML = '';
        this.namesGrid.innerHTML = '';
    }

    hideNamesSection() {
        document.getElementById('namesContainer').style.display = 'none';
    }

    showNamesSection() {
        document.getElementById('namesContainer').style.display = 'block';
    }

    async showMobileNameSelector(students, firstNameOnly) {
        return new Promise((resolve) => {
            let selectedId = null;

            Swal.fire({
                title: 'Wähle den richtigen Namen',
                text: 'Welcher Schüler ist auf dem Bild?',
                showCancelButton: true,
                cancelButtonText: 'Abbrechen',
                showConfirmButton: false,
                html: `
                    <div class="mobile-name-buttons">
                        ${students.map(student => `
                            <button class="mobile-name-btn" data-student-id="${student.id}">
                                ${student.getDisplayName(firstNameOnly)}
                            </button>
                        `).join('')}
                    </div>
                `,
                didOpen: () => {
                    const container = Swal.getHtmlContainer();
                    const buttons = container.querySelectorAll('.mobile-name-btn');
                    buttons.forEach(btn => {
                        btn.addEventListener('click', () => {
                            selectedId = btn.dataset.studentId;
                            console.log('Button clicked, student ID:', selectedId);
                            Swal.close();
                        });
                    });
                },
                didClose: () => {
                    console.log('Popup closed, returning:', selectedId);
                    resolve(selectedId);
                }
            });
        });
    }
}
