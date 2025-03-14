#!/usr/bin/env node

import { EpicClient } from '../src/epicWrapper.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seasonTimestamps } from '../src/getSeasonTimes.js';
import { statPattern } from '../src/fortniteModeConstants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Formats timestamp as readable date
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date string
 */
const formatTime = (timestamp) => new Date(timestamp * 1000).toLocaleString('en-US', {
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short'
}) + ' UTC';

/**
 * Parse a date string or timestamp to Unix timestamp
 * @param {string} dateStr - Date string like "Feb 21 2025 GMT" or Unix timestamp
 * @returns {number} Unix timestamp
 */
function parseDate(dateStr) {
    // Check if it's a numeric timestamp already
    if (!isNaN(dateStr) && dateStr.trim() !== '') {
        return parseInt(dateStr);
    }
    
    // Parse date string
    const timestamp = Date.parse(dateStr);
    if (isNaN(timestamp)) {
        throw new Error(`Invalid date format: ${dateStr}`);
    }
    
    return Math.floor(timestamp / 1000); // Convert to seconds
}

/**
 * Authenticates with Epic Games
 * @param {EpicClient} epicClient - Epic client instance
 * @returns {Promise<void>}
 */
async function authenticateClient(epicClient) {
    const grant = JSON.parse(
        readFileSync(join(__dirname, './config/deviceAuthGrant.json'), 'utf8')
    );

    if (epicClient.accountId == null) {
        console.log("Not logged in, awaiting authentication.");
        const loginResponse = await epicClient.auth.authenticate(grant);
        console.log(`Authenticated with the account ${loginResponse.displayName}`);
    } else {
        console.log("Already authenticated.");
    }
}

/**
 * Generate stats query parameters for getBulkStats
 * @param {string[]} statPatternKeys - Array of stat pattern keys
 * @param {string[]} modes - Array of mode strings (playlist identifiers)
 * @returns {string[]} Array of stat query strings
 */
function generateStatsQueries(statPatternKeys = [], modes = []) {
    let statQueries = [];
    
    // If no stat patterns provided, use all common ones
    const patterns = statPatternKeys.length > 0 ? 
        statPatternKeys.filter(key => statPattern[key]) :
        ['matchesplayed'];
    
    // If no modes specified, use common ones
    const targetModes = modes.length > 0 ? modes : [
        'playlist_nobuildbr_solo'
    ];
    
    // Generate stat queries for each pattern and mode combination
    patterns.forEach(pattern => {
        const statCode = statPattern[pattern];
        if (!statCode) return;
        
        // For each mode generate both keyboard/mouse and gamepad stats
        targetModes.forEach(mode => {
            statQueries.push(`br_${statCode}_keyboardmouse_m0_${mode}`);
            statQueries.push(`br_${statCode}_gamepad_m0_${mode}`);
        });
    });
    statQueries = ['br_matchesplayed_keyboardmouse_m0_playlist_nobuildbr_solo',
    'br_matchesplayed_gamepad_m0_playlist_nobuildbr_solo',
    'br_placetop1_keyboardmouse_m0_playlist_nobuildbr_solo',
    'br_placetop1_gamepad_m0_playlist_nobuildbr_solo'
    ];
    return statQueries;
}

/**
 * Get bulk stats for one or more players
 * @param {string|string[]} playerNames - Epic Games display name(s)
 * @param {Object} timeWindow - Time window {startTime, endTime}
 * @param {string[]} statPatternKeys - Stats to retrieve (kills, wins, matches, etc.)
 * @param {string[]} modes - Specific mode strings to query
 */
