// ============================================
// Smart Bin - Collector Status Update Route
// ============================================
// GET /api/dashboard/collectors/status - Get all collector statuses
// PATCH /api/dashboard/collectors/status - Update collector status
// ============================================

import { updateCollectorStatusHandler, getCollectorStatusesHandler } from '../../handlers';

export async function GET(request: Request) {
    return getCollectorStatusesHandler(request as any);
}

export async function PATCH(request: Request) {
    return updateCollectorStatusHandler(request as any);
}
