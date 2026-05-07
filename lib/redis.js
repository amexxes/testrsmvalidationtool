import { Redis } from "@upstash/redis";

const url =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL;

const token =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url) {
  throw new Error("Missing Redis URL: set KV_REST_API_URL or UPSTASH_REDIS_REST_URL in Vercel");
}

if (!token) {
  throw new Error("Missing Redis token: set KV_REST_API_TOKEN or UPSTASH_REDIS_REST_TOKEN in Vercel");
}

export const redis = new Redis({
  url,
  token,
});
