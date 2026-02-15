// GET /api/collector/houses - Get houses assigned to collector
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(request: NextRequest) {
    console.log('=== HOUSES API CALLED ===');
    try {
        // Get token from header
        const authHeader = request.headers.get('authorization');
        console.log('Auth header present:', !!authHeader);

        if (!authHeader?.startsWith('Bearer ')) {
            console.log('ERROR: No Bearer token');
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7);
        console.log('Token length:', token.length);

        let decoded;
        try {
            decoded = verifyToken(token);
            console.log('Decoded token:', JSON.stringify(decoded));
        } catch (tokenError) {
            console.log('Token verification FAILED:', tokenError);
            return NextResponse.json(
                { success: false, error: 'Invalid token' },
                { status: 401 }
            );
        }

        // JWT uses 'role' field and 'sub' for user ID
        console.log('Role from token:', decoded.role);
        if (!decoded || decoded.role !== 'COLLECTOR') {
            console.log('ERROR: Not a collector, role is:', decoded?.role);
            return NextResponse.json(
                { success: false, error: 'Invalid token or not a collector' },
                { status: 401 }
            );
        }

        // Get collector by ID from token (sub = user ID)
        const collectorId = parseInt(decoded.sub);
        console.log('Collector ID from token:', collectorId);

        const collector = await prisma.collector.findUnique({
            where: { id: collectorId },
        });

        console.log('Collector found:', collector?.name, collector?.id);

        if (!collector) {
            console.log('ERROR: Collector not found in DB');
            return NextResponse.json(
                { success: false, error: 'Collector not found' },
                { status: 404 }
            );
        }

        // Get all units assigned to this collector
        const units = await prisma.unit.findMany({
            where: { collectorId: collector.id },
            select: {
                id: true,
                unitNumber: true,
                householdPhone: true,
                residentName: true,
                ward: true,
                latitude: true,
                longitude: true,
                createdAt: true,
                qr: {
                    select: {
                        secureToken: true,
                    }
                }
            },
            orderBy: { unitNumber: 'asc' },
        });

        console.log(`Found ${units.length} units for collector ${collector.id}`);

        // Format response
        const houses = units.map(unit => ({
            id: unit.id,
            unitNumber: unit.unitNumber,
            houseNumber: unit.unitNumber,
            ownerName: unit.residentName || 'Household',
            ownerPhone: unit.householdPhone,
            address: `Ward ${unit.ward || 'N/A'}`,
            ward: unit.ward,
            latitude: unit.latitude,
            longitude: unit.longitude,
            qrToken: unit.qr?.secureToken,
        }));

        return NextResponse.json({
            success: true,
            data: {
                houses,
                count: houses.length,
            }
        });

    } catch (error) {
        console.error('Get collector houses error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to get houses' },
            { status: 500 }
        );
    }
}
