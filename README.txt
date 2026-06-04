AdventureStoryWeaver is deployed and working on GenLayer Bradbury.

## Contract
- **Address**: `0x2eE92ba9bfa4FFd32293828ed28F463ed2b55c50`
- **Network**: Bradbury Testnet
- **Code**: Off-chain LLM (content passed as params, no in-contract LLM calls)

## Dashboard
- **Location**: `C:\Users\OLUWATOYOSI\Desktop\AISTORY\story-dashboard\`
- **Run locally**: `npm run dev`
- **Build**: `npm run build` → `dist/` folder ready to deploy
- **Tech**: Vite + React + Framer Motion, dark CRT theme, network switcher (Studionet/Bradbury)

## Deploy Dashboard
1. Go to https://vercel.com and import the `story-dashboard/` folder
2. Or upload the `dist/` folder to any static host (Netlify, Cloudflare Pages, GitHub Pages)
3. The dashboard reads from the Bradbury RPC directly and switches between networks

## CLI Commands
```
# Read
genlayer call 0x2eE92ba9bfa4FFd32293828ed28F463ed2b55c50 get_settings
genlayer call 0x2eE92ba9bfa4FFd32293828ed28F463ed2b55c50 get_all_stories
genlayer call 0x2eE92ba9bfa4FFd32293828ed28F463ed2b55c50 get_story --args story_1

# Write (content pre-generated off-chain)
genlayer write <address> create_story --args '<seed>' '<chapter>' '["c1","c2","c3"]' <genre> <max_chapters> <stake>
genlayer write <address> add_chapter --args '<story_id>' '<action>' '<chapter_text>' '["c1","c2","c3"]'
genlayer write <address> end_story --args '<story_id>' '<winner_addr>' '<reason>' '<scores_json>' '<rating_json>'
```
