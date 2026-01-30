// ============================================
// Smart Bin - JWT Authentication Module
// ============================================
// This file handles all JWT (JSON Web Token) operations:
// - Token generation (access & refresh tokens)
// - Token verification
// - Token refresh flow
//
// JWT EXPLAINED FOR BEGINNERS:
// ============================
// JWT is a secure way to transmit information between parties.
// It's like a signed digital ticket that proves who you are.
//
// A JWT has 3 parts (separated by dots):
// 1. HEADER: Contains token type and algorithm
// 2. PAYLOAD: Contains user data (claims)
// 3. SIGNATURE: Verifies the token hasn't been tampered with
//
// Example: xxxxx.yyyyy.zzzzz
//
// HOW IT WORKS:
// 1. User logs in with phone + OTP
// 2. Server creates a JWT with user info
// 3. Server signs JWT with a SECRET key
// 4. User stores JWT (in app/browser)
// 5. User sends JWT with each request
// 6. Server verifies signature to authenticate
// ============================================

import jwt from 'jsonwebtoken';
import { JWTPayload, DecodedToken, UserRole } from '@/types';

// ============================================
// CONFIGURATION
// ============================================

/**
 * Get JWT secret from environment
 * This secret is used to sign and verify tokens
 * IMPORTANT: Keep this secret VERY secure!
 */
function getJWTSecret(): string {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error('JWT_SECRET environment variable is required');
    }

    // Warn if secret is too short (security risk)
    if (secret.length < 32) {
        console.warn('WARNING: JWT_SECRET should be at least 32 characters');
    }

    return secret;
}

/**
 * Token expiration times
 * Access token: Short-lived (7 days for mobile apps)
 * Refresh token: Long-lived (30 days)
 */
const ACCESS_TOKEN_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_TOKEN_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

// ============================================
// TOKEN GENERATION
// ============================================

/**
 * Generate an access token for a user
 * This is the main token used for API requests
 * 
 * @param userId - User's database ID
 * @param role - User's role (ADMIN, COLLECTOR, etc.)
 * @param phone - User's phone number
 * @returns string - Signed JWT access token
 * 
 * @example
 * const token = generateAccessToken(1, 'COLLECTOR', '+919876543210');
 * // Send this token to the client
 */
export function generateAccessToken(
    userId: number | string,
    role: UserRole,
    phone: string
): string {
    const payload: JWTPayload = {
        sub: userId.toString(),
        role,
        phone,
        type: 'access',
    };

    return jwt.sign(payload, getJWTSecret(), {
        expiresIn: ACCESS_TOKEN_EXPIRES as any,
        algorithm: 'HS256', // HMAC with SHA-256
    });
}

/**
 * Generate a refresh token
 * Used to get new access tokens without re-authentication
 * 
 * @param userId - User's database ID
 * @param role - User's role
 * @param phone - User's phone number
 * @returns string - Signed JWT refresh token
 */
export function generateRefreshToken(
    userId: number | string,
    role: UserRole,
    phone: string
): string {
    const payload: JWTPayload = {
        sub: userId.toString(),
        role,
        phone,
        type: 'refresh',
    };

    return jwt.sign(payload, getJWTSecret(), {
        expiresIn: REFRESH_TOKEN_EXPIRES as any,
        algorithm: 'HS256',
    });
}

/**
 * Generate both access and refresh tokens
 * Convenience function for login flow
 * 
 * @returns Object with accessToken and refreshToken
 * 
 * @example
 * const tokens = generateTokenPair(1, 'COLLECTOR', '+919876543210');
 * // Return tokens to client on successful login
 */
export function generateTokenPair(
    userId: number | string,
    role: UserRole,
    phone: string
): { accessToken: string; refreshToken: string } {
    return {
        accessToken: generateAccessToken(userId, role, phone),
        refreshToken: generateRefreshToken(userId, role, phone),
    };
}

// ============================================
// TOKEN VERIFICATION
// ============================================

/**
 * Verify and decode a JWT token
 * Returns the decoded payload if valid
 * Throws an error if invalid or expired
 * 
 * @param token - JWT token to verify
 * @returns DecodedToken - Decoded token payload
 * @throws Error if token is invalid
 * 
 * @example
 * try {
 *   const decoded = verifyToken(token);
 *   console.log('User ID:', decoded.sub);
 * } catch (error) {
 *   console.log('Invalid token');
 * }
 */
export function verifyToken(token: string): DecodedToken {
    try {
        const decoded = jwt.verify(token, getJWTSecret()) as DecodedToken;
        return decoded;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new TokenExpiredError('Token has expired');
        }
        if (error instanceof jwt.JsonWebTokenError) {
            throw new InvalidTokenError('Invalid token');
        }
        throw error;
    }
}

