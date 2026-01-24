// ============================================
// Smart Bin - Dashboard API Route Handlers
// ============================================
// These handlers serve the Admin/Supervisor Dashboard
// Role-based access control applied per endpoint
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
    withAuth,
    withAdminAuth,
    withSupervisorAuth,
    AuthContext,
    requireRoles,
} from '@/middleware/auth.middleware';
import { UserRole } from '@/types';
import prisma from '@/lib/db/prisma';
import {
    getTodayCollectionStats,
    getMissedCollections,
} from '@/services/collection.service';
import {
    getPaymentStats,
    getDisputedPayments,
    getDefaulters,
    resolveDispute,
} from '@/services/payment.service';
import {
    getComplaints,
    getComplaintStats,
    resolveComplaint,
    updateComplaintStatus,
} from '@/services/complaint.service';
import {
    generateBulkQRCodes,
    getQRStatistics,
    listQRCodes,
    deactivateQRCode,
} from '@/services/qr.service';
import { createCollector, createUser } from '@/services/auth.service';
import {
    getActiveCollectors,
    updateCollectorStatus,
    bulkReassignUnits,
} from '@/services/unit.service';

// ============================================
// VALIDATION SCHEMAS
// ============================================

// Collector create schema
const collectorCreateSchema = z.object({
    name: z.string().min(2, 'Name too short'),
    phone: z.string().min(10).max(15),
    upiId: z.string().min(5, 'Invalid UPI ID'),
    assignedRoute: z.string().optional(),
});

// User create schema
const userCreateSchema = z.object({
    name: z.string().min(2),
    phone: z.string().min(10).max(15),
    email: z.string().email().optional(),
    role: z.enum(['ADMIN', 'SUPERVISOR', 'CONTRACTOR', 'GOVT']),
    assignedWard: z.string().optional(),
    password: z.string().min(6).optional(),
});

// QR generate schema
const qrGenerateSchema = z.object({
    count: z.number().int().min(1).max(1000),
    prefix: z.string().optional(),
});

// Dispute resolve schema
const disputeResolveSchema = z.object({
    paymentId: z.number().int().positive(),
    decision: z.enum(['approve', 'reject']),
    notes: z.string().optional(),
});

// Complaint resolve schema
const complaintResolveSchema = z.object({
    complaintId: z.number().int().positive(),
    action: z.enum(['RESOLVE', 'REJECT']),
    resolutionNotes: z.string().min(1, 'Resolution notes required'),
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
// OVERVIEW / DASHBOARD
// ============================================

/**
 * GET /api/dashboard/overview
 * Get dashboard overview metrics
 * Available to: All dashboard users (filtered by role)
 */
export const getOverviewHandler = withAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const { searchParams } = new URL(request.url);
            const ward = searchParams.get('ward') || undefined;

            // Get collection stats
            const collectionStats = await getTodayCollectionStats(undefined, ward);

            // Get complaint stats
            const complaintStats = await getComplaintStats(ward);

            // Base metrics (available to all)
            const result: Record<string, unknown> = {
                collections: collectionStats,
                complaints: {
                    open: complaintStats.open,
                    inReview: complaintStats.inReview,
                    total: complaintStats.total,
                },
            };

            // Payment stats only for non-GOVT users
            if (user.role !== UserRole.GOVT) {
                const paymentStats = await getPaymentStats(ward);
                result.payments = paymentStats;
            }

            // Active collectors count
            const activeCollectors = await prisma.collector.count({
                where: { status: 'ACTIVE' },
            });
            result.activeCollectors = activeCollectors;

            // Total units
            const totalUnits = await prisma.unit.count(
                ward ? { where: { ward } } : undefined
            );
            result.totalUnits = totalUnits;

            return successResponse(result);
        } catch (error) {
            console.error('Get overview error:', error);
            return errorResponse('Failed to get overview', 'SERVER_ERROR', 500);
        }
    },
    { minimumRole: UserRole.GOVT }
);

// ============================================
// COLLECTION MONITORING
// ============================================

/**
 * GET /api/dashboard/collections
 * Get collection data for monitoring
 */
