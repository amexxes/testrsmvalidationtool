import { Redis } from "@upstash/redis";

const url =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL;

const token =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  throw new Error(
    "Redis env vars missing. Set KV_REST_API_URL and KV_REST_API_TOKEN in Vercel Production."
  );
}

export const redis = new Redis({
  url,
  token,
});
