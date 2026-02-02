// ============================================
// Smart Bin - Collector API Route Handlers
// ============================================
// These handlers serve the Collector Mobile App (React Native)
// All endpoints require COLLECTOR role authentication
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withCollectorAuth, AuthContext } from '@/middleware/auth.middleware';
import { resolveQRCode } from '@/services/qr.service';
import { registerUnit, getUnitById } from '@/services/unit.service';
import {
    markCollected,
    getCollectorRoute,
    syncOfflineCollections,
    getTodayCollectionStats,
} from '@/services/collection.service';
import {
    verifyPayment,
    getPaymentClaimsForVerification,
} from '@/services/payment.service';
import { createCollectorComplaint } from '@/services/complaint.service';
import { UserRole } from '@/types';
import prisma from '@/lib/db/prisma';

// ============================================
// VALIDATION SCHEMAS
// ============================================

// QR Resolve schema
const qrResolveSchema = z.object({
    qrToken: z.string().min(10, 'Invalid QR token'),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
});

// Unit registration schema
const unitRegisterSchema = z.object({
    qrToken: z.string().min(10, 'Invalid QR token'),
    unitNumber: z.string().optional(),
    householdPhone: z.string().optional(),
});

// Mark collection schema
const markCollectionSchema = z.object({
    unitId: z.number().int().positive(),
    collectedAt: z.string().datetime().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
});

// Payment verification schema
const paymentVerifySchema = z.object({
    paymentId: z.number().int().positive(),
    action: z.enum(['CONFIRM', 'REJECT']),
    rejectionReason: z.string().optional(),
});

// Complaint schema
const complaintSchema = z.object({
    unitId: z.number().int().positive(),
    complaintType: z.enum(['NON_PAYMENT', 'REPEATED_DEFAULTER', 'OTHER']),
    description: z.string().optional(),
    imageUrl: z.string().url().optional(),
});

// Bulk sync schema
const bulkSyncSchema = z.object({
    actions: z.array(z.object({
        type: z.enum(['COLLECTION', 'PAYMENT_VERIFY', 'COMPLAINT']),
        payload: z.any(),
        timestamp: z.string().datetime(),
        localId: z.string().optional(),
    })),
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
// COLLECTOR PROFILE
// ============================================

/**
 * GET /api/collector/profile
 * Get authenticated collector's profile
 */
export const getProfileHandler = withCollectorAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const collector = await prisma.collector.findUnique({
                where: { id: user.userId },
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    upiId: true,
                    assignedRoute: true,
                    status: true,
                    _count: {
                        select: { units: true },
                    },
                },
            });

            if (!collector) {
                return errorResponse('Collector not found', 'NOT_FOUND', 404);
            }

            return successResponse({
                ...collector,
                unitsAssigned: collector._count.units,
            });
        } catch (error) {
            console.error('Get profile error:', error);
            return errorResponse('Failed to get profile', 'SERVER_ERROR', 500);
        }
    }
);

/**
 * PUT /api/collector/profile
 * Update authenticated collector's profile
 */
export const updateProfileHandler = withCollectorAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            // Placeholder: Implement actual update logic here
            // const body = await request.json();
            // ... update logic

            return successResponse({ message: 'Profile update not implemented yet' });
        } catch (error) {
            console.error('Update profile error:', error);
            return errorResponse('Failed to update profile', 'SERVER_ERROR', 500);
        }
    }
);

// ============================================
// QR RESOLUTION
// ============================================

/**
 * POST /api/collector/qr/resolve
 * Resolve a scanned QR code
 * Returns unit details if ACTIVE, or registration prompt if UNASSIGNED
 */
export const qrResolveHandler = withCollectorAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const body = await request.json();
            const validation = qrResolveSchema.safeParse(body);

            if (!validation.success) {
                return errorResponse(
                    validation.error.issues[0].message,
                    'VALIDATION_ERROR',
                    400
                );
            }

            const { qrToken } = validation.data;
            const result = await resolveQRCode(qrToken, UserRole.COLLECTOR);

            return successResponse(result);
        } catch (error) {
            console.error('QR resolve error:', error);

            if (error instanceof Error) {
                if (error.name.includes('QR')) {
                    return errorResponse(error.message, 'QR_ERROR', 400);
                }
            }

            return errorResponse('Failed to resolve QR', 'SERVER_ERROR', 500);
        }
    }
);

// ============================================
// UNIT REGISTRATION
// ============================================

/**
 * POST /api/collector/unit/register
 * Register a new unit Or Assign self to existing unassigned unit
 * Called when Collector scans a QR and chooses "Register" or "Take Up"
 */
export const unitRegisterHandler = withCollectorAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const body = await request.json();

            // Allow simplified schema for "Take Up" (only QR token needed)
            // But validation schema currently requires unitNumber/phone.
            // We should relax it if we want purely "Take Up" flow, or keep it if we want to update details.

            // For now, let's assume we proceed with the current schema
            const validation = unitRegisterSchema.safeParse(body);

            if (!validation.success) {
                return errorResponse(
                    validation.error.issues[0].message,
                    'VALIDATION_ERROR',
                    400
                );
            }

            // We need a Service function that handles:
            // 1. If QR corresponds to existing Unassigned Unit -> Update collectorId (Take Up)
            // 2. If QR is Unassigned -> Create New Unit (Register)

            const unit = await registerUnit(user.userId, {
                qrToken: validation.data.qrToken,
                unitNumber: validation.data.unitNumber || '',
                householdPhone: validation.data.householdPhone || '',
            });

            return successResponse({
                message: 'Unit registered successfully',
                unit: {
                    id: unit.id,
                    unitNumber: unit.unitNumber,
                    householdPhone: unit.householdPhone,
                },
            }, 201);
        } catch (error) {
            console.error('Unit register error:', error);

            if (error instanceof Error) {
                if (error.name.includes('QR') || error.name.includes('Unit')) {
                    return errorResponse(error.message, 'REGISTRATION_ERROR', 400);
                }
            }

            return errorResponse('Failed to register unit', 'SERVER_ERROR', 500);
        }
    }
);

