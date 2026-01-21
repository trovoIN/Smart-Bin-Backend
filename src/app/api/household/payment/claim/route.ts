// ============================================
// Smart Bin - Payment Claim Route
// ============================================
// POST /api/household/payment/claim
// ============================================

import { claimPaymentHandler } from '../../handlers';

export async function POST(request: Request) {
    return claimPaymentHandler(request as any);
}
