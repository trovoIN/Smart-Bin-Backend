import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { resolveDispute } from '@/services/payment.service';

/**
 * POST /api/admin/payments/resolve
 * Resolve a disputed payment
 * 
 * Body: { paymentId, decision: 'approve' | 'reject', notes }
 */
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

        // Allow ADMIN and SUPERVISOR roles
        const allowedRoles = ['ADMIN', 'SUPERVISOR'];
        if (!decoded || !allowedRoles.includes(decoded.role)) {
            return NextResponse.json(
                { success: false, error: 'Admin or Supervisor access required' },
                { status: 403 }
            );
        }

        // Parse request body
        const body = await request.json();
        const { paymentId, decision, notes } = body;

        // Validate inputs
        if (!paymentId || !decision) {
            return NextResponse.json(
                { success: false, error: 'Payment ID and decision are required' },
                { status: 400 }
            );
        }

        if (!['approve', 'reject'].includes(decision)) {
            return NextResponse.json(
                { success: false, error: 'Decision must be "approve" or "reject"' },
                { status: 400 }
            );
        }

        // Resolve dispute
        const payment = await resolveDispute(
            decoded.userId,
            parseInt(paymentId),
            decision,
            notes
        );

        return NextResponse.json({
            success: true,
            data: payment,
            message: `Dispute ${decision === 'approve' ? 'approved' : 'rejected'} successfully`,
        });
    } catch (error: any) {
        console.error('Resolve dispute error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to resolve dispute' },
            { status: 400 }
        );
    }
}
