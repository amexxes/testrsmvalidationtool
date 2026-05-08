// api/fr-job/[id].js
import { kv } from "@vercel/kv";

const VIES_BASE = "https://ec.europa.eu/taxation_customs/vies/rest-api";
const VIES_TIMEOUT_MS = Number(process.env.VIES_TIMEOUT_MS || 8000);
const JOB_TTL_SEC = 6 * 60 * 60;

// Retries
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 8);
const FIXED_RETRY_DELAY_MS = Number(process.env.RETRY_DELAY_MS || 0);
const WORKER_LOCK_SEC = Number(process.env.WORKER_LOCK_SEC || 45);

// Poll worker limits
const POLL_MAX_TASKS = Number(process.env.POLL_MAX_TASKS || 12);
const POLL_MAX_MS = Number(process.env.POLL_MAX_MS || 12000);
const WORKER_PARALLELISM = Number(process.env.WORKER_PARALLELISM || 4);

// Pending scan + lease
const PENDING_SCAN_LIMIT = Number(process.env.PENDING_SCAN_LIMIT || 1000);
const PENDING_LEASE_MS = Number(
  process.env.PENDING_LEASE_MS || Math.max(45_000, VIES_TIMEOUT_MS + 30_000)
);

const RETRYABLE_CODES = new Set([
  "SERVICE_UNAVAILABLE",
  "MS_UNAVAILABLE",
  "TIMEOUT",
  "GLOBAL_MAX_CONCURRENT_REQ",
  "GLOBAL_MAX_CONCURRENT_REQ_TIME",
  "MS_MAX_CONCURRENT_REQ",
  "MS_MAX_CONCURRENT_REQ_TIME",
  "NETWORK_ERROR",
  "HTTP_429",
  "HTTP_502",
  "HTTP_503",
  "HTTP_504",
]);

function isRetryable(code, httpStatus) {
  const c = String(code || "").trim();
  const s = Number(httpStatus || 0);
  if (RETRYABLE_CODES.has(c)) return true;
  if ([429, 502, 503, 504].includes(s)) return true;
  if (s === 0) return true; // network/abort
  return false;
}

function normalizeVatLine(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function parseVatKey(key) {
  const s = String(key || "");
  const parts = s.split(":");
  if (parts.length === 2) return { cc: parts[0], vat: parts[1] || "" };
  const cc = s.slice(0, 2);
  const vat = s.slice(2);
  return { cc, vat };
}

function maskKey(key) {
  const { cc, vat } = parseVatKey(key);
  const tail = String(vat || "").slice(-4);
  return `${cc}:…${tail}`;
}

function logIf(debugEnabled, ...args) {
  if (debugEnabled || process.env.WORKER_LOG === "1") console.log(...args);
}

function safeJsonParse(x) {
  if (!x) return null;
  if (typeof x === "object") return x;
  if (typeof x !== "string") return null;
  try {
    return JSON.parse(x);
  } catch {
    return null;
  }
}

function isFinalState(state) {
  const s = String(state || "").toLowerCase();
  return s === "valid" || s === "invalid" || s === "error";
}

function pendingField(task) {
  // canonical: avoids collisions across jobs
  return `${task.jobId}|${task.key}`;
}

async function hdelFields(hashKey, fields) {
  for (const f of fields) {
    if (!f) continue;
    try {
      await kv.hdel(hashKey, f);
    } catch {
      // ignore
    }
  }
}

async function fetchJson(url, init, timeoutMs = VIES_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { Accept: "application/json", ...(init?.headers || {}) },
    });

    const text = await resp.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    return { ok: resp.ok, status: resp.status, data };
  } catch (e) {
    const isAbort = String(e?.name || "").toLowerCase() === "aborterror";
    return {
      ok: false,
      status: 0,
      data: { error: isAbort ? "TIMEOUT" : "NETWORK_ERROR", message: String(e?.message || e) },
    };
  } finally {
    clearTimeout(t);
  }
}

