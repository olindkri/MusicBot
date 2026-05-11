import { randomInt } from "node:crypto";

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

let lastIndex = -1;

export function randomIntroQuery() {
  let idx;
  do {
    idx = randomInt(0, INTROS.length);
  } while (idx === lastIndex && INTROS.length > 1);
  lastIndex = idx;
  const pick = INTROS[idx];
  console.log(`[intros] selected ${pick}`);
  return pick;
}
