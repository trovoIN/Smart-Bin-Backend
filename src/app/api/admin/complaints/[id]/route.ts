import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { verifyToken } from '@/lib/auth/jwt';

// DELETE /api/admin/complaints/[id] - Delete complaint
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
        const complaintId = parseInt(id);

        // Check if complaint exists
        const complaint = await prisma.complaint.findUnique({
            where: { id: complaintId },
        });

        if (!complaint) {
            return NextResponse.json(
                { success: false, message: 'Complaint not found' },
                { status: 404 }
            );
        }

        // Delete complaint
        await prisma.complaint.delete({
            where: { id: complaintId },
        });

        return NextResponse.json({
            success: true,
            message: 'Complaint deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting complaint:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to delete complaint' },
            { status: 500 }
        );
    }
}
// PUT /api/admin/complaints/[id] - Update complaint status/resolution
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

        // Allow all dashboard users to update complaints
        const allowedRoles = ['ADMIN', 'SUPERVISOR', 'CONTRACTOR', 'GOVT'];
        if (!decoded || !allowedRoles.includes(decoded.role)) {
            return NextResponse.json(
                { success: false, message: 'Dashboard access required' },
                { status: 403 }
            );
        }

        const { id } = await params;
        const complaintId = parseInt(id);
        const body = await request.json();
        const { status, resolutionNotes } = body;

        // Check if complaint exists
        const complaint = await prisma.complaint.findUnique({
            where: { id: complaintId },
        });

        if (!complaint) {
            return NextResponse.json(
                { success: false, message: 'Complaint not found' },
                { status: 404 }
            );
        }

        // Update data
        const updateData: any = {
            status: status || complaint.status,
            resolutionNotes: resolutionNotes !== undefined ? resolutionNotes : complaint.resolutionNotes,
        };

        // If status is being set to RESOLVED, set resolvedAt and resolvedById
        if (status === 'RESOLVED' && complaint.status !== 'RESOLVED') {
            updateData.resolvedAt = new Date();
            updateData.resolvedById = (decoded as any).userId;
        }

        const updatedComplaint = await prisma.complaint.update({
            where: { id: complaintId },
            data: updateData,
        });

        return NextResponse.json({
            success: true,
            data: updatedComplaint,
            message: 'Complaint updated successfully',
        });
    } catch (error) {
        console.error('Error updating complaint:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to update complaint' },
            { status: 500 }
        );
    }
}
