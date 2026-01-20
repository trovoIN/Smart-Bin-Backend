// ============================================
// Smart Bin - TypeScript Type Definitions
// ============================================
// Central type definitions used throughout the backend.
// These types mirror the Prisma schema but are used for
// API requests/responses and internal logic.
// ============================================

// ============================================
// ENUMS - Mirror Prisma enums for type safety
// ============================================

/**
 * Collector status - whether they are currently active
 */
export enum CollectorStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
}

/**
 * QR Code lifecycle status
 * UNASSIGNED -> ACTIVE -> DEACTIVATED
 */
export enum QRStatus {
    UNASSIGNED = 'UNASSIGNED', // Generated, not yet attached to house
    ACTIVE = 'ACTIVE',          // Registered and in use
    DEACTIVATED = 'DEACTIVATED', // Damaged or replaced
}

/**
 * Payment status workflow:
 * UNPAID -> CLAIMED -> VERIFIED
 *                   -> DISPUTED -> VERIFIED/UNPAID
 */
export enum PaymentStatus {
    UNPAID = 'UNPAID',       // No payment claimed yet
    CLAIMED = 'CLAIMED',     // Household claims they paid
    VERIFIED = 'VERIFIED',   // Collector confirmed receipt
    DISPUTED = 'DISPUTED',   // Under supervisor review
}

/**
 * Complaint status workflow
 */
export enum ComplaintStatus {
    OPEN = 'OPEN',
    IN_REVIEW = 'IN_REVIEW',
    RESOLVED = 'RESOLVED',
    REJECTED = 'REJECTED',
}

/**
 * Who raised the complaint
 */
export enum ComplaintRaisedBy {
    HOUSEHOLD = 'HOUSEHOLD',
    COLLECTOR = 'COLLECTOR',
}

/**
 * Types of complaints that can be raised
 */
export enum ComplaintType {
    GARBAGE_NOT_COLLECTED = 'GARBAGE_NOT_COLLECTED',
    SERVICE_ISSUE = 'SERVICE_ISSUE',
    NON_PAYMENT = 'NON_PAYMENT',
    REPEATED_DEFAULTER = 'REPEATED_DEFAULTER',
    OTHER = 'OTHER',
}

/**
 * User roles for Role-Based Access Control (RBAC)
 * Each role has different permissions in the system
 */
export enum UserRole {
    ADMIN = 'ADMIN',           // Full access to everything
    SUPERVISOR = 'SUPERVISOR', // Ward-level access, can resolve disputes
    CONTRACTOR = 'CONTRACTOR', // Operations oversight
    GOVT = 'GOVT',             // View collections & complaints only
    COLLECTOR = 'COLLECTOR',   // Mobile app user
    HOUSEHOLD = 'HOUSEHOLD',   // PWA user
}

// ============================================
// JWT & AUTH TYPES
// ============================================

/**
 * Payload stored in JWT token
 */
export interface JWTPayload {
    sub: string;           // Subject (user ID or collector ID)
    role: UserRole;        // User's role for RBAC
    phone: string;         // Phone number
    type: 'access' | 'refresh'; // Token type
    iat?: number;          // Issued at (auto-added by JWT)
    exp?: number;          // Expiration (auto-added by JWT)
}

/**
 * Decoded JWT token after verification
 */
export interface DecodedToken extends JWTPayload {
    iat: number;
    exp: number;
}

/**
 * OTP request/response types
 */
export interface OTPRequest {
    phone: string;
    purpose: 'LOGIN' | 'VERIFY_PAYMENT' | 'REGISTER';
}

export interface OTPVerification {
    phone: string;
    code: string;
    purpose: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Standard API response wrapper
 */
export interface APIResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
        hasMore?: boolean;
    };
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

// ============================================
// COLLECTOR TYPES
// ============================================

export interface Collector {
    id: number;
    name: string;
    phone: string;
    upiId: string;
    assignedRoute?: string;
    status: CollectorStatus;
    createdAt: Date;
    updatedAt: Date;
}

export interface CollectorCreateInput {
    name: string;
    phone: string;
    upiId: string;
    assignedRoute?: string;
}

export interface CollectorUpdateInput {
    name?: string;
    upiId?: string;
    assignedRoute?: string;
    status?: CollectorStatus;
}

// ============================================
// QR CODE TYPES
// ============================================

export interface QRCode {
    id: number;
    secureToken: string;
    status: QRStatus;
    createdAt: Date;
    activatedAt?: Date;
}

export interface QRGenerateRequest {
    count: number;     // Number of QR codes to generate
    prefix?: string;   // Optional prefix for batch identification
}

