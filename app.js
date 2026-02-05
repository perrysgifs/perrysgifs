/* Perry’s GIF Gallery — lightweight client-side UI */

const $ = (sel, root = document) => root.querySelector(sel);

const state = {
  gifs: [],
  filtered: [],
  layout: "masonry",
  search: "",
  theme: "dark",
};

function normalize(str) {
  return (str || "").toLowerCase().trim();
}

function titleFromPageUrl(pageUrl) {
  try {
    const u = new URL(pageUrl);
    // /gifs/<slug>-<id>
    const parts = u.pathname.split("/").filter(Boolean);
    const gifsIdx = parts.indexOf("gifs");
    const slugAndId = gifsIdx >= 0 ? parts[gifsIdx + 1] : parts.at(-1);
    if (!slugAndId) return "GIF";
    const dash = slugAndId.lastIndexOf("-");
    const slug = dash > 0 ? slugAndId.slice(0, dash) : slugAndId;
    const t = slug.replace(/-/g, " ").replace(/\s+/g, " ").trim();
    return t ? t : "GIF";
  } catch {
    return "GIF";
  }
}

function formatRelativeTime(iso) {
  try {
    const d = new Date(iso);
    const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
    if (s < 60) return "just now";
    const m = s / 60;
    if (m < 60) return `${Math.floor(m)}m ago`;
    const h = m / 60;
    if (h < 24) return `${Math.floor(h)}h ago`;
    const days = h / 24;
    return `${Math.floor(days)}d ago`;
  } catch {
    return "";
  }
}

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
  localStorage.setItem("perry.theme", state.theme);
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.hidden = true;
  }, 2200);
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function applyFilter() {
  const q = normalize(state.search);
  if (!q) state.filtered = [...state.gifs];
  else {
    state.filtered = state.gifs.filter((g) => {
      const hay = normalize(`${g.title} ${g.id} ${g.pageUrl}`);
      return hay.includes(q);
    });
  }
  renderGallery();
  updateMeta();
}

function updateMeta() {
  $("#metaText").textContent = `${state.filtered.length} shown · ${state.gifs.length} total`;
}

function setLayout(layout) {
  state.layout = layout;
  const gallery = $("#gallery");
  gallery.classList.toggle("gallery--masonry", layout === "masonry");
  gallery.classList.toggle("gallery--grid", layout === "grid");
  localStorage.setItem("perry.layout", state.layout);
}

function renderGallery() {
  const gallery = $("#gallery");
  gallery.innerHTML = "";

  const frag = document.createDocumentFragment();
  for (const gif of state.filtered) {
    const card = document.createElement("article");
    card.className = "card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Open ${gif.title}`);
    card.dataset.id = gif.id;

    const img = document.createElement("img");
    img.className = "card__media";
    img.loading = "lazy";
    img.alt = gif.title;
    img.src = gif.previewUrl;
    img.addEventListener("error", () => {
      // Fallbacks: try 200.gif, then giphy.gif
      const fallbacks = [gif.stillUrl, gif.gifUrl];
      const next = fallbacks.find((u) => u && u !== img.src);
      if (next) img.src = next;
    });

    const body = document.createElement("div");
    body.className = "card__body";
    const title = document.createElement("div");
    title.className = "card__title";
    title.textContent = gif.title;
    const badge = document.createElement("div");
    badge.className = "badge mono";
    badge.textContent = gif.id.slice(0, 6);

    body.append(title, badge);
    card.append(img, body);

    const open = () => openModal(gif);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });

    frag.append(card);
  }
  gallery.append(frag);
}

