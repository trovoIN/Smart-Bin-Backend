import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { verifyToken } from '@/lib/auth/jwt';

// DELETE /api/admin/collections/[id] - Delete collection record
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
        const collectionId = parseInt(id);

        // Check if collection exists
        const collection = await prisma.collection.findUnique({
            where: { id: collectionId },
        });

        if (!collection) {
            return NextResponse.json(
                { success: false, message: 'Collection not found' },
                { status: 404 }
            );
        }

        // Delete collection
        await prisma.collection.delete({
            where: { id: collectionId },
        });

        return NextResponse.json({
            success: true,
            message: 'Collection deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting collection:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to delete collection' },
            { status: 500 }
        );
    }
}
