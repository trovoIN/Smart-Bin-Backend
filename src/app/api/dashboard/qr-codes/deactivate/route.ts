// ============================================
// Smart Bin - Deactivate QR Code Route
// ============================================
// POST /api/dashboard/qr-codes/deactivate
// ============================================

import { deactivateQRHandler } from '../../handlers';

export async function POST(request: Request) {
    return deactivateQRHandler(request as any);
}
