// ============================================
// Smart Bin - Authentication Service
// ============================================
// This service handles all authentication flows:
// - Collector login (OTP-based)
// - Household login (OTP-based)
// - Dashboard user login (OTP or password)
// - Token refresh
// - Logout
//
// AUTHENTICATION FLOW:
// ====================
// 1. User requests OTP with phone number
// 2. Backend generates OTP, stores hash, sends SMS
// 3. User enters OTP
// 4. Backend verifies OTP
// 5. Backend returns JWT access + refresh tokens
// 6. User includes access token in all API requests
// 7. When access token expires, use refresh token
// ============================================

import prisma from '@/lib/db/prisma';
import {
    generateTokenPair,
    verifyRefreshToken,
    refreshTokens as refreshJWTTokens,
} from '@/lib/auth/jwt';
import { requestOTP, verifyOTP } from '@/lib/auth/otp';
import { hashPassword, verifyPassword } from '@/lib/security';
import { UserRole, Collector, User } from '@/types';

// ============================================
// COLLECTOR AUTHENTICATION
// ============================================

/**
 * Request OTP for collector login
 * Only pre-registered collectors can log in
 * 
 * @param phone - Collector's phone number
 * @returns OTP expiration info
 * @throws Error if collector not found
 * 
 * @example
 * const result = await requestCollectorOTP('+919876543210');
 * // { message: 'OTP sent', expiresAt: Date }
 */
export async function requestCollectorOTP(phone: string): Promise<{
    message: string;
    expiresAt: Date;
}> {
    // Normalize phone number - try both with and without +91 prefix
    let collector = await prisma.collector.findUnique({
        where: { phone },
    });

    // If not found with exact match, try without country code
    if (!collector && phone.startsWith('+91')) {
        const phoneWithoutPrefix = phone.substring(3); // Remove +91
        collector = await prisma.collector.findUnique({
            where: { phone: phoneWithoutPrefix },
        });
    }

    // If still not found, try with +91 prefix
    if (!collector && !phone.startsWith('+91') && phone.length === 10) {
        collector = await prisma.collector.findUnique({
            where: { phone: `+91${phone}` },
        });
    }

    if (!collector) {
        throw new AuthError('Collector not found. Please contact admin.');
    }

    if (collector.status !== 'ACTIVE') {
        throw new AuthError('Your account is inactive. Please contact admin.');
    }

    // Send OTP using the phone number from the database
    return requestOTP(collector.phone, 'LOGIN');
}

/**
 * Verify OTP and login collector
 * Returns JWT tokens on successful verification
 * 
 * @param phone - Collector's phone number
 * @param code - OTP code
 * @returns Tokens and collector info
 * 
 * @example
 * const result = await verifyCollectorOTP('+919876543210', '123456');
 * // { accessToken, refreshToken, collector }
 */
export async function verifyCollectorOTP(
    phone: string,
    code: string
): Promise<{
    accessToken: string;
    refreshToken: string;
    collector: Partial<Collector>;
}> {
    // Verify OTP
    await verifyOTP({ phone, code, purpose: 'LOGIN' });

    // Get collector details - try multiple phone formats
    let collector = await prisma.collector.findUnique({
        where: { phone },
    });

    // If not found with exact match, try without country code
    if (!collector && phone.startsWith('+91')) {
        const phoneWithoutPrefix = phone.substring(3);
        collector = await prisma.collector.findUnique({
            where: { phone: phoneWithoutPrefix },
        });
    }

    // If still not found, try with +91 prefix
    if (!collector && !phone.startsWith('+91') && phone.length === 10) {
        collector = await prisma.collector.findUnique({
            where: { phone: `+91${phone}` },
        });
    }

    if (!collector) {
        throw new AuthError('Collector not found');
    }

    // Generate tokens
    const tokens = generateTokenPair(
        collector.id,
        UserRole.COLLECTOR,
        collector.phone
    );

    // Log login for audit
    await logLogin(collector.id, UserRole.COLLECTOR, phone);

    return {
        ...tokens,
        collector: {
            id: collector.id,
            name: collector.name,
            phone: collector.phone,
            assignedRoute: collector.assignedRoute || undefined,
        },
    };
}

