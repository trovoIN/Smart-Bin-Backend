import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { withCollectorAuth, AuthContext } from '@/middleware/auth.middleware';

// GET /api/collector/payments/history
// Get payment history for the authenticated collector
export const GET = withCollectorAuth(
    async (request: NextRequest, { user }: { user: AuthContext }) => {
        try {
            const { searchParams } = new URL(request.url);
            const year = searchParams.get('year') || new Date().getFullYear().toString();

            const collectorId = user.userId;

            // Get all payments for houses assigned to this collector for the specified year
            // Limit to 100 payments for performance
            const payments = await prisma.payment.findMany({
                where: {
                    unit: {
                        collectorId,
                    },
                    month: {
                        startsWith: year,
                    },
                },
                include: {
                    unit: {
                        select: {
                            id: true,
                            unitNumber: true,
                            residentName: true,
                            ward: true,
                        },
                    },
                },
                orderBy: {
                    month: 'desc',
                },
                take: 100, // Limit results for performance
            });

            // Map unit to household for frontend compatibility
            const formattedPayments = payments.map((payment: any) => ({
                ...payment,
                household: payment.unit,
            }));

            return NextResponse.json({
                success: true,
                data: formattedPayments,
            });
        } catch (error) {
            console.error('Get payment history error:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to get payment history' },
                { status: 500 }
            );
        }
    }
);
