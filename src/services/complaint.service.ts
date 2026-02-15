// ============================================
// Smart Bin - Complaint Service
// ============================================
// This service handles complaint operations:
// - Create complaints (household/collector)
// - Update complaint status
// - Resolve complaints (supervisor)
// - Complaint history
// ============================================

import prisma from '@/lib/db/prisma';
import {
    Complaint,
    ComplaintType,
    ComplaintStatus,
    ComplaintRaisedBy,
    ComplaintCreateInput,
    ComplaintResolveInput,
} from '@/types';

// ============================================
// CREATE COMPLAINTS
// ============================================

/**
 * Create a complaint from household
 * 
 * @param unitId - Unit ID raising complaint
 * @param input - Complaint details
 * @returns Created complaint
 */
export async function createHouseholdComplaint(
    unitId: number,
    input: Omit<ComplaintCreateInput, 'unitId'>
): Promise<Complaint> {
    const { complaintType, description, imageUrl } = input;

    // Validate complaint type for household
    const allowedTypes: ComplaintType[] = [
        ComplaintType.GARBAGE_NOT_COLLECTED,
        ComplaintType.SERVICE_ISSUE,
        ComplaintType.OTHER,
    ];

    if (!allowedTypes.includes(complaintType)) {
        throw new ComplaintError(
            'Invalid complaint type for household'
        );
    }

    const complaint = await prisma.complaint.create({
        data: {
            unitId,
            complaintType,
            raisedBy: 'HOUSEHOLD',
            description,
            imageUrl,
            status: 'OPEN',
        },
    });

    // Log for audit
    await prisma.auditLog.create({
        data: {
            action: 'COMPLAINT_CREATED',
            entityType: 'Complaint',
            entityId: complaint.id,
            metadata: {
                unitId,
                complaintType,
                raisedBy: 'HOUSEHOLD',
            },
        },
    });

    return complaint as unknown as Complaint;
}

/**
 * Create a complaint from collector
 * 
 * @param collectorId - Collector ID raising complaint
 * @param unitId - Unit ID the complaint is about
 * @param input - Complaint details
 * @returns Created complaint
 */
export async function createCollectorComplaint(
    collectorId: number,
    unitId: number,
    input: Omit<ComplaintCreateInput, 'unitId'>
): Promise<Complaint> {
    const { complaintType, description, imageUrl } = input;

    // Validate complaint type for collector
    const allowedTypes: ComplaintType[] = [
        ComplaintType.NON_PAYMENT,
        ComplaintType.REPEATED_DEFAULTER,
        ComplaintType.OTHER,
    ];

    if (!allowedTypes.includes(complaintType)) {
        throw new ComplaintError(
            'Invalid complaint type for collector'
        );
    }

    // Verify collector is assigned to unit
    const unit = await prisma.unit.findUnique({
        where: { id: unitId },
        select: { collectorId: true },
    });

    if (!unit || unit.collectorId !== collectorId) {
        throw new ComplaintError('You are not assigned to this unit');
    }

    const complaint = await prisma.complaint.create({
        data: {
            unitId,
            collectorId,
            complaintType,
            raisedBy: 'COLLECTOR',
            description,
            imageUrl,
            status: 'OPEN',
        },
    });

    // Log for audit
    await prisma.auditLog.create({
        data: {
            action: 'COMPLAINT_CREATED',
            entityType: 'Complaint',
            entityId: complaint.id,
            userId: collectorId,
            userRole: 'COLLECTOR',
            metadata: {
                unitId,
                complaintType,
                raisedBy: 'COLLECTOR',
            },
        },
    });

    return complaint as unknown as Complaint;
}

// ============================================
// COMPLAINT RESOLUTION (SUPERVISOR)
// ============================================

/**
 * Update complaint status
 * 
 * @param supervisorId - Supervisor updating
 * @param complaintId - Complaint ID
 * @param status - New status
 * @returns Updated complaint
 */
export async function updateComplaintStatus(
    supervisorId: number,
    complaintId: number,
    status: ComplaintStatus
): Promise<Complaint> {
    const complaint = await prisma.complaint.update({
        where: { id: complaintId },
        data: {
            status,
            ...(status === 'IN_REVIEW' && { resolvedById: supervisorId }),
        },
    });

    await prisma.auditLog.create({
        data: {
            action: 'COMPLAINT_STATUS_UPDATED',
            entityType: 'Complaint',
            entityId: complaintId,
            userId: supervisorId,
            userRole: 'SUPERVISOR',
            metadata: { newStatus: status },
        },
    });

    return complaint as unknown as Complaint;
}

/**
 * Resolve a complaint
 * 
 * @param supervisorId - Supervisor resolving
 * @param input - Resolution details
 * @returns Updated complaint
 */
