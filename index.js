const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'Brainora API' });
});

app.post('/preguntas', async (req, res) => {
  const { categoria = 'Cultura General' } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key no configurada' });
  }

  const prompt = `Genera exactamente 10 preguntas de trivia sobre ${categoria} en español.
Devuelve SOLO un array JSON válido, sin markdown, sin texto extra, sin backticks:
[{"q":"pregunta","opts":["A","B","C","D"],"ans":0,"exp":"explicación breve"}]
"ans" es el índice 0-3 de la opción correcta. Varía la dificultad. Sé preciso y entretenido.`;

  try {
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 2048 }
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err.error?.message || 'Error de Gemini' });
    }

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text.replace(/```json|```/g, '').trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return res.status(500).json({ error: 'Respuesta inesperada de la IA' });

    const preguntas = JSON.parse(match[0]);
    res.json({ preguntas });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/guardar-partida', async (req, res) => {
  const { username, categoria, puntos, correctas } = req.body;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/partidas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ username, categoria, puntos, correctas })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err.message });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/ranking', async (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/partidas?select=username,puntos,categoria,created_at&order=puntos.desc&limit=20`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );

    const data = await response.json();
    res.json({ ranking: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Brainora API corriendo en puerto ${PORT}`));
