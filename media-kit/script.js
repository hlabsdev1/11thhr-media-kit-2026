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

  /* ---------- Slide change (02 About → 11 Contacts) ---------- */
  // Each section from About on is a "slide". While one scrolls off the top, the
  // next is held in place underneath it and uncovered. The holding is pure CSS
  // (sticky inside .slide-wrap, see .has-slides); update() below only sets the
  // darkening and shadow.

  var slides = [];
  if (!reduceMotion) {
    var sections = $$("main > section");
    var firstSlide = sections.indexOf($("#about"));
    if (firstSlide > -1) {
      slides = sections.slice(firstSlide).map(function (el, i, list) {
        el.classList.add("slide");
        el.style.zIndex = String(list.length - i + 1); // earlier slides sit on top
        var wrap = null;
        if (i > 0) {
          wrap = document.createElement("div");
          wrap.className = "slide-wrap";
          el.parentNode.insertBefore(wrap, el);
          wrap.appendChild(el);
        }
        return { el: el, wrap: wrap, progress: i === 0 ? 1 : 0 }; // progress: 1 = fully uncovered
      });
      root.classList.add("has-slides");
    }
  }
  function slideProgress(el) {
    var s = el.closest(".slide");
    for (var i = 0; i < slides.length; i++) if (slides[i].el === s) return slides[i].progress;
    return 1;
  }

  /* ---------- Reveal on scroll ---------- */

  // Elements in a slide that is still covered wait until it is half uncovered,
  // so their entrance animation isn't spent while hidden under the previous slide.
  var revealPending = [];
  var revealIO = null;
  function revealNow(el) {
    el.classList.add("is-in");
    if (revealIO) revealIO.unobserve(el);
  }

  (function reveals() {
    var items = $$("[data-reveal]");
    if (!("IntersectionObserver" in window) || reduceMotion) {
      items.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var i = revealPending.indexOf(e.target);
        if (!e.isIntersecting) { if (i > -1) revealPending.splice(i, 1); return; }
        if (slideProgress(e.target) >= 0.5) revealNow(e.target);
        else if (i === -1) revealPending.push(e.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    items.forEach(function (el) { revealIO.observe(el); });
  })();

  /* ---------- Ken Burns (photos marked data-kb) ---------- */
  // .kb-on starts the slow zoom when a photo comes into view (waiting, like the
  // reveals, until a covered slide is half uncovered). Once the photo has left
  // the screen completely it snaps back, unanimated, to its zoomed-in start, so
  // the zoom plays again on every visit.

  var kbPending = [];
  function kbStart(el) { el.classList.add("kb-on"); }
  function kbReset(el) {
    if (!el.classList.contains("kb-on")) return;
    var img = el.querySelector("img");
    if (img) img.style.transition = "none";
    el.classList.remove("kb-on");
    if (img) { void img.offsetWidth; img.style.transition = ""; }
  }
  (function kenBurns() {
    var photos = $$("[data-kb]");
    if (!photos.length || !("IntersectionObserver" in window) || reduceMotion) return;
    var enterIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var i = kbPending.indexOf(e.target);
        if (!e.isIntersecting) { if (i > -1) kbPending.splice(i, 1); return; }
        if (slideProgress(e.target) >= 0.5) kbStart(e.target);
        else if (i === -1) kbPending.push(e.target);
      });
    }, { threshold: 0.12 });
    var leaveIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (!e.isIntersecting) kbReset(e.target); });
    }, { threshold: 0 });
    photos.forEach(function (el) { enterIO.observe(el); leaveIO.observe(el); });
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
    return { el: el, words: words, lines: null, width: 0, h: 0, section: el.closest("section"), stage: el.parentElement };
  });

  // group a paragraph's words into its visual lines (re-run when the width or fonts change)
  function measureLines(lead) {
    var lines = [], lastTop = null;
    lead.words.forEach(function (w) {
      var t = w.offsetTop;
      if (lastTop === null || Math.abs(t - lastTop) > 4) { lines.push([]); lastTop = t; }
      lines[lines.length - 1].push(w);
    });
    lead.lines = lines.map(function (ws) { return { words: ws, v: -1 }; });
    lead.width = lead.el.offsetWidth;
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { leads.forEach(function (l) { l.lines = null; }); onScroll(); });
  }

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

    // slide change: a slide is held (sticky) while its wrapper's top travels from
    // 0 to -L, where L is the hold distance (the wrapper's spacer below the slide).
    if (slides.length) {
      var reads = slides.map(function (x) {
        if (!x.wrap) return null;
        return { top: x.wrap.getBoundingClientRect().top, L: (x.wrap.offsetHeight - x.el.offsetHeight) || vh };
      });
      slides.forEach(function (x, i) {
        if (i === 0) return;
        var covered = clamp(1 + reads[i].top / reads[i].L, 0, 1); // 1 = fully covered, 0 = fully uncovered
        x.progress = 1 - covered;
        x.el.style.setProperty("--slide-in", covered.toFixed(3));
        slides[i - 1].el.style.setProperty("--slide-out", Math.min(1, covered * 3).toFixed(3));
      });
      for (var k = revealPending.length - 1; k >= 0; k--) {
        if (slideProgress(revealPending[k]) >= 0.5) revealNow(revealPending.splice(k, 1)[0]);
      }
      for (var m = kbPending.length - 1; m >= 0; m--) {
        if (slideProgress(kbPending[m]) >= 0.5) kbStart(kbPending.splice(m, 1)[0]);
      }
    }

    leads.forEach(function (lead) {
      // the paragraph's height drives its sticky position and the space below it (CSS --lead-h)
      var h = lead.el.offsetHeight;
      if (h !== lead.h && lead.section) { lead.h = h; lead.section.style.setProperty("--lead-h", h + "px"); }
      if (reduceMotion) return;
      if (!lead.lines || lead.el.offsetWidth !== lead.width) measureLines(lead);

      // line-by-line fade-up: runs while the stage rises from 90% of the screen
      // until a little after the paragraph has settled in the middle
      var stageTop = lead.stage.getBoundingClientRect().top;
      var settled = vh / 2 - h / 2;
      var p = clamp((vh * 0.9 - stageTop) / (vh * 0.9 - settled + vh * 0.1), 0, 1);
      var n = lead.lines.length;
      lead.lines.forEach(function (line, i) {
        var a = n > 1 ? (i / (n - 1)) * 0.55 : 0;     // when this line starts
        var v = clamp((p - a) / 0.45, 0, 1);          // 0 hidden → 1 shown
        v = Math.round(v * 100) / 100;
        if (v === line.v) return;
        line.v = v;
        var ease = 1 - Math.pow(1 - v, 3);
        line.words.forEach(function (w) {
          w.style.opacity = ease.toFixed(3);
          w.style.transform = "translateY(" + ((1 - ease) * 24).toFixed(1) + "px)";
        });
      });
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
  window.addEventListener("load", onScroll); // section heights settle once fonts and images are in
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

    // The FAQ is placed by its height with every question closed (CSS --faq-h),
    // so opening an answer only pushes content downwards and the title stays put.
    var body = $(".faq__body");
    var section = body && body.closest("section");
    function measure() {
      var openH = 0;
      $$(".faq__a", body).forEach(function (a) { openH += a.offsetHeight; });
      section.style.setProperty("--faq-h", (body.offsetHeight - openH) + "px");
    }
    if (section) {
      measure();
      window.addEventListener("resize", measure);
      window.addEventListener("load", measure);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    }
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
