// ============================================
// Smart Bin - Payment Verification Route
// ============================================
// POST /api/collector/payments/verify
// Approve or reject a payment
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import prisma from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { success: false, error: 'Authorization required' },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7);
        const decoded = await verifyToken(token);

        if (!decoded || decoded.role !== 'COLLECTOR') {
            return NextResponse.json(
                { success: false, error: 'Collector access required' },
                { status: 403 }
            );
        }

        const collectorId = parseInt(decoded.sub, 10);
        const body = await request.json();
        const { paymentId, action, rejectionReason } = body;

        if (!paymentId || !action) {
            return NextResponse.json(
                { success: false, error: 'Payment ID and action are required' },
                { status: 400 }
            );
        }

        if (!['CONFIRM', 'REJECT'].includes(action)) {
            return NextResponse.json(
                { success: false, error: 'Invalid action. Must be CONFIRM or REJECT' },
                { status: 400 }
            );
        }

        // Get payment and verify collector assignment
        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            include: {
                unit: {
                    select: {
                        collectorId: true,
                    },
                },
            },
        });

        if (!payment) {
            return NextResponse.json(
                { success: false, error: 'Payment not found' },
                { status: 404 }
            );
        }

        if (payment.unit.collectorId !== collectorId) {
            return NextResponse.json(
                { success: false, error: 'You are not assigned to this household' },
                { status: 403 }
            );
        }

        if (payment.status !== 'CLAIMED') {
            return NextResponse.json(
                { success: false, error: 'Payment is not in CLAIMED status' },
                { status: 400 }
            );
        }

        // Update payment based on action
        const updatedPayment = await prisma.payment.update({
            where: { id: paymentId },
            data: action === 'CONFIRM' ? {
                status: 'VERIFIED',
                verifiedAt: new Date(),
                verifiedById: collectorId,
            } : {
                status: 'DISPUTED',
                disputedAt: new Date(),
                rejectionReason: rejectionReason || 'Payment rejected by collector',
            },
        });

        // Log audit action
        await prisma.auditLog.create({
            data: {
                action: action === 'CONFIRM' ? 'PAYMENT_VERIFIED' : 'PAYMENT_REJECTED',
                userId: collectorId,
                entityType: 'Payment',
                entityId: paymentId,
                metadata: {
                    paymentId,
                    month: payment.month,
                    amount: Number(payment.amount),
                    unitId: payment.unitId,
                    rejectionReason: action === 'REJECT' ? rejectionReason : undefined,
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: {
                id: updatedPayment.id,
                status: updatedPayment.status,
                message: action === 'CONFIRM'
                    ? 'Payment verified successfully'
                    : 'Payment rejected',
            },
        });
    } catch (error: any) {
        console.error('Verify payment error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to verify payment' },
            { status: 500 }
        );
    }
}
