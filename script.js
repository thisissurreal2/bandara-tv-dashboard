const SLIDE_DURATION_MS = 25000;

const pages = [...document.querySelectorAll(".page")];

let currentPage = 0;
let pageStartedAt = Date.now();
let slidesPaused = false;

const titleElement = document.getElementById("page-title");
const numberElement = document.getElementById("page-number");
const progressElement = document.getElementById("progress");

function showPage(index) {
  if (pages.length === 0) return;

  pages.forEach((page, i) => {
    page.classList.toggle("active", i === index);
  });

  currentPage = index;
  pageStartedAt = Date.now();

  if (titleElement) {
    titleElement.textContent =
      pages[index].dataset.title || "Information Display";
  }

  if (numberElement) {
    numberElement.textContent = `${index + 1} / ${pages.length}`;
  }

  if (progressElement) {
    progressElement.style.width = "0%";
  }
}

function updateClock() {
  const now = new Date();

  const clock = document.getElementById("clock");
  const date = document.getElementById("date");

  if (clock) {
    clock.textContent =
      now.toLocaleTimeString("en-GB", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }) + " WIB";
  }

  if (date) {
    date.textContent = now.toLocaleDateString("en-GB", {
      timeZone: "Asia/Jakarta",
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }
}

function rotatePages() {
  if (pages.length === 0 || slidesPaused) return;

  const elapsed = Date.now() - pageStartedAt;

  if (progressElement) {
    const percent = Math.min(
      100,
      (elapsed / SLIDE_DURATION_MS) * 100
    );

    progressElement.style.width = `${percent}%`;
  }

  if (elapsed >= SLIDE_DURATION_MS) {
    showPage((currentPage + 1) % pages.length);
  }
}

if (pages.length > 0) {
  showPage(0);
}

updateClock();

setInterval(updateClock, 1000);
setInterval(rotatePages, 250);

document.getElementById("next-slide")?.addEventListener("click", () => {
  if (pages.length > 0) {
    showPage((currentPage + 1) % pages.length);
  }
});

document.getElementById("prev-slide")?.addEventListener("click", () => {
  if (pages.length > 0) {
    showPage((currentPage - 1 + pages.length) % pages.length);
  }
});

document.getElementById("pause-slides")?.addEventListener("click", event => {
  slidesPaused = !slidesPaused;
  event.currentTarget.textContent = slidesPaused ? "▶ Lanjut" : "Ⅱ Jeda";
});

document.addEventListener("keydown", event => {
  if (pages.length === 0) return;

  if (event.key === "ArrowRight") {
    showPage((currentPage + 1) % pages.length);
  }

  if (event.key === "ArrowLeft") {
    showPage((currentPage - 1 + pages.length) % pages.length);
  }

  if (event.key === " " && event.target.tagName !== "BUTTON") {
    event.preventDefault();
    slidesPaused = !slidesPaused;

    const pauseButton = document.getElementById("pause-slides");
    if (pauseButton) {
      pauseButton.textContent = slidesPaused ? "▶ Lanjut" : "Ⅱ Jeda";
    }
  }
});


// ============================================================
// BANK INDONESIA EXCHANGE RATES
// Supports automatic JSON loading and manual Excel upload.
// ============================================================
const rateTable = document.getElementById("rates");
const rateStatus = document.getElementById("rate-status");

const currencyNames = {
  AUD: "Dolar Australia",
  CNY: "Yuan Tiongkok",
  EUR: "Euro",
  GBP: "Pound Sterling",
  JPY: "Yen Jepang",
  KRW: "Won Korea Selatan",
  MYR: "Ringgit Malaysia",
  SAR: "Riyal Arab Saudi",
  SGD: "Dolar Singapura",
  USD: "Dolar Amerika Serikat"
};

const currencyOrder = [
  "USD",
  "EUR",
  "SGD",
  "AUD",
  "CNY",
  "GBP",
  "JPY",
  "KRW",
  "MYR",
  "SAR"
];

const currencyFlags = {
  AUD: "au",
  CNY: "cn",
  EUR: "eu",
  GBP: "gb",
  JPY: "jp",
  KRW: "kr",
  MYR: "my",
  SAR: "sa",
  SGD: "sg",
  USD: "us"
};

const numberFormat = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function parseBIValue(value) {
  if (typeof value === "number") return value;
  if (value == null) return NaN;

  // Handles Indonesian Excel formatting, e.g. 18.206,58
  const normalized = String(value)
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");

  return Number(normalized);
}

function formatChange(current, previous) {
  if (!previous || previous.sell === 0) return "—";

  const change =
    ((current.sell - previous.sell) / previous.sell) * 100;

  const arrow = change > 0 ? "▲" : change < 0 ? "▼" : "—";
  const sign = change > 0 ? "+" : "";

  return `${arrow} ${sign}${change.toFixed(2)}%`;
}


// USD/IDR rate is taken from the BI data instead of Frankfurter.
let usdToIdr = null;

function renderBIRates(rates, sourceLabel) {
  // Use the BI USD selling rate for gold/oil IDR conversions.
  if (rates.USD && Number.isFinite(rates.USD.sell)) {
    usdToIdr = rates.USD.sell;
  }

  if (!rateTable || !rateStatus) return;

  const storageKey = "biPreviousRates";
  let previousRates = {};

  try {
    previousRates = JSON.parse(
      localStorage.getItem(storageKey) || "{}"
    );
  } catch (error) {
    console.warn("Could not read previous BI rates:", error);
  }

    // Prefer the previous business day from the updater over the browser's memory.
  if (window.biPreviousFromFile) {
    previousRates = window.biPreviousFromFile;
  }

  rateTable.innerHTML = currencyOrder
    .filter(code => rates[code])
    .map(code => {
      const rate = rates[code];
      const previous = previousRates[code];
      const change = formatChange(rate, previous);

      return `
        <tr>
          <td>
            <img
              src="images/flags/${currencyFlags[code]}.png"
              alt=""
              class="currency-flag"
            >
            ${currencyNames[code]}
          </td>
          <td>${code}</td>
          <td>${numberFormat.format(rate.sell)}</td>
          <td>${numberFormat.format(rate.buy)}</td>
          <td>${change}</td>
        </tr>
      `;
    })
    .join("");

  try {
    localStorage.setItem(storageKey, JSON.stringify(rates));
  } catch (error) {
    console.warn("Could not save BI rates to local storage:", error);
  }

  rateStatus.textContent =
    `Berhasil memuat ${Object.keys(rates).length} mata uang · ${sourceLabel}`;
}

let lastRatesSignature = "";

// Automatically load the cloud-synced JSON file.
// The file must be present in the dashboard's root folder.
async function loadBIRatesFromJSON() {
  if (!rateTable || !rateStatus) return;

  try {
    if (!lastRatesSignature) {
      rateStatus.textContent = "Memuat kurs BI terbaru...";
    }

    const response = await fetch("./bi_updater/latest_rates.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data.rows)) {
      throw new Error("Format JSON tidak valid: rows tidak ditemukan.");
    }

    const rates = {};

    for (const row of data.rows) {
      const code = String(row.currency || "").trim().toUpperCase();

      if (!currencyNames[code]) continue;

      const nominal = Number(row.nominal);
      const buy = Number(row.buy);
      const sell = Number(row.sell);

      if (
        !(nominal > 0) ||
        !Number.isFinite(buy) ||
        !Number.isFinite(sell)
      ) {
        continue;
      }

      // BI quotes JPY per 100 yen; normalize to one yen.
      rates[code] = {
        unit: 1,
        buy: buy / nominal,
        sell: sell / nominal
      };
    }

        // Previous published day's rates, supplied by the updater.
    window.biPreviousFromFile = null;
    if (data.previous && Array.isArray(data.previous.rows)) {
      const prev = {};
      for (const row of data.previous.rows) {
        const code = String(row.currency || "").trim().toUpperCase();
        const nominal = Number(row.nominal);
        const sell = Number(row.sell);
        if (!currencyNames[code] || !(nominal > 0) || !Number.isFinite(sell)) continue;
        prev[code] = { sell: sell / nominal };
      }
      if (Object.keys(prev).length) window.biPreviousFromFile = prev;
    }

    if (Object.keys(rates).length === 0) {
      throw new Error("Tidak ada kurs yang valid.");
    }

    const retrievedAt = data.retrieved_at
      ? new Date(data.retrieved_at).toLocaleString("id-ID")
      : "waktu tidak tersedia";

    const signature = JSON.stringify(rates);
    const ageHours = data.retrieved_at
      ? (Date.now() - new Date(data.retrieved_at).getTime()) / 3600000
      : Infinity;
    const staleNote = ageHours > 72 ? " · ⚠ data lama" : "";

    // Same data as last time: update the status text only, so the
    // "Perubahan" column is not overwritten with identical numbers.
    if (signature === lastRatesSignature) {
      rateStatus.textContent =
        `Berhasil memuat ${Object.keys(rates).length} mata uang · Bank Indonesia · ${retrievedAt}${staleNote}`;
      return;
    }

    lastRatesSignature = signature;
    renderBIRates(
      rates,
      `Bank Indonesia · ${retrievedAt}${staleNote}`
    );
  } catch (error) {
    console.error("Gagal memuat kurs BI JSON:", error);

      rateStatus.textContent = lastRatesSignature
      ? `Gagal memperbarui kurs (${error.message}). Menampilkan data sebelumnya.`
         : `JSON gagal dimuat: ${error.message}.`;
  }
}


// Load JSON when the dashboard starts, then re-check every 10 minutes.
loadBIRatesFromJSON();
setInterval(loadBIRatesFromJSON, 10 * 60 * 1000);


// ============================================================
// GOLD AND OIL DISPLAY HELPERS
// USD-to-IDR conversion uses the BI USD selling rate above.
// ============================================================

function formatIDR(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value);
}