export interface QRResolveResponse {
    status: QRStatus;
    // If UNASSIGNED - only status returned
    // If ACTIVE - unit details included
    unit?: {
        id: number;
        unitNumber: string;
        phoneNumber: string;  // Only visible to collector
        lastCollectedAt?: Date;
        paymentStatus: PaymentStatus;
        collectorName: string;
    };
}

// ============================================
// UNIT (HOUSE) TYPES
// ============================================

export interface Unit {
    id: number;
    unitNumber: string;
    householdPhone: string;
    ward?: string;
    qrId: number;
    collectorId: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface UnitRegisterInput {
    qrToken: string;      // Scanned QR token
    unitNumber: string;   // House/flat number
    householdPhone: string;
}

export interface UnitWithDetails extends Unit {
    collector: {
        id: number;
        name: string;
    };
    lastCollection?: Date;
    paymentStatus?: PaymentStatus;
}

// ============================================
// COLLECTION TYPES
// ============================================

export interface Collection {
    id: number;
    unitId: number;
    collectorId: number;
    collectedAt: Date;
    latitude?: number;
    longitude?: number;
    syncedAt?: Date;
}

export interface CollectionMarkInput {
    unitId: number;
    collectedAt?: Date;    // Optional, defaults to now
    latitude?: number;
    longitude?: number;
}

export interface CollectionHistory {
    date: Date;
    status: 'COLLECTED' | 'MISSED';
    collectorName?: string;
}

// ============================================
// PAYMENT TYPES
// ============================================

export interface Payment {
    id: number;
    unitId: number;
    month: string;         // "YYYY-MM" format
    amount: number;
    status: PaymentStatus;
    proofUrl?: string;
    transactionRef?: string;
    rejectionReason?: string;
    claimedAt?: Date;
    verifiedAt?: Date;
    disputedAt?: Date;
    resolvedAt?: Date;
    verifiedById?: number;
}

export interface PaymentClaimInput {
    unitId: number;
    month: string;
    proofUrl?: string;
    transactionRef?: string;
}

export interface PaymentVerifyInput {
    paymentId: number;
    action: 'CONFIRM' | 'REJECT';
    rejectionReason?: string;  // Required if action is REJECT
}

export interface PaymentWithUnit extends Payment {
    unit: {
        id: number;
        unitNumber: string;
        ward?: string;
    };
}

// ============================================
// COMPLAINT TYPES
// ============================================

export interface Complaint {
    id: number;
    unitId?: number;
    collectorId?: number;
    complaintType: ComplaintType;
    raisedBy: ComplaintRaisedBy;
    description?: string;
    imageUrl?: string;
    status: ComplaintStatus;
    resolutionNotes?: string;
    createdAt: Date;
    resolvedAt?: Date;
    resolvedById?: number;
}

export interface ComplaintCreateInput {
    unitId?: number;
    complaintType: ComplaintType;
    description?: string;
    imageUrl?: string;
}

export interface ComplaintResolveInput {
    complaintId: number;
    action: 'RESOLVE' | 'REJECT';
    resolutionNotes: string;
}

// ============================================
// USER TYPES
// ============================================

export interface User {
    id: number;
    name: string;
    phone: string;
    email?: string;
    role: UserRole;
    assignedWard?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;
}

export interface UserCreateInput {
    name: string;
    phone: string;
    email?: string;
    role: UserRole;
    assignedWard?: string;
    password?: string;  // Optional, for password-based login
}

// ============================================
// DASHBOARD TYPES
// ============================================

export interface DashboardOverview {
    totalUnits: number;
    collectedToday: number;
    missedToday: number;
    activeCollectors: number;
    openComplaints: number;
    pendingPayments: number;
}

export interface CollectionReport {
    date: string;
    ward?: string;
    totalUnits: number;
    collected: number;
    missed: number;
    percentage: number;
}

// ============================================
// SYNC TYPES (for offline support)
// ============================================

export interface SyncAction {
    type: 'COLLECTION' | 'PAYMENT_VERIFY' | 'COMPLAINT';
    payload: unknown;
    timestamp: Date;
    localId?: string;  // Client-side ID for deduplication
}

export interface SyncRequest {
    actions: SyncAction[];
}

export interface SyncResponse {
    synced: number;
    failed: number;
    errors?: Array<{
        localId?: string;
        error: string;
    }>;
}

// ============================================
// AUDIT LOG TYPES
// ============================================

export interface AuditLog {
    id: number;
    action: string;
    entityType: string;
    entityId: number;
    userId?: number;
    userRole?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    createdAt: Date;
}
