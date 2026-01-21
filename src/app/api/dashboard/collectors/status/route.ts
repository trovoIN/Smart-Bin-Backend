// ============================================
// Smart Bin - Collector Status Update Route
// ============================================
// PATCH /api/dashboard/collectors/status
// ============================================

import { updateCollectorStatusHandler } from '../../handlers';

export async function PATCH(request: Request) {
    return updateCollectorStatusHandler(request as any);
}
