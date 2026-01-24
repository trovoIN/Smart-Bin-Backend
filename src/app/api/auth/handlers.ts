// ============================================
// Smart Bin - Authentication API Routes
// ============================================
// POST /api/auth/request-otp - Request OTP for login
// POST /api/auth/verify-otp - Verify OTP and get tokens
// POST /api/auth/refresh - Refresh access token
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import {
    requestCollectorOTP,
    verifyCollectorOTP,
    requestHouseholdOTP,
    verifyHouseholdOTP,
    requestDashboardUserOTP,
    verifyDashboardUserOTP,
    loginWithPassword,
    refreshAuthTokens,
    AuthError,
} from '@/services/auth.service';
import { z } from 'zod';

// ============================================
// VALIDATION SCHEMAS
// ============================================

// Request OTP schema
const requestOTPSchema = z.object({
    phone: z.string()
        .min(10, 'Phone number must be at least 10 digits')
        .max(15, 'Phone number too long')
        .regex(/^\+?[0-9]+$/, 'Invalid phone number format'),
    userType: z.enum(['collector', 'household', 'dashboard']),
    qrToken: z.string().optional(), // For household context
});

// Verify OTP schema
const verifyOTPSchema = z.object({
    phone: z.string()
        .min(10, 'Phone number must be at least 10 digits')
        .max(15, 'Phone number too long'),
    code: z.string()
        .length(6, 'OTP must be 6 digits')
        .regex(/^[0-9]+$/, 'OTP must contain only digits'),
    userType: z.enum(['collector', 'household', 'dashboard']),
});

// Password login schema
const passwordLoginSchema = z.object({
    phone: z.string().min(10).max(15),
    password: z.string().min(6, 'Password too short'),
});

// Refresh token schema
const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token required'),
});

// ============================================
// API RESPONSE HELPERS
// ============================================

/**
 * Create a successful API response
 */
function successResponse<T>(data: T, status: number = 200) {
    return NextResponse.json(
        {
            success: true,
            data,
        },
        { status }
    );
}

/**
 * Create an error API response
 */
function errorResponse(
    message: string,
    code: string = 'ERROR',
    status: number = 400
) {
    return NextResponse.json(
        {
            success: false,
            error: {
                code,
                message,
            },
        },
        { status }
    );
}

// ============================================
// REQUEST OTP ENDPOINT
// ============================================

/**
 * POST /api/auth/request-otp
 * Request OTP for login
 * 
 * Request Body:
 * {
 *   phone: "+919876543210",
 *   userType: "collector" | "household" | "dashboard",
 *   qrToken?: "abc123" // Optional, for household
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     message: "OTP sent successfully",
 *     expiresAt: "2026-01-20T12:00:00Z"
 *   }
 * }
 */
export async function requestOTPHandler(request: NextRequest) {
    try {
        // Parse and validate request body
        const body = await request.json();
        const validation = requestOTPSchema.safeParse(body);

        if (!validation.success) {
            return errorResponse(
                validation.error.issues[0].message,
                'VALIDATION_ERROR',
                400
            );
        }

        const { phone, userType, qrToken } = validation.data;

        // Route to appropriate handler based on user type
        let result;

        switch (userType) {
            case 'collector':
                result = await requestCollectorOTP(phone);
                break;

            case 'household':
                result = await requestHouseholdOTP(phone, qrToken);
                break;

            case 'dashboard':
                result = await requestDashboardUserOTP(phone);
                break;

            default:
                return errorResponse('Invalid user type', 'INVALID_USER_TYPE', 400);
        }

        return successResponse(result);

    } catch (error) {
        console.error('Request OTP error:', error);

        if (error instanceof AuthError) {
            return errorResponse(error.message, 'AUTH_ERROR', 400);
        }

        // Handle rate limit errors
        if (error instanceof Error && error.message.includes('wait')) {
            return errorResponse(error.message, 'RATE_LIMITED', 429);
        }

        return errorResponse(
            'Failed to send OTP. Please try again.',
            'SERVER_ERROR',
            500
        );
    }
}

