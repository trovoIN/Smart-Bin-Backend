// ============================================
// Smart Bin - QR Codes Route
// ============================================
// GET /api/dashboard/qr-codes - List
// ============================================

import { getQRCodesHandler } from '../handlers';

export async function GET(request: Request) {
    return getQRCodesHandler(request as any);
}
