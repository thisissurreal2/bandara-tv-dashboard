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
  event.currentTarget.textContent = slidesPaused ? "▶ Resume" : "Ⅱ Pause";
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
      pauseButton.textContent = slidesPaused ? "▶ Resume" : "Ⅱ Pause";
    }
  }
});


// ============================================================
// BANK INDONESIA EXCHANGE RATES
// Supports automatic JSON loading and manual Excel upload.
// ============================================================

const uploadInput = document.getElementById("bi-excel-upload");
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
      : `JSON gagal dimuat: ${error.message}. Silakan unggah Excel BI.`;
  }
}


// Import rates from the existing BI Excel upload control.
async function importBIRates(file) {
  if (!window.XLSX) {
    throw new Error(
      "Excel library belum dimuat. Periksa koneksi internet."
    );
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: ""
  });

  const headerIndex = rows.findIndex(row =>
    row.some(cell => String(cell).trim() === "Mata Uang") &&
    row.some(cell => String(cell).trim() === "Kurs Jual") &&
    row.some(cell => String(cell).trim() === "Kurs Beli")
  );

  if (headerIndex === -1) {
    throw new Error(
      "Kolom Mata Uang, Kurs Jual, dan Kurs Beli tidak ditemukan."
    );
  }

  const headers = rows[headerIndex].map(cell => String(cell).trim());
  const codeCol = headers.indexOf("Mata Uang");
  const valueCol = headers.indexOf("Nilai");
  const sellCol = headers.indexOf("Kurs Jual");
  const buyCol = headers.indexOf("Kurs Beli");

  const rates = {};

  for (const row of rows.slice(headerIndex + 1)) {
    const code = String(row[codeCol] || "").trim().toUpperCase();

    if (!currencyNames[code]) continue;

    const unit = parseBIValue(row[valueCol]);
    const sell = parseBIValue(row[sellCol]);
    const buy = parseBIValue(row[buyCol]);

    if (
      !(unit > 0) ||
      !Number.isFinite(sell) ||
      !Number.isFinite(buy)
    ) {
      continue;
    }

    const divisor = code === "JPY" ? 100 : unit;

    rates[code] = {
      unit: 1,
      sell: sell / divisor,
      buy: buy / divisor
    };
  }

  if (Object.keys(rates).length === 0) {
    throw new Error("Tidak ada data kurs yang valid di file.");
  }

  renderBIRates(
    rates,
    `Excel · ${new Date().toLocaleString("id-ID")}`
  );
}


// Keep the existing manual Excel upload available as a fallback.
if (uploadInput) {
  uploadInput.addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      rateStatus.textContent = "Membaca file Excel...";
      await importBIRates(file);
    } catch (error) {
      console.error(error);

      if (rateStatus) {
        rateStatus.textContent = `Gagal: ${error.message}`;
      }
    }

    // Allows selecting the same file again later.
    event.target.value = "";
  });
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
          ? (index === 0 ? "LATEST" : index === 1 ? "AVIATION" : "NEWS")
          : (index === 0 ? "TERBARU" : index === 1 ? "DIRGANTARA" : "BERITA");
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


/* C-130H schedule month picker: shows one month's table at a time. */
(() => {
  const select = document.getElementById("schedule-month-select");
  if (!select) return;

  const tables = [...document.querySelectorAll("[data-month]")];
  const subtitle = document.getElementById("schedule-subtitle");
  const note = document.getElementById("schedule-note");
  const caption = document.getElementById("schedule-caption");

  function showMonth(key) {
    const option = [...select.options].find(o => o.value === key);
    if (!option) return;
    const label = option.textContent;
    select.value = key;

    tables.forEach(body => { body.hidden = body.dataset.month !== key; });

    const hasData = tables.some(body => body.dataset.month === key && !body.querySelector(".schedule-empty"));
    if (subtitle) subtitle.textContent = `${label} · Training Schedule`;
    if (caption) caption.textContent = `Simulator activities · ${label}`;
    if (note) note.textContent = hasData
      ? `${label} · Schedule may change due to simulator serviceability and available slots.`
      : `${label} · Schedule not yet available.`;
  }

  select.addEventListener("change", () => showMonth(select.value));

  // Arrow keys / space on the dropdown must not flip the slideshow page.
  select.addEventListener("keydown", event => event.stopPropagation());

  // Start on the current month (Jakarta time) if listed, otherwise the latest listed month.
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const keys = [...select.options].map(o => o.value);
  showMonth(keys.includes(current) ? current : keys[keys.length - 1]);
})();