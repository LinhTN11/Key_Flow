import type { AppBackup } from '../services/db';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function parseAppBackup(text: string): AppBackup {
    const data = JSON.parse(text) as unknown;
    if (!isRecord(data)
        || data.format !== 'keyflow-app-backup'
        || data.version !== 1
        || !isRecord(data.settings)
        || !Array.isArray(data.patterns)
        || !Array.isArray(data.sessions)
        || !Array.isArray(data.attempts)
    ) {
        throw new Error('Invalid KeyFlow backup file');
    }

    return data as AppBackup;
}
