"""
AdventureStoryWeaver — Complete Test Suite

Matches the exact architecture diagram:

  create_story → join_story → add_chapter → end_story
      ↓              ↓             ↓             ↓
  Story       Joining     Story       Ending &
  Creation    Module      Continuation Judging
  Module                  Module       Module

Views: get_story, get_chapters, get_players, get_pot, get_all_stories
"""

import json


def test_deployment(contract):
    """Verify the contract deployed correctly."""
    print("\n🧪 TEST 1: Deployment Check")
    settings = contract.get_settings()
    assert settings['total_stories'] == 0
    assert settings['min_stake'] == 0
    assert settings['max_chapters_default'] > 0
    print(f"  ✅ Contract deployed. Owner: {settings['owner'][:20]}...")
    print(f"  ✅ max_chapters={settings['max_chapters_default']}")


def test_create_story(contract):
    """Create a story — LLM generates opening chapter from seed."""
    print("\n🧪 TEST 2: create_story() — Story Creation Module")

    result = contract.create_story(
        "A lone robot wakes up in an abandoned library on a dead planet. "
        "It finds a single book still intact — 'How to Grow a Garden.' "
        "The robot has never seen a plant, but it has a strange urge to try.",
        genre="sci-fi",
        max_chapters=6,
        stake_amount=0
    )

    assert result['status'] == 'created'
    story_id = result['story_id']
    assert story_id == 'story_1'
    assert 'opening_chapter' in result
    assert len(result['suggested_choices']) == 3

    print(f"  ✅ Story created! ID: {story_id}")
    print(f"  ✅ Genre: {result['genre']}")
    print(f"  ✅ Max Chapters: {result['max_chapters']}")
    print(f"  ✅ Players: {result['players']}")
    print(f"  📖 Opening chapter generated! ({len(result['opening_chapter'])} chars)")
    print(f"  🎯 Suggested choices:")
    for i, c in enumerate(result['suggested_choices'], 1):
        print(f"     {i}. {c[:60]}...")
    return story_id


def test_get_story(contract, story_id):
    """Read full StoryRecord — get_story()."""
    print(f"\n🧪 TEST 3: get_story() — Read StoryRecord")
    story = contract.get_story(story_id)
    assert story['status'] == 'active'
    assert story['seed'].startswith('A lone robot')
    print(f"  ✅ Status: {story['status']}")
    print(f"  ✅ Seed: {story['seed'][:50]}...")
    print(f"  ✅ Genre: {story['genre']}")
    print(f"  ✅ Players: {story['player_count']}")
    print(f"  ✅ Pot: {story['pot']} wei")


def test_get_chapters(contract, story_id):
    """Read all chapters — get_chapters()."""
    print(f"\n🧪 TEST 4: get_chapters() — All Chapters")
    result = contract.get_chapters(story_id)
    assert result['total'] >= 1  # Opening chapter exists
    print(f"  ✅ Chapters: {result['total']}")
    ch = result['chapters'][0]
    print(f"  📖 Chapter 0: {ch['text'][:80]}...")
    print(f"  🎯 Suggestions: {len(ch['suggestions'])}")


def test_get_players(contract, story_id):
    """Read player list — get_players()."""
    print(f"\n🧪 TEST 5: get_players() — Player List")
    result = contract.get_players(story_id)
    assert result['total'] >= 1
    print(f"  ✅ Players: {result['total']}")
    for p in result['players']:
        print(f"     Player: {p['name']} | Stake: {p['stake']} | Choices: {p['choices_made']}")


def test_get_pot(contract, story_id):
    """Read current prize pot — get_pot()."""
    print(f"\n🧪 TEST 6: get_pot() — Prize Pot")
    result = contract.get_pot(story_id)
    print(f"  ✅ Pot: {result['pot']} wei")
    print(f"  ✅ Status: {result['status']}")


