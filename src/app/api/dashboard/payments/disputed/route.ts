// ============================================
// Smart Bin - Disputed Payments Route
// ============================================
// GET /api/dashboard/payments/disputed
// ============================================

import { getDisputedPaymentsHandler } from '../../handlers';

export async function GET(request: Request) {
    return getDisputedPaymentsHandler(request as any);
}
