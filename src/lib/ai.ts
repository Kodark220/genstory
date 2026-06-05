// AI service to generate story chapters, actions, and judge results using Gemini API
// with a high-quality local narrative generator fallback.

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

interface StoryChapter {
  text: string;
  action?: string;
  player: string;
}

interface PlayerInfo {
  address: string;
  name?: string;
}

// Helper to make API calls to Gemini
async function callGemini(systemInstruction: string, prompt: string): Promise<string> {
  if (!API_KEY) {
    throw new Error('API key not configured');
  }

  // We use gemini-1.5-flash as it is extremely fast and has stable free-tier availability
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
  const payload = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    generationConfig: {
      responseMimeType: 'application/json'
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Empty response from Gemini');
  }

  return text;
}

/* ── 1. Create Story ── */

export async function generateOpeningChapter(genre: string, seed: string): Promise<{ chapter: string; choices: string[] }> {
  const systemInstruction = `You are the Oracle of an interactive storytelling game on the blockchain. 
Generate the opening chapter of a story in the given genre and seed prompt. 
You MUST output a JSON object containing:
- 'chapter' (string, around 120-180 words, highly descriptive, atmospheric, and immersive)
- 'choices' (JSON array of exactly 3 distinct, compelling, and short choice strings for the player's next move, e.g. ["Investigate the glowing seal", "Climb the crumbling spire", "Prepare a defensive spell"])

Output raw JSON only. Do not wrap in markdown block formatting (no \`\`\`json).`;

  const prompt = `Genre: ${genre}
Seed Prompt: ${seed}`;

  try {
    const jsonStr = await callGemini(systemInstruction, prompt);
    const parsed = JSON.parse(jsonStr.trim());
    if (parsed.chapter && Array.isArray(parsed.choices)) {
      return {
        chapter: parsed.chapter,
        choices: parsed.choices.slice(0, 3)
      };
    }
    throw new Error('Invalid format returned from AI');
  } catch (error) {
    console.warn('Failed to generate opening chapter via Gemini, using fallback:', error);
    return getLocalOpeningChapter(genre, seed);
  }
}

/* ── 2. Add Chapter ── */

export async function generateNextChapter(
  genre: string,
  previousChapters: StoryChapter[],
  action: string
): Promise<{ chapter: string; choices: string[] }> {
  const systemInstruction = `You are the Oracle of an interactive, turn-based storytelling game. 
You must write the next chapter of the story based on the history of chapters and the player's chosen action.
The narrative must build directly upon the history and seamlessly integrate the new action.
You MUST output a JSON object containing:
- 'chapter' (string, around 120-180 words, continuing the narrative in a high-quality, atmospheric tone)
- 'choices' (JSON array of exactly 3 distinct, short next action suggestions, e.g. ["Touch the ancient device", "Retreat back into the mist", "Call out into the darkness"])

Output raw JSON only. Do not wrap in markdown block formatting (no \`\`\`json).`;

  const historyText = previousChapters
    .map((c, i) => `[Chapter ${i}] (By Player ${c.player.slice(0, 8)}...)\nAction taken: ${c.action || 'Start'}\nNarrative: ${c.text}`)
    .join('\n\n');

  const prompt = `Story History:\n${historyText}\n\nNew Action to resolve: "${action}"\n\nWrite the next chapter and provide 3 choices.`;

  try {
    const jsonStr = await callGemini(systemInstruction, prompt);
    const parsed = JSON.parse(jsonStr.trim());
    if (parsed.chapter && Array.isArray(parsed.choices)) {
      return {
        chapter: parsed.chapter,
        choices: parsed.choices.slice(0, 3)
      };
    }
    throw new Error('Invalid format returned from AI');
  } catch (error) {
    console.warn('Failed to generate next chapter via Gemini, using fallback:', error);
    return getLocalNextChapter(genre, action, previousChapters.length);
  }
}

/* ── 3. End & Judge Story ── */

export interface JudgeResult {
  winner: string;
  reason: string;
  scores: { address: string; creativity: number; storytelling: number; total_score: number }[];
  rating: { overall: number; summary: string };
}