// ============================================
// HOUSEHOLD AUTHENTICATION
// ============================================

/**
 * Request OTP for household login
 * Household phone must be registered to a unit
 * 
 * @param phone - Household phone number
 * @param qrToken - QR token (optional, for context)
 * @returns OTP expiration info
 */
export async function requestHouseholdOTP(
    phone: string,
    qrToken?: string
): Promise<{
    message: string;
    expiresAt: Date;
    unitNumber?: string;
}> {
    // Find unit by phone
    const unit = await prisma.unit.findFirst({
        where: { householdPhone: phone },
    });

    if (!unit) {
        throw new AuthError('Phone number not registered to any unit.');
    }

    // Send OTP
    const otpResult = await requestOTP(phone, 'LOGIN');

    return {
        ...otpResult,
        unitNumber: unit.unitNumber,
    };
}

/**
 * Verify OTP and login household
 * 
 * @param phone - Household phone number
 * @param code - OTP code
 * @returns Tokens and unit info
 */
export async function verifyHouseholdOTP(
    phone: string,
    code: string
): Promise<{
    accessToken: string;
    refreshToken: string;
    unitId: number;  // Add unitId at top level for frontend
    unit: {
        id: number;
        unitNumber: string;
        collectorName: string;
    };
}> {
    // Verify OTP
    await verifyOTP({ phone, code, purpose: 'LOGIN' });

    // Get unit details
    const unit = await prisma.unit.findFirst({
        where: { householdPhone: phone },
        include: {
            collector: {
                select: { name: true },
            },
        },
    });

    if (!unit) {
        throw new AuthError('Unit not found');
    }

    // Generate tokens
    const tokens = generateTokenPair(
        unit.id,
        UserRole.HOUSEHOLD,
        phone
    );

    // Log login
    await logLogin(unit.id, UserRole.HOUSEHOLD, phone);

    return {
        ...tokens,
        unitId: unit.id,  // Add unitId at top level
        unit: {
            id: unit.id,
            unitNumber: unit.unitNumber,
            collectorName: unit.collector?.name || 'Unassigned',
        },
    };
}

// ============================================
// DASHBOARD USER AUTHENTICATION
// ============================================

/**
 * Request OTP for dashboard user login
 * 
 * @param phone - User's phone number
 * @returns OTP expiration info
 */
export async function requestDashboardUserOTP(phone: string): Promise<{
    message: string;
    expiresAt: Date;
    role: UserRole;
}> {
    // Check if user exists
    const user = await prisma.user.findUnique({
        where: { phone },
    });

    if (!user) {
        throw new AuthError('User not found. Please contact admin.');
    }

    if (!user.isActive) {
        throw new AuthError('Your account is inactive. Please contact admin.');
    }

    // Send OTP
    const otpResult = await requestOTP(phone, 'LOGIN');

    return {
        ...otpResult,
        role: user.role as UserRole,
    };
}

/**
 * Verify OTP and login dashboard user
 * 
 * @param phone - User's phone number
 * @param code - OTP code
 * @returns Tokens and user info
 */
export async function verifyDashboardUserOTP(
    phone: string,
    code: string
): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Partial<User>;
}> {
    // Verify OTP
    await verifyOTP({ phone, code, purpose: 'LOGIN' });

    // Get user details
    const user = await prisma.user.findUnique({
        where: { phone },
    });

    if (!user) {
        throw new AuthError('User not found');
    }

    // Generate tokens
    const tokens = generateTokenPair(
        user.id,
        user.role as UserRole,
        user.phone
    );

    // Update last login
    await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });

    // Log login
    await logLogin(user.id, user.role as UserRole, phone);

    return {
        ...tokens,
        user: {
            id: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role as UserRole,
            assignedWard: user.assignedWard || undefined,
        },
    };
}

