// ============================================
// Smart Bin - Dashboard Payments Route
// ============================================
// GET /api/dashboard/payments
// ============================================

import { getPaymentsHandler } from '../handlers';

export async function GET(request: Request) {
  return getPaymentsHandler(request as any);
}
