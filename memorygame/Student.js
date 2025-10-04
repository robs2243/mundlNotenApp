export class Student {
    constructor(id, vorname, nachname, schuljahr, encryptedData) {
        this.id = id;
        this.vorname = vorname;
        this.nachname = nachname;
        this.schuljahr = schuljahr;
        this.encryptedData = encryptedData;
        this.decryptedImageUrl = null;
    }

    getFullName() {
        return `${this.vorname} ${this.nachname}`;
    }

    getDisplayName(firstNameOnly = false) {
        return firstNameOnly ? this.vorname : this.getFullName();
    }

    async decrypt(cryptoService, password) {
        try {
            const decryptedArrayBuffer = await cryptoService.decryptBinary(
                this.encryptedData.encrypted,
                this.encryptedData.iv,
                this.encryptedData.salt,
                password
            );

            const base64String = await cryptoService.arrayBufferToBase64(decryptedArrayBuffer);
            this.decryptedImageUrl = `data:image/jpeg;base64,${base64String}`;

            return true;
        } catch (error) {
            console.error(`Failed to decrypt image for ${this.getFullName()}:`, error);
            return false;
        }
    }

    hasDecryptedImage() {
        return this.decryptedImageUrl !== null;
    }
}
