import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized' },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7);
        const decoded = await verifyToken(token);

        // Allow all dashboard users
        const allowedRoles = ['ADMIN', 'SUPERVISOR', 'CONTRACTOR', 'GOVT'];
        if (!decoded || !allowedRoles.includes(decoded.role)) {
            return NextResponse.json(
                { success: false, message: 'Dashboard access required' },
                { status: 403 }
            );
        }

        // Get query parameters
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const ward = searchParams.get('ward');
        const collectorId = searchParams.get('collectorId');
        const date = searchParams.get('date');

        const skip = (page - 1) * limit;

        // Build where clause
        const where: any = {};

        if (collectorId) {
            where.collectorId = parseInt(collectorId);
        }

        if (date) {
            const targetDate = new Date(date);
            const nextDate = new Date(targetDate);
            nextDate.setDate(nextDate.getDate() + 1);

            where.collectedAt = {
                gte: targetDate,
                lt: nextDate,
            };
        }

        // If ward filter, need to join through unit
        if (ward) {
            where.unit = {
                ward: ward,
            };
        }

        // Get collections with related data
        const [collections, total] = await Promise.all([
            prisma.collection.findMany({
                where,
                skip,
                take: limit,
                include: {
                    unit: {
                        select: {
                            id: true,
                            unitNumber: true,
                            ward: true,
                        },
                    },
                    collector: {
                        select: {
                            id: true,
                            name: true,
                            phone: true,
                        },
                    },
                },
                orderBy: {
                    collectedAt: 'desc',
                },
            }),
            prisma.collection.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limit);

        // Format response
        const formattedCollections = collections.map((collection) => ({
            id: collection.id,
            date: collection.collectedAt.toISOString(),
            houseId: collection.unitId,
            unitNumber: collection.unit?.unitNumber,
            ward: collection.unit?.ward,
            collectorId: collection.collectorId,
            collectorName: collection.collector?.name,
            status: 'COLLECTED', // All records in DB are collected
            remark: null,
            createdAt: collection.collectedAt.toISOString(),
        }));

        return NextResponse.json({
            success: true,
            data: formattedCollections,
            total,
            page,
            totalPages,
            pageSize: limit,
        });
    } catch (error) {
        console.error('[ADMIN COLLECTIONS API] Error:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}
