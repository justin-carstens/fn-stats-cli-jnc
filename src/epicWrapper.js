/**
 * Epic Games API Wrapper with toggle functionality
 * Allows switching between original package and custom implementation
 */
import { createRequire } from 'module';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let EpicClient;

// Configuration options
const useOriginal = false; // Set to true to use original package, false to use custom implementation
const quiet = true; // Set to true to disable implementation message

// Import the appropriate implementation
if (useOriginal) { // Use original squiddleton package
    const require = createRequire(import.meta.url);
    const epicPackage = require('@squiddleton/epic');
    EpicClient = epicPackage.EpicClient;
} else { // Use custom implementation based on original package
    const { EpicClient: CustomEpicClient } = await import('../lib/epic-auth/index.js');
    EpicClient = CustomEpicClient;
}

// Create a wrapper for the EpicClient constructor
const OriginalEpicClient = EpicClient; 
EpicClient = function() {
    // Log implementation message
    if (!quiet) {    
        if (useOriginal) {
            console.log('Using original @squiddleton/epic package');
        } else {
            console.log('Using custom epic-auth implementation');
        }
    }
    // Create and return a new instance
    return new OriginalEpicClient();
};

export { EpicClient };