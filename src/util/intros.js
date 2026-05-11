// Absolute paths INSIDE the Lavalink container. The host's ./assets/intros
// is bind-mounted to /opt/Lavalink/intros (see docker-compose.yml). Lavalink's
// `local` source resolves these via `local:/absolute/path`.

const INTROS = [
  "local:/opt/Lavalink/intros/1.mp3",
  "local:/opt/Lavalink/intros/2.mp3",
  "local:/opt/Lavalink/intros/3.mp3",
  "local:/opt/Lavalink/intros/4.mp3",
  "local:/opt/Lavalink/intros/5.mp3",
  "local:/opt/Lavalink/intros/6.mp3",
];

export function randomIntroQuery() {
  return INTROS[Math.floor(Math.random() * INTROS.length)];
}
