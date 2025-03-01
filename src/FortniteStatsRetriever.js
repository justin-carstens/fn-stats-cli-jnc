import { EpicClient } from './epicWrapper.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFortniteStatObject, addFortniteRateStats, subtractRawFortniteStats } from './fortniteStatCalculations.js';
import { filterFortniteStats } from './filterFortniteStats.js';

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

        // Set up time windows for stat retrieval
        const fromStartToNow = {...this.timeWindow};
        fromStartToNow.endTime = Math.round(Date.now()/1000+86400);

        const fromEndToNow = {...fromStartToNow};
        fromEndToNow.startTime = this.timeWindow.endTime;

        // Get accumulated stats from both periods to now
        const rawFromStartToNow = await this.epicClient.fortnite.getStats(this.epicId.id, fromStartToNow);
        let rawFromEndToNow = {stats: {}};
        if (fromEndToNow.startTime <= fromStartToNow.endTime) {
            rawFromEndToNow = await this.epicClient.fortnite.getStats(this.epicId.id, fromEndToNow);
        }

        // Subtract overlapping period to isolate desired time window
        const rawStats = subtractRawFortniteStats(rawFromStartToNow, rawFromEndToNow);
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