export async function resolveComplaint(
    supervisorId: number,
    input: ComplaintResolveInput
): Promise<Complaint> {
    const { complaintId, action, resolutionNotes } = input;

    const complaint = await prisma.complaint.findUnique({
        where: { id: complaintId },
    });

    if (!complaint) {
        throw new ComplaintError('Complaint not found');
    }

    if (complaint.status === 'RESOLVED' || complaint.status === 'REJECTED') {
        throw new ComplaintError(
            'Complaint already resolved or rejected'
        );
    }

    const newStatus = action === 'RESOLVE' ? 'RESOLVED' : 'REJECTED';

    const updated = await prisma.complaint.update({
        where: { id: complaintId },
        data: {
            status: newStatus,
            resolutionNotes,
            resolvedAt: new Date(),
            resolvedById: supervisorId,
        },
    });

    await prisma.auditLog.create({
        data: {
            action: 'COMPLAINT_RESOLVED',
            entityType: 'Complaint',
            entityId: complaintId,
            userId: supervisorId,
            userRole: 'SUPERVISOR',
            metadata: {
                action,
                resolutionNotes,
            },
        },
    });

    return updated as unknown as Complaint;
}

// ============================================
// COMPLAINT QUERIES
// ============================================

/**
 * Get complaint by ID
 */
export async function getComplaintById(
    complaintId: number
): Promise<Complaint | null> {
    const complaint = await prisma.complaint.findUnique({
        where: { id: complaintId },
        include: {
            unit: {
                select: {
                    id: true,
                    unitNumber: true,
                    ward: true,
                },
            },
            collector: {
                select: {
                    id: true,
                    name: true,
                },
            },
            resolvedBy: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });

    return complaint as unknown as Complaint;
}

/**
 * Get complaints for a unit
 */
export async function getComplaintsForUnit(
    unitId: number
): Promise<Complaint[]> {
    const complaints = await prisma.complaint.findMany({
        where: { unitId },
        orderBy: { createdAt: 'desc' },
    });

    return complaints as unknown as Complaint[];
}

/**
 * Get open complaints
 */
export async function getOpenComplaints(
    ward?: string,
    raisedBy?: ComplaintRaisedBy
): Promise<Complaint[]> {
    const whereClause: Record<string, unknown> = {
        status: { in: ['OPEN', 'IN_REVIEW'] },
    };

    if (ward) {
        whereClause.unit = { ward };
    }

    if (raisedBy) {
        whereClause.raisedBy = raisedBy;
    }

    const complaints = await prisma.complaint.findMany({
        where: whereClause,
        include: {
            unit: {
                select: {
                    id: true,
                    unitNumber: true,
                    ward: true,
                },
            },
        },
        orderBy: { createdAt: 'asc' },
    });

    return complaints as unknown as Complaint[];
}

/**
 * Get all complaints with filters
 */
export async function getComplaints(filters?: {
    status?: ComplaintStatus;
    raisedBy?: ComplaintRaisedBy;
    complaintType?: ComplaintType;
    ward?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
}): Promise<{
    data: Complaint[];
    total: number;
    page: number;
    totalPages: number;
}> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const whereClause: Record<string, unknown> = {};

    if (filters?.status) whereClause.status = filters.status;
    if (filters?.raisedBy) whereClause.raisedBy = filters.raisedBy;
    if (filters?.complaintType) whereClause.complaintType = filters.complaintType;
    if (filters?.ward) whereClause.unit = { ward: filters.ward };

    if (filters?.startDate || filters?.endDate) {
        whereClause.createdAt = {};
        if (filters.startDate) {
            (whereClause.createdAt as Record<string, Date>).gte = filters.startDate;
        }
        if (filters.endDate) {
            (whereClause.createdAt as Record<string, Date>).lte = filters.endDate;
        }
    }

    const [data, total] = await Promise.all([
        prisma.complaint.findMany({
            where: whereClause,
            include: {
                unit: {
                    select: {
                        id: true,
                        unitNumber: true,
                        ward: true,
                    },
                },
            },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.complaint.count({ where: whereClause }),
    ]);

    return {
        data: data as unknown as Complaint[],
        total,
        page,
        totalPages: Math.ceil(total / limit),
    };
}

// ============================================
// COMPLAINT STATISTICS
// ============================================

/**
 * Get complaint statistics
 */
export async function getComplaintStats(ward?: string): Promise<{
    total: number;
    open: number;
    inReview: number;
    resolved: number;
    rejected: number;
    byType: Array<{ type: string; count: number }>;
    avgResolutionTime?: number;
}> {
    const whereClause = ward ? { unit: { ward } } : {};

    const [total, byStatus, byType] = await Promise.all([
        prisma.complaint.count({ where: whereClause }),
        prisma.complaint.groupBy({
            by: ['status'],
            where: whereClause,
            _count: true,
        }),
        prisma.complaint.groupBy({
            by: ['complaintType'],
            where: whereClause,
            _count: true,
        }),
    ]);

    const statusMap: Record<string, number> = {
        OPEN: 0,
        IN_REVIEW: 0,
        RESOLVED: 0,
        REJECTED: 0,
    };

    for (const s of byStatus) {
        statusMap[s.status] = s._count;
    }

    return {
        total,
        open: statusMap.OPEN,
        inReview: statusMap.IN_REVIEW,
        resolved: statusMap.RESOLVED,
        rejected: statusMap.REJECTED,
        byType: byType.map((t: { complaintType: any; _count: any; }) => ({
            type: t.complaintType,
            count: t._count,
        })),
    };
}

// ============================================
// CUSTOM ERROR CLASSES
// ============================================

export class ComplaintError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ComplaintError';
    }
}

export class ComplaintNotFoundError extends ComplaintError {
    constructor() {
        super('Complaint not found');
        this.name = 'ComplaintNotFoundError';
    }
}
