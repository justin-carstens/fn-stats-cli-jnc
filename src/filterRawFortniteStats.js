import { buildModes, gameModes, compModes, teamSizes } from './fortniteModeConstants.js';

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
    
    // Create the filtered stats object
    const filteredStats = {};
    
    // Process each key in raw stats
    Object.keys(rawStats.stats || {}).forEach(key => {
        // Classify this key
        const buildMode = key.includes('nobuild') ? 'zeroBuild' : 'build';
        
        // Game mode
        let gameMode;
        if (key.includes('nobuildbr') || key.includes('default')) {
            gameMode = 'regular';
        } else if (key.includes('punchberry') || key.includes('sunflower') || key.includes('blastberry')) {
            gameMode = 'reload';
        } else {
            return; // Unknown game mode
        }
        
        // Comp mode
        let compMode;
        if (key.includes('habanero')) {
            compMode = 'ranked';
        } else if (key.includes('bots')) {
            compMode = 'bots';
        } else {
            compMode = 'pubs';
        }
        
        // Team size
        let teamSize;
        for (const size of teamSizes) {
            if (key.includes(size)) {
                teamSize = size;
                break;
            }
        }
        if (!teamSize) return; // Unknown team size
        
        // Skip reload + trio combination
        if (gameMode === 'reload' && teamSize === 'trio') return;
        
        // Apply filters
        
        // Build mode filter
        if (buildFilters.length > 0) {
            if (!buildFilters.includes(buildMode)) return;
        } else if (buildMode === 'build') {
            return; // Default: exclude build mode
        }
        
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
        
        // Include this key in filtered results
        filteredStats[key] = rawStats.stats[key];
    });
    
    return { stats: filteredStats };
}