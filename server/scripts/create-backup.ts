
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import fs from 'fs/promises';
import { connectDatabase } from '../src/config/database.js';
import { DatabaseBackup } from '../src/models/DatabaseBackup.model.js';
import { logger } from '../src/utils/logger.js';

// Setup environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const BACKUP_DIR = path.join(__dirname, '../backups');

async function createBackup() {
    try {
        console.log('Connecting to database...');
        await connectDatabase();

        await fs.mkdir(BACKUP_DIR, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup-${timestamp}.json`;
        const filePath = path.join(BACKUP_DIR, filename);

        console.log(`Starting backup: ${filename}`);

        const db = mongoose.connection.db;
        if (!db) throw new Error('Database not connected');

        const collectionNames = await db.listCollections().toArray();
        const backupData: any = {};

        for (const { name } of collectionNames) {
            console.log(`Backing up collection: ${name}`);
            const collection = db.collection(name);
            const data = await collection.find({}).toArray();
            backupData[name] = data;
        }

        // Write to file
        await fs.writeFile(filePath, JSON.stringify(backupData, null, 2));
        const stats = await fs.stat(filePath);

        // Create record
        const backup = new DatabaseBackup({
            filename,
            filePath,
            backupType: 'manual',
            status: 'completed',
            collections: Object.keys(backupData),
            startedAt: new Date(),
            completedAt: new Date(),
            fileSize: stats.size,
            createdBy: 'system-script',
            retentionDays: 30,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });

        await backup.save();

        console.log(`\nBackup completed successfully!`);
        console.log(`File: ${filePath}`);
        console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

        process.exit(0);
    } catch (error) {
        console.error('Backup failed:', error);
        process.exit(1);
    }
}

createBackup();
