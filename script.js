(function () {
  "use strict";

  const CFG = window.BIBLIOTECA_CONFIG || {
    DRIVE_ROOT_FOLDER_ID: "18nwSi3XYcgd9TXWOoPEohFmeK6RledF7",
    DRIVE_ROOT_URL: "https://drive.google.com/drive/folders/18nwSi3XYcgd9TXWOoPEohFmeK6RledF7",
    APPS_SCRIPT_URL: "",
    USE_NETLIFY_FUNCTION: true,
    NETLIFY_FUNCTION_URL: "/.netlify/functions/books",
    CACHE_TTL_MINUTES: 15,
    EXCLUDED_SUBJECTS: ["seguridad informática", "seguridad informatica"]
  };

  const STORAGE_KEYS = {
    FAVORITES: "biblioteca_uner_favs_v2",
    THEME: "biblioteca_uner_theme_v2",
    CATALOG_CACHE: "biblioteca_uner_live_cache_v2"
  };

  const state = {
    catalog: null,
    query: "",
    year: "all",
    semester: "all",
    subject: "all",
    sortBy: "plan",
    viewMode: "grid",
    onlyFavorites: false,
    hideEmptySubjects: false,
    theme: "dark",
    favorites: new Set(),
    selectedBookId: null,
    showPdfPreview: false,
    syncStatus: "local", // 'live' | 'syncing' | 'local' | 'error'
    syncMessage: "Catálogo local sincronizado"
  };

  function safeStorageGet(key) {
    try { return window.localStorage.getItem(key); } catch (_) { return null; }
  }

  function safeStorageSet(key, val) {
    try { window.localStorage.setItem(key, val); } catch (_) { /* ignore */ }
  }

  function normalizeText(str) {
    return String(str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function isExcludedSubject(name) {
    const norm = normalizeText(name);
    return (CFG.EXCLUDED_SUBJECTS || []).some((ex) => norm.includes(normalizeText(ex)));
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatBytes(bytes) {
    const n = Number(bytes || 0);
    if (!n || Number.isNaN(n)) return "PDF";
    if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(iso) {
    if (!iso) return "Sin fecha";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
    } catch (_) {
      return "Sin fecha";
    }
  }

  function sanitizeCatalog(raw) {
    if (!raw || !Array.isArray(raw.books)) return null;
    const subjects = (raw.subjects || []).filter((s) => !isExcludedSubject(s.name || s.fullName));
    const allowedCodes = new Set(subjects.map((s) => s.code));
    const books = raw.books.filter((b) => {
      if (isExcludedSubject(b.subject || b.subjectName)) return false;
      if (allowedCodes.size > 0 && b.subjectCode && !allowedCodes.has(b.subjectCode)) return false;
      return true;
    });
    return {
      generatedAt: raw.generatedAt || new Date().toISOString(),
      source: raw.source || "Google Drive",
      rootFolderId: raw.rootFolderId || CFG.DRIVE_ROOT_FOLDER_ID,
      rootFolderUrl: raw.rootFolderUrl || CFG.DRIVE_ROOT_URL,
      subjects,
      books
    };
  }

  function showToast(message) {
    const host = document.getElementById("toastContainer");
    if (!host) return;
    const el = document.createElement("div");
    el.className = "toast-enter surface-card px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 border border-teal-500/40";
    el.innerHTML = `<span class="w-2 h-2 rounded-full bg-teal-400 shrink-0"></span><span>${escapeHtml(message)}</span>`;
    host.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.25s ease";
      setTimeout(() => el.remove(), 260);
    }, 2600);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => showToast("Enlace copiado al portapapeles"),
        () => fallbackCopy(text)
      );
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      ta.remove();
      showToast("Enlace copiado al portapapeles");
    } catch (_) {
      showToast("No se pudo copiar automáticamente");
    }
  }

  function applyTheme(theme) {
    state.theme = theme === "light" ? "light" : "dark";
    document.documentElement.classList.toggle("light", state.theme === "light");
    safeStorageSet(STORAGE_KEYS.THEME, state.theme);
    const sun = document.getElementById("iconSun");
    const moon = document.getElementById("iconMoon");
    if (sun && moon) {
      sun.classList.toggle("hidden", state.theme === "light");
      moon.classList.toggle("hidden", state.theme !== "light");
    }
  }

  function loadFavorites() {
    try {
      const parsed = JSON.parse(safeStorageGet(STORAGE_KEYS.FAVORITES) || "[]");
      if (Array.isArray(parsed)) state.favorites = new Set(parsed);
    } catch (_) {
      state.favorites = new Set();
    }
  }

  function toggleFavorite(bookId) {
    if (!bookId) return;
    if (state.favorites.has(bookId)) {
      state.favorites.delete(bookId);
      showToast("Quitado de favoritos");
    } else {
      state.favorites.add(bookId);
      showToast("Guardado en favoritos");
    }
    safeStorageSet(STORAGE_KEYS.FAVORITES, JSON.stringify(Array.from(state.favorites)));
    renderAll();
    if (state.selectedBookId === bookId) renderModalContent();
  }

  async function loadInitialCatalog() {
    // 1) Instant render from embedded snapshot (Canvas preview) or local books.json
    if (window.__INITIAL_CATALOG__) {
      state.catalog = sanitizeCatalog(window.__INITIAL_CATALOG__);
      state.syncStatus = "local";
      state.syncMessage = "Catálogo Drive (48 libros cargados)";
      populateFilterOptions();
      renderAll();
    } else {
      try {
        const res = await fetch("./books.json", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          state.catalog = sanitizeCatalog(data);
          state.syncStatus = "local";
          state.syncMessage = "Catálogo base cargado";
          populateFilterOptions();
          renderAll();
        }
      } catch (_) {
        // Fallback handled below
      }
    }

    // 2) Check cached live Drive response
    const cachedRaw = safeStorageGet(STORAGE_KEYS.CATALOG_CACHE);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw);
        const ageMs = Date.now() - (cached.savedAt || 0);
        if (ageMs < (CFG.CACHE_TTL_MINUTES || 15) * 60 * 1000 && cached.data) {
          const clean = sanitizeCatalog(cached.data);
          if (clean && clean.books.length > 0) {
            state.catalog = clean;
            state.syncStatus = "live";
            state.syncMessage = "Sincronizado con Google Drive";
            populateFilterOptions();
            renderAll();
            return;
          }
        }
      } catch (_) { /* ignore invalid cache */ }
    }

    // 3) Attempt live sync in background if configured
    if (CFG.APPS_SCRIPT_URL || (CFG.USE_NETLIFY_FUNCTION && !window.__INITIAL_CATALOG__)) {
      await syncWithDrive(false);
    }
  }

  async function syncWithDrive(forceRefresh) {
    const endpoint = CFG.APPS_SCRIPT_URL
      ? `${CFG.APPS_SCRIPT_URL}${forceRefresh ? (CFG.APPS_SCRIPT_URL.includes("?") ? "&" : "?") + "refresh=1" : ""}`
      : (CFG.USE_NETLIFY_FUNCTION && !window.__INITIAL_CATALOG__ ? CFG.NETLIFY_FUNCTION_URL : "");

    if (!endpoint) {
      if (forceRefresh) {
        showToast("Activa Apps Script en config.js para sincronizar cambios en vivo");
        openSyncModal();
      }
      return;
    }

    state.syncStatus = "syncing";
    state.syncMessage = "Sincronizando con Drive…";
    updateSyncBadge();

    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const liveData = await res.json();
      const clean = sanitizeCatalog(liveData);
      if (!clean) throw new Error("Respuesta inválida");

      state.catalog = clean;
      state.syncStatus = "live";
      state.syncMessage = "Sincronizado con Drive";
      safeStorageSet(STORAGE_KEYS.CATALOG_CACHE, JSON.stringify({ savedAt: Date.now(), data: clean }));
      populateFilterOptions();
      renderAll();
      if (forceRefresh) showToast(`Catálogo actualizado: ${clean.books.length} libros`);
    } catch (_) {
      state.syncStatus = state.catalog ? "local" : "error";
      state.syncMessage = state.catalog ? "Catálogo local activo" : "Sin conexión con Drive";
      updateSyncBadge();
      if (forceRefresh) showToast("Usando catálogo local de respaldo");
    }
  }

  function updateSyncBadge() {
    const dot = document.getElementById("syncDot");
    const label = document.getElementById("syncLabel");
    const icon = document.getElementById("syncRefreshIcon");
    if (!dot || !label) return;

    dot.className = "w-2 h-2 rounded-full shrink-0";
    if (state.syncStatus === "live") {
      dot.classList.add("bg-emerald-400");
    } else if (state.syncStatus === "syncing") {
      dot.classList.add("bg-amber-400");
    } else if (state.syncStatus === "error") {
      dot.classList.add("bg-rose-400");
    } else {
      dot.classList.add("bg-teal-400");
    }
    label.textContent = state.syncMessage;
    if (icon) {
      icon.classList.toggle("spin-slow", state.syncStatus === "syncing");
    }
  }

  function populateFilterOptions() {
    if (!state.catalog) return;
    const subjects = state.catalog.subjects || [];
    const years = Array.from(new Set(subjects.map((s) => s.year)));
    const semesters = Array.from(new Set(subjects.map((s) => s.semester)));

    const yearSelect = document.getElementById("yearSelect");
    const semSelect = document.getElementById("semesterSelect");
    const subjSelect = document.getElementById("subjectSelect");

    if (yearSelect) {
      yearSelect.innerHTML = `<option value="all">Todos los años</option>` +
        years.map((y) => `<option value="${escapeHtml(y)}">${escapeHtml(y)}</option>`).join("");
      yearSelect.value = state.year;
    }

    if (semSelect) {
      semSelect.innerHTML = `<option value="all">Todos los cuatrimestres</option>` +
        semesters.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
      semSelect.value = state.semester;
    }

    if (subjSelect) {
      const filteredSubjects = subjects.filter((s) => {
        if (state.year !== "all" && s.year !== state.year) return false;
        if (state.semester !== "all" && s.semester !== state.semester) return false;
        return true;
      });
      if (state.subject !== "all" && !filteredSubjects.some((s) => s.code === state.subject)) {
        state.subject = "all";
      }
      subjSelect.innerHTML = `<option value="all">Todas las materias (${filteredSubjects.length})</option>` +
        filteredSubjects.map((s) => `<option value="${escapeHtml(s.code)}">${escapeHtml(s.fullName)}</option>`).join("");
      subjSelect.value = state.subject;
    }
  }

  function getFilteredBooks() {
    if (!state.catalog) return [];
    const q = normalizeText(state.query);
    let list = state.catalog.books.filter((b) => {
      if (state.year !== "all" && b.year !== state.year) return false;
      if (state.semester !== "all" && b.semester !== state.semester) return false;
      if (state.subject !== "all" && b.subjectCode !== state.subject) return false;
      if (state.onlyFavorites && !state.favorites.has(b.id)) return false;
      if (q) {
        const hay = normalizeText(`${b.title} ${b.author} ${b.subject} ${b.year} ${b.semester}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (state.sortBy === "title") {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title, "es"));
    } else if (state.sortBy === "author") {
      list = [...list].sort((a, b) => a.author.localeCompare(b.author, "es"));
    } else if (state.sortBy === "recent") {
      list = [...list].sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));
    } else {
      list = [...list].sort((a, b) => {
        const c = a.subjectCode.localeCompare(b.subjectCode, "es", { numeric: true });
        return c !== 0 ? c : a.title.localeCompare(b.title, "es");
      });
    }
    return list;
  }

  function renderStats(filteredBooks) {
    if (!state.catalog) return;
    const totalBooks = state.catalog.books.length;
    const totalSubjects = state.catalog.subjects.length;
    const populatedSubjects = new Set(state.catalog.books.map((b) => b.subjectCode)).size;

    const elTotalBooks = document.getElementById("statTotalBooks");
    const elSubjects = document.getElementById("statSubjects");
    const elUpdated = document.getElementById("statUpdated");
    const elFavCount = document.getElementById("favBadgeCount");
    const elResults = document.getElementById("resultsSummary");

    if (elTotalBooks) elTotalBooks.textContent = String(totalBooks);
    if (elSubjects) elSubjects.textContent = `${populatedSubjects}/${totalSubjects}`;
    if (elUpdated) elUpdated.textContent = formatDate(state.catalog.generatedAt);
    if (elFavCount) elFavCount.textContent = String(state.favorites.size);

    if (elResults) {
      const hasActiveFilters = state.query || state.year !== "all" || state.semester !== "all" || state.subject !== "all" || state.onlyFavorites;
      elResults.textContent = hasActiveFilters
        ? `Mostrando ${filteredBooks.length} de ${totalBooks} libros`
        : `${totalBooks} libros disponibles en ${populatedSubjects} materias activas (${totalSubjects} materias en el plan)`;
    }

    const favBtn = document.getElementById("favFilterBtn");
    if (favBtn) {
      favBtn.classList.toggle("border-teal-400", state.onlyFavorites);
      favBtn.classList.toggle("text-teal-400", state.onlyFavorites);
    }

    const clearBtn = document.getElementById("clearFiltersBtn");
    if (clearBtn) {
      const dirty = Boolean(state.query || state.year !== "all" || state.semester !== "all" || state.subject !== "all" || state.onlyFavorites);
      clearBtn.classList.toggle("opacity-50", !dirty);
      clearBtn.disabled = !dirty;
    }
  }

  function renderQuickSubjectPills() {
    const container = document.getElementById("subjectPills");
    if (!container || !state.catalog) return;
    const counts = {};
    state.catalog.books.forEach((b) => {
      counts[b.subjectCode] = (counts[b.subjectCode] || 0) + 1;
    });

    const subjects = state.catalog.subjects.filter((s) => {
      if (state.year !== "all" && s.year !== state.year) return false;
      if (state.semester !== "all" && s.semester !== state.semester) return false;
      if (state.hideEmptySubjects && !counts[s.code]) return false;
      return true;
    });

    const allPill = `<button type="button" data-pill-subject="all" class="subject-pill ${state.subject === "all" ? "active" : ""} px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap">Todas</button>`;
    const pills = subjects.map((s) => {
      const c = counts[s.code] || 0;
      return `<button type="button" data-pill-subject="${escapeHtml(s.code)}" class="subject-pill ${state.subject === s.code ? "active" : ""} px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5">
        <span class="font-mono opacity-75">${escapeHtml(s.code)}</span>
        <span>${escapeHtml(s.name)}</span>
        <span class="px-1.5 py-0.5 rounded-full text-[10px] ${c > 0 ? "bg-teal-500/15 text-teal-400" : "bg-slate-500/15 opacity-70"}">${c}</span>
      </button>`;
    }).join("");

    container.innerHTML = allPill + pills;
  }

  function buildCoverMarkup(book, accent) {
    const color = accent || "#14b8a6";
    return `
      <div class="cover-shell" style="background: linear-gradient(155deg, ${color}2e 0%, #0b1c2e 55%, #06101b 100%);">
        <div class="cover-spine"></div>
        <div class="absolute inset-0 p-4 pl-5 flex flex-col justify-between z-[1] select-none">
          <div class="flex items-center gap-1.5 pr-10">
            <span class="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-black/35 text-teal-300 border border-white/10">${escapeHtml(book.subjectCode)}</span>
            <span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/35 text-slate-300">${escapeHtml(book.format || "PDF")}</span>
          </div>
          <div>
            <p class="text-white font-bold text-sm leading-snug line-clamp-3 drop-shadow-sm">${escapeHtml(book.title)}</p>
            <p class="text-slate-300/90 text-xs mt-1.5 line-clamp-2">${escapeHtml(book.author)}</p>
          </div>
          <div class="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-300/80">
            <span class="truncate max-w-[70%]">${escapeHtml(book.subjectName)}</span>
            <span class="font-mono">${escapeHtml(formatBytes(book.sizeBytes))}</span>
          </div>
        </div>
        <img
          src="${escapeHtml(book.thumbnailUrl)}"
          alt="Portada de ${escapeHtml(book.title)}"
          loading="lazy"
          referrerpolicy="no-referrer"
          class="cover-img"
          onload="this.classList.add('loaded')"
          onerror="this.remove()"
        />
      </div>
    `;
  }

  function renderBookCard(book, accent) {
    const isFav = state.favorites.has(book.id);
    if (state.viewMode === "list") {
      return `
        <article class="book-card rounded-xl p-3.5 flex items-center justify-between gap-4 cursor-pointer" data-open-book="${escapeHtml(book.id)}">
          <div class="flex items-center gap-3.5 min-w-0">
            <div class="w-10 h-12 rounded-lg shrink-0 flex items-center justify-center font-mono text-xs font-bold text-white" style="background: linear-gradient(145deg, ${accent}, #0f2942);">
              ${escapeHtml(book.format || "PDF")}
            </div>
            <div class="min-w-0">
              <h4 class="font-semibold text-sm sm:text-base truncate">${escapeHtml(book.title)}</h4>
              <p class="text-xs sm:text-sm text-[var(--text-secondary)] truncate">${escapeHtml(book.author)} · <span class="font-mono text-xs">${escapeHtml(formatBytes(book.sizeBytes))}</span></p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button type="button" data-fav-book="${escapeHtml(book.id)}" title="${isFav ? "Quitar de favoritos" : "Guardar en favoritos"}" class="p-2 rounded-lg surface-soft hover:border-teal-400 transition">
              <i data-lucide="bookmark" class="w-4 h-4 ${isFav ? "fill-teal-400 text-teal-400" : "text-[var(--text-secondary)]"}"></i>
            </button>
            <a href="${escapeHtml(book.viewUrl)}" target="_blank" rel="noopener noreferrer" data-stop-prop="1" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-500/15 text-teal-400 hover:bg-teal-500 hover:text-slate-950 transition">
              Abrir
            </a>
          </div>
        </article>
      `;
    }

    return `
      <article class="book-card rounded-2xl p-3 flex flex-col justify-between gap-3 cursor-pointer group" data-open-book="${escapeHtml(book.id)}">
        <div>
          <div class="relative">
            ${buildCoverMarkup(book, accent)}
            <button
              type="button"
              data-fav-book="${escapeHtml(book.id)}"
              aria-label="${isFav ? "Quitar de favoritos" : "Guardar en favoritos"}"
              class="absolute top-2.5 right-2.5 z-10 p-2 rounded-xl bg-slate-950/70 hover:bg-slate-950 text-white border border-white/15 backdrop-blur-sm transition"
            >
              <i data-lucide="bookmark" class="w-4 h-4 ${isFav ? "fill-teal-400 text-teal-400" : "text-slate-200"}"></i>
            </button>
          </div>
          <div class="mt-3 px-0.5">
            <h4 class="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-teal-400 transition-colors">${escapeHtml(book.title)}</h4>
            <p class="text-xs text-[var(--text-secondary)] mt-1 truncate">${escapeHtml(book.author)}</p>
          </div>
        </div>
        <div class="px-0.5 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2 text-xs">
          <span class="font-mono text-[11px] text-[var(--text-muted)]">${escapeHtml(formatBytes(book.sizeBytes))}</span>
          <span class="text-teal-400 font-medium inline-flex items-center gap-1">
            Ver detalle
            <i data-lucide="arrow-up-right" class="w-3.5 h-3.5"></i>
          </span>
        </div>
      </article>
    `;
  }

  function renderCatalog(filteredBooks) {
    const main = document.getElementById("catalogContent");
    if (!main || !state.catalog) return;

    const hasSearchOrFav = Boolean(state.query || state.onlyFavorites);

    // If sorting by title/author/recent or searching, show unified grid/list or grouped by subject
    if (state.sortBy !== "plan") {
      if (filteredBooks.length === 0) {
        main.innerHTML = renderEmptySearch();
        refreshIcons();
        return;
      }
      const accentMap = Object.fromEntries(state.catalog.subjects.map((s) => [s.code, s.accent]));
      const gridClass = state.viewMode === "grid"
        ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5"
        : "flex flex-col gap-2.5";
      main.innerHTML = `
        <section class="space-y-4">
          <div class="${gridClass}">
            ${filteredBooks.map((b) => renderBookCard(b, accentMap[b.subjectCode])).join("")}
          </div>
        </section>
      `;
      refreshIcons();
      return;
    }

    // Group by Year -> Semester -> Subject
    const booksBySubject = {};
    filteredBooks.forEach((b) => {
      if (!booksBySubject[b.subjectCode]) booksBySubject[b.subjectCode] = [];
      booksBySubject[b.subjectCode].push(b);
    });

    const visibleSubjects = state.catalog.subjects.filter((s) => {
      if (state.year !== "all" && s.year !== state.year) return false;
      if (state.semester !== "all" && s.semester !== state.semester) return false;
      if (state.subject !== "all" && s.code !== state.subject) return false;
      const count = (booksBySubject[s.code] || []).length;
      if ((state.hideEmptySubjects || hasSearchOrFav) && count === 0) return false;
      return true;
    });

    if (visibleSubjects.length === 0) {
      main.innerHTML = renderEmptySearch();
      refreshIcons();
      return;
    }

    const grouped = new Map();
    visibleSubjects.forEach((s) => {
      if (!grouped.has(s.year)) grouped.set(s.year, new Map());
      const semMap = grouped.get(s.year);
      if (!semMap.has(s.semester)) semMap.set(s.semester, []);
      semMap.get(s.semester).push(s);
    });

    let html = "";
    grouped.forEach((semMap, yearName) => {
      const yearBooksCount = Array.from(semMap.values())
        .flat()
        .reduce((acc, s) => acc + (booksBySubject[s.code] || []).length, 0);

      html += `
        <section class="space-y-6">
          <div class="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
            <div class="flex items-center gap-3">
              <span class="w-2.5 h-8 rounded-full bg-gradient-to-b from-teal-400 to-sky-500"></span>
              <div>
                <h2 class="font-display text-sm sm:text-base leading-relaxed">${escapeHtml(yearName)}</h2>
                <p class="text-xs text-[var(--text-secondary)]">${yearBooksCount} ${yearBooksCount === 1 ? "libro disponible" : "libros disponibles"}</p>
              </div>
            </div>
          </div>
      `;

      semMap.forEach((subjectsList, semName) => {
        html += `
          <div class="space-y-6">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full surface-soft text-xs font-semibold uppercase tracking-wider text-teal-400">
              <i data-lucide="calendar-range" class="w-3.5 h-3.5"></i>
              <span>${escapeHtml(semName)}</span>
            </div>
        `;

        subjectsList.forEach((subj) => {
          const list = booksBySubject[subj.code] || [];
          const gridClass = state.viewMode === "grid"
            ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5"
            : "flex flex-col gap-2.5";

          html += `
            <div class="space-y-3.5">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2.5">
                  <span class="font-mono text-xs font-bold px-2.5 py-1 rounded-lg text-white" style="background-color: ${escapeHtml(subj.accent)};">${escapeHtml(subj.code)}</span>
                  <h3 class="text-base sm:text-lg font-bold">${escapeHtml(subj.name)}</h3>
                  <span class="text-xs px-2 py-0.5 rounded-full surface-soft text-[var(--text-secondary)]">${list.length}</span>
                </div>
                <a href="${escapeHtml(subj.folderUrl)}" target="_blank" rel="noopener noreferrer" class="text-xs font-medium text-[var(--text-secondary)] hover:text-teal-400 inline-flex items-center gap-1.5 transition">
                  <i data-lucide="folder-open" class="w-3.5 h-3.5"></i>
                  <span>Carpeta en Drive</span>
                </a>
              </div>
              ${
                list.length > 0
                  ? `<div class="${gridClass}">${list.map((b) => renderBookCard(b, subj.accent)).join("")}</div>`
                  : `<div class="surface-soft rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-[var(--text-secondary)]">
                      <div class="flex items-center gap-2.5">
                        <i data-lucide="cloud-upload" class="w-4 h-4 text-teal-400 shrink-0"></i>
                        <span>Carpeta lista para sincronización automática — los libros que subas a Drive aparecerán aquí.</span>
                      </div>
                      <a href="${escapeHtml(subj.folderUrl)}" target="_blank" rel="noopener noreferrer" class="text-teal-400 font-medium hover:underline">Abrir carpeta</a>
                    </div>`
              }
            </div>
          `;
        });

        html += `</div>`;
      });

      html += `</section>`;
    });

    main.innerHTML = html;
    refreshIcons();
  }

  function renderEmptySearch() {
    return `
      <div class="surface-card rounded-2xl p-10 text-center max-w-lg mx-auto my-8 space-y-3">
        <div class="w-12 h-12 rounded-2xl bg-teal-500/15 text-teal-400 flex items-center justify-center mx-auto">
          <i data-lucide="book-x" class="w-6 h-6"></i>
        </div>
        <h3 class="text-lg font-bold">No se encontraron libros</h3>
        <p class="text-sm text-[var(--text-secondary)]">Prueba ajustando el término de búsqueda o quitando alguno de los filtros activos.</p>
        <button type="button" id="emptyResetBtn" class="mt-2 px-4 py-2 rounded-xl bg-teal-500 text-slate-950 font-semibold text-sm hover:bg-teal-400 transition">
          Restablecer filtros
        </button>
      </div>
    `;
  }

  function openBookModal(bookId) {
    state.selectedBookId = bookId;
    state.showPdfPreview = false;
    const modal = document.getElementById("bookModal");
    if (!modal) return;
    renderModalContent();
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.style.overflow = "hidden";
  }

  function closeBookModal() {
    state.selectedBookId = null;
    state.showPdfPreview = false;
    const modal = document.getElementById("bookModal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.style.overflow = "";
  }

  function renderModalContent() {
    const body = document.getElementById("bookModalBody");
    if (!body || !state.catalog || !state.selectedBookId) return;
    const book = state.catalog.books.find((b) => b.id === state.selectedBookId);
    if (!book) return;
    const subj = state.catalog.subjects.find((s) => s.code === book.subjectCode);
    const accent = subj ? subj.accent : "#14b8a6";
    const isFav = state.favorites.has(book.id);

    body.innerHTML = `
      <div class="flex flex-col md:flex-row gap-6">
        <div class="w-40 sm:w-48 mx-auto md:mx-0 shrink-0">
          ${buildCoverMarkup(book, accent)}
        </div>
        <div class="flex-1 min-w-0 space-y-4">
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="font-mono font-bold px-2.5 py-1 rounded-lg text-white" style="background-color: ${escapeHtml(accent)};">${escapeHtml(book.subjectCode)}</span>
            <span class="px-2.5 py-1 rounded-lg surface-soft font-medium">${escapeHtml(book.subjectName)}</span>
            <span class="px-2.5 py-1 rounded-lg surface-soft text-[var(--text-secondary)]">${escapeHtml(book.year)} · ${escapeHtml(book.semester)}</span>
          </div>

          <div>
            <h3 class="text-xl sm:text-2xl font-extrabold leading-tight">${escapeHtml(book.title)}</h3>
            <p class="text-sm sm:text-base text-[var(--text-secondary)] mt-1">${escapeHtml(book.author)}</p>
          </div>

          <div class="grid grid-cols-3 gap-2.5 text-xs">
            <div class="surface-soft rounded-xl p-3">
              <div class="text-[var(--text-muted)]">Formato</div>
              <div class="font-semibold mt-0.5">${escapeHtml(book.format || "PDF")}</div>
            </div>
            <div class="surface-soft rounded-xl p-3">
              <div class="text-[var(--text-muted)]">Tamaño</div>
              <div class="font-semibold font-mono mt-0.5">${escapeHtml(formatBytes(book.sizeBytes))}</div>
            </div>
            <div class="surface-soft rounded-xl p-3">
              <div class="text-[var(--text-muted)]">Actualizado</div>
              <div class="font-semibold mt-0.5">${escapeHtml(formatDate(book.modifiedTime))}</div>
            </div>
          </div>

          <div class="flex flex-wrap gap-2.5 pt-1">
            <a href="${escapeHtml(book.viewUrl)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-sm transition">
              <i data-lucide="external-link" class="w-4 h-4"></i>
              <span>Leer en Drive</span>
            </a>
            <a href="${escapeHtml(book.downloadUrl)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl surface-soft hover:border-teal-400 font-semibold text-sm transition">
              <i data-lucide="download" class="w-4 h-4"></i>
              <span>Descargar</span>
            </a>
            <button type="button" id="togglePreviewBtn" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl surface-soft hover:border-teal-400 font-semibold text-sm transition">
              <i data-lucide="eye" class="w-4 h-4"></i>
              <span>${state.showPdfPreview ? "Ocultar vista previa" : "Vista previa aquí"}</span>
            </button>
            <button type="button" id="modalCopyBtn" class="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl surface-soft hover:border-teal-400 text-sm transition" title="Copiar enlace">
              <i data-lucide="link" class="w-4 h-4"></i>
              <span>Copiar link</span>
            </button>
            <button type="button" id="modalFavBtn" class="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl surface-soft hover:border-teal-400 text-sm transition">
              <i data-lucide="bookmark" class="w-4 h-4 ${isFav ? "fill-teal-400 text-teal-400" : ""}"></i>
              <span>${isFav ? "Guardado" : "Favorito"}</span>
            </button>
          </div>
        </div>
      </div>
      ${
        state.showPdfPreview
          ? `<div class="mt-5 rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-slate-950">
              <iframe src="${escapeHtml(book.previewUrl)}" class="w-full h-[55vh]" allow="autoplay" title="Vista previa de ${escapeHtml(book.title)}"></iframe>
            </div>`
          : ""
      }
    `;

    const previewBtn = document.getElementById("togglePreviewBtn");
    if (previewBtn) {
      previewBtn.addEventListener("click", () => {
        state.showPdfPreview = !state.showPdfPreview;
        renderModalContent();
      });
    }
    const copyBtn = document.getElementById("modalCopyBtn");
    if (copyBtn) copyBtn.addEventListener("click", () => copyToClipboard(book.viewUrl));

    const favBtn = document.getElementById("modalFavBtn");
    if (favBtn) favBtn.addEventListener("click", () => toggleFavorite(book.id));

    refreshIcons();
  }

  function openSyncModal() {
    const modal = document.getElementById("syncModal");
    if (!modal) return;
    const statusText = document.getElementById("syncModalStatus");
    if (statusText) {
      statusText.textContent = CFG.APPS_SCRIPT_URL
        ? `Conectado a Google Apps Script (${state.catalog ? state.catalog.books.length : 0} libros).`
        : "Modo catálogo local activo. Para sincronizar nuevos libros de Drive automáticamente sin tocar la web, despliega apps-script/Code.gs y pega su URL en config.js.";
    }
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.style.overflow = "hidden";
    refreshIcons();
  }

  function closeSyncModal() {
    const modal = document.getElementById("syncModal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.style.overflow = "";
  }

  function resetFilters() {
    state.query = "";
    state.year = "all";
    state.semester = "all";
    state.subject = "all";
    state.onlyFavorites = false;
    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.value = "";
    populateFilterOptions();
    renderAll();
  }

  function renderAll() {
    updateSyncBadge();
    const filtered = getFilteredBooks();
    renderStats(filtered);
    renderQuickSubjectPills();
    renderCatalog(filtered);
    updateViewModeButtons();
  }

  function updateViewModeButtons() {
    const g = document.getElementById("viewGridBtn");
    const l = document.getElementById("viewListBtn");
    if (!g || !l) return;
    g.classList.toggle("bg-teal-500/20", state.viewMode === "grid");
    g.classList.toggle("text-teal-400", state.viewMode === "grid");
    l.classList.toggle("bg-teal-500/20", state.viewMode === "list");
    l.classList.toggle("text-teal-400", state.viewMode === "list");
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  function bindEvents() {
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        state.query = e.target.value;
        renderAll();
      });
    }

    const yearSelect = document.getElementById("yearSelect");
    if (yearSelect) {
      yearSelect.addEventListener("change", (e) => {
        state.year = e.target.value;
        populateFilterOptions();
        renderAll();
      });
    }

    const semSelect = document.getElementById("semesterSelect");
    if (semSelect) {
      semSelect.addEventListener("change", (e) => {
        state.semester = e.target.value;
        populateFilterOptions();
        renderAll();
      });
    }

    const subjSelect = document.getElementById("subjectSelect");
    if (subjSelect) {
      subjSelect.addEventListener("change", (e) => {
        state.subject = e.target.value;
        renderAll();
      });
    }

    const sortSelect = document.getElementById("sortSelect");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        state.sortBy = e.target.value;
        renderAll();
      });
    }

    const hideEmptyToggle = document.getElementById("hideEmptyToggle");
    if (hideEmptyToggle) {
      hideEmptyToggle.addEventListener("change", (e) => {
        state.hideEmptySubjects = e.target.checked;
        renderAll();
      });
    }

    const clearBtn = document.getElementById("clearFiltersBtn");
    if (clearBtn) clearBtn.addEventListener("click", resetFilters);

    const favFilterBtn = document.getElementById("favFilterBtn");
    if (favFilterBtn) {
      favFilterBtn.addEventListener("click", () => {
        state.onlyFavorites = !state.onlyFavorites;
        renderAll();
      });
    }

    const themeBtn = document.getElementById("themeToggleBtn");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => applyTheme(state.theme === "dark" ? "light" : "dark"));
    }

    const viewGridBtn = document.getElementById("viewGridBtn");
    if (viewGridBtn) viewGridBtn.addEventListener("click", () => { state.viewMode = "grid"; renderAll(); });

    const viewListBtn = document.getElementById("viewListBtn");
    if (viewListBtn) viewListBtn.addEventListener("click", () => { state.viewMode = "list"; renderAll(); });

    const syncStatusBtn = document.getElementById("syncStatusBtn");
    if (syncStatusBtn) syncStatusBtn.addEventListener("click", openSyncModal);

    const syncNowBtn = document.getElementById("syncNowBtn");
    if (syncNowBtn) syncNowBtn.addEventListener("click", () => syncWithDrive(true));

    const closeBookBtn = document.getElementById("closeBookModalBtn");
    if (closeBookBtn) closeBookBtn.addEventListener("click", closeBookModal);

    const closeSyncBtn = document.getElementById("closeSyncModalBtn");
    if (closeSyncBtn) closeSyncBtn.addEventListener("click", closeSyncModal);

    const bookModal = document.getElementById("bookModal");
    if (bookModal) {
      bookModal.addEventListener("click", (e) => {
        if (e.target === bookModal) closeBookModal();
      });
    }

    const syncModal = document.getElementById("syncModal");
    if (syncModal) {
      syncModal.addEventListener("click", (e) => {
        if (e.target === syncModal) closeSyncModal();
      });
    }

    // Event delegation for subject pills & book cards
    const pillsHost = document.getElementById("subjectPills");
    if (pillsHost) {
      pillsHost.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-pill-subject]");
        if (!btn) return;
        state.subject = btn.getAttribute("data-pill-subject");
        const subjSelectEl = document.getElementById("subjectSelect");
        if (subjSelectEl) subjSelectEl.value = state.subject;
        renderAll();
      });
    }

    const catalogHost = document.getElementById("catalogContent");
    if (catalogHost) {
      catalogHost.addEventListener("click", (e) => {
        if (e.target.closest("#emptyResetBtn")) {
          resetFilters();
          return;
        }
        if (e.target.closest("[data-stop-prop]")) return;

        const favBtn = e.target.closest("[data-fav-book]");
        if (favBtn) {
          e.stopPropagation();
          toggleFavorite(favBtn.getAttribute("data-fav-book"));
          return;
        }

        const card = e.target.closest("[data-open-book]");
        if (card) {
          openBookModal(card.getAttribute("data-open-book"));
        }
      });
    }

    // Keyboard shortcuts: '/' focuses search, 'Escape' closes modals
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeBookModal();
        closeSyncModal();
      } else if (e.key === "/" && document.activeElement !== searchInput && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
        e.preventDefault();
        if (searchInput) searchInput.focus();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(safeStorageGet(STORAGE_KEYS.THEME) || "dark");
    loadFavorites();
    bindEvents();
    refreshIcons();
    loadInitialCatalog();
  });
})();
