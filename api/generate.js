const API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-lite-latest'
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { systemInstruction, prompt } = req.body;
  if (!systemInstruction || !prompt) {
    return res.status(400).json({ error: 'Missing systemInstruction or prompt' });
  }

  if (!API_KEY) {
    return res.status(500).json({ error: 'Gemini API key not configured on server' });
  }

  let lastError = null;

  for (const model of MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Status ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Empty response');
      }

      return res.status(200).json({ text });
    } catch (error) {
      console.warn(`Server cascade: Model ${model} failed. Error:`, error.message || error);
      lastError = error;
    }
  }

  return res.status(502).json({ error: `All Gemini models failed. Last error: ${lastError?.message || lastError}` });
}
