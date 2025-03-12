import { EpicEndpoints } from './endpoints.js';
import { EpicAPIError } from './error.js';
import { FortniteGameClient } from './util.js';

/**
 * Main authentication manager for Epic Games API
 * Handles authentication flow and API requests
 */
export class EpicAuthManager {
    // Private property to store authentication credentials
    #credentials = null;
    
    // Public properties
    accountId = null;         // Current authenticated account ID
    autoRefresh;              // Whether to automatically refresh the token
    gameClient = FortniteGameClient.ANDROID;  // Default client credentials
    
    /**
     * Creates a new authentication manager
     * @param {boolean} autoRefresh - Whether to automatically refresh the token when it expires
     * @param {string} [gameClient] - Optional client credentials to use (defaults to Android)
     */
    constructor(autoRefresh, gameClient) {
        this.autoRefresh = autoRefresh;
        if (gameClient !== undefined)
            this.gameClient = gameClient;
    }
    
    /**
     * Updates the stored credentials after authentication
     * @param {object} authResponse - Response from authentication API
     * @returns {object} - The updated credentials
     * @private
     */
    #editCredentials(authResponse) {
        // Save account ID from the response
        this.accountId = authResponse.account_id;
        
        // Store tokens and their expiration times
        this.#credentials = {
            accessToken: authResponse.access_token,
            accessExpiresAt: new Date(authResponse.expires_at).getTime(),
            refreshToken: authResponse.refresh_token,
            refreshExpiresAt: new Date(authResponse.refresh_expires_at).getTime()
        };
        return this.#credentials;
    }
    
    /**
     * Performs an HTTP request with authentication handling
     * @param {string} url - The URL to fetch
     * @param {object} init - Fetch options
     * @param {boolean} [returnRes=true] - Whether to return the response or just the status code
     * @param {boolean} [checkCredentials=true] - Whether to check if credentials need refreshing
     * @returns {Promise<any|number>} - Response data or status code
     * @private
     */
    async #fetch(url, init, returnRes = true, checkCredentials = true) {
        // If auto-refresh is disabled, check if tokens need refreshing manually
        if (checkCredentials && !this.autoRefresh && this.#credentials !== null) {
            const now = Date.now();
            
            // Check if access token has expired
            if (now > this.#credentials.accessExpiresAt) {
                // Check if refresh token has also expired
                if (now > this.#credentials.refreshExpiresAt) {
                    throw new Error('The Epic access token and refresh token have both expired. Please authenticate with new credentials.');
                }
                else {
                    // Use refresh token to get a new access token
                    await this.authenticate({
                        grant_type: 'refresh_token',
                        refresh_token: this.#credentials.refreshToken
                    });
                }
            }
        }
        
        // Perform the actual fetch request
        const res = await fetch(url, init);
        
        // Return just the status code if requested
        if (!returnRes)
            return res.status;
        
        // Process successful responses
        if (res.ok) {
            // Return null for 204 No Content responses
            if (res.status === 204)
                return null;
            
            // Parse and return JSON for other successful responses
            const returned = await res.json();
            return returned;
        }
        else {
            // For error responses, throw a custom error with details
            const rawText = await res.text();
            throw new EpicAPIError(res, rawText, url);
        }
    }
    
    /**
     * Authenticates with Epic using the provided grant
     * @param {object} grant - The grant object (e.g. authorization_code, refresh_token)
     * @returns {Promise<object>} - Authentication response
     */
    async authenticate(grant) {
        // Send authentication request
        const res = await this.get(EpicEndpoints.AccessToken(), {
            method: 'POST',
            headers: {
                Authorization: `basic ${this.gameClient}`
            },
            body: new URLSearchParams({ ...grant })
        }, false);
        
        // Update stored credentials
        this.#editCredentials(res);
        
        // Set up automatic token refresh if enabled
        if (this.autoRefresh) {
            setTimeout(async () => {
                await this.authenticate({
                    grant_type: 'refresh_token',
                    refresh_token: res.refresh_token
                });
            }, res.expires_in * 1000); // Convert seconds to milliseconds
        }
        
        return res;
    }
    
    /**
     * Performs a GET request to the Epic API
     * @param {string} url - URL to request
     * @param {object} [init] - Custom fetch options (optional)
     * @param {boolean} [checkCredentials=true] - Whether to check credentials before request
     * @returns {Promise<any>} - Response data
     */
    get(url, init, checkCredentials = true) {
        // If custom init is provided, use it directly
        if (init !== undefined)
            return this.#fetch(url, init, true, checkCredentials);
        
        // Otherwise, validate credentials and add auth header
        EpicAuthManager.validateCredentials(this.#credentials);
        return this.#fetch(url, {
            headers: {
                Authorization: `bearer ${this.#credentials.accessToken}`
            }
        });
    }
    
    /**
     * Gets the current account ID, throws if not authenticated
     * @returns {string} - The account ID
     */
    getAccountId() {
        if (this.accountId === null)
            throw new Error('The Epic client has not logged in, and its account id is not accessible.');
        return this.accountId;
    }
    
    /**
     * Creates device auth credentials for future logins
     * @param {string} accountId - Epic account ID
     * @param {string} accessToken - Access token
     * @returns {Promise<object>} - Device auth response
     */
    getDeviceAuth(accountId, accessToken) {
        return this.get(EpicEndpoints.DeviceAuth(accountId), {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
    }
    
    /**
     * Performs various HTTP methods (POST/PUT/PATCH/DELETE) to Epic API
     * @param {string} method - HTTP method to use
     * @param {string} url - URL to request
     * @param {any} body - Request body
     * @param {object} [options={}] - Additional options
     * @returns {Promise<any|number>} - Response data or status code
     */
    method(method, url, body, options = {}) {
        // Validate credentials before proceeding
        EpicAuthManager.validateCredentials(this.#credentials);
        
        // Set up headers with auth token
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `bearer ${this.#credentials.accessToken}`
        };
        
        // Add any extra headers if provided
        if (options.extraHeaders !== undefined) {
            for (const header in options.extraHeaders)
                headers[header] = options.extraHeaders[header];
        }
        
        // Perform the request
        return this.#fetch(url, {
            method,
            headers,
            body: JSON.stringify(body)
        }, options.returnRes);
    }
    
    /**
     * Verifies the current authentication token
     * @param {boolean} [includePerms] - Whether to include permissions in response
     * @returns {Promise<object>} - Verification response
     */
    verify(includePerms) {
        return this.get(EpicEndpoints.Verify(includePerms));
    }
    
    /**
     * Static method to validate if credentials exist
     * @param {object|null} credentials - Credentials to validate
     * @throws {Error} - If credentials are null
     */
    static validateCredentials(credentials) {
        if (credentials === null)
            throw new Error('The Epic client has not logged in, and its credentials are not accessible.');
    }
}
