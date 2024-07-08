const crypto = require('crypto');

function decrypt(cipherText) {
    const EncryptionKey = 'MAKV2SPBNI99212';
    cipherText = cipherText.replace(/ /g, '+');
    const cipherBytes = Buffer.from(cipherText, 'base64');

    // Create a key and IV using the same parameters as in the C# code
    const key = crypto.pbkdf2Sync(EncryptionKey, Buffer.from([0x49, 0x76, 0x61, 0x6e, 0x20, 0x4d, 0x65, 0x64, 0x76, 0x65, 0x64, 0x65, 0x76]), 1000, 32, 'sha1');
    const iv = crypto.pbkdf2Sync(EncryptionKey, Buffer.from([0x49, 0x76, 0x61, 0x6e, 0x20, 0x4d, 0x65, 0x64, 0x76, 0x65, 0x64, 0x65, 0x76]), 1000, 16, 'sha1');

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(cipherBytes, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

// Example usage
const encryptedText = 'yv5DiHFpiiIfKaQ66TOXrL25zM8BK0o3AOsuaVU2zDo=';
const decryptedText = decrypt(encryptedText);
console.log('Decrypted Text:', decryptedText);
