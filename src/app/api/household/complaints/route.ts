// ============================================
// Smart Bin - Household Complaints Route
// ============================================
// GET /api/household/complaints
// ============================================

import { getComplaintsHandler } from '../handlers';

export async function GET(request: Request) {
    return getComplaintsHandler(request as any);
}
