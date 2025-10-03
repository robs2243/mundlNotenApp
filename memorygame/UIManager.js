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

    renderNames(students, onClickCallback) {
        this.namesGrid.innerHTML = '';

        students.forEach(student => {
            const nameDiv = document.createElement('div');
            nameDiv.className = 'name-item';
            nameDiv.dataset.studentId = student.id;
            nameDiv.textContent = student.getFullName();

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

    async showVictory(matchCount) {
        await Swal.fire({
            title: 'Herzlichen Glückwunsch!',
            text: `Du hast alle ${matchCount} Schüler richtig zugeordnet!`,
            icon: 'success',
            confirmButtonText: 'OK'
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
}
