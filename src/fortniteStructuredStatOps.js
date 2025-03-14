import { buildModes, gameModes, compModes, teamSizes, statPattern } from './fortniteModeConstants.js';

/**
 * Core statistics processing functions for Fortnite data
 */

/**
 * Transforms raw API stats into a structured hierarchical object
 * Raw stats come as flat key-value pairs like:
 * "br_kills_keyname": 123
 * This function organizes them into a nested structure:
 * buildMode -> gameMode -> compMode -> teamSize -> stats
 * 
 * Filtering logic:
 * - Build modes: Uses 'nobuild' presence in key
 * - Game modes: Matches specific playlist patterns (br/berry variants)
 * - Comp modes: Checks for habanero (ranked) and bots markers
 * - Team sizes: Matches size pattern in key name
 * 
 * @param {Object} rawStats - Raw stats from Epic Games API
 * @param {boolean} includeBots - Whether to include bot matches in the structure (default: false)
 * @returns {Object} Structured stats object
 */
export function createFortniteStatObject(rawStats, includeBots = false) {
    // Create empty result object and get all stat keys
    const statObject = {};
    const keys = Object.keys(rawStats.stats || {});
    
    // Skip processing if there are no stats
    if (keys.length === 0) {
        return statObject;
    }

    // First level: Build modes (zeroBuild/build)
    for (const buildMode of buildModes) {
        // Filter keys for this build mode (nobuild vs regular)
        const keyBuild = keys.filter(key => 
            buildMode === 'zeroBuild' ? key.includes('nobuild') : !key.includes('nobuild')
        );
        
        // Skip this build mode if no matching keys
        if (keyBuild.length === 0) continue;
        
        const buildModeObject = {};
        let hasBuildModeChildren = false;

        // Second level: Game modes (regular/reload)
        for (const gameMode of gameModes) {
            // Filter for game mode specific patterns
            const keyGame = keyBuild.filter(key => 
                (gameMode === 'regular' && 
                    (key.includes('nobuildbr') || key.includes('default'))) 
                ||
                (gameMode === 'reload' && 
                    (key.includes('punchberry') || key.includes('sunflower') || key.includes('blastberry')))
            );
            
            // Skip this game mode if no matching keys
            if (keyGame.length === 0) continue;
            
            const gameModeObject = {};
            let hasGameModeChildren = false;

            // Third level: Competitive modes (pubs/ranked/bots)
            for (const compMode of compModes) {
                // Skip bots mode unless explicitly requested
                if (compMode === 'bots' && !includeBots) continue;
                
                const keyComp = keyGame.filter(key => 
                    (compMode === 'pubs' && 
                        !key.includes('habanero') && !key.includes('bots')) 
                    ||
                    (compMode === 'ranked' && 
                        key.includes('habanero')) 
                    ||
                    (compMode === 'bots' && 
                        key.includes('bots'))
                );
                
                // Skip this comp mode if no matching keys
                if (keyComp.length === 0) continue;
                
                const compModeObject = {};
                let hasCompModeChildren = false;

                // Fourth level: Team sizes
                for (const size of teamSizes) {
                    // Skip trio in reload mode
                    if (gameMode === 'reload' && size === 'trio') continue;

                    const keySizeComp = keyComp.filter(key => key.includes(size));
                    
                    // Skip this team size if no matching keys
                    if (keySizeComp.length === 0) continue;

                    // Check for matches first to determine if this team size has any stats
                    const matchesKey = keySizeComp.filter(key => key.includes(statPattern.matches));
                    if (matchesKey.length === 0 || 
                        matchesKey.reduce((sum, key) => sum + rawStats.stats[key], 0) === 0) {
                        continue; // Skip this team size if no matches or zero matches
                    }

                    // Create team size object and add stats
                    const teamSizeObject = {};
                    
                    // Process all stat types for this team size
                    Object.entries(statPattern).forEach(([statName, pattern]) => {
                        const keyStat = keySizeComp.filter(key => key.includes(pattern));
                        if (keyStat.length > 0) {
                            const accumulatedStats = keyStat.reduce((sum, key) => sum + rawStats.stats[key], 0);
                            teamSizeObject[statName] = accumulatedStats;
                        }
                    });
                    
                    // Only add team size if it has stats
                    if (Object.keys(teamSizeObject).length > 0) {
                        compModeObject[size] = teamSizeObject;
                        hasCompModeChildren = true;
                    }
                }

                // Only add comp mode if it has children
                if (hasCompModeChildren) {
                    gameModeObject[compMode] = compModeObject;
                    hasGameModeChildren = true;
                }
            }

            // Only add game mode if it has children
            if (hasGameModeChildren) {
                buildModeObject[gameMode] = gameModeObject;
                hasBuildModeChildren = true;
            }
        }

        // Only add build mode if it has children
        if (hasBuildModeChildren) {
            statObject[buildMode] = buildModeObject;
        }
    }

    return statObject;
}

/**
 * Enriches Fortnite stats with calculated rates and ratios
 * Processes the entire stat structure recursively, adding derived statistics
 * at each leaf node (actual match statistics).
 * 
 * Calculated stats include:
 * - Win rate (wins/matches)
 * - Various placement rates (top3/matches, top5/matches, etc.)
 * - K/D ratio (kills/(matches-wins)) - excludes matches won as there's no death
 * - Kills per 20 minutes - normalized for comparison
 * - Minutes per kill - average time between kills
 * 
 * Note: Ensures stats exist before calculation, defaults to 0 for missing wins/kills
 * 
 * @param {Object} statObject - Structured stats from createFortniteStatObject
 * @returns {Object} Enhanced stats with calculated rates and ratios
 */
