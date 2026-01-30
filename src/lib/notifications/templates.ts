type TemplateFunction = (data: any) => string;

export const NotificationTemplates = {
    OTP_LOGIN: (data: { otp: string }) => `Your Smart Bin verification code is: ${data.otp}. Valid for 5 minutes.`,
    COLLECTION_REMINDER: (data: { date: string }) => `Reminder: Garbage collection is scheduled for tomorrow ${data.date}. Please keep your bin ready.`,
    PAYMENT_DUE: (data: { amount: number, month: string }) => `Dear User, your bill of Rs.${data.amount} for ${data.month} is due. Please pay to avoid service interruption.`,
    PAYMENT_RECEIVED: (data: { amount: number, month: string }) => `Payment of Rs.${data.amount} for ${data.month} received successfully. Thank you!`,
    COMPLAINT_UPDATE: (data: { id: string, status: string }) => `Your complaint #${data.id} is now ${data.status}. Check app for details.`,
    COLLECTION_CONFIRMATION: (data: { unitNumber: string }) => `Waste collected for Unit ${data.unitNumber}. Thank you for keeping the city clean!`,
};
