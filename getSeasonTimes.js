import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Get absolute directory path of current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read season definitions using absolute path to module location
const seasonDefs = JSON.parse(
    readFileSync(join(__dirname, 'seasonDefinitions.json'), 'utf8')
);

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