// ============================================
// GARBAGE COLLECTION
// ============================================

/**
 * POST /api/collector/collection/mark
 * Mark garbage as collected for a unit
 */
export const markCollectionHandler = withCollectorAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const body = await request.json();
            const validation = markCollectionSchema.safeParse(body);

            if (!validation.success) {
                return errorResponse(
                    validation.error.issues[0].message,
                    'VALIDATION_ERROR',
                    400
                );
            }

            const { unitId, collectedAt, latitude, longitude } = validation.data;

            const collection = await markCollected(user.userId, {
                unitId,
                collectedAt: collectedAt ? new Date(collectedAt) : undefined,
                latitude,
                longitude,
            });

            return successResponse({
                message: 'Collection marked successfully',
                collection: {
                    id: collection.id,
                    collectedAt: collection.collectedAt,
                },
            }, 201);
        } catch (error) {
            console.error('Mark collection error:', error);

            if (error instanceof Error) {
                if (error.name.includes('Collection')) {
                    return errorResponse(error.message, 'COLLECTION_ERROR', 400);
                }
            }

            return errorResponse('Failed to mark collection', 'SERVER_ERROR', 500);
        }
    }
);

/**
 * GET /api/collector/route
 * Get today's route with collection status for each unit
 */
export const getRouteHandler = withCollectorAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const route = await getCollectorRoute(user.userId);
            return successResponse(route);
        } catch (error) {
            console.error('Get route error:', error);
            return errorResponse('Failed to get route', 'SERVER_ERROR', 500);
        }
    }
);

/**
 * GET /api/collector/stats
 * Get today's collection statistics
 */
export const getStatsHandler = withCollectorAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const stats = await getTodayCollectionStats(user.userId);
            return successResponse(stats);
        } catch (error) {
            console.error('Get stats error:', error);
            return errorResponse('Failed to get stats', 'SERVER_ERROR', 500);
        }
    }
);

// ============================================
// PAYMENT VERIFICATION
// ============================================

/**
 * GET /api/collector/payments/pending
 * Get pending payment claims requiring verification
 */
export const getPendingPaymentsHandler = withCollectorAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const payments = await getPaymentClaimsForVerification(user.userId);
            return successResponse({ payments });
        } catch (error) {
            console.error('Get pending payments error:', error);
            return errorResponse('Failed to get payments', 'SERVER_ERROR', 500);
        }
    }
);

/**
 * POST /api/collector/payment/verify
 * Verify or reject a payment claim
 */
export const verifyPaymentHandler = withCollectorAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const body = await request.json();
            const validation = paymentVerifySchema.safeParse(body);

            if (!validation.success) {
                return errorResponse(
                    validation.error.issues[0].message,
                    'VALIDATION_ERROR',
                    400
                );
            }

            const { paymentId, action, rejectionReason } = validation.data;

            // Validate rejection reason is provided when rejecting
            if (action === 'REJECT' && !rejectionReason) {
                return errorResponse(
                    'Rejection reason is required',
                    'VALIDATION_ERROR',
                    400
                );
            }

            const payment = await verifyPayment(user.userId, {
                paymentId,
                action,
                rejectionReason,
            });

            return successResponse({
                message: action === 'CONFIRM'
                    ? 'Payment verified successfully'
                    : 'Payment rejected',
                payment: {
                    id: payment.id,
                    status: payment.status,
                },
            });
        } catch (error) {
            console.error('Verify payment error:', error);

            if (error instanceof Error) {
                if (error.name.includes('Payment')) {
                    return errorResponse(error.message, 'PAYMENT_ERROR', 400);
                }
            }

            return errorResponse('Failed to verify payment', 'SERVER_ERROR', 500);
        }
    }
);

// ============================================
// COMPLAINTS
// ============================================

/**
 * POST /api/collector/complaint/create
 * Create a complaint against a household
 */
export const createComplaintHandler = withCollectorAuth(
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

            const { unitId, complaintType, description, imageUrl } = validation.data;

            const complaint = await createCollectorComplaint(
                user.userId,
                unitId,
                { complaintType: complaintType as any, description, imageUrl }
            );

            return successResponse({
                message: 'Complaint created successfully',
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

// ============================================
// OFFLINE SYNC
// ============================================

/**
 * POST /api/collector/sync
 * Sync offline actions
 */
export const syncHandler = withCollectorAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const body = await request.json();
            const validation = bulkSyncSchema.safeParse(body);

            if (!validation.success) {
                return errorResponse(
                    validation.error.issues[0].message,
                    'VALIDATION_ERROR',
                    400
                );
            }

            const { actions } = validation.data;

            // Process collections
            const collectionActions = actions
                .filter((a: any) => a.type === 'COLLECTION')
                .map((a: any) => ({
                    ...a.payload,
                    collectedAt: new Date(a.timestamp),
                    localId: a.localId,
                }));

            const syncResult = await syncOfflineCollections(user.userId, collectionActions);

            // TODO: Process other action types (PAYMENT_VERIFY, COMPLAINT)

            return successResponse({
                message: 'Sync completed',
                results: {
                    collections: syncResult,
                    // paymentVerifications: ...
                    // complaints: ...
                },
            });
        } catch (error) {
            console.error('Sync error:', error);
            return errorResponse('Sync failed', 'SERVER_ERROR', 500);
        }
    }
);
