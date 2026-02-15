// ============================================
// Smart Bin - Payment History Route
// ============================================
// GET /api/household/payment/history
// ============================================

import { getPaymentHistoryHandler } from '../../handlers';

export async function GET(request: Request) {
    return getPaymentHistoryHandler(request as any);
}
