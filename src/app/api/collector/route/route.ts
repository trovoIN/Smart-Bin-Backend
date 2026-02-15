// ============================================
// Smart Bin - Collector Route (Today's Work)
// ============================================
// GET /api/collector/route
// ============================================

import { getRouteHandler } from '../handlers';

export async function GET(request: Request) {
    return getRouteHandler(request as any);
}
