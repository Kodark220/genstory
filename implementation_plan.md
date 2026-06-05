# Implementation Plan — Competitive Story Battle Mode

This plan outlines the restructuring of AISTORY into a competitive "Story Battle" tournament where players join a lobby with a shared seed prompt but write their own independent narratives. At the end, the AI Judge compares all narratives to crown a winner.

## User Review Required

> [!IMPORTANT]
> - **Smart Contract Restructuring**: The contract `AdventureStoryWeaver.py` will be changed from a shared single-timeline cooperative model to a branched multi-timeline competitive model.
> - **Redeployment Required**: We will redeploy the new contract to GenLayer Bradbury testnet and update the dashboard config.
> - **Game Flow & Rules**:
>   - **Modes**: Support `solo` (1 player) and `multiplayer` (2 to 100 players) modes.
>   - **Lobby Activation**: In `multiplayer` mode, weaving chapters is blocked until at least **2 players** have joined the lobby.
>   - **Time Limit (3 Days)**: Lobbies expire exactly **3 days** (259,200 seconds) after creation. Once expired, no further chapters can be added.
>   - **Public Expiration End**: If a story is expired, **any user** (not just players/creators) can call `end_story` to trigger the AI Judge, declare the winner, and distribute the staked GEN pot. This prevents funds from being locked permanently.

---

## Proposed Changes

### 1. Smart Contract (`contract/AdventureStoryWeaver.py`)

#### [MODIFY] [AdventureStoryWeaver.py](file:///C:/Users/OLUWATOYOSI/Desktop/AISTORY/contract/AdventureStoryWeaver.py)
Update the storage and public methods:
- **Lobby Data Structure**:
  - `branches: TreeMap[str, str]` (mapping `player_address` to a JSON array of their chapters).
  - Track `mode` ("solo" | "multiplayer") and `created_at` (ISO timestamp).
- **Public Methods**:
  - `create_story(...)`: Initializes the battle lobby, stores `mode`, records `created_at` using `datetime.datetime.now().isoformat()`, and creates a branch for the creator.
  - `join_story(story_id, opening_chapter, choices, stake_amount)`: Registers a new player, checks the maximum limit of 100 players, and initializes their separate branch.
  - `add_chapter(story_id, action, chapter_text, choices)`:
    - Verifies story has not expired (current time - `created_at` < 3 days).
    - Verifies multiplayer lobbies have at least 2 players before accepting chapters.
    - Appends the chapter to the sender's own branch.
  - `end_story(story_id, winner_address, winner_reason, ...)`:
    - Allows creator or player to end normally.
    - Allows **anyone** to end if the current time is 3 days past `created_at` (expired).
    - Records the winner and closes the battle.

---

### 2. Frontend Library & State (`src/App.tsx`)

#### [MODIFY] [App.tsx](file:///C:/Users/OLUWATOYOSI/Desktop/AISTORY/src/App.tsx)
- Update **Create Story Modal**:
  - Add a toggle for "Solo Play" vs "Multiplayer Battle" (which enforces the min 2 / max 100 player limit).
- Update **Story Details Modal**:
  - Display the countdown timer remaining until the 3-day deadline.
  - Display message if the lobby is waiting for more players (in multiplayer mode with < 2 players).
  - Let anyone trigger the "AI Judge" button if the countdown reaches zero (story expired).
  - Render a tab bar to view other players' branches alongside your own active branch.

---

## Verification Plan

### Deployment & Tests
1. Run local deployment:
   ```bash
   python deploy_bradbury.py
   ```
2. Update `.contract_address` and `genlayer.ts` with the new contract address.
3. Test building the React app:
   ```bash
   npm run build
   ```
4. Verify the branched gameplay and expiration logic.
