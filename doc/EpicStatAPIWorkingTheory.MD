# Epic Games Fortnite Stats API: Working Theory

## Overview

The Epic API provides a mechanism to retrieve player statistics across various time windows. After extensive testing and observation, we've developed a working theory of how the underlying system functions.

## Snapshot System Architecture

1. **Accumulated Totals**
   - The database stores *cumulative* stats since the beginning of Fortnite (Ch1S1)
   - Each stat (kills, wins, matches, etc.) is a running total per mode/playlist
   - No individual match data is stored in this system

2. **Time-Based Snapshot System**
   - The system creates snapshots of cumulative totals on a regular basis
   - Snapshots appear to be taken at midnight GMT
   - These snapshots serve as query points for the API
   - Snapshot times may differ from lastmodified times reported in the returned data
   
   **Custom Time Window Behavior**:
   - The API locates snapshots that fall within the specified time window
   - It subtracts the earliest snapshot in the window from the latest snapshot
   - If only one snapshot exists within the window, no data is returned
   - This behavior applies when start time > 0 (or date Fortnite began) and end time < now
   
   **Daily Snapshot Timing**:
   - Data for the current day is stored in a snapshot at 24:00:00 GMT tonight (00:00:00 tomorrow)
   - To get today's complete data, query from 00:00:00 GMT this morning to 00:00:00 GMT tomorrow
   - If you use any time earlier than midnight tonight as the end time, results will only include
     data from yesterday and earlier (since today's snapshot isn't included in the window)
   - Similarly, if you use any time later than 00:00:00 GMT this morning for the start time,
     nothing will be returned because you'll exclude yesterday's snapshot from the window,
     leaving only tonight's snapshot in the window (which violates the two-snapshot requirement)
   - Today's snapshot is updated throughout the day (matches added, lastmodified times increase)
   - Despite ongoing updates, the snapshot itself remains positioned at midnight for API queries
   
   **Real-time Match Tracking**:
   - By querying the current day's snapshot at frequent intervals, it's theoretically possible to extract single-game stats
   - When a lastmodified timestamp changes, comparing the before/after snapshots can reveal individual match data
   - However, this technique has critical limitations:
     - Games played in quick succession may be batched into a single snapshot update
     - Any missed query interval results in permanent data loss for individual matches
     - If tracking fails, you can only fall back to daily aggregate differences (today vs yesterday)
   - Unlike match history APIs, this method requires constant active polling
   
   **Time Format Requirements**:
   - All timestamps are in GMT/UTC timezone
   - The Epic API works internally with Unix timestamps (seconds since epoch)
   - Incorrect timezone specification will result in unexpected query results

3. **Progressive Data Resolution**
   
   **Recent Data**: Daily snapshots (current season)
   - Reliably created at midnight GMT
   - Predictable and consistent 
   
   **Older Data**: Progressively thinned snapshots
   - Unlike recent data, snapshots for older seasons occur at unpredictable times
   - While often preserved at season boundaries, the specific time of day varies widely
   - Can be at any hour (e.g., 3:05am, 7:00am, 4:30pm) rather than consistently at midnight
   - Different game modes and input methods often have different snapshot preservation times
   - No direct API exists to query when snapshots are available
   - Finding a specific snapshot requires iterative time window testing to pinpoint when retrieved data changes

4. **Snapshot Availability Variations**
   - Snapshot retention varies by game mode and playlist
   - Some modes may only have season boundary snapshots preserved
   - Player-specific differences can occur based on activity patterns
   - Input device (gamepad vs. keyboard) can affect snapshot frequency
   - For older seasons with sparse snapshot retention:
     - The general snapshot subtraction mechanism (earliest from latest) has amplified effects
     - Missing mid-season snapshots create "all-or-nothing" query results
     - Identical time windows can yield different results across input devices due to their varying snapshot patterns

   ```
   Example: OG Season Input Device Differences
   Nov 3, 2023 7:00am    Nov 16, 2023         Dec 3, 2023 3:05am    Dec 3, 2023 4:30am
   (Ch4s4 Final         (Gamepad Snapshot)   (KB/Mouse Update      (Query Availability
    Snapshot)                                 Timestamp)            Threshold)
        ↑                    ↑                      ↑                   ↑
   Season start/        Mid-season update     Stats internally     Earliest time when
   Last Ch4s4 snapshot  for gamepad stats     updated with         updated KB/M stats
                        (19 matches)          season total         become accessible
                                              (273 matches)        via API queries
   ```

   These differences lead to unpredictable query results:
   1. For the same player, gamepad stats receive mid-season snapshots (Nov 16)
   2. Meanwhile, keyboard/mouse stats are only updated in bulk at season boundaries
   3. There's a critical delay between when stats are updated internally (3:05am) 
      and when they become available through API queries (4:30am)
   4. Querying between 3:05am-4:30am on Dec 3 (after the season ended) still returns Nov 3 data 
      (before the season started) despite the lastmodified timestamp indicating a more recent update. 
      This is a common pattern: lastmodified timestamps can be hours, days or weeks earlier than the 
      snapshot time itself, especially for historically preserved season boundary snapshots if 
      the player didn't play that mode near the end of the season.

   ```
   Example: Time Window Query Results with Sparse Snapshots
   Query A: Nov 3, 2023 7:00am → Dec 3, 2023 4:29am
   Result: Only gamepad stats returned (4 matches)
   Why: Window contains multiple gamepad snapshots, but only one KB/M snapshot (Nov 3 at 7am)

   Query B: Nov 3, 2023 7:00am → Dec 3, 2023 4:30am
   Result: Both gamepad (4 matches) AND keyboard stats (59 matches) returned
   Why: Window now includes second KB/M snapshot from Dec 3 at 4:30am
   ```

   This demonstrates why historical data retrieval requires carefully positioned time windows:
   - The window must capture at least two snapshots (as explained in section 2)
   - Historical seasons often retain snapshots at unpredictable times
   - For reliable data access, testing multiple time windows may be necessary

5. **Update vs. Availability Delay**
   - Internal stat updates (lastmodified timestamps) often don't immediately reflect in API results
   - Delays between updates and availability are inconsistent and unpredictable
   - For recent seasons: Delays typically range from minutes to several hours
   - For older seasons: Often only one snapshot is retained post-season, with timing varying by:
     - Input device (gamepad vs. keyboard/mouse)
     - Game mode (solo, duo, etc.)
     - Playlist type (zero build, build, etc.)
   - Mid-season snapshots may or may not be preserved, depending on the combination of factors above
   - This variability makes reliable historical data access particularly challenging
