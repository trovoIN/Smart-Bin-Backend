// ============================================
// Smart Bin - Defaulters Route
// ============================================
// GET /api/dashboard/payments/defaulters
// ============================================

import { getDefaultersHandler } from '../../handlers';

export async function GET(request: Request) {
    return getDefaultersHandler(request as any);
}