async function getBulkPlayerStats(playerNames, timeWindow, statPatternKeys = [], modes = []) {
    if (!playerNames) {
        console.error("Player name(s) required");
        return;
    }
    
    // Convert single player name to array
    const playerNameArray = typeof playerNames === 'string' ? [playerNames] : playerNames;
    
    const epicClient = new EpicClient();
    
    try {
        // Authenticate
        await authenticateClient(epicClient);
        
        // Get player IDs
        const playerIdsPromises = playerNameArray.map(name => 
            epicClient.getAccountByDisplayName(name)
        );
        
        const playerInfos = await Promise.all(playerIdsPromises);
        
        console.log(`Found ${playerInfos.length} players:`);
        playerInfos.forEach(player => {
            console.log(`- ${player.displayName} (${player.id})`);
        });
        
        // Get player IDs
        const playerIds = playerInfos.map(player => player.id);
        
        // Display time window
        console.log(`Time window: ${formatTime(timeWindow.startTime)} to ${formatTime(timeWindow.endTime)}`);
        
        // Generate stat queries
        const statQueries = generateStatsQueries(statPatternKeys, modes);
        console.log(`Generated ${statQueries.length} stat queries`);
        
        // Get bulk stats
        const bulkStats = await epicClient.fortnite.getBulkStats({
            accountIds: playerIds,
            stats: statQueries,
            startDate: timeWindow.startTime,
            endDate: timeWindow.endTime
        });
        
        // Display results
        console.log("\nRetrieved Stats:");
        console.dir(bulkStats, { depth: null });
        
        // Process results per player
        bulkStats.forEach(playerStat => {
            console.log(`\n--- Stats for ${playerStat.accountId} ---`);
            
            // Group by stat type for readability
            const statsByType = {};
            
            Object.entries(playerStat.stats).forEach(([statKey, value]) => {
                // Skip if no value
                if (!value) return;
                
                // Parse the stat key to extract components
                // Example: br_kills_keyboardmouse_m0_playlist_nobuildbr_solo
                const parts = statKey.split('_');
                
                // Get input type (keyboardmouse or gamepad)
                let inputType = "unknown";
                if (statKey.includes('keyboardmouse')) inputType = 'keyboardmouse';
                if (statKey.includes('gamepad')) inputType = 'gamepad';
                
                // Get stat type (kills, matches, wins, etc)
                let statType = "unknown";
                for (const [key, pattern] of Object.entries(statPattern)) {
                    if (statKey.includes(pattern)) {
                        statType = key;
                        break;
                    }
                }
                
                // Get playlist
                let playlist = "unknown";
                if (statKey.includes('playlist_')) {
                    playlist = parts.slice(parts.indexOf('playlist')).join('_');
                }
                
                // Create category key for grouping
                const category = `${playlist}_${inputType}`;
                
                if (!statsByType[category]) {
                    statsByType[category] = {};
                }
                
                statsByType[category][statType] = value;
            });
            
            // Display grouped stats
            console.dir(statsByType, { depth: null });
        });
        
    } catch (error) {
        console.error("Error retrieving bulk stats:", error);
    }
}

// Parse command line args
const args = process.argv.slice(2);
if (args.length < 1) {
    console.log("Usage:");
    console.log("  node getBulkStatsExample.js <playerName1,playerName2,...> [season|startTime endTime] [stat1,stat2,...]");
    console.log("\nExamples:");
    console.log("  Single player, current season: node getBulkStatsExample.js PlayerName");
    console.log("  Multiple players, specific season: node getBulkStatsExample.js PlayerName1,PlayerName2 ch5s2");
    console.log("  Custom time range: node getBulkStatsExample.js PlayerName \"May 1 2024 GMT\" \"May 10 2024 GMT\"");
    console.log("  Specific stats: node getBulkStatsExample.js PlayerName ch5s2 kills,wins,matches");
    console.log("\nAvailable stats:");
    console.log("  " + Object.keys(statPattern).join(", "));
    console.log("\nAvailable seasons:");
    console.log("  " + Object.keys(seasonTimestamps).join(", "));
    console.log("\nDefault season: ch6s2");
    process.exit(1);
}

// Parse player names (comma-separated)
const playerNames = args[0].split(',');

// Get default time window (ch6s2)
const defaultSeason = 'ch6s2';
const defaultTimeWindow = {
    startTime: seasonTimestamps[defaultSeason].startTime,
    endTime: seasonTimestamps[defaultSeason].endTime
};

let timeWindow = defaultTimeWindow;
let statPatterns = [];

// Process remaining arguments
if (args.length >= 2) {
    // Check if the second argument is a valid season name
    if (seasonTimestamps[args[1]]) {
        const season = args[1];
        timeWindow = {
            startTime: seasonTimestamps[season].startTime,
            endTime: seasonTimestamps[season].endTime
        };
        console.log(`Using season ${season}`);
    } else if (args.length >= 3) {
        try {
            // Try to parse args[1] and args[2] as dates
            timeWindow = {
                startTime: parseDate(args[1]),
                endTime: parseDate(args[2])
            };
        } catch (error) {
            console.log(`Invalid date format. Using default season ${defaultSeason}.`);
        }
    }
    
    // Check for stat patterns (comma-separated)
    if ((args.length === 3 && !seasonTimestamps[args[1]]) || args.length === 4) {
        const statIndex = args.length === 3 ? 2 : 3;
        statPatterns = args[statIndex].split(',')
            .filter(pattern => statPattern[pattern]);
        
        if (statPatterns.length > 0) {
            console.log(`Using stats: ${statPatterns.join(', ')}`);
        }
    }
} else {
    console.log(`No time window specified. Using default season ${defaultSeason}.`);
}

// Run the bulk stats retrieval
getBulkPlayerStats(playerNames, timeWindow, statPatterns);
