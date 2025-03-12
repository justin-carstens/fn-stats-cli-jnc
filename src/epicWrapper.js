/**
 * Epic Games API Wrapper with toggle functionality
 * Allows switching between original package and custom implementation
 */
import { createRequire } from 'module';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let EpicClient;

// Simple toggle - change this value to switch implementations
const useOriginal = false; // Set to true to use original package, false to use custom implementation

// Import the appropriate implementation
if (useOriginal) { // Use original squiddleton package
    console.log('Using original @squiddleton/epic package');
    const require = createRequire(import.meta.url);
    const epicPackage = require('@squiddleton/epic');
    EpicClient = epicPackage.EpicClient;
} else { // Use custom implementation based on original package
    console.log('Using custom epic-auth implementation');
    const { EpicClient: CustomEpicClient } = await import('../lib/epic-auth/index.js');
    EpicClient = CustomEpicClient;
}

export { EpicClient };