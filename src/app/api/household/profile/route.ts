// ============================================
// Smart Bin - Household Profile Route
// ============================================
// GET /api/household/profile
// ============================================

import { getProfileHandler } from '../handlers';

export async function GET(request: Request) {
    return getProfileHandler(request as any);
}