export function addFortniteRateStats(statObject) {
    // Create deep copy to avoid modifying original data
    let statSummary = JSON.parse(JSON.stringify(statObject));
    
    /**
     * Internal recursive function to process stats at each level
     * When it reaches a node with 'matches', it knows it's at a leaf node
     * with actual match statistics that need rate calculations
     */
    function recurseSummary(statSummary) {
        // Check if we've reached a leaf node (actual match stats)
        if (statSummary.hasOwnProperty('matches')) {
            // Ensure required properties exist
            if (!statSummary.hasOwnProperty('wins')) statSummary.wins = 0;
            if (!statSummary.hasOwnProperty('kills')) statSummary.kills = 0;
            
            // Add win rate calculation
            statSummary.winRate = statSummary.wins/statSummary.matches;
            
            // Calculate win and placement rates
            if (statSummary.hasOwnProperty('top3')) 
                statSummary.top3Rate = statSummary.top3/statSummary.matches;
            if (statSummary.hasOwnProperty('top5')) 
                statSummary.top5Rate = statSummary.top5/statSummary.matches;
            if (statSummary.hasOwnProperty('top6')) 
                statSummary.top6Rate = statSummary.top6/statSummary.matches;
            if (statSummary.hasOwnProperty('top10')) 
                statSummary.top10Rate = statSummary.top10/statSummary.matches;
            if (statSummary.hasOwnProperty('top12')) 
                statSummary.top12Rate = statSummary.top12/statSummary.matches;
            if (statSummary.hasOwnProperty('top25')) 
                statSummary.top25Rate = statSummary.top25/statSummary.matches;
            
            // Calculate combat statistics
            // K/D excludes matches won (no death in wins)
            statSummary.killsPerDeath = statSummary.kills/(statSummary.matches-statSummary.wins);
            // Normalize kills to per-20-minute rate for comparison
            statSummary.killsPer20 = statSummary.kills*20/statSummary.minutes;
            // Average time between kills
            statSummary.minutesPerKill = statSummary.minutes/statSummary.kills;

            return statSummary;
        }
        // Not a leaf node, continue recursion
        Object.keys(statSummary).forEach((e,i) => {
            statSummary[e] = recurseSummary(statSummary[e]);
        });
        return statSummary;
    }
    
    return recurseSummary(statSummary);
}

/**
 * Subtracts structured Fortnite stats for overlapping time periods
 * Used when we have accumulated stats in structured format and want to
 * isolate stats for the non-overlapping period.
 * 
 * Example:
 * Period A: [Jan 1 -> Mar 31] (largerWindow)
 * Period B: [Feb 1 -> Mar 31] (smallerWindow)
 * Result: [Jan 1 -> Jan 31] (isolated period)
 * 
 * Process:
 * - Recursively traverses the stat structure
 * - At leaf nodes, subtracts accumulated values
 * - Maintains hierarchy while performing subtraction
 * 
 * Edge Cases:
 * - Missing branch in larger window: Returns 0
 * - Missing branch in smaller window: Uses larger window value
 * - Missing leaf values: Treated as 0
 * 
 * @param {Object} largerWindow - Structured stats from longer time period
 * @param {Object} smallerWindow - Structured stats from shorter, overlapping period
 * @returns {Object} Structured stats for the isolated period
 */
export function subtractFortniteStatStructures(largerWindow, smallerWindow) {
    function isObject(item) {
        return (item && typeof item === 'object' && !Array.isArray(item));
    }

    function recursiveSubtract(larger, smaller) {
        if (!isObject(larger) || !isObject(smaller)) {
            if (larger === undefined) return 0;
            if (smaller === undefined) return larger;
            return larger - smaller;
        }

        const result = {};
        const allKeys = new Set([
            ...Object.keys(larger || {}),
            ...Object.keys(smaller || {})
        ]);

        allKeys.forEach(key => {
            result[key] = recursiveSubtract(larger[key], smaller[key]);
        });

        return result;
    }

    return recursiveSubtract(largerWindow, smallerWindow);
}

/**

/**
 * Transforms the standard nested Fortnite stats into TRN-style format
 * where stats are grouped only by team size (solo, duo, trio, squad)
 * 
 * @param {Object} stats - Standard nested stats object
 * @returns {Object} TRN-style stats with only team size grouping (raw values only)
 */
export function transformToTRNFormat(stats) {
    // Initialize result with team sizes
    const result = {};
    
    // Process all build modes
    for (const buildMode of Object.keys(stats)) {
        // Process all game modes
        for (const gameMode of Object.keys(stats[buildMode])) {
            // Process all comp modes except bots
            for (const compMode of Object.keys(stats[buildMode][gameMode])) {
                if (compMode === 'bots') continue;
                
                // Process all team sizes
                for (const teamSize of Object.keys(stats[buildMode][gameMode][compMode])) {
                    // Get stats for this team size
                    const teamStats = stats[buildMode][gameMode][compMode][teamSize];
                    
                    // Initialize this team size if it doesn't exist
                    if (!result[teamSize]) {
                        result[teamSize] = {
                            matches: 0,
                            wins: 0,
                            kills: 0,
                            minutes: 0,
                        };
                    }
                    
                    // Aggregate raw stats only (not calculated rates)
                    for (const statKey of Object.keys(teamStats)) {
                        if (typeof teamStats[statKey] === 'number' && 
                            !statKey.endsWith('Rate') && 
                            !['killsPerDeath', 'killsPer20', 'minutesPerKill'].includes(statKey)) {
                            result[teamSize][statKey] = (result[teamSize][statKey] || 0) + teamStats[statKey];
                        }
                    }
                }
            }
        }
    }
    
    return result;
}
