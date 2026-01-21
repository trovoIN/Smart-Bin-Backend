// ============================================
// Smart Bin - Resolve Complaint Route
// ============================================
// POST /api/dashboard/complaints/resolve
// ============================================

import { resolveComplaintHandler } from '../../handlers';

export async function POST(request: Request) {
    return resolveComplaintHandler(request as any);
}
