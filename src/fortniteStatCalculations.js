import { buildModes, gameModes, compModes, teamSizes, statPattern } from './fortniteModeConstants.js';

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
 * @returns {Object} Structured stats object
 */
export function createFortniteStatObject(rawStats) {
    // Create empty result object and get all stat keys
    const statObject = {};
    const keys = Object.keys(rawStats.stats);

    // First level: Build modes (zeroBuild/build)
    buildModes.forEach((buildMode) => {
        statObject[buildMode] = {};
        // Filter keys for this build mode (nobuild vs regular)
        const keyBuild = keys.filter(key => 
            buildMode === 'zeroBuild' ? key.includes('nobuild') : !key.includes('nobuild')
        );

        // Second level: Game modes (regular/reload)
        gameModes.forEach((gameMode) => {
            statObject[buildMode][gameMode] = {};
            // Filter for game mode specific patterns
            // Regular mode uses 'nobuildbr' or 'default'
            // Reload mode uses various berry-themed playlist names
            const keyGame = keyBuild.filter(key => 
                (gameMode === 'regular' && 
                    (key.includes('nobuildbr') || key.includes('default'))) 
                ||
                (gameMode === 'reload' && 
                    (key.includes('punchberry') || key.includes('sunflower') || key.includes('blastberry')))
            );

            // Third level: Competitive modes (pubs/ranked/bots)
            compModes.forEach((compMode) => {
                statObject[buildMode][gameMode][compMode] = {};
                const keyComp = keyGame.filter(key => 
                    (compMode === 'pubs' && //pubs are games which don't have habanero (ranked) or bots
                        !key.includes('habanero') && !key.includes('bots')) 
                    ||
                    (compMode === 'ranked' && 
                        key.includes('habanero')) 
                    ||
                    (compMode === 'bots' && 
                        key.includes('bots'))
                );

                teamSizes.forEach((size) => {
                    if (gameMode === 'reload' && size === 'trio') return;

                    statObject[buildMode][gameMode][compMode][size] = {};
                    const keySizeComp = keyComp.filter(key => key.includes(size));

                    // Check for matches first
                    const matchesKey = keySizeComp.filter(key => key.includes(statPattern.matches));
                    if (matchesKey.length > 0) {
                        const matchCount = matchesKey.reduce((sum, key) => sum + rawStats.stats[key], 0);
                        if (matchCount === 0) return; // Skip this team size if no matches
                    }

                    // Process remaining stats only if matches exist
                    Object.entries(statPattern).forEach(([statName, pattern]) => {
                        const keyStat = keySizeComp.filter(key => key.includes(pattern));
                        if (keyStat.length > 0) {
                            const accumulatedStats = keyStat.reduce((sum, key) => sum + rawStats.stats[key], 0);
                            statObject[buildMode][gameMode][compMode][size][statName] = accumulatedStats;
                        }
                    });
                });
            });
        });
    });

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
 * Subtracts raw Fortnite stats for overlapping time periods
 * Used when we have accumulated stats for two overlapping time windows
 * and want to isolate the stats for the non-overlapping period.
 * 
 * Example:
 * Period A: [Jan 1 -> Mar 31] (largerWindow)
 * Period B: [Feb 1 -> Mar 31] (smallerWindow)
 * Result: [Jan 1 -> Jan 31] (isolated period)
 * 
 * Process:
 * 1. Combines all possible stat keys from both periods
 * 2. For each stat key:
 *    - Takes value from larger time window
 *    - Subtracts value from smaller window (overlapping period)
 * 3. Returns raw stats for the isolated period
 * 
 * Edge Cases:
 * - Missing keys in larger window: Treated as 0
 * - Missing keys in smaller window: Treated as 0
 * - Keys in neither: Won't appear in result
 * 
 * @param {Object} largerWindow - Raw stats object from the longer time period
 * @param {Object} smallerWindow - Raw stats object from the shorter, overlapping period
 * @returns {Object} Raw stats object for the isolated period
 */
export function subtractRawFortniteStats(largerWindow, smallerWindow) {
    return {
        stats: Object.fromEntries(
            Object.keys({
                ...largerWindow.stats,
                ...smallerWindow.stats
            }).map(key => [
                key,
                (largerWindow.stats[key] || 0) - (smallerWindow.stats[key] || 0)
            ])
        )
    };
}
