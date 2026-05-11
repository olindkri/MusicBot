// Spotify's Web API restricted /v1/playlists/{id}/tracks to apps with
// Spotify-approved "extended quota" status in late 2024. Personal-use bots
// using client_credentials get 403 / empty responses. As a workaround, scrape
// the public web page — but Spotify also gates SSR by User-Agent:
//   - Real browsers (Chrome/Firefox) → SPA shell (~6 KB, no track data, JS-rendered)
//   - Social-bot UAs (Slackbot, Facebookbot) → OG metadata only (~28 KB)
//   - Generic UAs (curl/wget) → full SSR (~110 KB) with all track rows inline
// We send curl's UA to force the SSR variant.
//
// Tracks that belong to the playlist/album show up in the markup as:
//   aria-labelledby="listrow-title-track-spotify:track:<id>(-<index>)?"
// This excludes "recommended" tracks at the bottom of playlist pages, which
// are rendered with different markup.

const SCRAPE_UA = "curl/8.4.0";

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
  const r = await fetch(url, { headers: { "User-Agent": SCRAPE_UA } });
  if (!r.ok) throw new Error(`Spotify page ${url}: HTTP ${r.status}`);
  return r.text();
}

function extractOgTitle(html) {
  return html.match(/<meta property="og:title" content="([^"]+)"/)?.[1];
}

function extractTrackUrls(html, max = 100) {
  const seen = new Set();
  const re = /aria-labelledby="listrow-title-track-spotify:track:([A-Za-z0-9]+)/g;
  for (const m of html.matchAll(re)) {
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
