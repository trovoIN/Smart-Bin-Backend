// ============================================
// Smart Bin - Household Complaint Create Route
// ============================================
// POST /api/household/complaint/create
// ============================================

import { createComplaintHandler } from '../../handlers';

export async function POST(request: Request) {
    return createComplaintHandler(request as any);
}
