// Spotify's Web API restricted /v1/playlists/{id}/tracks to apps with
// Spotify-approved "extended quota" status in late 2024. For personal-use bots
// using client_credentials, the API endpoint returns 403 or strips the tracks
// field. As a workaround, scrape the playlist/album's public web page — the
// HTML contains the track URIs in a stable enough format.

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export function parseSpotifyUrl(input) {
  try {
    const u = new URL(input);
    if (u.hostname !== "open.spotify.com") return null;
    const m = u.pathname.match(/^\/(playlist|album|track)\/([A-Za-z0-9]+)/);
    if (!m) return null;
    return { type: m[1], id: m[2] };
  } catch {
    return null;
  }
}

async function fetchPublicPage(url) {
  const r = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!r.ok) throw new Error(`Spotify page ${url}: HTTP ${r.status}`);
  return r.text();
}

function extractOgTitle(html) {
  const m = html.match(/<meta property="og:title" content="([^"]+)"/);
  return m?.[1];
}

function extractTrackUrls(html, max = 100) {
  const seen = new Set();
  for (const m of html.matchAll(/spotify:track:([A-Za-z0-9]+)/g)) {
    seen.add(m[1]);
    if (seen.size >= max) break;
  }
  return [...seen].map((id) => `https://open.spotify.com/track/${id}`);
}

export async function fetchSpotifyPlaylist(id, maxTracks = 100) {
  const html = await fetchPublicPage(`https://open.spotify.com/playlist/${id}`);
  return {
    name: extractOgTitle(html) || "Spotify playlist",
    trackUrls: extractTrackUrls(html, maxTracks),
  };
}

export async function fetchSpotifyAlbum(id, maxTracks = 100) {
  const html = await fetchPublicPage(`https://open.spotify.com/album/${id}`);
  return {
    name: extractOgTitle(html) || "Spotify album",
    trackUrls: extractTrackUrls(html, maxTracks),
  };
}
