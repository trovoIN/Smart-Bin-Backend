import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { verifyToken } from '@/lib/auth/jwt';

// GET /api/admin/collectors/[id] - Get specific collector details
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

        // Allow all dashboard users
        const allowedRoles = ['ADMIN', 'SUPERVISOR', 'CONTRACTOR', 'GOVT'];
        if (!decoded || !allowedRoles.includes(decoded.role)) {
            return NextResponse.json(
                { success: false, message: 'Dashboard access required' },
                { status: 403 }
            );
        }

        const { id } = await params;
        const collectorId = parseInt(id);

        const collector = await prisma.collector.findUnique({
            where: { id: collectorId },
            include: {
                units: {
                    select: {
                        id: true,
                        unitNumber: true,
                        ward: true,
                    },
                },
                _count: {
                    select: {
                        units: true,
                        collections: true,
                    },
                },
            },
        });

        if (!collector) {
            return NextResponse.json(
                { success: false, message: 'Collector not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: collector,
        });
    } catch (error) {
        console.error('Error fetching collector:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to fetch collector' },
            { status: 500 }
        );
    }
}

// PUT /api/admin/collectors/[id] - Update collector details
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

        // Only ADMIN and SUPERVISOR can update collectors
        const allowedRoles = ['ADMIN', 'SUPERVISOR'];
        if (!decoded || !allowedRoles.includes(decoded.role)) {
            return NextResponse.json(
                { success: false, message: 'Admin or Supervisor access required' },
                { status: 403 }
            );
        }

        const { id } = await params;
        const collectorId = parseInt(id);
        const body = await request.json();

        const { name, phone, upiId, status } = body;

        // Validate phone number format if provided
        if (phone && !phone.startsWith('+91')) {
            return NextResponse.json(
                { success: false, message: 'Phone number must start with +91' },
                { status: 400 }
            );
        }

        // Build update object
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (phone !== undefined) updateData.phone = phone;
        if (upiId !== undefined) updateData.upiId = upiId;
        if (status !== undefined) updateData.status = status;

        const updatedCollector = await prisma.collector.update({
            where: { id: collectorId },
            data: updateData,
        });

        return NextResponse.json({
            success: true,
            message: 'Collector updated successfully',
            data: updatedCollector,
        });
    } catch (error) {
        console.error('Error updating collector:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to update collector' },
            { status: 500 }
        );
    }
}

// DELETE /api/admin/collectors/[id] - Delete collector
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

        // Only ADMIN, GOVT, and SUPERVISOR can delete collectors
        const allowedRoles = ['ADMIN', 'GOVT', 'SUPERVISOR'];
        if (!decoded || !allowedRoles.includes(decoded.role)) {
            return NextResponse.json(
                { success: false, message: 'Admin or Supervisor access required' },
                { status: 403 }
            );
        }

        const { id } = await params;
        const collectorId = parseInt(id);

        // Check if collector exists
        const collector = await prisma.collector.findUnique({
            where: { id: collectorId },
            include: {
                _count: {
                    select: { units: true },
                },
            },
        });

        if (!collector) {
            return NextResponse.json(
                { success: false, message: 'Collector not found' },
                { status: 404 }
            );
        }

        // Prevent deletion if collector has assigned houses
        if (collector._count.units > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Cannot delete collector. ${collector._count.units} house(s) are still assigned. Please reassign them first.`,
                },
                { status: 400 }
            );
        }

        // Delete collector
        await prisma.collector.delete({
            where: { id: collectorId },
        });

        return NextResponse.json({
            success: true,
            message: 'Collector deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting collector:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to delete collector' },
            { status: 500 }
        );
    }
}
