// ============================================
// Smart Bin - Mark Collection Route
// ============================================
// POST /api/collector/collection/mark
// ============================================

import { markCollectionHandler } from '../../handlers';

export async function POST(request: Request) {
    return markCollectionHandler(request as any);
}
