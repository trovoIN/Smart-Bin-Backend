// ============================================
// Smart Bin - QR Code Service
// ============================================
// This service handles all QR code operations:
// - Bulk QR code generation
// - QR lifecycle management
// - QR resolution (determining context)
// - QR image generation
//
// QR CODE DESIGN:
// ===============
// Each QR contains only a URL: https://domain.com/qr/{secure_token}
// No personal data is stored in the QR itself!
// The secure_token maps to all unit data in the database.
//
// QR LIFECYCLE:
// UNASSIGNED -> ACTIVE -> DEACTIVATED
// ============================================

import prisma from '@/lib/db/prisma';
import { generateSecureToken, generateUrlSafeToken, encrypt, decrypt, sha256Hash } from '@/lib/security';
import { QRCode, QRStatus, QRResolveResponse, UserRole, PaymentStatus } from '@/types';
import QRCodeLib from 'qrcode';
import crypto from 'crypto';

// ============================================
// CONFIGURATION
// ============================================

// QR Token Format: SQR + 16 alphanumeric characters
const QR_TOKEN_PREFIX = 'SQR';
const QR_TOKEN_LENGTH = 16; // 16 alphanumeric characters after prefix

// Base URL for QR codes
const QR_BASE_URL = process.env.QR_BASE_URL || 'http://localhost:3000/qr';

// Alphanumeric characters for token generation (no confusing chars like 0/O, 1/I/l)
const ALPHANUMERIC_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ============================================
// QR GENERATION
// ============================================

/**
 * Generate a single secure QR token
 * Token format: SQR + 16 alphanumeric characters
 * Example: SQRABCD1234EFGH56
 * 
 * The token is:
 * - Prefixed with 'SQR' for identification
 * - 16 alphanumeric characters (cryptographically random)
 * - URL-safe and human-readable
 * 
 * @returns string - Secure token (e.g., "SQRABCD1234EFGH56")
 */
export function generateQRToken(): string {
    // Generate 16 random alphanumeric characters
    const randomBytes = crypto.randomBytes(QR_TOKEN_LENGTH);
    let token = QR_TOKEN_PREFIX;

    for (let i = 0; i < QR_TOKEN_LENGTH; i++) {
        // Use modulo to map random byte to our alphanumeric character set
        const charIndex = randomBytes[i] % ALPHANUMERIC_CHARS.length;
        token += ALPHANUMERIC_CHARS[charIndex];
    }

    return token;
}

/**
 * Encrypt a QR token for secure storage
 * Uses AES-256-GCM encryption
 * 
 * @param token - Plain token to encrypt
 * @returns string - Encrypted token
 */
export function encryptQRToken(token: string): string {
    return encrypt(token);
}

/**
 * Decrypt an encrypted QR token
 * 
 * @param encryptedToken - Encrypted token from database
 * @returns string - Original plain token
 */
export function decryptQRToken(encryptedToken: string): string {
    return decrypt(encryptedToken);
}

/**
 * Generate a hash of the token for lookup
 * This allows us to find tokens without decrypting all of them
 * 
 * @param token - Plain token
 * @returns string - SHA-256 hash of the token
 */
export function hashQRToken(token: string): string {
    return sha256Hash(token);
}


/**
 * Get the full URL for a QR code
 * This is what gets encoded in the QR image
 * 
 * @param token - Secure token
 * @returns string - Full QR URL
 * 
 * @example
 * getQRUrl('abc123') // "https://domain.com/qr/abc123"
 */
export function getQRUrl(token: string): string {
    return `${QR_BASE_URL}/${token}`;
}

/**
 * Generate multiple QR codes in bulk
 * Used by admin to create QR codes for deployment
 * 
 * @param count - Number of QR codes to generate
 * @param prefix - Optional prefix for batch identification
 * @returns Array of created QR codes
 * 
 * @example
 * const qrCodes = await generateBulkQRCodes(100, 'BATCH-Jan2026');
 */
export async function generateBulkQRCodes(
    count: number,
    prefix?: string
): Promise<QRCode[]> {
    // Validate count
    if (count < 1 || count > 1000) {
        throw new Error('Count must be between 1 and 1000');
    }

    // Generate tokens
    const tokens = Array.from({ length: count }, () => generateQRToken());

    // Ensure uniqueness (highly unlikely to have duplicates, but be safe)
    const uniqueTokens = [...new Set(tokens)];
    if (uniqueTokens.length !== count) {
        // Regenerate any duplicates
        while (uniqueTokens.length < count) {
            const newToken = generateQRToken();
            if (!uniqueTokens.includes(newToken)) {
                uniqueTokens.push(newToken);
            }
        }
    }

    // Create QR codes in database
    const createdQRs = await prisma.$transaction(
        uniqueTokens.map((token: string) =>
            prisma.qRCode.create({
                data: {
                    secureToken: prefix ? `${prefix}-${token}` : token,
                    status: 'UNASSIGNED',
                },
            })
        )
    );

    console.log(`Generated ${createdQRs.length} QR codes`);

    return createdQRs as QRCode[];
}

