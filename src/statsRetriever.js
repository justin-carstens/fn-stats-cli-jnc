import { EpicClient } from './epicWrapper.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seasonTimestamps } from './getSeasonTimes.js';
import { subtractRawFortniteStats } from './fortniteRawStatOps.js';
import { formatTime } from './dateUtils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Conditional logging function that respects quiet mode
 * @param {string} message - Message to log
 * @param {boolean} quietMode - Whether quiet mode is enabled
 */
function conditionalLog(message, quietMode) {
    if (!quietMode) {
        console.log(message);
    }
}

/**
 * Authenticates with Epic Games
 * @param {EpicClient} epicClient - Epic client instance
 * @param {boolean} quietMode - Whether to suppress logs
 * @returns {Promise<void>}
 */
export async function authenticateClient(epicClient, quietMode = false) {
    const grant = JSON.parse(
        readFileSync(join(__dirname, '../config/deviceAuthGrant.json'), 'utf8')
    );

    if (epicClient.accountId == null) {
        conditionalLog("Not logged in, awaiting authentication.", quietMode);
        const loginResponse = await epicClient.auth.authenticate(grant);
        conditionalLog(`Authenticated with the account ${loginResponse.displayName}`, quietMode);
    } else {
        conditionalLog("Already authenticated.", quietMode);
    }
}

/**
 * Get Fortnite stats for a player using either direct or advanced method
 * @param {string} playerName - Epic Games display name
 * @param {Object} timeWindow - Time window {startTime, endTime}
 * @param {boolean} useAdvancedMethod - Whether to use the advanced triple API call technique
 * @param {boolean} quietMode - Whether to suppress logs
 * @param {EpicClient} [existingClient] - Optional existing authenticated client
 * @returns {Promise<Object>} Raw stats from API
 */
export async function getFortniteStats(playerName, timeWindow, useAdvancedMethod = true, quietMode = false, existingClient = null) {
    // Use existing client if provided, otherwise create a new one
    const epicClient = existingClient || new EpicClient();
    
    try {
        // Only authenticate if we created a new client (no existing client was provided)
        if (!existingClient) {
            await authenticateClient(epicClient, quietMode);
        }
        
        // Get player ID
        const playerInfo = await epicClient.getAccountByDisplayName(playerName);
        conditionalLog(`Found player: ${playerInfo.displayName} (${playerInfo.id})`, quietMode);

        if (useAdvancedMethod) {
            // Advanced method using triple API call technique for accurate time windows
            conditionalLog("Using advanced triple API call technique for accurate time window stats", quietMode);
            
            // Display requested time window
            conditionalLog(`Requested time window: ${formatTime(timeWindow.startTime)} to ${formatTime(timeWindow.endTime)}`, quietMode);
            
            // Get the Ch1S1 start timestamp (beginning of Fortnite)
            const ch1s1Start = seasonTimestamps.ch1s1.startTime;
            
            // Calculate tomorrow at midnight GMT
            const tomorrow = new Date();
            tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
            tomorrow.setUTCHours(0, 0, 0, 0);
            const tomorrowMidnightGMT = Math.floor(tomorrow.getTime() / 1000);
            
            // 1. Get stats from Ch1S1 to either tomorrow midnight GMT or the requested end time (whichever is earlier)
            const fromCh1s1ToNowOrEnd = {
                startTime: ch1s1Start,
                endTime: timeWindow.endTime < tomorrowMidnightGMT ? timeWindow.endTime : tomorrowMidnightGMT
            };
            
            conditionalLog(`API call #1: ${formatTime(fromCh1s1ToNowOrEnd.startTime)} to ${formatTime(fromCh1s1ToNowOrEnd.endTime)}`, quietMode);
            const statsToNowOrEnd = await epicClient.fortnite.getStats(playerInfo.id, fromCh1s1ToNowOrEnd);
            conditionalLog(`Retrieved ${Object.keys(statsToNowOrEnd.stats || {}).length} raw stats for call #1`, quietMode);
            
            // 2. Get stats from Ch1S1 to startTime
            const fromCh1s1ToStart = {
                startTime: ch1s1Start,
                endTime: timeWindow.startTime
            };
            conditionalLog(`API call #2: ${formatTime(fromCh1s1ToStart.startTime)} to ${formatTime(fromCh1s1ToStart.endTime)}`, quietMode);
            const statsToStart = await epicClient.fortnite.getStats(playerInfo.id, fromCh1s1ToStart);
            conditionalLog(`Retrieved ${Object.keys(statsToStart.stats || {}).length} raw stats for call #2`, quietMode);
            
            // 3. Subtract to get the isolated time window
            conditionalLog("Subtracting overlapping time periods to isolate requested window", quietMode);
            const rawStats = subtractRawFortniteStats(statsToNowOrEnd, statsToStart);
            
            // Display number of stats returned after subtraction
            const statCount = Object.keys(rawStats.stats || {}).length;
            conditionalLog(`Resulting in ${statCount} raw stats for the isolated time window`, quietMode);
            
            return rawStats;
        } else {
            // Direct method - single API call
            conditionalLog("Using direct API call method", quietMode);
            conditionalLog(`Time window: ${formatTime(timeWindow.startTime)} to ${formatTime(timeWindow.endTime)}`, quietMode);
            
            const rawStats = await epicClient.fortnite.getStats(playerInfo.id, timeWindow);
            return rawStats;
        }
    } catch (error) {
        console.error("Error retrieving stats:", error);
        throw error;
    }
}
