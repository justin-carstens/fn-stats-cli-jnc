import { EpicClient } from '../src/epicWrapper.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Simple test to retrieve and print the Fortnite timeline
 */
async function testGetTimeline() {
  try {
    // Create client with auto refresh enabled
    const client = new EpicClient({ autoRefresh: false });
    
    // Use the same authentication method as your working code
    const grant = JSON.parse(
      readFileSync(join(__dirname, '../config/deviceAuthGrant.json'), 'utf8')
    );
    
    console.log('Authenticating...');
    const loginResponse = await client.auth.authenticate(grant);
    console.log(`Authenticated with the account ${loginResponse.displayName}`);
    
    // Get timeline data
    console.log('Fetching timeline...');
    const timeline = await client.fortnite.getTimeline();
    
    // Print formatted result
    console.log('Timeline Data:');
    console.log(JSON.stringify(timeline, null, 2));
    
    // Save to file
    const outputPath = join(__dirname, 'timeline_output.json');
    writeFileSync(outputPath, JSON.stringify(timeline, null, 2));
    console.log(`\nFull timeline data saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('Error fetching timeline:', error.message);
    if (error.stack) console.error(error.stack);
  }
}

// Run the test
testGetTimeline();