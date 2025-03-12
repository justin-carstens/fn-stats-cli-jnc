/**
 * Collection of Epic API endpoints
 * Each method returns a URL string for a specific API endpoint
 */
export const EpicEndpoints = {
    /**
     * Get the token endpoint URL
     * Used for authenticating and getting access tokens
     */
    AccessToken() {
        return 'https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token';
    },
    
    /**
     * Get account details by ID
     * @param {string} accountId - Epic account ID
     */
    AccountById(accountId) {
        return `https://account-public-service-prod.ol.epicgames.com/account/api/public/account/${accountId}`;
    },
    
    /**
     * Get account by display name
     * @param {string} displayName - Epic display name
     */
    AccountByDisplayName(displayName) {
        return `https://account-public-service-prod.ol.epicgames.com/account/api/public/account/displayName/${displayName}`;
    },
    
    /**
     * Get BR inventory endpoint
     * @param {string} accountId - Epic account ID
     */
    BRInventory(accountId) {
        return `https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/game/v2/br-inventory/account/${accountId}`;
    },
    
    /**
     * Get bulk stats endpoint
     * @param {string} [category] - Optional category parameter
     */
    BulkStats(category) {
        return `https://statsproxy-public-service-live.ol.epicgames.com/statsproxy/api/statsv2/query${category !== undefined ? `?category=collection_${category}` : ''}`;
    },
    
    /**
     * Get item shop catalog endpoint
     */
    Catalog() {
        return 'https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/storefront/v2/catalog';
    },
    
    /**
     * Get device auth endpoint
     * @param {string} accountId - Epic account ID
     */
    DeviceAuth(accountId) {
        return `https://account-public-service-prod.ol.epicgames.com/account/api/public/account/${accountId}/deviceAuth`;
    },
    
    /**
     * Get enabled features endpoint
     */
    EnabledFeatures() {
        return 'https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/game/v2/enabled_features';
    },
    
    /**
     * Get friend codes endpoint
     * @param {string} accountId - Epic account ID
     * @param {string} codeType - Type of friend code
     */
    FriendCodes(accountId, codeType) {
        return `https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/game/v2/friendcodes/${accountId}/${codeType}`;
    },
    
    /**
     * Get keychain endpoint (encryption keys)
     */
    Keychain() {
        return 'https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/storefront/v2/keychain';
    },
    
    /**
     * Get MCP operation endpoint
     * @param {string} accountId - Epic account ID
     * @param {string} operation - Operation name
     * @param {string} route - Route
     * @param {string} profileId - Profile ID
     */
    MCP(accountId, operation, route, profileId) {
        return `https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/game/v2/profile/${accountId}/${route}/${operation}?profileId=${profileId}&rvn=-1`;
    },
    
    /**
     * Get receipts endpoint
     * @param {string} accountId - Epic account ID
     */
    Receipts(accountId) {
        return `https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/receipts/v1/account/${accountId}/receipts`;
    },
    
    /**
     * Get stats endpoint with optional time window params
     * @param {string} accountId - Epic account ID
     * @param {object} timeWindow - Optional time constraints
     */
    Stats(accountId, timeWindow) {
        const init = {};
        Object.entries(timeWindow || {}).forEach(([k, v]) => init[k] = v.toString());
        const queryParams = new URLSearchParams(init).toString();
        return `https://statsproxy-public-service-live.ol.epicgames.com/statsproxy/api/statsv2/account/${accountId}${queryParams === '' ? '' : `?${queryParams}`}`;
    },
    
    /**
     * Get Save the World world info endpoint
     */
    STWWorldInfo() {
        return 'https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/game/v2/world/info';
    },
    
    /**
     * Get timeline endpoint
     */
    Timeline() {
        return 'https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/calendar/v1/timeline';
    },
    
    /**
     * Get track endpoint (challenges/quests)
     * @param {string} namespace - App namespace
     * @param {string} trackguid - Track GUID
     */
    Track(namespace, trackguid) {
        return `https://fn-service-habanero-live-public.ogs.live.on.epicgames.com/api/v1/games/${namespace}/tracks/${trackguid}`;
    },
    
    /**
     * Get track progress endpoint
     * @param {string} namespace - App namespace 
     * @param {string} accountId - Epic account ID
     * @param {string} trackguid - Track GUID
     */
    TrackProgress(namespace, accountId, trackguid) {
        return `https://fn-service-habanero-live-public.ogs.live.on.epicgames.com/api/v1/games/${namespace}/trackprogress/${accountId}/byTrack/${trackguid}`;
    },
    
    /**
     * Get tracks progress endpoint (all tracks)
     * @param {string} namespace - App namespace
     * @param {string} accountId - Epic account ID
     */
    TracksProgress(namespace, accountId) {
        return `https://fn-service-habanero-live-public.ogs.live.on.epicgames.com/api/v1/games/${namespace}/trackprogress/${accountId}`;
    },
    
    /**
     * Get tracks query endpoint
     * @param {string} namespace - App namespace
     */
    TracksQuery(namespace) {
        return `https://fn-service-habanero-live-public.ogs.live.on.epicgames.com/api/v1/games/${namespace}/tracks/query`;
    },
    
    /**
     * Get token verification endpoint
     * @param {boolean} [includePerms] - Whether to include permissions
     */
    Verify(includePerms) {
        return `https://account-public-service-prod.ol.epicgames.com/account/api/oauth/verify${includePerms !== undefined ? `?includePerms=${includePerms}` : ''}`;
    }
};
