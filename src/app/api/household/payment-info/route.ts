// ============================================
// Smart Bin - Payment Info Route
// ============================================
// GET /api/household/payment-info
// Returns payment status + collector details
// ============================================

import { getPaymentInfoHandler } from '../handlers';

export async function GET(request: Request) {
    return getPaymentInfoHandler(request as any);
}
