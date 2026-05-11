const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

let cachedToken = null;

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

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Spotify credentials not configured");
  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify token request failed: ${res.status}`);
  const j = await res.json();
  cachedToken = {
    token: j.access_token,
    expiresAt: Date.now() + (j.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

async function spotifyApi(path) {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Spotify API ${path}: ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
}

const trackUrl = (id) => `https://open.spotify.com/track/${id}`;

export async function fetchSpotifyPlaylist(id, maxTracks = 100) {
  const data = await spotifyApi(
    `/playlists/${encodeURIComponent(id)}?fields=name,tracks.items(track(id))&market=US`,
  );
  const items = data.tracks?.items || [];
  const trackUrls = items
    .slice(0, maxTracks)
    .map((it) => it.track?.id)
    .filter(Boolean)
    .map(trackUrl);
  return { name: data.name || "Spotify playlist", trackUrls };
}

export async function fetchSpotifyAlbum(id) {
  const data = await spotifyApi(`/albums/${encodeURIComponent(id)}?market=US`);
  const albumArtists = (data.artists || []).map((a) => a.name).filter(Boolean).join(", ");
  const items = data.tracks?.items || [];
  const trackUrls = items.map((t) => t?.id).filter(Boolean).map(trackUrl);
  return {
    name: `${albumArtists ? albumArtists + " — " : ""}${data.name || "Spotify album"}`,
    trackUrls,
  };
}
