// ============================================
// Smart Bin - Payment Service
// ============================================
// This service handles payment operations:
// - Payment claim by household
// - Payment verification by collector
// - Dispute handling
// - Payment history
//
// PAYMENT WORKFLOW:
// UNPAID -> CLAIMED -> VERIFIED
//                   -> DISPUTED -> VERIFIED/UNPAID (supervisor)
//
// KEY RULES:
// - Payment never auto-verified
// - Collector must confirm receipt
// - Disputes are resolved by supervisor
// ============================================

import prisma from '@/lib/db/prisma';
import {
    Payment,
    PaymentStatus,
    PaymentClaimInput,
    PaymentVerifyInput,
    PaymentWithUnit,
} from '@/types';

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_MONTHLY_FEE = parseInt(
    process.env.DEFAULT_MONTHLY_FEE || '100',
    10
);

// ============================================
// PAYMENT CLAIM (HOUSEHOLD)
// ============================================

/**
 * Claim payment made by household
 * 
 * Flow:
 * 1. Household pays via UPI (outside system)
 * 2. Household clicks "I Have Paid"
 * 3. Optionally uploads proof/reference
 * 4. Status becomes CLAIMED
 * 5. Collector will verify
 * 
 * @param unitId - Unit ID making the claim
 * @param input - Payment claim details
 * @returns Updated payment record
 */
export async function claimPayment(
    unitId: number,
    input: Omit<PaymentClaimInput, 'unitId'>
): Promise<Payment> {
    const { month, proofUrl, transactionRef } = input;

    // Check if payment exists for this month
    let payment = await prisma.payment.findUnique({
        where: {
            unitId_month: {
                unitId,
                month,
            },
        },
    });

    // Create payment if doesn't exist
    if (!payment) {
        payment = await prisma.payment.create({
            data: {
                unitId,
                month,
                amount: DEFAULT_MONTHLY_FEE,
                status: 'CLAIMED',
                proofUrl,
                transactionRef,
                claimedAt: new Date(),
            },
        });
    } else {
        // Update existing payment
        if (payment.status === 'VERIFIED') {
            throw new PaymentError('Payment already verified');
        }

        payment = await prisma.payment.update({
            where: { id: payment.id },
            data: {
                status: 'CLAIMED',
                proofUrl: proofUrl || payment.proofUrl,
                transactionRef: transactionRef || payment.transactionRef,
                claimedAt: new Date(),
                rejectionReason: null, // Clear any previous rejection
            },
        });
    }

    // Log for audit
    await prisma.auditLog.create({
        data: {
            action: 'PAYMENT_CLAIMED',
            entityType: 'Payment',
            entityId: payment.id,
            metadata: {
                unitId,
                month,
                hasProof: !!proofUrl,
                hasTransactionRef: !!transactionRef,
            },
        },
    });

    return payment as unknown as Payment;
}

// ============================================
// PAYMENT VERIFICATION (COLLECTOR)
// ============================================

/**
 * Verify or reject a payment claim
 * 
 * Called by collector after checking their UPI app
 * 
 * @param collectorId - Collector performing verification
 * @param input - Verification details
 * @returns Updated payment
 */
export async function verifyPayment(
    collectorId: number,
    input: PaymentVerifyInput
): Promise<Payment> {
    const { paymentId, action, rejectionReason } = input;

    // Get payment with unit details
    const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
            unit: {
                select: { collectorId: true },
            },
        },
    });

    if (!payment) {
        throw new PaymentError('Payment not found');
    }

    // Verify collector is assigned to this unit
    if (payment.unit.collectorId !== collectorId) {
        throw new PaymentError('You are not authorized to verify this payment');
    }

    // Check payment is in correct status
    if (payment.status !== 'CLAIMED') {
        throw new PaymentError(
            `Cannot verify payment with status: ${payment.status}`
        );
    }

    // Handle verification
    if (action === 'CONFIRM') {
        const updated = await prisma.payment.update({
            where: { id: paymentId },
            data: {
                status: 'VERIFIED',
                verifiedAt: new Date(),
                verifiedById: collectorId,
            },
        });

        await logPaymentAction('PAYMENT_VERIFIED', paymentId, collectorId);

        return updated as unknown as Payment;
    }

    // Handle rejection
    if (action === 'REJECT') {
        if (!rejectionReason) {
            throw new PaymentError('Rejection reason is required');
        }

        const updated = await prisma.payment.update({
            where: { id: paymentId },
            data: {
                status: 'DISPUTED',
                disputedAt: new Date(),
                rejectionReason,
                verifiedById: collectorId,
            },
        });

        await logPaymentAction('PAYMENT_DISPUTED', paymentId, collectorId, {
            rejectionReason,
        });

        return updated as unknown as Payment;
    }

    throw new PaymentError('Invalid action');
}

