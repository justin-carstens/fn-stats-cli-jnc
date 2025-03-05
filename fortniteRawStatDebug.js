#!/usr/bin/env node

import { EpicClient } from './src/epicWrapper.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seasonTimestamps } from './src/getSeasonTimes.js';
import { filterRawFortniteStats } from './src/filterRawFortniteStats.js';
import { statPattern, buildModes, gameModes, compModes, teamSizes } from './src/fortniteModeConstants.js';

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
 * Sort stats by keys and convert to a displayable format
 * @param {Object} stats - Stats object to sort
 * @returns {Object} Sorted stats object
 */
function getSortedStats(stats) {
    if (!stats) return {};
    
    // Create sorted object with alphabetically sorted keys
    const sortedStats = {};
    Object.keys(stats)
        .sort()
        .forEach(key => {
            sortedStats[key] = stats[key];
        });
    
    return sortedStats;
}

/**
 * Extract and format all lastmodified timestamps from stats object
 * Sorts by timestamp (oldest first, newest last)
 * @param {Object} stats - Stats object to process
 * @returns {Object} Object containing only lastmodified entries with formatted dates
 */
function getLastModifiedTimes(stats) {
    if (!stats) return {};
    
    // Find all lastmodified keys and their timestamps
    const entries = Object.keys(stats)
        .filter(key => key.includes('lastmodified'))
        .map(key => {
            const timestamp = parseInt(stats[key]);
            return { key, timestamp };
        });
    
    // Sort by timestamp (ascending order - oldest first, newest last)
    entries.sort((a, b) => a.timestamp - b.timestamp);
    
    // Create ordered object with formatted dates
    const lastModified = {};
    entries.forEach(({ key, timestamp }) => {
        const readableDate = new Date(timestamp * 1000).toLocaleString('en-US', {
            timeZone: 'GMT',
            dateStyle: 'medium',
            timeStyle: 'medium'
        }) + ' GMT';
        
        lastModified[key] = readableDate + ` (${timestamp})`;
    });
    
    return lastModified;
}

/**
 * Filter stats by multiple stat patterns (kills, matches, etc)
 * Always includes lastmodified keys
 * 
 * @param {Object} stats - Stats object to filter
 * @param {Array<string>} patterns - Stat patterns to filter by (e.g., ['kills', 'matches'])
 * @returns {Object} Filtered stats
 */
function filterByStatPatterns(stats, patterns) {
    if (!stats || !patterns || patterns.length === 0) return stats;
    
    const filtered = {};
    const patternValues = patterns
        .filter(pattern => statPattern[pattern])
        .map(pattern => statPattern[pattern]);
    
    if (patternValues.length === 0) return stats;
    
    Object.keys(stats).forEach(key => {
        // Always include lastmodified keys
        if (key.includes('lastmodified') || patternValues.some(pattern => key.includes(pattern))) {
            filtered[key] = stats[key];
        }
    });
    
    return filtered;
}

/**
 * Determines if a filter string is a valid stat pattern key
 * 
 * @param {string} filter - Filter string to check
 * @returns {boolean} True if it's a valid stat pattern key
 */
function isStatPatternKey(filter) {
    return Object.keys(statPattern).includes(filter);
}

/**
 * Parse arguments to extract mode filters and stat patterns
 * @param {Array<string>} args - Array of command line arguments
 * @returns {Object} Object with modeFilters and statPatterns
 */
function parseFilterArgs(args) {
    // Extract mode filters
    const modeFilters = args.filter(arg => 
        buildModes.includes(arg) || 
        gameModes.includes(arg) || 
        compModes.includes(arg) || 
        teamSizes.includes(arg)
    );
    
    // Extract stat patterns
    const statPatterns = args.filter(arg => isStatPatternKey(arg));
    
    return { modeFilters, statPatterns };
}

/**
 * Get raw stats for a player in a specific time window
 * @param {string} playerName - Epic Games display name
 * @param {Object} timeWindow - Time window {startTime, endTime}
 * @param {Array<string>} filters - Game mode filters to apply
 * @param {Array<string>} statPatternKeys - Optional stat pattern keys to filter by
 */
