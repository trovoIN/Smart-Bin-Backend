// ============================================
// Smart Bin - Collection Service
// ============================================
// This service handles garbage collection operations:
// - Mark garbage collected
// - View collection history
// - Sync offline collections
//
// KEY RULES:
// - One collection per unit per day
// - Collections are geo-tagged and timestamped
// - Supports offline-first (sync later)
// ============================================

import prisma from '@/lib/db/prisma';
import { Collection, CollectionMarkInput, CollectionHistory } from '@/types';
import { notificationService } from '@/lib/notifications';

// ============================================
// MARK COLLECTION
// ============================================

/**
 * Mark garbage as collected for a unit
 * 
 * BUSINESS RULES:
 * 1. Only one collection per unit per day
 * 2. Collector must be assigned to the unit
 * 3. Collection is geo-tagged with GPS
 * 4. Time is recorded for audit
 * 
 * @param collectorId - ID of collector performing collection
 * @param input - Collection details
 * @returns Created collection record
 * 
 * @example
 * const collection = await markCollected(1, {
 *   unitId: 10,
 *   latitude: 17.4239,
 *   longitude: 78.4738,
 * });
 */
export async function markCollected(
    collectorId: number,
    input: CollectionMarkInput
): Promise<Collection> {
    const { unitId, collectedAt, latitude, longitude } = input;
    const collectionTime = collectedAt || new Date();

    // Verify collector is assigned to this unit
    const unit = await prisma.unit.findUnique({
        where: { id: unitId },
        select: { id: true, collectorId: true, householdPhone: true, unitNumber: true },
    });

    if (!unit) {
        throw new CollectionError('Unit not found');
    }

    if (unit.collectorId !== collectorId) {
        throw new CollectionError('You are not assigned to this unit');
    }

    // Check if already collected today
    const today = new Date(collectionTime);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingCollection = await prisma.collection.findFirst({
        where: {
            unitId,
            collectedAt: {
                gte: today,
                lt: tomorrow,
            },
        },
    });

    if (existingCollection) {
        throw new DuplicateCollectionError(
            'Garbage already collected for this unit today'
        );
    }

    // Create collection record
    const collection = await prisma.collection.create({
        data: {
            unitId,
            collectorId,
            collectedAt: collectionTime,
            latitude,
            longitude,
            syncedAt: new Date(), // Mark as synced immediately if online
        },
    });

    // Log for audit
    await prisma.auditLog.create({
        data: {
            action: 'COLLECTION_MARKED',
            entityType: 'Collection',
            entityId: collection.id,
            userId: collectorId,
            userRole: 'COLLECTOR',
            metadata: {
                unitId,
                latitude,
                longitude,
                timestamp: collectionTime.toISOString(),
            },
        },
    });

    // Send notification to household
    try {
        if (unit.householdPhone) {
            await notificationService.sendCollectionConfirmation(
                unit.householdPhone,
                unit.unitNumber
            );
        }
    } catch (error) {
        console.error('Failed to send collection notification:', error);
    }

    return collection as Collection;
}

// ============================================
// COLLECTION HISTORY
// ============================================

/**
 * Get collection history for a unit
 * 
 * @param unitId - Unit ID
 * @param days - Number of days of history (default 30)
 * @returns Array of collection records
 */
export async function getCollectionHistory(
    unitId: number,
    days: number = 30
): Promise<CollectionHistory[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get all collections in date range
    const collections = await prisma.collection.findMany({
        where: {
            unitId,
            collectedAt: { gte: startDate },
        },
        include: {
            collector: {
                select: { name: true },
            },
        },
        orderBy: { collectedAt: 'desc' },
    });

    // Create map of dates with collections
    const collectionMap = new Map<string, typeof collections[0]>();
    for (const collection of collections) {
        const dateKey = collection.collectedAt.toISOString().split('T')[0];
        collectionMap.set(dateKey, collection);
    }

    // Generate history for each day
    const history: CollectionHistory[] = [];
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < days; i++) {
        const date = new Date(currentDate);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];

        const collection = collectionMap.get(dateKey);

        history.push({
            date,
            status: collection ? 'COLLECTED' : 'MISSED',
            collectorName: collection?.collector.name,
        });
    }

    return history;
}

/**
 * Get collection statistics for today
 * 
 * @param collectorId - Optional collector ID for filtering
 * @param ward - Optional ward for filtering
 * @returns Statistics object
 */
