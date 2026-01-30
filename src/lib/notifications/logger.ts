import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'logs', 'notifications.log');

export function logNotification(channel: string, to: string, message: string) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${channel}] To: ${to} | Message: ${message}\n`;

    // Ensure logs dir exists
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.appendFileSync(LOG_FILE, logEntry);
    console.log(logEntry.trim()); // Also log to console
}
