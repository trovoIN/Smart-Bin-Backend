// ============================================
// Smart Bin - Dashboard Collectors Route
// ============================================
// GET /api/dashboard/collectors - List
// POST /api/dashboard/collectors - Create
// ============================================

import { getCollectorsHandler, createCollectorHandler } from '../handlers';

export async function GET(request: Request) {
    return getCollectorsHandler(request as any);
}

export async function POST(request: Request) {
    return createCollectorHandler(request as any);
}
