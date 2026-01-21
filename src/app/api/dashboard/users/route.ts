// ============================================
// Smart Bin - Dashboard Users Route
// ============================================
// GET /api/dashboard/users - List
// POST /api/dashboard/users - Create
// ============================================

import { getUsersHandler, createUserHandler } from '../handlers';

export async function GET(request: Request) {
    return getUsersHandler(request as any);
}

export async function POST(request: Request) {
    return createUserHandler(request as any);
}
