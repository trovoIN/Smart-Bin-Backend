// GET /api/collector/house/[id] - Get detailed house info for collector
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7);
        const decoded = await verifyToken(token); // Ensure await if verifyToken is async

        if (!decoded || decoded.role !== 'COLLECTOR') {
            return NextResponse.json(
                { success: false, error: 'Invalid token or not a collector' },
                { status: 401 }
            );
        }

        const { id } = await params;
        const unitId = parseInt(id);
        const collectorId = parseInt(decoded.sub);

        if (isNaN(unitId)) {
            return NextResponse.json(
                { success: false, error: 'Invalid Unit ID' },
                { status: 400 }
            );
        }

        // Get unit with related data
        const unit = await prisma.unit.findFirst({
            where: {
                id: unitId,
                collectorId: collectorId, // Ensure collector owns this unit
            },
            include: {
                qr: true,
                collections: {
                    orderBy: { collectedAt: 'desc' },
                    take: 10,
                    include: {
                        collector: {
                            select: { name: true }
                        }
                    }
                },
                payments: {
                    orderBy: { month: 'desc' },
                    take: 3,
                },
                complaints: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
            },
        });

        if (!unit) {
            return NextResponse.json(
                { success: false, error: 'House not found or not assigned to you' },
                { status: 404 }
            );
        }

        // Get current month payment status
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const currentPayment = unit.payments.find(p => p.month === currentMonth);

        return NextResponse.json({
            success: true,
            data: {
                id: unit.id,
                unitNumber: unit.unitNumber,
                residentName: unit.residentName,
                householdPhone: unit.householdPhone,
                ward: unit.ward,
                latitude: unit.latitude,
                longitude: unit.longitude,
                qrToken: unit.qr?.secureToken,
                paymentDue: currentPayment?.amount || 500,
                paymentStatus: currentPayment?.status || 'PENDING',
                collections: unit.collections.map(c => ({
                    id: c.id,
                    collectedAt: c.collectedAt,
                    collectorName: c.collector?.name,
                })),
                complaints: unit.complaints.map(c => ({
                    id: c.id,
                    type: c.complaintType,
                    status: c.status,
                    description: c.description,
                    createdAt: c.createdAt,
                })),
            },
        });

    } catch (error) {
        console.error('Get house detail error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to get house details' },
            { status: 500 }
        );
    }
}
