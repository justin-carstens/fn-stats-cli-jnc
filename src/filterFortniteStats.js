import { buildModes, gameModes, compModes, teamSizes } from './fortniteModeConstants.js';

/**
 * Filters Fortnite statistics based on user-provided filters
 * @param {Object} stats - The hierarchical stats object to filter
 * @param {Array<string>} filters - Array of filter strings (e.g., ['zeroBuild', 'solo', 'ranked'])
 * @returns {Object} Filtered stats object containing only requested modes/sizes
 */
export function filterFortniteStats(stats, filters) {
    let filteredStats = JSON.parse(JSON.stringify(stats));

    const buildFilters = filters?.filter(f => buildModes.includes(f)) ?? [];
    const gameFilters = filters?.filter(f => gameModes.includes(f)) ?? [];
    const compFilters = filters?.filter(f => compModes.includes(f)) ?? [];
    const teamFilters = filters?.filter(f => teamSizes.includes(f)) ?? [];

    // Remove bots mode by default unless explicitly requested
    Object.keys(filteredStats).forEach(buildMode => {
        Object.keys(filteredStats[buildMode] || {}).forEach(gameMode => {
            Object.keys(filteredStats[buildMode][gameMode] || {}).forEach(compMode => {
                if (compMode === 'bots' && !compFilters.includes('bots')) {
                    delete filteredStats[buildMode][gameMode][compMode];
                }
            });
        });
    });

    // Handle build mode filtering
    Object.keys(filteredStats).forEach(buildMode => {
        if (buildFilters.length > 0) {
            if (!buildFilters.includes(buildMode)) {
                delete filteredStats[buildMode];
            }
        } else if (buildMode === 'build') {
            delete filteredStats[buildMode];
        }
    });

    // Apply remaining filters if any exist
    if (filters?.length > 0) {
        Object.keys(filteredStats).forEach(buildMode => {
            if (!filteredStats[buildMode]) return;
            
            // Filter game modes
            if (gameFilters.length > 0) {
                Object.keys(filteredStats[buildMode]).forEach(gameMode => {
                    if (!gameFilters.includes(gameMode)) {
                        delete filteredStats[buildMode][gameMode];
                    }
                });
            }
            
            // Filter comp modes and team sizes
            Object.keys(filteredStats[buildMode] || {}).forEach(gameMode => {
                // Apply comp mode filters
                if (compFilters.length > 0) {
                    Object.keys(filteredStats[buildMode][gameMode]).forEach(compMode => {
                        if (!compFilters.includes(compMode)) {
                            delete filteredStats[buildMode][gameMode][compMode];
                        }
                    });
                }
                
                // Apply team size filters
                Object.keys(filteredStats[buildMode][gameMode] || {}).forEach(compMode => {
                    if (teamFilters.length > 0) {
                        Object.keys(filteredStats[buildMode][gameMode][compMode]).forEach(teamSize => {
                            if (!teamFilters.includes(teamSize)) {
                                delete filteredStats[buildMode][gameMode][compMode][teamSize];
                            }
                        });
                    }
                });
            });
        });
    }

    return filteredStats;
}
