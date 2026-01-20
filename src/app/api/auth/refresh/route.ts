// ============================================
// Smart Bin - Token Refresh API Route
// ============================================
// POST /api/auth/refresh
// ============================================

import { refreshTokenHandler } from '../handlers';

export async function POST(request: Request) {
    return refreshTokenHandler(request as any);
}
