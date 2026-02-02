// ============================================
// Smart Bin - Household API Route Handlers
// ============================================
// These handlers serve the Household PWA
// All endpoints require HOUSEHOLD role authentication
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withHouseholdAuth, AuthContext } from '@/middleware/auth.middleware';
import { registerUnitWithLocation, getUnitById } from '@/services/unit.service';
import { getCollectionHistory } from '@/services/collection.service';
import {
    claimPayment,
    getCurrentPaymentStatus,
    getPaymentHistory,
} from '@/services/payment.service';
import {
    createHouseholdComplaint,
    getComplaintsForUnit,
} from '@/services/complaint.service';
import prisma from '@/lib/db/prisma';
import { generateTokenPair } from '@/lib/auth/jwt';
import { UserRole } from '@/types';

// ============================================
// VALIDATION SCHEMAS
// ============================================

// Registration Schema
const registrationSchema = z.object({
    unitNumber: z.string().min(1, "Unit Number is required"),
    householdPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number"),
    residentName: z.string().optional(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
});


const paymentClaimSchema = z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
    proofUrl: z.string().url().optional(),
    transactionRef: z.string().optional(),
});

// Complaint schema
const complaintSchema = z.object({
    complaintType: z.enum(['GARBAGE_NOT_COLLECTED', 'SERVICE_ISSUE', 'OTHER']),
    description: z.string().optional(),
    imageUrl: z.string().url().optional(),
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
// HOUSEHOLD REGISTER
// ============================================

/**
 * POST /api/household/register
 * Register new household with location
 */
export async function registerHouseholdHandler(request: NextRequest) {
    try {
        const body = await request.json();
        const validation = registrationSchema.safeParse(body);

        if (!validation.success) {
            return errorResponse(
                validation.error.issues[0].message,
                'VALIDATION_ERROR',
                400
            );
        }

        const { unitNumber, householdPhone, residentName, latitude, longitude } = validation.data;

        // Call Service
        const { unit, qrToken } = await registerUnitWithLocation({
            unitNumber,
            householdPhone,
            residentName,
            latitude,
            longitude
        });

        // Generate Auth Tokens immediately
        const tokens = generateTokenPair(unit.id, UserRole.HOUSEHOLD, householdPhone);

        return successResponse({
            message: 'Registration successful',
            tokens,
            unit: {
                id: unit.id,
                unitNumber: unit.unitNumber,
                qrToken: qrToken // Only time we show token directly to user? Or just for display?
            }
        }, 201);

    } catch (error) {
        console.error('Registration error:', error);
        if (error instanceof Error && error.name === 'UnitError') {
            return errorResponse(error.message, 'REGISTRATION_ERROR', 400);
        }
        return errorResponse('Failed to register', 'SERVER_ERROR', 500);
    }
}

// ============================================
// GET QR CODE
// ============================================

/**
 * GET /api/household/qr
 * Get QR Token for display
 */
export const getQRHandler = withHouseholdAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const unit = await prisma.unit.findUnique({
                where: { id: user.userId },
                include: { qr: true }
            });

            if (!unit || !unit.qr) {
                return errorResponse('QR Code not found for this unit', 'NOT_FOUND', 404);
            }

            return successResponse({
                secureToken: unit.qr.secureToken,
                status: unit.qr.status
            });
        } catch (error) {
            console.error('Get QR error:', error);
            return errorResponse('Failed to fetch QR', 'SERVER_ERROR', 500);
        }
    }
);

// ============================================
// HOUSEHOLD PROFILE / DASHBOARD
// ============================================

/**
 * GET /api/household/profile
 * Get household unit profile and dashboard info
 */
export const getProfileHandler = withHouseholdAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            // user.userId is the unit ID for household users
            const unit = await prisma.unit.findUnique({
                where: { id: user.userId },
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
            });

            if (!unit) {
                return errorResponse('Unit not found', 'NOT_FOUND', 404);
            }

            // Get current payment status
            const paymentStatus = await getCurrentPaymentStatus(unit.id);

            return successResponse({
                unit: {
                    id: unit.id,
                    unitNumber: unit.unitNumber,
                    ward: unit.ward,
                },
                collector: unit.collector ? {
                    name: unit.collector.name,
                } : null,
                lastCollection: unit.collections[0]?.collectedAt || null,
                payment: paymentStatus,
            });
        } catch (error) {
            console.error('Get household profile error:', error);
            return errorResponse('Failed to get profile', 'SERVER_ERROR', 500);
        }
    }
);

// ============================================
// COLLECTION HISTORY
// ============================================

/**
 * GET /api/household/history
 * Get garbage collection history
 */
export const getHistoryHandler = withHouseholdAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const { searchParams } = new URL(request.url);
            const days = parseInt(searchParams.get('days') || '30', 10);

            const history = await getCollectionHistory(user.userId, days);

            return successResponse({ history });
        } catch (error) {
            console.error('Get history error:', error);
            return errorResponse('Failed to get history', 'SERVER_ERROR', 500);
        }
    }
);

// ============================================
// PAYMENT
// ============================================

/**
 * GET /api/household/payment/status
 * Get current payment status
 */
export const getPaymentStatusHandler = withHouseholdAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const status = await getCurrentPaymentStatus(user.userId);
            return successResponse(status);
        } catch (error) {
            console.error('Get payment status error:', error);
            return errorResponse('Failed to get payment status', 'SERVER_ERROR', 500);
        }
    }
);

/**
 * GET /api/household/payment/history
 * Get payment history
 */
export const getPaymentHistoryHandler = withHouseholdAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const { searchParams } = new URL(request.url);
            const limit = parseInt(searchParams.get('limit') || '12', 10);

            const history = await getPaymentHistory(user.userId, limit);

            return successResponse({ payments: history });
        } catch (error) {
            console.error('Get payment history error:', error);
            return errorResponse('Failed to get payment history', 'SERVER_ERROR', 500);
        }
    }
);

