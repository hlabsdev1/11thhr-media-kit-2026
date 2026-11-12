/* 11th Hour Racing — Press Kit
   Hero video, scroll reveals, text reveal, image parallax,
   ambassador slider and FAQ accordion. No dependencies except
   hls.js, which is only used where the browser can't play HLS itself. */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  /* ---------- Hero entrance + video ---------- */

  function ready() { requestAnimationFrame(function () { root.classList.add("is-ready"); }); }
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 1200); })]).then(ready);
  } else {
    ready();
  }

  (function heroVideo() {
    var video = $(".hero__media[data-hls]");
    if (!video || reduceMotion) return; // poster stays as a still image
    var src = video.getAttribute("data-hls");
    var play = function () { var p = video.play(); if (p && p.catch) p.catch(function () {}); };

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src; // Safari / iOS play HLS natively
      video.addEventListener("loadedmetadata", play, { once: true });
    } else if (window.Hls && window.Hls.isSupported()) {
      var hls = new window.Hls({ capLevelToPlayerSize: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(window.Hls.Events.MANIFEST_PARSED, play);
    }

    // don't decode video nobody is looking at
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) play(); else video.pause(); });
      }, { threshold: 0.05 }).observe(video);
    }
  })();

  /* ---------- Reveal on scroll ---------- */

  (function reveals() {
    var items = $$("[data-reveal]");
    if (!("IntersectionObserver" in window) || reduceMotion) {
      items.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    items.forEach(function (el) { io.observe(el); });
  })();

  /* ---------- Scroll-driven work (text reveal + parallax) ---------- */

  var leads = $$("[data-text-reveal]").map(function (el) {
    // wrap every word in a span, keeping <strong> etc. intact
    var words = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            var span = document.createElement("span");
            span.className = "w";
            span.textContent = part;
            words.push(span);
            frag.appendChild(span);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    })(el);
    return { el: el, words: words, lit: -1 };
  });

  var parallaxEls = $$("[data-parallax]").map(function (el) {
    return { el: el, speed: parseFloat(el.getAttribute("data-parallax")) || 0, frame: el.classList.contains("media-frame") };
  });

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  function update() {
    ticking = false;
    var vh = window.innerHeight;
    var wide = window.innerWidth > 800;

    // text reveal: words light up as the block travels from 85% to 35% of the viewport
    leads.forEach(function (lead) {
      var r = lead.el.getBoundingClientRect();
      var start = vh * 0.85;
      var end = vh * 0.35;
      var p = reduceMotion ? 1 : clamp((start - r.top) / (start - end + r.height), 0, 1);
      var lit = Math.round(p * lead.words.length);
      if (lit === lead.lit) return;
      lead.lit = lit;
      lead.words.forEach(function (w, i) { w.classList.toggle("is-lit", i < lit); });
    });

    // parallax
    parallaxEls.forEach(function (item) {
      if (reduceMotion || !wide) { item.el.style.removeProperty("--py"); return; }
      var r = item.el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      var p = clamp((r.top + r.height / 2 - vh / 2) / vh, -1, 1); // -1 above … 1 below
      var px = item.frame
        ? -p * r.height * 0.08           // picture drifts inside its frame
        : p * item.speed * 140;          // whole element drifts at its own speed
      item.el.style.setProperty("--py", px.toFixed(1) + "px");
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();

  /* ---------- FAQ accordion ---------- */

  (function faq() {
    var items = $$(".faq__item");
    items.forEach(function (item, i) {
      var btn = $(".faq__q", item);
      var panel = $(".faq__a", item);
      var id = "faq-panel-" + (i + 1);
      panel.id = id;
      btn.setAttribute("aria-controls", id);
      btn.setAttribute("aria-expanded", "false");
      panel.setAttribute("role", "region");
      panel.inert = true;

      btn.addEventListener("click", function () {
        var open = !item.classList.contains("is-open");
        items.forEach(function (other) { // one open at a time
          var on = other === item && open;
          other.classList.toggle("is-open", on);
          $(".faq__q", other).setAttribute("aria-expanded", String(on));
          $(".faq__a", other).inert = !on;
        });
      });
    });
  })();

  /* ---------- Ambassador slider ---------- */

  (function slider() {
    var el = $(".amb__slider");
    if (!el) return;
    var viewport = $(".amb__viewport", el);
    var track = $(".amb__track", el);
    var cards = $$(".amb", track);
    var prev = $(".amb__arrow--prev", el);
    var next = $(".amb__arrow--next", el);
    var dotsWrap = $(".amb__dots", el);
    var page = 0, pages = 1, per = 4;

    function build() {
      per = parseInt(getComputedStyle(el).getPropertyValue("--per"), 10) || 4;
      pages = Math.ceil(cards.length / per);
      page = Math.min(page, pages - 1);
      dotsWrap.innerHTML = "";
      for (var i = 0; i < pages; i++) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "amb__dot";
        b.setAttribute("aria-label", "Go to ambassadors page " + (i + 1) + " of " + pages);
        b.addEventListener("click", go.bind(null, i));
        dotsWrap.appendChild(b);
      }
      go(page, true);
    }

    function go(to, instant) {
      page = clamp(to, 0, pages - 1);
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      var x = -page * (viewport.clientWidth + gap);
      if (instant) track.style.transition = "none";
      track.style.transform = "translate3d(" + x + "px,0,0)";
      if (instant) { track.offsetWidth; track.style.transition = ""; }

      cards.forEach(function (card, i) {
        var visible = Math.floor(i / per) === page;
        card.setAttribute("aria-hidden", String(!visible));
        card.inert = !visible;
      });
      $$(".amb__dot", dotsWrap).forEach(function (d, i) {
        if (i === page) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current");
      });
      prev.disabled = page === 0;
      next.disabled = page === pages - 1;
    }

    prev.addEventListener("click", function () { go(page - 1); });
    next.addEventListener("click", function () { go(page + 1); });
    el.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") go(page - 1);
      if (e.key === "ArrowRight") go(page + 1);
    });

    // swipe
    var startX = null;
    viewport.addEventListener("pointerdown", function (e) { startX = e.clientX; });
    window.addEventListener("pointerup", function (e) {
      if (startX === null) return;
      var dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 50) go(page + (dx < 0 ? 1 : -1));
    });

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(build, 120);
    });
    build();
  })();
})();
