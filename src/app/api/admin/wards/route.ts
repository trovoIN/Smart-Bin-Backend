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

        // Fetch unique wards from Unit table
        const units = await prisma.unit.findMany({
            select: {
                ward: true,
            },
            distinct: ['ward'],
        });

        const wards = units
            .map((u) => u.ward)
            .filter((w): w is string => !!w)
            .sort()
            .map((name, index) => ({
                id: name,
                name: name,
            }));

        return NextResponse.json({
            success: true,
            data: wards,
        });
    } catch (error) {
        console.error('[ADMIN WARDS API] Error:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}