function displayGoldInIDR(goldUsdPerTroyOunce) {
  if (usdToIdr === null) return;

  const goldIdrPerGram =
    (goldUsdPerTroyOunce * usdToIdr) / 31.1035;

  const goldPrice = document.getElementById("gold-price");

  if (goldPrice) {
    goldPrice.textContent = formatIDR(goldIdrPerGram);
  }
}

function displayOilInIDR(oilUsdPerBarrel) {
  if (usdToIdr === null) return;

  const oilIdrPerBarrel = oilUsdPerBarrel * usdToIdr;
  const oilPrice = document.getElementById("oil-price");

  if (oilPrice) {
    oilPrice.textContent = formatIDR(oilIdrPerBarrel);
  }
}


/* ============================================================
   MARKET / BI RATE ALTERNATION
   Each view gets half of the existing 25-second page interval.
   ============================================================ */
(() => {
  const liveView = document.getElementById("live-rates-view");
  const biView = document.getElementById("bi-rates-view");
  if (!liveView || !biView) return;

  const RATE_VIEW_DURATION_MS = 12500;
  let rateViewStartedAt = Date.now();
  let showingLiveRates = true;

  function setRateView(showLive) {
    showingLiveRates = showLive;
    liveView.classList.toggle("active", showLive);
    biView.classList.toggle("active", !showLive);
    rateViewStartedAt = Date.now();
    if (showLive) mountTradingViewQuotes();
  }

  window.addEventListener("rate-view-manual-switch", event => {
    if (typeof event.detail?.showLive !== "boolean") return;
    showingLiveRates = event.detail.showLive;
    rateViewStartedAt = Date.now();
    if (showingLiveRates) mountTradingViewQuotes();
  });

  function mountTradingViewQuotes() {
    document.querySelectorAll(".tradingview-rate").forEach(container => {
      if (container.dataset.loaded === "true") return;

      const symbol = container.dataset.symbol;
      if (!symbol) return;

      container.dataset.loaded = "true";

      const widget = document.createElement("div");
      widget.className = "tradingview-widget-container";

      const target = document.createElement("div");
      target.className = "tradingview-widget-container__widget";
      widget.appendChild(target);

      const config = document.createElement("script");
      config.type = "text/plain";
      config.textContent = JSON.stringify({
        symbol,
        colorTheme: "light",
        isTransparent: true,
        locale: "en",
        width: "100%"
      });
      widget.appendChild(config);

      const script = document.createElement("script");
      script.src =
        "https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js";
      script.async = true;
      script.textContent = config.textContent;

      widget.appendChild(script);
      container.appendChild(widget);
    });
  }

  mountTradingViewQuotes();

  setInterval(() => {
    if (Date.now() - rateViewStartedAt >= RATE_VIEW_DURATION_MS) {
      setRateView(!showingLiveRates);
    }
  }, 250);
})();


