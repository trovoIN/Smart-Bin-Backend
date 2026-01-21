// ============================================
// Smart Bin - Payment Status Route
// ============================================
// GET /api/household/payment/status
// ============================================

import { getPaymentStatusHandler } from '../../handlers';

export async function GET(request: Request) {
    return getPaymentStatusHandler(request as any);
}