/**
 * Login dashboard user with password
 * Alternative to OTP for admin users
 * 
 * @param phone - User's phone number
 * @param password - Password
 * @returns Tokens and user info
 */
export async function loginWithPassword(
    phone: string,
    password: string
): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Partial<User>;
}> {
    // Get user
    const user = await prisma.user.findUnique({
        where: { phone },
    });

    if (!user || !user.passwordHash) {
        throw new AuthError('Invalid credentials');
    }

    if (!user.isActive) {
        throw new AuthError('Your account is inactive');
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
        throw new AuthError('Invalid credentials');
    }

    // Generate tokens
    const tokens = generateTokenPair(
        user.id,
        user.role as UserRole,
        user.phone
    );

    // Update last login
    await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });

    // Log login
    await logLogin(user.id, user.role as UserRole, phone);

    return {
        ...tokens,
        user: {
            id: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role as UserRole,
            assignedWard: user.assignedWard || undefined,
        },
    };
}

// ============================================
// TOKEN REFRESH
// ============================================

/**
 * Refresh access token using refresh token
 * 
 * @param refreshToken - Valid refresh token
 * @returns New token pair
 */
export async function refreshAuthTokens(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
}> {
    return refreshJWTTokens(refreshToken);
}

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * Create a new dashboard user
 * Only admin can create users
 * 
 * @param data - User data
 * @returns Created user
 */
export async function createUser(data: {
    name: string;
    phone: string;
    email?: string;
    role: UserRole;
    assignedWard?: string;
    password?: string;
}): Promise<User> {
    // Check if phone already exists
    const existing = await prisma.user.findUnique({
        where: { phone: data.phone },
    });

    if (existing) {
        throw new AuthError('User with this phone already exists');
    }

    // Hash password if provided
    let passwordHash: string | undefined;
    if (data.password) {
        passwordHash = await hashPassword(data.password);
    }

    // Create user
    const user = await prisma.user.create({
        data: {
            name: data.name,
            phone: data.phone,
            email: data.email,
            role: data.role,
            assignedWard: data.assignedWard,
            passwordHash,
        },
    });

    return user as unknown as User;
}

/**
 * Create a new collector
 * 
 * @param data - Collector data
 * @returns Created collector
 */
export async function createCollector(data: {
    name: string;
    phone: string;
    upiId: string;
    assignedRoute?: string;
}): Promise<Collector> {
    // Check if phone already exists
    const existing = await prisma.collector.findUnique({
        where: { phone: data.phone },
    });

    if (existing) {
        throw new AuthError('Collector with this phone already exists');
    }

    // Create collector
    const collector = await prisma.collector.create({
        data: {
            name: data.name,
            phone: data.phone,
            upiId: data.upiId,
            assignedRoute: data.assignedRoute,
            status: 'ACTIVE',
        },
    });

    return collector as unknown as Collector;
}

// ============================================
// AUDIT LOGGING
// ============================================

/**
 * Log login event for audit
 */
async function logLogin(
    userId: number,
    role: UserRole,
    phone: string
): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                action: 'LOGIN',
                entityType: role === UserRole.COLLECTOR ? 'Collector' : 'User',
                entityId: userId,
                userId,
                userRole: role,
                metadata: {
                    phone: phone.slice(-4), // Only store last 4 digits
                    timestamp: new Date().toISOString(),
                },
            },
        });
    } catch (error) {
        // Don't fail login if audit logging fails
        console.error('Failed to log login:', error);
    }
}

// ============================================
// CUSTOM ERROR CLASSES
// ============================================

export class AuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthError';
    }
}

export class UnauthorizedError extends AuthError {
    constructor(message: string = 'Unauthorized') {
        super(message);
        this.name = 'UnauthorizedError';
    }
}

export class ForbiddenError extends AuthError {
    constructor(message: string = 'Forbidden') {
        super(message);
        this.name = 'ForbiddenError';
    }
}