/**
 * Verify an access token specifically
 * Ensures the token is of type 'access'
 */
export function verifyAccessToken(token: string): DecodedToken {
    const decoded = verifyToken(token);

    if (decoded.type !== 'access') {
        throw new InvalidTokenError('Expected access token');
    }

    return decoded;
}

/**
 * Verify a refresh token specifically
 * Ensures the token is of type 'refresh'
 */
export function verifyRefreshToken(token: string): DecodedToken {
    const decoded = verifyToken(token);

    if (decoded.type !== 'refresh') {
        throw new InvalidTokenError('Expected refresh token');
    }

    return decoded;
}

// ============================================
// TOKEN REFRESH FLOW
// ============================================

/**
 * Refresh tokens using a valid refresh token
 * Generates new access and refresh tokens
 * 
 * @param refreshToken - Valid refresh token
 * @returns Object with new tokens
 * @throws Error if refresh token is invalid
 * 
 * @example
 * // When access token expires, use refresh token
 * const newTokens = refreshTokens(oldRefreshToken);
 */
export function refreshTokens(refreshToken: string): {
    accessToken: string;
    refreshToken: string;
} {
    const decoded = verifyRefreshToken(refreshToken);

    // Generate new token pair
    return generateTokenPair(
        decoded.sub,
        decoded.role,
        decoded.phone
    );
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Extract token from Authorization header
 * Expected format: "Bearer <token>"
 * 
 * @param authHeader - Authorization header value
 * @returns string | null - Extracted token or null
 * 
 * @example
 * const token = extractBearerToken(req.headers.authorization);
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
    if (!authHeader) return null;

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return null;
    }

    return parts[1];
}

/**
 * Decode token without verification
 * Useful for reading token contents without validating
 * WARNING: Don't use this for authentication!
 * 
 * @param token - JWT token
 * @returns Decoded payload or null
 */
export function decodeToken(token: string): JWTPayload | null {
    try {
        return jwt.decode(token) as JWTPayload;
    } catch {
        return null;
    }
}

/**
 * Check if a token is expired
 * 
 * @param token - JWT token
 * @returns boolean - True if expired
 */
export function isTokenExpired(token: string): boolean {
    try {
        const decoded = jwt.decode(token) as DecodedToken;

        if (!decoded || !decoded.exp) {
            return true;
        }

        // exp is in seconds, Date.now() is in milliseconds
        return decoded.exp * 1000 < Date.now();
    } catch {
        return true;
    }
}

/**
 * Get remaining time until token expires
 * 
 * @param token - JWT token
 * @returns number - Milliseconds until expiration (negative if expired)
 */
export function getTokenRemainingTime(token: string): number {
    try {
        const decoded = jwt.decode(token) as DecodedToken;

        if (!decoded || !decoded.exp) {
            return -1;
        }

        return decoded.exp * 1000 - Date.now();
    } catch {
        return -1;
    }
}

// ============================================
// CUSTOM ERROR CLASSES
// ============================================

/**
 * Error thrown when token has expired
 */
export class TokenExpiredError extends Error {
    constructor(message: string = 'Token has expired') {
        super(message);
        this.name = 'TokenExpiredError';
    }
}

/**
 * Error thrown when token is invalid
 */
export class InvalidTokenError extends Error {
    constructor(message: string = 'Invalid token') {
        super(message);
        this.name = 'InvalidTokenError';
    }
}

// ============================================
// ROLE-BASED CHECKS
// ============================================

/**
 * Check if a role has permission for an action
 * Implements role hierarchy:
 * ADMIN > SUPERVISOR > CONTRACTOR > GOVT
 * COLLECTOR and HOUSEHOLD are separate roles
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
    [UserRole.ADMIN]: 100,
    [UserRole.SUPERVISOR]: 80,
    [UserRole.CONTRACTOR]: 60,
    [UserRole.GOVT]: 40,
    [UserRole.COLLECTOR]: 30,
    [UserRole.HOUSEHOLD]: 20,
};

/**
 * Check if a role has at least the minimum required role
 * 
 * @param userRole - User's actual role
 * @param requiredRole - Minimum required role
 * @returns boolean - True if user has sufficient privileges
 */
export function hasMinimumRole(
    userRole: UserRole,
    requiredRole: UserRole
): boolean {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if a role is exactly one of the allowed roles
 * 
 * @param userRole - User's actual role
 * @param allowedRoles - List of allowed roles
 * @returns boolean - True if user's role is in the list
 */
export function hasRole(
    userRole: UserRole,
    allowedRoles: UserRole[]
): boolean {
    return allowedRoles.includes(userRole);
}
