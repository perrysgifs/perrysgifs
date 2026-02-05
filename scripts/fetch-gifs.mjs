/**
 * Build-time snapshot of GIFs from https://giphy.com/channel/perrysgifs
 *
 * Why: GitHub Pages is static; fetching giphy.com HTML in-browser is blocked by CORS.
 * So we fetch the channel page during build, extract GIF IDs/URLs, and write data/gifs.json.
 */

import { writeFile } from "node:fs/promises";

const CHANNEL_URL = "https://giphy.com/channel/perrysgifs";

function cleanUrl(raw) {
  return raw
    .trim()
    .replace(/[),.]+$/, "") // trailing tokens in inline CSS/JS
    .replace(/&amp;/g, "&");
}

function uniqueKeepOrder(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!seen.has(it)) {
      seen.add(it);
      out.push(it);
    }
  }
  return out;
}

function parseGifPageUrls(html) {
  const matches = html.match(/https:\/\/giphy\.com\/gifs\/[^\s"'<>]+/g) || [];
  const cleaned = matches.map(cleanUrl);
  // Filter out non-gif detail URLs just in case
  return uniqueKeepOrder(cleaned.filter((u) => u.includes("/gifs/")));
}

function idFromGifPageUrl(pageUrl) {
  // Expected: https://giphy.com/gifs/<slug>-<id>
  try {
    const u = new URL(pageUrl);
    const last = u.pathname.split("/").filter(Boolean).at(-1) || "";
    const dash = last.lastIndexOf("-");
    const id = dash >= 0 ? last.slice(dash + 1) : last;
    return /^[A-Za-z0-9]+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function titleFromGifPageUrl(pageUrl) {
  try {
    const u = new URL(pageUrl);
    const last = u.pathname.split("/").filter(Boolean).at(-1) || "";
    const dash = last.lastIndexOf("-");
    const slug = dash > 0 ? last.slice(0, dash) : last;
    const t = slug.replace(/-/g, " ").replace(/\s+/g, " ").trim();
    return t || "GIF";
  } catch {
    return "GIF";
  }
}

function mediaUrls(id) {
  // Use media.giphy.com canonical host (redirects as needed).
  return {
    previewUrl: `https://media.giphy.com/media/${id}/giphy_s.gif`,
    gifUrl: `https://media.giphy.com/media/${id}/giphy.gif`,
    stillUrl: `https://media.giphy.com/media/${id}/200.gif`,
  };
}

async function main() {
  console.log(`Fetching channel: ${CHANNEL_URL}`);
  const res = await fetch(CHANNEL_URL, {
    headers: {
      "User-Agent": "perrysgifs-build/1.0 (+https://github.com/)",
      Accept: "text/html",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch channel HTML (${res.status})`);
  }
  const html = await res.text();

  const pageUrls = parseGifPageUrls(html);
  const ids = uniqueKeepOrder(pageUrls.map(idFromGifPageUrl).filter(Boolean));

  const gifs = ids.map((id) => {
    // Prefer the first pageUrl that contains this id
    const pageUrl =
      pageUrls.find((u) => u.endsWith(`-${id}`) || u.includes(`-${id}`)) ||
      `https://giphy.com/gifs/${id}`;
    return {
      id,
      pageUrl,
      title: titleFromGifPageUrl(pageUrl),
      ...mediaUrls(id),
    };
  });

  const out = {
    channel: CHANNEL_URL,
    builtAt: new Date().toISOString(),
    count: gifs.length,
    gifs,
  };

  await writeFile(new URL("../data/gifs.json", import.meta.url), JSON.stringify(out, null, 2));
  console.log(`Wrote data/gifs.json with ${gifs.length} GIFs.`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

