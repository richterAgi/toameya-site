// Motion is off when the visitor asked for it in their system settings OR
// switched "stop animations" on in the site's accessibility menu.
function toameyaMotionOff() {
  return document.documentElement.classList.contains("a11y-motion") ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

(function () {
  var drawer = document.getElementById("sideDrawer");
  if (!drawer) return;

  var titleEl = document.getElementById("sideDrawerTitle");
  var bodyEl = document.getElementById("sideDrawerBody");
  var closeEls = drawer.querySelectorAll("[data-drawer-close]");
  var triggers = document.querySelectorAll("[data-drawer-trigger]");
  var lastTrigger = null;

  function onKeydown(event) {
    if (event.key === "Escape") closeDrawer();
  }

  function openDrawer(trigger) {
    lastTrigger = trigger;
    titleEl.textContent = trigger.dataset.title || "";
    bodyEl.textContent = trigger.dataset.body || "";

    drawer.hidden = false;
    requestAnimationFrame(function () {
      drawer.classList.add("is-open");
    });

    document.body.classList.add("no-scroll");
    document.addEventListener("keydown", onKeydown);

    var closeBtn = drawer.querySelector(".side-drawer__close");
    if (closeBtn) closeBtn.focus();
  }

  function closeDrawer() {
    if (!drawer.classList.contains("is-open")) return;

    drawer.classList.remove("is-open");
    document.body.classList.remove("no-scroll");
    document.removeEventListener("keydown", onKeydown);

    drawer.addEventListener(
      "transitionend",
      function onEnd() {
        drawer.hidden = true;
        drawer.removeEventListener("transitionend", onEnd);
        if (lastTrigger) lastTrigger.focus();
      },
      { once: true }
    );
  }

  triggers.forEach(function (trigger) {
    trigger.addEventListener("click", function () {
      openDrawer(trigger);
    });
  });

  closeEls.forEach(function (el) {
    el.addEventListener("click", closeDrawer);
  });
})();

(function () {
  function revealOnIntersect(selector, threshold) {
    var els = document.querySelectorAll(selector);
    if (!els.length) return;

    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: threshold }
    );

    els.forEach(function (el) {
      observer.observe(el);
    });
  }

  // The cards fade in once a quarter of the page has scrolled into view.
  // The hsv-colored tear panels are handled separately below, driven by
  // scroll position rather than intersection, so they can stay in sync
  // with the hero across the same transition.
  revealOnIntersect(".reveal", 0.25);
})();

(function () {
  // Page 2's logo: stuck off the left edge until the section is at least
  // 20% in view, then springs into place - and reverses (sticks back off
  // screen and disappears) the moment you scroll away again, in EITHER
  // direction. Unlike revealOnIntersect above, this one never unobserves -
  // it's a toggle, not a one-time reveal.
  var section = document.querySelector(".card-fan");
  if (!section) return;

  if (!("IntersectionObserver" in window)) {
    section.classList.add("is-visible");
    return;
  }

  var THRESHOLD = 0.2;
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        section.classList.toggle("is-visible", entry.intersectionRatio >= THRESHOLD);
      });
    },
    { threshold: [0, THRESHOLD] }
  );

  observer.observe(section);
})();

// Shared helpers for scroll-linked tear reversals: a clip-path polygon is
// just an array of [x, y] percentage points, and "reversing" a tear means
// retracing its 0% / 50% / 100% keyframes backwards, driven by scroll
// progress instead of time, so the motion looks identical to the CSS
// entrance animation it mirrors.
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpPoints(from, to, t) {
  return from.map(function (p, i) {
    return [lerp(p[0], to[i][0], t), lerp(p[1], to[i][1], t)];
  });
}

function polygonFromPoints(points) {
  return (
    "polygon(" +
    points
      .map(function (p) {
        return p[0].toFixed(2) + "% " + p[1].toFixed(2) + "%";
      })
      .join(", ") +
    ")"
  );
}

// t=0 -> fully open (corner); t=0.5 -> meets exactly on the diagonal (the
// same midpoint the opening animation passes through); t=1 -> fully covers
// again.
function tearPolygonAt(cornerPoints, halfPoints, fullCoverPoints, t) {
  if (t <= 0.5) {
    return polygonFromPoints(lerpPoints(cornerPoints, halfPoints, t / 0.5));
  }
  return polygonFromPoints(lerpPoints(halfPoints, fullCoverPoints, (t - 0.5) / 0.5));
}

var FULL_COVER = [
  [0, 0],
  [100, 0],
  [100, 100],
  [0, 100],
];

