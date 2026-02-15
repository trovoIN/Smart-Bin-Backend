// ============================================
// Smart Bin - Password Login API Route
// ============================================
// POST /api/auth/login
// ============================================

import { passwordLoginHandler } from '../handlers';

export async function POST(request: Request) {
    // Cast to NextRequest for type compatibility
    return passwordLoginHandler(request as any);
}
