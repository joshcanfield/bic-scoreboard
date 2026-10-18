# Scoresheet Generation Plan

## Completed
- Infraction type dropdown (11 standard + "Other" with free text)
- Off time (game clock when penalty assessed)
- On time (game clock when player returned - calculated or recorded on release)
- Penalty history preserved (expired + released penalties kept)
- Power play goal handling (goal dialog shows releasable 2-min minors)
- Scoresheet UI page with two layouts (Summary + USA Hockey style)
- Print-friendly styling
- Scorer # optional, dual assist tracking

## USA Hockey Official Scoresheet Fields

Reference: `docs/USA Hockey Scoresheet.png`

### Currently Implemented

| Field | Status | Notes |
|-------|--------|-------|
| Date | ✅ | Manual entry |
| Time | ✅ | Manual entry |
| Arena | ✅ | Manual entry |
| Home/Visitor Team Names | ✅ | Manual entry |
| Scoring by Periods (1, 2, 3, OT, Total) | ✅ | Auto-calculated from goals |
| Shots on Goal (per team) | ✅ | From game state |
| **Scoring Section** | | |
| - Period | ✅ | From goal data |
| - Time | ✅ | From goal data |
| - Team | ✅ | From goal data |
| - Goal (scorer #) | ✅ | Optional |
| - Assist (1st) | ✅ | Optional |
| - Assist (2nd) | ✅ | Optional |
| **Penalty Section** | | |
| - Period | ✅ | From penalty data |
| - Player # | ✅ | From penalty data |
| - Infraction | ✅ | From penalty data |
| - Minutes/Length | ✅ | From penalty data |
| - Off Time | ✅ | From penalty data |
| - On Time | ✅ | From penalty data (calculated) |
| **Officials** | | |
| - Referee | ✅ | Manual entry |
| - Linesman 1 | ✅ | Manual entry |
| - Linesman 2 | ✅ | Manual entry |
| - Scorekeeper | ✅ | Manual entry |
| Game Notes | ✅ | Manual entry (Summary view) |

### Potential Future Features

| Field | Priority | Notes |
|-------|----------|-------|
| **Game Header** | | |
| Age Division | Low | Checkboxes: Tier I, Tier II, Girls/Women, High School, House/Rec, Adult |
| Game # | Low | League game number |
| Surface | Low | Ice surface identifier |
| **Team Rosters** | | |
| Player Numbers (NO.) | Medium | List of player numbers per team |
| Goalies (G-) | Medium | Goalie jersey numbers |
| **Goal Type** | | |
| Type (E, PP, SH, EN) | Medium | Even strength, Power Play, Shorthanded, Empty Net - partially implemented |
| **Coach/Staff Info** | | |
| Head Coach (print/sign) | Low | Name and signature lines |
| CEP # | Low | USA Hockey coaching certification |
| CEP Level + Year | Low | Certification level and year attained |
| Assistant Coaches (x2) | Low | Names with CEP info |
| Manager | Low | Team manager name |
| Phone | Low | Contact number |
| **Officials Extended** | | |
| Referee Level | Low | Certification level |
| Referee Signature | Low | Signature line |
| Linesman Levels | Low | Certification levels |
| **Goalkeeper Stats** | | |
| Saves by Period | Medium | Saves per goalie per period (1, 2, 3, OT, Total) - currently we only track total shots per team |
| Minutes Played | Medium | Per goalie per period - needed if goalie substitution occurs |
| Multiple Goalies | Medium | Support for tracking 2+ goalies per team with individual stats |
| **Copy Distribution** | | |
| Color Legend | N/A | White=League, Yellow=Home, Pink=Visitor, Goldenrod=Referee |

### Implementation Notes

**Goal Type Enhancement:**
The scoring section has TYPE column showing E (Even), PP (Power Play), SH (Shorthanded), EN (Empty Net).
This could be auto-calculated based on penalty state at time of goal, or manually selected.

**Goalkeeper Stats:**
The official scoresheet tracks saves and minutes played per goalkeeper, per period. This allows for:
- Multiple goalies per team (substitutions)
- Per-period breakdown of saves
- Minutes played tracking for goalie stats

Currently we only track total shots on goal per team. To implement full goalie stats would require:
- Goalie roster entry (jersey numbers)
- Tracking which goalie is active
- Recording saves per period (or deriving from shots against minus goals)
- Recording goalie substitution times

**Team Rosters:**
Would require roster management before game starts - out of scope for current scoreboard use case.

**Coach/CEP Info:**
USA Hockey specific requirements for sanctioned games - low priority for recreational use.

## Files

- `src/ui/scoresheet.html` - Standalone page with Summary + Scoresheet layouts
- `src/ui/src/scoresheet.ts` - Fetch and render logic via WebSocket
- `src/ui/public/css/scoresheet.css` - Print styles
- `src/ui/vite.config.ts` - Multi-entry build (main + scoresheet)
