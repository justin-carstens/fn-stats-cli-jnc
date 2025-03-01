import { EpicClient } from './epicWrapper.js';
import { readFileSync } from 'node:fs';

// Constants that define valid Fortnite gameplay modes and configurations
export const teamSizes = ['solo', 'duo', 'trio', 'squad'];
export const buildModes = ['zeroBuild', 'build'];
export const compModes = ['pubs', 'ranked', 'bots'];
export const gameModes = ['regular', 'reload'];

export class PlayerStats {
    constructor(epicName, timeWindow, filter) {
        this.epicName = epicName;
        this.timeWindow = timeWindow;
        this.epicClient = new EpicClient();
        this.stats = this.getStats();
        this.reportStats(filter);
    }

    // Authenticates with Epic Games using device auth grant
    loginEpic = async (epicClient) => {
        const grant = JSON.parse(
            readFileSync('./deviceAuthGrant.json', 'utf8')
        );
        console.log(epicClient.accountId);
        if (epicClient.accountId == null) {
            console.log("Not logged in, awaiting authentication.");
            const loginResponse = await epicClient.auth.authenticate(grant);
            console.log(`Authenticated with the account ${loginResponse.displayName}`);
        } else {
            console.log("Already authenticated.");
        }
    }

    // Calculates the difference between two stat objects recursively
    // Used to get stats for a specific time window
    subtractStats(statsFromStartToNow, statsFromEndToNow) {
        function isObject(item) {
            return (item && typeof item === 'object' && !Array.isArray(item));
        }
    
        function recursiveSubtract(start, end) {
            if (!isObject(start) || !isObject(end)) {
                if (start === undefined) return 0;
                if (end === undefined) return start;
                return start - end;
            }
    
            const result = {};
            const allKeys = new Set([
                ...Object.keys(start || {}),
                ...Object.keys(end || {})
            ]);
    
            allKeys.forEach(key => {
                result[key] = recursiveSubtract(start[key], end[key]);
            });
    
            return result;
        }
    
        return recursiveSubtract(statsFromStartToNow, statsFromEndToNow);
    }

    // Transforms raw API stats into a structured object organized by
    // buildMode -> gameMode -> compMode -> teamSize
    getStatObject = (rawStats) => {
        // Define patterns to match stat names in the API response
        const statPattern = {
            matches: 'br_matchesplayed',
            kills: 'br_kills',
            wins: 'br_placetop1_',
            top3: 'br_placetop3_',
            top5: 'br_placetop5_',
            top6: 'br_placetop6_',
            top10: 'br_placetop10_',
            top12: 'br_place_top12_',
            top25: 'br_placetop25_',
            minutes: 'br_minutesplayed'
        }
    
        // Build the hierarchical stat object
        // First level: Build modes (zeroBuild/build)
        // Second level: BR Game modes (regular/reload)
        // Third level: Competitive modes (pubs/ranked/bots)
        // Fourth level: Team sizes
        const statObject = {};
        const keys = Object.keys(rawStats.stats);
    
        buildModes.forEach((buildMode) => {
            statObject[buildMode] = {};
            const keyBuild = keys.filter(key => 
                buildMode === 'zeroBuild' ? key.includes('nobuild') : !key.includes('nobuild')
            );
    
            gameModes.forEach((gameMode) => {
                statObject[buildMode][gameMode] = {};
                const keyGame = keyBuild.filter(key => 
                    (gameMode === 'regular' && // Regular mode
                        (key.includes('nobuildbr') || key.includes('default'))) 
                    ||
                    (gameMode === 'reload' && // Reload mode
                        (key.includes('punchberry') || key.includes('sunflower') || key.includes('blastberry')))
                );
    
                compModes.forEach((compMode) => {
                    statObject[buildMode][gameMode][compMode] = {};
                    const keyComp = keyGame.filter(key => 
                        (compMode === 'pubs' && // Pubs mode
                            !key.includes('habanero') && !key.includes('bots')) 
                        ||
                        (compMode === 'ranked' && // Ranked mode
                            key.includes('habanero')) 
                        ||
                        (compMode === 'bots' && // Bots mode
                            key.includes('bots'))
                    );
    
                    teamSizes.forEach((size) => {
                        // Skip trio size for reload mode
                        if (gameMode === 'reload' && size === 'trio') return;

                        statObject[buildMode][gameMode][compMode][size] = {};
                        // finally, filter by team size
                        const keySizeComp = keyComp.filter(key => key.includes(size));
    
                        // For each stat we want to collect, find the matching keys and sum them if multiple
                        Object.entries(statPattern).forEach(([statName, pattern]) => {
                            // Find keys that match the pattern
                            const keyStat = keySizeComp.filter(key => key.includes(pattern));
                            // Sum the values of the matching keys (mostly needed for reload playlists and/or multiple input methods)
                            if (keyStat.length > 0) {
                                statObject[buildMode][gameMode][compMode][size][statName] = 
                                    keyStat.reduce((sum, key) => sum + rawStats.stats[key], 0);
                            }
                        });
                    });
                });
            });
        });
    
        return statObject;
    };

    // Calculates derived statistics (rates, ratios) from raw stats
    getStatSummary = (statObject) => {
        let statSummary = JSON.parse(JSON.stringify(statObject));
        function recurseSummary(statSummary) {
            if (statSummary.hasOwnProperty('matches')) {
                if (!statSummary.hasOwnProperty('wins')) statSummary.wins = 0;
                if (!statSummary.hasOwnProperty('kills')) statSummary.kills = 0;
                
                statSummary.winRate = statSummary.wins/statSummary.matches;
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
                
                statSummary.killsPerDeath = statSummary.kills/(statSummary.matches-statSummary.wins);
                statSummary.killsPer20 = statSummary.kills*20/statSummary.minutes;
                statSummary.minutesPerKill = statSummary.minutes/statSummary.kills;

                return statSummary;
            }
            Object.keys(statSummary).forEach((e,i) => {
                statSummary[e] = recurseSummary(statSummary[e]);
            });
            return statSummary;
        }
        return recurseSummary(statSummary);
    };

    // Main method to fetch and process stats from Epic API
    getStats = async () => {
        await this.loginEpic(this.epicClient);
        this.epicId = await this.epicClient.getAccountByDisplayName(this.epicName);

        const fromStartToNow = {...this.timeWindow};
        fromStartToNow.endTime = Math.round(Date.now()/1000+86400);

        const fromEndToNow = {...fromStartToNow};
        fromEndToNow.startTime = this.timeWindow.endTime;

        const rawFromStartToNow = await this.epicClient.fortnite.getStats(this.epicId.id, fromStartToNow);
        let rawFromEndToNow = {stats: {}};
        if (fromEndToNow.startTime <= fromStartToNow.endTime) {
            rawFromEndToNow = await this.epicClient.fortnite.getStats(this.epicId.id, fromEndToNow);
        }

        //console.log("Raw Stats");
        //console.log(rawFromStartToNow.stats);

        const stats = this.getStatObject(rawFromStartToNow);
        return stats;
    };

    // Filters stat object based on user-provided filters
    // Removes unwanted modes/sizes from the results
    filterStats = (stats, filters) => {
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
    };

    // Generates final report with filtered and processed stats
    reportStats = async (filter) => {
        const stats = await this.stats;
        let statSummary = this.getStatSummary(stats);
        const filteredStats = this.filterStats(statSummary, filter);
        console.log("Stat Summary");
        console.dir(filteredStats, {depth: null});
    };
}