async function getRawStats(playerName, timeWindow, filters = [], statPatternKeys = []) {
    const epicClient = new EpicClient();
    
    try {
        // Authenticate
        await authenticateClient(epicClient);
        
        // Get player ID
        const playerInfo = await epicClient.getAccountByDisplayName(playerName);
        console.log(`Found player: ${playerInfo.displayName} (${playerInfo.id})`);
        
        // Display time window
        console.log(`Time window: ${formatTime(timeWindow.startTime)} to ${formatTime(timeWindow.endTime)}`);
        
        // Get stats
        const rawStats = await epicClient.fortnite.getStats(playerInfo.id, timeWindow);
        
        // Display number of stats returned
        const statCount = Object.keys(rawStats.stats || {}).length;
        console.log(`Retrieved ${statCount} raw stats`);

        // Apply game mode filters
        let filteredStats = rawStats;
        if (filters.length > 0) {
            filteredStats = filterRawFortniteStats(rawStats, filters);
        }
        
        // Apply stat pattern filters if provided
        if (statPatternKeys.length > 0) {
            const statsBeforePatternFilter = Object.keys(filteredStats.stats || {}).length;
            filteredStats.stats = filterByStatPatterns(filteredStats.stats, statPatternKeys);
            
            // Display patterns being applied
            const patternStrings = statPatternKeys.map(key => 
                `'${key}' (${statPattern[key]})`
            ).join(', ');
            
            console.log(`Applied stat pattern filters: ${patternStrings}`);
            console.log(`Stats count: ${statsBeforePatternFilter} → ${Object.keys(filteredStats.stats || {}).length} (always includes lastmodified)`);
        }
        
        const filteredCount = Object.keys(filteredStats.stats || {}).length;
        
        // Display results
        const filterDesc = [
            ...(filters.length > 0 ? [`modes: ${filters.join(', ')}`] : []),
            ...(statPatternKeys.length > 0 ? [`stats: ${statPatternKeys.join(', ')}`] : [])
        ].join(', ');
        
        const headerText = filterDesc ? 
            `\nFiltered Stats (${filterDesc}):` : 
            "\nAll Raw Stats (alphabetically sorted):";
            
        console.log(headerText);
        
        if (filteredCount === 0) {
            console.log("  No matching stats found");
        } else {
            console.log(`  Found ${filteredCount} matching stats`);
            const sortedStats = getSortedStats(filteredStats.stats);
            console.dir(sortedStats, { depth: null });
            
            // Show lastmodified dates for stats
            const lastModifiedTimes = getLastModifiedTimes(filteredStats.stats);
            if (Object.keys(lastModifiedTimes).length > 0) {
                console.log("\nLast Modified Times (GMT):");
                console.dir(lastModifiedTimes, { depth: null });
            }
        }
        
    } catch (error) {
        console.error("Error retrieving stats:", error);
    }
}

/**
 * Find the latest lastmodified timestamp in stats object
 * @param {Object} stats - Stats object to process
 * @returns {number} Latest timestamp (or 0 if none found)
 */
function getLatestModifiedTimestamp(stats) {
    if (!stats) return 0;
    
    let latest = 0;
    
    Object.keys(stats).forEach(key => {
        if (key.includes('lastmodified')) {
            const timestamp = parseInt(stats[key]);
            if (timestamp > latest) {
                latest = timestamp;
            }
        }
    });
    
    return latest;
}

/**
 * Get stats difference between two stat objects
 * Calculates numeric differences for stat values
 * 
 * @param {Object} newStats - Newer stats object
 * @param {Object} oldStats - Older stats object
 * @returns {Object} Difference object with changes
 */
function getStatsDifference(newStats, oldStats) {
    if (!newStats || !oldStats) return {};
    
    const diff = {};
    
    // Check each key in the new stats
    Object.keys(newStats).forEach(key => {
        // If key doesn't exist in old stats, it's a new stat
        if (!(key in oldStats)) {
            diff[key] = newStats[key];
        }
        // If value is different, include the difference
        else if (newStats[key] !== oldStats[key]) {
            // For numeric values, store just the delta
            if (!isNaN(newStats[key]) && !isNaN(oldStats[key]) && !key.includes('lastmodified')) {
                const oldVal = parseInt(oldStats[key]);
                const newVal = parseInt(newStats[key]);
                // Calculate the actual difference (new - old)
                diff[key] = oldVal - newVal;
            }
            // For non-numeric or lastmodified values, store the new value
            else {
                diff[key] = key.includes('lastmodified') ? 
                    new Date(parseInt(newStats[key]) * 1000).toLocaleString('en-US', {
                        timeZone: 'GMT',
                        dateStyle: 'medium', 
                        timeStyle: 'medium'
                    }) + ' GMT' : 
                    newStats[key];
            }
        }
    });
    
    return diff;
}

/**
 * Get most recent lastmodified entries
 * @param {Object} stats - Stats object to process
 * @param {number} count - Number of entries to return
 * @returns {Object} Object with most recent lastmodified entries
 */
