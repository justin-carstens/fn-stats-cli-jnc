/**
 * Command-line argument parsing utilities
 */
import { buildModes, gameModes, compModes, teamSizes, inputTypes, statPattern } from './fortniteModeConstants.js';
import { parseDate, formatTime, getLastTimeWindow } from './dateUtils.js';

/**
 * Determines if a filter string is a valid stat pattern key
 * @param {string} filter - Filter string to check
 * @returns {boolean} True if it's a valid stat pattern key
 */
export function isStatPatternKey(filter) {
    return Object.keys(statPattern).includes(filter);
}

/**
 * Parse arguments to extract mode filters and stat patterns
 * @param {Array<string>} args - Array of command line arguments
 * @returns {Object} Object with modeFilters and statPatterns
 */
export function parseFilterArgs(args) {
    // Extract mode filters
    const modeFilters = args.filter(arg => 
        buildModes.includes(arg) || 
        gameModes.includes(arg) || 
        compModes.includes(arg) || 
        teamSizes.includes(arg) ||
        inputTypes.includes(arg)
    );
    
    // Extract stat patterns
    const statPatterns = args.filter(arg => isStatPatternKey(arg));
    
    return { modeFilters, statPatterns };
}

/**
 * Parse time window arguments (lastday, lastweek, lastmonth)
 * @param {string} arg - Command line argument
 * @returns {Object|null} Time window if found, null otherwise
 */
export function parseTimeWindowArg(arg) {
    // Extract number value after equals sign
    const getNumberValue = (arg, prefix) => {
        const match = arg.match(new RegExp(`${prefix}=(\\d+)`, 'i'));
        return match ? parseInt(match[1]) : null;
    };

    // Check for lastday, lastweek, lastmonth patterns
    if (arg.toLowerCase().startsWith('lastday=')) {
        const days = getNumberValue(arg, 'lastday');
        if (days) return getLastTimeWindow(days, 'day');
    } 
    else if (arg.toLowerCase().startsWith('lastweek=')) {
        const weeks = getNumberValue(arg, 'lastweek');
        if (weeks) return getLastTimeWindow(weeks, 'week');
    } 
    else if (arg.toLowerCase().startsWith('lastmonth=')) {
        const months = getNumberValue(arg, 'lastmonth');
        if (months) return getLastTimeWindow(months, 'month');
    }
    
    return null;
}

/**
 * Parse starttime and endtime parameters from command line arguments
 * @param {Array<string>} args - Array of command line arguments to process
 * @param {boolean} quietMode - Whether to suppress logs
 * @returns {Object} Object with timeWindow, foundCustomTime, and remainingArgs
 */
export function parseTimeWindowArgs(args, quietMode = false) {
    const timeWindow = {
        startTime: null,
        endTime: null
    };
    let foundCustomTime = false;
    const remainingArgs = [];
    
    for (const arg of args) {
        const argLower = arg.toLowerCase();
        
        if (argLower.startsWith('starttime=')) {
            const dateStr = arg.substring(arg.indexOf('=') + 1);
            try {
                timeWindow.startTime = parseDate(dateStr);
                foundCustomTime = true;
                if (!quietMode) console.log(`Using custom start time: ${formatTime(timeWindow.startTime)}`);
            } catch (error) {
                console.warn(`Invalid starttime format: ${dateStr}`);
                remainingArgs.push(arg);
            }
        }
        else if (argLower.startsWith('endtime=')) {
            const dateStr = arg.substring(arg.indexOf('=') + 1);
            try {
                timeWindow.endTime = parseDate(dateStr);
                foundCustomTime = true;
                if (!quietMode) console.log(`Using custom end time: ${formatTime(timeWindow.endTime)}`);
            } catch (error) {
                console.warn(`Invalid endtime format: ${dateStr}`);
                remainingArgs.push(arg);
            }
        }
        else {
            remainingArgs.push(arg);
        }
    }
    
    return { timeWindow, foundCustomTime, remainingArgs };
}

/**
 * Parse starttime and endtime parameters from command line arguments
 * This function extracts custom time window specifications in the format of
 * "starttime=DATE" and "endtime=DATE" from the provided arguments list.
 * 
 * The function handles:
 * - Parsing date strings into Unix timestamps (seconds since epoch)
 * - Processing both starttime and endtime independently
 * - Maintaining other arguments that don't match these patterns
 * - Providing diagnostic output about processed time values
 * 
 * Date formats supported:
 * - Any format parseable by JavaScript's Date.parse()
 * - Examples: "2023-01-01", "Jan 1 2023", "2023-01-01T12:00:00Z"
 * - All dates are interpreted as GMT/UTC
 * 
 * Error Handling:
 * - Invalid date formats are reported but don't stop processing
 * - Arguments with invalid dates are preserved in remainingArgs
 * 
 * @param {Array<string>} args - Array of command line arguments to process
 * @param {boolean} quietMode - Whether to suppress logs
 * @returns {Object} Object containing:
 *   - timeWindow: {Object} with startTime and endTime (null if not found)
 *   - foundCustomTime: {boolean} true if either starttime or endtime was found
 *   - remainingArgs: {Array<string>} arguments not parsed as time parameters
 */
export function parseStartEndTimeArgs(args, quietMode = false) {
    const timeWindow = {
        startTime: null,
        endTime: null
    };
    let foundCustomTime = false;
    const remainingArgs = [];
    
    for (const arg of args) {
        const argLower = arg.toLowerCase();
        
        if (argLower.startsWith('starttime=')) {
            const dateStr = arg.substring(arg.indexOf('=') + 1);
            try {
                timeWindow.startTime = parseDate(dateStr);
                foundCustomTime = true;
                if (!quietMode) console.log(`Using custom start time: ${formatTime(timeWindow.startTime)}`);
            } catch (error) {
                console.warn(`Invalid starttime format: ${dateStr}`);
                remainingArgs.push(arg);
            }
        }
        else if (argLower.startsWith('endtime=')) {
            const dateStr = arg.substring(arg.indexOf('=') + 1);
            try {
                timeWindow.endTime = parseDate(dateStr);
                foundCustomTime = true;
                if (!quietMode) console.log(`Using custom end time: ${formatTime(timeWindow.endTime)}`);
            } catch (error) {
                console.warn(`Invalid endtime format: ${dateStr}`);
                remainingArgs.push(arg);
            }
        }
        else {
            remainingArgs.push(arg);
        }
    }
    
    return { timeWindow, foundCustomTime, remainingArgs };
}
