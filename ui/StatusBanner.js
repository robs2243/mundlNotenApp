// StatusBanner keeps the CSS class juggling for the status element in one place.
export class StatusBanner {
    constructor(element, classMap = { info: 'status-info', success: 'status-success', error: 'status-error', warning: 'status-warning' }) {
        this.element = element;
        this.classMap = classMap;
        this.classList = Object.values(classMap);
    }

    show(message, type = 'info') {
        if (!this.element) {
            return;
        }
        this.element.textContent = message;
        this.classList.forEach((cssClass) => this.element.classList.remove(cssClass));
        const resolvedClass = this.classMap[type] || this.classMap.info;
        if (resolvedClass) {
            this.element.classList.add(resolvedClass);
        }
    }

    setBusy(message = 'Bitte warten...') {
        this.show(message, 'info');
    }
}
