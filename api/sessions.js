import { createChatHistory } from "@upstash/agentkit-ai-sdk";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId wajib' });

  try {
    const history = createChatHistory();
    // Mengambil ringkasan semua chat milik user, urut dari yang terbaru.
    const chats = await history.listChats({ userId, limit: 50 });

    // Format agar sesuai dengan yang diharapkan frontend
    const sessions = chats.map(c => ({
      sessionId: c.sessionId,
      title: c.title || 'Percakapan tanpa judul',
      updatedAt: c.updatedAt || Date.now()
    }));

    return res.status(200).json({ sessions });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Gagal mengambil daftar sesi' });
  }
}
