import fs from 'fs/promises';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'logs', 'notifications.log');

export async function logNotification(channel: string, to: string, message: string) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${channel}] To: ${to} | Message: ${message}\n`;

    try {
        // Ensure logs dir exists
        const dir = path.dirname(LOG_FILE);
        await fs.mkdir(dir, { recursive: true });

        // Append to log file asynchronously
        await fs.appendFile(LOG_FILE, logEntry);
        console.log(logEntry.trim()); // Also log to console
    } catch (error) {
        // If logging fails, at least log to console
        console.error('Failed to write notification log:', error);
        console.log(logEntry.trim());
    }
}
