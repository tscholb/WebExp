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
    installBanner: document.getElementById("install-banner"),
    btnInstall: document.getElementById("btn-install"),
    btnInstallDismiss: document.getElementById("btn-install-dismiss"),
    btnHistory: document.getElementById("btn-history"),
    historyDialog: document.getElementById("history-dialog"),
    historyClose: document.getElementById("history-close"),
    btnEdit: document.getElementById("btn-edit"),
    statClicks: document.getElementById("stat-clicks"),
    statVisited: document.getElementById("stat-visited"),
    statActive: document.getElementById("stat-active"),
    statStreak: document.getElementById("stat-streak"),
    rankList: document.getElementById("rank-list"),
    todayList: document.getElementById("today-list"),
    spark: document.getElementById("spark"),
  };

  let deferredInstallPrompt = null;
  const INSTALL_DISMISS_KEY = "routineBrowsing.installDismissed";

  let state = loadState();
  let editingId = null;
  let editMode = false;

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

  function normalizeState(parsed) {
    return {
      sites: (parsed.sites || []).map((s, i) => ({
        id: s.id || uid(),
        name: String(s.name || ""),
        url: String(s.url || ""),
        category: String(s.category || "기타"),
        iconUrl: s.iconUrl ? String(s.iconUrl) : "",
        order: Number.isFinite(s.order) ? s.order : i,
      })),
      visits: parsed.visits && typeof parsed.visits === "object" ? parsed.visits : {},
      clicks: parsed.clicks && typeof parsed.clicks === "object" ? parsed.clicks : {},
      activeSeconds:
        parsed.activeSeconds && typeof parsed.activeSeconds === "object" ? parsed.activeSeconds : {},
      lastOpenedDate: parsed.lastOpenedDate || todayKey(),
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return seedState();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.sites)) return seedState();
      return normalizeState(parsed);
    } catch {
      return seedState();
    }
  }

  function seedState() {
    return {
      sites: DEFAULT_SITES.map((s, i) => ({ ...s, id: uid(), iconUrl: "", order: i })),
      visits: {},
      clicks: {},
      activeSeconds: {},
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
    for (const bag of [state.visits, state.clicks, state.activeSeconds]) {
      for (const key of Object.keys(bag)) {
        if (key < cutoffKey) delete bag[key];
      }
    }
  }

  function recordClick(id) {
    const key = todayKey();
    if (!state.clicks[key]) state.clicks[key] = {};
    state.clicks[key][id] = (state.clicks[key][id] || 0) + 1;
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
      h2.addEventListener("click", () => {
        if (editMode) renameCategory(category);
      });
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
    link.addEventListener("click", (e) => {
      if (editMode) {
        e.preventDefault();
        openDialogForEdit(site.id);
        return;
      }
      recordClick(site.id);
      markVisited(site.id);
      saveState();
      setTimeout(render, 0);
    });

    node.addEventListener("click", (e) => {
      if (!editMode) return;
      if (e.target.closest(".card__tools")) return;
      if (e.target.closest(".card__link")) return;
      openDialogForEdit(site.id);
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
        state = normalizeState(parsed);
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

  let activeSince = null;

  function flushActiveTime() {
    if (activeSince == null) return;
    const now = Date.now();
    const elapsedSec = Math.max(0, Math.floor((now - activeSince) / 1000));
    activeSince = now;
    if (elapsedSec <= 0) return;
    const key = todayKey();
    state.activeSeconds[key] = (state.activeSeconds[key] || 0) + elapsedSec;
    saveState();
  }

  function startActiveTracking() {
    if (!document.hidden) activeSince = Date.now();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        flushActiveTime();
        activeSince = null;
      } else {
        activeSince = Date.now();
      }
    });
    window.addEventListener("pagehide", flushActiveTime);
    window.addEventListener("blur", () => {
      flushActiveTime();
      activeSince = null;
    });
    window.addEventListener("focus", () => {
      if (activeSince == null) activeSince = Date.now();
    });
    setInterval(flushActiveTime, 30000);
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

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (localStorage.getItem(INSTALL_DISMISS_KEY) !== "1") {
        els.installBanner.hidden = false;
      }
    });
    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      els.installBanner.hidden = true;
    });
    els.btnInstall.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      try {
        await deferredInstallPrompt.userChoice;
      } catch {}
      deferredInstallPrompt = null;
      els.installBanner.hidden = true;
    });
    els.btnInstallDismiss.addEventListener("click", () => {
      localStorage.setItem(INSTALL_DISMISS_KEY, "1");
      els.installBanner.hidden = true;
    });

    els.btnHistory.addEventListener("click", openHistory);
    els.historyClose.addEventListener("click", () => els.historyDialog.close());
    els.historyDialog.addEventListener("click", (e) => {
      if (e.target === els.historyDialog) els.historyDialog.close();
    });

    els.btnEdit.addEventListener("click", toggleEditMode);
  }

  function toggleEditMode() {
    editMode = !editMode;
    document.body.classList.toggle("edit-mode", editMode);
    els.btnEdit.classList.toggle("is-active", editMode);
    els.btnEdit.setAttribute("aria-pressed", editMode ? "true" : "false");
    els.btnEdit.title = editMode ? "편집 완료" : "편집 모드";
  }

  function renameCategory(oldName) {
    const next = prompt(`"${oldName}" 카테고리 이름을 바꿉니다.`, oldName);
    if (next == null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === oldName) return;
    for (const s of state.sites) {
      if (s.category === oldName) s.category = trimmed;
    }
    saveState();
    render();
  }

  function openHistory() {
    flushActiveTime();
    renderHistory();
    els.historyDialog.showModal();
  }

  function recentDateKeys(days) {
    const keys = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      keys.push(todayKey(d));
    }
    return keys;
  }

  function computeStreak() {
    const now = new Date();
    let current = 0;
    let longest = 0;
    let run = 0;
    const daysToCheck = 365;
    for (let i = 0; i < daysToCheck; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = todayKey(d);
      const visited = Array.isArray(state.visits[key]) && state.visits[key].length > 0;
      if (visited) {
        run += 1;
        if (i === current) current = run;
        if (run > longest) longest = run;
      } else {
        if (i === 0) {
          // no visits today yet — don't break streak; continue counting from yesterday
          current = 0;
        } else {
          run = 0;
        }
      }
    }
    return { current, longest };
  }

  function formatDuration(totalSec) {
    const sec = Math.max(0, Math.floor(totalSec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return { value: `${h}:${String(m).padStart(2, "0")}`, unit: "시간" };
    return { value: String(m), unit: "분" };
  }

  function siteById(id) {
    return state.sites.find((s) => s.id === id);
  }

  function renderHistory() {
    const key = todayKey();
    const todayClicks = state.clicks[key] || {};
    const totalClicks = Object.values(todayClicks).reduce((a, b) => a + b, 0);
    const total = state.sites.length;
    const visited = (state.visits[key] || []).filter((id) => siteById(id)).length;

    els.statClicks.innerHTML = `${totalClicks}<span class="stat__unit">회</span>`;
    els.statVisited.textContent = `${visited} / ${total}`;

    const activeSec = state.activeSeconds[key] || 0;
    const dur = formatDuration(activeSec);
    els.statActive.innerHTML = `${dur.value}<span class="stat__unit">${dur.unit}</span>`;

    const streak = computeStreak();
    els.statStreak.innerHTML = `${streak.current}<span class="stat__unit">일 · 최고 ${streak.longest}</span>`;

    renderRankList(els.todayList, todayClicks);

    const weekly = {};
    for (const k of recentDateKeys(7)) {
      const day = state.clicks[k] || {};
      for (const [id, c] of Object.entries(day)) {
        weekly[id] = (weekly[id] || 0) + c;
      }
    }
    renderRankList(els.rankList, weekly);

    renderSpark();
  }

  function renderRankList(container, counts) {
    container.innerHTML = "";
    const entries = Object.entries(counts)
      .map(([id, c]) => ({ site: siteById(id), count: c }))
      .filter((e) => e.site)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    if (entries.length === 0) return;
    const max = entries[0].count || 1;
    for (const { site, count } of entries) {
      const li = document.createElement("li");
      li.className = "rank-row";
      const icon = document.createElement("img");
      icon.className = "rank-row__icon";
      icon.alt = "";
      icon.src = iconSrc(site);
      icon.addEventListener("error", () => {
        icon.src = "favicon.svg";
      });
      const name = document.createElement("span");
      name.className = "rank-row__name";
      name.textContent = site.name;
      const bar = document.createElement("div");
      bar.className = "rank-row__bar";
      const fill = document.createElement("span");
      fill.style.width = Math.round((count / max) * 100) + "%";
      bar.append(fill);
      const countEl = document.createElement("span");
      countEl.className = "rank-row__count";
      countEl.textContent = count + "회";
      li.append(icon, name, bar, countEl);
      container.append(li);
    }
  }

  function renderSpark() {
    els.spark.innerHTML = "";
    const keys = recentDateKeys(7);
    const values = keys.map((k) => state.activeSeconds[k] || 0);
    const max = Math.max(60, ...values);
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const sec = values[i];
      const col = document.createElement("div");
      col.className = "spark__day";
      const bar = document.createElement("div");
      bar.className = "spark__bar";
      if (sec === 0) bar.classList.add("is-empty");
      const pct = max === 0 ? 0 : (sec / max) * 100;
      bar.style.height = Math.max(3, pct) + "%";
      const min = Math.round(sec / 60);
      bar.title = `${k} · ${min}분`;
      const label = document.createElement("div");
      label.className = "spark__label";
      const d = new Date(k + "T00:00:00");
      label.textContent = dayNames[d.getDay()];
      col.append(bar, label);
      els.spark.append(col);
    }
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  function init() {
    handleDailyTransition();
    pruneVisits();
    saveState();
    attachEvents();
    startActiveTracking();
    registerServiceWorker();
    render();
  }

  init();
})();
