const crypto = require('crypto');

// Function to decrypt a password using AES cipher
function decryptPassword(encryptedPassword, key) {
    try {
        const decipher = crypto.Decipher('aes-256-cbc', key);
        let decrypted = decipher.update(encryptedPassword, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('Error decrypting password:', error);
        return null; // Handle decryption error gracefully
    }
}

// Example usage
const encryptedPassword = 'svkLRj9nYEgZo7gWDJD5IQ=='; // Replace with your encrypted password
const key = crypto.randomBytes(32); // 32 bytes for AES-256

const decryptedPassword = decryptPassword(encryptedPassword, key);
console.log('Decrypted Password:', decryptedPassword);



