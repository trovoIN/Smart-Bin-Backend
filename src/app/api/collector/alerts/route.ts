import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { verifyToken } from '@/lib/auth/jwt';

// GET /api/collector/alerts - Get collector alerts/notifications
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

        // Get recent complaints assigned to this collector
        const complaints = await prisma.complaint.findMany({
            where: {
                collectorId,
                status: {
                    in: ['OPEN', 'IN_PROGRESS'],
                },
            },
            include: {
                unit: {
                    select: {
                        unitNumber: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });

        // Get pending payments
        const currentMonth = new Date().toISOString().slice(0, 7);
        const pendingPayments = await prisma.payment.findMany({
            where: {
                unit: {
                    collectorId,
                },
                status: 'PENDING',
                month: currentMonth,
            },
            include: {
                unit: {
                    select: {
                        unitNumber: true,
                    },
                },
            },
            take: 5,
        });

        // Get recently assigned houses (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const newHouses = await prisma.unit.findMany({
            where: {
                collectorId,
                updatedAt: {
                    gte: sevenDaysAgo,
                },
            },
            orderBy: { updatedAt: 'desc' },
            take: 5,
        });

        // Format alerts
        const alerts = [];

        // Add complaint alerts
        complaints.forEach(c => {
            alerts.push({
                id: `complaint-${c.id}`,
                type: c.complaintType === 'MISSED_COLLECTION' ? 'urgent' : 'warning',
                title: c.complaintType.replace(/_/g, ' '),
                message: `Unit ${c.unit?.unitNumber} - ${c.description}`,
                time: getRelativeTime(c.createdAt),
                createdAt: c.createdAt,
            });
        });

        // Add payment alerts
        pendingPayments.forEach(p => {
            alerts.push({
                id: `payment-${p.id}`,
                type: 'info',
                title: 'Payment Pending',
                message: `Unit ${p.unit?.unitNumber} - ₹${p.amount} for ${p.month}`,
                time: getRelativeTime(p.createdAt),
                createdAt: p.createdAt,
            });
        });

        // Add new house alerts
        newHouses.forEach(h => {
            alerts.push({
                id: `house-${h.id}`,
                type: 'success',
                title: 'New House Assigned',
                message: `Unit ${h.unitNumber} has been assigned to you`,
                time: getRelativeTime(h.updatedAt),
                createdAt: h.updatedAt,
            });
        });

        // Sort by most recent
        alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json({
            success: true,
            data: alerts.slice(0, 20), // Return max 20 alerts
        });
    } catch (error) {
        console.error('Error fetching alerts:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to fetch alerts' },
            { status: 500 }
        );
    }
}

function getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
}
