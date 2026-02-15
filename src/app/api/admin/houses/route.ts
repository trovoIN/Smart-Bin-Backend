import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { verifyToken } from '@/lib/auth/jwt';

// GET /api/admin/houses - List all houses with filters
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

        // Allow all dashboard users (ADMIN, SUPERVISOR, CONTRACTOR, GOVT)
        const allowedRoles = ['ADMIN', 'SUPERVISOR', 'CONTRACTOR', 'GOVT'];
        if (!decoded || !allowedRoles.includes(decoded.role)) {
            return NextResponse.json(
                { success: false, message: 'Dashboard access required' },
                { status: 403 }
            );
        }

        // Get query parameters
        const { searchParams } = new URL(request.url);
        const ward = searchParams.get('ward');
        const collectorId = searchParams.get('collectorId');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const skip = (page - 1) * limit;

        // Build where clause
        const where: any = {};
        if (ward) where.ward = ward;
        if (collectorId) where.collectorId = parseInt(collectorId);

        // Get total count
        const total = await prisma.unit.count({ where });

        // Get houses with related data
        const houses = await prisma.unit.findMany({
            where,
            include: {
                collector: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                    },
                },
                qr: {
                    select: {
                        secureToken: true,
                        status: true,
                    },
                },
                _count: {
                    select: {
                        collections: true,
                        payments: true,
                        complaints: true,
                    },
                },
            },
            orderBy: { unitNumber: 'asc' },
            skip,
            take: limit,
        });

        console.log('[ADMIN HOUSES API] Total units in DB:', total);
        console.log('[ADMIN HOUSES API] Houses found:', houses.length);
        console.log('[ADMIN HOUSES API] Where clause:', where);

        // Get current month for payment status
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Get current month payments for all houses
        const houseIds = houses.map(h => h.id);
        const currentPayments = await prisma.payment.findMany({
            where: {
                unitId: { in: houseIds },
                month: currentMonth,
            },
            select: {
                unitId: true,
                status: true,
                amount: true,
            },
        });

        // Create a map for quick lookup
        const paymentMap = new Map(
            currentPayments.map(p => [p.unitId, { status: p.status, amount: Number(p.amount) }])
        );

        return NextResponse.json({
            success: true,
            data: houses.map(house => ({
                id: house.id,
                unitNumber: house.unitNumber,
                residentName: house.residentName,
                householdPhone: house.householdPhone,
                ward: house.ward,
                latitude: house.latitude,
                longitude: house.longitude,
                collector: house.collector ? {
                    id: house.collector.id,
                    name: house.collector.name,
                    phone: house.collector.phone,
                } : null,
                qrStatus: house.qr?.status,
                qrToken: house.qr?.secureToken,
                collectionsCount: house._count.collections,
                paymentsCount: house._count.payments,
                complaintsCount: house._count.complaints,
                currentPayment: paymentMap.get(house.id) || { status: 'UNPAID', amount: 150 },
                createdAt: house.createdAt,
            })),
            total,
            totalPages: Math.ceil(total / limit),
            page,
            limit,
        });
    } catch (error) {
        console.error('Error fetching houses:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to fetch houses' },
            { status: 500 }
        );
    }
}