export const getCollectionsHandler = withAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const { searchParams } = new URL(request.url);
            const ward = searchParams.get('ward') || undefined;
            const date = searchParams.get('date') || undefined;
            const collectorId = searchParams.get('collectorId');

            // Get target date
            const targetDate = date ? new Date(date) : new Date();
            targetDate.setHours(0, 0, 0, 0);
            const nextDate = new Date(targetDate);
            nextDate.setDate(nextDate.getDate() + 1);

            // Build query
            const where: Record<string, unknown> = {
                collectedAt: {
                    gte: targetDate,
                    lt: nextDate,
                },
            };

            if (ward) {
                where.unit = { ward };
            }

            if (collectorId) {
                where.collectorId = parseInt(collectorId, 10);
            }

            const collections = await prisma.collection.findMany({
                where,
                include: {
                    unit: {
                        select: {
                            id: true,
                            unitNumber: true,
                            ward: true,
                        },
                    },
                    collector: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: { collectedAt: 'desc' },
            });

            // Get stats
            const stats = await getTodayCollectionStats(
                collectorId ? parseInt(collectorId, 10) : undefined,
                ward
            );

            return successResponse({
                collections,
                stats,
                date: targetDate.toISOString().split('T')[0],
            });
        } catch (error) {
            console.error('Get collections error:', error);
            return errorResponse('Failed to get collections', 'SERVER_ERROR', 500);
        }
    },
    { minimumRole: UserRole.GOVT }
);

/**
 * GET /api/dashboard/collections/missed
 * Get missed collections
 */
export const getMissedCollectionsHandler = withAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const { searchParams } = new URL(request.url);
            const ward = searchParams.get('ward') || undefined;

            const missed = await getMissedCollections(ward);

            return successResponse({ missed });
        } catch (error) {
            console.error('Get missed collections error:', error);
            return errorResponse('Failed to get missed collections', 'SERVER_ERROR', 500);
        }
    },
    { minimumRole: UserRole.GOVT }
);

// ============================================
// PAYMENT MANAGEMENT
// ============================================

/**
 * GET /api/dashboard/payments
 * Get payment data (not available to GOVT users)
 */
export const getPaymentsHandler = withAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            // GOVT users cannot see payment data
            if (user.role === UserRole.GOVT) {
                return errorResponse('Access denied', 'FORBIDDEN', 403);
            }

            const { searchParams } = new URL(request.url);
            const ward = searchParams.get('ward') || undefined;
            const status = searchParams.get('status') || undefined;
            const month = searchParams.get('month') || undefined;

            const where: Record<string, unknown> = {};
            if (status) where.status = status;
            if (month) where.month = month;
            if (ward) where.unit = { ward };

            const payments = await prisma.payment.findMany({
                where,
                include: {
                    unit: {
                        select: {
                            id: true,
                            unitNumber: true,
                            ward: true,
                        },
                    },
                },
                orderBy: [{ status: 'asc' }, { month: 'desc' }],
                take: 100,
            });

            const stats = await getPaymentStats(ward, month || undefined);

            return successResponse({ payments, stats });
        } catch (error) {
            console.error('Get payments error:', error);
            return errorResponse('Failed to get payments', 'SERVER_ERROR', 500);
        }
    },
    { minimumRole: UserRole.CONTRACTOR }
);

/**
 * GET /api/dashboard/payments/disputed
 * Get disputed payments for resolution
 */
export const getDisputedPaymentsHandler = withSupervisorAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const { searchParams } = new URL(request.url);
            const ward = searchParams.get('ward') || undefined;

            const disputed = await getDisputedPayments(ward);

            return successResponse({ disputed });
        } catch (error) {
            console.error('Get disputed payments error:', error);
            return errorResponse('Failed to get disputed payments', 'SERVER_ERROR', 500);
        }
    }
);

/**
 * POST /api/dashboard/payments/resolve
 * Resolve a dispute (Supervisor+)
 */
export const resolveDisputeHandler = withSupervisorAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const body = await request.json();
            const validation = disputeResolveSchema.safeParse(body);

            if (!validation.success) {
                return errorResponse(
                    validation.error.issues[0].message,
                    'VALIDATION_ERROR',
                    400
                );
            }

            const { paymentId, decision, notes } = validation.data;

            const payment = await resolveDispute(
                user.userId,
                paymentId,
                decision,
                notes
            );

            return successResponse({
                message: 'Dispute resolved successfully',
                payment: {
                    id: payment.id,
                    status: payment.status,
                },
            });
        } catch (error) {
            console.error('Resolve dispute error:', error);

            if (error instanceof Error) {
                if (error.name.includes('Payment')) {
                    return errorResponse(error.message, 'PAYMENT_ERROR', 400);
                }
            }

            return errorResponse('Failed to resolve dispute', 'SERVER_ERROR', 500);
        }
    }
);

