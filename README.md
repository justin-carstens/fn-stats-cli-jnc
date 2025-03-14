# fn-stats-cli-jnc

Command-line tool to pull player statistics from Fortnite using Epic Games' API.

## Prerequisites

This tool requires Node.js version 18 or higher. To install Node.js:

1. Visit [nodejs.org](https://nodejs.org/)
2. Download and install the "LTS" (Long Term Support) version
3. Verify installation by opening a terminal/command prompt and running:
   ```bash
   node --version
   ```
   You should see a version number like `v18.x.x` or higher

## Installation

```bash
npm install -g fn-stats-cli-jnc
```

## First-Time Authentication

The first time you use this tool, you'll need to authenticate with Epic Games. This is a one-time process that must be run from the package installation directory:

```bash
fn-stats-auth
```

The authentication process will:
1. Open your default web browser to Fortnite.com
2. If you're not already logged in, sign in with your Epic Games account
3. The script will ask if you've completed this step
4. After confirming (with "yes"), a new browser tab will open
   - It will contain JSON text wrapped in curly braces {}
   - Copy ALL of this text, including the braces
5. Paste the entire JSON text into the command prompt
   - The script will create permanent device credentials
   - These are saved in a config directory

Note: Keep your authentication credentials secure. They are permanent unless you explicitly revoke them in your Epic Games account settings.

## Usage

After authentication, use the CLI tool:

```bash
fn-stats <player-name> [filters...]
```

Note: If the player name contains spaces, surround it with quotes:
```bash
fn-stats "Player Name With Spaces" [filters...]
```

### Default Behavior
- Shows current season (ch6s2) stats
- Shows zero-build mode only (excludes build mode)
- Excludes bot matches
- Shows all game modes (regular and reload)
- Shows all team sizes (solo, duo, trio, squad)
- Shows both pubs and ranked modes

### Command-Line Options

The tool supports several display and processing options:

- **`--raw` / `-r`**: Shows raw stats output directly from the API instead of the organized nested structure
- **`--TRN` / `-t`**: Uses TRN-style (FortniteTracker) format that groups stats only by team sizes (solo/duo/trio/squad)
- **`--direct` / `-d`**: Uses direct API call method (single API call) instead of the default triple API call technique
- **`--quiet` / `-q`**: Suppresses informational log output (shows only the results)

You can combine multiple options:
```bash
fn-stats "Player Name" ch5s2 --raw --quiet solo
```

### Available Filters

#### Time Windows
- **Seasons:** `ch1s1` through `ch6s2`, `og`, `remix`, `Reloads1`, `Reloads2`, `lifetime`
- **Recent periods:**
  - Last N weeks: `lastweek=N`
  - Last N days: `lastday=N`
  - Last N months: `lastmonth=N`
- **Custom range:** `starttime=DATE` and/or `endtime=DATE` (use GMT dates)

> **Note on Season Data:** Due to the unpredictable nature of Epic's snapshot system, specifying seasons by name may not always yield complete or correct results. Epic's API works by comparing snapshots taken at different times, and these snapshots aren't always available at consistent intervals, especially for older data. In these cases, you can "find" the desired season data by manually specifying start and end times until you get the expected results. For example:
> ```bash
> # Try different time windows to locate complete season data
> fn-stats PlayerName "starttime=3 June 2023 00:00:00 GMT" "endtime=6 August 2023 23:59:59 GMT"
> ```
> For a detailed explanation of how Epic's snapshot system works, see the [API Working Theory](doc/EpicStatAPIWorkingTheory.MD) document.

#### Game Modes
- **Build modes:** `zeroBuild`, `build`
- **Game types:** `regular`, `reload`
- **Team sizes:** `solo`, `duo`, `trio`, `squad`
- **Competition:** `pubs`, `ranked`, `bots`

### Examples

```bash
# Get current season stats for a player (no spaces in name)
fn-stats PlayerName

# Get stats for player name with spaces
fn-stats "PP Zilla"

# Get Chapter 5 Season 2 stats for player with spaces
fn-stats "PP Zilla" ch5s2

# Last 2 week's stats
fn-stats "RottenTwinkies" lastweek=2

# Solo zero-build stats only
fn-stats PlayerName solo zeroBuild

# Include bot matches
fn-stats PlayerName bots

# Custom date range
fn-stats PlayerName "starttime=24 May 2024 GMT" "endtime=26 May 2024 GMT"

# Show raw stats output
fn-stats PlayerName --raw ch5s2

# Use TRN-style format
fn-stats PlayerName --TRN ch5s2

# Suppress log output
fn-stats PlayerName --quiet ch5s2
```

## Updating Season Definitions

When new Fortnite seasons are released, update `seasonDefinitions.json` with the new season's start and end dates. Format:

```json
{
  "ch6s3": {
    "start": "May 2 2025 GMT",
    "end": "June 15 2025 GMT"
  }
}
```

The start/end dates should be in a format parseable by JavaScript's `Date.parse()`.