function isCommonResponse(data) {
  return data && typeof data === "object" && "actionSucceed" in data && "errorWrappers" in data;
}
function extractErrorCode(data) {
  const wrappers = data?.errorWrappers;
  if (Array.isArray(wrappers) && wrappers.length) return wrappers[0]?.error || null;
  if (typeof data?.error === "string") return data.error;
  return null;
}
function extractErrorMessage(data) {
  const wrappers = data?.errorWrappers;
  if (Array.isArray(wrappers) && wrappers.length) return wrappers[0]?.message || "";
  if (typeof data?.message === "string") return data.message;
  return "";
}

async function viesCheck(p, requester) {
  const body = { countryCode: p.countryCode, vatNumber: p.vatNumber };

  if (requester?.ms && requester?.vat) {
    body.requesterMemberStateCode = requester.ms;
    body.requesterNumber = normalizeVatLine(requester.vat).replace(/^[A-Z]{2}/, "");
  }

  const r = await fetchJson(`${VIES_BASE}/check-vat-number`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (isCommonResponse(r.data) && r.data.actionSucceed === false) {
    return {
      ok: false,
      status: r.status,
      errorCode: extractErrorCode(r.data),
      message: extractErrorMessage(r.data),
      data: r.data,
    };
  }

  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      errorCode: extractErrorCode(r.data) || `HTTP_${r.status || 0}`,
      message: extractErrorMessage(r.data),
      data: r.data,
    };
  }

  return { ok: true, status: r.status, data: r.data };
}

function nextDelayMs(attempt) {
  if (FIXED_RETRY_DELAY_MS > 0) return FIXED_RETRY_DELAY_MS;

  const schedule = [
    3_000,
    7_000,
    15_000,
    30_000,
    60_000,
    120_000,
    180_000,
    240_000,
  ];

  const index = Math.max(0, Math.min(schedule.length - 1, Number(attempt || 1) - 1));
  const jitter = Math.floor(Math.random() * 1200);

  return schedule[index] + jitter;
}

async function readAllResults(resKey) {
  const obj = await kv.hgetall(resKey);
  const out = [];
  if (!obj) return out;

  for (const v of Object.values(obj)) {
    if (typeof v === "string") {
      const j = safeJsonParse(v);
      if (j) out.push(j);
    } else if (v && typeof v === "object") {
      out.push(v);
    }
  }
  return out;
}

async function acquireWorkerLock() {
  const ok = await kv.set("lock:vies-worker", "1", { nx: true, ex: WORKER_LOCK_SEC });
  return !!ok;
}

async function releaseWorkerLock() {
  try {
    await kv.del("lock:vies-worker");
  } catch {
    // ignore
  }
}

async function getMeta(metaKey) {
  const meta = await kv.get(metaKey);
  if (!meta) return null;
  if (typeof meta === "string") return safeJsonParse(meta);
  return meta;
}

async function setMeta(metaKey, meta) {
  meta.updated_at = Date.now();
  await kv.set(metaKey, meta, { ex: JOB_TTL_SEC });
}

async function ensureKeyTTL(resKey) {
  try {
    await kv.expire(resKey, JOB_TTL_SEC);
  } catch {
    // ignore
  }
}

function buildBaseRow(cur, task) {
  const { cc, vat } = parseVatKey(task?.key);
  const country_code = (cur && cur.country_code) || (task?.p?.countryCode || cc || "").toUpperCase();
  const vat_part = (cur && cur.vat_part) || (task?.p?.vatNumber || vat || "");
  const vat_number = (cur && cur.vat_number) || `${country_code}${vat_part}`;

  return {
    ...(cur || {}),
    country_code,
    vat_part,
    vat_number,
    input: (cur && cur.input) || vat_number,
  };
}

/**
 * Lease a due pending task instead of deleting it.
 * If the function crashes mid-run, the lease expires and the task becomes claimable again.
 */