function openModal(gif) {
  const modal = $("#modal");
  const img = $("#modalImg");
  const title = $("#modalTitle");
  const url = $("#modalUrl");
  const open = $("#openOnGiphy");

  title.textContent = gif.title;
  url.textContent = gif.pageUrl;
  open.href = gif.pageUrl;
  img.alt = gif.title;
  img.src = gif.gifUrl;

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  const modal = $("#modal");
  if (modal.hidden) return;
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  $("#modalImg").src = "";
  document.body.style.overflow = "";
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadGifs() {
  const errorEl = $("#error");
  errorEl.hidden = true;

  try {
    const res = await fetch("./data/gifs.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load gifs.json (${res.status})`);
    const data = await res.json();
    const items = Array.isArray(data?.gifs) ? data.gifs : [];
    state.gifs = items.map((g) => ({
      id: String(g.id),
      pageUrl: String(g.pageUrl),
      title: g.title ? String(g.title) : titleFromPageUrl(String(g.pageUrl)),
      gifUrl: String(g.gifUrl),
      previewUrl: String(g.previewUrl),
      stillUrl: String(g.stillUrl || ""),
    }));
    state.filtered = [...state.gifs];

    const statCount = $("#statCount");
    if (statCount) statCount.textContent = String(state.gifs.length);
    const statBuild = $("#statBuild");
    if (statBuild) {
      statBuild.textContent = data?.builtAt
        ? new Date(data.builtAt).toLocaleString()
        : "—";
    }

    renderGallery();
    updateMeta();
  } catch (e) {
    errorEl.hidden = false;
    errorEl.textContent =
      "Couldn’t load the gallery data. If you just cloned this repo, run the fetch script to generate data/gifs.json.";
    console.error(e);
  }
}

function wireUi() {
  const search = $("#search");
  search.addEventListener("input", () => {
    state.search = search.value;
    applyFilter();
  });

  $("#shuffle").addEventListener("click", () => {
    state.gifs = shuffleArray(state.gifs);
    applyFilter();
    toast("Shuffled");
  });

  const layout = $("#layout");
  layout.addEventListener("change", () => setLayout(layout.value));

  // Modal
  $("#modal").addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.dataset && t.dataset.close === "true") closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
  $("#copyLink").addEventListener("click", async () => {
    const url = $("#openOnGiphy").href;
    try {
      await navigator.clipboard.writeText(url);
      toast("Copied link");
    } catch {
      toast("Copy failed (browser permission)");
    }
  });

  // Suggestions
  const suggestModal = $("#suggestModal");
  const openSuggest = $("#openSuggest");
  const suggestForm = $("#suggestForm");
  const suggestSubmit = $("#suggestSubmit");

  function openSuggestModal() {
    if (!suggestModal) return;
    suggestModal.hidden = false;
    suggestModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => {
      const ta = suggestModal.querySelector('textarea[name="message"]');
      if (ta) ta.focus();
    }, 0);
  }

  function closeSuggestModal() {
    if (!suggestModal || suggestModal.hidden) return;
    suggestModal.hidden = true;
    suggestModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  if (openSuggest) openSuggest.addEventListener("click", openSuggestModal);
  if (suggestModal) {
    suggestModal.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.dataset && t.dataset.close === "true") closeSuggestModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSuggestModal();
  });

  if (suggestForm) suggestForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const message = String(fd.get("message") || "").trim();
    if (!message) return;

    if (suggestSubmit) {
      suggestSubmit.disabled = true;
      suggestSubmit.textContent = "Sending…";
    }

    // Simulate a real request/response cycle.
    await new Promise((r) => setTimeout(r, 700));

    e.currentTarget.reset();
    closeSuggestModal();
    toast("Thanks — sent.");

    if (suggestSubmit) {
      suggestSubmit.disabled = false;
      suggestSubmit.textContent = "Send";
    }
  });

  // Theme
  $("#themeToggle").addEventListener("click", () => {
    setTheme(state.theme === "light" ? "dark" : "light");
    toast(`Theme: ${state.theme}`);
  });
}

function initPrefs() {
  const savedTheme = localStorage.getItem("perry.theme");
  const savedLayout = localStorage.getItem("perry.layout");
  setTheme(savedTheme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
  setLayout(savedLayout || "masonry");
  $("#layout").value = state.layout;
}

initPrefs();
wireUi();
loadGifs();

