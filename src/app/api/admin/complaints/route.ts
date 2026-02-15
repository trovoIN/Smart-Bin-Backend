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
        const status = searchParams.get('status');
        const category = searchParams.get('category');

        const skip = (page - 1) * limit;

        // Build where clause
        const where: any = {};

        if (status) {
            where.status = status;
        }

        if (category) {
            if (category === 'PAYMENT') {
                where.complaintType = 'NON_PAYMENT';
            } else if (category === 'SERVICE') {
                where.complaintType = {
                    in: ['GARBAGE_NOT_COLLECTED', 'SERVICE_ISSUE', 'REPEATED_DEFAULTER', 'OTHER'],
                };
            }
        }

        // If ward filter, need to join through unit
        if (ward) {
            where.unit = {
                ward: ward,
            };
        }

        // Get complaints with related data
        const [complaints, total] = await Promise.all([
            prisma.complaint.findMany({
                where,
                skip,
                take: limit,
                include: {
                    unit: {
                        select: {
                            id: true,
                            unitNumber: true,
                            ward: true,
                            residentName: true,
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
                    createdAt: 'desc',
                },
            }),
            prisma.complaint.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limit);

        // Format response
        const formattedComplaints = complaints.map((complaint) => {
            // Map complaintType to category
            let category = 'SERVICE';
            if (complaint.complaintType === 'NON_PAYMENT') {
                category = 'PAYMENT';
            }

            return {
                id: complaint.id,
                houseId: complaint.unitId,
                house: complaint.unit ? {
                    id: complaint.unit.id,
                    unitNo: complaint.unit.unitNumber,
                    ward: complaint.unit.ward,
                    residentName: complaint.unit.residentName,
                } : null,
                unitNo: complaint.unit?.unitNumber,
                residentName: complaint.unit?.residentName,
                ward: complaint.unit?.ward,
                collectorId: complaint.collectorId,
                collectorName: complaint.collector?.name,
                type: complaint.complaintType,
                category: category,
                status: complaint.status,
                description: complaint.description,
                imageUrl: complaint.imageUrl,
                resolutionNotes: complaint.resolutionNotes,
                raisedBy: complaint.raisedBy,
                createdAt: complaint.createdAt.toISOString(),
                resolvedAt: complaint.resolvedAt?.toISOString(),
            };
        });

        return NextResponse.json({
            success: true,
            data: formattedComplaints,
            total,
            page,
            totalPages,
            pageSize: limit,
        });
    } catch (error) {
        console.error('[ADMIN COMPLAINTS API] Error:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}
