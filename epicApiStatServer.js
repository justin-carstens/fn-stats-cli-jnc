import { EpicClient } from './epicWrapper.js';
import { readFileSync } from 'node:fs';
import { seasonTimestamps } from './getSeasonTimes.js';

// Constants
const teamSizes = ['solo', 'duo', 'trio', 'squad'];
const buildModes = ['zeroBuild', 'build'];
const compModes = ['pubs', 'ranked', 'bots'];
const gameModes = ['regular', 'reload'];

class playerStats {
    constructor(epicName, timeWindow, filter) {
        this.epicName = epicName;
        this.timeWindow = timeWindow;
        this.epicClient = new EpicClient();
        this.stats = this.getStats();
        this.reportStats(filter);
    }

    loginEpic = async (epicClient) => {
        // Load grant file using readFileSync
        const grant = JSON.parse(
            readFileSync('./deviceAuthGrant.json', 'utf8')
        );
        // Rest of loginEpic remains the same
        console.log(epicClient.accountId);
        if (epicClient.accountId == null) {
            console.log("Not logged in, awaiting authentication.");
            const loginResponse = await epicClient.auth.authenticate(grant);
            console.log(`Authenticated with the account ${loginResponse.displayName}`);
        } else {
            console.log("Already authenticated.");
        }
    }

    // Helper function to subtract stats from two time windows
    subtractStats(statsFromStartToNow, statsFromEndToNow) {
        // Helper function to check if something is an object (not array/null)
        function isObject(item) {
            return (item && typeof item === 'object' && !Array.isArray(item));
        }
    
        // Recursive function to handle nested object subtraction
        function recursiveSubtract(start, end) {
            // Base case: if either value isn't an object, handle the subtraction
            if (!isObject(start) || !isObject(end)) {
                // If start stat doesn't exist, return 0 (no stats in window)
                if (start === undefined) return 0;
                // If end stat doesn't exist, use start value (all stats in window)
                if (end === undefined) return start;
                // Normal case: start - end gives stats during time window
                return start - end;
            }
    
            // Create object to store results
            const result = {};
    
            // Get all unique keys from both objects
            const allKeys = new Set([
                ...Object.keys(start || {}),    // Keys from start stats
                ...Object.keys(end || {})       // Keys from end stats
            ]);
    
            // Process each key recursively
            allKeys.forEach(key => {
                result[key] = recursiveSubtract(start[key], end[key]);
            });
    
            return result;
        }
    
        // Start the recursive process with correct order: start - end
        return recursiveSubtract(statsFromStartToNow, statsFromEndToNow);
    }

