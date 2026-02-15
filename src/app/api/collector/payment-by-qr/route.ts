import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import prisma from '@/lib/db/prisma';

/**
 * GET /api/collector/payment-by-qr?qrToken=xxx
 * Get payment details for a house by scanning QR code
 * 
 * This endpoint is called after QR scan to check if there's a pending payment
 */
export async function GET(request: NextRequest) {
    try {
        // Authenticate collector
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { success: false, error: { message: 'Authorization required' } },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7);
        const decoded = await verifyToken(token);

        if (!decoded || decoded.role !== 'COLLECTOR') {
            return NextResponse.json(
                { success: false, error: { message: 'Collector access required' } },
                { status: 403 }
            );
        }

        // Get QR token from query
        const { searchParams } = new URL(request.url);
        const qrToken = searchParams.get('qrToken');

        if (!qrToken) {
            return NextResponse.json(
                { success: false, error: { message: 'QR token is required' } },
                { status: 400 }
            );
        }

        // Validate QR code
        const qr = await prisma.qrCode.findUnique({
            where: { secureToken: qrToken },
            include: {
                unit: {
                    select: {
                        id: true,
                        unitNumber: true,
                        residentName: true,
                        collectorId: true,
                    },
                },
            },
        });

        if (!qr) {
            return NextResponse.json(
                { success: false, error: { message: 'Invalid QR code' } },
                { status: 404 }
            );
        }

        if (qr.status !== 'ACTIVE') {
            return NextResponse.json(
                { success: false, error: { message: 'QR code is not active' } },
                { status: 400 }
            );
        }

        // Check if collector is assigned to this house
        if (qr.unit.collectorId !== decoded.userId) {
            return NextResponse.json(
                { success: false, error: { message: 'You are not assigned to this house' } },
                { status: 403 }
            );
        }

        // Get current month payment
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        const payment = await prisma.payment.findUnique({
            where: {
                unitId_month: {
                    unitId: qr.unit.id,
                    month: currentMonth,
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: {
                houseDetails: {
                    unitNumber: qr.unit.unitNumber,
                    residentName: qr.unit.residentName,
                },
                payment: payment ? {
                    id: payment.id,
                    month: payment.month,
                    amount: Number(payment.amount),
                    status: payment.status,
                    proofUrl: payment.proofUrl,
                    transactionRef: payment.transactionRef,
                } : null,
                hasPendingPayment: payment?.status === 'CLAIMED',
            },
        });
    } catch (error: any) {
        console.error('Get payment by QR error:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    message: error.message || 'Failed to get payment details',
                    code: 'SERVER_ERROR'
                }
            },
            { status: 500 }
        );
    }
}
