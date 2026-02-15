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

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const ward = searchParams.get('ward');
        const status = searchParams.get('status');

        const skip = (page - 1) * limit;

        const where: any = {};
        if (status) {
            where.status = status;
        }

        if (ward) {
            where.unit = {
                ward: ward,
            };
        }

        const [qrCodes, total] = await Promise.all([
            prisma.qRCode.findMany({
                where,
                skip,
                take: limit,
                include: {
                    unit: {
                        select: {
                            id: true,
                            unitNumber: true,
                            ward: true,
                            collector: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            }),
            prisma.qRCode.count({ where }),
        ]);

        const formattedQRs = qrCodes.map((qr) => ({
            id: qr.id,
            code: qr.secureToken, // Frontend expects 'code'
            status: qr.status,
            createdAt: qr.createdAt.toISOString(),
            activatedAt: qr.activatedAt?.toISOString() || null,
            ward: qr.unit?.ward || null,
            houseId: qr.unit?.id || null,
            house: qr.unit ? {
                id: qr.unit.id,
                unitNo: qr.unit.unitNumber,
            } : null,
            collector: qr.unit?.collector ? {
                id: qr.unit.collector.id,
                name: qr.unit.collector.name,
            } : null,
        }));

        return NextResponse.json({
            success: true,
            data: formattedQRs,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            pageSize: limit,
        });
    } catch (error) {
        console.error('[ADMIN QR LIST API] Error:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}
