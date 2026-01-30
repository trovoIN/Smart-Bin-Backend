import { getDashboardHandler } from '../handlers';

export async function GET(request: Request) {
    return getDashboardHandler(request as any);
}
