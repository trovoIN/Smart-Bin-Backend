import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { verifyToken } from '@/lib/auth/jwt';

// GET /api/admin/houses/[id] - Get specific house details
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id } = await params;
        const houseId = parseInt(id);

        const house = await prisma.unit.findUnique({
            where: { id: houseId },
            include: {
                collector: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                    },
                },
                qr: true,
                collections: {
                    orderBy: { collectedAt: 'desc' },
                    take: 10,
                    include: {
                        collector: {
                            select: { name: true },
                        },
                    },
                },
                payments: {
                    orderBy: { month: 'desc' },
                    take: 5,
                },
                complaints: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
            },
        });

        if (!house) {
            return NextResponse.json(
                { success: false, message: 'House not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: house,
        });
    } catch (error) {
        console.error('Error fetching house:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to fetch house' },
            { status: 500 }
        );
    }
}

// PUT /api/admin/houses/[id] - Update house details
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id } = await params;
        const houseId = parseInt(id);
        const body = await request.json();

        const { collectorId, ward, residentName, householdPhone, latitude, longitude } = body;

        // Build update object
        const updateData: any = {};
        if (collectorId !== undefined) updateData.collectorId = collectorId ? parseInt(collectorId) : null;
        if (ward !== undefined) updateData.ward = ward;
        if (residentName !== undefined) updateData.residentName = residentName;
        if (householdPhone !== undefined) updateData.householdPhone = householdPhone;
        if (latitude !== undefined) updateData.latitude = latitude;
        if (longitude !== undefined) updateData.longitude = longitude;

        const updatedHouse = await prisma.unit.update({
            where: { id: houseId },
            data: updateData,
            include: {
                collector: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            message: 'House updated successfully',
            data: updatedHouse,
        });
    } catch (error) {
        console.error('Error updating house:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to update house' },
            { status: 500 }
        );
    }
}

// DELETE /api/admin/houses/[id] - Delete house and all related data
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id } = await params;
        const houseId = parseInt(id);

        // Check if house exists
        const house = await prisma.unit.findUnique({
            where: { id: houseId },
        });

        if (!house) {
            return NextResponse.json(
                { success: false, message: 'House not found' },
                { status: 404 }
            );
        }

        // Delete house and all related records
        // Since cascade delete is not configured in schema, we need to manually delete related records

        // Delete related records in correct order (to avoid foreign key constraints)
        await prisma.collection.deleteMany({
            where: { unitId: houseId },
        });

        await prisma.payment.deleteMany({
            where: { unitId: houseId },
        });

        await prisma.complaint.deleteMany({
            where: { unitId: houseId },
        });

        // Now delete the unit
        await prisma.unit.delete({
            where: { id: houseId },
        });

        return NextResponse.json({
            success: true,
            message: 'House and all related data deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting house:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to delete house' },
            { status: 500 }
        );
    }
}
