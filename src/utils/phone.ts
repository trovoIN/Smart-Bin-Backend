/**
 * Phone Number Utility
 * Normalizes phone numbers to consistent format for database storage and API calls
 */

/**
 * Normalize phone number to E.164 format (+91XXXXXXXXXX)
 * Handles various input formats:
 * - 9876543210 -> +919876543210
 * - +919876543210 -> +919876543210
 * - 919876543210 -> +919876543210
 */
export function normalizePhone(phone: string, countryCode: string = '+91'): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // If already has country code, return as is
    if (phone.startsWith('+')) {
        return phone;
    }

    // If starts with country code without +, add it
    if (digits.startsWith('91') && digits.length === 12) {
        return `+${digits}`;
    }

    // If 10 digits, add country code
    if (digits.length === 10) {
        return `${countryCode}${digits}`;
    }

    // Return original if format is unclear
    return phone;
}

/**
 * Get display format for phone number (without country code)
 * +919876543210 -> 9876543210
 */
export function getPhoneDisplay(phone: string): string {
    const normalized = normalizePhone(phone);
    return normalized.replace(/^\+91/, '');
}

/**
 * Validate Indian phone number
 */
export function isValidIndianPhone(phone: string): boolean {
    const digits = phone.replace(/\D/g, '');

    // Should be 10 digits or 12 digits with country code
    if (digits.length === 10) {
        return /^[6-9]\d{9}$/.test(digits);
    }

    if (digits.length === 12 && digits.startsWith('91')) {
        return /^91[6-9]\d{9}$/.test(digits);
    }

    return false;
}
