// RedirectService collects all routing helpers that were previously scattered across the pages.
// It stores the requested page before redirecting to the login and resolves the target afterwards.
export class RedirectService {
    constructor(storage = window.sessionStorage, storageKey = 'redirectTo') {
        this.storage = storage;
        this.storageKey = storageKey;
    }

    rememberCurrentLocation() {
        const target = this.buildCurrentLocation();
        this.storage.setItem(this.storageKey, target);
        return target;
    }

    rememberLocation(target) {
        this.storage.setItem(this.storageKey, target);
    }

    resolveTarget(defaultTarget = 'index.html') {
        const storedTarget = this.storage.getItem(this.storageKey);
        if (storedTarget) {
            this.storage.removeItem(this.storageKey);
            return storedTarget;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const queryTarget = urlParams.get('redirect');
        return queryTarget || defaultTarget;
    }

    buildCurrentLocation() {
        return ${window.location.pathname};
    }
}
