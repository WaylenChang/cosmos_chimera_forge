"""Where the NPC race tables and baked bases live: in the game repo, which owns them (cosmos_chimera Q-A12).

The game's EditMode gates (UmaRaceBaseTests, UmaRecipeGateTests) read race_bases.json, race_keys.json and
race_channels.json there, and Unity imports the baked base FBX from Bases/. Defaults to the sibling checkout
../cosmos_chimera; set COSMIMERA_GAME to point elsewhere.

Pre: the game checkout exists. Post: GAME_NPC is an existing directory. Side effects: none (raises if missing).
"""
import os

_FORGE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GAME = os.environ.get("COSMIMERA_GAME") or os.path.join(os.path.dirname(_FORGE), "cosmos_chimera")
GAME_NPC = os.path.join(GAME, "Assets", "_Project", "Art", "Characters", "_UMA", "Npc")
GAME_BASES = os.path.join(GAME_NPC, "Bases")

if not os.path.isdir(GAME_NPC):
    raise SystemExit("game repo NPC folder not found: %s (set COSMIMERA_GAME)" % GAME_NPC)
