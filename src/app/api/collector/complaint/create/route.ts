// ============================================
// Smart Bin - Collector Complaint Route
// ============================================
// POST /api/collector/complaint/create
// ============================================

import { createComplaintHandler } from '../../handlers';

export async function POST(request: Request) {
    return createComplaintHandler(request as any);
}
