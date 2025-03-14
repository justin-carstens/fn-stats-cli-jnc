#!/usr/bin/env node

import { EpicClient } from './src/epicWrapper.js';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seasonTimestamps } from './src/getSeasonTimes.js';
import { filterRawFortniteStats, getSortedStats, getModifiedTimes, 
         filterByStatPatterns, getLatestModifiedTimestamp, 
         getStatsDifference } from './src/fortniteRawStatOps.js';
import { statPattern } from './src/fortniteModeConstants.js';
import { createFortniteStatObject, addFortniteRateStats, 
         transformToTRNFormat } from './src/fortniteStructuredStatOps.js';
import { parseFilterArgs, parseTimeWindowArg, parseStartEndTimeArgs } from './src/argParser.js';
import { getFortniteStats, authenticateClient } from './src/statsRetriever.js';
import { formatTime, adjustToEndOfDay, getMidnightGMT} from './src/dateUtils.js';

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
 * Retrieves and processes Fortnite stats for a player in a specific time window
 * @param {string} playerName - Epic Games display name
 * @param {Object} timeWindow - Time window {startTime, endTime}
 * @param {Array<string>} filters - Game mode filters to apply
 * @param {Array<string>} statPatternKeys - Optional stat pattern keys to filter by
 * @param {boolean} showRawStats - Whether to show raw stats instead of nested structure
 * @param {boolean} useTRNFormat - Whether to use TRN-style format for team sizes
 * @param {boolean} useAdvancedMethod - Whether to use the advanced triple API call technique
 * @param {boolean} quietMode - Whether to suppress logs
 * @param {EpicClient} [epicClient] - Optional existing authenticated client
 */
