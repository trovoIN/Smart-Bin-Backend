// ============================================
// Smart Bin - Request OTP API Route
// ============================================
// POST /api/auth/request-otp
// ============================================

import { requestOTPHandler } from '../handlers';

export async function POST(request: Request) {
    // Cast to NextRequest for type compatibility
    return requestOTPHandler(request as any);
}
