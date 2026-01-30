// ============================================
// Smart Bin - Unit (House) Service
// ============================================
// This service handles unit/house operations:
// - Register new units (QR activation)
// - Get unit details
// - Update unit info
// - Assign collector
// ============================================

import prisma from '@/lib/db/prisma';
import { Unit, UnitWithDetails, UnitRegisterInput } from '@/types';
import { activateQRCode, QRAlreadyActiveError, generateQRToken } from './qr.service';

// ============================================
// UNIT REGISTRATION (QR ACTIVATION)
// ============================================

/**
 * Register a new unit with Location (Self-Registration)
 */
export async function registerUnitWithLocation(
    input: {
        unitNumber: string;
        householdPhone: string;
        residentName?: string;
        latitude: number;
        longitude: number;
    }
): Promise<{ unit: Unit; qrToken: string }> {
    const { unitNumber, householdPhone, residentName, latitude, longitude } = input;

    // 1. DUPLICATE LOCATION CHECK (10 meters)
    // Naive approximation: 0.0001 deg ~= 11 meters
    const nearbyUnit = await prisma.unit.findFirst({
        where: {
            // @ts-ignore: Prisma types not updated yet
            latitude: {
                gte: latitude - 0.0001,
                lte: latitude + 0.0001,
            },
            // @ts-ignore: Prisma types not updated yet
            longitude: {
                gte: longitude - 0.0001,
                lte: longitude + 0.0001,
            },
        },
    });

    if (nearbyUnit) {
        // For DEMO: Allow duplicate locations (User request)
        // throw new UnitError('A household is already registered at this precise location.');
        console.warn('⚠️ A household is already registered at this location, but proceeding for DEMO.');
    }

    // 2. CHECK IF PHONE ALREADY REGISTERED
    const existingPhone = await prisma.unit.findFirst({
        where: { householdPhone }
    });
    if (existingPhone) {
        throw new UnitError('This phone number is already registered to a Unit.');
    }

    // 3. GENERATE NEW QR & CREATE UNIT
    // We create a new Active QR on the fly for self-registration
    const result = await prisma.$transaction(async (tx) => {
        // Generate Secure Token
        const secureToken = generateQRToken();

        // Create QR
        const qr = await tx.qRCode.create({
            data: {
                secureToken,
                status: 'ACTIVE',
                activatedAt: new Date(),
            }
        });

        // Create Unit (No Collector initially)
        const unit = await tx.unit.create({
            data: {
                unitNumber,
                householdPhone,
                qrId: qr.id,
                // @ts-ignore
                latitude,
                // @ts-ignore
                longitude,
                // @ts-ignore
                residentName: residentName || null,
                collectorId: null as any, // Unassigned initially
            }
        });

        return { unit: unit as unknown as Unit, qrToken: secureToken };
    });

    return result;
}

/**
 * Register a new unit and activate QR code
 * 
 * Called when collector scans an UNASSIGNED QR and fills registration
 * 
 * @param collectorId - Collector registering the unit
 * @param input - Registration details
 * @returns Created unit
 */
export async function registerUnit(
    collectorId: number,
    input: UnitRegisterInput
): Promise<Unit> {
    const { qrToken, unitNumber, householdPhone } = input;

    // Find QR by token
    const qrCode = await prisma.qRCode.findUnique({
        where: { secureToken: qrToken },
        include: { unit: true }, // Include unit to check assignment
    });

    if (!qrCode) {
        throw new UnitError('Invalid QR code');
    }

    // HANDLE TAKE UP (Existing Active Unit with No Collector)
    if (qrCode.status === 'ACTIVE') {
        if (qrCode.unit && qrCode.unit.collectorId === null) {
            // This is a "Take Up" request
            const updatedUnit = await prisma.unit.update({
                where: { id: qrCode.unit.id },
                data: { collectorId },
            });

            // Log for audit
            await prisma.auditLog.create({
                data: {
                    action: 'UNIT_ASSIGNED',
                    entityType: 'Unit',
                    entityId: updatedUnit.id,
                    userId: collectorId,
                    userRole: 'COLLECTOR',
                    metadata: {
                        unitNumber: updatedUnit.unitNumber,
                        qrId: qrCode.id,
                        type: 'TAKE_UP'
                    },
                },
            });

            return updatedUnit as Unit;
        } else {
            throw new QRAlreadyActiveError('QR code already registered to another collector');
        }
    }

    if (qrCode.status === 'DEACTIVATED') {
        throw new UnitError('QR code is deactivated');
    }

    // NEW REGISTRATION (Physical Sticker)
    // Check if unit number already exists for this collector
    const existingUnit = await prisma.unit.findFirst({
        where: {
            collectorId,
            unitNumber,
        },
    });

    if (existingUnit) {
        throw new UnitError('Unit number already exists for this collector');
    }

    // Create unit and activate QR in a transaction
    const unit = await prisma.$transaction(async (tx) => {
        // Create the unit
        const newUnit = await tx.unit.create({
            data: {
                unitNumber,
                householdPhone,
                collectorId,
                qrId: qrCode.id,
            },
        });

        // Activate the QR code
        await tx.qRCode.update({
            where: { id: qrCode.id },
            data: {
                status: 'ACTIVE',
                activatedAt: new Date(),
            },
        });

        return newUnit;
    });

    // Log for audit
    await prisma.auditLog.create({
        data: {
            action: 'UNIT_REGISTERED',
            entityType: 'Unit',
            entityId: unit.id,
            userId: collectorId,
            userRole: 'COLLECTOR',
            metadata: {
                unitNumber,
                qrId: qrCode.id,
            },
        },
    });

    return unit as Unit;
}

// ============================================
// UNIT QUERIES
// ============================================

