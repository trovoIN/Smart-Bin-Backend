// ============================================
// Smart Bin - Security Utilities
// ============================================
// This file contains security-related utilities:
// - Password hashing with bcrypt
// - Secure random token generation
// - Data encryption/decryption
// ============================================

import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// ============================================
// HASHING CONFIGURATION
// ============================================

/**
 * Number of salt rounds for bcrypt
 * Higher = more secure but slower
 * 12 is a good balance for security and performance
 */
const SALT_ROUNDS = 12;

// ============================================
// PASSWORD/OTP HASHING
// ============================================

/**
 * Hash a password or OTP using bcrypt
 * bcrypt is recommended because:
 * - It automatically handles salt generation
 * - It's designed to be slow, making brute-force attacks harder
 * - It's resistant to rainbow table attacks
 * 
 * @param plainText - The plain text password or OTP
 * @returns Promise<string> - The hashed value
 * 
 * @example
 * const hashedPassword = await hashPassword('mySecretPassword');
 * // Store hashedPassword in database
 */
export async function hashPassword(plainText: string): Promise<string> {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    return bcrypt.hash(plainText, salt);
}

/**
 * Compare a plain text password with a hashed password
 * 
 * @param plainText - The plain text password to verify
 * @param hashedPassword - The stored hashed password
 * @returns Promise<boolean> - True if passwords match
 * 
 * @example
 * const isValid = await verifyPassword('userInput', storedHash);
 * if (isValid) { // Allow login }
 */
export async function verifyPassword(
    plainText: string,
    hashedPassword: string
): Promise<boolean> {
    return bcrypt.compare(plainText, hashedPassword);
}

// ============================================
// SECURE RANDOM TOKEN GENERATION
// ============================================

/**
 * Generate a cryptographically secure random token
 * Used for:
 * - QR code secure tokens
 * - Session IDs
 * - Password reset tokens
 * 
 * @param length - Number of bytes (output will be 2x in hex)
 * @returns string - Hex-encoded random token
 * 
 * @example
 * const qrToken = generateSecureToken(16); // 32 char hex string
 */
export function generateSecureToken(length: number = 16): string {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a URL-safe base64 token
 * Better for URLs as it doesn't contain special characters
 * 
 * @param length - Number of bytes
 * @returns string - URL-safe base64 token
 */
export function generateUrlSafeToken(length: number = 24): string {
    return crypto.randomBytes(length).toString('base64url');
}

/**
 * Generate a numeric OTP code
 * 
 * @param length - Number of digits (default 6)
 * @returns string - Numeric OTP code
 * 
 * @example
 * const otp = generateOTP(6); // "847293"
 */
export function generateOTP(length: number = 6): string {
    // Generate random bytes and convert to a number within range
    const max = Math.pow(10, length);
    const min = Math.pow(10, length - 1);

    // Use crypto for secure random number
    const randomBytes = crypto.randomBytes(4);
    const randomNumber = randomBytes.readUInt32BE(0);

    // Scale to our range
    const otp = min + (randomNumber % (max - min));

    return otp.toString();
}

// ============================================
// DATA ENCRYPTION (AES-256-GCM)
// ============================================

/**
 * Encryption algorithm
 * AES-256-GCM is recommended because:
 * - AES-256 is highly secure
 * - GCM provides authenticated encryption (integrity + confidentiality)
 */
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // Initialization vector length
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from environment
 * Must be 32 bytes for AES-256
 */
function getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;

    if (!key) {
        throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    // If key is hex-encoded, decode it
    if (key.length === 64) {
        return Buffer.from(key, 'hex');
    }

    // Otherwise use as-is (for base64 or raw)
    const keyBuffer = Buffer.from(key, 'base64');

    if (keyBuffer.length !== 32) {
        throw new Error('ENCRYPTION_KEY must be 32 bytes');
    }

    return keyBuffer;
}

/**
 * Encrypt sensitive data using AES-256-GCM
 * Use this for:
 * - Storing sensitive PII that needs to be retrieved
 * - Encrypting data at rest
 * 
 * @param plainText - Data to encrypt
 * @returns string - Encrypted data (iv:authTag:ciphertext in base64)
 * 
 * @example
 * const encrypted = encrypt('sensitive data');
 * // Store encrypted in database
 */
export function encrypt(plainText: string): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Combine IV, auth tag, and ciphertext
    // Format: iv:authTag:ciphertext (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt data encrypted with encrypt()
 * 
 * @param encryptedData - Data from encrypt()
 * @returns string - Original plain text
 * 
 * @example
 * const decrypted = decrypt(encryptedValue);
 */
export function decrypt(encryptedData: string): string {
    const key = getEncryptionKey();

    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
    }

    const [ivBase64, authTagBase64, ciphertext] = parts;
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

// ============================================
// HASH FOR DATA INTEGRITY (SHA-256)
// ============================================

/**
 * Create SHA-256 hash of data
 * Use this for:
 * - Verifying data integrity
 * - Creating non-reversible identifiers
 * 
 * @param data - Data to hash
 * @returns string - Hex-encoded SHA-256 hash
 * 
 * @example
 * const hash = sha256Hash('data to verify');
 */
export function sha256Hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Create HMAC-SHA256 signature
 * Use this for:
 * - Signing data to verify authenticity
 * - Creating secure tokens that can be verified
 * 
 * @param data - Data to sign
 * @param secret - Secret key for signing
 * @returns string - Hex-encoded HMAC signature
 */
export function hmacSign(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Verify HMAC signature
 * Uses timing-safe comparison to prevent timing attacks
 */
export function hmacVerify(
    data: string,
    signature: string,
    secret: string
): boolean {
    const expectedSignature = hmacSign(data, secret);

    // Use timing-safe comparison
    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );
    } catch {
        return false;
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Mask sensitive data for logging
 * Shows first and last few characters, masks the middle
 * 
 * @param data - Sensitive data to mask
 * @param showFirst - Number of first characters to show
 * @param showLast - Number of last characters to show
 * @returns string - Masked data
 * 
 * @example
 * maskSensitiveData('1234567890', 2, 2) // "12****90"
 */
export function maskSensitiveData(
    data: string,
    showFirst: number = 2,
    showLast: number = 2
): string {
    if (data.length <= showFirst + showLast) {
        return '*'.repeat(data.length);
    }

    const first = data.slice(0, showFirst);
    const last = data.slice(-showLast);
    const masked = '*'.repeat(Math.min(data.length - showFirst - showLast, 6));

    return `${first}${masked}${last}`;
}

/**
 * Sanitize phone number
 * Removes spaces, dashes, and validates format
 * 
 * @param phone - Raw phone number input
 * @returns string - Cleaned phone number
 */
export function sanitizePhone(phone: string): string {
    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');

    // If starts with 91, add + prefix
    if (cleaned.startsWith('91') && cleaned.length === 12) {
        return '+' + cleaned;
    }

    // If 10 digits, add +91 prefix
    if (cleaned.length === 10) {
        return '+91' + cleaned;
    }

    // If already has +, return as-is
    if (cleaned.startsWith('+')) {
        return cleaned;
    }

    return cleaned;
}
