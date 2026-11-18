// Agent storage on Upstash Redis (REST). Built to stay far inside the free tier:
// one active-set read per minute, one write per job change, ledger writes only on new trades.
//
// Keys
//   job:<agent>:<id>      job JSON
//   agents:active         set of "<agent>:<id>" still running
//   user:<did>            set of "<agent>:<id>" owned by a user
//   lock:<name>           short-lived tick lock
const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.STORAGE_REST_API_URL || process.env.STORAGE_KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.STORAGE_REST_API_TOKEN || process.env.STORAGE_KV_REST_API_TOKEN;

export const storeReady = () => Boolean(URL && TOKEN);

async function call(path, body) {
  if (!storeReady()) throw new Error("Storage is being upgraded. Please try again shortly.");
  const r = await fetch(`${URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) throw new Error(`Storage error ${r.status}`);
  return j;
}

export async function redis(...cmd) {
  const j = await call("", cmd);
  if (j.error) throw new Error(j.error);
  return j.result;
}

export async function pipeline(cmds) {
  if (!cmds.length) return [];
  const j = await call("/pipeline", cmds);
  return j.map((x) => (x.error ? null : x.result));
}

const jobKey = (agent, id) => `job:${agent}:${id}`;
const parse = (s) => {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};

export async function getAgentJob(agent, id) {
  return parse(await redis("GET", jobKey(agent, id)));
}

export async function saveAgentJob(agent, job, active) {
  job.updatedAt = new Date().toISOString();
  const ref = `${agent}:${job.id}`;
  const cmds = [["SET", jobKey(agent, job.id), JSON.stringify(job)], active ? ["SADD", "agents:active", ref] : ["SREM", "agents:active", ref]];
  if (job.userId && !job.indexed) {
    job.indexed = true;
    cmds[0][2] = JSON.stringify(job);
    cmds.push(["SADD", `user:${job.userId}`, ref]);
  }
  await pipeline(cmds);
  return job;
}

export async function deleteAgentJob(agent, job) {
  const ref = `${agent}:${job.id}`;
  await pipeline([["DEL", jobKey(agent, job.id)], ["SREM", "agents:active", ref], ["SREM", `user:${job.userId}`, ref]]);
}

async function loadRefs(refs) {
  if (!refs?.length) return [];
  const keys = refs.map((r) => {
    const i = r.indexOf(":");
    return jobKey(r.slice(0, i), r.slice(i + 1));
  });
  const vals = await redis("MGET", ...keys);
  return refs
    .map((r, i) => {
      const j = parse(vals[i]);
      return j ? { agent: r.slice(0, r.indexOf(":")), ...j } : null;
    })
    .filter(Boolean);
}

// All jobs of one user (2 commands).
export async function listUserJobs(userId) {
  const refs = await redis("SMEMBERS", `user:${userId}`);
  const jobs = await loadRefs(refs);
  return jobs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// Every running job, grouped by agent (2 commands, 1 when nothing runs).
export async function loadActive() {
  const refs = await redis("SMEMBERS", "agents:active");
  const jobs = await loadRefs(refs);
  const out = { sentry: [], tempo: [], perch: [] };
  for (const j of jobs) (out[j.agent] ||= []).push(j);
  return out;
}

export async function activeCount() {
  return Number(await redis("SCARD", "agents:active")) || 0;
}

// true if we got the lock (expires on its own)
export async function acquireLock(name, seconds = 50) {
  return (await redis("SET", `lock:${name}`, String(Date.now()), "NX", "EX", seconds)) === "OK";
}

// Save a job after a tick step only when something meaningful changed. Price readings
// (value, move %, check time) alone are written at most every 10 minutes.
const VOLATILE = ["valueWei", "checkedAt", "movePct", "updatedAt", "savedAt"];
const strip = (s) => {
  const o = JSON.parse(s);
  for (const k of VOLATILE) delete o[k];
  return JSON.stringify(o);
};
export async function persistAfterStep(agent, job, before, active) {
  const now = JSON.stringify(job);
  if (now === before) return false;
  const meaningful = strip(now) !== strip(before);
  const stale = !job.savedAt || Date.now() - job.savedAt > 10 * 60_000;
  if (!meaningful && !stale) return false;
  job.savedAt = Date.now();
  await saveAgentJob(agent, job, active);
  return true;
}
