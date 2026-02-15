import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { verifyToken } from '@/lib/auth/jwt';

// GET /api/admin/collectors - List all collectors
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

        const { searchParams } = new URL(request.url);
        const ward = searchParams.get('ward');
        const status = searchParams.get('status');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const skip = (page - 1) * limit;

        const where: any = {};
        if (ward) where.assignedRoute = { contains: ward };
        if (status === 'ACTIVE') where.status = 'ACTIVE';
        if (status === 'INACTIVE') where.status = 'INACTIVE';

        const total = await prisma.collector.count({ where });

        const collectors = await prisma.collector.findMany({
            where,
            include: {
                _count: {
                    select: {
                        units: true,
                        collections: true,
                    },
                },
            },
            orderBy: { name: 'asc' },
            skip,
            take: limit,
        });

        return NextResponse.json({
            success: true,
            data: collectors.map(c => ({
                id: c.id,
                name: c.name,
                phone: c.phone,
                upiId: c.upiId,
                assignedRoute: c.assignedRoute,
                status: c.status,
                housesAssigned: c._count.units,
                collectionsCount: c._count.collections,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
            })),
            total,
            totalPages: Math.ceil(total / limit),
            page,
            limit,
        });
    } catch (error) {
        console.error('Error fetching collectors:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to fetch collectors' },
            { status: 500 }
        );
    }
}
