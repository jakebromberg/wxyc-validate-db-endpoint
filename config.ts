import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'LIBRARY_USER',
  'LIBRARY_PASSWORD', 
  'BASE_URL',
  'LOGIN_ENDPOINT',
  'SEARCH_ENDPOINT',
  'DEFAULT_SEARCH_STRING',
  'PORT',
  'DB_HOST',
  'SSH_HOST',
  'SSH_USERNAME',
  'SSH_PASSWORD'
] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Create a typed configuration object after validation
export const config = {
  LIBRARY_USER: process.env.LIBRARY_USER!,
  LIBRARY_PASSWORD: process.env.LIBRARY_PASSWORD!,
  BASE_URL: process.env.BASE_URL!,
  LOGIN_ENDPOINT: process.env.LOGIN_ENDPOINT!,
  SEARCH_ENDPOINT: process.env.SEARCH_ENDPOINT!,
  DEFAULT_SEARCH_STRING: process.env.DEFAULT_SEARCH_STRING!,
  PORT: parseInt(process.env.PORT!, 10),
  DB_HOST: process.env.DB_HOST!,
  SSH_HOST: process.env.SSH_HOST!,
  SSH_USERNAME: process.env.SSH_USERNAME!,
  SSH_PASSWORD: process.env.SSH_PASSWORD!,
} as const;

// Export the type for use in other files if needed
export type Config = typeof config; 