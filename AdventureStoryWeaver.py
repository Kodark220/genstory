# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json

class AdventureStoryWeaver(gl.Contract):
    """
    Adventure Story Weaver — on-chain multiplayer storytelling
    with GEN staking and AI-powered winner selection on GenLayer.

    Architecture:
      create_story -> join_story -> add_chapter -> end_story
    
    Note: create_story and add_chapter accept pre-generated content
    (off-chain LLM). end_story accepts judge results.
    """

    # === STORAGE ===
    owner: Address
    story_count: u256
    stories: TreeMap[str, str]
    all_story_ids: DynArray[str]
    min_stake: u256
    max_chapters_default: u256
    platform_fee_bps: u256

    def __init__(self, min_stake_wei: u256 = 0):
        self.owner = gl.message.sender_address
        self.story_count = 0
        self.min_stake = min_stake_wei
        self.max_chapters_default = 10
        self.platform_fee_bps = 0

    # ============================================================
    # STORY CREATION MODULE
    # ============================================================

    @gl.public.write
    def create_story(
        self,
        seed_prompt: str,
        opening_chapter: str,
        choices: str,  # JSON array: ["choice1", "choice2", "choice3"]
        genre: str = "fantasy",
        max_chapters: u256 = 10,
        stake_amount: u256 = 0
    ) -> dict:
        sender = str(gl.message.sender_address)
        self.story_count += 1
        story_id = f"story_{self.story_count}"
        actual_stake = stake_amount if stake_amount >= self.min_stake else 0

        import json as _json
        try:
            choices_list = _json.loads(choices)
            if not isinstance(choices_list, list) or len(choices_list) < 3:
                choices_list = ["Explore the path", "Investigate", "Wait and see"]
        except Exception:
            choices_list = ["Explore the path", "Investigate", "Wait and see"]

        story = {
            "id": story_id,
            "seed": seed_prompt,
            "genre": genre,
            "status": "active",
            "creator": sender,
            "max_chapters": int(max_chapters),
            "pot": int(actual_stake),
            "winner": "",
            "winner_reason": "",
            "story_rating": {},
            "chapters": [{
                "number": 0,
                "text": opening_chapter,
                "player": sender,
                "action": "Opening chapter",
                "suggestions": choices_list[:3]
            }],
            "players": [{
                "name": f"Player-{sender[:8]}",
                "address": sender,
                "stake": int(actual_stake),
                "choices_made": 0
            }]
        }
        self.stories[story_id] = _json.dumps(story)
        self.all_story_ids.append(story_id)

        return {
            "status": "created",
            "story_id": story_id,
            "opening_chapter": opening_chapter,
            "suggested_choices": choices_list[:3],
            "genre": genre,
            "players": [sender],
            "pot": int(actual_stake),
            "total_chapters": 1,
            "max_chapters": int(max_chapters)
        }

    # ============================================================
    # JOINING MODULE
    # ============================================================

    @gl.public.write
    def join_story(self, story_id: str, stake_amount: u256 = 0) -> dict:
        if story_id not in self.stories:
            raise gl.UserError("[EXPECTED] Story not found")
        story = json.loads(self.stories[story_id])
        sender = str(gl.message.sender_address)
        if story["status"] != "active":
            raise gl.UserError("[EXPECTED] Story is not active")
        for p in story["players"]:
            if p["address"] == sender:
                raise gl.UserError("[EXPECTED] Already a player")
        actual_stake = stake_amount if stake_amount >= self.min_stake else 0
        story["players"].append({
            "name": f"Player-{sender[:8]}",
            "address": sender,
            "stake": int(actual_stake),
            "choices_made": 0
        })
        story["pot"] += int(actual_stake)
        self.stories[story_id] = json.dumps(story)
        return {
            "story_id": story_id,
            "status": story["status"],
            "player_count": len(story["players"]),
            "pot": story["pot"],
            "message": "Joined successfully"
        }

    # ============================================================
    # STORY CONTINUATION MODULE
    # ============================================================

    @gl.public.write
    def add_chapter(
        self,
        story_id: str,
        action: str,
        chapter_text: str,
        choices: str  # JSON array
    ) -> dict:
        if story_id not in self.stories:
            raise gl.UserError("[EXPECTED] Story not found")
        story = json.loads(self.stories[story_id])
        sender = str(gl.message.sender_address)
        if story["status"] != "active":
            raise gl.UserError("[EXPECTED] Story is not active")
        player_found = False
        for p in story["players"]:
            if p["address"] == sender:
                p["choices_made"] += 1
                player_found = True
                break
        if not player_found:
            raise gl.UserError("[EXPECTED] Not a player")
        if len(story["chapters"]) >= story["max_chapters"]:
            raise gl.UserError("[EXPECTED] Max chapters reached")

        import json as _json
        try:
            choices_list = _json.loads(choices)
        except Exception:
            choices_list = ["Continue", "Take another path", "Wait"]

        chapter_number = len(story["chapters"])
        story["chapters"].append({
            "number": chapter_number,
            "text": chapter_text,
            "player": sender,
            "action": action,
            "suggestions": choices_list[:3]
        })
        # Round-robin next player
        player_count = len(story["players"])
        player_index = 0
        for i, p in enumerate(story["players"]):
            if p["address"] == sender:
                player_index = i
                break
        next_player_index = (player_index + 1) % player_count
        next_player = story["players"][next_player_index]["address"]
        self.stories[story_id] = _json.dumps(story)
        return {
            "chapter_number": chapter_number,
            "chapter_text": chapter_text,
            "suggested_choices": choices_list[:3],
            "next_player": next_player,
            "total_chapters": len(story["chapters"]),
            "max_chapters": story["max_chapters"],
            "player_count": player_count
        }

    # ============================================================
    # ENDING & JUDGING MODULE
    # ============================================================

    @gl.public.write
    def end_story(
        self,
        story_id: str,
        winner_address: str,
        winner_reason: str,
        scores: str,  # JSON array of score objects
        story_rating_str: str  # JSON object
    ) -> dict:
        if story_id not in self.stories:
            raise gl.UserError("[EXPECTED] Story not found")
        story = json.loads(self.stories[story_id])
        sender = str(gl.message.sender_address)
        if story["status"] != "active":
            raise gl.UserError("[EXPECTED] Story is not active")
        is_creator = story["creator"] == sender
        is_player = any(p["address"] == sender for p in story["players"])
        if not is_creator and not is_player:
            raise gl.UserError("[EXPECTED] Only creator or player can end")

        import json as _json
        try:
            scores_list = _json.loads(scores)
        except Exception:
            scores_list = []
        try:
            rating = _json.loads(story_rating_str)
        except Exception:
            rating = {}

        story["status"] = "ended"
        story["winner"] = winner_address
        story["winner_reason"] = winner_reason
        story["story_rating"] = rating
        pot = story["pot"]
        self.stories[story_id] = _json.dumps(story)
        return {
            "status": "ended",
            "winner": winner_address,
            "winner_reason": winner_reason,
            "scores": scores_list,
            "story_rating": rating,
            "pot": pot,
            "winner_payout": pot,
            "total_chapters": len(story["chapters"]),
            "total_players": len(story["players"])
        }

    # ============================================================
    # ADMIN
    # ============================================================

    @gl.public.write
    def force_end_story(self, story_id: str) -> dict:
        if gl.message.sender_address != self.owner:
            raise gl.UserError("[EXPECTED] Only owner")
        if story_id not in self.stories:
            raise gl.UserError("[EXPECTED] Story not found")
        story = json.loads(self.stories[story_id])
        story["status"] = "cancelled"
        self.stories[story_id] = json.dumps(story)
        return {"story_id": story_id, "status": "cancelled", "message": "Force-ended"}

    @gl.public.write
    def update_settings(self, min_stake: u256, max_chapters: u256, fee_bps: u256) -> dict:
        if gl.message.sender_address != self.owner:
            raise gl.UserError("[EXPECTED] Only owner")
        self.min_stake = min_stake
        self.max_chapters_default = max_chapters
        self.platform_fee_bps = fee_bps
        return {
            "min_stake": int(self.min_stake),
            "max_chapters": int(self.max_chapters_default),
            "platform_fee_bps": int(self.platform_fee_bps)
        }

    # ============================================================
    # VIEW METHODS
    # ============================================================

    @gl.public.view
    def get_story(self, story_id: str) -> dict:
        if story_id not in self.stories:
            return {"error": "Story not found", "found": False}
        story = json.loads(self.stories[story_id])
        return {
            "id": story["id"], "seed": story["seed"], "genre": story["genre"],
            "status": story["status"], "creator": story["creator"],
            "pot": story["pot"], "max_chapters": story["max_chapters"],
            "total_chapters": len(story["chapters"]),
            "player_count": len(story["players"]),
            "winner": story.get("winner", ""),
            "winner_reason": story.get("winner_reason", ""),
            "found": True
        }

    @gl.public.view
    def get_chapters(self, story_id: str) -> dict:
        if story_id not in self.stories:
            return {"error": "Story not found", "total": 0, "chapters": []}
        story = json.loads(self.stories[story_id])
        return {"total": len(story["chapters"]), "chapters": story["chapters"]}

    @gl.public.view
    def get_players(self, story_id: str) -> dict:
        if story_id not in self.stories:
            return {"error": "Story not found", "total": 0, "players": []}
        story = json.loads(self.stories[story_id])
        return {"total": len(story["players"]), "players": story["players"]}

    @gl.public.view
    def get_pot(self, story_id: str) -> dict:
        if story_id not in self.stories:
            return {"error": "Story not found", "pot": 0}
        story = json.loads(self.stories[story_id])
        return {"pot": story["pot"], "status": story["status"]}

    @gl.public.view
    def get_all_stories(self) -> dict:
        stories_list = []
        for sid in self.all_story_ids:
            try:
                s = json.loads(self.stories[sid])
                stories_list.append({
                    "id": s["id"], "seed": s["seed"][:60],
                    "genre": s["genre"], "status": s["status"],
                    "pot": s["pot"], "total_chapters": len(s["chapters"]),
                    "player_count": len(s["players"]),
                    "winner": s.get("winner", "")
                })
            except Exception:
                pass
        return {"stories": stories_list, "total": len(stories_list)}

    @gl.public.view
    def get_active_stories(self) -> dict:
        stories_list = []
        for sid in self.all_story_ids:
            try:
                s = json.loads(self.stories[sid])
                if s["status"] == "active":
                    stories_list.append({
                        "id": s["id"], "seed": s["seed"][:60],
                        "genre": s["genre"], "pot": s["pot"],
                        "player_count": len(s["players"]),
                        "total_chapters": len(s["chapters"]),
                        "max_chapters": s["max_chapters"]
                    })
            except Exception:
                pass
        return {"stories": stories_list, "total": len(stories_list)}

    @gl.public.view
    def get_leaderboard(self) -> dict:
        player_stats = {}
        for sid in self.all_story_ids:
            try:
                s = json.loads(self.stories[sid])
                if s["status"] != "ended":
                    continue
                for p in s["players"]:
                    addr = p["address"]
                    if addr not in player_stats:
                        player_stats[addr] = {
                            "name": p["name"], "address": addr,
                            "wins": 0, "stories_played": 0, "total_choices": 0
                        }
                    player_stats[addr]["stories_played"] += 1
                    player_stats[addr]["total_choices"] += p["choices_made"]
                    if s.get("winner") == addr:
                        player_stats[addr]["wins"] += 1
            except Exception:
                pass
        sorted_players = sorted(
            player_stats.values(),
            key=lambda x: x["wins"],
            reverse=True
        )
        return {"leaderboard": sorted_players, "total_players": len(sorted_players)}

    @gl.public.view
    def get_settings(self) -> dict:
        return {
            "owner": str(self.owner),
            "min_stake": int(self.min_stake),
            "max_chapters_default": int(self.max_chapters_default),
            "platform_fee_bps": int(self.platform_fee_bps),
            "total_stories": int(self.story_count)
        }
