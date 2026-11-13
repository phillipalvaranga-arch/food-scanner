/* Food Scanner — phone-first PWA. Data from Open Food Facts only. */
(function () {
  "use strict";

  const OFF_PRODUCT = "https://world.openfoodfacts.org/api/v2/product/";
  const OFF_SEARCH = "https://world.openfoodfacts.org/cgi/search.pl";
  const OFF_PAGE = "https://world.openfoodfacts.org/product/";
  const UA_NOTE = "FoodScanner/1.0 (https://phillipalvaranga-arch.github.io/food-scanner/)";
  const KEYS = { hist: "foodscan-history", fav: "foodscan-favorites", theme: "foodscan-theme", compare: "foodscan-compare", cache: "foodscan-cache" };
  const AHA_LOW = 1500;
  const AHA_HIGH = 2300;

  const main = document.getElementById("main");
  const toastEl = document.getElementById("toast");
  const themeBtn = document.getElementById("themeBtn");
  const netPill = document.getElementById("netPill");

  let scanCtl = null; // { stop() }
  let searchTimer = 0;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
  }
  function load(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch (e) { toast("Could not save on this device."); }
  }

  /* ---------- theme & network ---------- */
  function theme() { return document.documentElement.dataset.theme || "light"; }
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(KEYS.theme, t); } catch (e) {}
    themeBtn.textContent = t === "dark" ? "Light mode" : "Dark mode";
    themeBtn.setAttribute("aria-pressed", t === "dark" ? "true" : "false");
  }
  setTheme(theme() === "dark" ? "dark" : (document.documentElement.dataset.theme === "dark" ? "dark" : (matchMedia("(prefers-color-scheme: dark)").matches && !localStorage.getItem(KEYS.theme) ? "dark" : (localStorage.getItem(KEYS.theme) || "light"))));
  // normalize
  setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  themeBtn.addEventListener("click", function () { setTheme(theme() === "dark" ? "light" : "dark"); });

  function setNet(on) {
    netPill.textContent = on ? "Online" : "Offline";
    netPill.className = "pill " + (on ? "on" : "off");
  }
  setNet(navigator.onLine);
  window.addEventListener("online", function () { setNet(true); });
  window.addEventListener("offline", function () { setNet(false); });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  }

  /* ---------- storage ---------- */
  function historyList() { return load(KEYS.hist, []); }
  function favList() { return load(KEYS.fav, []); }
  function compareList() { return load(KEYS.compare, []); }
  function isFav(code) { return favList().some(function (x) { return x.code === code; }); }
  function cacheGet(code) {
    const c = load(KEYS.cache, {});
    return c[code] || null;
  }
  function cachePut(code, product) {
    const c = load(KEYS.cache, {});
    c[code] = { savedAt: Date.now(), product: product };
    const keys = Object.keys(c);
    if (keys.length > 40) {
      keys.sort(function (a, b) { return (c[a].savedAt || 0) - (c[b].savedAt || 0); });
      keys.slice(0, keys.length - 40).forEach(function (k) { delete c[k]; });
    }
    save(KEYS.cache, c);
  }
  function summaryOf(product, code) {
    const r = FoodScanRate.computeRating(product);
    const ing = FoodScanRate.ingredientEntries(product);
    const nat = FoodScanRate.naturalState(product, ing);
    return {
      code: code,
      name: productName(product),
      brand: product.brands || "",
      image: productImage(product),
      score: r.score,
      letter: r.letter,
      color: r.color,
      nova: FoodScanRate.novaGroup(product),
      natural: nat.score,
      at: Date.now()
    };
  }
  function upsert(list, item, max) {
    const next = [item].concat(list.filter(function (x) { return x.code !== item.code; }));
    return next.slice(0, max || 50);
  }
  function remember(product, code) {
    save(KEYS.hist, upsert(historyList(), summaryOf(product, code), 50));
    cachePut(code, product);
  }
  function toggleFav(product, code) {
    if (isFav(code)) {
      save(KEYS.fav, favList().filter(function (x) { return x.code !== code; }));
      toast("Removed from favorites");
      return false;
    }
    save(KEYS.fav, upsert(favList(), summaryOf(product, code), 50));
    toast("Saved to favorites on this device");
    return true;
  }
  function addCompare(code) {
    let c = compareList().filter(function (x) { return x !== code; });
    c.push(code);
    if (c.length > 2) c = c.slice(-2);
    save(KEYS.compare, c);
    toast(c.length === 2 ? "Added. Open Compare to see both." : "Added to compare. Pick one more product.");
  }

  /* ---------- Open Food Facts ---------- */
  function productName(p) {
    return (p.product_name_en || p.product_name || p.generic_name || p.abbreviated_product_name || "").trim() || "Unnamed product";
  }
  function productImage(p) {
    return p.image_front_small_url || p.image_front_url || p.image_small_url || p.image_url || "";
  }
  function digits(raw) { return String(raw || "").replace(/\D/g, ""); }
  function barcodeCandidates(raw) {
    const d = digits(raw);
    const out = [];
    function add(x) { if (x && out.indexOf(x) < 0) out.push(x); }
    add(d);
    if (d.length === 12) add("0" + d);
    if (d.length === 13 && d.charAt(0) === "0") add(d.slice(1));
    if (d.length >= 8 && d.length < 13) add(d.padStart(13, "0"));
    return out;
  }

  async function fetchProduct(code) {
    const url = OFF_PRODUCT + encodeURIComponent(code) + ".json";
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.status === 404) return { status: 0, code: code };
    if (!res.ok) throw new Error("Open Food Facts returned " + res.status);
    const data = await res.json();
    return data;
  }

  async function lookupBarcode(raw) {
    const cands = barcodeCandidates(raw);
    if (!cands.length) throw new Error("Enter a barcode number.");
    let last = null;
    for (let i = 0; i < cands.length; i++) {
      const data = await fetchProduct(cands[i]);
      last = data;
      if (data && data.status === 1 && data.product) {
        return { code: String(data.code || cands[i]), product: data.product };
      }
    }
    return { code: cands[0], product: null, status: last && last.status };
  }

  async function searchName(q) {
    const url = OFF_SEARCH + "?search_terms=" + encodeURIComponent(q) + "&search_simple=1&action=process&json=1&page_size=20";
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("Search failed (" + res.status + ")");
    return res.json();
  }

  /* ---------- camera / barcode ---------- */
  const FORMATS_NATIVE = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "codabar"];
  function hasNativeDetector() {
    return typeof window.BarcodeDetector === "function";
  }

  async function startNative(video, onCode) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    video.muted = true;
    await video.play();
    const detector = new BarcodeDetector({ formats: FORMATS_NATIVE });
    let stopped = false;
    let last = "";
    async function tick() {
      if (stopped) return;
      try {
        if (video.readyState >= 2) {
          const codes = await detector.detect(video);
          if (codes && codes.length) {
            const raw = codes[0].rawValue;
            if (raw && raw !== last) {
              last = raw;
              onCode(raw);
              return;
            }
          }
        }
      } catch (e) { /* keep going; some frames fail */ }
      if (!stopped) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    return {
      stop: function () {
        stopped = true;
        stream.getTracks().forEach(function (t) { t.stop(); });
        video.srcObject = null;
      },
      stream: stream
    };
  }

  async function startZxing(containerId, onCode) {
    if (typeof Html5Qrcode === "undefined") throw new Error("Scanner library failed to load.");
    const html5 = new Html5Qrcode(containerId, { verbose: false });
    const formats = [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.ITF
    ];
    await html5.start(
      { facingMode: "environment" },
      { fps: 8, qrbox: { width: 260, height: 140 }, formatsToSupport: formats },
      function (text) { onCode(text); },
      function () {}
    );
    return {
      stop: function () { return html5.stop().then(function () { html5.clear(); }).catch(function () {}); },
      stream: null
    };
  }

  async function stopScan() {
    if (scanCtl) {
      try { await scanCtl.stop(); } catch (e) {}
      scanCtl = null;
    }
  }

  function beep() {
    try {
      if (navigator.vibrate) navigator.vibrate(80);
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 880;
      g.gain.value = 0.06;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      setTimeout(function () { o.stop(); ctx.close(); }, 120);
    } catch (e) {}
  }

  function cameraHelp(err) {
    const name = (err && (err.name || err.message)) || "";
    const denied = /NotAllowed|Permission|denied/i.test(name);
    const missing = /NotFound|DevicesNotFound|no camera|Requested device/i.test(name);
    const insecure = /secure|HTTPS|getUserMedia|undefined/i.test(name) && !window.isSecureContext;
    let html = '<div class="note help"><b>The camera could not start.</b>';
    if (!window.isSecureContext || insecure) {
      html += "<p>The camera only works on a secure (https) site. Open the live app at the GitHub Pages address, not a plain http page.</p>";
    } else if (denied) {
      html += "<p>Camera permission is blocked. You can still type the barcode or search by name.</p><ol>" +
        "<li>In Chrome on a phone, tap the lock or the camera icon in the address bar.</li>" +
        "<li>Set Camera to Allow.</li>" +
        "<li>Come back to this screen and tap Scan barcode again.</li></ol>";
    } else if (missing) {
      html += "<p>No camera was found on this device. Type the barcode or search by name instead.</p>";
    } else {
      html += "<p>" + esc(err && err.message ? err.message : "Unknown camera error") + ". You can type the barcode or search by name instead.</p>";
    }
    html += "</div>";
    return html;
  }

  /* ---------- routing ---------- */
  function route() {
    const h = (location.hash || "#/scan").replace(/^#/, "");
    const parts = h.split("/").filter(Boolean);
    const page = parts[0] || "scan";
    $$(".tabs button").forEach(function (b) {
      b.setAttribute("aria-current", b.getAttribute("data-go") === page ? "page" : null);
    });
    stopScan();
    if (page === "product" && parts[1]) return renderProduct(parts[1], { refresh: parts[2] === "refresh" });
    if (page === "history") return renderList("history");
    if (page === "favorites") return renderList("favorites");
    if (page === "compare") return renderCompare();
    if (page === "more" || page === "ratings") return renderMore(page === "ratings" || parts[1] === "ratings");
    return renderScan();
  }

  $$(".tabs button").forEach(function (b) {
    b.addEventListener("click", function () { location.hash = "#/" + b.getAttribute("data-go"); });
  });
  window.addEventListener("hashchange", route);
  document.addEventListener("click", function (e) {
    const a = e.target.closest("[data-go]");
    if (a && a.tagName !== "BUTTON" && !a.closest(".tabs")) {
      /* handled by href usually */
    }
  });

  /* ---------- views ---------- */
  function renderScan() {
    main.innerHTML =
      '<div class="hero">' +
        "<h1>Scan a food barcode</h1>" +
        "<p class=\"lead\">Point the rear camera at the barcode. The app looks the product up in Open Food Facts and shows how processed it is, how close it is to its natural state, the healthy and unhealthy things in it, and a rating.</p>" +
        '<button type="button" class="btn xl block" id="startScan">📷  Scan barcode</button>' +
      "</div>" +
      '<div id="scanArea" hidden>' +
        '<div class="scan-stage" id="scanStage">' +
          '<video id="scanVideo" playsinline muted autoplay></video>' +
          '<div id="qr-reader" hidden></div>' +
          '<div class="viewfinder" id="vf"><div class="vf-box"></div></div>' +
          '<div class="scan-msg">Point the camera at the barcode</div>' +
          '<div class="scan-actions">' +
            '<button type="button" class="btn ghost" id="torchBtn" hidden>Light</button>' +
            '<button type="button" class="btn" id="stopScan">Cancel</button>' +
          "</div>" +
        "</div>" +
      "</div>" +
      '<div id="scanHelp"></div>' +
      '<div class="or">or type the barcode</div>' +
      '<form class="card" id="codeForm">' +
        '<div class="field"><label for="codeIn">Barcode number</label>' +
        '<input id="codeIn" inputmode="numeric" autocomplete="off" placeholder="For example 3017620422003"></div>' +
        '<button type="submit" class="btn block">Look up barcode</button>' +
      "</form>" +
      '<div class="or">or search by name</div>' +
      '<form class="card" id="nameForm">' +
        '<div class="field"><label for="nameIn">Product name</label>' +
        '<input id="nameIn" autocomplete="off" placeholder="For example rolled oats"></div>' +
        '<button type="submit" class="btn block ghost">Search Open Food Facts</button>' +
        '<div id="searchOut" class="search-res"></div>' +
      "</form>" +
      recentStrip() +
      '<p class="fine">Informational only. This is not medical advice. Camera use needs your permission and a secure (https) connection.</p>';

    $("#startScan").addEventListener("click", beginScan);
    $("#stopScan").addEventListener("click", function () {
      stopScan();
      $("#scanArea").hidden = true;
    });
    $("#codeForm").addEventListener("submit", function (e) {
      e.preventDefault();
      const v = digits($("#codeIn").value);
      if (!v) return toast("Type a barcode number first.");
      location.hash = "#/product/" + v;
    });
    $("#nameForm").addEventListener("submit", function (e) {
      e.preventDefault();
      runSearch($("#nameIn").value.trim());
    });
    $("#nameIn").addEventListener("input", function () {
      clearTimeout(searchTimer);
      const q = $("#nameIn").value.trim();
      if (q.length < 3) return;
      searchTimer = setTimeout(function () { runSearch(q); }, 500);
    });
  }

  function recentStrip() {
    const list = historyList().slice(0, 5);
    if (!list.length) return "";
    return "<h2>Recent on this device</h2><div class=\"list\">" + list.map(histCard).join("") + "</div>";
  }

  function histCard(it) {
    const img = it.image
      ? '<img src="' + esc(it.image) + '" alt="" width="64" height="64">'
      : '<span class="ph" aria-hidden="true">🍽</span>';
    const score = it.score == null
      ? '<span class="mini-score" style="background:#6b7280">—</span>'
      : '<span class="mini-score" style="background:' + esc(it.color || "#148a3e") + '">' + esc(it.letter || it.score) + "</span>";
    return '<a class="hist" href="#/product/' + esc(it.code) + '">' + img +
      "<span style=\"flex:1;min-width:0\"><b>" + esc(it.name) + "</b><small class=\"muted\">" +
      esc(it.brand || it.code) + "</small></span>" + score + "</a>";
  }

  async function runSearch(q) {
    const box = $("#searchOut");
    if (!box) return;
    if (!q) { box.innerHTML = ""; return; }
    box.innerHTML = '<p class="muted skel">Searching Open Food Facts…</p>';
    try {
      const data = await searchName(q);
      const products = data.products || [];
      if (!products.length) {
        box.innerHTML = '<p class="empty">No products matched “' + esc(q) + '”. Try a shorter name, or type the barcode.</p>';
        return;
      }
      box.innerHTML = products.map(function (p) {
        const code = p.code || p._id || "";
        const name = productName(p);
        const img = productImage(p);
        const photo = img ? '<img src="' + esc(img) + '" alt="" width="64" height="64">' : '<span class="ph">🍽</span>';
        const g = FoodScanRate.nutriGrade(p);
        const nova = FoodScanRate.novaGroup(p);
        const meta = [p.brands || "", g ? "Nutri-Score " + g.toUpperCase() : "", nova ? "NOVA " + nova : ""].filter(Boolean).join(" · ");
        return '<a class="hist" href="#/product/' + esc(code) + '">' + photo +
          "<span style=\"flex:1;min-width:0\"><b>" + esc(name) + "</b><small class=\"muted\">" + esc(meta || code) + "</small></span></a>";
      }).join("");
    } catch (err) {
      box.innerHTML = '<div class="note">Search could not finish. ' + esc(err.message || err) + (navigator.onLine ? "" : " You appear to be offline.") + "</div>";
    }
  }

  async function beginScan() {
    const area = $("#scanArea");
    const help = $("#scanHelp");
    help.innerHTML = "";
    area.hidden = false;
    await stopScan();
    const video = $("#scanVideo");
    const zxingBox = $("#qr-reader");
    const vf = $("#vf");
    const torchBtn = $("#torchBtn");
    torchBtn.hidden = true;

    const onCode = function (raw) {
      const d = digits(raw);
      if (!d || d.length < 6) return;
      beep();
      stopScan();
      location.hash = "#/product/" + d;
    };

    try {
      if (!window.isSecureContext) throw new Error("Camera needs HTTPS.");
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("This browser cannot open the camera.");
      if (hasNativeDetector()) {
        try {
          video.hidden = false;
          zxingBox.hidden = true;
          vf.hidden = false;
          scanCtl = await startNative(video, onCode);
        } catch (e) {
          // native detector present but failed — try library
          video.hidden = true;
          zxingBox.hidden = false;
          vf.hidden = true;
          scanCtl = await startZxing("qr-reader", onCode);
        }
      } else {
        video.hidden = true;
        zxingBox.hidden = false;
        vf.hidden = true;
        scanCtl = await startZxing("qr-reader", onCode);
      }
      // torch
      try {
        const stream = scanCtl.stream || (video.srcObject);
        const track = stream && stream.getVideoTracks && stream.getVideoTracks()[0];
        const caps = track && track.getCapabilities && track.getCapabilities();
        if (caps && caps.torch) {
          torchBtn.hidden = false;
          let on = false;
          torchBtn.onclick = function () {
            on = !on;
            track.applyConstraints({ advanced: [{ torch: on }] }).catch(function () {});
            torchBtn.textContent = on ? "Light off" : "Light";
          };
        }
      } catch (e) {}
    } catch (err) {
      area.hidden = true;
      help.innerHTML = cameraHelp(err);
    }
  }

  async function renderProduct(code, opts) {
    code = digits(code);
    main.innerHTML = '<p class="muted skel">Looking up ' + esc(code) + " in Open Food Facts…</p>";
    const cached = (!opts || !opts.refresh) ? cacheGet(code) : null;
    try {
      let found;
      if (cached && cached.product && Date.now() - cached.savedAt < 7 * 24 * 3600 * 1000) {
        found = { code: code, product: cached.product, fromCache: true };
      } else {
        found = await lookupBarcode(code);
      }
      if (!found.product) {
        main.innerHTML =
          '<a class="back" href="#/scan">← Back to scan</a>' +
          "<h1>Not in Open Food Facts</h1>" +
          "<p>Barcode <b>" + esc(code) + "</b> was not found in the public Open Food Facts database. That database does not have every product. You can search by name, try again later, or add the product on the Open Food Facts website.</p>" +
          '<p><a class="btn" href="https://world.openfoodfacts.org/" target="_blank" rel="noopener">Open Food Facts</a> ' +
          '<a class="btn ghost" href="#/scan">Search by name</a></p>';
        return;
      }
      if (String(found.code) !== String(code)) code = String(found.code);
      remember(found.product, code);
      main.innerHTML = productHTML(found.product, code, found.fromCache);
      wireProduct(found.product, code);
      // refresh in background if we served cache
      if (found.fromCache) {
        lookupBarcode(code).then(function (fresh) {
          if (fresh.product) {
            cachePut(code, fresh.product);
            remember(fresh.product, code);
          }
        }).catch(function () {});
      }
    } catch (err) {
      const cached2 = cacheGet(code);
      if (cached2 && cached2.product) {
        remember(cached2.product, code);
        main.innerHTML = productHTML(cached2.product, code, true) +
          '<div class="note">Live lookup failed (' + esc(err.message || err) + "). Showing the copy saved on this device.</div>";
        wireProduct(cached2.product, code);
        return;
      }
      main.innerHTML =
        '<a class="back" href="#/scan">← Back to scan</a>' +
        "<h1>Could not look this up</h1>" +
        '<div class="note">' + esc(err.message || err) + (navigator.onLine ? "" : " You appear to be offline.") + "</div>" +
        '<a class="btn" href="#/product/' + esc(code) + '/refresh">Try again</a>';
    }
  }

  function productHTML(p, code, fromCache) {
    const r = FoodScanRate.computeRating(p);
    const ing = FoodScanRate.ingredientEntries(p);
    const nat = FoodScanRate.naturalState(p, ing);
    const hi = FoodScanRate.highlights(p, ing, r, nat);
    const sodium = FoodScanRate.sodiumInfo(p);
    const rows = FoodScanRate.nutritionRows(p);
    const nova = FoodScanRate.novaGroup(p);
    const grade = FoodScanRate.nutriGrade(p);
    const img = productImage(p);
    const fav = isFav(code);
    const updated = p.last_modified_t ? new Date(p.last_modified_t * 1000) : (p.last_updated_t ? new Date(p.last_updated_t * 1000) : null);
    const updatedStr = updated && !isNaN(updated) ? updated.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "Not listed";

    const photo = img
      ? '<img class="prod-photo" src="' + esc(img) + '" alt="Package photo of ' + esc(productName(p)) + '">'
      : '<div class="prod-photo ph" aria-hidden="true">🍽</div>';

    let scoreBlock;
    if (r.score == null) {
      scoreBlock = '<div class="card"><b>Overall rating: Not enough data to rate</b><p class="muted">Open Food Facts does not list a Nutri-Score, a NOVA group, additives, or nutrient levels for this product, so the app will not invent a score.</p></div>';
    } else {
      scoreBlock =
        '<div class="card"><div class="score-wrap">' +
          '<div class="ring" style="--p:' + r.score + ";--c:" + esc(r.color) + '"><div class="ring-in"><div class="num">' + r.score + '</div><div class="let">' + esc(r.letter) + "</div></div></div>" +
          '<div class="score-meta"><b>' + esc(r.letter) + " · " + esc(r.label) + "</b>" +
            "<p class=\"muted\" style=\"margin:6px 0 0\">Overall rating " + r.score + " out of 100, from the facts Open Food Facts lists. " +
            '<a href="#/more/ratings">How ratings work</a>.</p></div>' +
          '<div class="breakdown">' + r.parts.map(function (part) {
            return '<div class="bk"><span>' + esc(part.label) + '</span><b>' + Math.round(part.score) + "</b>" +
              '<div class="track"><div class="fill" data-w="' + Math.round(part.score) + '" style="background:' + (part.score >= 70 ? "var(--ok)" : part.score >= 40 ? "var(--gold)" : "var(--bad)") + '"></div></div>' +
              '<span class="fine" style="grid-column:1/-1">' + esc(part.detail) + " · weight " + part.weight + "</span></div>";
          }).join("") + "</div></div></div>";
    }

    const natBlock = (function () {
      if (nat.score == null) {
        return '<div class="card"><h2 style="margin-top:0">Natural state</h2><p>Not listed. ' + esc(nat.text) + "</p></div>";
      }
      return '<div class="card"><h2 style="margin-top:0">How close is it to its natural state?</h2>' +
        '<div class="meter" aria-hidden="true"><span class="knob" data-left="' + nat.score + '"></span></div>' +
        "<p><b>" + nat.score + " out of 100 — " + esc(nat.label) + "</b></p>" +
        "<p>" + esc(nat.text) + '</p><details><summary class="small">How this number was worked out</summary><ol class="small">' +
        nat.steps.map(function (s) { return "<li>" + esc(s.text) + "</li>"; }).join("") +
        "</ol><p class=\"fine\">This is the app's own meter, explained on the <a href=\"#/more/ratings\">How ratings work</a> page. It is not a government label.</p></details></div>";
    })();

    const novaBlock = (function () {
      if (!nova) return '<div class="card"><h2 style="margin-top:0">How processed is it?</h2><p>Not listed. Open Food Facts does not give a NOVA group for this product.</p></div>';
      const info = FoodScanRate.NOVA[nova];
      return '<div class="card"><h2 style="margin-top:0">How processed is it?</h2>' +
        '<div class="nova" data-n="' + nova + '" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
        "<p><b>NOVA group " + nova + " of 4 — " + esc(info.title) + "</b></p>" +
        "<p>" + esc(info.short) + ". " + esc(info.text) + "</p>" +
        '<p class="fine">NOVA is a public research classification used by Open Food Facts. The group comes from their database, not from this app.</p></div>';
    })();

    const sodiumBlock = (function () {
      const cls = "card sodium" + (sodium.high ? " high" : "");
      let body = "<h2 style=\"margin-top:0\">Sodium and blood pressure</h2>";
      if (!sodium.listed) {
        body += "<p>Sodium: Not listed. Open Food Facts does not have a sodium or salt amount for this product.</p>";
      } else {
        body += "<p>The American Heart Association suggests no more than <b>2,300 mg</b> of sodium a day, and an ideal limit of <b>1,500 mg</b> a day for most adults, especially people with high blood pressure.</p>";
        body += "<ul>";
        body += "<li>Per 100 g: <b>" + FoodScanRate.fmtMg(sodium.per100) + "</b>" +
          (sodium.pct1500_100 != null ? " — " + sodium.pct1500_100 + "% of 1,500 mg, " + sodium.pct2300_100 + "% of 2,300 mg" : "") + "</li>";
        body += "<li>Per serving" + (sodium.serving ? " (" + esc(sodium.serving) + ")" : "") + ": <b>" + FoodScanRate.fmtMg(sodium.perServing) + "</b>" +
          (sodium.pct1500_s != null ? " — " + sodium.pct1500_s + "% of 1,500 mg, " + sodium.pct2300_s + "% of 2,300 mg" : "") + "</li>";
        body += "<li>Open Food Facts salt level: <b>" + (sodium.level ? esc(sodium.level) : "Not listed") + "</b></li></ul>";
        if (sodium.high) body += '<p class="badnote">This product is high in sodium relative to those daily amounts, or Open Food Facts marks its salt as high. That matters if you are watching blood pressure.</p>';
        else if (sodium.moderate) body += '<p class="note">Sodium is in a moderate range. It still counts toward the daily amount.</p>';
        else body += '<p class="good">Sodium is listed in a low range for this product.</p>';
      }
      if (sodium.unusual && sodium.unusual.length) {
        body += '<div class="note"><b>This number looks unusual.</b> Open Food Facts sometimes has data errors. ' +
          sodium.unusual.map(esc).join(" ") + " Treat the figure with caution and check the package if you can.</div>";
      }
      body += '<p class="fine">Informational only. This is not medical advice. Talk with your doctor about what is right for you.</p>';
      return '<div class="' + cls + '">' + body + "</div>";
    })();

    function listBlock(title, items, empty, kind) {
      let html = "<h2>" + esc(title) + "</h2>";
      if (!items.length) html += "<p class=\"muted\">" + esc(empty) + "</p>";
      else html += '<div class="item-list">' + items.map(function (it) {
        return '<div class="item ' + kind + '"><b>' + esc(it.title) + "</b><span>" + esc(it.text) + "</span></div>";
      }).join("") + "</div>";
      return html;
    }

    const facts = "<h2>Nutrition facts</h2><p class=\"fine\">Amounts as listed by Open Food Facts. “Not listed” means the database does not have that number.</p>" +
      '<div class="card" style="overflow:auto"><table class="facts"><thead><tr><th>Nutrient</th><th>Per 100 g</th><th>Per serving' +
      (p.serving_size ? " (" + esc(p.serving_size) + ")" : "") + "</th></tr></thead><tbody>" +
      rows.map(function (row) {
        return "<tr><th>" + esc(row.label) + "</th><td>" + esc(row.per100) + "</td><td>" + esc(row.serving) + "</td></tr>";
      }).join("") + "</tbody></table>" +
      (p.quantity ? "<p class=\"fine\">Package size listed: " + esc(p.quantity) + "</p>" : "") +
      (grade ? "<p>Official Nutri-Score: <b>" + grade.toUpperCase() + "</b> (from Open Food Facts).</p>" : "<p>Official Nutri-Score: Not listed.</p>") +
      "</div>";

    const ingBlock = (function () {
      let html = "<h2>Each ingredient, rated</h2>";
      if (!ing.items.length) {
        html += "<p>Not listed. Open Food Facts does not have an ingredient list for this product.</p>";
        return html;
      }
      const langNote = (ing.sourceLang && ing.sourceLang !== "en" && ing.sourceText)
        ? '<p class="note">The most complete ingredient list in the database was in ' + esc(langNoteName(ing.sourceLang)) + ". It is shown as listed, and matched to the app's English reference where possible.</p>"
        : "";
      html += langNote;
      if (ing.sourceText) html += '<p class="small muted">As listed: ' + esc(ing.sourceText) + "</p>";
      html += '<div class="item-list">' + ing.items.map(function (it) {
        const badge = it.rating === "unknown" ? "Not rated" : it.rating;
        return '<div class="item ' + esc(it.rating) + '"><b>' + esc(it.text) +
          ' <span class="badge ' + esc(it.rating) + '">' + esc(badge) + "</span></b><span>" + esc(it.reason) +
          (it.caution ? " Flagged for extra caution." : "") + "</span></div>";
      }).join("") + "</div>";
      return html;
    })();

    const adds = FoodScanRate.additivesList(p);
    let addBlock = "<h2>Additives</h2>";
    if (adds.n == null && !adds.tags.length) addBlock += "<p>Not listed.</p>";
    else if ((adds.n === 0 || !adds.tags.length) && adds.n === 0) addBlock += "<p>No additives are listed for this product.</p>";
    else {
      addBlock += "<p>" + (adds.n != null ? adds.n + " additive" + (adds.n === 1 ? "" : "s") + " listed." : "") + "</p><div class=\"item-list\">";
      addBlock += (adds.tags.length ? adds.tags : []).map(function (t) {
        const rec = FoodScanRef.lookup(t);
        const label = rec ? rec.name : t.replace(/^..:/, "");
        const rating = rec ? rec.rating : "unknown";
        const reason = rec ? rec.reason : "This additive is not in the app's reference list.";
        return '<div class="item ' + rating + '"><b>' + esc(label) + ' <span class="badge ' + rating + '">' +
          (rec ? rec.rating : "Not rated") + "</span></b><span>" + esc(reason) + "</span></div>";
      }).join("") + "</div>";
    }

    return '<a class="back" href="#/scan">← Back to scan</a>' +
      '<div class="card"><div class="prod-head">' + photo + "<div style=\"min-width:0;flex:1\">" +
        "<h1>" + esc(productName(p)) + "</h1>" +
        '<p class="muted" style="margin:0">' + esc(p.brands || "Brand: Not listed") + "<br>Barcode " + esc(code) +
        (p.quantity ? " · " + esc(p.quantity) : "") + "</p></div></div>" +
        '<div class="row" style="margin-top:12px">' +
          '<button type="button" class="btn ' + (fav ? "gold" : "ghost") + ' small" id="favBtn">' + (fav ? "★ Favorited" : "☆ Favorite") + "</button>" +
          '<button type="button" class="btn ghost small" id="cmpBtn">Add to compare</button>' +
          '<a class="btn ghost small" href="' + OFF_PAGE + enc(code) + '" target="_blank" rel="noopener">Open Food Facts ↗</a>' +
        "</div></div>" +
      scoreBlock + natBlock + novaBlock + sodiumBlock +
      listBlock("Healthy things in it", hi.good, "No clear positives were found from the listed facts. That does not always mean the product is unhealthy — some fields may be missing.", "good") +
      listBlock("Unhealthy or more processed things in it", hi.bad, "No clear warnings were found from the listed facts. Some fields may be missing.", "poor") +
      facts + ingBlock + addBlock +
      '<div class="card"><h2 style="margin-top:0">About this data</h2>' +
        "<p>Source: <a href=\"" + OFF_PAGE + enc(code) + "\" target=\"_blank\" rel=\"noopener\">Open Food Facts</a>, a public database. Last change listed there: " + esc(updatedStr) +
        (fromCache ? " (a copy saved on this device was shown first)." : ".") + "</p>" +
        "<p>Numbers are taken from that database. They are never invented here. If a field is missing, this app says “Not listed.” Listings can be incomplete or wrong. Check the package when you can.</p>" +
        "<p class=\"fine\">Informational only. This is not medical advice, and it is not a diagnosis or a diet plan. Talk with your doctor about what is right for you.</p>" +
        '<button type="button" class="btn ghost small" id="refreshBtn">Refresh from Open Food Facts</button>' +
      "</div>";
  }

  function langNoteName(lang) {
    const map = { fr: "French", es: "Spanish", de: "German", it: "Italian", pt: "Portuguese", nl: "Dutch", pl: "Polish", ar: "Arabic" };
    return map[String(lang).slice(0, 2)] || lang || "another language";
  }
  function enc(s) { return encodeURIComponent(s); }

  function wireProduct(product, code) {
    const favBtn = $("#favBtn");
    if (favBtn) favBtn.addEventListener("click", function () {
      const on = toggleFav(product, code);
      favBtn.textContent = on ? "★ Favorited" : "☆ Favorite";
      favBtn.className = "btn " + (on ? "gold" : "ghost") + " small";
    });
    const cmpBtn = $("#cmpBtn");
    if (cmpBtn) cmpBtn.addEventListener("click", function () { addCompare(code); });
    const refreshBtn = $("#refreshBtn");
    if (refreshBtn) refreshBtn.addEventListener("click", function () { location.hash = "#/product/" + code + "/refresh"; route(); });
    requestAnimationFrame(function () {
      $$(".fill[data-w]").forEach(function (el) { el.style.width = el.getAttribute("data-w") + "%"; });
      $$(".knob[data-left]").forEach(function (el) { el.style.left = el.getAttribute("data-left") + "%"; });
    });
  }

  function renderList(kind) {
    const fav = kind === "favorites";
    const list = fav ? favList() : historyList();
    main.innerHTML = "<h1>" + (fav ? "Favorites" : "History") + "</h1>" +
      "<p class=\"lead\">" + (fav ? "Products you starred." : "Products you have scanned or looked up.") +
      " Saved only on this device. They are not uploaded anywhere.</p>" +
      (list.length ? '<div class="list">' + list.map(histCard).join("") + "</div>" +
        '<p><button type="button" class="btn danger small" id="clearList">Clear ' + (fav ? "favorites" : "history") + "</button></p>"
        : '<div class="empty">' + (fav ? "No favorites yet. Open a product and tap Favorite." : "No scans yet. Scan a barcode or type a number on the Scan tab.") + "</div>");
    const btn = $("#clearList");
    if (btn) btn.addEventListener("click", function () {
      if (!confirm("Clear " + (fav ? "favorites" : "history") + " on this device?")) return;
      save(fav ? KEYS.fav : KEYS.hist, []);
      renderList(kind);
    });
  }

  function renderCompare() {
    const codes = compareList();
    main.innerHTML = "<h1>Compare two products</h1>" +
      "<p class=\"lead\">Pick two products from history or favorites, or look one up. The comparison uses the same Open Food Facts data and the same rating formula.</p>" +
      '<div class="row">' +
        '<input id="cmpCode" inputmode="numeric" placeholder="Add a barcode" style="flex:1;min-width:140px">' +
        '<button type="button" class="btn" id="cmpAdd">Add</button>' +
        (codes.length ? '<button type="button" class="btn danger ghost small" id="cmpClear">Clear</button>' : "") +
      "</div>" +
      picker("From history", historyList()) +
      picker("From favorites", favList()) +
      '<div id="cmpOut" class="compare' + (codes.length === 2 ? " two" : "") + '"><p class="muted skel">Loading…</p></div>';

    function picker(label, list) {
      if (!list.length) return "";
      return "<h2>" + label + "</h2><div class=\"list\">" + list.slice(0, 12).map(function (it) {
        const on = codes.indexOf(it.code) >= 0;
        return '<button type="button" class="hist" data-add="' + esc(it.code) + '">' +
          (it.image ? '<img src="' + esc(it.image) + '" alt="">' : '<span class="ph">🍽</span>') +
          "<span style=\"flex:1;min-width:0\"><b>" + esc(it.name) + "</b><small class=\"muted\">" + esc(it.brand || it.code) +
          (on ? " · selected" : "") + "</small></span></button>";
      }).join("") + "</div>";
    }

    $("#cmpAdd").addEventListener("click", function () {
      const v = digits($("#cmpCode").value);
      if (!v) return toast("Type a barcode first.");
      addCompare(v);
      renderCompare();
    });
    const clr = $("#cmpClear");
    if (clr) clr.addEventListener("click", function () { save(KEYS.compare, []); renderCompare(); });
    $$("[data-add]").forEach(function (b) {
      b.addEventListener("click", function () { addCompare(b.getAttribute("data-add")); renderCompare(); });
    });
    fillCompare(codes);
  }

  async function fillCompare(codes) {
    const box = $("#cmpOut");
    if (!box) return;
    if (codes.length < 2) {
      box.innerHTML = '<p class="empty">Select two products to compare them side by side.</p>';
      return;
    }
    const pair = codes.slice(-2);
    try {
      const results = [];
      for (let i = 0; i < pair.length; i++) {
        const cached = cacheGet(pair[i]);
        if (cached && cached.product) results.push({ code: pair[i], product: cached.product });
        else {
          const found = await lookupBarcode(pair[i]);
          if (!found.product) results.push({ code: pair[i], product: null });
          else { remember(found.product, found.code); results.push(found); }
        }
      }
      box.innerHTML = results.map(function (r) {
        if (!r.product) return '<div class="card"><h2>Barcode ' + esc(r.code) + '</h2><p>Not listed in Open Food Facts.</p></div>';
        const p = r.product;
        const rating = FoodScanRate.computeRating(p);
        const ing = FoodScanRate.ingredientEntries(p);
        const nat = FoodScanRate.naturalState(p, ing);
        const sod = FoodScanRate.sodiumInfo(p);
        const n = p.nutriments || {};
        const nova = FoodScanRate.novaGroup(p);
        const grade = FoodScanRate.nutriGrade(p);
        const img = productImage(p);
        return '<div class="card">' +
          (img ? '<img class="prod-photo" src="' + esc(img) + '" alt="">' : "") +
          "<h2><a href=\"#/product/" + esc(r.code) + "\">" + esc(productName(p)) + "</a></h2>" +
          '<p class="muted">' + esc(p.brands || "Brand: Not listed") + "</p>" +
          '<div class="kvs">' +
            kv("Overall rating", rating.score == null ? "Not enough data" : (rating.score + " · " + rating.letter + " · " + rating.label)) +
            kv("Nutri-Score", grade ? grade.toUpperCase() : "Not listed") +
            kv("NOVA processing", nova ? ("Group " + nova + " — " + FoodScanRate.NOVA[nova].title) : "Not listed") +
            kv("Natural state", nat.score == null ? "Not listed" : (nat.score + " — " + nat.label)) +
            kv("Sugars / 100 g", FoodScanRate.fmtG(n.sugars_100g)) +
            kv("Fiber / 100 g", FoodScanRate.fmtG(n.fiber_100g != null ? n.fiber_100g : n.fibre_100g)) +
            kv("Protein / 100 g", FoodScanRate.fmtG(n.proteins_100g)) +
            kv("Saturated fat / 100 g", FoodScanRate.fmtG(n["saturated-fat_100g"])) +
            kv("Sodium / 100 g", FoodScanRate.fmtMg(sod.per100)) +
            kv("Sodium / serving", FoodScanRate.fmtMg(sod.perServing) + (sod.serving ? " (" + sod.serving + ")" : "")) +
            kv("Salt level", (p.nutrient_levels && p.nutrient_levels.salt) || "Not listed") +
            kv("Additives", FoodScanRate.additivesList(p).n == null ? "Not listed" : String(FoodScanRate.additivesList(p).n)) +
          "</div></div>";
      }).join("");
    } catch (err) {
      box.innerHTML = '<div class="note">Could not load one of the products. ' + esc(err.message || err) + "</div>";
    }
    function kv(k, v) { return "<div><span>" + esc(k) + "</span><b>" + esc(v) + "</b></div>"; }
  }

  function renderMore(openRatings) {
    main.innerHTML =
      "<h1>More</h1>" +
      '<div class="card" id="ratings">' +
        "<h2 style=\"margin-top:0\">How ratings work</h2>" +
        "<p>The overall score is a number from 0 to 100, with a letter:</p>" +
        "<ul>" +
          "<li><b>A 85–100</b> Excellent</li>" +
          "<li><b>B 70–84</b> Good</li>" +
          "<li><b>C 55–69</b> Fair</li>" +
          "<li><b>D 40–54</b> Poor</li>" +
          "<li><b>F 0–39</b> Low</li>" +
        "</ul>" +
        "<p>The score is a weighted average of up to four parts. If a part is missing, its weight is given to the parts that are present. If none of the four parts is available, the app says “Not enough data to rate” and does not invent a number.</p>" +
        '<div class="formula"><b>Score =</b> (Nutri-Score × 35 + NOVA × 30 + Additives × 15 + Nutrient levels × 20) ÷ the weights that were actually used.</div>' +
        "<h3>1. Nutri-Score — weight 35</h3>" +
        "<p>This is the official letter already computed by Open Food Facts (A is most favorable, E is least). The app does not recompute Nutri-Score. Points: A = 100, B = 80, C = 55, D = 30, E = 10. If no grade is listed, this part is skipped.</p>" +
        "<h3>2. Processing (NOVA) — weight 30</h3>" +
        "<p>NOVA is a public research classification. Group 1 = 100, group 2 = 70, group 3 = 40, group 4 = 10. The group comes from Open Food Facts.</p>" +
        "<ul>" +
          "<li><b>Group 1</b> — Unprocessed or minimally processed (closest to the natural state).</li>" +
          "<li><b>Group 2</b> — Processed culinary ingredients (oils, sugar, salt, starches).</li>" +
          "<li><b>Group 3</b> — Processed foods (a real food plus salt, sugar, or oil).</li>" +
          "<li><b>Group 4</b> — Ultra-processed (industrial products, often with many additives).</li>" +
        "</ul>" +
        "<h3>3. Additives — weight 15</h3>" +
        "<p>Starts at 100. Each listed additive takes off 8 points. Additives the app flags for extra caution (for example nitrites in processed meat, certain synthetic dyes that carry an EU attention warning, and the preservatives BHA, BHT, and TBHQ) take off 10 more each. The floor is 0. If additive data is not listed, this part is skipped.</p>" +
        "<h3>4. Nutrient levels — weight 20</h3>" +
        "<p>Open Food Facts marks sugars, salt, saturated fat, and fat as low, moderate, or high, using official European thresholds. Low = 100, moderate = 50, high = 0. The four marks that are present are averaged. If none is listed, this part is skipped.</p>" +
        "<h3>Natural state meter</h3>" +
        "<p>This is a separate 0–100 figure for how close the product is to a whole, original food. It is not a government label. It starts from the NOVA group (group 1 starts at 95, group 2 at 65, group 3 at 40, group 4 at 15). Then:</p>" +
        "<ul>" +
          "<li>One ingredient: +5. Four to eight ingredients: −5. Nine to fifteen: −12. Sixteen or more: −20.</li>" +
          "<li>Each additive: −4. Each caution-flagged additive: 6 more points off.</li>" +
          "<li>Each ingredient rated poor (added sugar, refined flour, hydrogenated fat, and similar): −4, up to −16.</li>" +
          "<li>If every listed ingredient rates good and no additives are listed: +5.</li>" +
        "</ul>" +
        "<p>The result is kept between 0 and 100. Each product page shows the steps used for that product. If there is no NOVA group and no usable ingredient list, the meter says “Not listed.”</p>" +
        "<h3>Ingredient ratings</h3>" +
        "<p>Each listed ingredient is matched against a built-in reference list of common foods and additives. A match is marked <b>good</b>, <b>moderate</b>, or <b>poor</b>, with a short reason in plain English. Anything not in the list is marked <b>Not rated</b>. The app never fills in a missing ingredient.</p>" +
        "<h3>Sodium and blood pressure</h3>" +
        "<p>Sodium is shown per 100 g and per serving, in milligrams, and as a percentage of 1,500 mg and 2,300 mg a day. Those daily amounts come from the American Heart Association: no more than 2,300 mg a day, and an ideal limit of 1,500 mg a day for most adults, especially people with high blood pressure. Open Food Facts stores sodium in grams; the app multiplies by 1,000 to display milligrams. If a figure looks impossible (for example more than 100 g of salt in 100 g of food, or a very high salt amount in a drink), the app warns that the database may have an error and does not change the number.</p>" +
      "</div>" +
      '<div class="card">' +
        "<h2 style=\"margin-top:0\">About Food Scanner</h2>" +
        "<p>Product facts come from <a href=\"https://world.openfoodfacts.org/\" target=\"_blank\" rel=\"noopener\">Open Food Facts</a>, a public, crowd-sourced database (Open Database License). Photos are shown from that project. Please treat package labels as the final word when they disagree.</p>" +
        "<p>Barcode scanning uses the browser’s built-in Barcode Detector when the phone supports it, and otherwise a copy of the html5-qrcode library (Apache License 2.0) that is stored in this app, not loaded from another website.</p>" +
        "<p>History and favorites stay in this browser on this device (<code>localStorage</code>). They are not sent to a server run by this app.</p>" +
        "<p>Informational only. This is not medical advice. The app does not tell you what to eat, and it does not replace a doctor, a dietitian, or the label on the package.</p>" +
        '<p><button type="button" class="btn danger small" id="wipe">Clear history, favorites, and saved products on this device</button></p>' +
      "</div>";
    const wipe = $("#wipe");
    if (wipe) wipe.addEventListener("click", function () {
      if (!confirm("Clear history, favorites, compare picks, and saved product copies on this device?")) return;
      [KEYS.hist, KEYS.fav, KEYS.compare, KEYS.cache].forEach(function (k) {
        try { localStorage.removeItem(k); } catch (e) {}
      });
      toast("Cleared from this device");
    });
    if (openRatings) {
      const el = $("#ratings");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  route();
})();
