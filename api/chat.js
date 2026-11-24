import { createAgentMemory, createChatHistory } from "@upstash/agentkit-ai-sdk";
import { generateText } from "ai";

// Inisialisasi sekali di module level. Redis.fromEnv() membaca
// UPSTASH_REDIS_REST_URL dan UPSTASH_REDIS_REST_TOKEN dari environment Vercel.
const memory = createAgentMemory();
const history = createChatHistory();

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

  const apiKey = process.env.POLLINATIONS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'POLLINATIONS_API_KEY tidak diset' });

  // userId HARUS dari sumber auth terverifikasi di produksi (Clerk, Auth.js, dll).
  // Untuk prototipe pribadi, kita terima dari body dengan catatan ini TIDAK aman untuk multi-user.
  const { userId, sessionId, message } = req.body;
  if (!userId || !sessionId || !message) {
    return res.status(400).json({ error: 'userId, sessionId, dan message wajib' });
  }

  try {
    // 1. Muat riwayat lama dari Redis. createChatHistory menyimpan per userId + sessionId.
    const saved = await history.getChat({ userId, sessionId });
    const priorMessages = saved ? saved.messages : [];

    // 2. Gabungkan riwayat lama dengan pesan baru pengguna.
    const fullMessages = [...priorMessages, { role: 'user', content: message }];

    // 3. Panggil model dengan memori AgentKit.
    //    memory.tools() memberi model save_memory + recall_memory.
    //    memory.prepareStep() menyuntikkan fakta relevan ke instructions sebelum panggilan.
    const result = await generateText({
      model: 'openai', // ganti dengan model Pollinations yang mendukung tool calling
      system: SYSTEM + '\n\n' + memory.instructions,
      messages: fullMessages,
      tools: memory.tools({ userId }),
      prepareStep: memory.prepareStep({ userId }),
      maxSteps: 3,
    });

    // 4. Simpan seluruh percakapan (lama + baru + balasan asisten) ke Redis.
    //    saveChat menimpa seluruh array, jadi kita harus menyertakan yang lama.
    const finalMessages = [...fullMessages, { role: 'assistant', content: result.text }];
    await history.saveChat({
      userId,
      sessionId,
      messages: finalMessages,
      title: 'Aero Chat',
    });

    return res.status(200).json({
      choices: [{ message: { content: result.text } }],
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Proxy failure' });
  }
}
