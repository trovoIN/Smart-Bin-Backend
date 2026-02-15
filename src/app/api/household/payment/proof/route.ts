// ============================================
// Smart Bin - Payment Proof Upload Route
// ============================================
// POST /api/household/payment/proof
// Upload payment proof (screenshot/UTR)
// ============================================

import { claimPaymentHandler } from '../../handlers';

export async function POST(request: Request) {
    return claimPaymentHandler(request as any);
}
