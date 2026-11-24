import { createChatHistory } from "@upstash/agentkit-ai-sdk";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, q } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId wajib' });

  try {
    const history = createChatHistory();
    let sessions = [];

    if (q && q.trim().length > 0) {
      // Pencarian menggunakan searchChats
      const hits = await history.searchChats({ userId, query: q, target: "both", limit: 50 });
      sessions = hits.map(c => ({
        sessionId: c.sessionId,
        title: c.title || 'Percakapan',
        updatedAt: c.updatedAt || Date.now()
      }));
    } else {
      // Ambil daftar default
      const chats = await history.listChats({ userId, limit: 50 });
      sessions = chats.map(c => ({
        sessionId: c.sessionId,
        title: c.title || 'Percakapan tanpa judul',
        updatedAt: c.updatedAt || Date.now()
      }));
    }

    // Urutkan dari yang terbaru
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);

    return res.status(200).json({ sessions });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Gagal mengambil daftar sesi' });
  }
}