async function retrieveAndProcessFortniteStats(playerName, timeWindow, filters = [], statPatternKeys = [], 
                                              showRawStats = false, useTRNFormat = false, useAdvancedMethod = true,
                                              quietMode = false, epicClient = null) {
    try {
        // Get raw stats
        const rawStats = await getFortniteStats(playerName, timeWindow, useAdvancedMethod, quietMode, epicClient);
        
        // Display number of stats returned
        const statCount = Object.keys(rawStats.stats || {}).length;
        conditionalLog(`Retrieved ${statCount} raw stats`, quietMode);
        
        // Apply game mode filters first
        let filteredStats = rawStats;
        if (filters.length > 0) {
            filteredStats = filterRawFortniteStats(rawStats, filters);
            conditionalLog(`Applied mode filters: ${filters.join(', ')}`, quietMode);
            conditionalLog(`Stats count after mode filtering: ${Object.keys(filteredStats.stats || {}).length}`, quietMode);
        }
        
        // Then apply stat pattern filters if provided
        if (statPatternKeys.length > 0) {
            const statsBeforePatternFilter = Object.keys(filteredStats.stats || {}).length;
            filteredStats.stats = filterByStatPatterns(filteredStats.stats, statPatternKeys);
            
            // Display patterns being applied
            const patternStrings = statPatternKeys.map(key => 
                `'${key}' (${statPattern[key]})`
            ).join(', ');
            
            conditionalLog(`Applied stat pattern filters: ${patternStrings}`, quietMode);
            conditionalLog(`Stats count: ${statsBeforePatternFilter} → ${Object.keys(filteredStats.stats || {}).length} (always includes lastmodified)`, quietMode);
        }
        
        const filteredCount = Object.keys(filteredStats.stats || {}).length;
        
        // Build filter description for output
        const filterDesc = [
            ...(filters.length > 0 ? [`modes: ${filters.join(', ')}`] : []),
            ...(statPatternKeys.length > 0 ? [`stats: ${statPatternKeys.join(', ')}`] : []),
        ].join(', ');
        
        if (showRawStats) {
            // Raw stats mode - display the already filtered raw stats
            const headerText = filterDesc ? 
                `\nFiltered Raw Stats (${filterDesc}):` : 
                "\nAll Raw Stats (alphabetically sorted):";
                
            if (!quietMode) console.log(headerText);
            
            if (filteredCount === 0) {
                console.log("  No matching stats found");
            } else {
                if (!quietMode) console.log(`  Found ${filteredCount} matching stats`);
                const sortedStats = getSortedStats(filteredStats.stats);
                console.dir(sortedStats, { depth: null });
                
                // Show lastmodified dates for stats
                const lastModifiedTimes = getModifiedTimes(filteredStats.stats, { ascending: true });
                if (Object.keys(lastModifiedTimes).length > 0) {
                    console.log("\nLast Modified Times (GMT):");
                    console.dir(lastModifiedTimes, { depth: null });
                }
            }
        } else {
            // Nested structure mode - create structure from already filtered raw stats
            let nestedStatsHeader;
            if (useTRNFormat) {
                nestedStatsHeader = filterDesc ? 
                    `\nTRN-Style Stats (${filterDesc}, bots excluded):` : 
                    "\nTRN-Style Stats (bots excluded):";
            } else {
                nestedStatsHeader = filterDesc ? 
                    `\nNested Stat Structure (${filterDesc}):` : 
                    "\nNested Stat Structure:";
            }
            
            if (!quietMode) console.log(nestedStatsHeader);
            
            if (filteredCount === 0) {
                console.log("  No matching stats found");
            } else {
                // Check if bots should be included (explicitly requested in filters)
                const includeBots = filters.includes('bots');
                
                // Create nested structure from filtered raw stats
                let nestedStats = createFortniteStatObject(filteredStats, includeBots);
                
                // If TRN format is requested, transform the stats before adding rates
                if (useTRNFormat) {
                    // First transform to TRN format (just raw stats)
                    nestedStats = transformToTRNFormat(nestedStats);
                }
                
                // Add rate calculations to either the normal structure or the TRN structure
                const statsWithRates = addFortniteRateStats(nestedStats);
                
                // Display the final structure
                console.dir(statsWithRates, { depth: null });
            }
        }
        
    } catch (error) {
        console.error("Error retrieving stats:", error);
    }
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
            const recentModified = getModifiedTimes(sortedStats, { limit: 5 });
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
    console.log("  Normal mode: node fortniteRawStatDebug.js <playerName> [season|timeWindow] [...filters] [...statPatterns]");
    console.log("  History search: node fortniteRawStatDebug.js --history <playerName> [...filters]");
    console.log("  Raw stats mode: node fortniteRawStatDebug.js --raw <playerName> [season|timeWindow] [...filters] [...statPatterns]");
    console.log("  TRN format: node fortniteRawStatDebug.js --TRN <playerName> [season|timeWindow] [...filters] [...statPatterns]");
    console.log("  Direct API mode: node fortniteRawStatDebug.js --direct <playerName> [season|timeWindow] [...filters] [...statPatterns]");
    console.log("  Quiet mode: node fortniteRawStatDebug.js --quiet <playerName> [season|timeWindow] [...filters] [...statPatterns]");
    console.log("  Combined modes: Can combine flags (e.g., --direct --raw --quiet <playerName>)");
    console.log("\nExamples:");
    console.log("  Season: node fortniteRawStatDebug.js PlayerName ch5s2 zeroBuild solo ranked kills wins");
    console.log("  Special season: node fortniteRawStatDebug.js PlayerName og zeroBuild duo pubs");
    console.log("  Custom time window: node fortniteRawStatDebug.js PlayerName starttime=\"2023-01-01\" endtime=\"2023-01-31\" zeroBuild");
    console.log("  Last N days: node fortniteRawStatDebug.js PlayerName lastday=3 zeroBuild solo");
    console.log("  Last N weeks: node fortniteRawStatDebug.js PlayerName lastweek=2 duo pubs");
    console.log("  Last N months: node fortniteRawStatDebug.js PlayerName lastmonth=1 squad");
    console.log("  History search: node fortniteRawStatDebug.js --history PlayerName zeroBuild solo");
    console.log("  Raw stats: node fortniteRawStatDebug.js --raw PlayerName ch6s2 zeroBuild");
    console.log("  TRN-style: node fortniteRawStatDebug.js --TRN PlayerName ch6s2 solo");
    console.log("  Direct API: node fortniteRawStatDebug.js --direct PlayerName ch6s2 zeroBuild");
    console.log("  Quiet output: node fortniteRawStatDebug.js --quiet PlayerName ch6s2 zeroBuild");
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

// Check for special modes
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
    // Check for special modes - use includes() to allow flags in any position
    const showRawStats = args.includes('--raw') || args.includes('-r');
    const useTRNFormat = args.includes('--TRN') || args.includes('-t');
    let useDirectMethod = args.includes('--direct') || args.includes('-d');
    const quietMode = args.includes('--quiet') || args.includes('-q');
    
    
    // Remove all option flags to get the real arguments
    const realArgs = args.filter(arg => 
        arg !== '--raw' && arg !== '-r' && 
        arg !== '--TRN' && arg !== '-t' && 
        arg !== '--direct' && arg !== '-d' &&
        arg !== '--quiet' && arg !== '-q'
    );
    
    // Ensure there's at least one real argument (player name)
    if (realArgs.length < 1) {
        console.log("Error: Player name required");
        process.exit(1);
    }
    
    const playerName = realArgs[0];
    let timeWindow = {};
    let filters = [];
    let statPatternKeys = [];
    
    // Process remaining arguments after player name
    const offsetArgs = realArgs.slice(1);

    // Get default time window (ch6s2)
    const defaultSeason = 'ch6s2';
    const defaultTimeWindow = {
        startTime: useDirectMethod ? 
            seasonTimestamps[defaultSeason].startTime : 
            adjustToEndOfDay(seasonTimestamps[defaultSeason].startTime),
        endTime: adjustToEndOfDay(seasonTimestamps[defaultSeason].endTime)
    };

    // First check for starttime= and endtime= parameters
    const { timeWindow: customTimeWindow, foundCustomTime, remainingArgs: argsAfterCustomTime } = parseStartEndTimeArgs(offsetArgs, quietMode);

    // Then check for time window shortcuts if custom time wasn't found
    let timeWindowFound = foundCustomTime;
    let argsToProcess = argsAfterCustomTime;

    if (foundCustomTime) {
        // Use the custom time window, filling in any missing parts with defaults
        timeWindow = {
            startTime: customTimeWindow.startTime !== null ? customTimeWindow.startTime : defaultTimeWindow.startTime,
            endTime: customTimeWindow.endTime !== null ? customTimeWindow.endTime : defaultTimeWindow.endTime
        };
    } else {
        // Check for lastday/lastweek/lastmonth time shortcuts
        const remainingArgsAfterShortcuts = [];

        for (const arg of argsAfterCustomTime) {
            const parsedTimeWindow = parseTimeWindowArg(arg);
            if (parsedTimeWindow) {
                timeWindow = parsedTimeWindow;
                timeWindowFound = true;
                conditionalLog(`Using time window: ${formatTime(timeWindow.startTime)} to ${formatTime(timeWindow.endTime)}`, quietMode);
            } else {
                remainingArgsAfterShortcuts.push(arg);
            }
        }

        argsToProcess = remainingArgsAfterShortcuts;
    }

    // Only process season args if no time window was found yet
    if (!timeWindowFound) {
        // Check if the first argument is a valid season name
        if (argsToProcess.length >= 1 && seasonTimestamps[argsToProcess[0]]) {
            const season = argsToProcess[0];
            
            // For season queries, only adjust startTime to end-of-day when using advanced method
            timeWindow = {
                // Only adjust startTime to end-of-day when using advanced method
                startTime: useDirectMethod ? 
                    seasonTimestamps[season].startTime : 
                    adjustToEndOfDay(seasonTimestamps[season].startTime), 
                endTime: adjustToEndOfDay(seasonTimestamps[season].endTime)
            };
            
            const startTimeAdjustMsg = useDirectMethod ? 
                "adjusted end time to end of day" : 
                "adjusted start and end times to end of day";
                
            conditionalLog(`Using season ${season} (${startTimeAdjustMsg})`, quietMode);
            
            // Remove season from args
            argsToProcess = argsToProcess.slice(1);
        } else {
            // Default to ch6s2
            timeWindow = defaultTimeWindow;
            
            const startTimeAdjustMsg = useDirectMethod ? 
                "adjusted end time to end of day" : 
                "adjusted start and end times to end of day";
                
            conditionalLog(`No time window specified. Using default season ${defaultSeason} (${startTimeAdjustMsg}).`, quietMode);
        }
    }

    // Process remaining arguments as filters and stat patterns
    if (argsToProcess.length > 0) {
        const { modeFilters, statPatterns } = parseFilterArgs(argsToProcess);
        filters = modeFilters;
        statPatternKeys = statPatterns;
    }

    // Handle special case: If either startTime or endTime is 0, use ch1s1 startTime
    if (timeWindow.startTime === 0) {
        timeWindow.startTime = seasonTimestamps.ch1s1.startTime;
        conditionalLog(`Using Ch1S1 start time (${formatTime(timeWindow.startTime)}) for startTime=0`, quietMode);
    }
    
    if (timeWindow.endTime === 0) {
        timeWindow.endTime = seasonTimestamps.ch1s1.startTime;
        conditionalLog(`Using Ch1S1 start time (${formatTime(timeWindow.endTime)}) for endTime=0`, quietMode);
    }

    // Force direct method if startTime is lifetime stats (≤ ch1s1 start time)
    if (timeWindow.startTime <= seasonTimestamps.ch1s1.startTime) {
        conditionalLog(`Start time (${formatTime(timeWindow.startTime)}) is at or before Ch1S1 start time (${formatTime(seasonTimestamps.ch1s1.startTime)})`, quietMode);
        conditionalLog("Automatically using direct API method for lifetime stats", quietMode);
        useDirectMethod = true;
    }

    // Add debug information
    conditionalLog(`Filters parsed: ${JSON.stringify(filters)}`, quietMode);
    conditionalLog(`Stat patterns parsed: ${JSON.stringify(statPatternKeys)}`, quietMode);
    
    // Report on which methods are being used
    conditionalLog(useDirectMethod ? "Using direct API call method (single API call)" : "Using advanced triple API call technique", quietMode);
    conditionalLog(showRawStats ? "Showing raw stats output" : "", quietMode && !showRawStats);
    conditionalLog(useTRNFormat ? "Using TRN-style format" : "", quietMode && !useTRNFormat);
    conditionalLog(quietMode ? "Quiet mode enabled - suppressing logs" : "", quietMode);

    // Create a single Epic client for this session
    const epicClient = new EpicClient();
    await authenticateClient(epicClient, quietMode);

    // Run the stats retrieval with appropriate flags
    retrieveAndProcessFortniteStats(
        playerName, 
        timeWindow, 
        filters, 
        statPatternKeys, 
        showRawStats, 
        useTRNFormat, 
        !useDirectMethod,
        quietMode,
        epicClient  // Pass the authenticated client
    );
}