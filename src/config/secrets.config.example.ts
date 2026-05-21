// Copy this file to secrets.config.ts and fill in your API keys/secrets
// DO NOT commit secrets.config.ts to git!

export const SECRETS = {
  // Add any API keys or secrets here
  // Example:
  // ANTHROPIC_API_KEY: 'sk-ant-your-key-here',
  // OPENAI_API_KEY: 'sk-your-key-here',
  // EBAY_API_KEY: 'your-ebay-api-key',
  // AMAZON_ACCESS_KEY: 'your-amazon-access-key',
} as const;

export type SecretKey = keyof typeof SECRETS;

/*
 * SECURITY BEST PRACTICES:
 * 
 * 1. Never hardcode secrets in source files
 * 2. Use this config file for any API keys or tokens
 * 3. The secrets.config.ts file is gitignored
 * 4. Only secrets.config.example.ts (this file) is committed
 * 
 * HOW TO USE:
 * 1. Copy this file to secrets.config.ts
 * 2. Fill in your actual API keys
 * 3. Import in your code: import { SECRETS } from '../config/secrets.config'
 * 4. Access like: SECRETS.ANTHROPIC_API_KEY
 * 
 * NOTE: For browser extension user-entered keys (like Anthropic API key),
 * use chrome.storage instead - see src/services/storage.ts
 */