/**
 * Generate a single QR code
 * 
 * @returns Created QR code
 */
export async function generateSingleQRCode(): Promise<QRCode> {
    const token = generateQRToken();

    const qrCode = await prisma.qRCode.create({
        data: {
            secureToken: token,
            status: 'UNASSIGNED',
        },
    });

    return qrCode as QRCode;
}

// ============================================
// QR RESOLUTION
// ============================================

/**
 * Resolve a QR code by its token
 * This is the core function called when a QR is scanned
 * 
 * Response depends on:
 * 1. QR status (UNASSIGNED, ACTIVE, DEACTIVATED)
 * 2. Who is scanning (Collector vs Household)
 * 
 * @param token - QR secure token
 * @param userRole - Role of the person scanning
 * @returns QR resolution response
 * 
 * @example
 * // Collector scans QR
 * const result = await resolveQRCode('abc123', 'COLLECTOR');
 * if (result.status === 'UNASSIGNED') {
 *   // Show registration form
 * } else if (result.status === 'ACTIVE') {
 *   // Show unit details
 * }
 */


/**
 * Calculate distance between two points in meters (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

export async function resolveQRCode(
    token: string,
    userRole?: UserRole,
    location?: { latitude: number; longitude: number },
    collectorId?: number
): Promise<QRResolveResponse> {
    // Find QR by token
    const qrCode = await prisma.qRCode.findUnique({
        where: { secureToken: token },
        include: {
            unit: {
                include: {
                    collector: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    collections: {
                        orderBy: { collectedAt: 'desc' },
                        take: 1,
                    },
                    payments: {
                        orderBy: { month: 'desc' },
                        take: 1,
                    },
                },
            },
        },
    });

    // QR not found
    if (!qrCode) {
        throw new QRNotFoundError('Invalid QR code');
    }

    // QR is deactivated
    if (qrCode.status === 'DEACTIVATED') {
        throw new QRDeactivatedError('This QR code has been deactivated');
    }

    // QR is unassigned (not yet registered to a house)
    if (qrCode.status === 'UNASSIGNED') {
        return {
            status: QRStatus.UNASSIGNED,
        };
    }

    // QR is active - return unit details
    const unit = qrCode.unit!;

    // Check if unit is assigned to a collector
    if (!unit.collectorId) {
        // Unit exists but has no collector assigned
        return {
            status: QRStatus.UNASSIGNED,
            unit: {
                id: unit.id,
                unitNumber: unit.unitNumber,
                phoneNumber: unit.householdPhone || '',
                paymentStatus: 'UNPAID' as PaymentStatus,
                collectorName: 'Unassigned',
            },
        };
    }

    // For collectors: check if unit is assigned to them
    if (userRole === UserRole.COLLECTOR && collectorId) {
        if (unit.collectorId !== collectorId) {
            // Unit is assigned to a different collector
            return {
                status: 'ASSIGNED_TO_OTHER' as QRStatus,
                unit: {
                    id: unit.id,
                    unitNumber: unit.unitNumber,
                    phoneNumber: unit.householdPhone || '',
                    paymentStatus: 'UNPAID' as PaymentStatus,
                    collectorName: unit.collector?.name || 'Another Collector',
                },
            };
        }
    }

    // LOCATION CHECK (For Collectors)
    // @ts-ignore: Prisma types pending update
    if (userRole === UserRole.COLLECTOR && location && unit.latitude && unit.longitude) {
        const distance = calculateDistance(
            location.latitude,
            location.longitude,
            // @ts-ignore
            unit.latitude,
            // @ts-ignore
            unit.longitude
        );

        // 100 meters threshold
        if (distance > 100) {
            throw new QRLocationError(`You are too far from the household (${Math.round(distance)}m). Please move closer.`);
        }
    }

    const lastCollection = unit.collections[0];
    const lastPayment = unit.payments[0];

    // Check if collected today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const collectedToday = lastCollection && new Date(lastCollection.collectedAt) >= today;

    // Determine what data to return based on role
    const response: QRResolveResponse = {
        status: QRStatus.ACTIVE,
        unit: {
            id: unit.id,
            unitNumber: unit.unitNumber,
            phoneNumber: unit.householdPhone || '',
            lastCollectedAt: lastCollection?.collectedAt,
            paymentStatus: (lastPayment?.status || 'UNPAID') as any,
            collectorName: unit.collector?.name || 'Unassigned',
        },
    };

    return response;
}

/**
 * Get QR code by ID
 * 
 * @param id - QR code ID
 * @returns QR code or null
 */
export async function getQRCodeById(id: number): Promise<QRCode | null> {
    const qrCode = await prisma.qRCode.findUnique({
        where: { id },
    });

    return qrCode as QRCode | null;
}

/**
 * Get QR code by token
 * 
 * @param token - Secure token
 * @returns QR code or null
 */
export async function getQRCodeByToken(token: string): Promise<QRCode | null> {
    const qrCode = await prisma.qRCode.findUnique({
        where: { secureToken: token },
    });

    return qrCode as QRCode | null;
}

// ============================================
// QR LIFECYCLE MANAGEMENT
// ============================================

