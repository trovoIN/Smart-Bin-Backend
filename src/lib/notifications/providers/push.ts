import { NotificationProvider } from '../types';
import { logNotification } from '../logger';

export class MockPushProvider implements NotificationProvider {
    async send(to: string, message: string): Promise<boolean> {
        logNotification('PUSH', to, message);
        return true;
    }
}
