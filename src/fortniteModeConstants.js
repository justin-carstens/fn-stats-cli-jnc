/**
 * Constants defining valid Fortnite gameplay modes and configurations
 * These are used for filtering and organizing statistics
 */

// Team size variations
export const teamSizes = ['solo', 'duo', 'trio', 'squad'];

// Build mode types
export const buildModes = ['zeroBuild', 'build'];

// Competitive mode types
export const compModes = ['pubs', 'ranked', 'bots'];

// Core game mode types
export const gameModes = ['regular', 'reload'];

// Patterns used to match stat names in API responses
export const statPattern = {
    matches: 'br_matchesplayed',
    kills: 'br_kills',
    wins: 'br_placetop1_',
    top3: 'br_placetop3_',
    top5: 'br_placetop5_',
    top6: 'br_placetop6_',
    top10: 'br_placetop10_',
    top12: 'br_placetop12_',
    top25: 'br_placetop25_',
    minutes: 'br_minutesplayed'
};
