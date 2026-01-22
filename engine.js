const { api } = require('./spotify');
const PlayHistory = require('./models/PlayHistory');

let lastTrackId = null;

async function getPlayedSet() {
  // From Spotify (last 50)
  const recentRes = await api('get', '/me/player/recently-played?limit=50');
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
  const playedSet = await getPlayedSet();

  while (true) {
    const queueRes = await api('get', '/me/player/queue');
    const queue = queueRes.data.queue || [];

    if (!queue.length) return;

    const next = queue[0];
    if (!next?.id) return;

    if (playedSet.has(next.id)) {
      console.log('Skipping repeated:', next.name);
      await api('post', '/me/player/next');
      await new Promise((r) => setTimeout(r, 500));
    } else {
      console.log('Next fresh track:', next.name);
      break;
    }
  }
}


async function djLoop() {
  try {
    const res = await api('get', '/me/player/currently-playing');
    if (!res.data?.item) return;

    const track = res.data.item;
    const remaining = track.duration_ms - res.data.progress_ms;

    if (track.id !== lastTrackId) {
      lastTrackId = track.id;
      await PlayHistory.create({ trackId: track.id });
      console.log('Now playing:', track.name);
    }

    if (remaining < 30000) {
      await enforceFreshQueue();
    }
  } catch (e) {
    console.error('DJ loop error:', e.response?.data || e.message);
  }
}

module.exports = { djLoop };
