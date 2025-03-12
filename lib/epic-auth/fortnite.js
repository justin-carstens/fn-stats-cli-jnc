import { EpicEndpoints } from './endpoints.js';
import { getBattlePassLevels } from './util.js';

/**
 * Manager for Fortnite-specific API calls
 * Focused on stats and battle royale functionality
 */
export class FortniteManager {
    // Auth manager reference for making API calls
    auth;
    
    // Season length for battle pass stats
    seasonsLength;
    
    /**
     * Creates a new FortniteManager
     * @param {object} auth - EpicAuthManager instance
     * @param {number} [seasonsLength=26] - Number of seasons to track for battle pass stats
     */
    constructor(auth, seasonsLength = 26) {
        this.auth = auth;
        this.seasonsLength = seasonsLength;
    }
    
    /**
     * Gets Battle Royale inventory for an account
     * @param {string} [accountId] - Account ID (defaults to authenticated user)
     * @returns {Promise<object>} - BR inventory data
     */
    getBRInventory(accountId = this.auth.getAccountId()) {
        return this.auth.get(EpicEndpoints.BRInventory(accountId));
    }
    
    /**
     * Gets stats for multiple accounts and/or stats types
     * @param {object} [options={}] - Query options
     * @param {string[]} [options.accountIds] - List of account IDs
     * @param {string[]} [options.stats] - List of stat names
     * @returns {Promise<object>} - Bulk stats response
     */
    getBulkStats(options = {}) {
        const accountIds = options.accountIds ?? [this.auth.getAccountId()];
        // If stats aren't provided, default to battle pass levels
        const stats=['br_matchesplayed'];
        //const stats = options.stats ?? getBattlePassLevels(this.seasonsLength);
        
        if (stats.length === 0)
            throw new TypeError('At least one stat must be included.');
        
        return this.auth.method('POST', EpicEndpoints.BulkStats(), {
            appId: 'fortnite',
            startDate: 0,
            endDate: 0,
            owners: accountIds,
            stats
        });
    }
    
    /**
     * Gets the current item shop catalog
     * @returns {Promise<object>} - Catalog data
     */
    getCatalog() {
        return this.auth.get(EpicEndpoints.Catalog());
    }
    
    /**
     * Gets a specific collection of stats
     * @param {string} collection - Collection name
     * @param {string[]} [accountIds] - List of account IDs
     * @returns {Promise<object>} - Collection stats
     */
    getCollection(collection, accountIds) {
        accountIds ??= [this.auth.getAccountId()];
        return this.auth.method('POST', EpicEndpoints.BulkStats(collection), {
            appId: 'fortnite',
            startDate: 0,
            endDate: 0,
            owners: accountIds
        });
    }
    
    /**
     * Gets enabled features in Fortnite
     * @returns {Promise<object>} - Enabled features
     */
    getEnabledFeatures() {
        return this.auth.get(EpicEndpoints.EnabledFeatures());
    }
    
    /**
     * Gets friend codes (e.g., for STW)
     * @param {string} codeType - Type of friend code
     * @param {string} [accountId] - Account ID (defaults to authenticated user)
     * @returns {Promise<object>} - Friend codes
     */
    getFriendCodes(codeType, accountId = this.auth.getAccountId()) {
        return this.auth.get(EpicEndpoints.FriendCodes(accountId, codeType));
    }
    
    /**
     * Gets encryption keys for game assets
     * @returns {Promise<object>} - Keychain data
     */
    getKeychain() {
        return this.auth.get(EpicEndpoints.Keychain());
    }
    
    /**
     * Gets purchase receipts for an account
     * @param {string} [accountId] - Account ID (defaults to authenticated user)
     * @returns {Promise<object>} - Receipt data
     */
    getReceipts(accountId = this.auth.getAccountId()) {
        return this.auth.get(EpicEndpoints.Receipts(accountId));
    }
    
    /**
     * Gets standard stats for an account
     * @param {string} [accountId] - Account ID (defaults to authenticated user)
     * @param {object} [timeWindow={}] - Time constraints for stats
     * @returns {Promise<object>} - Stats data
     */
    getStats(accountId = this.auth.getAccountId(), timeWindow = {}) {
        return this.auth.get(EpicEndpoints.Stats(accountId, timeWindow));
    }
    
    /**
     * Gets Save the World world info
     * @returns {Promise<object>} - STW world info
     */
    getSTWWorldInfo() {
        return this.auth.get(EpicEndpoints.STWWorldInfo());
    }
    
    /**
     * Gets the current game timeline (seasons, events, etc.)
     * @returns {Promise<object>} - Timeline data
     */
    getTimeline() {
        return this.auth.get(EpicEndpoints.Timeline());
    }
    
    /**
     * Gets details for a specific track (challenges, quests)
     * @param {string} trackguid - Track GUID
     * @returns {Promise<object>} - Track data
     */
    getTrack(trackguid) {
        return this.auth.get(EpicEndpoints.Track('fortnite', trackguid));
    }
    
    /**
     * Gets all available tracks (challenges, quests)
     * @returns {Promise<object>} - All tracks data
     */
    getTracks() {
        return this.auth.get(EpicEndpoints.TracksQuery('fortnite'));
    }
    
    /**
     * Gets progress on tracks (challenges, quests)
     * @param {object} [options={}] - Options
     * @param {string} [options.accountId] - Account ID
     * @param {string} [options.trackguid] - Track GUID
     * @returns {Promise<object>} - Track progress
     */
    getTrackProgress(options = {}) {
        const { accountId = this.auth.getAccountId(), trackguid } = options;
        return trackguid === undefined
            ? this.auth.get(EpicEndpoints.TracksProgress('fortnite', accountId))
            : this.auth.get(EpicEndpoints.TrackProgress('fortnite', accountId, trackguid));
    }
    
    /**
     * Executes a MCP (Fortnite backend) operation
     * @param {string} operation - Operation name
     * @param {string} profileId - Profile ID
     * @param {object} [payload={}] - Operation payload
     * @param {string} [route='client'] - Route
     * @param {string} [accountId] - Account ID
     * @returns {Promise<object>} - Operation result
     */
    postMCPOperation(operation, profileId, payload = {}, route = 'client', accountId = this.auth.getAccountId()) {
        return this.auth.method('POST', EpicEndpoints.MCP(accountId, operation, route, profileId), payload);
    }
}
