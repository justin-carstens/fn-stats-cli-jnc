import { writeFileSync, readFileSync } from 'node:fs';

// Read season definitions
const seasonDefs = JSON.parse(readFileSync('./seasonDefinitions.json', 'utf8'));

// Build timestamps object
export const seasonTimestamps = Object.fromEntries(
    Object.entries(seasonDefs).map(([season, dates]) => [
        season,
        {
            startTime: Date.parse(dates.start)/1000,
            endTime: Date.parse(dates.end)/1000
        }
    ])
);