/**
 * Get unit by ID with details
 */
export async function getUnitById(
    unitId: number
): Promise<UnitWithDetails | null> {
    const unit = await prisma.unit.findUnique({
        where: { id: unitId },
        include: {
            collector: {
                select: {
                    id: true,
                    name: true,
                },
            },
            collections: {
                orderBy: { collectedAt: 'desc' },
                take: 1,
            },
            payments: {
                orderBy: { month: 'desc' },
                take: 1,
            },
        },
    });

    if (!unit) return null;

    return {
        ...unit,
        collector: unit.collector,
        lastCollection: unit.collections[0]?.collectedAt,
        paymentStatus: unit.payments[0]?.status,
    } as unknown as UnitWithDetails;
}

/**
 * Get unit by phone number
 */
export async function getUnitByPhone(
    phone: string
): Promise<UnitWithDetails | null> {
    const unit = await prisma.unit.findFirst({
        where: { householdPhone: phone },
        include: {
            collector: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });

    if (!unit) return null;

    return unit as unknown as UnitWithDetails;
}

/**
 * Get all units for a collector
 */
export async function getUnitsForCollector(
    collectorId: number
): Promise<Unit[]> {
    const units = await prisma.unit.findMany({
        where: { collectorId },
        orderBy: { unitNumber: 'asc' },
    });

    return units as Unit[];
}

/**
 * Get all units in a ward
 */
export async function getUnitsByWard(ward: string): Promise<Unit[]> {
    const units = await prisma.unit.findMany({
        where: { ward },
        orderBy: { unitNumber: 'asc' },
    });

    return units as Unit[];
}

/**
 * Search units by unit number
 */
export async function searchUnits(
    query: string,
    limit: number = 20
): Promise<Unit[]> {
    const units = await prisma.unit.findMany({
        where: {
            unitNumber: {
                contains: query,
                mode: 'insensitive',
            },
        },
        take: limit,
        orderBy: { unitNumber: 'asc' },
    });

    return units as Unit[];
}

// ============================================
// UNIT UPDATES
// ============================================

/**
 * Update unit details
 * Limited fields can be updated
 */
export async function updateUnit(
    unitId: number,
    data: {
        unitNumber?: string;
        householdPhone?: string;
        ward?: string;
    }
): Promise<Unit> {
    const unit = await prisma.unit.update({
        where: { id: unitId },
        data,
    });

    return unit as Unit;
}

/**
 * Reassign unit to a different collector
 * Used when a collector leaves or routes change
 */
export async function reassignUnit(
    unitId: number,
    newCollectorId: number,
    reason?: string
): Promise<Unit> {
    // Get old collector for logging
    const oldUnit = await prisma.unit.findUnique({
        where: { id: unitId },
        select: { collectorId: true },
    });

    const unit = await prisma.unit.update({
        where: { id: unitId },
        data: {
            collectorId: newCollectorId,
        },
    });

    // Log reassignment
    await prisma.auditLog.create({
        data: {
            action: 'UNIT_REASSIGNED',
            entityType: 'Unit',
            entityId: unitId,
            metadata: {
                oldCollectorId: oldUnit?.collectorId,
                newCollectorId,
                reason,
            },
        },
    });

    return unit as Unit;
}

/**
 * Bulk reassign units
 */
export async function bulkReassignUnits(
    unitIds: number[],
    newCollectorId: number,
    reason?: string
): Promise<number> {
    const result = await prisma.unit.updateMany({
        where: { id: { in: unitIds } },
        data: { collectorId: newCollectorId },
    });

    // Log bulk reassignment
    await prisma.auditLog.create({
        data: {
            action: 'UNITS_BULK_REASSIGNED',
            entityType: 'Unit',
            entityId: 0, // Bulk action
            metadata: {
                unitCount: result.count,
                newCollectorId,
                reason,
            },
        },
    });

    return result.count;
}

// ============================================
// UNIT STATISTICS
// ============================================

/**
 * Get unit statistics
 */
export async function getUnitStats(ward?: string): Promise<{
    total: number;
    byWard: Array<{ ward: string; count: number }>;
}> {
    const whereClause = ward ? { ward } : {};

    const total = await prisma.unit.count({ where: whereClause });

    const byWard = await prisma.unit.groupBy({
        by: ['ward'],
        _count: true,
        orderBy: { _count: { ward: 'desc' } },
    });

    return {
        total,
        byWard: byWard.map((w: { ward: any; _count: any; }) => ({
            ward: w.ward || 'Unknown',
            count: w._count,
        })),
    };
}

// ============================================
// COLLECTOR MANAGEMENT
// ============================================

/**
 * Get collector details
 */
export async function getCollectorById(collectorId: number) {
    const collector = await prisma.collector.findUnique({
        where: { id: collectorId },
        include: {
            _count: {
                select: { units: true },
            },
        },
    });

    return collector;
}

/**
 * Get all active collectors
 */
export async function getActiveCollectors() {
    const collectors = await prisma.collector.findMany({
        where: { status: 'ACTIVE' },
        include: {
            _count: {
                select: { units: true },
            },
        },
        orderBy: { name: 'asc' },
    });

    return collectors;
}

/**
 * Update collector status
 */
export async function updateCollectorStatus(
    collectorId: number,
    status: 'ACTIVE' | 'INACTIVE'
) {
    const collector = await prisma.collector.update({
        where: { id: collectorId },
        data: { status },
    });

    return collector;
}

// ============================================
// CUSTOM ERROR CLASSES
// ============================================

export class UnitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UnitError';
    }
}

export class UnitNotFoundError extends UnitError {
    constructor() {
        super('Unit not found');
        this.name = 'UnitNotFoundError';
    }
}
