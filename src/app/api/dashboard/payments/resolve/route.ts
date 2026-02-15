// ============================================
// Smart Bin - Resolve Dispute Route
// ============================================
// POST /api/dashboard/payments/resolve
// ============================================

import { resolveDisputeHandler } from '../../handlers';

export async function POST(request: Request) {
    return resolveDisputeHandler(request as any);
}
