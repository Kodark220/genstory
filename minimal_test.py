# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json

@gl.contract
class AdventureStoryWeaver:
    owner: Address
    story_count: u256
    stories: TreeMap[str, str]
    all_story_ids: DynArray[str]

    def __init__(self):
        self.owner = gl.message.sender_account
        self.story_count = 0

    @gl.public.view
    def echo(self, msg: str) -> dict:
        return {"message": msg, "sender": str(gl.message.sender_account)}

    @gl.public.write
    def ping(self) -> dict:
        return {"pong": True, "count": int(self.story_count)}
