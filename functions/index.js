// Cloudflare Pages Function: gives every shared card link its own preview
// (photo + title + description) when pasted in WhatsApp / Telegram / Facebook etc.
// Runs only for the home address "/", so  https://sukoonx.pages.dev/?c=CARD_ID  gets the card's preview.

const PROJECT = "kami-aa541";

const esc = s => String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  const id = url.searchParams.get("c");
  const page = await ctx.next();                       // the normal index.html
  if (!id || !/^[A-Za-z0-9_-]{5,60}$/.test(id)) return page;

  try {
    const r = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/cards/${id}`,
      { cf: { cacheTtl: 300, cacheEverything: true } }
    );
    if (!r.ok) return page;                            // card not found / not readable -> normal page
    const f = (await r.json()).fields || {};
    const g = k => (f[k] && f[k].stringValue) || "";

    const title = clip(g("title"), 90);
    if (!title) return page;
    const desc = clip(g("description"), 200) || "SukoonX";

    let img = g("imageUrl");
    img = /^https:\/\//i.test(img) ? img : "";         // data: images cannot be previewed
    if (img.includes("res.cloudinary.com") && img.includes("/upload/") && !img.includes("/upload/w_")) {
      img = img.replace("/upload/", "/upload/w_1200,h_630,c_fill,q_auto,f_jpg/");   // light 1200x630 preview
    }

    const link = `${url.origin}/?c=${id}`;
    const tags =
      `<meta name="description" content="${esc(desc)}">` +
      `<meta property="og:site_name" content="SukoonX">` +
      `<meta property="og:type" content="article">` +
      `<meta property="og:title" content="${esc(title)}">` +
      `<meta property="og:description" content="${esc(desc)}">` +
      `<meta property="og:url" content="${esc(link)}">` +
      (img ? `<meta property="og:image" content="${esc(img)}">` : "") +
      `<meta name="twitter:card" content="${img ? "summary_large_image" : "summary"}">` +
      `<meta name="twitter:title" content="${esc(title)}">` +
      `<meta name="twitter:description" content="${esc(desc)}">` +
      (img ? `<meta name="twitter:image" content="${esc(img)}">` : "");

    return new HTMLRewriter()
      .on('meta[property^="og:"],meta[name^="twitter:"],meta[name="description"]', { element(e) { e.remove(); } })
      .on("title", { element(e) { e.setInnerContent(title + " — SukoonX"); } })
      .on("head", { element(e) { e.append(tags, { html: true }); } })
      .transform(page);
  } catch (e) {
    return page;                                       // any problem -> normal page, nothing breaks
  }
}