/* Manual controls for switching between market and BI rate views */
(() => {
  const liveView = document.getElementById("live-rates-view");
  const biView = document.getElementById("bi-rates-view");
  const liveButton = document.getElementById("rate-view-switch");
  const biButton = document.getElementById("rate-view-switch-bi");

  if (!liveView || !biView) return;

  function switchRateView(showLive) {
    liveView.classList.toggle("active", showLive);
    biView.classList.toggle("active", !showLive);

    // Keep the automatic alternation timer aligned with the user's manual choice.
    window.dispatchEvent(new CustomEvent("rate-view-manual-switch", {
      detail: { showLive }
    }));
  }

  liveButton?.addEventListener("click", () => switchRateView(false));
  biButton?.addEventListener("click", () => switchRateView(true));
})();

/* PT Bandara news renderer — replace ONLY the previously appended news block with this. */
(() => {
  const nationalContainer = document.getElementById("national-news");
  const internationalContainer = document.getElementById("international-news");
  if (!nationalContainer || !internationalContainer) return;

  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);

  function relativeTime(value, english = false) {
  if (!value) return english ? "Time unavailable" : "Waktu tidak tersedia";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return english ? "Time unavailable" : "Waktu tidak tersedia";
  }

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return english ? "Just now" : "Baru saja";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return english
      ? `${minutes} ${minutes === 1 ? "minute ago" : "minutes ago"}`
      : `${minutes} menit yang lalu`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return english
      ? `${hours} ${hours === 1 ? "hour ago" : "hours ago"}`
      : `${hours} jam yang lalu`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return english
      ? `${days} ${days === 1 ? "day ago" : "days ago"}`
      : `${days} hari yang lalu`;
  }

  return date.toLocaleDateString(english ? "en-GB" : "id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

  function render(container, items, fallbackLabel) {
    if (!Array.isArray(items) || !items.length) return false;
    const newest = [...items]
      .sort((a, b) => new Date(b.published || 0).getTime() - new Date(a.published || 0).getTime())
      .slice(0, 3);

    container.innerHTML = newest.map((item, index) => {
      const title = escapeHTML(item.title || "Judul tidak tersedia");
      const summary = escapeHTML(item.summary || "Buka sumber berita untuk membaca informasi lengkap.");
      const source = escapeHTML(item.source || fallbackLabel);
      const published = item.published || "";
      const english = container === internationalContainer;
      const age = escapeHTML(relativeTime(published, english));
      const url = /^https?:\/\//i.test(item.url || "") ? escapeHTML(item.url) : "#";
      const imageUrl = /^https?:\/\//i.test(item.image || "") ? escapeHTML(item.image) : "";
      const image = imageUrl
        ? `<img class="news-thumb" src="${imageUrl}" alt="" loading="eager" onerror="this.onerror=null;this.classList.add('news-thumb-placeholder');this.removeAttribute('src');this.setAttribute('aria-label','Gambar tidak tersedia');">`
        : `<div class="news-thumb news-thumb-placeholder" aria-hidden="true">BERITA</div>`;
      const category = container === internationalContainer
          ? (index === 0 ? "LATEST" : index === 1 ? "WORLD" : "NEWS")
          : (index === 0 ? "TERBARU" : index === 1 ? "NASIONAL" : "BERITA");
      return `<article class="news-card news-card-with-image">
        ${image}
        <div class="news-card-content">
          <div class="news-meta">
            <span class="category ${index === 1 ? "green" : ""}">${category}</span>
            <small class="news-age">${age}</small>
          </div>
          <h3><a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a></h3>
          <p>${summary}</p>
          <small class="news-source">${source}</small>
        </div>
      </article>`;
    }).join("");
    // Store raw timestamps on cards so relative ages can update without refetching.
    newest.forEach((item, index) => {
      const card = container.children[index];
      const meta = card && card.querySelector(".news-age");
      if (meta) meta.dataset.published = item.published || "";
    });
    return true;
  }

  function addStyles() {
    if (document.getElementById("bandara-news-layout-fix")) return;
    const style = document.createElement("style");
    style.id = "bandara-news-layout-fix";
    style.textContent = `
      /* High-specificity overrides counter the dashboard's original .news-card styles. */
      #national-news .news-card.news-card-with-image,
      #international-news .news-card.news-card-with-image {
        display: flex !important;
        flex-direction: row !important;
        align-items: flex-start !important;
        gap: 14px !important;
        height: auto !important;
        min-height: 174px !important;
        max-height: none !important;
        padding: 12px 16px !important;
        overflow: visible !important;
        box-sizing: border-box !important;
  }
      #national-news .news-thumb,
      #international-news .news-thumb {
        display: block !important;
        width: 230px !important;
        height: 150px !important;
        min-width: 230px !important;
        max-width: 230px !important;
        flex: 0 0 230px !important;
        object-fit: cover !important;
        border-radius: 7px !important;
        background: #e7edf3 !important;
        margin: 0 !important;
      }
      #national-news .news-thumb-placeholder,
      #international-news .news-thumb-placeholder {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        color: #526579 !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        letter-spacing: 1px !important;
      }
      #national-news .news-card-content,
      #international-news .news-card-content {
        display: block !important;
        min-width: 0 !important;
        flex: 1 1 auto !important;
        width: auto !important;
        overflow: hidden !important;
      }
      #national-news .news-meta,
      #international-news .news-meta {
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        gap: 10px !important;
        flex-wrap: wrap !important;
        margin: 0 0 5px !important;
      }
      #national-news .news-age,
      #international-news .news-age {
        color: #64788a !important;
        font-size: 12px !important;
        font-weight: 500 !important;
        white-space: nowrap !important;
      }
      #national-news .news-card-content h3,
      #international-news .news-card-content h3 {
        margin: 3px 0 5px !important;
        font-size: clamp(15px, 1.05vw, 20px) !important;
        line-height: 1.25 !important;
        overflow-wrap: anywhere !important;
      }
      #national-news .news-card-content h3 a,
      #international-news .news-card-content h3 a {
        color: #24527a !important;
        text-decoration: none !important;
      }
      #national-news .news-card-content p,
      #international-news .news-card-content p {
        display: -webkit-box !important;
        -webkit-box-orient: vertical !important;
        -webkit-line-clamp: 2 !important;
        overflow: hidden !important;
        margin: 0 0 5px !important;
        font-size: 13px !important;
        line-height: 1.35 !important;
        color: #63788a !important;
      }
      #national-news .news-source,
      #international-news .news-source {
        display: block !important;
        color: #718397 !important;
        font-size: 11px !important;
      }
      @media (max-width: 900px) {
        #national-news .news-thumb,
        #international-news .news-thumb {
          width: 180px !important;
          min-width: 180px !important;
          max-width: 180px !important;
          height: 120px !important;
          flex-basis: 180px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  async function loadNews() {
    try {
      const response = await fetch("./news.json?ts=" + Date.now(), { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      addStyles();
      render(nationalContainer, data.national, "ANTARA");
      render(internationalContainer, data.international, "BBC World");
      console.info("PT Bandara news loaded", data.updated_at || "");
    } catch (error) {
      console.warn("News refresh failed; keeping current headlines.", error);
    }
  }

  addStyles();
  loadNews();
  setInterval(loadNews, 2 * 60 * 1000);
  setInterval(() => {
    document.querySelectorAll("#national-news .news-age, #international-news .news-age").forEach(node => {
      node.textContent = relativeTime(
      node.dataset.published,
      Boolean(node.closest("#international-news"))
    );
    });
  }, 60 * 1000);
})();


/* PT Bandara monthly time-slot calendar + Google Sheets test integration.
   Public JSONP endpoint is for dummy-data prototyping only. */
(() => {
  const select = document.getElementById("schedule-month-select");
  const board = document.getElementById("schedule");
  if (!select || !board) return;

  const subtitle = document.getElementById("schedule-subtitle");
  const note = document.getElementById("schedule-note");
  const caption = document.getElementById("schedule-caption");
  const totalEl = document.getElementById("schedule-total");
  const simulatorEl = document.getElementById("schedule-simulator");
  const groundEl = document.getElementById("schedule-ground");
  const todayOperationsDate = document.getElementById("today-operations-date");
  const todayOperationsList = document.getElementById("today-operations-list");
  const operationLegendMount = document.getElementById("operation-colour-legend-mount");
  const SCHEDULE_API_URL = "https://bandara-schedule-api.daniel-dev-test.workers.dev/schedule";
  const TOKEN_STORAGE_KEY = "bandara_device_token";

  // One-time device setup: open the dashboard URL ending in #dt=<token>.
  // The token is saved in this browser only, then removed from the address bar.
  function captureDeviceToken() {
    try {
      const found = location.hash.match(/(?:^#|&)dt=([A-Za-z0-9_-]{16,128})/);
      if (found) {
        localStorage.setItem(TOKEN_STORAGE_KEY, found[1]);
        history.replaceState(null, "", location.pathname + location.search);
      }
    } catch (e) { /* storage blocked: the status line will say the device is not set up */ }
  }
  function getDeviceToken() {
    try { return localStorage.getItem(TOKEN_STORAGE_KEY) || ""; } catch (e) { return ""; }
  }
  captureDeviceToken();
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const monthShort = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const weekdayShort = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const startYear = 2026, startMonth = 10, endYear = 2030, endMonth = 12;
  const slots = [
    { section: "Ground School", time: "10:00 - 14:00", key: "ground-10" },
    { section: "Ground School", time: "14:00 - 18:00", key: "ground-14" },
    { section: "Flight Simulator", time: "16:00 - 20:00", key: "sim-16" },
    { section: "Flight Simulator", time: "20:00 - 24:00", key: "sim-20" }
  ];
  let requestToken = 0;
  let lastJakartaDate = "";
  let currentRows = [];
  let lastMonthGestureAt = 0;

  // Compact calendar toolbar. The original month select remains the source of truth,
  // but is visually replaced by simple month navigation controls.
  const toolbar = document.createElement("div");
  toolbar.className = "slot-calendar-toolbar";
  toolbar.innerHTML = `
    <button type="button" class="calendar-nav-button" data-month-step="-1" aria-label="Bulan sebelumnya">‹</button>
    <div class="calendar-toolbar-center">
      <strong class="calendar-current-month" id="calendar-current-month">October 2026</strong>
      <span class="calendar-today-indicator" id="calendar-today-indicator"></span>
    </div>
    <button type="button" class="calendar-today-button">Hari ini</button>
    <button type="button" class="calendar-nav-button" data-month-step="1" aria-label="Bulan berikutnya">›</button>`;
  const panel = board.closest(".schedule-timeline-panel");
  if (panel) panel.insertBefore(toolbar, board);
  const monthTitle = toolbar.querySelector("#calendar-current-month");
  const todayIndicator = toolbar.querySelector("#calendar-today-indicator");

  function navigateMonth(step) {
    const index = [...select.options].findIndex(o => o.value === select.value);
    const next = Math.max(0, Math.min(select.options.length - 1, index + step));
    if (next !== index && select.options[next]) selectMonth(select.options[next].value);
  }
  toolbar.querySelectorAll("[data-month-step]").forEach(button => {
    button.addEventListener("click", () => navigateMonth(Number(button.dataset.monthStep)));
  });
  toolbar.querySelector(".calendar-today-button").addEventListener("click", () => {
    const t = jakartaParts();
    const key = `${t.year}-${String(t.month).padStart(2,"0")}`;
    const first = `${startYear}-${String(startMonth).padStart(2,"0")}`;
    const last = `${endYear}-${String(endMonth).padStart(2,"0")}`;
    selectMonth(key < first ? first : key > last ? last : key);
  });

  function handleMonthSwipe(delta) {
    const now = Date.now();
    if (now - lastMonthGestureAt < 650) return;
    lastMonthGestureAt = now;
    navigateMonth(delta);
  }
  let touchStart = null;
  board.addEventListener("touchstart", event => {
    const t = event.changedTouches && event.changedTouches[0];
    if (t) touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  board.addEventListener("touchend", event => {
    if (!touchStart) return;
    const t = event.changedTouches && event.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.25) handleMonthSwipe(dx < 0 ? 1 : -1);
  }, { passive: true });
  board.addEventListener("wheel", event => {
    if (Math.abs(event.deltaX) > 28 && Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.15) {
      event.preventDefault();
      handleMonthSwipe(event.deltaX > 0 ? 1 : -1);
    }
  }, { passive: false });

  function jakartaParts() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    const get = type => parts.find(p => p.type === type).value;
    return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), key: `${get("year")}-${get("month")}-${get("day")}` };
  }
  function monthLabel(key) {
    const [y, m] = key.split("-").map(Number);
    return `${monthNames[m - 1]} ${y}`;
  }
  function populateMonths() {
    select.replaceChildren();
    for (let y = startYear; y <= endYear; y++) {
      const first = y === startYear ? startMonth : 1;
      const last = y === endYear ? endMonth : 12;
      for (let m = first; m <= last; m++) {
        const key = `${y}-${String(m).padStart(2, "0")}`;
        const option = document.createElement("option");
        option.value = key; option.textContent = monthLabel(key); select.appendChild(option);
      }
    }
  }
  function setStatus(message) { if (note) note.textContent = message; }
  function parseISO(value) {
    const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }
  function isoDay(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}-${String(date.getUTCDate()).padStart(2,"0")}`;
  }
  function getSlot(item) {
    const section = String(item.section || "").toLowerCase();
    const time = String(item.time || "").replace(/[–—]/g,"-").replace(/\s/g,"");
    if (section.includes("ground")) {
      if (time === "10:00-14:00") return 0;
      if (time === "14:00-18:00") return 1;
    }
    if (section.includes("simulator")) {
      if (time === "16:00-20:00") return 2;
      if (time === "20:00-24:00") return 3;
    }
    return -1;
  }
  // Fixed operator colours from the official schedule legend.
  const OPERATION_COLORS = {
    RMAF: "#5D0E62",       // Malaysia
    RSAF: "#F19E38",       // Singapore
    TAU: "#3E5529",        // TransAfrik
    RBAF: "#7B81F7",       // Bahrain
    EAF: "#7B611C",        // Ethiopia
    UAEAF: "#9FCE62",      // United Arab Emirates
    "AIR FORCE HOLIDAY": "#B7C5E4",
    "BAR AVIATION": "#EE857D",
    SLAF: "#75140B",       // Sri Lanka
    UAC: "#C49B33",        // Uganda Air Cargo
    PKAF: "#A6A6A6",       // Pakistan
    SAAF: "#FBE7A2",       // Saudi Arabia
    RJAF: "#4B77D1",       // Jordan
    BAF: "#000062",        // Brasilia
    PAF: "#FFFF54",        // Philippine
    LAF: "#75FB4C"         // Libyan Airforce
  };
  const OPERATION_LEGEND = [
    ["RMAF", "Malaysia"], ["RSAF", "Singapore"],
    ["TAU", "TransAfrik"], ["RBAF", "Bahrain"],
    ["EAF", "Ethiopia"], ["UAEAF", "United Arab Emirates"],
    ["Air Force Holiday", "Holiday"], ["Bar Aviation", "Bar Aviation"],
    ["SLAF", "Sri Lanka"], ["UAC", "Uganda Air Cargo"],
    ["PkAF", "Pakistan"], ["SAAF", "Saudi Arabia"],
    ["RJAF", "Jordan"], ["BAF", "Brasilia"],
    ["PAF", "Philippine"], ["LAF", "Libyan Airforce"]
  ];
  if (operationLegendMount) {
    operationLegendMount.appendChild(renderOperationLegend());
  }
  const LIGHT_OPERATION_COLORS = new Set(["#9FCE62", "#B7C5E4", "#A6A6A6", "#FBE7A2", "#FFFF54", "#75FB4C", "#F19E38"]);

  function getOperationCode(activity) {
    const name = String(activity || "").trim().toUpperCase();
    // Bar Aviation is entered in the schedule as "BAV Initial".
    if (/^BAV\b/.test(name) || name.includes("BAR AVIATION")) return "BAR AVIATION";
    if (/^AIR FORCE HOLIDAY\b/.test(name)) return "AIR FORCE HOLIDAY";
    const match = name.match(/^(RMAF|RSAF|TAU|RBAF|UAEAF|SLAF|UAC|PKAF|SAAF|RJAF|BAF|PAF|LAF|EAF)\b/);
    return match ? match[1] : "";
  }
  function bookingColor(item) {
    const code = getOperationCode(item && item.activity);
    if (code && OPERATION_COLORS[code]) return OPERATION_COLORS[code];
    return String(item && item.section || "").toLowerCase().includes("ground") ? "#d9ad4e" : "#5b9fc7";
  }
  // Shorten only single-day bookings. Multi-day bookings retain their full name.
  // Colour detection and tooltips always use the original activity from the Sheet.
  // Always display the full operation name, including single-day bookings.
  function calendarActivityLabel(activity, isSingleDay) {
    const original = String(activity || "").trim();
    return original || "Booking";
  }
  function renderOperationLegend() {
    const legend = makeCell("operation-colour-legend");
    const heading = makeCell("operation-colour-legend-title", "KETERANGAN WARNA OPERASI");
    const items = makeCell("operation-colour-legend-items");
    legend.append(heading, items);
    OPERATION_LEGEND.forEach(([name, description]) => {
      const item = makeCell("operation-colour-legend-item");
      const swatch = makeCell("operation-colour-swatch");
      const code = getOperationCode(name) || name.toUpperCase();
      swatch.style.backgroundColor = OPERATION_COLORS[code] || "#999999";
      const label = makeCell("operation-colour-label");
      const strong = document.createElement("strong");
      strong.textContent = name;
      const detail = document.createElement("span");
      detail.textContent = description;
      label.append(strong, detail);
      item.append(swatch, label);
      items.appendChild(item);
    });
    return legend;
  }
  function makeCell(className, text) {
    const el = document.createElement("div"); el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function renderGrid(rows, key) {
    board.replaceChildren();
    const [year, month] = key.split("-").map(Number);
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const today = jakartaParts();
    const todayInMonth = today.year === year && today.month === month;

    const scroller = makeCell("slot-calendar-scroll");
    const grid = makeCell("slot-calendar");
    grid.style.setProperty("--day-count", days);
    const header = makeCell("slot-calendar-header");
    header.style.setProperty("--day-count", days);
    const corner = makeCell("slot-calendar-corner", "TRAINING SLOT / TIME");
    header.appendChild(corner);
    for (let day = 1; day <= days; day++) {
      const date = new Date(Date.UTC(year, month - 1, day));
      const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
      const dateKey = isoDay(date);
      const cell = makeCell(`slot-day-head${isWeekend ? " is-weekend" : ""}${todayInMonth && today.day === day ? " is-today" : ""}`);
      const num = makeCell("slot-day-number", String(day));
      const weekday = makeCell("slot-weekday", weekdayShort[date.getUTCDay()]);
      cell.append(num, weekday);
      if (todayInMonth && today.day === day) cell.title = "Hari ini · Waktu Jakarta";
      header.appendChild(cell);
    }
    grid.appendChild(header);

    const slotRows = slots.map((slot, slotIndex) => {
      const row = makeCell(`slot-calendar-row slot-row-${slotIndex}`);
      const label = makeCell("slot-row-label");
      const section = makeCell("slot-section", slot.section);
      const time = makeCell("slot-time", slot.time.replace(" - ", "–"));
      label.append(section, time); row.appendChild(label);
      const track = makeCell("slot-row-track");
      track.style.setProperty("--day-count", days);
      for (let day = 1; day <= days; day++) {
        const date = new Date(Date.UTC(year, month - 1, day));
        const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
        const todayClass = todayInMonth && today.day === day ? " is-today" : "";
        const dayBackground = makeCell(`slot-day-bg${weekend ? " is-weekend" : ""}${todayClass}`);
        // Pin each background to its exact date column. Explicit placement prevents
        // CSS Grid auto-placement from shifting weekend/today shading out of alignment.
        dayBackground.style.gridColumn = `${day} / ${day + 1}`;
        dayBackground.style.gridRow = "1 / -1";
        track.appendChild(dayBackground);
      }
      row.appendChild(track); grid.appendChild(row);
      return { row, track };
    });

    const events = rows.map(item => ({ item, slot: getSlot(item), start: parseISO(item.startDate), end: parseISO(item.endDate) }))
      .filter(e => e.slot >= 0 && e.start && e.end && e.end >= e.start);
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month - 1, days));
    events.forEach(event => {
      const start = event.start < monthStart ? monthStart : event.start;
      const end = event.end > monthEnd ? monthEnd : event.end;
      if (end < monthStart || start > monthEnd) return;
      const startDay = start.getUTCDate();
      const endDay = end.getUTCDate();
      const isSingleDay = event.item.startDate === event.item.endDate;
      const chip = makeCell("slot-booking", calendarActivityLabel(event.item.activity, isSingleDay));
      const operationColour = bookingColor(event.item);
      chip.style.backgroundColor = operationColour;
      if (LIGHT_OPERATION_COLORS.has(operationColour.toUpperCase())) chip.style.color = "#263746";
      chip.style.gridColumn = `${startDay} / ${endDay + 1}`;
      chip.title = `${event.item.activity} · ${event.item.time} · ${event.item.section} · ${event.item.startDate} to ${event.item.endDate}`;
      chip.setAttribute("aria-label", chip.title);
      const lane = event.slot;
      const rowTrack = slotRows[lane].track;
      // Assign overlapping bookings to separate lanes within the same time-slot row.
      const laneEvents = events.filter(other => other.slot === event.slot && other !== event && other.start <= event.end && other.end >= event.start);
      let laneIndex = 0;
      const occupied = new Set();
      laneEvents.forEach(other => { if (other._lane !== undefined) occupied.add(other._lane); });
      while (occupied.has(laneIndex)) laneIndex++;
      event._lane = laneIndex;
      chip.style.gridRow = String(laneIndex + 1);
      // Do not display the time inside the booking chip; the row already identifies the slot.
      // Keep the full activity and time in the tooltip for reference.
      chip.textContent = calendarActivityLabel(event.item.activity, isSingleDay);
      rowTrack.appendChild(chip);
    });

    scroller.appendChild(grid); board.appendChild(scroller);
    if (!rows.length) {
      const empty = makeCell("schedule-empty", `Belum ada jadwal`);
      board.appendChild(empty);
    } else {
      const unmatched = rows.filter(r => getSlot(r) < 0);
      if (unmatched.length) setStatus(`${monthLabel(key)} · ${rows.length} kegiatan · ${unmatched.length} kegiatan memiliki waktu/bagian yang tidak sesuai dengan empat slot.`);
    }
  }
  function renderTodayOperations() {
    if (!todayOperationsList || !todayOperationsDate) return;
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(now);
    const value = type => parts.find(p => p.type === type).value;
    const todayKey = `${value("year")}-${value("month")}-${value("day")}`;
    const minutesNow = Number(value("hour")) * 60 + Number(value("minute"));
    const displayDate = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric"
    }).format(now);
    todayOperationsDate.textContent = displayDate;

    const selectedMonth = select.value;
    if (selectedMonth !== todayKey.slice(0, 7)) {
      todayOperationsList.innerHTML = "<p class='today-operations-empty'>Pilih bulan saat ini untuk melihat operasional hari ini.</p>";
      return;
    }

    const todays = currentRows.filter(item =>
      String(item.startDate || "") <= todayKey && String(item.endDate || "") >= todayKey
    ).map(item => {
      const match = String(item.time || "").match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/);
      let start = 0, end = 1440;
      if (match) {
        start = Number(match[1]) * 60 + Number(match[2]);
        end = Number(match[3]) * 60 + Number(match[4]);
        if (end === 1440 || end === 0) end = 1440;
      }
      const status = minutesNow < start ? "upcoming" : minutesNow < end ? "ongoing" : "completed";
      return { item, start, end, status };
    }).sort((a, b) => a.start - b.start);

    if (!todays.length) {
      todayOperationsList.innerHTML = '<p class="today-operations-empty">Tidak ada operasi yang dijadwalkan untuk hari ini.</p>';
      return;
    }

    todayOperationsList.replaceChildren();
    todays.forEach(({ item, start, end, status }) => {
      const card = document.createElement("article");
      card.className = `today-operation-card is-${status}`;
      const top = document.createElement("div");
      top.className = "today-operation-topline";
      const name = document.createElement("strong");
      name.className = "today-operation-name";
      name.textContent = item.activity || "Operasi terjadwal";
      const badge = document.createElement("span");
      badge.className = `today-operation-status is-${status}`;
      badge.textContent = {upcoming:"AKAN DATANG",ongoing:"BERLANGSUNG",completed:"SELESAI"}[status];
      top.append(name, badge);
      const details = document.createElement("div");
      details.className = "today-operation-details";
      const section = document.createElement("span");
      section.textContent = item.section || "Pelatihan";
      const time = document.createElement("span");
      time.textContent = item.time || `${String(Math.floor(start / 60)).padStart(2,"0")}:00–${String(Math.floor(end / 60)).padStart(2,"0")}:00`;
      details.append(section, time);
      card.append(top, details);
      todayOperationsList.appendChild(card);
    });
  }

    function loadSelectedMonth() {
    const key = select.value;
    const token = ++requestToken;
    const deviceToken = getDeviceToken();

    if (!deviceToken) {
      setStatus("Perangkat ini belum diberi izin memuat jadwal. Hubungi admin IT.");
      return;
    }

    setStatus(`Memuat ${monthLabel(key)}…`);

    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeout = setTimeout(() => {
      if (controller) controller.abort();
    }, 15000);

    fetch(`${SCHEDULE_API_URL}?month=${encodeURIComponent(key)}`, {
      headers: { "Authorization": `Bearer ${deviceToken}` },
      cache: "no-store",
      signal: controller ? controller.signal : undefined
    })
      .then(response =>
        response.json().catch(() => null).then(payload => ({
          status: response.status,
          payload: payload
        }))
      )
      .then(({ status, payload }) => {
        clearTimeout(timeout);

        if (token !== requestToken) return;

        if (status === 401) {
          setStatus("Akses ditolak. Token perangkat tidak valid atau sudah dicabut.");
          return;
        }

        if (status === 403) {
          setStatus("Akses ditolak. Perangkat harus terhubung melalui jaringan kantor.");
          return;
        }

        if (status === 404) {
          currentRows = [];
          renderGrid(currentRows, key);
          renderTodayOperations();
          setStatus(`${monthLabel(key)} · Jadwal belum tersedia`);
          return;
        }

        if (!payload || payload.ok !== true || !Array.isArray(payload.rows)) {
          setStatus(payload && payload.detail ? payload.detail : "Jadwal tidak dapat dimuat.");
          return;
        }

        currentRows = payload.rows;

        const validRows = currentRows.filter(item => {
          const start = parseISO(item.startDate);
          const end = parseISO(item.endDate);

          return getSlot(item) >= 0 && start && end && end >= start;
        });

        renderGrid(currentRows, key);
        renderTodayOperations();

        const rendered = board.querySelectorAll(".slot-booking").length;

        setStatus(
          `DIAGNOSTIK · API: ${status} · Diterima: ${currentRows.length} · Valid: ${validRows.length} · Ditampilkan: ${rendered}`
        );
      })
      .catch(() => {
        clearTimeout(timeout);

        if (token === requestToken) {
          setStatus("Tidak dapat terhubung ke server jadwal. Silakan coba lagi.");
        }
      });
}
  
  function selectMonth(key) {
    if (![...select.options].some(o => o.value === key)) return;
    select.value = key;
    const label = monthLabel(key);
    if (monthTitle) monthTitle.textContent = label;
    const todayNow = jakartaParts();
    if (todayIndicator) {
      const selectedIsToday = key === `${todayNow.year}-${String(todayNow.month).padStart(2,"0")}`;
      todayIndicator.textContent = selectedIsToday ? `HARI INI · ${todayNow.day} ${monthShort[todayNow.month - 1]}` : "";
      todayIndicator.classList.toggle("is-visible", selectedIsToday);
    }
    toolbar.querySelector('[data-month-step="-1"]').disabled = select.selectedIndex <= 0;
    toolbar.querySelector('[data-month-step="1"]').disabled = select.selectedIndex >= select.options.length - 1;
    if (subtitle) subtitle.textContent = `${label} · Monthly Time-slot Schedule`;
    if (caption) caption.textContent = `Jadwal Ground School dan Flight Simulator · Waktu Jakarta`;
    loadSelectedMonth();
  }
  function rolloverCheck() {
    const today = jakartaParts();
    if (today.key !== lastJakartaDate) {
      lastJakartaDate = today.key;
      const key = `${today.year}-${String(today.month).padStart(2,"0")}`;
      if ([...select.options].some(o => o.value === key)) selectMonth(key);
      else renderGrid(currentRows, select.value);
    } else if (select.value === `${today.year}-${String(today.month).padStart(2,"0")}`) {
      if (todayIndicator) {
        todayIndicator.textContent = `HARI INI · ${today.day} ${monthShort[today.month - 1]}`;
        todayIndicator.classList.add("is-visible");
      }
      renderGrid(currentRows, select.value);
    }
  }
  populateMonths();
  select.addEventListener("change", () => selectMonth(select.value));
  select.addEventListener("keydown", event => event.stopPropagation());
  const today = jakartaParts(); lastJakartaDate = today.key;
  const currentKey = `${today.year}-${String(today.month).padStart(2,"0")}`;
  const firstKey = `${startYear}-${String(startMonth).padStart(2,"0")}`;
  const lastKey = `${endYear}-${String(endMonth).padStart(2,"0")}`;
  selectMonth(currentKey >= firstKey && currentKey <= lastKey ? currentKey : firstKey);
  setInterval(loadSelectedMonth, 5 * 60 * 1000);
  setInterval(() => { renderTodayOperations(); rolloverCheck(); }, 30 * 1000);
})();