/**
 * GET /api/dashboard/payments/defaulters
 * Get defaulter list
 */
export const getDefaultersHandler = withAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            if (user.role === UserRole.GOVT) {
                return errorResponse('Access denied', 'FORBIDDEN', 403);
            }

            const { searchParams } = new URL(request.url);
            const ward = searchParams.get('ward') || undefined;
            const months = parseInt(searchParams.get('months') || '1', 10);

            const defaulters = await getDefaulters(months, ward);

            return successResponse({ defaulters });
        } catch (error) {
            console.error('Get defaulters error:', error);
            return errorResponse('Failed to get defaulters', 'SERVER_ERROR', 500);
        }
    },
    { minimumRole: UserRole.CONTRACTOR }
);

// ============================================
// COMPLAINT MANAGEMENT
// ============================================

/**
 * GET /api/dashboard/complaints
 * Get complaints list with filters
 */
export const getComplaintsHandler = withAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const { searchParams } = new URL(request.url);

            const filters = {
                status: searchParams.get('status') as any || undefined,
                raisedBy: searchParams.get('raisedBy') as any || undefined,
                complaintType: searchParams.get('type') as any || undefined,
                ward: searchParams.get('ward') || undefined,
                page: parseInt(searchParams.get('page') || '1', 10),
                limit: parseInt(searchParams.get('limit') || '20', 10),
            };

            const result = await getComplaints(filters);

            return successResponse(result);
        } catch (error) {
            console.error('Get complaints error:', error);
            return errorResponse('Failed to get complaints', 'SERVER_ERROR', 500);
        }
    },
    { minimumRole: UserRole.GOVT }
);

/**
 * POST /api/dashboard/complaints/resolve
 * Resolve a complaint (Supervisor+)
 */
export const resolveComplaintHandler = withSupervisorAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const body = await request.json();
            const validation = complaintResolveSchema.safeParse(body);

            if (!validation.success) {
                return errorResponse(
                    validation.error.issues[0].message,
                    'VALIDATION_ERROR',
                    400
                );
            }

            const complaint = await resolveComplaint(user.userId, validation.data);

            return successResponse({
                message: 'Complaint resolved successfully',
                complaint: {
                    id: complaint.id,
                    status: complaint.status,
                },
            });
        } catch (error) {
            console.error('Resolve complaint error:', error);
            return errorResponse('Failed to resolve complaint', 'SERVER_ERROR', 500);
        }
    }
);

// ============================================
// COLLECTOR MANAGEMENT
// ============================================

/**
 * GET /api/dashboard/collectors
 * Get all collectors
 */
export const getCollectorsHandler = withAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const collectors = await getActiveCollectors();

            // Hide UPI from GOVT users
            const result = collectors.map((c) => ({
                id: c.id,
                name: c.name,
                phone: c.phone,
                assignedRoute: c.assignedRoute,
                status: c.status,
                unitsAssigned: c._count.units,
                ...(user.role !== UserRole.GOVT && { upiId: c.upiId }),
            }));

            return successResponse({ collectors: result });
        } catch (error) {
            console.error('Get collectors error:', error);
            return errorResponse('Failed to get collectors', 'SERVER_ERROR', 500);
        }
    },
    { minimumRole: UserRole.GOVT }
);

/**
 * POST /api/dashboard/collectors
 * Create a new collector (Admin only)
 */
export const createCollectorHandler = withAdminAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const body = await request.json();
            const validation = collectorCreateSchema.safeParse(body);

            if (!validation.success) {
                return errorResponse(
                    validation.error.issues[0].message,
                    'VALIDATION_ERROR',
                    400
                );
            }

            const collector = await createCollector(validation.data);

            return successResponse({
                message: 'Collector created successfully',
                collector: {
                    id: collector.id,
                    name: collector.name,
                    phone: collector.phone,
                },
            }, 201);
        } catch (error) {
            console.error('Create collector error:', error);

            if (error instanceof Error) {
                if (error.message.includes('already exists')) {
                    return errorResponse(error.message, 'DUPLICATE_ERROR', 400);
                }
            }

            return errorResponse('Failed to create collector', 'SERVER_ERROR', 500);
        }
    }
);

/**
 * PATCH /api/dashboard/collectors/:id/status
 * Update collector status (Admin only)
 */
