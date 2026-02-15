import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { verifyToken } from '@/lib/auth/jwt';

// GET /api/collector/stats - Get collector statistics
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { success: false, message: 'Authorization required' },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7);
        const decoded = await verifyToken(token);

        if (!decoded || decoded.role !== 'COLLECTOR') {
            return NextResponse.json(
                { success: false, message: 'Collector access required' },
                { status: 403 }
            );
        }

        const collectorId = parseInt(decoded.sub);

        // Get today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get this week's date range
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());

        // Get this month's date range
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

        // Today's collections
        const todayCollections = await prisma.collection.count({
            where: {
                collectorId,
                collectedAt: {
                    gte: today,
                    lt: tomorrow,
                },
            },
        });

        // This week's collections
        const weekCollections = await prisma.collection.count({
            where: {
                collectorId,
                collectedAt: {
                    gte: weekStart,
                },
            },
        });

        // This month's collections
        const monthCollections = await prisma.collection.count({
            where: {
                collectorId,
                collectedAt: {
                    gte: monthStart,
                },
            },
        });

        // Total houses assigned
        const totalHouses = await prisma.unit.count({
            where: { collectorId },
        });

        // Calculate actual earnings from verified payments this month
        const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const monthlyEarnings = await prisma.payment.aggregate({
            where: {
                verifiedById: collectorId,
                month: currentMonth,
                status: 'VERIFIED'
            },
            _sum: {
                amount: true
            }
        });
        const earnings = Number(monthlyEarnings._sum.amount || 0);

        // Average per day (this month)
        const daysInMonth = today.getDate();
        const avgPerDay = daysInMonth > 0 ? parseFloat((monthCollections / daysInMonth).toFixed(1)) : 0;

        // Weekly breakdown (last 7 days)
        const weeklyBreakdown = [];
        for (let i = 6; i >= 0; i--) {
            const day = new Date(today);
            day.setDate(today.getDate() - i);
            const dayStart = new Date(day);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(day);
            dayEnd.setHours(23, 59, 59, 999);

            const count = await prisma.collection.count({
                where: {
                    collectorId,
                    collectedAt: {
                        gte: dayStart,
                        lte: dayEnd,
                    },
                },
            });

            weeklyBreakdown.push({
                day: day.toLocaleDateString('en-US', { weekday: 'short' }),
                count,
            });
        }

        return NextResponse.json({
            success: true,
            data: {
                today: todayCollections,
                thisWeek: weekCollections,
                thisMonth: monthCollections,
                totalHouses,
                earnings,
                avgPerDay,
                weeklyBreakdown,
            },
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to fetch stats' },
            { status: 500 }
        );
    }
}
