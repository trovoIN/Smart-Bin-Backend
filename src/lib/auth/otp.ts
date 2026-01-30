// ============================================
// Smart Bin - OTP (One-Time Password) Service
// ============================================
// This file handles OTP operations:
// - Generate OTP codes
// - Send OTP via SMS
// - Verify OTP codes
// - Handle rate limiting and security
//
// OTP FLOW EXPLAINED:
// ===================
// 1. User enters phone number
// 2. Backend generates 6-digit OTP
// 3. OTP is hashed and stored in database
// 4. Plain OTP is sent via SMS
// 5. User enters received OTP
// 6. Backend verifies by comparing hashes
// 7. On success, JWT tokens are issued
// ============================================

import prisma from '@/lib/db/prisma';
import { hashPassword, verifyPassword, generateOTP } from '@/lib/security';
import { OTPRequest, OTPVerification } from '@/types';

// ============================================
// CONFIGURATION
// ============================================

// OTP length (6 digits is standard)
const OTP_LENGTH = parseInt(process.env.OTP_LENGTH || '6', 10);

// OTP expiration time in minutes
const OTP_EXPIRES_MINUTES = parseInt(process.env.OTP_EXPIRES_MINUTES || '5', 10);

// Maximum verification attempts before OTP is invalidated
const MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10);

// Minimum time between OTP requests (rate limiting)
const MIN_RESEND_SECONDS = 60;

// ============================================
// OTP GENERATION & STORAGE
// ============================================

/**
 * Generate and store an OTP for a phone number
 * 
 * Flow:
 * 1. Check rate limiting (can't request too frequently)
 * 2. Generate a random 6-digit OTP
 * 3. Hash the OTP (never store plain text!)
 * 4. Store hashed OTP in database
 * 5. Return plain OTP to send via SMS
 * 
 * @param request - Phone number and purpose
 * @returns Object with OTP code and expiration
 * 
 * @example
 * const { otp, expiresAt } = await generateAndStoreOTP({
 *   phone: '+919876543210',
 *   purpose: 'LOGIN'
 * });
 * // Send 'otp' via SMS
 */
export async function generateAndStoreOTP(request: OTPRequest): Promise<{
    otp: string;
    expiresAt: Date;
}> {
    const { phone, purpose } = request;

    // Check rate limiting - prevent spam
    await checkRateLimit(phone);

    // Invalidate any existing OTPs for this phone
    await invalidateExistingOTPs(phone, purpose);

    // Generate new OTP
    // Use fixed OTP for test accounts
    // Use fixed OTP for test accounts
    let otp = generateOTP(OTP_LENGTH);
    const demoNumbers = [
        '+919000000000', // Admin
        '+919000000001', // Supervisor
        '+919111111111', // Collector 1
        '+919111111112', // Collector 2
        '+919222222200', // Household 1
        '+919222222201', // Household 2
        '+919222222202', // Household 3
        '+919222222203', // Household 4
        '+919222222204', // Household 5
        '+919444444440', // Demo Collector (New User)
        '+9194444444440', // Demo Collector (Typo variant)
    ];

    if (demoNumbers.includes(phone)) {
        otp = '123456';
    }

    // Hash OTP before storing (security!)
    const hashedOTP = await hashPassword(otp);

    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRES_MINUTES);

    // Store in database
    await prisma.oTP.create({
        data: {
            phone,
            code: hashedOTP,
            purpose,
            expiresAt,
            attempts: 0,
            verified: false,
        },
    });

    console.log(`OTP generated for ${phone.slice(-4)}: ${otp} (Development only log)`);

    return { otp, expiresAt };
}

/**
 * Check if phone number is rate limited
 * Throws error if requesting OTP too frequently
 */