    getStatObject = (rawStats) => {
        // Define stat patterns for mapping
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
    
        const statObject = {};
        const keys = Object.keys(rawStats.stats);
    
        // First level: Build modes (zeroBuild/build)
        buildModes.forEach((buildMode) => {
            statObject[buildMode] = {};
            let keyBuild = [];
            if (buildMode == 'zeroBuild') { //zeroBuild mode
                // only keep remaining keys containing "nobuild"
                keyBuild = keys.filter((key) => {
                    return key.includes('nobuild');
                });
            } else { //build mode
                // only keep remaining keys NOT containing "nobuild"
                keyBuild = keys.filter((key) => {
                    return !key.includes('nobuild');
                });
            }
    
            // Second level: BR Game modes (regular/reload)
            gameModes.forEach((gameMode) => {
                statObject[buildMode][gameMode] = {};
                let keyGame = [];
                if (gameMode == 'regular') {
                    keyGame = keyBuild.filter((key) => {
                        return key.includes('nobuildbr') || key.includes('default');
                    });
                }
                if (gameMode == 'reload') {
                    keyGame = keyBuild.filter((key) => {
                        return key.includes('punchberry') || key.includes('sunflower') || key.includes('blastberry');
                    });
                }
    
                // Third level: Competitive modes (pubs/ranked/bots)
                compModes.forEach((compMode) => {
                    statObject[buildMode][gameMode][compMode] = {};
                    let keyComp = [];
                    if (compMode == 'pubs') {
                        keyComp = keyGame.filter((key) => {
                            return !key.includes('habanero') && !key.includes('bots');
                        });
                    }
                    if (compMode == 'ranked') {
                        keyComp = keyGame.filter((key) => {
                            return key.includes('habanero');
                        });
                    }
                    if (compMode == 'bots') {
                        keyComp = keyGame.filter((key) => {
                            return key.includes('bots');
                        });
                    }
    
                    // Fourth level: Team sizes
                    teamSizes.forEach((size) => {

                        // Skip trio for reload game mode
                        if (gameMode === 'reload' && size === 'trio') {
                            return; // Skip this iteration
                        }

                        // Initialize the size object
                        statObject[buildMode][gameMode][compMode][size] = {};

                        // Filter keys for the current team size
                        let keySizeComp = keyComp.filter((key) => {
                            return key.includes(size);
                        });
    
                        // Process each stat type using the stat pattern
                        Object.entries(statPattern).forEach(([statName, pattern]) => {
                            let keyStat = keySizeComp.filter((key) => {
                                return key.includes(pattern);
                            });
    
                            // Only create the stat entry if matching keys were found
                            if (keyStat.length > 0) {
                                // Sum up all matching stat values (this mainly exists for reload)
                                statObject[buildMode][gameMode][compMode][size][statName] = 
                                    keyStat.reduce((sum, key) => {
                                        // reduce takes 2 arguments:
                                        // 1. Callback function with accumulator (sum) and current value (key)
                                        // 2. Initial value (0 in this case)
                                        
                                        // On each iteration:
                                        // - sum: running total from previous iterations
                                        // - key: current key from keyStat array
                                        // - rawStats.stats[key]: value for current key
                                        // - Return value becomes new 'sum' for next iteration
                                        return sum + rawStats.stats[key];
                                    }, 0); // Start with initial sum of 0
                            }
                        }); // each stat
                    }); // each team size
                }); // each comp mode
            }); // each game mode
        }); // each build mode
    
        return statObject;
    };

    getStatSummary = (statObject) => {
        let statSummary = JSON.parse(JSON.stringify(statObject));
        function recurseSummary(statSummary) {
            if (statSummary.hasOwnProperty('matches')){
                // if we have matches but no wins or kills set them to zero
                if (!statSummary.hasOwnProperty('wins')) statSummary.wins=0;
                if (!statSummary.hasOwnProperty('kills')) statSummary.kills=0;
                
                // calculate win rate
                statSummary.winRate = statSummary.wins/statSummary.matches;

                // calculate top 3,5,6,10,12,25 rates
                if (statSummary.hasOwnProperty('top3')) statSummary.top3Rate = 
                    statSummary.top3/statSummary.matches;
                if (statSummary.hasOwnProperty('top5')) statSummary.top5Rate = 
                    statSummary.top5/statSummary.matches;
                if (statSummary.hasOwnProperty('top6')) statSummary.top6Rate = 
                    statSummary.top6/statSummary.matches;
                if (statSummary.hasOwnProperty('top10')) statSummary.top10Rate = 
                    statSummary.top10/statSummary.matches;
                if (statSummary.hasOwnProperty('top12')) statSummary.top12Rate = 
                    statSummary.top12/statSummary.matches;
                if (statSummary.hasOwnProperty('top25')) statSummary.top25Rate = 
                    statSummary.top25/statSummary.matches;
                
                // calculate kill rates    
                statSummary.killsPerDeath = 
                    statSummary.kills/(statSummary.matches-statSummary.wins);
                statSummary.killsPer20 = statSummary.kills*20/statSummary.minutes;
                statSummary.minutesPerKill = statSummary.minutes/statSummary.kills;

                return statSummary;
            } else {
                Object.keys(statSummary).forEach((e,i)=>{
                    statSummary[e]=recurseSummary(statSummary[e]);
                })
            }
            return statSummary;
        }
        return recurseSummary(statSummary);
    };

