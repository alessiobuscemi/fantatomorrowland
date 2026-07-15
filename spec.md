# Fantatomorrowland — Game Rules Spec

A twisted fantacalcio played during Tomorrowland. Single-phone, offline web app.
The admin (Alessio) enters everything: friends, teams, and point events.

## Entities

### Friend (the "players" pool)
- `name` (unique, non-empty)
- `cost` (integer credits > 0), set by the admin when building the pool

### Team
- `owner`: one Friend from the pool (the participant who owns this team)
- `roster`: a set of Friends, with constraints:
  - total cost of roster ≤ **100 credits**
  - **no limit on team size**
  - the owner **cannot** be in their own roster (no self-pick)
  - the same Friend **can** appear in any number of different teams
  - no duplicate friend inside one roster
- `captain`: exactly one Friend from the roster
- `captainCategory`: one of the five categories, chosen at team creation

### Categories
`sex`, `disgust`, `idiocy`, `drama`, `pain`

### Event (a point attribution)
- `description`: free text of what happened
- `friend`: the Friend it happened to
- `category`: one of the five categories
- `points`: non-zero integer (negatives allowed, for penalties/mercy)
- `timestamp`: when it was logged

## Scoring

- An event gives `points` to **every team whose roster contains that friend**.
- If the friend is that team's **captain** AND the event category equals the
  team's `captainCategory`, that team receives **2 × points** for the event
  (doubling applies per-team: the same event can be doubled for one team and
  not for another).
- Team totals are always **recomputed from the event log**, never stored, so
  events can be edited or deleted and standings stay consistent.

## App behaviour

- Data persists in the browser (localStorage) on the admin's phone.
- JSON export/import for backup (festival phones die, get lost, fall in mud).
- Screens: friends pool setup, team builder (with live budget countdown),
  event logger (friend + category + points + description), leaderboard
  (team standings + per-friend point breakdown), event history with
  edit/delete.
- Teams stay editable (people will negotiate), but the app is honest: totals
  always reflect the current roster against the full event log.
