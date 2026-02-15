import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { getDisputedPayments } from '@/services/payment.service';

/**
 * GET /api/admin/payments/disputes
 * Get all disputed payments for supervisor review
 */
export async function GET(request: NextRequest) {
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

        // Get query parameters
        const { searchParams } = new URL(request.url);
        const ward = searchParams.get('ward') || undefined;

        // Get disputed payments
        const disputes = await getDisputedPayments(ward);

        return NextResponse.json({
            success: true,
            data: disputes,
        });
    } catch (error: any) {
        console.error('Get disputes error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch disputed payments' },
            { status: 500 }
        );
    }
}
