// ============================================
// Smart Bin - Authentication API Route Handlers
// ============================================
// These handlers serve authentication endpoints
// - OTP request/verify (collectors, households, dashboard users)
// - Password login (dashboard users)
// - Token refresh
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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

// ============================================
// VALIDATION SCHEMAS
// ============================================

const phoneSchema = z.object({
    phone: z.string().min(10).max(15),
});

const otpVerifySchema = z.object({
    phone: z.string().min(10).max(15),
    code: z.string().length(6),
});

const passwordLoginSchema = z.object({
    phone: z.string().min(10).max(15),
    password: z.string().min(1),
});

const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1),
});

// ============================================
// RESPONSE HELPERS
// ============================================

function successResponse<T>(data: T, status: number = 200) {
    return NextResponse.json({ success: true, data }, { status });
}

function errorResponse(message: string, code: string = 'ERROR', status: number = 400) {
    return NextResponse.json(
        { success: false, error: { code, message } },
        { status }
    );
}

// ============================================
// OTP REQUEST HANDLER
// ============================================

/**
 * POST /api/auth/request-otp
 * Request OTP for login (any user type)
 */
export async function requestOTPHandler(request: NextRequest) {
    try {
        const body = await request.json();
        const validation = phoneSchema.safeParse(body);

        if (!validation.success) {
            return errorResponse(
                validation.error.issues[0].message,
                'VALIDATION_ERROR',
                400
            );
        }

        const { phone } = validation.data;
        // Read userType from body (frontend sends it there) or fallback to query param
        const userType = body.userType || new URL(request.url).searchParams.get('type') || 'dashboard';
        const qrToken = body.qrToken || new URL(request.url).searchParams.get('qr') || undefined;

        // Route to appropriate OTP service based on user type
        let result;
        if (userType === 'collector') {
            result = await requestCollectorOTP(phone);
        } else if (userType === 'household') {
            result = await requestHouseholdOTP(phone, qrToken);
        } else {
            result = await requestDashboardUserOTP(phone);
        }

        return successResponse(result);
    } catch (error) {
        console.error('Request OTP error:', error);

        if (error instanceof AuthError) {
            return errorResponse(error.message, 'AUTH_ERROR', 401);
        }

        return errorResponse('Failed to send OTP', 'SERVER_ERROR', 500);
    }
}

// ============================================
// OTP VERIFY HANDLER
// ============================================

/**
 * POST /api/auth/verify-otp
 * Verify OTP and login
 */
export async function verifyOTPHandler(request: NextRequest) {
    try {
        const body = await request.json();
        const validation = otpVerifySchema.safeParse(body);

        if (!validation.success) {
            return errorResponse(
                validation.error.issues[0].message,
                'VALIDATION_ERROR',
                400
            );
        }

        const { phone, code } = validation.data;
        // Read userType from body (frontend sends it there) or fallback to query param
        const userType = body.userType || new URL(request.url).searchParams.get('type') || 'dashboard';

        // Route to appropriate verify service based on user type
        let result;
        if (userType === 'collector') {
            result = await verifyCollectorOTP(phone, code);
        } else if (userType === 'household') {
            result = await verifyHouseholdOTP(phone, code);
        } else {
            result = await verifyDashboardUserOTP(phone, code);
        }

        return successResponse(result);
    } catch (error) {
        console.error('Verify OTP error:', error);

        if (error instanceof AuthError) {
            return errorResponse(error.message, 'AUTH_ERROR', 401);
        }

        return errorResponse('Failed to verify OTP', 'SERVER_ERROR', 500);
    }
}

// ============================================
// PASSWORD LOGIN HANDLER
// ============================================

/**
 * POST /api/auth/login
 * Login with password (dashboard users only)
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

        return errorResponse('Login failed', 'SERVER_ERROR', 500);
    }
}

// ============================================
// REFRESH TOKEN HANDLER
// ============================================

/**
 * POST /api/auth/refresh
 * Refresh access token
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
        console.error('Refresh token error:', error);

        if (error instanceof AuthError) {
            return errorResponse(error.message, 'AUTH_ERROR', 401);
        }

        return errorResponse('Token refresh failed', 'SERVER_ERROR', 500);
    }
}
