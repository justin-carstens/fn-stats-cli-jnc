import { buildModes, gameModes, compModes, teamSizes, inputTypes, statPattern } from './fortniteModeConstants.js';
import { formatTime } from './dateUtils.js';

/**
 * Filters raw Fortnite stats based on user-provided filters
 * Applies the same logic as filterFortniteStats but maintains raw stat format
 * 
 * @param {Object} rawStats - The raw stats object from the API
 * @param {Array<string>} filters - Array of filter strings (e.g., ['zeroBuild', 'solo', 'ranked'])
 * @returns {Object} Filtered raw stats object containing only filtered entries
 */
export function filterRawFortniteStats(rawStats, filters = []) {
    // Parse filters into categories
    const buildFilters = filters?.filter(f => buildModes.includes(f)) ?? [];
    const gameFilters = filters?.filter(f => gameModes.includes(f)) ?? [];
    const compFilters = filters?.filter(f => compModes.includes(f)) ?? [];
    const teamFilters = filters?.filter(f => teamSizes.includes(f)) ?? [];
    const inputFilters = filters?.filter(f => inputTypes.includes(f)) ?? [];
    
    // Create the filtered stats object
    const filteredStats = {};
    
    // Process each key in raw stats
    Object.keys(rawStats.stats || {}).forEach(key => {
        // Classify this key
        const buildMode = key.includes('nobuild') ? 'zeroBuild' : 'build';
        
        // Game mode
        let gameMode='unknown';
        if (key.includes('nobuildbr') || key.includes('default')) {
            gameMode = 'regular';
        } else if (key.includes('punchberry') || key.includes('sunflower') || key.includes('blastberry')) {
            gameMode = 'reload';
        }

        // Comp mode
        let compMode='unknown';
        if (key.includes('habanero')) {
            compMode = 'ranked';
        } else if (key.includes('bots')) {
            compMode = 'bots';
        } else {
            compMode = 'pubs';
        }
        
        // Team size
        let teamSize='uknown';
        for (const size of teamSizes) {
            if (key.includes(size)) {
                teamSize = size;
                break;
            }
        }
        
        
        // Input type
        let inputType='unknown';
        if (key.includes('gamepad')) {
            inputType = 'gamepad';
        } else if (key.includes('keyboardmouse')) {
            inputType = 'keyboardmouse';
        }
        
         
        // Apply filters
        
        // Build mode filter
        if (buildFilters.length > 0 && !buildFilters.includes(buildMode)) return;
        
        // Game mode filter
        if (gameFilters.length > 0 && !gameFilters.includes(gameMode)) return;
        
        // Comp mode filter
        if (compFilters.length > 0) {
            if (!compFilters.includes(compMode)) return;
        } else if (compMode === 'bots') {
            return; // Default: exclude bots
        }
        
        // Team size filter
        if (teamFilters.length > 0 && !teamFilters.includes(teamSize)) return;
        
        // Input type filter
        if (inputFilters.length > 0 && !inputFilters.includes(inputType)) return;
        
        
        // Include this key in filtered results
        filteredStats[key] = rawStats.stats[key];
    });
    
    return { stats: filteredStats };
}

/**
 * Sort stats by keys and convert to a displayable format
 * @param {Object} stats - Stats object to sort
 * @returns {Object} Sorted stats object
 */
export function getSortedStats(stats) {
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
 * Extract and format lastmodified timestamps from stats object
 * @param {Object} stats - Stats object to process
 * @param {Object} options - Configuration options
 * @param {boolean} [options.ascending=false] - Sort direction (true = oldest first, false = newest first)
 * @param {number} [options.limit=0] - Maximum entries to return (0 = no limit)
 * @returns {Object} Object containing formatted lastmodified entries
 */
export function getModifiedTimes(stats, options = {}) {
    const { ascending = false, limit = 0 } = options;
    
    if (!stats) return {};
    
    // Find all lastmodified keys and their timestamps
    const entries = Object.keys(stats)
        .filter(key => key.includes('lastmodified'))
        .map(key => {
            const timestamp = parseInt(stats[key]);
            return { key, timestamp };
        });
    
    // Sort by timestamp
    entries.sort((a, b) => ascending ? (a.timestamp - b.timestamp) : (b.timestamp - a.timestamp));
    
    // Apply limit if specified
    const limitedEntries = limit > 0 ? entries.slice(0, limit) : entries;
    
    // Create ordered object with formatted dates
    const lastModified = {};
    limitedEntries.forEach(({ key, timestamp }) => {
        lastModified[key] = formatTime(timestamp) + ` (${timestamp})`;
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
export function filterByStatPatterns(stats, patterns) {
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
 * Find the latest lastmodified timestamp in stats object
 * @param {Object} stats - Stats object to process
 * @returns {number} Latest timestamp (or 0 if none found)
 */
export function getLatestModifiedTimestamp(stats) {
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
export function getStatsDifference(newStats, oldStats) {
    if (!newStats || !oldStats) return {};
    
    const diff = {};
    
    // Check each key in the new stats
    Object.keys(newStats).forEach(key => {
        // If key doesn't exist in oldStats, it's a new stat
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
                    formatTime(parseInt(newStats[key])) : 
                    newStats[key];
            }
        }
    });
    
    return diff;
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
 *    - If key is a lastmodified timestamp, use the value from larger window as-is
 *    - For all other stats, subtract smaller window value from larger window value
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
            }).map(key => {
                const largerWindowValue = largerWindow.stats[key];
                const smallerWindowValue = smallerWindow.stats[key];
                
                // If this is a lastmodified key, keep the largerWindow value without subtraction
                if (key.includes('lastmodified')) {
                    return [key, largerWindowValue || 0];
                } else {
                    // For all other stats, perform the subtraction
                    return [key, (largerWindowValue || 0) - (smallerWindowValue || 0)];
                }
            })
        )
    };
}