(function () {
  // One shared scroll position drives the whole hero <-> page 2 hand-off:
  // as the hero scrolls away, its hsv-colored panels close AND the page 2
  // panels open using the exact same progress value, so the two are always
  // perfectly in step (at 40% scrolled, hero is 40% closed and page 2 is
  // 40% open - never one ahead of the other). The hero photo blur is tied
  // to the same progress too.
  var hero = document.querySelector(".hero");
  var heroImage = document.querySelector(".hero__image");
  var heroStay = document.querySelector(".hero__panel--stay");
  var heroLeave = document.querySelector(".hero__panel--leave");
  var tlPanel = document.querySelector(".card-fan__panel--tl");
  var brPanel = document.querySelector(".card-fan__panel--br");
  if (!hero || !heroImage || !heroStay || !heroLeave || !tlPanel || !brPanel) return;

  var MAX_BLUR_PX = 10; // ~30% blur intensity
  var TRANSITION_START = 0.05;

  // The three keyframe shapes from the CSS entrance animations
  // (heroTearTR/heroTearBL and cardTearTL/cardTearBR: 0% / 50% / 100%),
  // same 4-point winding order throughout.
  var STAY_CORNER = [
    [50, 0],
    [100, 0],
    [100, 50],
    [100, 50],
  ];
  var STAY_HALF = [
    [0, 0],
    [100, 0],
    [100, 100],
    [100, 100],
  ];
  var LEAVE_CORNER = [
    [0, 50],
    [50, 100],
    [0, 100],
    [0, 100],
  ];
  var LEAVE_HALF = [
    [0, 0],
    [100, 100],
    [100, 100],
    [0, 100],
  ];
  var TL_CORNER = [
    [0, 0],
    [50, 0],
    [0, 50],
    [0, 50],
  ];
  var TL_HALF = [
    [0, 0],
    [100, 0],
    [0, 100],
    [0, 100],
  ];
  var BR_CORNER = [
    [100, 50],
    [100, 50],
    [100, 100],
    [50, 100],
  ];
  var BR_HALF = [
    [100, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ];
  var transitionActive = false;
  var ticking = false;

  function update() {
    if (toameyaMotionOff()) {
      // Static end state: photo sharp, corners open, no scroll-linked motion.
      heroImage.style.filter = "";
      [heroStay, heroLeave, tlPanel, brPanel].forEach(function (el) {
        el.style.animation = "none";
      });
      heroStay.style.clipPath = polygonFromPoints(STAY_CORNER);
      heroLeave.style.clipPath = polygonFromPoints(LEAVE_CORNER);
      tlPanel.style.clipPath = polygonFromPoints(TL_CORNER);
      brPanel.style.clipPath = polygonFromPoints(BR_CORNER);
      transitionActive = true;
      ticking = false;
      return;
    }
    var rect = hero.getBoundingClientRect();
    var progress = Math.min(Math.max(-rect.top / rect.height, 0), 1);
    heroImage.style.filter = "blur(" + (progress * MAX_BLUR_PX).toFixed(2) + "px)";

    var t = Math.min(Math.max((progress - TRANSITION_START) / (1 - TRANSITION_START), 0), 1);

    if (!transitionActive && t > 0) {
      // Hand off from the CSS entrance animations to scroll-driven control.
      heroStay.style.animation = "none";
      heroLeave.style.animation = "none";
      tlPanel.style.animation = "none";
      brPanel.style.animation = "none";
      transitionActive = true;
    }

    if (transitionActive) {
      // Hero closes as t goes 0 -> 1 ...
      heroStay.style.clipPath = tearPolygonAt(STAY_CORNER, STAY_HALF, FULL_COVER, t);
      heroLeave.style.clipPath = tearPolygonAt(LEAVE_CORNER, LEAVE_HALF, FULL_COVER, t);
      // ... while page 2 opens using that exact same t.
      tlPanel.style.clipPath = tearPolygonAt(FULL_COVER, TL_HALF, TL_CORNER, t);
      brPanel.style.clipPath = tearPolygonAt(FULL_COVER, BR_HALF, BR_CORNER, t);
    }

    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  window.addEventListener("toameya:layoutchange", onScroll);
  update();
})();

(function () {
  // The sticky nav fades in once you start scrolling away from the hero.
  // At the same time, the logo detaches from the hero and flies (a fixed-
  // position element, animated purely with a scroll-driven transform) up
  // to its spot in the nav bar, landing there by FLY_END; after that it
  // keeps shrinking slightly further (to 95% of its landed size) as you
  // keep scrolling to page 2. Nav visibility stays independent of the
  // reduced-motion gate below - showing the nav is a usability need, not
  // decoration - only the continuous fly/shrink motion is skipped for it.
  var nav = document.getElementById("siteNav");
  var hero = document.querySelector(".hero");
  var logo = document.getElementById("flyingLogo");
  var anchor = document.getElementById("heroLogoAnchor");
  if (!nav) return;
  if (!hero) {
    nav.classList.add("is-visible");
    return;
  }

  var VISIBLE_FROM = 0.03;
  var FLY_END = 0.22;
  var MIN_SCALE = 0.95;
  var LOGO_ASPECT = 424 / 451; // height/width of img-logo.png
  var isVisible = false;
  var ticking = false;

  // dx/dy/startScale describe where the logo starts (the hero spot, marked
  // by the invisible #heroLogoAnchor box) relative to where its own CSS
  // position puts it (the nav spot). Both are read from boxes whose size is
  // fixed in CSS (the anchor's width/height, the logo's width), never from
  // the logo image's own loaded height - that raced with image loading.
  // Measuring real positions (instead of re-deriving them from CSS
  // formulas) keeps this correct on phones and in the English (LTR) layout.
  var dx = 0,
    dy = 0,
    startScale = 1;

  function measure() {
    if (!logo || !anchor) return;
    var saved = logo.style.transform;
    logo.style.transform = "none";
    var end = logo.getBoundingClientRect();
    logo.style.transform = saved;
    var start = anchor.getBoundingClientRect();
    var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

    var endWidth = end.width || 46;
    var endCenterX = end.left + endWidth / 2;
    var endCenterY = end.top + (endWidth * LOGO_ASPECT) / 2;

    var startWidth = start.width;
    var startCenterX = start.left + startWidth / 2;
    var startCenterY = start.top + scrollY + (startWidth * LOGO_ASPECT) / 2;

    dx = startCenterX - endCenterX;
    dy = startCenterY - endCenterY;
    startScale = startWidth / endWidth;
  }

  function update() {
    var rect = hero.getBoundingClientRect();
    var progress = Math.min(Math.max(-rect.top / rect.height, 0), 1);
    var shouldShow = progress > VISIBLE_FROM;

    if (shouldShow !== isVisible) {
      nav.classList.toggle("is-visible", shouldShow);
      logo.classList.toggle("is-landed", shouldShow);
      isVisible = shouldShow;
    }

    if (logo && anchor) {
      logo.style.opacity = "1";
      if (toameyaMotionOff()) {
        // No flight: the logo simply sits in the nav spot.
        logo.style.transform = "none";
      } else {
        var flyT = Math.min(Math.max(progress / FLY_END, 0), 1);
        var shrink = 1 - (1 - MIN_SCALE) * progress;
        var currentDX = dx * (1 - flyT);
        var currentDY = dy * (1 - flyT);
        var currentScale = (1 + (startScale - 1) * (1 - flyT)) * shrink;
        logo.style.transform =
          "translate(" + currentDX.toFixed(2) + "px, " + currentDY.toFixed(2) + "px) scale(" + currentScale.toFixed(4) + ")";
      }
    }

    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  function remeasure() {
    // The hero spot is only a meaningful reference while the hero is at
    // (or near) the top; elsewhere the logo is already landed anyway.
    var rect = hero.getBoundingClientRect();
    var progress = Math.min(Math.max(-rect.top / rect.height, 0), 1);
    if (progress < FLY_END) measure();
    onScroll();
  }

  if (!logo || !anchor) {
    // Pages without a hero (e.g. 404): just show the nav.
    nav.classList.add("is-visible");
    return;
  }

  measure();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", remeasure);
  window.addEventListener("toameya:layoutchange", function () {
    requestAnimationFrame(remeasure);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
  window.addEventListener("load", remeasure);
  update();
})();

(function () {
  var hamburger = document.getElementById("navHamburger");
  var drawer = document.getElementById("navDrawer");
  if (!hamburger || !drawer) return;

  var closeEls = drawer.querySelectorAll("[data-nav-close]");
  var isOpen = false;

  function onKeydown(event) {
    if (event.key === "Escape") closeNav();
  }

  function openNav() {
    isOpen = true;
    hamburger.setAttribute("aria-expanded", "true");

    drawer.hidden = false;
    requestAnimationFrame(function () {
      drawer.classList.add("is-open");
    });

    document.body.classList.add("no-scroll");
    document.addEventListener("keydown", onKeydown);

    var closeBtn = drawer.querySelector(".nav-drawer__close");
    if (closeBtn) closeBtn.focus();
  }

  function closeNav() {
    if (!isOpen) return;
    isOpen = false;
    hamburger.setAttribute("aria-expanded", "false");

    drawer.classList.remove("is-open");
    document.body.classList.remove("no-scroll");
    document.removeEventListener("keydown", onKeydown);

    drawer.addEventListener(
      "transitionend",
      function onEnd() {
        drawer.hidden = true;
        drawer.removeEventListener("transitionend", onEnd);
        // If the chosen link opened a menu window, focus belongs there.
        if (!document.body.classList.contains("menu-is-open")) hamburger.focus();
      },
      { once: true }
    );
  }

  hamburger.addEventListener("click", function () {
    if (isOpen) closeNav();
    else openNav();
  });

  closeEls.forEach(function (el) {
    el.addEventListener("click", closeNav);
  });

  // Picking a destination closes the menu too (once those sections exist,
  // this also lets the page's own smooth-scroll take over).
  drawer.querySelectorAll(".nav-drawer__list a").forEach(function (link) {
    link.addEventListener("click", closeNav);
  });
})();
