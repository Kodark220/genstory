# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

@gl.contract
class TestContract:
    owner: Address
    
    def __init__(self):
        self.owner = gl.message.sender_account

    @gl.public.view
    def ping(self) -> dict:
        return {"ok": True}
