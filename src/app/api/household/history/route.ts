// ============================================
// Smart Bin - Household Collection History Route
// ============================================
// GET /api/household/history
// ============================================

import { getHistoryHandler } from '../handlers';

export async function GET(request: Request) {
    return getHistoryHandler(request as any);
}
