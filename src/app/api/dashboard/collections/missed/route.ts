// ============================================
// Smart Bin - Missed Collections Route
// ============================================
// GET /api/dashboard/collections/missed
// ============================================

import { getMissedCollectionsHandler } from '../../handlers';

export async function GET(request: Request) {
    return getMissedCollectionsHandler(request as any);
}
