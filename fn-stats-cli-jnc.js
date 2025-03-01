#!/usr/bin/env node

import { FortniteStatsRetriever } from './src/FortniteStatsRetriever.js';
import { seasonTimestamps } from './src/getSeasonTimes.js';

// Display help text if requested
if (process.argv[2] === '--help' || process.argv[2] === '-h') {
    console.log(`
Fortnite Stats CLI - Get player statistics from Epic Games API

Usage: fn-stats <player-name> [filters...]

Default Behavior:
  - Shows current season (ch6s2) stats
  - Shows zero-build mode only (excludes build mode)
  - Excludes bot matches entirely
  - Shows all game modes (regular and reload)
  - Shows all team sizes (solo, duo, trio*, squad)
  - Shows both pubs and ranked modes
  * Note: Trio is not available in reload mode

Time Window Filters:
  ch1s1-ch6s2    Specific season (also: og, og2, Rs1, Rs2, lifetime)
  lastweek=N     Stats from last N weeks
  lastday=N      Stats from last N days
  lastmonth=N    Stats from last N months
  starttime=DATE Custom start time (GMT)
  endtime=DATE   Custom end time (GMT)

Game Mode Filters:
  zeroBuild      Zero build mode (default)
  build          Build mode (must be explicitly requested)
  regular        Regular BR mode
  reload         Reload BR mode
  solo           Solo team size
  duo            Duo team size
  trio           Trio team size
  squad          Squad team size
  pubs           Public matches
  ranked         Ranked matches
  bots           Bot matches (must be explicitly requested)

Examples:
  fn-stats PlayerName                    Current season stats
  fn-stats "Player With Spaces"          Handle spaces in name
  fn-stats PlayerName ch5s2              Chapter 5 Season 2 stats
  fn-stats PlayerName lastweek=1         Stats over the last week
  fn-stats "Player Name" lastday=3       Stats over the last 3 days /w spaces in player name
  fn-stats PlayerName solo zeroBuild     Solo zero-build only
  fn-stats PlayerName bots               Include bot matches
  fn-stats PlayerName build ranked       Build mode ranked matches
`);
    process.exit(0);
}

// Helper function to extract numbers from filter strings like "lastweek=3"
function getFirstNumberAfterString(str, searchString) {
    const regex = new RegExp(`${searchString}\\D*(\\d+)`);
    const match = str.match(regex);
    return match ? Number(match[1]) : null;
}

// Process command line arguments
const cliArgs = process.argv.slice(2);
const playerName = cliArgs[0];  // First argument is player name
const filters = cliArgs.slice(1);  // Remaining arguments are filters

// Set up time window for stat collection
let selectSeason = 'ch6s2';  // default to current season
let timeWindow = {startTime:0, endTime:0};

// Process season filter (case insensitive)
// Remove season name from filters after processing
Object.keys(seasonTimestamps).forEach(season => {
    if (season !== 'index') {  // Skip the index property
        filters.forEach((filter, index) => {
            if (filter.toLowerCase() === season.toLowerCase()) {
                selectSeason = season;  // Use original case from seasonTimestamps
                filters.splice(index, 1);
            }
        });
    }
});

timeWindow = seasonTimestamps[selectSeason];
console.log(timeWindow);

// Process time window filters
// Supports: lastweek=N, lastday=N, lastmonth=N, starttime=DATE, endtime=DATE
// Removes processed filters from the filters array
filters.forEach((filter, index) => {
    if (filter.toLowerCase().includes('lastweek')) {
        const nweeks = getFirstNumberAfterString(filter.toLowerCase(), 'lastweek=');
        timeWindow.startTime = Math.round(Date.now()/1000-86400*7*nweeks);
        filters.splice(index, 1);
    }
    if (filter.toLowerCase().includes('lastday')) {
        const ndays = getFirstNumberAfterString(filter.toLowerCase(), 'lastday=');
        timeWindow.startTime = Math.round(Date.now()/1000-86400*ndays);
        filters.splice(index, 1);
    }
    if (filter.toLowerCase().includes('lastmonth')) {
        const nmonths = getFirstNumberAfterString(filter.toLowerCase(), 'lastmonth=');
        timeWindow.startTime = Math.round(Date.now()/1000-86400*nmonths*30);
        filters.splice(index, 1);
    }
    if (filter.toLowerCase().includes('starttime')) {
        const start_string = filter.split("=")[1];
        timeWindow.startTime = Math.round(Date.parse(start_string)/1000);
        filters.splice(index, 1);
    }
    if (filter.toLowerCase().includes('endtime')) {
        const end_string = filter.split("=")[1];
        timeWindow.endTime = Math.round(Date.parse(end_string)/1000);
        filters.splice(index, 1);
    }
});

// Create stats retriever object and generate report
const playerStats = new FortniteStatsRetriever(playerName, timeWindow, filters);

console.log('done');
