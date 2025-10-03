export class CryptoService {
    async deriveKey(password, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            enc.encode(password),
            "PBKDF2",
            false,
            ["deriveKey"]
        );

        return await crypto.subtle.deriveKey(
            { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
    }

    async decryptBinary(encryptedBase64, ivBase64, saltBase64, password) {
        try {
            const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
            const key = await this.deriveKey(password, salt);
            const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
            const ciphertext = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

            const decrypted = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv },
                key,
                ciphertext
            );

            return decrypted; // Returns ArrayBuffer
        } catch (error) {
            console.error("Decryption error:", error);
            throw error;
        }
    }

    async decryptText(encryptedBase64, ivBase64, saltBase64, password) {
        const arrayBuffer = await this.decryptBinary(encryptedBase64, ivBase64, saltBase64, password);
        return new TextDecoder().decode(arrayBuffer);
    }

    arrayBufferToBase64(buffer) {
        return new Promise((resolve, reject) => {
            const blob = new Blob([buffer]);
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
}
