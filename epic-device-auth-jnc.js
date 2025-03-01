/**
 * Epic Games Authentication Script
 * 
 * This script handles the OAuth2 authentication flow for Epic Games:
 * 1. Opens browser for user login
 * 2. Captures authorization code
 * 3. Exchanges code for access token
 * 4. Creates permanent device auth credentials
 * 
 * Uses ES Modules and async/await pattern throughout
 */

// Import required dependencies
import { EpicClient } from './epicWrapper.js';  // Our CommonJS wrapper for @squiddleton/epic
import { writeFileSync } from 'node:fs';        // Node.js file system module
import open from 'open';                        // Opens URLs in default browser
import * as readline from 'node:readline/promises';  // Promise-based readline

// Initialize Epic Games client
// This client handles all API communication with Epic's services
const client = new EpicClient();

// Create readline interface for command-line interaction
// Uses Node's built-in readline with Promise support
const rl = readline.createInterface({
    input: process.stdin,    // Accept input from terminal
    output: process.stdout   // Output to terminal
});

// Epic OAuth configuration
// These values are required for the OAuth2 authorization flow
const clientId = '3f69e56c7649492c8cc29f1af08a8a12';  // Epic Games client identifier
const fortniteUrl = 'https://www.fortnite.com/?lang=en-US';  // Initial login page
const authUrl = `https://www.epicgames.com/id/api/redirect?clientId=${clientId}&responseType=code`;  // OAuth endpoint

/**
 * Prompts user to confirm their Epic Games login status
 * Uses async/await pattern with native Promise-based readline
 * 
 * @returns {Promise<boolean>} True if user indicates they've signed in
 */
const confirmSignIn = async () => {
    const answer = await rl.question('Have you signed in to Epic Games? (yes/no): ');
    return answer.toLowerCase().startsWith('y');
};

/**
 * Retrieves and processes the authorization code from user input
 * Expects a JSON response from Epic's OAuth redirect containing:
 * {
 *   "redirectUrl": "com.epicgames.fortnite://fnauth/?code=...",
 *   "authorizationCode": "actual_code_here",
 *   "ssoV2Enabled": true
 * }
 * 
 * @returns {Promise<string|null>} Authorization code if successful, null if parsing fails
 */
const getAuthCode = async () => {
    try {
        // Get raw JSON response from user
        const response = await rl.question('Please paste the FULL JSON response from the browser (all the text in curly brackets): ');
        
        // Parse JSON and extract authorization code
        const jsonResponse = JSON.parse(response);
        const code = jsonResponse.authorizationCode;
        
        // Validate authorization code
        if (!code) {
            throw new Error('No authorization code found in response');
        }
        return code;
    } catch (e) {
        console.error('Failed to parse JSON response:', e.message);
        return null;
    }
};

try {
    // Step 1: Initiate login flow
    // Opens default browser to Fortnite login page
    console.log('Opening Fortnite website. Please sign in to your Epic Games account...');
    await open(fortniteUrl);
    
    // Step 2: Wait for user login confirmation
    // Loops until user confirms successful login
    let isSignedIn = await confirmSignIn();
    while (!isSignedIn) {
        console.log('Please sign in before continuing...');
        isSignedIn = await confirmSignIn();
    }

    // Step 3: Begin OAuth authorization
    // Opens authorization page and waits for user to complete flow
    console.log('Opening Epic Games authorization page...');
    console.log('After authorizing, you will be redirected. Copy the FULL JSON response.');
    await open(authUrl);
    
    // Step 4: Process authorization response
    // Gets and validates the authorization code
    const code = await getAuthCode();
    if (!code) {
        throw new Error('Could not extract authorization code from response');
    }

    // Step 5: Exchange auth code for access token
    // Uses Epic client to perform OAuth code exchange
    const loginResponse = await client.auth.authenticate({ 
        grant_type: 'authorization_code', 
        code: code
    });

    // Step 6: Generate device authentication
    // Creates permanent device credentials for future use
    const deviceAuthResponse = await client.auth.getDeviceAuth(
        loginResponse.account_id, 
        loginResponse.access_token
    );

    // Step 7: Save device authentication grant
    // Creates reusable credentials for future authentication
    const deviceAuthGrant = {
        grant_type: 'device_auth',
        account_id: deviceAuthResponse.accountId,
        device_id: deviceAuthResponse.deviceId,
        secret: deviceAuthResponse.secret
    };

    // Save credentials to local file system
    // Uses pretty printing (null, 2) for readable JSON
    writeFileSync('./deviceAuthGrant.json', JSON.stringify(deviceAuthGrant, null, 2));
    console.log('Device authentication credentials saved successfully!');
    
} catch (error) {
    // Handle any errors that occur during the process
    console.error('Authentication failed:', error.message);
} finally {
    // Clean up resources
    // Ensures readline interface is properly closed
    rl.close();
}