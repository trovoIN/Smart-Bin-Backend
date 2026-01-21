// ============================================
// Smart Bin - Collector Profile Route
// ============================================
// GET /api/collector/profile
// ============================================

import { getProfileHandler } from '../handlers';

export async function GET(request: Request) {
    return getProfileHandler(request as any);
}