    // combine ranked pubs and build/zb like TRN does on overview page
    fortniteTrackerCombine(stats) {
        const trnStats={};
        // loop over each team size
        teamSizes.forEach(teamSize => {
            //loop over each stat field
            trnStats[teamSize]={};
            Object.keys(stats[teamSize][gameModes[0]]).forEach(stat => {
                // for each stat add up the contributions from each game mode
                trnStats[teamSize][stat]=0;
                gameModes.forEach(mode =>{
                    trnStats[teamSize][stat] += stats[teamSize][mode][stat];
                });
            });
        });
        return trnStats;
    };

    getStats = async () => {
        // Authenticate if needed
        await this.loginEpic(this.epicClient);

        this.epicId = await this.epicClient.getAccountByDisplayName(this.epicName);

        // to overcome a bug in the api, find stats from startTime of window to now and endTime to now.
        const fromStartToNow = {...this.timeWindow};
        // Now is 1 day in the future to account for Epics day divisions.
        fromStartToNow.endTime= Math.round(Date.now()/1000+86400);

        const fromEndToNow = {...fromStartToNow};
        fromEndToNow.startTime=this.timeWindow.endTime;

        const rawFromStartToNow = 
            await this.epicClient.fortnite.getStats(this.epicId.id,fromStartToNow);
        let rawFromEndToNow={stats: {}};
         if (fromEndToNow.startTime <= fromStartToNow.endTime) {
            rawFromEndToNow = 
                await this.epicClient.fortnite.getStats(this.epicId.id,fromEndToNow);
        } 
        console.log("rawFromStartToNow");
        console.log(rawFromStartToNow.stats);
        console.log("rawFromEndToNow");
        console.log(rawFromEndToNow.stats);

        const rawStats = this.subtractStats(rawFromStartToNow,rawFromEndToNow)
        //console.log(rawStats.stats)

        const stats = this.getStatObject(rawStats)

        return stats;
    };

    filterStats = (stats, filters) => {
        // Create deep copy to avoid modifying original stats object
        // JSON.parse(JSON.stringify()) is a common way to deep clone objects in JS
        let filteredStats = JSON.parse(JSON.stringify(stats));
    
        // Filter array processing
        // filters?.filter() uses optional chaining (?.) to safely handle undefined filters
        // Array.filter() creates new array with elements that pass the test function
        // Array.includes() checks if array contains specific value
        const buildFilters = filters?.filter(f => buildModes.includes(f)) ?? [];
        const gameFilters = filters?.filter(f => gameModes.includes(f)) ?? [];
        const compFilters = filters?.filter(f => compModes.includes(f)) ?? [];
        const teamFilters = filters?.filter(f => teamSizes.includes(f)) ?? [];
    
        // DEFAULT EXCLUSIONS and BUILD MODE FILTERING
        // Handle build modes - only include specifically requested modes
        Object.keys(filteredStats).forEach(buildMode => {
            // Always remove 'build' unless explicitly requested
            if (buildFilters.length > 0) {
                // If we have build filters, only keep modes that are explicitly requested
                if (!buildFilters.includes(buildMode)) {
                    delete filteredStats[buildMode];
                }
            } else {
                // If no build filters, default to only zeroBuild
                if (buildMode === 'build') {
                    delete filteredStats[buildMode];
                }
            }
        });
    
        // Remove 'bots' mode unless explicitly requested
        // Nested iteration through the stat object hierarchy
        Object.keys(filteredStats).forEach(buildMode => {
            if (!filteredStats[buildMode]) return;  // Skip if buildMode was deleted
            Object.keys(filteredStats[buildMode]).forEach(gameMode => {
                Object.keys(filteredStats[buildMode][gameMode]).forEach(compMode => {
                    if (compMode === 'bots' && !compFilters.includes('bots')) {
                        delete filteredStats[buildMode][gameMode][compMode];
                    }
                });
            });
        });
    
        // EXPLICIT FILTERS
        // Only apply if filters array exists and has items
        if (filters?.length > 0) {
            // Filter game modes (regular/reload)
            if (gameFilters.length > 0) {
                Object.keys(filteredStats).forEach(buildMode => {
                    if (!filteredStats[buildMode]) return;
                    Object.keys(filteredStats[buildMode]).forEach(gameMode => {
                        // Remove game modes not in filter
                        if (!gameFilters.includes(gameMode)) {
                            delete filteredStats[buildMode][gameMode];
                        }
                    });
                });
            }
    
            // Filter competitive modes (pubs/ranked/bots)
            if (compFilters.length > 0) {
                Object.keys(filteredStats).forEach(buildMode => {
                    if (!filteredStats[buildMode]) return;
                    Object.keys(filteredStats[buildMode]).forEach(gameMode => {
                        Object.keys(filteredStats[buildMode][gameMode]).forEach(compMode => {
                            // Remove comp modes not in filter
                            if (!compFilters.includes(compMode)) {
                                delete filteredStats[buildMode][gameMode][compMode];
                            }
                        });
                    });
                });
            }
    
            // Filter team sizes (solo/duo/trio/squad)
            if (teamFilters.length > 0) {
                Object.keys(filteredStats).forEach(buildMode => {
                    if (!filteredStats[buildMode]) return;
                    Object.keys(filteredStats[buildMode]).forEach(gameMode => {
                        Object.keys(filteredStats[buildMode][gameMode]).forEach(compMode => {
                            Object.keys(filteredStats[buildMode][gameMode][compMode]).forEach(teamSize => {
                                // Remove team sizes not in filter
                                if (!teamFilters.includes(teamSize)) {
                                    delete filteredStats[buildMode][gameMode][compMode][teamSize];
                                }
                            });
                        });
                    });
                });
            }
        }
    
        return filteredStats;
    };