/**
 * GET /api/household/payment/upi
 * Get UPI details for payment
 * Returns the collector's UPI ID for this household
 */
export const getUPIDetailsHandler = withHouseholdAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const unit = await prisma.unit.findUnique({
                where: { id: user.userId },
                include: {
                    collector: {
                        select: {
                            name: true,
                            upiId: true,
                        },
                    },
                },
            });

            if (!unit) {
                return errorResponse('Unit not found', 'NOT_FOUND', 404);
            }

            if (!unit.collector) {
                return errorResponse('No collector assigned', 'NOT_FOUND', 404);
            }

            const paymentStatus = await getCurrentPaymentStatus(user.userId);

            return successResponse({
                collectorName: unit.collector.name,
                upiId: unit.collector.upiId,
                amount: paymentStatus.amount,
                month: paymentStatus.month,
            });
        } catch (error) {
            console.error('Get UPI details error:', error);
            return errorResponse('Failed to get UPI details', 'SERVER_ERROR', 500);
        }
    }
);

/**
 * POST /api/household/payment/claim
 * Claim payment made
 */
export const claimPaymentHandler = withHouseholdAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const body = await request.json();
            const validation = paymentClaimSchema.safeParse(body);

            if (!validation.success) {
                return errorResponse(
                    validation.error.issues[0].message,
                    'VALIDATION_ERROR',
                    400
                );
            }

            const { month, proofUrl, transactionRef } = validation.data;

            // Require at least proof or transaction reference
            if (!proofUrl && !transactionRef) {
                return errorResponse(
                    'Please provide payment proof or transaction reference',
                    'VALIDATION_ERROR',
                    400
                );
            }

            const payment = await claimPayment(user.userId, {
                month,
                proofUrl,
                transactionRef,
            });

            return successResponse({
                message: 'Payment claimed successfully. Awaiting collector verification.',
                payment: {
                    id: payment.id,
                    status: payment.status,
                    month: payment.month,
                },
            }, 201);
        } catch (error) {
            console.error('Claim payment error:', error);

            if (error instanceof Error) {
                if (error.name.includes('Payment')) {
                    return errorResponse(error.message, 'PAYMENT_ERROR', 400);
                }
            }

            return errorResponse('Failed to claim payment', 'SERVER_ERROR', 500);
        }
    }
);

// ============================================
// COMPLAINTS
// ============================================

/**
 * GET /api/household/complaints
 * Get complaint history for this unit
 */
export const getComplaintsHandler = withHouseholdAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const complaints = await getComplaintsForUnit(user.userId);

            return successResponse({
                complaints: complaints.map((c: any) => ({
                    id: c.id,
                    type: c.complaintType,
                    status: c.status,
                    description: c.description,
                    createdAt: c.createdAt,
                    resolvedAt: c.resolvedAt,
                    resolutionNotes: c.resolutionNotes,
                })),
            });
        } catch (error) {
            console.error('Get complaints error:', error);
            return errorResponse('Failed to get complaints', 'SERVER_ERROR', 500);
        }
    }
);

/**
 * POST /api/household/complaint/create
 * Create a new complaint
 */
export const createComplaintHandler = withHouseholdAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const body = await request.json();
            const validation = complaintSchema.safeParse(body);

            if (!validation.success) {
                return errorResponse(
                    validation.error.issues[0].message,
                    'VALIDATION_ERROR',
                    400
                );
            }

            const { complaintType, description, imageUrl } = validation.data;

            const complaint = await createHouseholdComplaint(user.userId, {
                complaintType: complaintType as any,
                description,
                imageUrl,
            });

            return successResponse({
                message: 'Complaint submitted successfully',
                complaint: {
                    id: complaint.id,
                    status: complaint.status,
                },
            }, 201);
        } catch (error) {
            console.error('Create complaint error:', error);

            if (error instanceof Error) {
                if (error.name.includes('Complaint')) {
                    return errorResponse(error.message, 'COMPLAINT_ERROR', 400);
                }
            }

            return errorResponse('Failed to create complaint', 'SERVER_ERROR', 500);
        }
    }
);

/**
 * GET /api/household/dashboard
 * Get full dashboard data
 */
export const getDashboardHandler = withHouseholdAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            // 1. Get Unit info (with Collector)
            const unit = await prisma.unit.findUnique({
                where: { id: user.userId },
                include: {
                    collector: {
                        select: { id: true, name: true, phone: true },
                    },
                },
            });

            if (!unit) return errorResponse('Unit not found', 'NOT_FOUND', 404);

            // 2. Get Payment Status
            const currentPayment = await getCurrentPaymentStatus(unit.id);

            // 3. Get Collection History (last 7 days for dashboard)
            const recentCollections = await getCollectionHistory(unit.id, 7);

            // 4. Construct Response (matching Frontend expectations)
            return successResponse({
                unit: {
                    id: unit.id,
                    unitNo: unit.unitNumber,
                    ward: unit.ward,
                },
                collector: unit.collector ? {
                    id: unit.collector.id,
                    name: unit.collector.name,
                    mobile: unit.collector.phone,
                } : null,
                currentPayment: {
                    month: currentPayment.month,
                    amount: currentPayment.amount,
                    status: currentPayment.status,
                },
                recentCollections: recentCollections.map((c: any) => ({
                    id: c.date.toISOString(),
                    date: c.date,
                    status: c.status,
                })),
            });
        } catch (error) {
            console.error('Get dashboard error:', error);
            return errorResponse('Failed to get dashboard', 'SERVER_ERROR', 500);
        }
    }
);
