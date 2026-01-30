import { NotificationProvider } from '../types';
import { logNotification } from '../logger';

export class MockSMSProvider implements NotificationProvider {
    async send(to: string, message: string): Promise<boolean> {
        logNotification('SMS', to, message);
        return true;
    }
}
