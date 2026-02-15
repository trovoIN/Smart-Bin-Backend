// ============================================
// Smart Bin - UPI Details Route
// ============================================
// GET /api/household/payment/upi
// ============================================

import { getUPIDetailsHandler } from '../../handlers';

export async function GET(request: Request) {
    return getUPIDetailsHandler(request as any);
}
