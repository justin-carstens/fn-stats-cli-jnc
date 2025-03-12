/**
 * Custom error class for handling Epic API errors
 * This helps us get detailed error information when API calls fail
 */
export class EpicAPIError extends Error {
    // Properties to store error details
    raw;       // Parsed JSON response (if available)
    rawText;   // Raw response text
    status;    // HTTP status code
    url;       // URL that caused the error

    /**
     * @param {Response} res - Fetch Response object
     * @param {string} rawText - Raw text from the response
     * @param {string} url - URL that was requested
     */
    constructor(res, rawText, url) {
        // Call parent constructor with status text as message
        super(res.statusText);
        
        // Try to parse the response as JSON
        let raw;
        try {
            raw = JSON.parse(rawText);
        }
        catch {
            // If parsing fails, set raw to null
            raw = null;
        }
        
        // Store all error details
        this.raw = raw;
        this.rawText = rawText;
        this.status = res.status;
        this.url = url;
    }
}
