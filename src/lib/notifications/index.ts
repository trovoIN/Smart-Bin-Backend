import { NotificationChannel, NotificationRequest } from './types';
import { NotificationTemplates } from './templates';
import { MockSMSProvider } from './providers/sms';
import { MockWhatsAppProvider } from './providers/whatsapp';
import { MockPushProvider } from './providers/push';

// Provider Registry
const providers = {
    SMS: new MockSMSProvider(),
    WHATSAPP: new MockWhatsAppProvider(),
    PUSH: new MockPushProvider(),
    EMAIL: new MockSMSProvider(), // Fallback to SMS logger for now
};

export class NotificationService {
    private static instance: NotificationService;

    private constructor() { }

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    /**
     * Send general notification
     */
    async send(request: NotificationRequest): Promise<void> {
        const { channels, data, phone, userId } = request;

        // Resolve template message
        // Ideally look up template by ID from templates.ts, but for now assuming data.message is passed or using a resolver
        // Simplified:
        const message = data.message || `Notification Template: ${request.templateId}`;

        const promises = channels.map((channel: NotificationChannel) => {
            const provider = providers[channel];
            if (provider && phone) {
                return provider.send(phone, message);
            }
            return Promise.resolve(false);
        });

        await Promise.all(promises);
    }

    /**
     * Send OTP specifically
     */
    async sendOTP(phone: string, otp: string): Promise<void> {
        const message = `Your Smart Bin verification code is: ${otp}. Valid for 5 minutes.`;

        // Send via SMS (always) and WhatsApp (if enabled)
        await providers.SMS.send(phone, message);
        await providers.WHATSAPP.send(phone, message);
    }

    /**
     * Send Collection Confirmation
     */
    async sendCollectionConfirmation(phone: string, unitNumber: string): Promise<void> {
        const message = NotificationTemplates.COLLECTION_CONFIRMATION({ unitNumber });
        await providers.SMS.send(phone, message);
        await providers.WHATSAPP.send(phone, message);
    }
}

export const notificationService = NotificationService.getInstance();
