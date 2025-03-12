"use strict";

/**
 * Enum containing authentication credentials for different Fortnite clients
 * These base64-encoded strings are used for API authentication
 */
export const FortniteGameClient = {
    // Android client credentials (base64 encoded client_id:client_secret)
    ANDROID: "M2Y2OWU1NmM3NjQ5NDkyYzhjYzI5ZjFhZjA4YThhMTI6YjUxZWU5Y2IxMjIzNGY1MGE2OWVmYTY3ZWY1MzgxMmU="
};

/**
 * Helper function to get battle pass level stat names
 * @param {number} length - Number of seasons to get levels for
 * @returns {string[]} - Array of stat names for battle pass levels
 */
export const getBattlePassLevels = (length) => Array
    .from({ length }, (v, k) => k + 1)
    .map(seasonNumber => `s${seasonNumber}_social_bp_level`)
    .slice(10); // Start from season 10
