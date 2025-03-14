/**
 * Date and time utilities for the Fortnite stats CLI
 */

/**
 * Formats timestamp as readable date
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date string
 */
export function formatTime(timestamp) {
    return new Date(timestamp * 1000).toLocaleString('en-US', {
        timeZone: 'GMT',
        dateStyle: 'medium',
        timeStyle: 'medium',
        hour12: false
    }) + ' GMT';
}

/**
 * Parse a date string or timestamp to Unix timestamp
 * @param {string} dateStr - Date string like "Feb 21 2025 GMT" or Unix timestamp
 * @returns {number} Unix timestamp
 */
export function parseDate(dateStr) {
    // Check if it's a numeric timestamp already
    if (!isNaN(dateStr) && dateStr.trim() !== '') {
        return parseInt(dateStr);
    }
    
    // Parse date string
    const timestamp = Date.parse(dateStr);
    if (isNaN(timestamp)) {
        throw new Error(`Invalid date format: ${dateStr}`);
    }
    
    return Math.floor(timestamp / 1000); // Convert to seconds
}

/**
 * Adjusts timestamp to 23:59:59 on the same date
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {number} Unix timestamp adjusted to end of day
 */
export function adjustToEndOfDay(timestamp) {
    const date = new Date(timestamp * 1000);
    date.setUTCHours(23, 59, 59, 999);
    return Math.floor(date.getTime() / 1000);
}

/**
 * Format midnight GMT for a given timestamp
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {number} Unix timestamp for midnight GMT of the day
 */
export function getMidnightGMT(timestamp) {
    const date = new Date(timestamp * 1000);
    date.setUTCHours(0, 0, 0, 0);
    return Math.floor(date.getTime() / 1000);
}

/**
 * Calculate time window for the last N days, weeks, or months
 * @param {number} n - Number of time units
 * @param {string} unit - Time unit ('day', 'week', or 'month')
 * @returns {Object} Time window {startTime, endTime} in Unix timestamps
 */
export function getLastTimeWindow(n, unit) {
    // Calculate tonight's midnight in GMT
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tonightMidnight = Math.floor(today.getTime() / 1000) + 86400; // Add 24 hours to get to next midnight
    
    // Calculate start time based on the unit
    let startTime;
    switch (unit) {
        case 'day':
            startTime = tonightMidnight - (n * 86400);
            break;
        case 'week':
            startTime = tonightMidnight - (n * 7 * 86400);
            break;
        case 'month':
            startTime = tonightMidnight - (n * 30 * 86400);
            break;
        default:
            throw new Error(`Unsupported time unit: ${unit}`);
    }
    
    return {
        startTime,
        endTime: tonightMidnight
    };
}