async function checkRateLimit(phone: string): Promise<void> {
    const recentOTP = await prisma.oTP.findFirst({
        where: {
            phone,
            createdAt: {
                gte: new Date(Date.now() - MIN_RESEND_SECONDS * 1000),
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    if (recentOTP) {
        const waitSeconds = MIN_RESEND_SECONDS -
            Math.floor((Date.now() - recentOTP.createdAt.getTime()) / 1000);

        throw new OTPRateLimitError(
            `Please wait ${waitSeconds} seconds before requesting another OTP`
        );
    }
}

/**
 * Invalidate existing OTPs for a phone
 * Ensures only latest OTP is valid
 */
async function invalidateExistingOTPs(
    phone: string,
    purpose: string
): Promise<void> {
    await prisma.oTP.updateMany({
        where: {
            phone,
            purpose,
            verified: false,
        },
        data: {
            verified: true, // Mark as used/invalid
        },
    });
}

// ============================================
// OTP VERIFICATION
// ============================================

/**
 * Verify an OTP code
 * 
 * Flow:
 * 1. Find the latest unverified OTP for this phone
 * 2. Check if OTP has expired
 * 3. Check if max attempts exceeded
 * 4. Compare provided code with stored hash
 * 5. Mark OTP as verified or increment attempts
 * 
 * @param verification - Phone, code, and purpose
 * @returns boolean - True if OTP is valid
 * @throws OTPError on failure
 * 
 * @example
 * const isValid = await verifyOTP({
 *   phone: '+919876543210',
 *   code: '123456',
 *   purpose: 'LOGIN'
 * });
 */
export async function verifyOTP(verification: OTPVerification): Promise<boolean> {
    const { phone, code, purpose } = verification;

    // Find the latest OTP for this phone and purpose
    const otpRecord = await prisma.oTP.findFirst({
        where: {
            phone,
            purpose,
            verified: false,
        },
        orderBy: { createdAt: 'desc' },
    });

    // No OTP found
    if (!otpRecord) {
        throw new OTPNotFoundError('No OTP found. Please request a new one.');
    }

    // Check if expired
    if (new Date() > otpRecord.expiresAt) {
        await markOTPAsVerified(otpRecord.id);
        throw new OTPExpiredError('OTP has expired. Please request a new one.');
    }

    // Check max attempts
    if (otpRecord.attempts >= MAX_ATTEMPTS) {
        await markOTPAsVerified(otpRecord.id);
        throw new OTPMaxAttemptsError(
            'Maximum verification attempts exceeded. Please request a new OTP.'
        );
    }

    // Verify the code
    const isValid = await verifyPassword(code, otpRecord.code);

    if (!isValid) {
        // Increment attempts
        await prisma.oTP.update({
            where: { id: otpRecord.id },
            data: { attempts: otpRecord.attempts + 1 },
        });

        const remainingAttempts = MAX_ATTEMPTS - otpRecord.attempts - 1;
        throw new OTPInvalidError(
            `Invalid OTP. ${remainingAttempts} attempts remaining.`
        );
    }

    // Mark as verified
    await markOTPAsVerified(otpRecord.id);

    return true;
}

/**
 * Mark OTP as verified (used)
 */
async function markOTPAsVerified(id: number): Promise<void> {
    await prisma.oTP.update({
        where: { id },
        data: { verified: true },
    });
}

// ============================================
// SMS PROVIDERS
// ============================================

/**
 * SMS Provider interface
 * All SMS providers must implement this
 */
interface SMSProvider {
    sendOTP(phone: string, otp: string): Promise<boolean>;
}

/**
 * Mock SMS provider for development
 * Just logs the OTP to console
 */
class MockSMSProvider implements SMSProvider {
    async sendOTP(phone: string, otp: string): Promise<boolean> {
        console.log('='.repeat(50));
        console.log('[MOCK SMS]');
        console.log(`To: ${phone}`);
        console.log(`Message: Your Smart Bin verification code is: ${otp}`);
        console.log(`Valid for ${OTP_EXPIRES_MINUTES} minutes.`);
        console.log('='.repeat(50));
        return true;
    }
}

/**
 * Twilio SMS provider for production
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 */
class TwilioSMSProvider implements SMSProvider {
    async sendOTP(phone: string, otp: string): Promise<boolean> {
        // Twilio integration would go here
        // This is a placeholder - you'd import twilio SDK and use it

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;

        if (!accountSid || !authToken || !fromNumber) {
            throw new Error('Twilio credentials not configured');
        }

        // In real implementation:
        // const client = require('twilio')(accountSid, authToken);
        // await client.messages.create({
        //   body: `Your Smart Bin verification code is: ${otp}`,
        //   from: fromNumber,
        //   to: phone,
        // });

        console.log(`[Twilio] Would send OTP to ${phone}`);
        return true;
    }
}

/**
 * Get the configured SMS provider
 */
function getSMSProvider(): SMSProvider {
    const provider = process.env.SMS_PROVIDER || 'mock';

    switch (provider.toLowerCase()) {
        case 'twilio':
            return new TwilioSMSProvider();
        case 'mock':
        default:
            return new MockSMSProvider();
    }
}

/**
 * Send OTP via SMS
 * 
 * @param phone - Phone number to send to
 * @param otp - OTP code to send
 * @returns boolean - True if sent successfully
 */
import { notificationService } from '@/lib/notifications';

/**
 * Send OTP via SMS
 */
export async function sendOTPviaSMS(
    phone: string,
    otp: string
): Promise<boolean> {
    await notificationService.sendOTP(phone, otp);
    return true;
}

// ============================================
// HIGH-LEVEL API
// ============================================

/**
 * Request OTP
 * Generates OTP, stores it, and sends via SMS
 * 
 * @param phone - Phone number
 * @param purpose - Purpose of OTP (LOGIN, VERIFY_PAYMENT, etc.)
 * @returns Object with expiration time
 * 
 * @example
 * const result = await requestOTP('+919876543210', 'LOGIN');
 * // Returns { message: 'OTP sent', expiresAt: Date }
 */
export async function requestOTP(
    phone: string,
    purpose: string = 'LOGIN'
): Promise<{ message: string; expiresAt: Date }> {
    // Generate and store OTP
    const { otp, expiresAt } = await generateAndStoreOTP({
        phone,
        purpose: purpose as 'LOGIN' | 'VERIFY_PAYMENT' | 'REGISTER',
    });

    // Send via SMS
    await sendOTPviaSMS(phone, otp);

    return {
        message: 'OTP sent successfully',
        expiresAt,
    };
}

// ============================================
// CLEANUP
// ============================================

/**
 * Clean up expired OTPs
 * Run this periodically (e.g., via cron job)
 */
export async function cleanupExpiredOTPs(): Promise<number> {
    const result = await prisma.oTP.deleteMany({
        where: {
            expiresAt: { lt: new Date() },
        },
    });

    return result.count;
}

// ============================================
// CUSTOM ERROR CLASSES
// ============================================

export class OTPError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OTPError';
    }
}

export class OTPRateLimitError extends OTPError {
    constructor(message: string) {
        super(message);
        this.name = 'OTPRateLimitError';
    }
}

export class OTPNotFoundError extends OTPError {
    constructor(message: string) {
        super(message);
        this.name = 'OTPNotFoundError';
    }
}

export class OTPExpiredError extends OTPError {
    constructor(message: string) {
        super(message);
        this.name = 'OTPExpiredError';
    }
}

export class OTPMaxAttemptsError extends OTPError {
    constructor(message: string) {
        super(message);
        this.name = 'OTPMaxAttemptsError';
    }
}

export class OTPInvalidError extends OTPError {
    constructor(message: string) {
        super(message);
        this.name = 'OTPInvalidError';
    }
}