export const updateCollectorStatusHandler = withAdminAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const body = await request.json();
            const { collectorId, status } = body;

            if (!['ACTIVE', 'INACTIVE'].includes(status)) {
                return errorResponse('Invalid status', 'VALIDATION_ERROR', 400);
            }

            const collector = await updateCollectorStatus(collectorId, status);

            return successResponse({
                message: `Collector ${status === 'ACTIVE' ? 'activated' : 'deactivated'}`,
                collector: {
                    id: collector.id,
                    status: collector.status,
                },
            });
        } catch (error) {
            console.error('Update collector status error:', error);
            return errorResponse('Failed to update collector', 'SERVER_ERROR', 500);
        }
    }
);

// ============================================
// QR MANAGEMENT
// ============================================

/**
 * GET /api/dashboard/qr-codes
 * Get QR codes list
 */
export const getQRCodesHandler = withAdminAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const { searchParams } = new URL(request.url);
            const status = searchParams.get('status') as any || undefined;
            const page = parseInt(searchParams.get('page') || '1', 10);
            const limit = parseInt(searchParams.get('limit') || '50', 10);

            const result = await listQRCodes({ status }, { page, limit });
            const stats = await getQRStatistics();

            return successResponse({ ...result, stats });
        } catch (error) {
            console.error('Get QR codes error:', error);
            return errorResponse('Failed to get QR codes', 'SERVER_ERROR', 500);
        }
    }
);

/**
 * POST /api/dashboard/qr-codes/generate
 * Generate bulk QR codes
 */
export const generateQRCodesHandler = withAdminAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const body = await request.json();
            const validation = qrGenerateSchema.safeParse(body);

            if (!validation.success) {
                return errorResponse(
                    validation.error.issues[0].message,
                    'VALIDATION_ERROR',
                    400
                );
            }

            const { count, prefix } = validation.data;
            const qrCodes = await generateBulkQRCodes(count, prefix);

            return successResponse({
                message: `Generated ${qrCodes.length} QR codes`,
                count: qrCodes.length,
                qrCodes: qrCodes.map((qr) => ({
                    id: qr.id,
                    token: qr.secureToken,
                })),
            }, 201);
        } catch (error) {
            console.error('Generate QR codes error:', error);
            return errorResponse('Failed to generate QR codes', 'SERVER_ERROR', 500);
        }
    }
);

/**
 * POST /api/dashboard/qr-codes/:id/deactivate
 * Deactivate a QR code
 */
export const deactivateQRHandler = withAdminAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const body = await request.json();
            const { qrId, reason } = body;

            const qrCode = await deactivateQRCode(qrId, reason);

            return successResponse({
                message: 'QR code deactivated',
                qrCode: {
                    id: qrCode.id,
                    status: qrCode.status,
                },
            });
        } catch (error) {
            console.error('Deactivate QR error:', error);
            return errorResponse('Failed to deactivate QR', 'SERVER_ERROR', 500);
        }
    }
);

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * GET /api/dashboard/users
 * Get dashboard users (Admin only)
 */
export const getUsersHandler = withAdminAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const users = await prisma.user.findMany({
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    email: true,
                    role: true,
                    assignedWard: true,
                    isActive: true,
                    lastLoginAt: true,
                },
                orderBy: { name: 'asc' },
            });

            return successResponse({ users });
        } catch (error) {
            console.error('Get users error:', error);
            return errorResponse('Failed to get users', 'SERVER_ERROR', 500);
        }
    }
);

/**
 * POST /api/dashboard/users
 * Create a dashboard user (Admin only)
 */
export const createUserHandler = withAdminAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const body = await request.json();
            const validation = userCreateSchema.safeParse(body);

            if (!validation.success) {
                return errorResponse(
                    validation.error.issues[0].message,
                    'VALIDATION_ERROR',
                    400
                );
            }

            const newUser = await createUser({
                ...validation.data,
                role: validation.data.role as UserRole,
            });

            return successResponse({
                message: 'User created successfully',
                user: {
                    id: newUser.id,
                    name: newUser.name,
                    role: newUser.role,
                },
            }, 201);
        } catch (error) {
            console.error('Create user error:', error);

            if (error instanceof Error) {
                if (error.message.includes('already exists')) {
                    return errorResponse(error.message, 'DUPLICATE_ERROR', 400);
                }
            }

            return errorResponse('Failed to create user', 'SERVER_ERROR', 500);
        }
    }
);
