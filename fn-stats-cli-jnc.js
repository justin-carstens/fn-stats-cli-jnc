#!/usr/bin/env node

import { PlayerStats, teamSizes, buildModes, compModes, gameModes } from './playerStats.js';
import { seasonTimestamps } from './getSeasonTimes.js';

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

// Create player stats object and generate report
const playerOne = new PlayerStats(playerName, timeWindow, filters);

console.log('done');
