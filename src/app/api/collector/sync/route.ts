// ============================================
// Smart Bin - Offline Sync Route
// ============================================
// POST /api/collector/sync
// ============================================

import { syncHandler } from '../handlers';

export async function POST(request: Request) {
    return syncHandler(request as any);
}
