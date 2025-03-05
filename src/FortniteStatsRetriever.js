import { EpicClient } from './epicWrapper.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFortniteStatObject, addFortniteRateStats, subtractRawFortniteStats } from './fortniteStatCalculations.js';
import { filterFortniteStats } from './filterFortniteStats.js';
import { seasonTimestamps } from './getSeasonTimes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Handles the complete pipeline for retrieving and processing Fortnite player statistics
 * Pipeline stages:
 * 1. Authentication with Epic Games
 * 2. Raw stat retrieval from API
 * 3. Stat processing and structuring
 * 4. Rate/ratio calculations
 * 5. Filtering
 * 6. Report generation
 */
export class FortniteStatsRetriever {
    /**
     * @param {string} epicName - Epic Games display name
     * @param {Object} timeWindow - Time period for stats (startTime, endTime)
     * @param {Array<string>} filter - Array of filters to apply
     */
    constructor(epicName, timeWindow, filter) {
        this.epicName = epicName;
        this.timeWindow = timeWindow;
        this.epicClient = new EpicClient();
        this.stats = this.getStats();
        this.reportStats(filter);
    }

    /**
     * Authenticates with Epic Games using stored device credentials
     * @private
     * @returns {Promise<void>}
     */
    #authenticateClient = async () => {
        const grant = JSON.parse(
            readFileSync(join(__dirname, '../config/deviceAuthGrant.json'), 'utf8')
        );

        if (this.epicClient.accountId == null) {
            console.log("Not logged in, awaiting authentication.");
            const loginResponse = await this.epicClient.auth.authenticate(grant);
            console.log(`Authenticated with the account ${loginResponse.displayName}`);
        } else {
            console.log("Already authenticated.");
        }
    }

    /**
     * Retrieves raw stats from Epic Games API
     * Handles time window calculations and API calls
     * @returns {Promise<Object>} Processed stats object
     */
    getStats = async () => {
        await this.#authenticateClient();
        this.epicId = await this.epicClient.getAccountByDisplayName(this.epicName);

        // Helper function to format timestamps as readable dates
        const formatTime = (timestamp) => new Date(timestamp * 1000).toLocaleString('en-US', {
            timeZone: 'UTC',
            dateStyle: 'medium',
            timeStyle: 'short'
        }) + ' UTC';

        // Calculate tomorrow at midnight GMT
        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);  // Handles month rollover automatically
        tomorrow.setUTCHours(0, 0, 0, 0);  // Set to midnight GMT
        const tomorrowMidnightGMT = Math.round(tomorrow.getTime() / 1000);
        
        // Get the Ch1S1 start timestamp (beginning of Fortnite)
        const ch1s1Start = seasonTimestamps.ch6s2.startTime-86400*81;
        
        // Set up time windows for stat retrieval
        // 1. Get stats from Ch1S1 to tomorrow midnight GMT ("now")
        const fromCh1s1ToNow = {
            startTime: ch1s1Start,
            endTime: tomorrowMidnightGMT
        };

        
        // 2. Get stats from Ch1S1 to this.timeWindow.endTime ("end")
        let fromCh1s1ToEnd;
        if (this.timeWindow.endTime < tomorrowMidnightGMT) {
            // If end time is earlier than tomorrow, get separate stats
            fromCh1s1ToEnd = {
                startTime: ch1s1Start,
                endTime: this.timeWindow.endTime
            };
        } else {
            // Otherwise, just use the "now" stats
            fromCh1s1ToEnd = fromCh1s1ToNow;
        }
        console.log(`Time window "End": ${formatTime(fromCh1s1ToEnd.startTime)} to ${formatTime(fromCh1s1ToEnd.endTime)}`);
        
        // 3. Get stats from Ch1S1 to this.timeWindow.startTime ("start")
        const fromCh1s1ToStart = {
            startTime: ch1s1Start,
            endTime: this.timeWindow.startTime
        };
        console.log(`Time window "Start": ${formatTime(fromCh1s1ToStart.startTime)} to ${formatTime(fromCh1s1ToStart.endTime)}`);
        
        console.log(`Effective request window: ${formatTime(this.timeWindow.startTime)} to ${formatTime(this.timeWindow.endTime)}`);
        
        // Get accumulated stats for all time periods
        const rawToNow = await this.epicClient.fortnite.getStats(this.epicId.id, fromCh1s1ToNow);
        console.log(`Time window "Now": ${formatTime(fromCh1s1ToNow.startTime)} to ${formatTime(fromCh1s1ToNow.endTime)}`);
        let filteredRawToNow=Object.keys(rawToNow.stats).
            filter(key=>key.includes('matchesplayed')).
            filter(key=>key.includes('nobuildbr_squad'));
        filteredRawToNow.forEach(key=>console.log(key+': %d',rawToNow.stats[key]));
        

        // Only make additional API call if needed (optimization)
        let rawToEnd = rawToNow;
        if (this.timeWindow.endTime < tomorrowMidnightGMT) {
            rawToEnd = await this.epicClient.fortnite.getStats(this.epicId.id, fromCh1s1ToEnd);
        }
        
        const rawToStart = await this.epicClient.fortnite.getStats(this.epicId.id, fromCh1s1ToStart);
        
        // Subtract overlapping period to isolate desired time window (end - start)
        const rawStats = subtractRawFortniteStats(rawToEnd, rawToStart);
        return createFortniteStatObject(rawStats);
    };

    /**
     * Generates final stats report
     * Processes raw stats through calculation and filtering pipeline
     * @param {Array<string>} filter - Filters to apply to stats
     */
    reportStats = async (filter) => {
        const stats = await this.stats;
        let statSummary = addFortniteRateStats(stats);
        const filteredStats = filterFortniteStats(statSummary, filter);
        console.log("Stat Summary");
        console.dir(filteredStats, {depth: null});
    };
}
