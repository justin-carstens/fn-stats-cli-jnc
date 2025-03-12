import { EpicAuthManager } from './auth.js';
import { EpicEndpoints } from './endpoints.js';
import { FortniteManager } from './fortnite.js';

/**
 * Simplified Epic client that includes only essential functionality
 * for Fortnite stats projects
 */
export class EpicClient {
    // Main components
    auth;
    fortnite;
    
    /**
     * Creates a new Epic client
     * @param {object} [options={}] - Client options
     * @param {boolean} [options.autoRefresh=false] - Whether to auto-refresh tokens
     * @param {string} [options.gameClient] - Custom game client credentials
     */
    constructor(options = {}) {
        this.auth = new EpicAuthManager(options.autoRefresh ?? false, options.gameClient);
        this.fortnite = new FortniteManager(this.auth);
    }
    
    /**
     * Gets account details by display name
     * @param {string} displayName - Epic display name
     * @returns {Promise<object>} - Account data
     */
    getAccountByDisplayName(displayName) {
        return this.auth.get(EpicEndpoints.AccountByDisplayName(displayName));
    }
    
    /**
     * Gets account details by ID
     * @param {string} [accountId] - Account ID (defaults to authenticated user)
     * @returns {Promise<object>} - Account data
     */
    getAccountById(accountId = this.auth.getAccountId()) {
        return this.auth.get(EpicEndpoints.AccountById(accountId));
    }
}

// Export all classes and utilities
export { EpicAuthManager } from './auth.js';
export { EpicEndpoints } from './endpoints.js';
export { EpicAPIError } from './error.js';
export { FortniteManager } from './fortnite.js';
export { FortniteGameClient, getBattlePassLevels } from './util.js';
