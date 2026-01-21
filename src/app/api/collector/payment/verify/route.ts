// ============================================
// Smart Bin - Verify Payment Route
// ============================================
// POST /api/collector/payment/verify
// ============================================

import { verifyPaymentHandler } from '../../handlers';

export async function POST(request: Request) {
    return verifyPaymentHandler(request as any);
}