export async function getTodayCollectionStats(
    collectorId?: number,
    ward?: string
): Promise<{
    totalUnits: number;
    collected: number;
    remaining: number;
    percentage: number;
}> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Build where clause
    const whereUnits: Record<string, unknown> = {};
    if (collectorId) whereUnits.collectorId = collectorId;
    if (ward) whereUnits.ward = ward;

    // Get total units
    const totalUnits = await prisma.unit.count({ where: whereUnits });

    // Get collected today
    const collected = await prisma.collection.count({
        where: {
            collectedAt: {
                gte: today,
                lt: tomorrow,
            },
            ...(collectorId && { collectorId }),
            ...(ward && { unit: { ward } }),
        },
    });

    const remaining = totalUnits - collected;
    const percentage = totalUnits > 0 ? Math.round((collected / totalUnits) * 100) : 0;

    return { totalUnits, collected, remaining, percentage };
}

// ============================================
// COLLECTOR ROUTES
// ============================================

/**
 * Get units assigned to a collector for today's route
 * Shows collection status for each unit
 * 
 * @param collectorId - Collector ID
 * @returns Array of units with today's status
 */
export async function getCollectorRoute(collectorId: number): Promise<{
    units: Array<{
        id: number;
        unitNumber: string;
        ward: string | null;
        collectedToday: boolean;
        lastCollectedAt: Date | null;
    }>;
    stats: {
        total: number;
        collected: number;
        remaining: number;
    };
}> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all units for this collector
    const units = await prisma.unit.findMany({
        where: { collectorId },
        include: {
            collections: {
                where: {
                    collectedAt: {
                        gte: today,
                        lt: tomorrow,
                    },
                },
                take: 1,
            },
        },
        orderBy: { unitNumber: 'asc' },
    });

    const result = units.map((unit) => ({
        id: unit.id,
        unitNumber: unit.unitNumber,
        ward: unit.ward,
        collectedToday: unit.collections.length > 0,
        lastCollectedAt: unit.collections[0]?.collectedAt || null,
    }));

    const collected = result.filter((u) => u.collectedToday).length;

    return {
        units: result,
        stats: {
            total: result.length,
            collected,
            remaining: result.length - collected,
        },
    };
}

// ============================================
// OFFLINE SYNC
// ============================================

/**
 * Sync offline collections
 * Handles bulk upload of collections made while offline
 * 
 * @param collectorId - Collector ID
 * @param collections - Array of offline collections
 * @returns Sync results
 */
export async function syncOfflineCollections(
    collectorId: number,
    collections: Array<{
        unitId: number;
        collectedAt: Date;
        latitude?: number;
        longitude?: number;
        localId?: string;
    }>
): Promise<{
    synced: number;
    failed: number;
    errors: Array<{ localId?: string; error: string }>;
}> {
    const errors: Array<{ localId?: string; error: string }> = [];
    let synced = 0;

    for (const collection of collections) {
        try {
            await markCollected(collectorId, {
                unitId: collection.unitId,
                collectedAt: collection.collectedAt,
                latitude: collection.latitude,
                longitude: collection.longitude,
            });
            synced++;
        } catch (error) {
            errors.push({
                localId: collection.localId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    return {
        synced,
        failed: errors.length,
        errors,
    };
}

// ============================================
// MISSED COLLECTIONS
// ============================================

/**
 * Get missed collections (units not collected today)
 * 
 * @param ward - Optional ward filter
 * @returns Array of units with missed collections
 */
export async function getMissedCollections(ward?: string): Promise<Array<{
    unitId: number;
    unitNumber: string;
    ward: string | null;
    collectorName: string;
    daysMissed: number;
}>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all units with their last collection
    const whereClause = ward ? { ward } : {};

    const units = await prisma.unit.findMany({
        where: whereClause,
        include: {
            collector: {
                select: { name: true },
            },
            collections: {
                orderBy: { collectedAt: 'desc' },
                take: 1,
            },
        },
    });

    // Filter to units not collected today
    const missed = units.filter((unit) => {
        if (unit.collections.length === 0) return true;

        const lastCollection = unit.collections[0].collectedAt;
        return lastCollection < today;
    });

    return missed.map((unit) => {
        const lastCollection = unit.collections[0]?.collectedAt;
        const daysMissed = lastCollection
            ? Math.floor((today.getTime() - lastCollection.getTime()) / (1000 * 60 * 60 * 24))
            : 999; // No collection ever

        return {
            unitId: unit.id,
            unitNumber: unit.unitNumber,
            ward: unit.ward,
            collectorName: unit.collector.name,
            daysMissed,
        };
    });
}

// ============================================
// CUSTOM ERROR CLASSES
// ============================================

export class CollectionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CollectionError';
    }
}

export class DuplicateCollectionError extends CollectionError {
    constructor(message: string = 'Collection already exists for today') {
        super(message);
        this.name = 'DuplicateCollectionError';
    }
}
