// ============================================
// Smart Bin - Dashboard Complaints Route
// ============================================
// GET /api/dashboard/complaints
// ============================================

import { getComplaintsHandler } from '../handlers';

export async function GET(request: Request) {
    return getComplaintsHandler(request as any);
}