async function claimDuePendingTasks(limit, nowMs, workerId, debugEnabled, debugObj) {
  const pending = await kv.hgetall("queue:pending");

  if (!pending || typeof pending !== "object") return [];

  const entries = Object.entries(pending);
  if (!entries.length) return [];

  if (debugObj) debugObj.pending_scanned = entries.length;

  const cleanupFields = [];
  const due = [];

  for (const [field, raw] of entries) {
    const task = safeJsonParse(raw);

    if (!task?.jobId || !task?.key || !task?.p) {
      cleanupFields.push(field);
      continue;
    }

    const dueAt = Number(task.nextRunAt || 0);
    const leaseUntil = Number(task.leaseUntil || 0);

    if (leaseUntil && leaseUntil > nowMs) continue;
    if (dueAt && dueAt > nowMs) continue;

    due.push({
      field,
      task,
      dueAt: dueAt || 0,
    });
  }

  if (cleanupFields.length) {
    await hdelFields("queue:pending", cleanupFields);
  }

  due.sort((a, b) => a.dueAt - b.dueAt);

  const selected = due.slice(0, Math.max(1, limit));
  if (!selected.length) return [];

  const leaseMap = {};
  const leasedTasks = [];

  for (const item of selected) {
    const leased = {
      ...item.task,
      leaseOwner: workerId,
      leaseAt: nowMs,
      leaseUntil: nowMs + PENDING_LEASE_MS,
      _pendingField: item.field,
    };

    leaseMap[item.field] = JSON.stringify(leased);
    leasedTasks.push(leased);
  }

  await kv.hset("queue:pending", leaseMap);
  await kv.expire("queue:pending", JOB_TTL_SEC);

  logIf(debugEnabled, `[worker] lease pending batch`, {
    count: leasedTasks.length,
  });

  return leasedTasks;
}
async function syncJobMeta(jobId) {
  if (!jobId) return;

  const metaKey = `job:${jobId}:meta`;
  const resKey = `job:${jobId}:results`;

  const meta = await getMeta(metaKey);
  if (!meta) return;

  const results = await readAllResults(resKey);
  const done = results.filter((row) => isFinalState(row?.state)).length;

  meta.done = done;
  meta.status = done >= Number(meta.total || 0) ? "completed" : "running";

  await setMeta(metaKey, meta);
}
function makeWorkerId(source) {
  return `${source}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}
async function processWorkerTask(task, requester, workerId, debugEnabled, source) {
  if (!task?.jobId || !task?.key || !task?.p) {
    return { processed: false, jobId: "" };
  }

  const now = Date.now();
  const metaKey = `job:${task.jobId}:meta`;
  const resKey = `job:${task.jobId}:results`;
  const meta = await getMeta(metaKey);

  if (!meta) {
    await hdelFields("queue:pending", [task._pendingField, pendingField(task)].filter(Boolean));
    return { processed: true, jobId: task.jobId };
  }

  let cur = null;

  try {
    const curRaw = await kv.hget(resKey, task.key);
    cur = curRaw ? safeJsonParse(curRaw) : null;
  } catch {
    cur = null;
  }

  if (cur && isFinalState(cur.state)) {
    await hdelFields("queue:pending", [
      task._pendingField,
      pendingField(task),
      task.key,
    ]);

    return { processed: true, jobId: task.jobId };
  }

  const prevAttempt = Math.max(Number(task.attempt || 0), Number(cur?.attempt || 0));
  const currentAttempt = Math.max(1, prevAttempt + 1);

  const processingRow = {
    ...buildBaseRow(cur, task),
    state: "processing",
    attempt: currentAttempt,
    next_retry_at: null,
    checked_at: now,
    error_code: cur?.error_code || "",
    error: cur?.error || "",
    details: cur?.details || "",
  };

  await kv.hset(resKey, { [task.key]: JSON.stringify(processingRow) });
  await ensureKeyTTL(resKey);

  logIf(debugEnabled, `[worker:${source}] run`, {
    workerId,
    jobId: task.jobId,
    key: maskKey(task.key),
    attempt: currentAttempt,
  });

  const r = await viesCheck(task.p, requester);

  if (r.ok) {
    const d = r.data || {};
    const valid = !!d.valid;

    const row = {
      ...buildBaseRow(cur, task),
      state: valid ? "valid" : "invalid",
      valid,
      name: d?.name && d.name !== "---" ? d.name : "",
      address: d?.address && d.address !== "---" ? d.address : "",
      error_code: "",
      error: "",
      details: d?.requestIdentifier ? `requestIdentifier=${d.requestIdentifier}` : "",
      next_retry_at: null,
      attempt: currentAttempt,
      checked_at: Date.now(),
      done_counted: true,
    };

    await kv.hset(resKey, { [task.key]: JSON.stringify(row) });
    await ensureKeyTTL(resKey);

    await hdelFields("queue:pending", [
      task._pendingField,
      pendingField(task),
      task.key,
    ]);

    return { processed: true, jobId: task.jobId };
  }

  const code = String(r.errorCode || `HTTP_${r.status || 0}`).trim();
  const details = String(r.message || JSON.stringify(r.data || {})).slice(0, 1000);

  if (isRetryable(code, r.status)) {
    if (currentAttempt >= MAX_RETRIES) {
      const row = {
        ...buildBaseRow(cur, task),
        state: "error",
        valid: null,
        name: "",
        address: "",
        error_code: "RETRY_EXHAUSTED",
        error: "RETRY_EXHAUSTED",
        details,
        next_retry_at: null,
        attempt: currentAttempt,
        checked_at: Date.now(),
        done_counted: true,
      };

      await kv.hset(resKey, { [task.key]: JSON.stringify(row) });
      await ensureKeyTTL(resKey);

      await hdelFields("queue:pending", [
        task._pendingField,
        pendingField(task),
        task.key,
      ]);

      return { processed: true, jobId: task.jobId };
    }

    const nextRetryAt = Date.now() + nextDelayMs(currentAttempt);

    const row = {
      ...buildBaseRow(cur, task),
      state: "retry",
      valid: null,
      name: "",
      address: "",
      error_code: code,
      error: code,
      details,
      attempt: currentAttempt,
      next_retry_at: nextRetryAt,
      checked_at: Date.now(),
    };

    await kv.hset(resKey, { [task.key]: JSON.stringify(row) });
    await ensureKeyTTL(resKey);

    const canonical = pendingField(task);

    const retryTask = {
      jobId: task.jobId,
      key: task.key,
      p: task.p,
      case_ref: task.case_ref,
      attempt: currentAttempt,
      nextRunAt: nextRetryAt,
      leaseOwner: "",
      leaseAt: 0,
      leaseUntil: 0,
    };

    await kv.hset("queue:pending", {
      [canonical]: JSON.stringify(retryTask),
    });

    await kv.expire("queue:pending", JOB_TTL_SEC);

    await hdelFields(
      "queue:pending",
      [task._pendingField, task.key].filter((field) => field && field !== canonical)
    );

    return { processed: true, jobId: task.jobId };
  }

  const row = {
    ...buildBaseRow(cur, task),
    state: "error",
    valid: null,
    name: "",
    address: "",
    error_code: code,
    error: code,
    details,
    next_retry_at: null,
    attempt: currentAttempt,
    checked_at: Date.now(),
    done_counted: true,
  };

  await kv.hset(resKey, { [task.key]: JSON.stringify(row) });
  await ensureKeyTTL(resKey);

  await hdelFields("queue:pending", [
    task._pendingField,
    pendingField(task),
    task.key,
  ]);

  return { processed: true, jobId: task.jobId };
}
// Exported so Cron endpoint can reuse it.
export async function runWorkerSlice({
  maxTasks = POLL_MAX_TASKS,
  maxMs = POLL_MAX_MS,
  debugEnabled = false,
  source = "poll",
} = {}) {
  const locked = await acquireWorkerLock();

  if (!locked) {
    logIf(debugEnabled, `[worker:${source}] lock busy -> skip`);
    return { processed: 0, locked: false, pending_scanned: 0 };
  }

  const workerId = makeWorkerId(source);
  const start = Date.now();
  let processed = 0;
  let pending_scanned = 0;

  const requester = {
    ms: (process.env.REQUESTER_MS || "").toUpperCase(),
    vat: process.env.REQUESTER_VAT || "",
  };

  const debugObj = debugEnabled ? { pending_scanned: 0, workerId } : null;
  const touchedJobs = new Set();

  try {
    while (processed < maxTasks && Date.now() - start < maxMs) {
      const remaining = maxTasks - processed;
      const batchSize = Math.min(WORKER_PARALLELISM, remaining);

      let tasks = await claimDuePendingTasks(
        batchSize,
        Date.now(),
        workerId,
        debugEnabled,
        debugObj
      );

      if (!tasks.length) {
        const raw = await kv.rpop("queue:vies");
        const legacyTask = raw ? safeJsonParse(raw) : null;

        if (legacyTask?.jobId && legacyTask?.key && legacyTask?.p) {
          const canonical = pendingField(legacyTask);
          const nowMs = Date.now();

          const leased = {
            ...legacyTask,
            leaseOwner: workerId,
            leaseAt: nowMs,
            leaseUntil: nowMs + PENDING_LEASE_MS,
            _pendingField: canonical,
          };

          await kv.hset("queue:pending", {
            [canonical]: JSON.stringify(leased),
          });

          await kv.expire("queue:pending", JOB_TTL_SEC);
          tasks = [leased];
        }
      }

      if (!tasks.length) break;

      pending_scanned = debugObj?.pending_scanned ?? pending_scanned;

      const results = await Promise.all(
        tasks.map((task) =>
          processWorkerTask(task, requester, workerId, debugEnabled, source)
        )
      );

      for (const result of results) {
        if (result?.processed) processed += 1;
        if (result?.jobId) touchedJobs.add(result.jobId);
      }
    }

    for (const jobId of touchedJobs) {
      await syncJobMeta(jobId);
    }

    return {
      processed,
      locked: true,
      pending_scanned,
      ...(debugObj ? { debug: debugObj } : {}),
    };
  } finally {
    await releaseWorkerLock();
  }
}

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing id" });

  const wantDebug = String(req.query.debug || "") === "1";

  const debug = {
    processed: 0,
    locked: null,
    queue_vies_len: null,
    queue_pending_len: null,
    pending_scanned: null,
    workerId: null,
    error: null,
  };

  try {
const slice = await runWorkerSlice({
  maxTasks: POLL_MAX_TASKS,
  maxMs: POLL_MAX_MS,
  debugEnabled: wantDebug,
  source: "poll",
});
    debug.processed = slice.processed;
    debug.locked = slice.locked;
    debug.pending_scanned = slice?.debug?.pending_scanned ?? null;
    debug.workerId = slice?.debug?.workerId ?? null;

    try {
      debug.queue_vies_len = await kv.llen("queue:vies");
    } catch (e) {
      debug.queue_vies_len = `ERR:${String(e?.message || e)}`;
    }

    try {
      debug.queue_pending_len = await kv.hlen("queue:pending");
    } catch (e) {
      debug.queue_pending_len = `ERR:${String(e?.message || e)}`;
    }

    const metaKey = `job:${id}:meta`;
    const resKey = `job:${id}:results`;

    const job = await getMeta(metaKey);
    if (!job) return res.status(404).json({ error: "Not found", ...(wantDebug ? { debug } : {}) });

    if (job.status === "queued" && Number(job.total || 0) > 0) {
      job.status = "running";
      await setMeta(metaKey, job);
    }

    const results = await readAllResults(resKey);
    return res.status(200).json(wantDebug ? { job, results, debug } : { job, results });
  } catch (e) {
    debug.error = String(e?.message || e);
    return res.status(500).json({ error: "fr-job failed", debug });
  }
}