    reportStats = async (filter) => {

        const stats = await this.stats;

        let statSummary=this.getStatSummary(stats);

        // Apply filters if any exist
        const filteredStats = this.filterStats(statSummary, filters);

        console.log("Stat Summary");
        console.dir(filteredStats,{depth:null});

    };
};


//
// Main execution code
//

function getFirstNumberAfterString(str, searchString) {
    const regex = new RegExp(`${searchString}\\D*(\\d+)`);
    const match = str.match(regex);
    return match ? Number(match[1]) : null;
}

// Get command line arguments
const cliArgs = process.argv.slice(2);
const playerName = cliArgs[0];
const filters = cliArgs.slice(1);

let selectSeason = 'ch6s2';  // default to current season
let timeWindow = {startTime:0, endTime:0};

// check if any of the filters is a season (case insensitive)
Object.keys(seasonTimestamps).forEach(season => {
    filters.forEach((filter, index) => {
        if (filter.toLowerCase() === season.toLowerCase()) {
            selectSeason = season;  // Use original case from seasonTimestamps
            filters.splice(index, 1);
        }
    });
});

timeWindow = seasonTimestamps[selectSeason];
console.log(timeWindow);

// look for lastX windows
filters.forEach((filter,index) =>{
    if (filter.toLowerCase().includes('lastweek')) {
        const nweeks = getFirstNumberAfterString(filter.toLowerCase(),'lastweek=')
        timeWindow.startTime=Math.round(Date.now()/1000-86400.*7*nweeks);
        filters.splice(index,1);
    }
    if (filter.toLowerCase().includes('lastday')) {
        const ndays = getFirstNumberAfterString(filter.toLowerCase(),'lastday=')
        timeWindow.startTime=Math.round(Date.now()/1000-86400.*ndays);
        filters.splice(index,1);
    }
    if (filter.toLowerCase().includes('lastmonth')) {
        const nmonths = getFirstNumberAfterString(filter.toLowerCase(),'lastmonth=')
        timeWindow.startTime=Math.round(Date.now()/1000-86400.*nmonths*30);
        filters.splice(index,1);
    }
    if (filter.toLowerCase().includes('starttime')) {

        const start_string = filter.split("=")[1]

        timeWindow.startTime=Math.round(Date.parse(start_string)/1000);
        filters.splice(index,1);
    }
    if (filter.toLowerCase().includes('endtime')) {

        const end_string = filter.split("=")[1]

        timeWindow.endTime=Math.round(Date.parse(end_string)/1000);
        filters.splice(index,1);
    }
})

const playerOne = new playerStats(playerName,timeWindow,filters);



console.log('done');