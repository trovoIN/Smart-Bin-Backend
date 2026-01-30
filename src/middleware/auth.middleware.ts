// ============================================
// Smart Bin - Authentication Middleware
// ============================================
// This middleware handles:
// - Extracting JWT from Authorization header
// - Verifying JWT tokens
// - Adding user info to request context
// - Checking role-based access
//
// USAGE:
// This middleware is used in API routes to protect
// endpoints that require authentication.
//
// Example:
// const { user } = await authenticate(request);
// if (!user) return unauthorized();
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import {
    verifyAccessToken,
    extractBearerToken,
    hasRole,
    hasMinimumRole,
} from '@/lib/auth/jwt';
import { UserRole, DecodedToken } from '@/types';

// ============================================
// TYPES
// ============================================

/**
 * Authenticated user context
 * This is added to requests after successful authentication
 */
export interface AuthContext {
    userId: number;
    role: UserRole;
    phone: string;
    token: DecodedToken;
}

/**
 * Authentication result
 */
export interface AuthResult {
    success: boolean;
    user?: AuthContext;
    error?: {
        code: string;
        message: string;
    };
}

// ============================================
// AUTHENTICATION FUNCTION
// ============================================

/**
 * Authenticate a request using JWT
 * 
 * @param request - Incoming request
 * @returns Authentication result with user context
 * 
 * @example
 * const auth = await authenticate(request);
 * if (!auth.success) {
 *   return NextResponse.json({ error: auth.error }, { status: 401 });
 * }
 * const { userId, role } = auth.user!;
 */
export async function authenticate(request: NextRequest): Promise<AuthResult> {
    try {
        // Extract token from Authorization header
        const authHeader = request.headers.get('authorization');
        const token = extractBearerToken(authHeader || '');

        if (!token) {
            return {
                success: false,
                error: {
                    code: 'NO_TOKEN',
                    message: 'No authentication token provided',
                },
            };
        }

        // Verify token
        const decoded = verifyAccessToken(token);

        // Build user context
        const user: AuthContext = {
            userId: parseInt(decoded.sub, 10),
            role: decoded.role,
            phone: decoded.phone,
            token: decoded,
        };

        return {
            success: true,
            user,
        };

    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'TokenExpiredError') {
                return {
                    success: false,
                    error: {
                        code: 'TOKEN_EXPIRED',
                        message: 'Authentication token has expired',
                    },
                };
            }

            if (error.name === 'InvalidTokenError') {
                return {
                    success: false,
                    error: {
                        code: 'INVALID_TOKEN',
                        message: 'Invalid authentication token',
                    },
                };
            }
        }

        return {
            success: false,
            error: {
                code: 'AUTH_ERROR',
                message: 'Authentication failed',
            },
        };
    }
}

// ============================================
// AUTHORIZATION HELPERS
// ============================================

/**
 * Check if user has one of the required roles
 * 
 * @param user - Authenticated user context
 * @param roles - Array of allowed roles
 * @returns boolean - True if user has required role
 * 
 * @example
 * if (!requireRoles(user, [UserRole.ADMIN, UserRole.SUPERVISOR])) {
 *   return forbidden();
 * }
 */
export function requireRoles(user: AuthContext, roles: UserRole[]): boolean {
    return hasRole(user.role, roles);
}

/**
 * Check if user has at least the minimum role
 * Uses role hierarchy for comparison
 * 
 * @param user - Authenticated user context
 * @param minimumRole - Minimum required role
 * @returns boolean - True if user has sufficient role
 */
export function requireMinimumRole(
    user: AuthContext,
    minimumRole: UserRole
): boolean {
    return hasMinimumRole(user.role, minimumRole);
}

/**
 * Check if user is an admin
 */
export function isAdmin(user: AuthContext): boolean {
    return user.role === UserRole.ADMIN;
}

/**
 * Check if user is a supervisor or higher
 */
export function isSupervisorOrAbove(user: AuthContext): boolean {
    return hasMinimumRole(user.role, UserRole.SUPERVISOR);
}

/**
 * Check if user is a collector
 */
export function isCollector(user: AuthContext): boolean {
    return user.role === UserRole.COLLECTOR;
}

/**
 * Check if user is a household
 */
export function isHousehold(user: AuthContext): boolean {
    return user.role === UserRole.HOUSEHOLD;
}

// ============================================
// RESPONSE HELPERS
// ============================================

/**
 * Create unauthorized response (401)
 */
export function unauthorizedResponse(
    message: string = 'Unauthorized',
    code: string = 'UNAUTHORIZED'
): NextResponse {
    return NextResponse.json(
        {
            success: false,
            error: {
                code,
                message,
            },
        },
        { status: 401 }
    );
}

/**
 * Create forbidden response (403)
 */
export function forbiddenResponse(
    message: string = 'Forbidden',
    code: string = 'FORBIDDEN'
): NextResponse {
    return NextResponse.json(
        {
            success: false,
            error: {
                code,
                message,
            },
        },
        { status: 403 }
    );
}

// ============================================
// HIGHER-ORDER MIDDLEWARE FUNCTIONS
// ============================================

/**
 * Create a protected route handler
 * Wraps a handler with authentication check
 * 
 * @param handler - Route handler function
 * @param options - Authentication options
 * @returns Protected handler
 * 
 * @example
 * export const GET = withAuth(
 *   async (request, { user }) => {
 *     // user is guaranteed to be authenticated
 *     return NextResponse.json({ userId: user.userId });
 *   },
 *   { roles: [UserRole.ADMIN] }
 * );
 */
export function withAuth(
    handler: (
        request: NextRequest,
        context: { user: AuthContext }
    ) => Promise<NextResponse>,
    options?: {
        roles?: UserRole[];
        minimumRole?: UserRole;
    }
) {
    return async (request: NextRequest): Promise<NextResponse> => {
        // Authenticate
        const auth = await authenticate(request);

        if (!auth.success || !auth.user) {
            return unauthorizedResponse(auth.error?.message, auth.error?.code);
        }

        // Check roles if specified
        if (options?.roles && !requireRoles(auth.user, options.roles)) {
            return forbiddenResponse(
                `Access denied. Required roles: ${options.roles.join(', ')}`
            );
        }

        // Check minimum role if specified
        if (options?.minimumRole && !requireMinimumRole(auth.user, options.minimumRole)) {
            return forbiddenResponse(
                `Access denied. Minimum role required: ${options.minimumRole}`
            );
        }

        // Call the handler with authenticated context
        return handler(request, { user: auth.user });
    };
}

/**
 * Create a collector-only route handler
 */
export function withCollectorAuth(
    handler: (
        request: NextRequest,
        context: { user: AuthContext }
    ) => Promise<NextResponse>
) {
    return withAuth(handler, { roles: [UserRole.COLLECTOR] });
}

/**
 * Create a household-only route handler
 */
export function withHouseholdAuth(
    handler: (
        request: NextRequest,
        context: { user: AuthContext }
    ) => Promise<NextResponse>
) {
    return withAuth(handler, { roles: [UserRole.HOUSEHOLD] });
}

/**
 * Create an admin-only route handler
 */
export function withAdminAuth(
    handler: (
        request: NextRequest,
        context: { user: AuthContext }
    ) => Promise<NextResponse>
) {
    return withAuth(handler, { roles: [UserRole.ADMIN] });
}

/**
 * Create a supervisor+ route handler
 */
export function withSupervisorAuth(
    handler: (
        request: NextRequest,
        context: { user: AuthContext }
    ) => Promise<NextResponse>
) {
    return withAuth(handler, { minimumRole: UserRole.SUPERVISOR });
}