function getMostRecentModifiedTimes(stats, count = 5) {
    if (!stats) return {};
    
    // Find all lastmodified keys and their timestamps
    const entries = Object.keys(stats)
        .filter(key => key.includes('lastmodified'))
        .map(key => {
            const timestamp = parseInt(stats[key]);
            return { key, timestamp };
        });
    
    // Sort by timestamp (descending - newest first)
    entries.sort((a, b) => b.timestamp - a.timestamp);
    
    // Take only the specified count
    const recentEntries = entries.slice(0, count);
    
    // Create ordered object with formatted dates
    const lastModified = {};
    recentEntries.forEach(({ key, timestamp }) => {
        const readableDate = new Date(timestamp * 1000).toLocaleString('en-US', {
            timeZone: 'GMT',
            dateStyle: 'medium',
            timeStyle: 'medium'
        }) + ' GMT';
        
        lastModified[key] = readableDate + ` (${timestamp})`;
    });
    
    return lastModified;
}

/**
 * Format midnight GMT for a given timestamp
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {number} Unix timestamp for midnight GMT of the day
 */
function getMidnightGMT(timestamp) {
    const date = new Date(timestamp * 1000);
    date.setUTCHours(0, 0, 0, 0);
    return Math.floor(date.getTime() / 1000);
}

/**
 * Search back through time to find stat changes
 * @param {string} playerName - Epic Games display name
 * @param {Array<string>} filters - Game mode filters to apply
 */
