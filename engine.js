const { api } = require('./spotify');
const PlayHistory = require('./models/PlayHistory');

let lastTrackId = null;

async function pickFreshTrack(track) {
  // Guard: no artist (podcast / local file)
  if (!track.artists || !track.artists.length) {
    const top = await api('get', '/me/top/tracks?limit=50&time_range=short_term');
    return top.data.items[0].id;
  }

  const mainArtistId = track.artists[0].id;

  // 1. Get related artists (more reliable than genre search)
  const related = await api('get', `/artists/${mainArtistId}/related-artists`);
  const artists = related.data.artists || [];

  if (!artists.length) {
    const top = await api('get', '/me/top/tracks?limit=50&time_range=short_term');
    return top.data.items[0].id;
  }

  // 2. Collect top tracks from related artists
  let candidates = [];

  for (const a of artists.slice(0, 5)) {
    if (!a.id) continue;
    const top = await api('get', `/artists/${a.id}/top-tracks?market=IN`);
    candidates.push(...top.data.tracks);
  }

  // 3. Remove recently played
  const recent = await PlayHistory.find({
    playedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  });

  const blocked = new Set(recent.map((r) => r.trackId));
  const fresh = candidates.filter((t) => t && t.id && !blocked.has(t.id));

  if (!fresh.length) {
    const top = await api('get', '/me/top/tracks?limit=50&time_range=short_term');
    return top.data.items[0].id;
  }

  return fresh[Math.floor(Math.random() * fresh.length)].id;
}





async function djLoop() {
  try {
    const res = await api('get', '/me/player/currently-playing');
    if (!res.data || !res.data.item) return;

    const track = res.data.item;
    const remaining = track.duration_ms - res.data.progress_ms;

    if (track.id !== lastTrackId) {
      lastTrackId = track.id;
      await PlayHistory.create({ trackId: track.id });
      console.log('Now playing:', track.name);
    }

    // if (remaining < 20000) {
      const next = await pickFreshTrack(track);
      if (next) {
        await api('post', `/me/player/queue?uri=spotify:track:${next}`);
        console.log('Queued fresh:', next);
      }
    // }
  } catch (e) {
    console.error('DJ loop error', e.message);
  }
}

module.exports = { djLoop };
