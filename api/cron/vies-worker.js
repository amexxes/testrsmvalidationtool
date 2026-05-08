// /api/cron/vies-worker.js
import { kv } from "@vercel/kv";
import { runWorkerSlice } from "../fr-job/[id].js";

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  // Optional protection (recommended)
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers?.authorization || req.headers?.Authorization || "";
    if (auth !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });
  }

const maxTasks = Number(process.env.CRON_MAX_TASKS || process.env.POLL_MAX_TASKS || "24");
const maxMs = Number(process.env.CRON_MAX_MS || process.env.POLL_MAX_MS || "9000");
  const wantDebug = String(req.query?.debug || "") === "1";

  const started = Date.now();

  let slice;
  try {
    slice = await runWorkerSlice({
      maxTasks,
      maxMs,
      debugEnabled: wantDebug,
      source: "cron",
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "vies cron worker failed",
      message: String(e?.message || e),
      ms: Date.now() - started,
    });
  }

  // (handig voor zichtbaarheid)
  let queue_vies_len = null;
  let queue_pending_len = null;
  try {
    queue_vies_len = await kv.llen("queue:vies");
  } catch (e) {
    queue_vies_len = `ERR:${String(e?.message || e)}`;
  }
  try {
    queue_pending_len = await kv.hlen("queue:pending");
  } catch (e) {
    queue_pending_len = `ERR:${String(e?.message || e)}`;
  }

  return res.status(200).json({
    ok: true,
    ms: Date.now() - started,
    ...slice,
    queue_vies_len,
    queue_pending_len,
  });
}