async function searchStatsHistory(playerName, filters = []) {
    const epicClient = new EpicClient();
    const accumulatedStats = [];
    const statDifferences = [];
    
    try {
        // Authenticate
        await authenticateClient(epicClient);
        
        // Get player ID
        const playerInfo = await epicClient.getAccountByDisplayName(playerName);
        console.log(`Found player: ${playerInfo.displayName} (${playerInfo.id})\n`);
        
        // Get ch1s1 start (earliest date to search from)
        const ch1s1Start = seasonTimestamps.ch1s1.startTime;
        
        // Get ch5s1 start (earliest date to go back to)
        const ch5s1Start = seasonTimestamps.ch5s1.startTime;
        
        // Calculate tonight's midnight in GMT
        const now = new Date();
        now.setUTCDate(now.getUTCDate() + 1); // tomorrow
        now.setUTCHours(0, 0, 0, 0); // midnight
        const tonightMidnight = Math.floor(now.getTime() / 1000);
        
        // Initial time window
        let endTime = tonightMidnight;
        let step = 1;
        
        // Loop until we reach ch5s1 start
        while (true) {
            console.log(`\n=== Step ${step}: Retrieving stats from ${formatTime(ch1s1Start)} to ${formatTime(endTime)} ===`);
            
            // Get stats for time window
            const timeWindow = { startTime: ch1s1Start, endTime: endTime };
            const rawStats = await epicClient.fortnite.getStats(playerInfo.id, timeWindow);
            
            // Filter stats if filters provided
            let filteredStats = rawStats;
            if (filters.length > 0) {
                filteredStats = filterRawFortniteStats(rawStats, filters);
                console.log(`Applied filters: ${filters.join(', ')}`);
            }
            
            // Get sorted stats
            const sortedStats = getSortedStats(filteredStats.stats || {});
            
            // Add to accumulated stats
            accumulatedStats.push({
                endTime: endTime,
                endTimeFormatted: formatTime(endTime),
                stats: sortedStats
            });
            
            // Calculate differences if not first step
            if (step > 1) {
                const prevStats = accumulatedStats[step - 2].stats;
                const currentStats = sortedStats;
                const diff = getStatsDifference(currentStats, prevStats);
                
                statDifferences.push({
                    endTime: endTime,
                    endTimeFormatted: formatTime(endTime),
                    differences: diff
                });
                
                // Display differences
                console.log(`\nStat changes at this step (${Object.keys(diff).length} changes):`);
                if (Object.keys(diff).length === 0) {
                    console.log("  No changes detected");
                } else {
                    // Display the raw differences
                    console.dir(diff, { depth: null });
                }
            }
            
            // Show 5 most recent lastmodified times
            const recentModified = getMostRecentModifiedTimes(sortedStats);
            console.log("\n5 most recent lastmodified times:");
            if (Object.keys(recentModified).length === 0) {
                console.log("  No lastmodified entries found");
            } else {
                console.dir(recentModified, { depth: null });
            }
            
            // Find latest lastmodified time for next step
            const latestTimestamp = getLatestModifiedTimestamp(sortedStats);
            
            // If no lastmodified times found or we've reached ch5s1, stop
            if (latestTimestamp === 0 || latestTimestamp <= ch5s1Start) {
                console.log("\nReached end of search (no earlier lastmodified times or hit ch5s1 start date)");
                break;
            }
            
            // Set next end time to midnight GMT of the latest lastmodified date
            endTime = getMidnightGMT(latestTimestamp);
            
            // Break if we've gone back too far
            if (endTime <= ch5s1Start) {
                console.log("\nReached ch5s1 start date, stopping");
                break;
            }
            
            console.log(`\nWaiting 5 seconds before next step...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            step++;
        }
        
        // Save results to JSON file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${playerName}_stat_history_${timestamp}.json`;
        const filePath = join(__dirname, filename);
        
        const result = {
            playerName: playerInfo.displayName,
            playerId: playerInfo.id,
            filters: filters,
            generatedAt: new Date().toISOString(),
            accumulatedStats: accumulatedStats,
            statDifferences: statDifferences
        };
        
        writeFileSync(filePath, JSON.stringify(result, null, 2));
        console.log(`\nSaved results to ${filename}`);
        
    } catch (error) {
        console.error("Error searching stats history:", error);
    }
}

// Parse command line args
const args = process.argv.slice(2);
if (args.length < 1) {
    console.log("Usage:");
    console.log("  Normal mode: node fortniteRawStatDebug.js <playerName> [season|startTime endTime] [...filters] [...statPatterns]");
    console.log("  History search: node fortniteRawStatDebug.js --history <playerName> [...filters]");
    console.log("\nExamples:");
    console.log("  Season: node fortniteRawStatDebug.js PlayerName ch5s2 zeroBuild solo ranked kills wins");
    console.log("  Special season: node fortniteRawStatDebug.js PlayerName og zeroBuild duo pubs");
    console.log("  History search: node fortniteRawStatDebug.js --history PlayerName zeroBuild solo");
    console.log("\nAvailable filters:");
    console.log("  Team sizes: solo, duo, trio, squad");
    console.log("  Build modes: zeroBuild, build");
    console.log("  Competitive modes: pubs, ranked, bots");
    console.log("  Game modes: regular, reload");
    console.log("\nAvailable stat patterns (can use multiple):");
    console.log("  matches, kills, wins, top3, top5, top6, top10, top12, top25, minutes");
    console.log("\nAvailable seasons:");
    console.log("  " + Object.keys(seasonTimestamps).join(", "));
    console.log("\nDefault season: ch6s2");
    process.exit(1);
}

// Check for history mode
if (args[0] === '--history') {
    if (args.length < 2) {
        console.log("Error: Player name required for history search");
        process.exit(1);
    }
    
    const playerName = args[1];
    
    // Extract mode filters
    const { modeFilters } = parseFilterArgs(args.slice(2));
    
    // Run history search
    searchStatsHistory(playerName, modeFilters);
} else {
    // Normal mode - existing code remains the same
    const playerName = args[0];
    let timeWindow = {};
    let filters = [];
    let statPatternKeys = [];

    // Get default time window (ch6s2)
    const defaultSeason = 'ch6s2';
    const defaultTimeWindow = {
        startTime: seasonTimestamps[defaultSeason].startTime,
        endTime: seasonTimestamps[defaultSeason].endTime
    };

    // Process arguments
    if (args.length >= 2) {
        // First check if the second argument is a valid season name
        if (seasonTimestamps[args[1]]) {
            const season = args[1];
            timeWindow = {
                startTime: seasonTimestamps[season].startTime,
                endTime: seasonTimestamps[season].endTime
            };
            console.log(`Using season ${season}`);
            
            // Process remaining args
            if (args.length >= 3) {
                const { modeFilters, statPatterns } = parseFilterArgs(args.slice(2));
                filters = modeFilters;
                statPatternKeys = statPatterns;
            }
        } else if (args.length >= 3) {
            try {
                // Try to parse args[1] and args[2] as dates
                timeWindow = {
                    startTime: parseDate(args[1]),
                    endTime: parseDate(args[2])
                };
                
                // Process remaining args
                if (args.length >= 4) {
                    const { modeFilters, statPatterns } = parseFilterArgs(args.slice(3));
                    filters = modeFilters;
                    statPatternKeys = statPatterns;
                }
            } catch (error) {
                // If date parsing fails, use default season and assume all args after player name are filters/stat patterns
                timeWindow = defaultTimeWindow;
                
                const { modeFilters, statPatterns } = parseFilterArgs(args.slice(1));
                filters = modeFilters;
                statPatternKeys = statPatterns;
                
                console.log(`Using default season ${defaultSeason} with provided filters and stat patterns.`);
            }
        }
    } else {
        // Default to ch6s2
        timeWindow = defaultTimeWindow;
        console.log(`No time window specified. Using default season ${defaultSeason}.`);
    }

    // Run the stats retrieval
    getRawStats(playerName, timeWindow, filters, statPatternKeys);
}