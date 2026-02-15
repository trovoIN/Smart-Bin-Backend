import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { verifyToken } from '@/lib/auth/jwt';

// DELETE /api/admin/qr/[id] - Delete a QR code
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        // Only ADMIN and SUPERVISOR can delete QR codes
        if (!decoded || !['ADMIN', 'SUPERVISOR'].includes(decoded.role)) {
            return NextResponse.json(
                { success: false, message: 'Insufficient permissions' },
                { status: 403 }
            );
        }

        const { id } = await params;
        const qrId = parseInt(id);

        // Check if QR code exists
        const qrCode = await prisma.qRCode.findUnique({
            where: { id: qrId },
            include: {
                unit: true,
            },
        });

        if (!qrCode) {
            return NextResponse.json(
                { success: false, message: 'QR code not found' },
                { status: 404 }
            );
        }

        // Check if QR is assigned to a unit
        if (qrCode.unit) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Cannot delete QR code that is assigned to a unit. Please unassign it first.',
                },
                { status: 400 }
            );
        }

        // Delete the QR code
        await prisma.qRCode.delete({
            where: { id: qrId },
        });

        return NextResponse.json({
            success: true,
            message: 'QR code deleted successfully',
        });
    } catch (error) {
        console.error('[ADMIN QR DELETE] Error:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}

// PATCH /api/admin/qr/[id] - Update QR status (e.g., deactivate)
export async function PATCH(
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

        // Required roles: ADMIN, SUPERVISOR
        if (!decoded || !['ADMIN', 'SUPERVISOR'].includes(decoded.role)) {
            return NextResponse.json(
                { success: false, message: 'Insufficient permissions' },
                { status: 403 }
            );
        }

        const { id } = await params;
        const qrId = parseInt(id);
        const body = await request.json();
        const { status } = body;

        // Update QR status
        const updatedQR = await prisma.qRCode.update({
            where: { id: qrId },
            data: { status },
        });

        return NextResponse.json({
            success: true,
            data: updatedQR,
            message: `QR status updated to ${status}`,
        });
    } catch (error) {
        console.error('Error updating QR status:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to update QR' },
            { status: 500 }
        );
    }
}

// POST /api/admin/qr/[id]/assign - Assign QR to house and collector
export async function POST(
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

        if (!decoded || !['ADMIN', 'SUPERVISOR'].includes(decoded.role)) {
            return NextResponse.json(
                { success: false, message: 'Insufficient permissions' },
                { status: 403 }
            );
        }

        const { id } = await params;
        const qrId = parseInt(id);
        const body = await request.json();
        const { houseId, collectorId } = body;

        // Start transaction
        const result = await prisma.$transaction(async (tx) => {
            // 1. Update QR Status to ACTIVE
            const qr = await tx.qRCode.update({
                where: { id: qrId },
                data: {
                    status: 'ACTIVE',
                    activatedAt: new Date()
                },
            });

            // 2. Update Unit to link to this QR and Collector
            const unit = await tx.unit.update({
                where: { id: parseInt(houseId) },
                data: {
                    qrId: qrId,
                    collectorId: collectorId ? parseInt(collectorId) : null,
                },
            });

            return { qr, unit };
        });

        return NextResponse.json({
            success: true,
            data: result,
            message: 'QR assigned successfully',
        });
    } catch (error) {
        console.error('Error assigning QR:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to assign QR' },
            { status: 500 }
        );
    }
}

