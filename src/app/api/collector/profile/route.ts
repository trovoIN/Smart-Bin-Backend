// ============================================
// Smart Bin - Collector Profile Route
// ============================================
// GET /api/collector/profile
// ============================================

import { getProfileHandler, updateProfileHandler } from '../handlers';

export async function GET(request: Request) {
    return getProfileHandler(request as any);
}

export async function PUT(request: Request) {
    return updateProfileHandler(request as any);
}
