const { api } = require("./spotify");
const PlayHistory = require("./models/PlayHistory");

let lastTrackId = null;
let ENGINE_ENABLED = true;
let skipInProgress = false;

function enableEngine() {
  ENGINE_ENABLED = true;
  console.log("DJ Engine ENABLED");
}

function disableEngine() {
  ENGINE_ENABLED = false;
  console.log("DJ Engine DISABLED");
}

async function getPlayedSet() {
  // From Spotify (last 50)
  const recentRes = await api("get", "/me/player/recently-played?limit=50");
  const spotifyPlayed = recentRes.data.items.map((i) => i.track.id);

  // From your DB (longer history)
  const dbRecent = await PlayHistory.find({
    playedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  });
  const dbPlayed = dbRecent.map((r) => r.trackId);

  // Merge
  return new Set([...spotifyPlayed, ...dbPlayed]);
}

async function enforceFreshQueue() {
  if (skipInProgress) return;
  skipInProgress = true;

  try {
    const playedSet = await getPlayedSet();
    let tries = 0;

    while (tries < 10) {
      const queueRes = await api("get", "/me/player/queue");
      const queue = queueRes.data.queue || [];
      if (!queue.length) break;

      const next = queue[0];
      if (!next?.id) break;

      if (playedSet.has(next.id)) {
        console.log("Skipping repeated:", next.name);
        await api("post", "/me/player/next");
        await new Promise((r) => setTimeout(r, 1200)); // give Spotify time
        tries++;
      } else {
        console.log("Next fresh track:", next.name);
        break;
      }
    }
  } finally {
    skipInProgress = false;
  }
}

async function djLoop() {
  if (!ENGINE_ENABLED) return; // hard stop
  try {
    const res = await api("get", "/me/player/currently-playing");
    if (!res.data?.item) {
      console.log("Nothing Playing..");
      return;
    } else {
      const track = res.data.item;
      const remaining = track.duration_ms - res.data.progress_ms;

      if (track.id !== lastTrackId) {
        lastTrackId = track.id;
        await PlayHistory.create({ trackId: track.id });

        // delay slightly so queue state is correct
        setTimeout(() => enforceFreshQueue(), 1500);

        console.log("Now playing:", track.name);
      }

      if (remaining < 30000 && !skipInProgress) {
        await enforceFreshQueue();
      }
    }
  } catch (e) {
    console.error("DJ loop error:", e.response?.data || e.message);
  }
}

module.exports = { djLoop, disableEngine, enableEngine };
