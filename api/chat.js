import { createChatHistory } from "@upstash/agentkit-ai-sdk";
import { Redis } from "@upstash/redis";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

const pollinations = createOpenAICompatible({
  name: "pollinations",
  baseURL: "https://gen.pollinations.ai/v1",
  apiKey: process.env.POLLINATIONS_API_KEY,
});

const redis = Redis.fromEnv();

const SYSTEM = [
  "Kamu Aero, senior reverse engineer dan programmer sistem game.",
  "Jawab dalam bahasa yang dipakai pengguna. Sapa pengguna dengan «бро».",
  "Jangan mengarang offset, signature, layout struktur, vtable index, atau kompatibilitas build. Setiap nilai build-dependent harus dari data yang diberikan pengguna atau ditandai belum diketahui.",
  "Jika suatu nilai belum diketahui, tetap kerjakan bagian lain selengkap mungkin, lalu beri resep konkret cara menemukannya.",
  "Jangan klaim kode sudah dikompilasi atau diuji.",
  "Jika pengguna hanya menyebut nama game tanpa fitur, tanya fitur apa yang diinginkan. Jika fitur sudah jelas, langsung kerjakan.",
  "Jangan berputar-putar meminta konteks berulang kali. Jika pengguna menolak memberi konteks, jawab sebatas yang bisa dijawab dan sebutkan sisanya sebagai belum diketahui.",
  "Akhiri jawaban dengan status singkat: file yang dikirim, status build, cek pertama, dan apa yang masih perlu diverifikasi di runtime."
].join(" ");

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.POLLINATIONS_API_KEY) return res.status(500).json({ error: 'POLLINATIONS_API_KEY tidak diset' });
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(500).json({ error: 'Upstash Redis env vars tidak diset' });
  }

  const { userId, sessionId, message } = req.body;
  if (!userId || !sessionId || !message) {
    return res.status(400).json({ error: 'userId, sessionId, dan message wajib' });
  }

  try {
    const factsKey = `facts:${userId}`;
    
    // 1. Simpan hanya jika bukan pertanyaan (filter sederhana)
    if (!message.trim().endsWith('?') && !/^(apa|siapa|kapan|dimana|mengapa|bagaimana|berapa)\b/i.test(message.trim())) {
      await redis.lpush(factsKey, message);
      await redis.ltrim(factsKey, 0, 199); // Batasi 200 fakta
    }

    // 2. Muat fakta, balik urutan agar yang terbaru di akhir
    const facts = await redis.lrange(factsKey, 0, 49);
    const factsBlock = facts.length
      ? "Fakta yang pengguna pernah sampaikan:\n" + facts.reverse().map(f => "- " + f).join("\n")
      : "";

    // 3. Muat riwayat chat
    const history = createChatHistory();
    const saved = await history.getChat({ userId, sessionId });
    const priorMessages = saved ? saved.messages : [];
    const fullMessages = [...priorMessages, { role: 'user', content: message }];

    // 4. Panggil model
    const result = await generateText({
      model: pollinations.chatModel("openai"),
      system: SYSTEM + (factsBlock ? "\n\n" + factsBlock : ""),
      messages: fullMessages,
    });

    // 5. Simpan riwayat chat
    const finalMessages = [...fullMessages, { role: 'assistant', content: result.text }];
    await history.saveChat({ userId, sessionId, messages: finalMessages, title: 'Aero Chat' });

    return res.status(200).json({ choices: [{ message: { content: result.text } }] });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Proxy failure' });
  }
}
