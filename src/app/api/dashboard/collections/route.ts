// ============================================
// Smart Bin - Dashboard Collections Route
// ============================================
// GET /api/dashboard/collections
// ============================================

import { getCollectionsHandler } from '../handlers';

export async function GET(request: Request) {
    return getCollectionsHandler(request as any);
}
