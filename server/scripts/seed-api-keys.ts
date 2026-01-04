/**
 * Script to seed API keys to database
 * Usage: npm run seed-api-keys
 * 
 * IMPORTANT: Run this ONCE to migrate API keys from environment variables to database.
 * After running, remove the API keys from your .env file for security.
 */

import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { apiKeyManagement } from '../src/services/apiKeyManagement.service.js';

// Define the API keys to seed
// REPLACE THESE WITH YOUR ACTUAL API KEYS
const API_KEYS_TO_SEED = [
    {
        provider: 'gemini' as const,
        keyName: 'Primary Gemini Key',
        value: process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY',
        metadata: {
            description: 'Main Gemini API key for AI operations',
            enabledEnvironments: ['development', 'staging', 'production']
        }
    },
    // Add more providers as needed:
    // {
    //   provider: 'openai' as const,
    //   keyName: 'Primary OpenAI Key',
    //   value: process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY',
    //   metadata: { description: 'Main OpenAI API key' }
    // },
    // {
    //   provider: 'e2b' as const,
    //   keyName: 'E2B Sandbox Key',
    //   value: process.env.E2B_API_KEY || 'YOUR_E2B_API_KEY',
    //   metadata: { description: 'E2B code sandbox API key' }
    // },
];

async function seedApiKeys() {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || config.mongodbUri;
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Get or create a system user ID for seeding
        const { User } = await import('../src/models/User.model.js');
        let systemUser = await User.findOne({ email: 'system@orbitai.local' });

        if (!systemUser) {
            // Create system user if it doesn't exist
            systemUser = await User.create({
                email: 'system@orbitai.local',
                name: 'System',
                password: 'not-for-login-' + Date.now(),
                role: 'superadmin',
                isVerified: true
            });
            console.log('✅ Created system user for API key ownership');
        }

        console.log(`\n📦 Seeding ${API_KEYS_TO_SEED.length} API keys...\n`);

        for (const keyData of API_KEYS_TO_SEED) {
            // Skip if the value is a placeholder
            if (keyData.value.startsWith('YOUR_') || !keyData.value) {
                console.log(`  ⚠️  Skipped: ${keyData.provider} (no valid key provided)`);
                continue;
            }

            try {
                const result = await apiKeyManagement.createApiKey(
                    {
                        provider: keyData.provider,
                        keyName: keyData.keyName,
                        value: keyData.value,
                        metadata: keyData.metadata
                    },
                    systemUser._id.toString()
                );
                console.log(`  ✅ Created: ${keyData.provider} - ${keyData.keyName} (ID: ${result.id})`);
            } catch (error: any) {
                if (error.message?.includes('already exists')) {
                    console.log(`  ℹ️  Exists: ${keyData.provider} - ${keyData.keyName}`);
                } else {
                    console.error(`  ❌ Failed: ${keyData.provider} - ${error.message}`);
                }
            }
        }

        console.log('\n✅ API key seeding complete!');
        console.log('\n⚠️  IMPORTANT: Now remove the API keys from your .env file for security.');
        console.log('   The keys are now stored encrypted in the database.\n');

        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
        process.exit(0);
    } catch (error: any) {
        console.error('❌ Error seeding API keys:', error.message);
        await mongoose.disconnect().catch(() => { });
        process.exit(1);
    }
}

seedApiKeys();