// ============================================
// DISPUTE RESOLUTION (SUPERVISOR)
// ============================================

/**
 * Resolve a payment dispute
 * Called by supervisor after reviewing evidence
 * 
 * @param supervisorId - Supervisor resolving
 * @param paymentId - Payment ID
 * @param decision - 'approve' or 'reject'
 * @param notes - Resolution notes
 */
export async function resolveDispute(
    supervisorId: number,
    paymentId: number,
    decision: 'approve' | 'reject',
    notes?: string
): Promise<Payment> {
    const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
    });

    if (!payment) {
        throw new PaymentError('Payment not found');
    }

    if (payment.status !== 'DISPUTED') {
        throw new PaymentError('Payment is not in disputed status');
    }

    const newStatus = decision === 'approve' ? 'VERIFIED' : 'UNPAID';

    const updated = await prisma.payment.update({
        where: { id: paymentId },
        data: {
            status: newStatus,
            resolvedAt: new Date(),
            ...(decision === 'approve' && { verifiedAt: new Date() }),
        },
    });

    await logPaymentAction('DISPUTE_RESOLVED', paymentId, supervisorId, {
        decision,
        notes,
    });

    return updated as unknown as Payment;
}

// ============================================
// PAYMENT QUERIES
// ============================================

/**
 * Get current month's payment status for a unit
 */
export async function getCurrentPaymentStatus(
    unitId: number
): Promise<{
    month: string;
    status: PaymentStatus;
    amount: number;
    dueDate: Date;
}> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const payment = await prisma.payment.findUnique({
        where: {
            unitId_month: {
                unitId,
                month,
            },
        },
    });

    // Calculate due date (5th of month)
    const dueDate = new Date(now.getFullYear(), now.getMonth(), 5);
    if (dueDate < now) {
        dueDate.setMonth(dueDate.getMonth() + 1);
    }

    return {
        month,
        status: (payment?.status as PaymentStatus) || 'UNPAID',
        amount: Number(payment?.amount) || DEFAULT_MONTHLY_FEE,
        dueDate,
    };
}

/**
 * Get payment history for a unit
 */
export async function getPaymentHistory(
    unitId: number,
    limit: number = 12
): Promise<Payment[]> {
    const payments = await prisma.payment.findMany({
        where: { unitId },
        orderBy: { month: 'desc' },
        take: limit,
    });

    return payments as unknown as Payment[];
}

/**
 * Get pending payments (UNPAID or CLAIMED) for a collector's units
 */
export async function getPendingPayments(
    collectorId: number
): Promise<PaymentWithUnit[]> {
    const payments = await prisma.payment.findMany({
        where: {
            unit: {
                collectorId,
            },
            status: {
                in: ['UNPAID', 'CLAIMED'],
            },
        },
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
    });

    return payments as unknown as PaymentWithUnit[];
}

/**
 * Get payment claims requiring verification
 */
export async function getPaymentClaimsForVerification(
    collectorId: number
): Promise<PaymentWithUnit[]> {
    const payments = await prisma.payment.findMany({
        where: {
            unit: {
                collectorId,
            },
            status: 'CLAIMED',
        },
        include: {
            unit: {
                select: {
                    id: true,
                    unitNumber: true,
                    ward: true,
                },
            },
        },
        orderBy: { claimedAt: 'desc' },
    });

    return payments as unknown as PaymentWithUnit[];
}

/**
 * Get disputed payments for supervisor
 */
export async function getDisputedPayments(
    ward?: string
): Promise<PaymentWithUnit[]> {
    const whereClause: Record<string, unknown> = {
        status: 'DISPUTED',
    };

    if (ward) {
        whereClause.unit = { ward };
    }

    const payments = await prisma.payment.findMany({
        where: whereClause,
        include: {
            unit: {
                select: {
                    id: true,
                    unitNumber: true,
                    ward: true,
                },
            },
        },
        orderBy: { disputedAt: 'asc' },
    });

    return payments as unknown as PaymentWithUnit[];
}

