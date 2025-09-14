// api/submit.js  (Vercel serverless function)
export default async function handler(req, res) {
  // CORS - allow embed + cross-site calls
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Robust body parsing (Vercel supports req.body but we handle fallback)
    let body = req.body;
    if (!body || Object.keys(body).length === 0) {
      const raw = await new Promise((resolve, reject) => {
        let buf = '';
        req.on('data', c => buf += c);
        req.on('end', () => resolve(buf));
        req.on('error', reject);
      });
      body = raw ? JSON.parse(raw) : {};
    }

    const xp = Number(body.xp || 0);
    const coins = Number(body.coins || 0);
    const diamonds = Number(body.diamonds || 0);
    const source = String(body.source || 'widget').slice(0, 200);

    const NOTION_TOKEN = process.env.NOTION_TOKEN;
    const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
    if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
      return res.status(500).json({ error: 'Server not configured: missing NOTION_TOKEN or NOTION_DATABASE_ID' });
    }

    const now = new Date().toISOString();
    const titleParts = [];
    if (xp) titleParts.push(`+${xp} XP`);
    if (coins) titleParts.push(`+${coins} coins`);
    if (diamonds) titleParts.push(`+${diamonds} diamonds`);
    const titleText = `${titleParts.join(' ')} — ${source} — ${now.slice(0,10)}`;

    const createBody = {
      parent: { database_id: NOTION_DATABASE_ID },
      properties: {
        Name: { title: [{ text: { content: titleText } }] },
        Date: { date: { start: now } },
        XP: { number: xp },
        Coins: { number: coins },
        Diamonds: { number: diamonds },
        Source: { rich_text: [{ text: { content: source } }] }
      }
    };

    const notionRes = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createBody)
    });

    const data = await notionRes.json();
    if (!notionRes.ok) return res.status(notionRes.status).json({ error: data });

    return res.status(200).json({ ok: true, id: data.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
