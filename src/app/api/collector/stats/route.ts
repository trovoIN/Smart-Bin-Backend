// ============================================
// Smart Bin - Collector Stats Route
// ============================================
// GET /api/collector/stats
// ============================================

import { getStatsHandler } from '../handlers';

export async function GET(request: Request) {
    return getStatsHandler(request as any);
}