export async function generateJudgeResult(
  genre: string,
  chapters: StoryChapter[],
  players: PlayerInfo[]
): Promise<JudgeResult> {
  const systemInstruction = `You are the AI Judge of an interactive multiplayer storytelling game. 
Read the full story and evaluate each player's contribution. Choose a winner from the list of players, score them, and rate the overall story.
You MUST output a JSON object containing:
- 'winner' (string, must be the exact address of one of the players provided in the list)
- 'reason' (string, around 100-150 words, detailing why they won, summarizing their narrative impact, and offering specific praise)
- 'scores' (JSON array of score objects, one for each player, containing:
    - 'address' (string, the player's address)
    - 'creativity' (number, 1-100)
    - 'storytelling' (number, 1-100)
    - 'total_score' (number, 1-100)
  )
- 'rating' (JSON object containing:
    - 'overall' (number, 1-100 overall score of the story saga)
    - 'summary' (string, around 50 words summarizing the theme and quality of the final tale)
  )

Output raw JSON only. Do not wrap in markdown block formatting (no \`\`\`json).`;

  const historyText = chapters
    .map((c, i) => `[Chapter ${i}] (By Player ${c.player})\nAction taken: ${c.action || 'Start'}\nNarrative: ${c.text}`)
    .join('\n\n');

  const playerAddresses = players.map(p => p.address);
  const prompt = `Story History:\n${historyText}\n\nList of eligible player addresses:\n${playerAddresses.join('\n')}\n\nEvaluate the players and output the JSON judgment.`;

  try {
    const jsonStr = await callGemini(systemInstruction, prompt);
    const parsed = JSON.parse(jsonStr.trim());
    if (parsed.winner && Array.isArray(parsed.scores) && parsed.rating) {
      // Clean and ensure winner is one of the players
      let winnerAddr = parsed.winner.trim().toLowerCase();
      const match = playerAddresses.find(addr => addr.toLowerCase() === winnerAddr);
      if (match) {
        winnerAddr = match;
      } else {
        winnerAddr = playerAddresses[0]; // Fallback to first player if AI returned invalid address
      }
      return {
        winner: winnerAddr,
        reason: parsed.reason || 'For outstanding narrative choices.',
        scores: parsed.scores,
        rating: parsed.rating
      };
    }
    throw new Error('Invalid format returned from AI');
  } catch (error) {
    console.warn('Failed to judge story via Gemini, using fallback:', error);
    return getLocalJudgeResult(genre, chapters, players);
  }
}

/* ── LOCAL FALLBACK GENERATOR ── */

const LOCAL_OPENING_TEMPLATES: Record<string, { chapter: string; choices: string[] }> = {
  fantasy: {
    chapter: "The air grows heavy with the scent of damp earth and ancient moss. The seed of your intent, '{seed}', takes root in this forgotten realm. You stand before a crumbling stone archway, its runes glowing with a soft, amber light. Shadows stretch long across the ground as the wind carries a faint whisper from the deep woods beyond, urging you to step forward.",
    choices: [
      "Pass through the glowing stone archway",
      "Examine the glowing runes for a hidden message",
      "Turn back and seek shelter in the nearby cavern"
    ]
  },
  'sci-fi': {
    chapter: "Emergency lights pulse in a slow, rhythmic amber heartbeat. Your computer terminal flickers, loading the parameters: '{seed}'. The life support hums at a critical 12% capacity. Through the cracked viewport, a cosmic storm swirls like a dust devil in the void. An unopened bulkhead stands before you, hissed closed by centuries of lock-seal.",
    choices: [
      "Override the bulkhead door manual controls",
      "Check the terminal for logs about the ship's fate",
      "Conserve power and wait for the cosmic storm to clear"
    ]
  },
  cyberpunk: {
    chapter: "Rain-slicked streets reflect neon signs of virtual gods. The decrypted data packet, '{seed}', is loaded into your neural deck. Your cybernetic eye glitches, throwing static across your field of vision. Down in the wet alleyway, a heavy door of a black-market fixer's shop sits locked, while above, a drone hovers with a searchlight.",
    choices: [
      "Jack into the alley terminal to disable the drone",
      "Knock on the fixer's door using the secure code",
      "Slip into the shadows and wait for the patrol to pass"
    ]
  },
  horror: {
    chapter: "A cold dread settles in your stomach as you recount the memory: '{seed}'. The floorboards creak under your feet like dry bones. Outside, the fog is so thick it presses against the windows like a physical presence. Down the hallway, a heavy door drifts open, revealing absolute darkness, while a scratching sound echoes from behind the cellar door.",
    choices: [
      "Investigate the cellar door and the scratching",
      "Walk slowly toward the dark door down the hallway",
      "Lock yourself in the room and wait for dawn"
    ]
  },
  mystery: {
    chapter: "Dust motes dance in the shaft of sunlight cutting through the heavy drapes. The case file details are clear: '{seed}'. You sit at the mahogany desk of the deceased collector, a glass of half-drunk amber liquid beside a locked brass desk drawer. A grandfather clock ticks loudly in the corner, its timing slightly off.",
    choices: [
      "Pick the lock of the brass desk drawer",
      "Examine the grandfather clock for irregularities",
      "Search the bookshelves for hidden compartments"
    ]
  }
};

