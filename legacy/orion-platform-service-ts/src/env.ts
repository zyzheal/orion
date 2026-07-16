/**
 * Load .env file before any other imports that depend on process.env
 * tsx watch doesn't load .env automatically
 */
import * as fs from 'fs';
import * as path from 'path';

try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim();
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
} catch {
  // Silently ignore - env vars can be set in environment
}
