import { EpicClient } from '../src/epicWrapper.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Test to retrieve and print all available Fortnite tracks (quests/challenges)
 */
async function testGetTracks() {
  try {
    // Create client with auto refresh enabled for longer sessions
    const client = new EpicClient({ autoRefresh: false });
    
    // Use the authentication method from FortniteStatsRetriever
    const grant = JSON.parse(
      readFileSync(join(__dirname, '../config/deviceAuthGrant.json'), 'utf8')
    );
    
    console.log('Authenticating...');
    const loginResponse = await client.auth.authenticate(grant);
    console.log(`Authenticated with the account ${loginResponse.displayName}`);
    
    // Get tracks data
    console.log('Fetching available tracks (quests/challenges)...');
    const tracks = await client.fortnite.getTracks();
    
    // Print summary info
    console.log(`Retrieved ${tracks.length} tracks`);
    
    // Print full result
    console.log('Full tracks data:');
    console.log(JSON.stringify(tracks, null, 2));
    
    // Optionally save to file (useful if result is very large)
    const outputPath = join(__dirname, 'tracks_output.json');
    writeFileSync(outputPath, JSON.stringify(tracks, null, 2));
    console.log(`\nFull data also saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('Error fetching tracks:', error.message);
    if (error.response) {
      console.error('API Error Details:', error.response.status, error.response.statusText);
    }
    if (error.stack) console.error(error.stack);
  }
}

// Run the test
testGetTracks();