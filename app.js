/* ==========================================================================
   טועמיה – app.js
   Menu windows, search, language switch, accessibility menu, WhatsApp/call
   links and the "what's special this week" drawer. Works together with
   main.js (hero tear, flying logo, nav drawer) and menu-data.js.
   ========================================================================== */

/* ---------------------------- Settings ---------------------------------- */
var TOAMEYA_CONFIG = {
  phone: "972587130405",
  whatsappText: "היי שלום אני הגעתי מהאתר והתעניינתי בתפריט",
  whatsappTextEnglishSuffix: " ואני דובר אנגלית",
  // "What's special this week": a Google Sheet published as CSV
  // (File → Share → Publish to web → CSV). Paste the link between the quotes.
  // Row 1 = headers, row 2 = this week: A = כותרת, B = תיאור, C = Title (EN), D = Description (EN).
  specialSheetCsvUrl: ""
};

(function () {
  "use strict";

  var root = document.documentElement;
  var I18N = window.TOAMEYA_I18N || { he: {}, en: {} };
  var MENU = window.TOAMEYA_MENU || [];
  var MENUS = ["food", "salads", "extras"];
  var FOOD_SECTIONS = ["parve", "meat", "fish"];

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }
  function lang() {
    return root.lang === "en" ? "en" : "he";
  }
  function t(key) {
    var dict = I18N[lang()] || {};
    return dict[key] != null ? dict[key] : (I18N.he[key] != null ? I18N.he[key] : key);
  }
  function motionOff() {
    return root.classList.contains("a11y-motion") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ============================ Language ============================== */

  function applyI18n() {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      el.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
        var parts = pair.split(":");
        if (parts.length === 2) el.setAttribute(parts[0].trim(), t(parts[1].trim()));
      });
    });
    document.querySelectorAll("[data-lang-toggle]").forEach(function (btn) {
      var isShort = btn.classList.contains("nav-lang-btn");
      btn.textContent = isShort ? t("langToggleShort") : t("langToggle");
      btn.setAttribute("lang", lang() === "he" ? "en" : "he");
      btn.setAttribute("aria-label", t("langToggleAria"));
    });
    document.title = lang() === "en"
      ? "Toameya | Jewish homestyle deli & restaurant, Haifa"
      : "טועמיה | מעדנייה ומסעדה – טעם של בית יהודי, חיפה";
    updateWhatsappLinks();
    updateSpecial();
  }

  function setLang(next) {
    root.lang = next;
    root.dir = next === "en" ? "ltr" : "rtl";
    storageSet("toameya-lang", next);
    applyI18n();
    if (currentMenu) renderMenu(currentMenu);
    if (!searchDialog.hidden) runSearch();
    // Logo positions differ per language – let main.js re-measure.
    window.dispatchEvent(new CustomEvent("toameya:layoutchange"));
  }

  document.querySelectorAll("[data-lang-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setLang(lang() === "he" ? "en" : "he");
    });
  });

  /* ======================== WhatsApp & phone ========================== */

  function updateWhatsappLinks() {
    var text = TOAMEYA_CONFIG.whatsappText +
      (lang() === "en" ? TOAMEYA_CONFIG.whatsappTextEnglishSuffix : "");
    var href = "https://wa.me/" + TOAMEYA_CONFIG.phone + "?text=" + encodeURIComponent(text);
    document.querySelectorAll("[data-whatsapp]").forEach(function (a) {
      a.setAttribute("href", href);
    });
  }

  // Inside an embedded viewer (such as the Claude preview link) the browser
  // may block tel: links. There we also try opening the dialer in a new
  // window, copy the number and show it, so the visitor can always call.
  // On the real, stand-alone site this changes nothing.
  var inFrame = false;
  try { inFrame = window.self !== window.top; } catch (e) { inFrame = true; }
  var toast = null, toastTimer = null;
  function showToast(text) {
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("is-shown"); }, 4500);
  }
  if (inFrame) {
    document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener");
    });
    document.addEventListener("click", function (e) {
      var a = e.target.closest('a[href^="tel:"]');
      if (!a) return;
      var number = "058-7130405";
      var msg = t("callFallback").replace("{n}", number);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(number).then(function () {
            showToast(msg + " " + t("copied"));
          }, function () { showToast(msg); });
          return;
        }
      } catch (err) {}
      showToast(msg);
    });
  }

  /* ======================= Special of the week ======================== */

  var special = { he: null, en: null };
  var specialBtn = document.getElementById("specialBtn");

  function updateSpecial() {
    if (!specialBtn) return;
    var data = special[lang()] || special.he;
    specialBtn.dataset.title = (data && data.title) || t("specialTitle");
    specialBtn.dataset.body = (data && data.body) || t("specialFallback");
  }

  function parseCsvRow(line) {
    var out = [], cur = "", quoted = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (quoted) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') quoted = false;
        else cur += c;
      } else if (c === '"') quoted = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out;
  }

  if (TOAMEYA_CONFIG.specialSheetCsvUrl && window.fetch) {
    fetch(TOAMEYA_CONFIG.specialSheetCsvUrl, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.text() : ""; })
      .then(function (csv) {
        var lines = csv.split(/\r?\n/).filter(function (l) { return l.trim(); });
        if (lines.length < 2) return;
        var row = parseCsvRow(lines[1]);
        if (row[0] || row[1]) special.he = { title: row[0], body: row[1] };
        if (row[2] || row[3]) special.en = { title: row[2], body: row[3] };
        updateSpecial();
      })
      .catch(function () {});
  }

  /* =========================== Menu window ============================ */

  var modal = document.getElementById("menuModal");
  var panel = document.getElementById("menuPanel");
  var body = document.getElementById("menuBody");
  var closeBtn = document.getElementById("menuClose");
  var titleEl = document.getElementById("menuModalTitle");
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".menu-tabs__tab"));
  var currentMenu = null;
  var openedViaHistory = false;
  var lastTrigger = null;
  var originRect = null;
  var pendingFocusId = null;

  function itemName(item) {
    return lang() === "en" ? item.en : item.he;
  }

  function priceHtml(item) {
    var p = item.price || {};
    var parts = [];
    ["quarter", "half", "liter"].forEach(function (k) {
      if (p[k] != null && p[k] !== "") {
        parts.push('<span class="dish__price"><span class="dish__qty">' + escapeHtml(t("price_" + k)) +
          '</span> <bdi>' + escapeHtml(t("currency")) + escapeHtml(p[k]) + "</bdi></span>");
      }
    });
    return parts.length ? '<p class="dish__prices">' + parts.join("") + "</p>" : "";
  }

  function cardHtml(item) {
    var name = escapeHtml(itemName(item));
    return '<li class="dish" id="dish-' + escapeHtml(item.id) + '">' +
      '<div class="dish__media"><img src="' + escapeHtml(item.img) + '" alt="' + name +
      '" width="800" height="600" loading="lazy" decoding="async" /></div>' +
      '<div class="dish__text"><h4 class="dish__name">' + name + "</h4>" + priceHtml(item) + "</div></li>";
  }

  function gridHtml(items) {
    return '<ul class="dish-grid" role="list">' + items.map(cardHtml).join("") + "</ul>";
  }

  function renderMenu(menu) {
    var items = MENU.filter(function (i) { return i.menu === menu; });
    var html = "";
    if (menu === "food") {
      html += '<nav class="menu-sections" aria-label="' + escapeHtml(t("sectionsAria")) + '">';
      FOOD_SECTIONS.forEach(function (s) {
        html += '<a class="menu-sections__chip" href="#sec-' + s + '" data-section-link="' + s + '">' + escapeHtml(t("section_" + s)) + "</a>";
      });
      html += "</nav>";
      FOOD_SECTIONS.forEach(function (s) {
        var group = items.filter(function (i) { return i.section === s; });
        html += '<section class="menu-section" id="sec-' + s + '" aria-labelledby="sec-title-' + s + '">' +
          '<h3 class="menu-section__title" id="sec-title-' + s + '">' + escapeHtml(t("section_" + s)) + "</h3>" +
          gridHtml(group) + "</section>";
      });
    } else {
      html += '<section class="menu-section"><h3 class="menu-section__title">' + escapeHtml(t("menu_" + menu)) + "</h3>" +
        gridHtml(items) + "</section>";
    }
    body.innerHTML = html;
    titleEl.textContent = t("menu_" + menu);
    tabs.forEach(function (tab) {
      var on = tab.dataset.tab === menu;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
    });
    body.setAttribute("aria-labelledby", "tab-" + menu);
    requestAnimationFrame(updateSectionSpy);
  }

  // Scroll-spy: while scrolling the food window, the chip of the section
  // you're in (parve / meat / fish) lights up like the active top tab.
  var spyTicking = false;
  function updateSectionSpy() {
    spyTicking = false;
    var chips = body.querySelectorAll("[data-section-link]");
    if (!chips.length) return;
    var sections = body.querySelectorAll(".menu-section[id^='sec-']");
    var nav = body.querySelector(".menu-sections");
    var offset = (nav ? nav.offsetHeight : 0) + 24;
    var current = sections[0] ? sections[0].id : null;
    sections.forEach(function (sec) {
      if (sec.offsetTop - offset <= body.scrollTop) current = sec.id;
    });
    // At the very bottom, the last section is the one being read.
    if (body.scrollTop + body.clientHeight >= body.scrollHeight - 4 && sections.length) {
      current = sections[sections.length - 1].id;
    }
    chips.forEach(function (chip) {
      var on = "sec-" + chip.dataset.sectionLink === current;
      chip.classList.toggle("is-active", on);
      if (on) chip.setAttribute("aria-current", "true");
      else chip.removeAttribute("aria-current");
    });
  }
  body.addEventListener("scroll", function () {
    if (!spyTicking) { spyTicking = true; requestAnimationFrame(updateSectionSpy); }
  }, { passive: true });

  // In-window section chips scroll inside the window instead of changing the
  // page address (which would close the menu).
  body.addEventListener("click", function (e) {
    var link = e.target.closest("[data-section-link]");
    if (!link) return;
    e.preventDefault();
    var target = document.getElementById("sec-" + link.dataset.sectionLink);
    if (target) {
      var navEl = body.querySelector(".menu-sections");
      body.scrollTo({ top: target.offsetTop - (navEl ? navEl.offsetHeight : 0) - 8, behavior: motionOff() ? "auto" : "smooth" });
      var heading = target.querySelector(".menu-section__title");
      if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: true }); }
    }
  });

  function insetFromRect(r) {
    var vw = window.innerWidth, vh = window.innerHeight;
    return "inset(" + Math.max(r.top, 0) + "px " + Math.max(vw - r.right, 0) + "px " +
      Math.max(vh - r.bottom, 0) + "px " + Math.max(r.left, 0) + "px round 20px)";
  }

  function focusables() {
    return Array.prototype.slice.call(panel.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(function (el) { return el.offsetParent !== null; });
  }

  function onModalKeydown(e) {
    if (e.key === "Escape") { e.preventDefault(); requestClose(); return; }
    if (e.key === "Tab") {
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function openMenu(menu, animate) {
    var wasOpen = !!currentMenu;
    currentMenu = menu;
    renderMenu(menu);
    if (wasOpen) {
      body.scrollTop = 0;
      afterRender();
      return;
    }
    if (!lastTrigger) lastTrigger = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("no-scroll", "menu-is-open");
    document.addEventListener("keydown", onModalKeydown);
    body.scrollTop = 0;

    if (animate && originRect && !motionOff()) {
      panel.style.transition = "none";
      panel.style.clipPath = insetFromRect(originRect);
      panel.getBoundingClientRect(); // commit the start state
      panel.style.transition = "";
      requestAnimationFrame(function () {
        modal.classList.add("is-open");
        panel.style.clipPath = "inset(0px 0px 0px 0px round 0px)";
      });
    } else {
      panel.style.clipPath = "";
      requestAnimationFrame(function () { modal.classList.add("is-open"); });
    }
    afterRender();
  }

  function afterRender() {
    if (pendingFocusId) {
      var el = document.getElementById("dish-" + pendingFocusId);
      pendingFocusId = null;
      if (el) {
        setTimeout(function () {
          body.scrollTo({ top: el.offsetTop - 90, behavior: "auto" });
          el.classList.add("is-highlighted");
          el.setAttribute("tabindex", "-1");
          el.focus({ preventScroll: true });
          setTimeout(function () { el.classList.remove("is-highlighted"); }, 2200);
        }, 60);
        return;
      }
    }
    var active = tabs.filter(function (tab) { return tab.dataset.tab === currentMenu; })[0];
    setTimeout(function () { (active || closeBtn).focus({ preventScroll: true }); }, 30);
  }

  function closeMenu() {
    if (!currentMenu) return;
    currentMenu = null;
    document.removeEventListener("keydown", onModalKeydown);
    var shrinkBack = originRect && !motionOff();
    if (!shrinkBack) modal.classList.remove("is-open");
    var done = function () {
      modal.classList.remove("is-open");
      modal.hidden = true;
      panel.style.clipPath = "";
      document.body.classList.remove("no-scroll", "menu-is-open");
      if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus({ preventScroll: true });
      lastTrigger = null;
      originRect = null;
    };
    if (shrinkBack) {
      // Shrink back into the card it came from (re-measured: the page may
      // have been resized while the window was open).
      if (lastTrigger && document.contains(lastTrigger) && lastTrigger.getClientRects().length) {
        originRect = lastTrigger.getBoundingClientRect();
      }
      panel.style.clipPath = insetFromRect(originRect);
      setTimeout(done, 520);
    } else {
      setTimeout(done, motionOff() ? 0 : 260);
    }
  }

  // Closing goes through browser history when the window was opened by a
  // click, so the phone's "back" button and the × behave the same way.
  function requestClose() {
    if (openedViaHistory) {
      openedViaHistory = false;
      history.back();
    } else {
      history.replaceState(null, "", location.pathname + location.search);
      closeMenu();
    }
  }

  function hashMenu() {
    var h = location.hash.replace("#", "");
    return MENUS.indexOf(h) !== -1 ? h : null;
  }

  window.addEventListener("hashchange", function () {
    var m = hashMenu();
    if (m) {
      if (!currentMenu) openedViaHistory = true;
      openMenu(m, true);
    } else if (currentMenu) {
      openedViaHistory = false;
      closeMenu();
    }
  });

  // Anything that links to #food / #salads / #extras opens the window,
  // growing it out of the element that was clicked.
  document.addEventListener("click", function (e) {
    var link = e.target.closest('a[href="#food"], a[href="#salads"], a[href="#extras"]');
    if (!link || modal.contains(link)) return;
    var menu = link.getAttribute("href").slice(1);
    lastTrigger = link;
    originRect = link.getBoundingClientRect();
    if (originRect.width < 40) originRect = null;
    if (hashMenu() === menu) { e.preventDefault(); openMenu(menu, true); }
  });

  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () {
      if (tab.dataset.tab === currentMenu) return;
      history.replaceState(null, "", "#" + tab.dataset.tab);
      openMenu(tab.dataset.tab, false);
    });
    tab.addEventListener("keydown", function (e) {
      var dir = 0;
      if (e.key === "ArrowLeft") dir = lang() === "he" ? 1 : -1;
      if (e.key === "ArrowRight") dir = lang() === "he" ? -1 : 1;
      if (!dir) return;
      e.preventDefault();
      var next = tabs[(i + dir + tabs.length) % tabs.length];
      next.focus();
      next.click();
    });
  });

  closeBtn.addEventListener("click", requestClose);

  /* ============================== Search ============================== */

  var searchDialog = document.getElementById("searchDialog");
  var searchInput = document.getElementById("searchInput");
  var searchResults = document.getElementById("searchResults");
  var searchStatus = document.getElementById("searchStatus");
  var searchOpenBtn = document.getElementById("searchOpen");

  function normalize(s) {
    return String(s).toLowerCase()
      .replace(/[֑-ׇ]/g, "")
      .replace(/["'״׳`]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function runSearch() {
    var q = normalize(searchInput.value);
    if (!q) {
      searchResults.innerHTML = "";
      searchStatus.textContent = t("searchHint");
      return;
    }
    var found = MENU.filter(function (i) {
      return normalize(i.he).indexOf(q) !== -1 || normalize(i.en).indexOf(q) !== -1;
    });
    searchStatus.textContent = found.length ? t("searchCount").replace("{n}", found.length) : t("searchNone");
    searchResults.innerHTML = found.map(function (i) {
      var where = i.menu === "food" ? t("menu_food") + " · " + t("section_" + i.section) : t("menu_" + i.menu);
      return '<li><button type="button" class="search-result" data-id="' + escapeHtml(i.id) + '" data-menu="' + i.menu + '">' +
        '<img src="' + escapeHtml(i.img) + '" alt="" width="64" height="48" loading="lazy" />' +
        '<span class="search-result__name">' + escapeHtml(itemName(i)) + "</span>" +
        '<span class="search-result__where">' + escapeHtml(where) + "</span></button></li>";
    }).join("");
  }

  function onSearchKeydown(e) {
    if (e.key === "Escape") { e.preventDefault(); closeSearch(); }
  }

  function openSearch() {
    searchDialog.hidden = false;
    document.body.classList.add("no-scroll");
    document.addEventListener("keydown", onSearchKeydown);
    requestAnimationFrame(function () { searchDialog.classList.add("is-open"); });
    runSearch();
    setTimeout(function () { searchInput.focus(); }, 30);
  }

  function closeSearch(keepFocus) {
    searchDialog.classList.remove("is-open");
    document.removeEventListener("keydown", onSearchKeydown);
    searchDialog.hidden = true;
    if (!currentMenu) document.body.classList.remove("no-scroll");
    if (!keepFocus) searchOpenBtn.focus();
  }

  searchOpenBtn.addEventListener("click", openSearch);
  searchInput.addEventListener("input", runSearch);
  searchDialog.querySelectorAll("[data-search-close]").forEach(function (el) {
    el.addEventListener("click", function () { closeSearch(); });
  });
  searchResults.addEventListener("click", function (e) {
    var btn = e.target.closest(".search-result");
    if (!btn) return;
    closeSearch(true);
    pendingFocusId = btn.dataset.id;
    lastTrigger = searchOpenBtn;
    originRect = null;
    if (currentMenu) {
      history.replaceState(null, "", "#" + btn.dataset.menu);
      openMenu(btn.dataset.menu, false);
    } else {
      location.hash = btn.dataset.menu;
    }
  });

  /* ========================= Accessibility menu ======================= */

  var a11yBtn = document.getElementById("a11yOpen");
  var a11yPanel = document.getElementById("a11yPanel");
  var a11yClose = document.getElementById("a11yClose");
  var sizeValue = document.getElementById("a11ySizeValue");
  var SIZES = [0, 1, 2, 3]; // 100%, 115%, 130%, 150%
  var SIZE_LABEL = ["100%", "115%", "130%", "150%"];
  var a11y = {};
  try { a11y = JSON.parse(storageGet("toameya-a11y") || "{}"); } catch (e) { a11y = {}; }

  function saveA11y() { storageSet("toameya-a11y", JSON.stringify(a11y)); }

  function syncA11yUi() {
    var size = a11y.size || 0;
    if (size) root.setAttribute("data-text-size", String(size));
    else root.removeAttribute("data-text-size");
    sizeValue.textContent = SIZE_LABEL[size];
    a11yPanel.querySelectorAll("[data-a11y]").forEach(function (btn) {
      var key = btn.dataset.a11y;
      root.classList.toggle("a11y-" + key, !!a11y[key]);
      btn.setAttribute("aria-pressed", a11y[key] ? "true" : "false");
    });
  }

  function onA11yKeydown(e) {
    if (e.key === "Escape") closeA11y();
  }
  function openA11y() {
    a11yPanel.hidden = false;
    a11yBtn.setAttribute("aria-expanded", "true");
    document.addEventListener("keydown", onA11yKeydown);
    a11yPanel.querySelector("button").focus();
  }
  function closeA11y() {
    a11yPanel.hidden = true;
    a11yBtn.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", onA11yKeydown);
    a11yBtn.focus();
  }

  a11yBtn.addEventListener("click", function () {
    if (a11yPanel.hidden) openA11y(); else closeA11y();
  });
  a11yClose.addEventListener("click", closeA11y);
  a11yPanel.querySelectorAll("[data-a11y-size]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var next = (a11y.size || 0) + Number(btn.dataset.a11ySize);
      a11y.size = Math.min(Math.max(next, 0), SIZES.length - 1);
      saveA11y(); syncA11yUi();
      window.dispatchEvent(new CustomEvent("toameya:layoutchange"));
    });
  });
  a11yPanel.querySelectorAll("[data-a11y]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var key = btn.dataset.a11y;
      a11y[key] = !a11y[key];
      saveA11y(); syncA11yUi();
      window.dispatchEvent(new CustomEvent("toameya:layoutchange"));
    });
  });
  document.getElementById("a11yReset").addEventListener("click", function () {
    a11y = {};
    saveA11y(); syncA11yUi();
    window.dispatchEvent(new CustomEvent("toameya:layoutchange"));
  });
  a11yPanel.querySelector(".a11y-panel__statement").addEventListener("click", function () {
    a11yPanel.hidden = true;
    a11yBtn.setAttribute("aria-expanded", "false");
  });
  document.addEventListener("click", function (e) {
    if (!a11yPanel.hidden && !a11yPanel.contains(e.target) && !a11yBtn.contains(e.target)) {
      a11yPanel.hidden = true;
      a11yBtn.setAttribute("aria-expanded", "false");
    }
  });

  /* ============================== Start =============================== */

  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  syncA11yUi();
  applyI18n();
  if (hashMenu()) openMenu(hashMenu(), false);
})();
