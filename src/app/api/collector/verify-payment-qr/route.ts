import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { verifyPaymentWithQR } from '@/services/payment.service';

/**
 * POST /api/collector/verify-payment-qr
 * Verify payment using QR code scan
 * 
 * This endpoint enforces QR-based verification:
 * - Collector must scan household QR code
 * - Validates collector is assigned to the house
 * - Allows confirm or reject with reason
 */
export async function POST(request: NextRequest) {
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

        // Parse request body
        const body = await request.json();
        const { qrToken, action, rejectionReason } = body;

        // Validate required fields
        if (!qrToken) {
            return NextResponse.json(
                { success: false, error: { message: 'QR token is required' } },
                { status: 400 }
            );
        }

        if (!action || !['CONFIRM', 'REJECT'].includes(action)) {
            return NextResponse.json(
                { success: false, error: { message: 'Valid action is required (CONFIRM or REJECT)' } },
                { status: 400 }
            );
        }

        // Verify payment with QR
        const payment = await verifyPaymentWithQR(
            parseInt(decoded.sub),
            qrToken,
            { paymentId: 0, action, rejectionReason } // paymentId not used in QR flow
        );

        return NextResponse.json({
            success: true,
            data: payment,
            message: action === 'CONFIRM'
                ? 'Payment verified successfully'
                : 'Payment rejected. Household will be notified.',
        });
    } catch (error: any) {
        console.error('Payment verification error:', error);

        return NextResponse.json(
            {
                success: false,
                error: {
                    message: error.message || 'Payment verification failed',
                    code: 'VERIFICATION_ERROR'
                }
            },
            { status: 400 }
        );
    }
}
