import { NotificationProvider } from '../types';
import { logNotification } from '../logger';

export class MockWhatsAppProvider implements NotificationProvider {
    async send(to: string, message: string): Promise<boolean> {
        logNotification('WHATSAPP', to, message);
        return true;
    }
}