/**
 * Get defaulters (units with unpaid payments)
 */
export async function getDefaulters(
    monthsUnpaid: number = 1,
    ward?: string
): Promise<Array<{
    unitId: number;
    unitNumber: string;
    collectorName: string;
    monthsUnpaid: number;
    totalDue: number;
}>> {
    const now = new Date();
    const startMonth = new Date(now);
    startMonth.setMonth(startMonth.getMonth() - monthsUnpaid);
    const startMonthStr = `${startMonth.getFullYear()}-${String(startMonth.getMonth() + 1).padStart(2, '0')}`;

    const whereClause = ward ? { ward } : {};

    // Get all units
    const units = await prisma.unit.findMany({
        where: whereClause,
        include: {
            collector: {
                select: { name: true },
            },
            payments: {
                where: {
                    status: 'UNPAID',
                    month: { gte: startMonthStr },
                },
            },
        },
    });

    // Filter to those with unpaid payments
    const defaulters = units
        .filter((unit) => unit.payments.length >= monthsUnpaid)
        .map((unit) => ({
            unitId: unit.id,
            unitNumber: unit.unitNumber,
            collectorName: unit.collector?.name || 'N/A',
            monthsUnpaid: unit.payments.length,
            totalDue: unit.payments.reduce((sum, p) => sum + Number(p.amount), 0),
        }));

    return defaulters;
}

// ============================================
// PAYMENT STATISTICS
// ============================================

/**
 * Get payment statistics for dashboard
 */
export async function getPaymentStats(
    ward?: string,
    month?: string
): Promise<{
    total: number;
    paid: number;
    unpaid: number;
    claimed: number;
    disputed: number;
    collectionRate: number;
}> {
    const currentMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const whereClause: Record<string, unknown> = {
        month: currentMonth,
    };

    if (ward) {
        whereClause.unit = { ward };
    }

    const payments = await prisma.payment.groupBy({
        by: ['status'],
        where: whereClause,
        _count: true,
    });

    const total = await prisma.unit.count({
        where: ward ? { ward } : {},
    });

    const stats = {
        paid: 0,
        unpaid: 0,
        claimed: 0,
        disputed: 0,
    };

    for (const p of payments) {
        if (p.status === 'VERIFIED') stats.paid = p._count;
        else if (p.status === 'UNPAID') stats.unpaid = p._count;
        else if (p.status === 'CLAIMED') stats.claimed = p._count;
        else if (p.status === 'DISPUTED') stats.disputed = p._count;
    }

    // Units without any payment record are unpaid
    const unitsWithPayment = stats.paid + stats.unpaid + stats.claimed + stats.disputed;
    stats.unpaid += total - unitsWithPayment;

    return {
        total,
        ...stats,
        collectionRate: total > 0 ? Math.round((stats.paid / total) * 100) : 0,
    };
}

// ============================================
// CREATE MONTHLY PAYMENTS
// ============================================

/**
 * Create payment records for a new month
 * Run this at the start of each month (cron job)
 */
export async function createMonthlyPayments(): Promise<number> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get all active units
    const units = await prisma.unit.findMany({
        select: { id: true },
    });

    let created = 0;

    for (const unit of units) {
        // Check if payment already exists
        const existing = await prisma.payment.findUnique({
            where: {
                unitId_month: {
                    unitId: unit.id,
                    month,
                },
            },
        });

        if (!existing) {
            await prisma.payment.create({
                data: {
                    unitId: unit.id,
                    month,
                    amount: DEFAULT_MONTHLY_FEE,
                    status: 'UNPAID',
                },
            });
            created++;
        }
    }

    console.log(`Created ${created} payment records for ${month}`);
    return created;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function logPaymentAction(
    action: string,
    paymentId: number,
    userId?: number,
    metadata?: Record<string, unknown>
): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                action,
                entityType: 'Payment',
                entityId: paymentId,
                userId,
                metadata: metadata as any,
            },
        });
    } catch (error) {
        console.error('Failed to log payment action:', error);
    }
}

// ============================================
// CUSTOM ERROR CLASSES
// ============================================

export class PaymentError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PaymentError';
    }
}

export class PaymentAlreadyVerifiedError extends PaymentError {
    constructor() {
        super('Payment already verified');
        this.name = 'PaymentAlreadyVerifiedError';
    }
}
