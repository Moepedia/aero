import { createChatHistory } from "@upstash/agentkit-ai-sdk";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, sessionId } = req.query;
  if (!userId || !sessionId) {
    return res.status(400).json({ error: 'userId dan sessionId wajib' });
  }

  try {
    const history = createChatHistory();
    const saved = await history.getChat({ userId, sessionId });
    const messages = saved && saved.messages ? saved.messages : [];

    // messages format: [{role:'user'|'assistant', content:'...'}...]
    return res.status(200).json({ messages });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to load history' });
  }
}
