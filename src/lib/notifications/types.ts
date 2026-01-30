export type NotificationChannel = 'SMS' | 'WHATSAPP' | 'PUSH' | 'EMAIL';

export interface NotificationProvider {
    send(to: string, message: string, metadata?: any): Promise<boolean>;
}

export interface NotificationRequest {
    userId?: number;
    phone?: string;
    email?: string;
    channels: NotificationChannel[];
    templateId: string;
    data: Record<string, any>;
}
