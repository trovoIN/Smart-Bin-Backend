// ============================================
// Smart Bin - Unit Registration Route
// ============================================
// POST /api/collector/unit/register
// ============================================

import { unitRegisterHandler } from '../../handlers';

export async function POST(request: Request) {
    return unitRegisterHandler(request as any);
}
