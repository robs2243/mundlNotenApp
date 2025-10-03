// CryptoService wraps the WebCrypto calls for both text and binary payloads so that all pages use the same encryption recipe.
export class CryptoService {
    constructor(options = {}) {
        this.iterations = options.iterations || 100000;
        this.encoder = new TextEncoder();
        this.decoder = new TextDecoder();
    }

    async encryptText(plainText, password) {
        const data = this.encoder.encode(plainText);
        const encrypted = await this.encryptBytes(data, password);
        return encrypted;
    }

    async decryptText(encryptedBase64, ivBase64, saltBase64, password) {
        const decrypted = await this.decryptBytes(encryptedBase64, ivBase64, saltBase64, password);
        return this.decoder.decode(decrypted);
    }

    async encryptArrayBuffer(arrayBuffer, password) {
        const bytes = new Uint8Array(arrayBuffer);
        return this.encryptBytes(bytes, password);
    }

    async decryptArrayBuffer(encryptedBase64, ivBase64, saltBase64, password) {
        return this.decryptBytes(encryptedBase64, ivBase64, saltBase64, password);
    }

    async encryptBytes(byteArray, password) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const key = await this.deriveKey(password, salt);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, byteArray);

        return {
            encrypted: this.base64FromBuffer(encrypted),
            iv: this.base64FromArray(iv),
            salt: this.base64FromArray(salt),
        };
    }

    async decryptBytes(encryptedBase64, ivBase64, saltBase64, password) {
        const salt = this.arrayFromBase64(saltBase64);
        const key = await this.deriveKey(password, salt);
        const iv = this.arrayFromBase64(ivBase64);
        const ciphertext = this.arrayFromBase64(encryptedBase64);
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    }

    async deriveKey(password, salt) {
        const keyMaterial = await crypto.subtle.importKey('raw', this.encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey({
            name: 'PBKDF2',
            salt,
            iterations: this.iterations,
            hash: 'SHA-256'
        }, keyMaterial, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    }

    base64FromBuffer(buffer) {
        const bytes = new Uint8Array(buffer);
        return this.base64FromArray(bytes);
    }

    base64FromArray(array) {
        let binary = '';
        array.forEach((byte) => {
            binary += String.fromCharCode(byte);
        });
        return btoa(binary);
    }

    arrayFromBase64(base64) {
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
}
