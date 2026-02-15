// ============================================
// Smart Bin - Verify OTP API Route
// ============================================
// POST /api/auth/verify-otp
// ============================================

import { verifyOTPHandler } from '../handlers';

export async function POST(request: Request) {
    return verifyOTPHandler(request as any);
}
