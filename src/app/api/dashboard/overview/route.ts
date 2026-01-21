// ============================================
// Smart Bin - Dashboard Overview Route
// ============================================
// GET /api/dashboard/overview
// ============================================

import { getOverviewHandler } from '../handlers';

export async function GET(request: Request) {
    return getOverviewHandler(request as any);
}
