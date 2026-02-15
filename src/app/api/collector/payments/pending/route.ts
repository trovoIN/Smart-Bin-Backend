// ============================================
// Smart Bin - Pending Payments Route
// ============================================
// GET /api/collector/payments/pending
// ============================================

import { getPendingPaymentsHandler } from '../../handlers';

export async function GET(request: Request) {
    return getPendingPaymentsHandler(request as any);
}
