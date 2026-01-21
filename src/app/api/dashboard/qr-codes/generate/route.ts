// ============================================
// Smart Bin - Generate QR Codes Route
// ============================================
// POST /api/dashboard/qr-codes/generate
// ============================================

import { generateQRCodesHandler } from '../../handlers';

export async function POST(request: Request) {
    return generateQRCodesHandler(request as any);
}