function getLocalOpeningChapter(genre: string, seed: string): { chapter: string; choices: string[] } {
  const cleanGenre = genre.toLowerCase();
  const template = LOCAL_OPENING_TEMPLATES[cleanGenre] || LOCAL_OPENING_TEMPLATES.fantasy;
  return {
    chapter: template.chapter.replace('{seed}', seed),
    choices: template.choices
  };
}

function getLocalNextChapter(genre: string, action: string, index: number): { chapter: string; choices: string[] } {
  const cleanGenre = genre.toLowerCase();
  const actions: Record<string, string[]> = {
    fantasy: [
      `Resolving action: "${action}". Stepping forward, the air grows warmer. You discover a hidden stone altar, its surface engraved with a crescent moon. Beside it lies a key forged of starlight.`,
      `Resolving action: "${action}". As you proceed, a spectral guardian blocking the path asks you a riddle. The forest around you holds its breath.`,
      `Resolving action: "${action}". The path leads to a high clearing. A grand golden chest rests under a beam of sunlight, surrounded by silent stone statues.`
    ],
    'sci-fi': [
      `Resolving action: "${action}". The hatch opens with a heavy hiss. Inside, a console blinks with an ancient message from a stranded crew. A power core lies active on the table.`,
      `Resolving action: "${action}". The terminal outputs a coordinate set pointing to a hidden colony. A sudden shift in the hull suggests something is moving outside.`,
      `Resolving action: "${action}". You manage to restore backup power. A holographic map of the star system projects into the air, revealing a hidden planet.`
    ],
    cyberpunk: [
      `Resolving action: "${action}". The terminal bypass succeeds! The security drone sparks and crashes to the ground. A datastick ejected from the drone glows with encrypted data.`,
      `Resolving action: "${action}". The door opens, revealing the fixer's hideout. Holograms flicker in the smoke-filled room. The fixer looks up, pointing to a cybernetic case.`,
      `Resolving action: "${action}". You find a high-frequency jack. Plugging in, you intercept a corporate transmission indicating a bounty has been placed on your neural deck.`
    ],
    horror: [
      `Resolving action: "${action}". The creaking stops. You enter the room, finding a dusty leather journal on a table. The writing inside is fresh, and it describes your exact movements.`,
      `Resolving action: "${action}". The scratching sound stops. In its place, a soft whisper calls your name from the darkness. You find an old iron lantern on the shelf.`,
      `Resolving action: "${action}". A cold draft blows past you, extinguishing the light. When you strike a match, a shadowy figure stands at the far end of the room.`
    ],
    mystery: [
      `Resolving action: "${action}". The lock clicks open. Inside the drawer, you find a ledger detailing secret transactions and a small velvet box containing a seal ring.`,
      `Resolving action: "${action}". You open the clock face. Taped to the pendulum is a brass key and a hand-drawn map of the estate's hedge maze.`,
      `Resolving action: "${action}". A hidden panel slides open, revealing a safe. On the safe's door, a series of symbols matches the pattern on the collector's pocket watch.`
    ]
  };

  const choiceLists: Record<string, string[][]> = {
    fantasy: [
      ["Pick up the starlight key", "Examine the crescent moon altar", "Leave the altar and go forward"],
      ["Answer the riddler with wisdom", "Attempt to bypass the guardian by force", "Ask the guardian for its purpose"],
      ["Open the golden chest", "Inspect the stone statues", "Leave the clearing immediately"]
    ],
    'sci-fi': [
      ["Take the active power core", "Play the ancient audio message", "Seal the hatch behind you"],
      ["Navigate the ship to the coordinates", "Deploy scanning probes to check the hull", "Enter the escape pod"],
      ["Download the star system map", "Scan the hidden planet", "Shut down console to hide presence"]
    ],
    cyberpunk: [
      ["Pick up the decrypted datastick", "Examine the wreckage of the drone", "Slip away before guards arrive"],
      ["Ask the fixer about the corporate datashrink", "Inspect the cybernetic case", "Decline the fixer's deal"],
      ["Trace the transmission source", "Install a firewall block", "Eject neural deck immediately"]
    ],
    horror: [
      ["Read the latest pages of the journal", "Pocket the journal and run", "Burn the book immediately"],
      ["Light the old iron lantern", "Answer the whisper in the dark", "Back away slowly"],
      ["Strike another match", "Flee into the hallway", "Stand still and call out"]
    ],
    mystery: [
      ["Examine the ledger details", "Open the velvet box", "Pocket the seal ring and leave"],
      ["Take the brass key", "Study the maze map", "Re-lock the clock and wait"],
      ["Use the symbols to unlock the safe", "Search for the pocket watch", "Leave the study room"]
    ]
  };

  const genreTemplates = actions[cleanGenre] || actions.fantasy;
  const genreChoices = choiceLists[cleanGenre] || choiceLists.fantasy;
  
  const templateIndex = index % genreTemplates.length;

  return {
    chapter: genreTemplates[templateIndex],
    choices: genreChoices[templateIndex]
  };
}

