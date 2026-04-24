(() => {
  "use strict";

  const STORAGE_KEY = "routineBrowsing.v1";
  const VISITS_RETENTION_DAYS = 30;

  const DEFAULT_SITES = [
    { name: "Hacker News", url: "https://news.ycombinator.com", category: "뉴스" },
    { name: "네이버 뉴스", url: "https://news.naver.com", category: "뉴스" },
    { name: "GitHub", url: "https://github.com", category: "개발" },
    { name: "MDN", url: "https://developer.mozilla.org", category: "개발" },
    { name: "YouTube", url: "https://www.youtube.com", category: "콘텐츠" },
    { name: "Gmail", url: "https://mail.google.com", category: "일상" },
  ];

  const els = {
    dashboard: document.getElementById("dashboard"),
    todayLabel: document.getElementById("today-label"),
    progressBar: document.getElementById("progress-bar"),
    progressLabel: document.getElementById("progress-label"),
    btnAdd: document.getElementById("btn-add"),
    btnExport: document.getElementById("btn-export"),
    btnImport: document.getElementById("btn-import"),
    importFile: document.getElementById("import-file"),
    dialog: document.getElementById("site-dialog"),
    dialogTitle: document.getElementById("dialog-title"),
    form: document.getElementById("site-form"),
    dialogCancel: document.getElementById("dialog-cancel"),
    categoryOptions: document.getElementById("category-options"),
    cardTemplate: document.getElementById("card-template"),
  };

  let state = loadState();
  let editingId = null;

  function uid() {
    if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function todayKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return seedState();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.sites)) return seedState();
      return {
        sites: parsed.sites.map((s, i) => ({
          id: s.id || uid(),
          name: String(s.name || ""),
          url: String(s.url || ""),
          category: String(s.category || "기타"),
          iconUrl: s.iconUrl ? String(s.iconUrl) : "",
          order: Number.isFinite(s.order) ? s.order : i,
        })),
        visits: parsed.visits && typeof parsed.visits === "object" ? parsed.visits : {},
        lastOpenedDate: parsed.lastOpenedDate || todayKey(),
      };
    } catch {
      return seedState();
    }
  }

  function seedState() {
    return {
      sites: DEFAULT_SITES.map((s, i) => ({ ...s, id: uid(), iconUrl: "", order: i })),
      visits: {},
      lastOpenedDate: todayKey(),
    };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function pruneVisits() {
    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - VISITS_RETENTION_DAYS);
    const cutoffKey = todayKey(cutoff);
    for (const key of Object.keys(state.visits)) {
      if (key < cutoffKey) delete state.visits[key];
    }
  }

  function getTodayVisits() {
    const key = todayKey();
    if (!Array.isArray(state.visits[key])) state.visits[key] = [];
    return state.visits[key];
  }

  function isVisitedToday(id) {
    return getTodayVisits().includes(id);
  }

  function markVisited(id) {
    const list = getTodayVisits();
    if (!list.includes(id)) {
      list.push(id);
      saveState();
    }
  }

  function toggleVisited(id) {
    const list = getTodayVisits();
    const idx = list.indexOf(id);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(id);
    saveState();
  }

  function hostFromUrl(url) {
    try {
      return new URL(url).host.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

  function iconSrc(site) {
    if (site.iconUrl) return site.iconUrl;
    try {
      const host = new URL(site.url).host;
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
    } catch {
      return "favicon.svg";
    }
  }

  function groupByCategory(sites) {
    const sorted = [...sites].sort((a, b) => a.order - b.order);
    const groups = new Map();
    for (const site of sorted) {
      const cat = site.category || "기타";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(site);
    }
    return groups;
  }

  function render() {
    const now = new Date();
    els.todayLabel.textContent = now.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });

    const total = state.sites.length;
    const visited = getTodayVisits().filter((id) => state.sites.some((s) => s.id === id)).length;
    const pct = total === 0 ? 0 : Math.round((visited / total) * 100);
    els.progressBar.style.width = pct + "%";
    els.progressLabel.textContent = `${visited} / ${total}`;

    refreshCategoryDatalist();

    els.dashboard.innerHTML = "";
    if (state.sites.length === 0) {
      const empty = document.createElement("div");
      empty.className = "dashboard__empty";
      empty.textContent = "아직 사이트가 없습니다. 우측 상단의 ‘+ 사이트 추가’로 시작해 보세요.";
      els.dashboard.append(empty);
      return;
    }

    const groups = groupByCategory(state.sites);
    for (const [category, sites] of groups) {
      const section = document.createElement("section");
      section.className = "category";

      const header = document.createElement("div");
      header.className = "category__header";
      const h2 = document.createElement("h2");
      h2.textContent = category;
      const count = document.createElement("span");
      count.className = "category__count";
      const catVisited = sites.filter((s) => isVisitedToday(s.id)).length;
      count.textContent = `${catVisited} / ${sites.length}`;
      header.append(h2, count);

      const grid = document.createElement("div");
      grid.className = "grid";
      for (const site of sites) grid.append(renderCard(site));

      section.append(header, grid);
      els.dashboard.append(section);
    }
  }

  function renderCard(site) {
    const node = els.cardTemplate.content.firstElementChild.cloneNode(true);
    if (isVisitedToday(site.id)) node.classList.add("is-visited");
    node.dataset.id = site.id;

    const checkbox = node.querySelector(".card__checkbox");
    checkbox.checked = isVisitedToday(site.id);
    checkbox.addEventListener("change", () => {
      toggleVisited(site.id);
      render();
    });

    const link = node.querySelector(".card__link");
    link.href = site.url;
    link.addEventListener("click", () => {
      markVisited(site.id);
      setTimeout(render, 0);
    });

    const icon = node.querySelector(".card__icon");
    icon.src = iconSrc(site);
    icon.addEventListener("error", () => {
      icon.src = "favicon.svg";
    });

    node.querySelector(".card__name").textContent = site.name;
    node.querySelector(".card__host").textContent = hostFromUrl(site.url);

    node.querySelectorAll(".tool").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleToolAction(site.id, btn.dataset.action);
      });
    });

    return node;
  }

  function handleToolAction(id, action) {
    if (action === "edit") return openDialogForEdit(id);
    if (action === "delete") return deleteSite(id);
    if (action === "move-up") return moveSite(id, -1);
    if (action === "move-down") return moveSite(id, +1);
  }

  function deleteSite(id) {
    const site = state.sites.find((s) => s.id === id);
    if (!site) return;
    if (!confirm(`“${site.name}”을(를) 삭제할까요?`)) return;
    state.sites = state.sites.filter((s) => s.id !== id);
    normalizeOrder();
    saveState();
    render();
  }

  function moveSite(id, dir) {
    const sorted = [...state.sites].sort((a, b) => a.order - b.order);
    const byCat = sorted.filter(
      (s) => s.category === state.sites.find((x) => x.id === id).category,
    );
    const idx = byCat.findIndex((s) => s.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= byCat.length) return;
    const a = byCat[idx];
    const b = byCat[swapIdx];
    const tmp = a.order;
    a.order = b.order;
    b.order = tmp;
    saveState();
    render();
  }

  function normalizeOrder() {
    state.sites
      .sort((a, b) => a.order - b.order)
      .forEach((s, i) => {
        s.order = i;
      });
  }

  function refreshCategoryDatalist() {
    const cats = Array.from(new Set(state.sites.map((s) => s.category).filter(Boolean))).sort();
    els.categoryOptions.innerHTML = "";
    for (const c of cats) {
      const opt = document.createElement("option");
      opt.value = c;
      els.categoryOptions.append(opt);
    }
  }

  function openDialogForAdd() {
    editingId = null;
    els.dialogTitle.textContent = "사이트 추가";
    els.form.reset();
    refreshCategoryDatalist();
    els.dialog.showModal();
    els.form.elements.name.focus();
  }

  function openDialogForEdit(id) {
    const site = state.sites.find((s) => s.id === id);
    if (!site) return;
    editingId = id;
    els.dialogTitle.textContent = "사이트 편집";
    refreshCategoryDatalist();
    els.form.elements.name.value = site.name;
    els.form.elements.url.value = site.url;
    els.form.elements.category.value = site.category;
    els.form.elements.iconUrl.value = site.iconUrl || "";
    els.dialog.showModal();
    els.form.elements.name.focus();
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    const fd = new FormData(els.form);
    const name = String(fd.get("name") || "").trim();
    let url = String(fd.get("url") || "").trim();
    const category = String(fd.get("category") || "").trim() || "기타";
    const iconUrl = String(fd.get("iconUrl") || "").trim();
    if (!name || !url) return;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    if (editingId) {
      const site = state.sites.find((s) => s.id === editingId);
      if (site) Object.assign(site, { name, url, category, iconUrl });
    } else {
      const maxOrder = state.sites.reduce((m, s) => Math.max(m, s.order), -1);
      state.sites.push({
        id: uid(),
        name,
        url,
        category,
        iconUrl,
        order: maxOrder + 1,
      });
    }
    saveState();
    els.dialog.close();
    render();
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `routine-browsing-${todayKey()}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || !Array.isArray(parsed.sites)) throw new Error("invalid format");
        if (!confirm("가져오기를 진행하면 현재 데이터가 대체됩니다. 계속할까요?")) return;
        state = {
          sites: parsed.sites.map((s, i) => ({
            id: s.id || uid(),
            name: String(s.name || ""),
            url: String(s.url || ""),
            category: String(s.category || "기타"),
            iconUrl: s.iconUrl ? String(s.iconUrl) : "",
            order: Number.isFinite(s.order) ? s.order : i,
          })),
          visits: parsed.visits && typeof parsed.visits === "object" ? parsed.visits : {},
          lastOpenedDate: parsed.lastOpenedDate || todayKey(),
        };
        normalizeOrder();
        saveState();
        render();
      } catch (err) {
        alert("가져오기 실패: " + (err && err.message ? err.message : "파일 형식 오류"));
      }
    };
    reader.readAsText(file);
  }

  function handleDailyTransition() {
    const today = todayKey();
    if (state.lastOpenedDate !== today) {
      state.lastOpenedDate = today;
      pruneVisits();
      saveState();
    }
  }

  function attachEvents() {
    els.btnAdd.addEventListener("click", openDialogForAdd);
    els.btnExport.addEventListener("click", exportJson);
    els.btnImport.addEventListener("click", () => els.importFile.click());
    els.importFile.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) importJson(file);
      e.target.value = "";
    });
    els.form.addEventListener("submit", handleFormSubmit);
    els.dialogCancel.addEventListener("click", () => els.dialog.close());
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        handleDailyTransition();
        render();
      }
    });
  }

  function init() {
    handleDailyTransition();
    pruneVisits();
    saveState();
    attachEvents();
    render();
  }

  init();
})();
