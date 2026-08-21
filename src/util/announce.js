import { EmbedBuilder, ChannelType, PermissionFlagsBits } from "discord.js";
import { COLORS } from "./embeds.js";
import { getGuildState } from "../state.js";

// DJSmön stays in character for these. Each announcement ships with a
// Simplified Chinese translation so the whole server reads the same thing.
const ANNOUNCEMENTS = {
  shutdown: {
    color: COLORS.warn,
    en: {
      title: "DJSmön is packing up the decks",
      body: "Someone pulled my plug. The booth goes dark for a moment — hold your requests, I'll be back before the next drop.",
    },
    zh: {
      title: "DJSmön 正在收摊",
      body: "有人拔了我的电源。打碟台要暂时熄灯——点歌先存着，下一个鼓点之前我就回来。",
    },
  },
  audioDown: {
    color: COLORS.error,
    en: {
      title: "DJSmön lost the sound system",
      body: "The decks are still spinning, but nothing is coming out of the speakers. I'm yelling at the audio rack — give me a minute.",
    },
    zh: {
      title: "DJSmön 的音响掉线了",
      body: "唱盘还在转，音箱却一点声音都没有。我正在对着功放机发火——给我一分钟。",
    },
  },
  back: {
    color: COLORS.success,
    en: {
      title: "DJSmön is back on the decks",
      body: "Speakers are warm again and the queue is empty. Somebody put a record on.",
    },
    zh: {
      title: "DJSmön 回到打碟台了",
      body: "音箱重新热起来了，播放列表还空着。谁来点首歌。",
    },
  },
};

function buildEmbed(key) {
  const a = ANNOUNCEMENTS[key];
  return new EmbedBuilder()
    .setColor(a.color)
    .setTitle(a.en.title)
    .setDescription(a.en.body)
    .addFields({ name: a.zh.title, value: a.zh.body });
}

function canSendIn(channel, me) {
  if (channel?.type !== ChannelType.GuildText) return false;
  const perms = channel.permissionsFor(me);
  return Boolean(
    perms?.has(PermissionFlagsBits.ViewChannel) &&
    perms.has(PermissionFlagsBits.SendMessages) &&
    perms.has(PermissionFlagsBits.EmbedLinks)
  );
}

// Prefer an explicitly configured channel, then wherever the bot was last
// active, then the first text channel it is actually allowed to post in.
function resolveChannel(guild) {
  const me = guild.members.me;
  if (!me) return null;

  const configured = process.env.ANNOUNCE_CHANNEL_ID;
  if (configured) {
    const channel = guild.channels.cache.get(configured);
    if (canSendIn(channel, me)) return channel;
  }

  const lastUsed = getGuildState(guild.id).nowPlayingChannelId;
  if (lastUsed) {
    const channel = guild.channels.cache.get(lastUsed);
    if (canSendIn(channel, me)) return channel;
  }

  return guild.channels.cache
    .filter((c) => canSendIn(c, me))
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .first() ?? null;
}

export async function announce(client, key) {
  if (!ANNOUNCEMENTS[key]) throw new Error(`Unknown announcement: ${key}`);
  const embed = buildEmbed(key);

  const sends = client.guilds.cache.map(async (guild) => {
    const channel = resolveChannel(guild);
    if (!channel) {
      console.warn(`[announce] no postable channel in guild ${guild.id}`);
      return;
    }
    try {
      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(`[announce] failed in guild ${guild.id}:`, err.message);
    }
  });

  await Promise.allSettled(sends);
}