function getLocalJudgeResult(genre: string, chapters: StoryChapter[], players: PlayerInfo[]): JudgeResult {
  // Determine winner based on activity (choices made/chapters contributed)
  // Count how many chapters each player wrote
  const contributionCounts: Record<string, number> = {};
  players.forEach(p => { contributionCounts[p.address] = 0; });
  
  chapters.forEach(c => {
    const addr = c.player.toLowerCase();
    const match = players.find(p => p.address.toLowerCase() === addr);
    if (match) {
      contributionCounts[match.address] = (contributionCounts[match.address] || 0) + 1;
    }
  });

  // Pick winner (the one with most contributions, default to first player)
  let winner = players[0]?.address || '0x0000000000000000000000000000000000000000';
  let maxChapters = 0;
  
  players.forEach(p => {
    if (contributionCounts[p.address] > maxChapters) {
      maxChapters = contributionCounts[p.address];
      winner = p.address;
    }
  });

  // Create player scores
  const scores = players.map(p => {
    const contrib = contributionCounts[p.address] || 0;
    const baseScore = contrib > 0 ? 75 : 50;
    const creativity = Math.min(100, baseScore + Math.floor(Math.random() * 20));
    const storytelling = Math.min(100, baseScore + Math.floor(Math.random() * 20));
    return {
      address: p.address,
      creativity,
      storytelling,
      total_score: Math.round((creativity + storytelling) / 2)
    };
  });

  return {
    winner,
    reason: `The Oracle has read the chronicles of the ${genre} saga. Player ${winner.slice(0, 8)}... drove the narrative forward, making decisive choices that gave the story its climax. Their actions showed the highest level of cleverness and thematic alignment.`,
    scores,
    rating: {
      overall: 82,
      summary: `A collaborative tale of adventure and risk in the ${genre} genre. The players worked together to navigate challenges, shaping a memorable saga that concluded with key narrative payoffs.`
    }
  };
}