// ============================================
// VERIFY OTP ENDPOINT
// ============================================

/**
 * POST /api/auth/verify-otp
 * Verify OTP and get JWT tokens
 * 
 * Request Body:
 * {
 *   phone: "+919876543210",
 *   code: "123456",
 *   userType: "collector" | "household" | "dashboard"
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     accessToken: "eyJ...",
 *     refreshToken: "eyJ...",
 *     collector: { ... } // or unit or user depending on type
 *   }
 * }
 */
export async function verifyOTPHandler(request: NextRequest) {
    try {
        // Parse and validate request body
        const body = await request.json();
        const validation = verifyOTPSchema.safeParse(body);

        if (!validation.success) {
            return errorResponse(
                validation.error.issues[0].message,
                'VALIDATION_ERROR',
                400
            );
        }

        const { phone, code, userType } = validation.data;

        // Route to appropriate handler
        let result;

        switch (userType) {
            case 'collector':
                result = await verifyCollectorOTP(phone, code);
                break;

            case 'household':
                result = await verifyHouseholdOTP(phone, code);
                break;

            case 'dashboard':
                result = await verifyDashboardUserOTP(phone, code);
                break;

            default:
                return errorResponse('Invalid user type', 'INVALID_USER_TYPE', 400);
        }

        return successResponse(result);

    } catch (error) {
        console.error('Verify OTP error:', error);

        if (error instanceof Error) {
            // Handle specific OTP errors
            if (error.name.includes('OTP')) {
                return errorResponse(error.message, 'OTP_ERROR', 400);
            }

            if (error instanceof AuthError) {
                return errorResponse(error.message, 'AUTH_ERROR', 401);
            }
        }

        return errorResponse(
            'OTP verification failed. Please try again.',
            'SERVER_ERROR',
            500
        );
    }
}

// ============================================
// PASSWORD LOGIN ENDPOINT
// ============================================

/**
 * POST /api/auth/login
 * Login with password (for dashboard users)
 * 
 * Request Body:
 * {
 *   phone: "+919876543210",
 *   password: "your-password"
 * }
 */
export async function passwordLoginHandler(request: NextRequest) {
    try {
        const body = await request.json();
        const validation = passwordLoginSchema.safeParse(body);

        if (!validation.success) {
            return errorResponse(
                validation.error.issues[0].message,
                'VALIDATION_ERROR',
                400
            );
        }

        const { phone, password } = validation.data;
        const result = await loginWithPassword(phone, password);

        return successResponse(result);

    } catch (error) {
        console.error('Password login error:', error);

        if (error instanceof AuthError) {
            return errorResponse(error.message, 'AUTH_ERROR', 401);
        }

        return errorResponse(
            'Login failed. Please try again.',
            'SERVER_ERROR',
            500
        );
    }
}

// ============================================
// TOKEN REFRESH ENDPOINT
// ============================================

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 * 
 * Request Body:
 * {
 *   refreshToken: "eyJ..."
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     accessToken: "eyJ...",
 *     refreshToken: "eyJ..."
 *   }
 * }
 */
export async function refreshTokenHandler(request: NextRequest) {
    try {
        const body = await request.json();
        const validation = refreshTokenSchema.safeParse(body);

        if (!validation.success) {
            return errorResponse(
                validation.error.issues[0].message,
                'VALIDATION_ERROR',
                400
            );
        }

        const { refreshToken } = validation.data;
        const result = await refreshAuthTokens(refreshToken);

        return successResponse(result);

    } catch (error) {
        console.error('Token refresh error:', error);

        if (error instanceof Error) {
            if (error.name.includes('Token')) {
                return errorResponse(
                    'Invalid or expired refresh token. Please login again.',
                    'TOKEN_ERROR',
                    401
                );
            }
        }

        return errorResponse(
            'Token refresh failed. Please login again.',
            'SERVER_ERROR',
            500
        );
    }
}
