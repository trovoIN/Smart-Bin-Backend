// ============================================
// Smart Bin - QR Resolve Route
// ============================================
// POST /api/collector/qr/resolve
// ============================================

import { qrResolveHandler } from '../../handlers';

export async function POST(request: Request) {
    return qrResolveHandler(request as any);
}