/**
 * Activate a QR code (link to a unit)
 * Called when a collector registers a house
 * 
 * @param qrId - QR code ID
 * @returns Updated QR code
 */
export async function activateQRCode(qrId: number): Promise<QRCode> {
    const qrCode = await prisma.qRCode.update({
        where: { id: qrId },
        data: {
            status: 'ACTIVE',
            activatedAt: new Date(),
        },
    });

    return qrCode as QRCode;
}

/**
 * Deactivate a QR code
 * Used when QR is damaged or needs replacement
 * 
 * @param qrId - QR code ID
 * @param reason - Reason for deactivation (for audit)
 * @returns Updated QR code
 */
export async function deactivateQRCode(
    qrId: number,
    reason?: string
): Promise<QRCode> {
    const qrCode = await prisma.qRCode.update({
        where: { id: qrId },
        data: {
            status: 'DEACTIVATED',
        },
    });

    // Log deactivation for audit
    console.log(`QR ${qrId} deactivated. Reason: ${reason || 'Not specified'}`);

    return qrCode as QRCode;
}

// ============================================
// QR IMAGE GENERATION
// ============================================

/**
 * Generate QR code image as Data URL
 * Returns a base64-encoded image that can be displayed in HTML
 * 
 * @param token - Secure token
 * @returns Data URL string
 * 
 * @example
 * const dataUrl = await generateQRImage('abc123');
 * // Use in HTML: <img src={dataUrl} />
 */
export async function generateQRImageDataUrl(token: string): Promise<string> {
    const url = getQRUrl(token);

    const dataUrl = await QRCodeLib.toDataURL(url, {
        errorCorrectionLevel: 'M', // Medium error correction
        margin: 2,
        width: 300,
        color: {
            dark: '#000000',
            light: '#FFFFFF',
        },
    });

    return dataUrl;
}

/**
 * Generate QR code image as Buffer
 * Used for PDF generation or file downloads
 * 
 * @param token - Secure token
 * @returns PNG image buffer
 */
export async function generateQRImageBuffer(token: string): Promise<Buffer> {
    const url = getQRUrl(token);

    const buffer = await QRCodeLib.toBuffer(url, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 300,
        type: 'png',
    });

    return buffer;
}

/**
 * Generate QR code as SVG string
 * SVG is vector format, scales without losing quality
 * 
 * @param token - Secure token
 * @returns SVG string
 */
export async function generateQRSvg(token: string): Promise<string> {
    const url = getQRUrl(token);

    const svg = await QRCodeLib.toString(url, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 2,
    });

    return svg;
}

/**
 * Generate multiple QR images for PDF export
 * 
 * @param tokens - Array of tokens
 * @returns Array of objects with token and image data
 */
export async function generateBulkQRImages(
    tokens: string[]
): Promise<Array<{ token: string; dataUrl: string }>> {
    const images = await Promise.all(
        tokens.map(async (token: string) => ({
            token,
            dataUrl: await generateQRImageDataUrl(token),
        }))
    );

    return images;
}

// ============================================
// QR LISTING & FILTERING
// ============================================

/**
 * List QR codes with optional filtering
 * 
 * @param filters - Status filter
 * @param pagination - Page and limit
 * @returns Paginated list of QR codes
 */
export async function listQRCodes(
    filters?: { status?: QRStatus },
    pagination?: { page?: number; limit?: number }
): Promise<{ data: QRCode[]; total: number }> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 50;
    const skip = (page - 1) * limit;

    const where = filters?.status ? { status: filters.status } : {};

    const [data, total] = await Promise.all([
        prisma.qRCode.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.qRCode.count({ where }),
    ]);

    return {
        data: data as QRCode[],
        total,
    };
}

/**
 * Get QR statistics
 * 
 * @returns Object with counts by status
 */
export async function getQRStatistics(): Promise<{
    total: number;
    unassigned: number;
    active: number;
    deactivated: number;
}> {
    const [total, unassigned, active, deactivated] = await Promise.all([
        prisma.qRCode.count(),
        prisma.qRCode.count({ where: { status: 'UNASSIGNED' } }),
        prisma.qRCode.count({ where: { status: 'ACTIVE' } }),
        prisma.qRCode.count({ where: { status: 'DEACTIVATED' } }),
    ]);

    return { total, unassigned, active, deactivated };
}

// ============================================
// CUSTOM ERROR CLASSES
// ============================================

export class QRError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'QRError';
    }
}

export class QRNotFoundError extends QRError {
    constructor(message: string = 'QR code not found') {
        super(message);
        this.name = 'QRNotFoundError';
    }
}

export class QRDeactivatedError extends QRError {
    constructor(message: string = 'QR code is deactivated') {
        super(message);
        this.name = 'QRDeactivatedError';
    }
}

export class QRAlreadyActiveError extends QRError {
    constructor(message: string = 'QR code is already active') {
        super(message);
        this.name = 'QRAlreadyActiveError';
    }
}

export class QRLocationError extends QRError {
    constructor(message: string = 'Location mismatch') {
        super(message);
        this.name = 'QRLocationError';
    }
}
