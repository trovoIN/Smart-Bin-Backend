import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { verifyToken } from '@/lib/auth/jwt';

// GET /api/collector/profile - Get collector profile
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { success: false, message: 'Authorization required' },
                { status: 401 }
            );
        }

        const token = authHeader.split(' ')[1];
        const decoded = await verifyToken(token);

        if (!decoded || decoded.role !== 'COLLECTOR') {
            return NextResponse.json(
                { success: false, message: 'Invalid token or not a collector' },
                { status: 403 }
            );
        }

        const collector = await prisma.collector.findUnique({
            where: { id: parseInt(decoded.sub) },
            select: {
                id: true,
                name: true,
                phone: true,
                upiId: true,
                assignedRoute: true,
                status: true,
                createdAt: true,
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
        console.error('Error fetching profile:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to fetch profile' },
            { status: 500 }
        );
    }
}

// PUT /api/collector/profile - Update collector profile
export async function PUT(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { success: false, message: 'Authorization required' },
                { status: 401 }
            );
        }

        const token = authHeader.split(' ')[1];
        const decoded = await verifyToken(token);

        if (!decoded || decoded.role !== 'COLLECTOR') {
            return NextResponse.json(
                { success: false, message: 'Invalid token or not a collector' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { name, upiId, assignedRoute } = body;

        // Build update object with only provided fields
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (upiId !== undefined) updateData.upiId = upiId;
        if (assignedRoute !== undefined) updateData.assignedRoute = assignedRoute;

        const updatedCollector = await prisma.collector.update({
            where: { id: parseInt(decoded.sub) },
            data: updateData,
            select: {
                id: true,
                name: true,
                phone: true,
                upiId: true,
                assignedRoute: true,
                status: true,
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedCollector,
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to update profile' },
            { status: 500 }
        );
    }
}