def test_add_chapter(contract, story_id):
    """Add a chapter via player action — add_chapter()."""
    print(f"\n🧪 TEST 7: add_chapter() — Story Continuation Module")

    result = contract.add_chapter(
        story_id,
        "The robot picks up the book and carefully opens its fragile pages. "
        "It wonders what a 'seed' is and decides to search the library for one."
    )

    assert result['chapter_number'] == 1
    assert len(result['suggested_choices']) == 3
    assert result['total_chapters'] == 2  # Opening + this one

    print(f"  ✅ Chapter {result['chapter_number']} generated!")
    print(f"  📖 {result['chapter_text'][:100]}...")
    print(f"  🎯 Suggested choices:")
    for i, c in enumerate(result['suggested_choices'], 1):
        print(f"     {i}. {c[:60]}...")
    print(f"  👤 Next player: {result['next_player']}...")
    return result


def test_end_story(contract, story_id):
    """End story and LLM judges winner — end_story()."""
    print(f"\n🧪 TEST 8: end_story() — Ending & Judging Module")

    result = contract.end_story(story_id)

    assert result['status'] == 'ended'
    assert len(result['winner']) > 0
    assert result['total_chapters'] >= 2

    print(f"  🏆 Winner: {result['winner'][:20]}...")
    print(f"  💬 Reason: {result['winner_reason'][:100]}...")
    print(f"  💰 Pot: {result['pot']} wei")
    print(f"  💸 Payout: {result['winner_payout']} wei")

    rating = result.get('story_rating', {})
    print(f"  📊 Story Rating: {rating.get('overall', '?')}/100")
    print(f"  📝 Summary: {rating.get('summary', '')[:80]}")

    print(f"\n  Scores:")
    for s in result.get('scores', []):
        print(f"     Player {s['address'][:15]}... — "
              f"Creativity: {s.get('creativity', '?')} | "
              f"Story: {s.get('storytelling', '?')} | "
              f"Total: {s.get('total_score', '?')}")


def test_get_all_stories(contract):
    """Browse all stories — get_all_stories()."""
    print(f"\n🧪 TEST 9: get_all_stories() — Browse Stories")
    all_s = contract.get_all_stories()
    active = contract.get_active_stories()
    print(f"  📚 Total: {all_s['total']} | Active: {active['total']}")
    for s in all_s['stories'][:5]:
        print(f"     #{s['id']}: {s['seed'][:40]}... | {s['genre']} | {s['status']} | Pot: {s['pot']}")


def test_leaderboard(contract):
    """Global leaderboard — get_leaderboard()."""
    print(f"\n🧪 TEST 10: get_leaderboard() — Leaderboard")
    result = contract.get_leaderboard()
    print(f"  👥 Total Players: {result['total_players']}")
    for p in result['leaderboard'][:5]:
        print(f"     {p['name']}: {p['wins']} wins | {p['stories_played']} stories | {p['total_choices']} choices")


def run_all_tests(contract):
    """Run the complete test suite."""
    print("=" * 60)
    print("🎭 ADVENTURE STORY WEAVER — TEST SUITE")
    print("=" * 60)

    try:
        test_deployment(contract)
        story_id = test_create_story(contract)
        test_get_story(contract, story_id)
        test_get_chapters(contract, story_id)
        test_get_players(contract, story_id)
        test_get_pot(contract, story_id)
        test_add_chapter(contract, story_id)
        test_end_story(contract, story_id)
        test_get_all_stories(contract)
        test_leaderboard(contract)

        print("\n" + "=" * 60)
        print("🎉 ALL TESTS PASSED!")
        print("=" * 60)
        print(f"\n  📋 Story used: {story_id}")
        print(f"  📄 Contract: AdventureStoryWeaver.py")
        print("\n💡 Next Steps:")
        print("   1. Deploy to Bradbury for production testing")
        print("   2. Build a frontend with genlayer-js")
        print("   3. Enable staking: update_settings(min_stake>0)")
        print("   4. Add more players for multiplayer stories")

    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        raise


if __name__ == "__main__":
    print("⚠️  Reference file — import and call run_all_tests(contract)")
    print("   with your deployed contract instance.")
