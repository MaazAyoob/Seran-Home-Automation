/* ============================================================
   SERAN HOME AUTOMATION — main.js
   Modular, production-ready vanilla JS
   v2.0 — Optimized: RAF scroll, class-based state, debounced
          validation, capped toasts, keyboard mega-menus,
          mobile scroll-lock, particle mobile reduction,
          error-boundary bootstrapping.
   ============================================================ */

'use strict';

/* ─────────────────────────────────────────
   MODULE: Utils
───────────────────────────────────────── */
const Utils = (() => {
  function qs(selector, scope = document) {
    return scope.querySelector(selector);
  }

  function qsa(selector, scope = document) {
    return [...scope.querySelectorAll(selector)];
  }

  function on(el, event, handler, opts) {
    if (el) el.addEventListener(event, handler, opts);
  }

  function off(el, event, handler) {
    if (el) el.removeEventListener(event, handler);
  }

  /**
   * Returns a debounced version of fn that fires after `delay` ms of silence.
   */
  function debounce(fn, delay = 200) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  /**
   * Clamps val between min and max.
   */
  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  /**
   * Returns true when the device is considered a small/mobile screen.
   */
  function isMobile() {
    return window.innerWidth < 768;
  }

  return { qs, qsa, on, off, debounce, clamp, isMobile };
})();


/* ─────────────────────────────────────────
   MODULE: ThemeManager
───────────────────────────────────────── */
const ThemeManager = (() => {
  const STORAGE_KEY = 'seran-theme';
  const body = document.body;

  function getTheme() {
    return localStorage.getItem(STORAGE_KEY) || 'light';
  }

  function applyTheme(theme) {
    body.classList.toggle('light-mode', theme === 'light');
    Utils.qsa('[data-theme-icon]').forEach(icon => {
      icon.className = theme === 'light' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    });
  }

  function toggle() {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    ToastManager.show(`${next === 'light' ? 'Light' : 'Dark'} mode activated`, 'info');
  }

  function init() {
    applyTheme(getTheme());
    Utils.qsa('[data-action="toggle-theme"]').forEach(btn => {
      Utils.on(btn, 'click', toggle);
    });
  }

  return { init };
})();


/* ─────────────────────────────────────────
   MODULE: StickyCTA
───────────────────────────────────────── */
const StickyCTA = (() => {
  const bar = Utils.qs('#sticky-cta');
  const THRESHOLD = 600;
  let shown = false;

  /**
   * Called from the shared RAF scroll loop — no inline style manipulation.
   * Visibility is handled entirely by CSS classes.
   */
  function update(scrollY) {
    if (!bar) return;

    if (scrollY > THRESHOLD && !shown) {
      bar.classList.add('visible');
      shown = true;
    } else if (scrollY <= THRESHOLD && shown) {
      bar.classList.remove('visible');
      shown = false;
    }
  }

  return { update };
})();


/* ─────────────────────────────────────────
   MODULE: ScrollTopBtn
───────────────────────────────────────── */
const ScrollTopBtn = (() => {
  const btn = Utils.qs('#scroll-top-btn');

  function update(scrollY) {
    if (!btn) return;
    btn.classList.toggle('visible', scrollY > 400);
  }

  function init() {
    Utils.on(btn, 'click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  return { init, update };
})();


/* ─────────────────────────────────────────
   MODULE: ScrollOrchestrator
   Single RAF-based scroll loop shared by all
   scroll-dependent modules.  Replaces multiple
   competing scroll listeners.
───────────────────────────────────────── */
const ScrollOrchestrator = (() => {
  const navbar = Utils.qs('#navbar');
  let lastScrollY = window.scrollY;
  let rafPending = false;

  function processScroll() {
    const y = window.scrollY;
    lastScrollY = y;
    rafPending = false;

    // Navbar state
    if (navbar) navbar.classList.toggle('scrolled', y > 60);

    // Delegate to dependants
    StickyCTA.update(y);
    ScrollTopBtn.update(y);
    HeroParallax.onScroll(y);
  }

  function onScrollEvent() {
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(processScroll);
    }
  }

  function init() {
    Utils.on(window, 'scroll', onScrollEvent, { passive: true });
    // Run once on boot so initial state is correct
    processScroll();
  }

  return { init };
})();


/* ─────────────────────────────────────────
   MODULE: HeroParallax
   RAF-throttled; called from ScrollOrchestrator
   so there is no redundant scroll listener.
───────────────────────────────────────── */
const HeroParallax = (() => {
  let bgs = [];

  function onScroll(y) {
    if (!bgs.length) return;
    const offset = `translateY(${(y * 0.35).toFixed(2)}px)`;
    for (let i = 0; i < bgs.length; i++) {
      bgs[i].style.transform = offset;
    }
  }

  function init() {
    bgs = Utils.qsa('.hero-bg');
  }

  return { init, onScroll };
})();


/* ─────────────────────────────────────────
   MODULE: NavManager
───────────────────────────────────────── */
const NavManager = (() => {
  const hamburger    = Utils.qs('#hamburger');
  const mobileNav    = Utils.qs('#mobile-nav');
  const mobileClose  = Utils.qs('#mobile-nav-close');
  const overlay      = Utils.qs('#mobile-nav-overlay');
  let isOpen = false;

  /* ── Mobile nav ── */
  function openMobileNav() {
    isOpen = true;
    mobileNav    && mobileNav.classList.add('open');
    hamburger    && hamburger.classList.add('open');
    overlay      && overlay.classList.add('visible');
    // Prevent background scroll without inline style abuse
    document.documentElement.classList.add('nav-open');
    mobileNav    && mobileNav.setAttribute('aria-hidden', 'false');
    mobileClose  && mobileClose.focus();
  }

  function closeMobileNav() {
    isOpen = false;
    mobileNav    && mobileNav.classList.remove('open');
    hamburger    && hamburger.classList.remove('open');
    overlay      && overlay.classList.remove('visible');
    document.documentElement.classList.remove('nav-open');
    mobileNav    && mobileNav.setAttribute('aria-hidden', 'true');
    hamburger    && hamburger.focus();
  }

  function initMobileSubmenus() {
    Utils.qsa('.mobile-nav-link[data-submenu]').forEach(link => {
      Utils.on(link, 'click', () => {
        const targetId = link.dataset.submenu;
        const target = Utils.qs(`#${targetId}`);
        if (!target) return;

        const isExpanded = target.classList.contains('open');

        // Close all open submenus
        Utils.qsa('.mobile-submenu.open').forEach(s => s.classList.remove('open'));
        Utils.qsa('.mobile-nav-link[aria-expanded="true"]').forEach(l => {
          l.setAttribute('aria-expanded', 'false');
          const chevron = l.querySelector('i.fa-chevron-down');
          chevron && chevron.classList.remove('rotated');
        });

        if (!isExpanded) {
          target.classList.add('open');
          link.setAttribute('aria-expanded', 'true');
          const chevron = link.querySelector('i.fa-chevron-down');
          chevron && chevron.classList.add('rotated');
        } else {
          link.setAttribute('aria-expanded', 'false');
        }
      });

      link.setAttribute('aria-expanded', 'false');
    });
  }

  /* ── Mega menu keyboard support ── */
  function initKeyboardNav() {
    Utils.qsa('.nav-item').forEach(item => {
      const trigger = item.querySelector('.nav-link');
      const menu    = item.querySelector('.mega-menu');
      if (!trigger || !menu) return;

      function openMenu() {
        // Close any other open menus first
        Utils.qsa('.nav-item').forEach(other => {
          const otherMenu = other.querySelector('.mega-menu');
          const otherTrigger = other.querySelector('.nav-link');
          if (otherMenu && otherMenu !== menu) {
            otherMenu.classList.remove('kb-open');
            otherTrigger && otherTrigger.setAttribute('aria-expanded', 'false');
          }
        });

        menu.classList.add('kb-open');
        trigger.setAttribute('aria-expanded', 'true');
        // Move focus to first focusable item inside menu
        const firstLink = menu.querySelector('a, button');
        firstLink && firstLink.focus();
      }

      function closeMenu() {
        menu.classList.remove('kb-open');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus();
      }

      Utils.on(trigger, 'keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          menu.classList.contains('kb-open') ? closeMenu() : openMenu();
        }
        if (e.key === 'Escape') closeMenu();
        if (e.key === 'ArrowDown') { e.preventDefault(); openMenu(); }
      });

      Utils.on(menu, 'keydown', e => {
        if (e.key === 'Escape') closeMenu();

        // Arrow key navigation within menu
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const focusables = [...menu.querySelectorAll('a, button')];
          const idx = focusables.indexOf(document.activeElement);
          const next = e.key === 'ArrowDown'
            ? focusables[idx + 1] || focusables[0]
            : focusables[idx - 1] || focusables[focusables.length - 1];
          next && next.focus();
        }
      });

      // Close when focus leaves the entire nav item
      Utils.on(item, 'focusout', e => {
        if (!item.contains(e.relatedTarget)) closeMenu();
      });
    });

    // Global escape closes any open mega menu
    Utils.on(document, 'keydown', e => {
      if (e.key === 'Escape') {
        Utils.qsa('.mega-menu.kb-open').forEach(m => m.classList.remove('kb-open'));
        Utils.qsa('.nav-link[aria-expanded="true"]').forEach(t => {
          t.setAttribute('aria-expanded', 'false');
        });
      }
    });
  }

  /* ── Smooth anchor links ── */
  function initSmoothLinks() {
    Utils.qsa('a[href^="#"]').forEach(a => {
      Utils.on(a, 'click', e => {
        const href = a.getAttribute('href');
        if (href === '#') return;
        const target = Utils.qs(href);
        if (!target) return;
        e.preventDefault();
        closeMobileNav();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function init() {
    Utils.on(hamburger, 'click', () => isOpen ? closeMobileNav() : openMobileNav());
    Utils.on(mobileClose, 'click', closeMobileNav);
    // Tap overlay to close
    Utils.on(overlay, 'click', closeMobileNav);
    Utils.on(document, 'keydown', e => { if (e.key === 'Escape' && isOpen) closeMobileNav(); });

    initMobileSubmenus();
    initKeyboardNav();
    initSmoothLinks();
  }

  return { init };
})();


/* ─────────────────────────────────────────
   MODULE: ParticleCanvas
───────────────────────────────────────── */
const ParticleCanvas = (() => {
  const canvas = Utils.qs('#hero-canvas');
  if (!canvas) return { init: () => {} };

  const ctx = canvas.getContext('2d');
  let particles = [];
  let animFrame;
  let W, H;
  let running = false;

  // Reduce particle count on mobile to avoid FPS drops
  const PARTICLE_COUNT = Utils.isMobile() ? 30 : 80;

  const CONFIG = {
    count:        PARTICLE_COUNT,
    maxRadius:    2.5,
    speed:        0.4,
    lineDistance: Utils.isMobile() ? 80 : 120,
    colors:       ['rgba(198,167,94,', 'rgba(46,204,138,', 'rgba(255,255,255,'],
  };

  class Particle {
    constructor() { this.reset(true); }

    reset(isInit = false) {
      this.x     = Math.random() * W;
      this.y     = isInit ? Math.random() * H : H + 10;
      this.vx    = (Math.random() - 0.5) * CONFIG.speed;
      this.vy    = -Math.random() * CONFIG.speed - 0.1;
      this.r     = Math.random() * CONFIG.maxRadius + 0.5;
      this.color = CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)];
      this.alpha = Math.random() * 0.5 + 0.1;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.y < -10 || this.x < -10 || this.x > W + 10) this.reset();
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `${this.color}${this.alpha})`;
      ctx.fill();
    }
  }

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  /**
   * O(n²) line drawing — skip entirely on mobile to protect performance.
   */
  function drawLines() {
    if (Utils.isMobile()) return;
    const len = particles.length;
    for (let i = 0; i < len; i++) {
      for (let j = i + 1; j < len; j++) {
        const dx   = particles[i].x - particles[j].x;
        const dy   = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONFIG.lineDistance) {
          const alpha = (1 - dist / CONFIG.lineDistance) * 0.12;
          ctx.strokeStyle = `rgba(198,167,94,${alpha})`;
          ctx.lineWidth   = 0.5;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();
    }
    drawLines();
    animFrame = requestAnimationFrame(animate);
  }

  function init() {
    try {
      resize();
      particles = Array.from({ length: CONFIG.count }, () => new Particle());
      running   = true;
      animate();

      // Pause animation when tab is hidden to save battery
      Utils.on(document, 'visibilitychange', () => {
        if (document.hidden) {
          running = false;
          cancelAnimationFrame(animFrame);
        } else {
          running = true;
          animate();
        }
      });

      Utils.on(window, 'resize', Utils.debounce(() => {
        resize();
        // Rebuild particles on resize so density remains correct
        particles = Array.from({ length: CONFIG.count }, () => new Particle());
      }, 250));
    } catch (err) {
      console.warn('ParticleCanvas: init failed', err);
    }
  }

  return { init };
})();


/* ─────────────────────────────────────────
   MODULE: HeroSwiper
───────────────────────────────────────── */
const HeroSwiper = (() => {
  function init() {
    try {
      const el = Utils.qs('.hero-swiper');
      if (!el) return;

      if (typeof Swiper === 'undefined') {
        console.warn('HeroSwiper: Swiper library not loaded — showing first slide only.');
        const wrapper = el.querySelector('.swiper-wrapper');
        if (wrapper) wrapper.style.transform = 'none';
        // Show first slide manually as fallback
        const firstSlide = el.querySelector('.swiper-slide');
        if (firstSlide) firstSlide.style.opacity = '1';
        return;
      }

      new Swiper(el, {
        loop:       true,
        speed:      900,
        effect:     'fade',
        fadeEffect: { crossFade: true },
        autoplay:   { delay: 5500, disableOnInteraction: false },
        pagination: { el: '.hero-swiper .swiper-pagination', clickable: true },
        a11y:       { enabled: true },
      });
    } catch (err) {
      console.warn('HeroSwiper: initialization failed', err);
    }
  }

  return { init };
})();


/* ─────────────────────────────────────────
   MODULE: ProductsSwiper
───────────────────────────────────────── */
const ProductsSwiper = (() => {
  function init() {
    try {
      const el = Utils.qs('.products-swiper');
      if (!el || typeof Swiper === 'undefined') return;

      new Swiper(el, {
        slidesPerView: 1,
        spaceBetween:  24,
        loop:          false,
        navigation: {
          nextEl: '#prod-next',
          prevEl: '#prod-prev',
        },
        breakpoints: {
          640:  { slidesPerView: 2 },
          1024: { slidesPerView: 3 },
        },
        a11y: { enabled: true },
      });
    } catch (err) {
      console.warn('ProductsSwiper: initialization failed', err);
    }
  }

  return { init };
})();


/* ─────────────────────────────────────────
   MODULE: TestimonialsSwiper
───────────────────────────────────────── */
const TestimonialsSwiper = (() => {
  function init() {
    try {
      const el = Utils.qs('.testimonials-swiper');
      if (!el || typeof Swiper === 'undefined') return;

      new Swiper(el, {
        slidesPerView: 1,
        spaceBetween:  24,
        loop:          true,
        autoplay:      { delay: 4500, disableOnInteraction: false },
        pagination: {
          el:        '.testimonials-swiper .swiper-pagination',
          clickable: true,
        },
        breakpoints: {
          768:  { slidesPerView: 2 },
          1024: { slidesPerView: 3 },
        },
        a11y: { enabled: true },
      });
    } catch (err) {
      console.warn('TestimonialsSwiper: initialization failed', err);
    }
  }

  return { init };
})();


/* ─────────────────────────────────────────
   MODULE: CounterAnimator
───────────────────────────────────────── */
const CounterAnimator = (() => {
  /**
   * Uses rAF for buttery-smooth number animation instead of setInterval.
   */
  function animateCounter(el) {
    const target   = parseInt(el.dataset.target, 10);
    const suffix   = el.dataset.suffix || '';
    const duration = 2000;
    let startTime  = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed  = timestamp - startTime;
      const progress = Utils.clamp(elapsed / duration, 0, 1);
      // Ease-out cubic
      const eased    = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target).toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  function init() {
    const counters = Utils.qsa('[data-counter]');
    if (!counters.length) return;

    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.dataset.animated) {
          entry.target.dataset.animated = 'true';
          animateCounter(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(el => {
      el.textContent = '0' + (el.dataset.suffix || '');
      obs.observe(el);
    });
  }

  return { init };
})();


/* ─────────────────────────────────────────
   MODULE: ScrollReveal
───────────────────────────────────────── */
const ScrollReveal = (() => {
  function init() {
    const targets = Utils.qsa('.reveal, .reveal-left, .reveal-right');
    if (!targets.length) return;

    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    targets.forEach(el => obs.observe(el));
  }

  return { init };
})();


/* ─────────────────────────────────────────
   MODULE: FAQManager
───────────────────────────────────────── */
const FAQManager = (() => {
  function init() {
    Utils.qsa('.faq-question').forEach(btn => {
      btn.setAttribute('aria-expanded', 'false');
      // Remove HTML hidden attribute so CSS can control visibility
      const answer = btn.nextElementSibling;
      if (answer) answer.removeAttribute('hidden');

      Utils.on(btn, 'click', () => {
        const ans     = btn.nextElementSibling;
        const isOpen  = btn.classList.contains('open');

        // Close all open items
        Utils.qsa('.faq-question.open').forEach(b => {
          b.classList.remove('open');
          b.setAttribute('aria-expanded', 'false');
          const a = b.nextElementSibling;
          if (a) a.classList.remove('open');
        });

        if (!isOpen) {
          btn.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
          if (ans) ans.classList.add('open');
        }
      });
    });
  }

  return { init };
})();


/* ─────────────────────────────────────────
   MODULE: LeadForm
───────────────────────────────────────── */
const LeadForm = (() => {
  let currentStep = 1;
  const TOTAL_STEPS = 3;

  const VALIDATORS = {
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    phone: v => /^[0-9+\-\s()]{7,15}$/.test(v),
  };

  function getFormEl() {
    return Utils.qs('#lead-form-el');
  }

  function getErrorMessage(field) {
    if (!field.value.trim()) return 'This field is required.';
    if (field.type === 'email' && !VALIDATORS.email(field.value)) return 'Enter a valid email address.';
    if (field.dataset.type === 'phone' && !VALIDATORS.phone(field.value)) return 'Enter a valid phone number.';
    return null;
  }

  function validateField(field) {
    const err = Utils.qs(`#error-${field.id}`);
    const msg = getErrorMessage(field);

    field.classList.toggle('error', !!msg);
    field.setAttribute('aria-invalid', msg ? 'true' : 'false');

    if (err) {
      err.textContent = msg || '';
      err.classList.toggle('show', !!msg);
    }

    return !msg;
  }

  function validateStep(step) {
    const form = getFormEl();
    if (!form) return true;
    const stepEl = Utils.qs(`#form-step-${step}`, form);
    if (!stepEl) return true;

    let allValid = true;
    Utils.qsa('[data-required]', stepEl).forEach(field => {
      if (!validateField(field)) allValid = false;
    });

    return allValid;
  }

  function goToStep(step) {
    const form = getFormEl();
    if (!form) return;

    Utils.qsa('.form-step', form).forEach(s => s.classList.remove('active'));
    const target = Utils.qs(`#form-step-${step}`, form);
    if (target) target.classList.add('active');

    Utils.qsa('.step-dot').forEach((dot, i) => {
      dot.classList.remove('active', 'completed');
      if (i + 1 === step)  dot.classList.add('active');
      if (i + 1 < step)    dot.classList.add('completed');
    });

    Utils.qsa('.step-line-fill').forEach((fill, i) => {
      fill.classList.toggle('filled', i + 1 < step);
    });

    currentStep = step;
    updateSubmitBtn();
  }

  function updateSubmitBtn() {
    const btn = Utils.qs('#form-submit-btn');
    if (!btn) return;
    btn.disabled = currentStep < TOTAL_STEPS;
  }

  /**
   * Real-time validation with debounce to avoid validating on every keystroke.
   */
  function initRealTimeValidation() {
    const form = getFormEl();
    if (!form) return;

    const debouncedValidate = Utils.debounce(e => {
      const field = e.target;
      if (field.matches('[data-required]')) validateField(field);
    }, 350);

    Utils.on(form, 'input', debouncedValidate);

    // Validate immediately on blur for instant feedback
    Utils.on(form, 'blur', e => {
      const field = e.target;
      if (field.matches('[data-required]')) validateField(field);
    }, true);
  }

  function initCheckboxGroups() {
    Utils.qsa('.checkbox-item').forEach(item => {
      const input = item.querySelector('input[type="checkbox"]');
      if (!input) return;

      function syncVisual() {
        const checked = input.checked;
        item.classList.toggle('checked', checked);
        const icon = Utils.qs('.checkbox-check i', item);
        if (icon) icon.classList.toggle('icon-checked', checked);
      }

      Utils.on(input, 'change', syncVisual);
      syncVisual();
    });
  }

  function collectFormData() {
    const form = getFormEl();
    if (!form) return {};
    const firstName = (form.querySelector('#first-name') || {}).value || '';
    const lastName  = (form.querySelector('#last-name') || {}).value || '';
    const email     = (form.querySelector('#email') || {}).value || '';
    const phone     = (form.querySelector('#phone') || {}).value || '';
    const location  = (form.querySelector('#location') || {}).value || '';
    const projectType = (form.querySelector('#project-type') || {}).value || '';
    const projectSize = (form.querySelector('#project-size') || {}).value || '';
    const budget    = (form.querySelector('#budget') || {}).value || '';
    const timeline  = (form.querySelector('#timeline') || {}).value || '';
    const message   = (form.querySelector('#message') || {}).value || '';
    const contactPref = (form.querySelector('#contact-preference') || {}).value || '';
    const systems = [...(form.querySelectorAll('input[name="systems"]:checked') || [])].map(c => c.value).join(', ');
    return { firstName, lastName, email, phone, location, projectType, projectSize, budget, timeline, message, contactPref, systems };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateStep(currentStep)) return;

    const btn = Utils.qs('#form-submit-btn');
    if (btn) {
      btn.disabled = true;
      btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Submitting…';
    }

    const data = collectFormData();

    try {
      const response = await fetch('https://formspree.io/f/xkokllon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        ToastManager.show('Thank you! Our team will contact you within 24 hours.', 'success');

        setTimeout(() => {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = btn.dataset.originalText || 'Submit Request <i class="fa-solid fa-arrow-right"></i>';
          }

          const form = getFormEl();
          if (form) {
            form.reset();
            Utils.qsa('.error', form).forEach(el => el.classList.remove('error'));
            Utils.qsa('.form-error.show', form).forEach(el => el.classList.remove('show'));
            Utils.qsa('.checkbox-item', form).forEach(item => {
              item.classList.remove('checked');
              item.setAttribute('aria-checked', 'false');
              const icon = Utils.qs('.checkbox-check i', item);
              if (icon) icon.classList.remove('icon-checked');
            });
            goToStep(1);
          }
        }, 1800);
      } else {
        ToastManager.show('Something went wrong. Please try again or call us directly.', 'error');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = btn.dataset.originalText || 'Submit Request <i class="fa-solid fa-arrow-right"></i>';
        }
      }
    } catch (err) {
      ToastManager.show('Network error. Please check your connection and try again.', 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.originalText || 'Submit Request <i class="fa-solid fa-arrow-right"></i>';
      }
    }
  }

  function init() {
    const form    = getFormEl();
    const nextBtns = Utils.qsa('[data-next-step]');
    const prevBtns = Utils.qsa('[data-prev-step]');

    nextBtns.forEach(btn => {
      Utils.on(btn, 'click', () => {
        if (validateStep(currentStep)) goToStep(currentStep + 1);
      });
    });

    prevBtns.forEach(btn => {
      Utils.on(btn, 'click', () => {
        if (currentStep > 1) goToStep(currentStep - 1);
      });
    });

    Utils.on(form, 'submit', handleSubmit);
    initCheckboxGroups();
    initRealTimeValidation();
    goToStep(1);
  }

  return { init };
})();


/* ─────────────────────────────────────────
   MODULE: ToastManager
───────────────────────────────────────── */
const ToastManager = (() => {
  const container = Utils.qs('#toast-container');
  const MAX_TOASTS = 3;

  const ICONS = {
    success: 'fa-circle-check',
    error:   'fa-circle-xmark',
    info:    'fa-circle-info',
  };

  function removeToast(toast) {
    toast.classList.add('removing');
    // Wait for CSS transition then remove from DOM
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    // Fallback in case transitionend never fires
    setTimeout(() => toast.isConnected && toast.remove(), 500);
  }

  function show(message, type = 'info', duration = 4000) {
    if (!container) return;

    // Enforce cap: evict oldest toast(s) before adding a new one
    const existing = [...container.children];
    if (existing.length >= MAX_TOASTS) {
      // Remove oldest (first child) toasts until under the cap
      existing.slice(0, existing.length - MAX_TOASTS + 1).forEach(removeToast);
    }

    const toast = document.createElement('div');
    toast.className    = `toast ${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML    = `<i class="fa-solid ${ICONS[type] || ICONS.info}" aria-hidden="true"></i><span>${message}</span>`;

    // Click to dismiss early
    Utils.on(toast, 'click', () => removeToast(toast));

    container.appendChild(toast);

    // Trigger CSS entry animation on next frame
    requestAnimationFrame(() => toast.classList.add('visible'));

    // Auto-dismiss
    setTimeout(() => removeToast(toast), duration);
  }

  return { show };
})();


/* CookieBanner removed — Change 4 */


/* ─────────────────────────────────────────
   MODULE: SkeletonLoader
───────────────────────────────────────── */
const SkeletonLoader = (() => {
  function remove() {
    Utils.qsa('[data-skeleton]').forEach(el => el.remove());
  }

  function init() {
    if (document.readyState === 'complete') { remove(); return; }
    Utils.on(window, 'load', remove);
  }

  return { init };
})();


/* ─────────────────────────────────────────
   MODULE: NewsletterForm
───────────────────────────────────────── */
const NewsletterForm = (() => {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function init() {
    const form = Utils.qs('#newsletter-form');
    if (!form) return;

    const btn   = form.querySelector('button');
    const input = form.querySelector('input[type="email"]');

    function handleNewsletter() {
      if (!input || !EMAIL_RE.test(input.value.trim())) {
        ToastManager.show('Please enter a valid email address.', 'error');
        input && input.focus();
        return;
      }

      if (btn) {
        btn.disabled = true;
        const original = btn.innerHTML;
        btn.innerHTML  = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>';

        setTimeout(() => {
          btn.disabled  = false;
          btn.innerHTML = original;
          ToastManager.show("You're subscribed! Welcome to Seran insights.", 'success');
          input.value = '';
        }, 1000);
      } else {
        ToastManager.show("You're subscribed! Welcome to Seran insights.", 'success');
        input.value = '';
      }
    }

    // Handle button click
    Utils.on(btn, 'click', handleNewsletter);

    // Also handle Enter key in input
    Utils.on(input, 'keydown', e => {
      if (e.key === 'Enter') handleNewsletter();
    });
  }

  return { init };
})();


/* ─────────────────────────────────────────
   MODULE: ImageBlurUp
   Blur-up progressive loading for data-src images.
   Uses CSS classes instead of inline style mutations.
───────────────────────────────────────── */
const ImageBlurUp = (() => {
  function init() {
    Utils.qsa('img[data-src]').forEach(img => {
      // CSS must define: .blur-up { filter: blur(12px); transition: filter .6s ease; }
      // and img (without .blur-up) { filter: none; }
      img.classList.add('blur-up');

      const obs = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const image = entry.target;
          image.src    = image.dataset.src;
          image.onload = () => image.classList.remove('blur-up');
          obs.unobserve(image);
        });
      }, { rootMargin: '200px' });

      obs.observe(img);
    });
  }

  return { init };
})();


/* ─────────────────────────────────────────
   MODULE: App Bootstrap
   Each module is wrapped in a try/catch error
   boundary so a single module failure can never
   crash the entire page.
───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const modules = [
    ['ThemeManager',        () => ThemeManager.init()],
    ['HeroParallax',        () => HeroParallax.init()],
    ['ScrollOrchestrator',  () => ScrollOrchestrator.init()],
    ['NavManager',          () => NavManager.init()],
    ['ScrollTopBtn',        () => ScrollTopBtn.init()],
    ['ParticleCanvas',      () => ParticleCanvas.init()],
    ['HeroSwiper',          () => HeroSwiper.init()],
    ['ProductsSwiper',      () => ProductsSwiper.init()],
    ['TestimonialsSwiper',  () => TestimonialsSwiper.init()],
    ['CounterAnimator',     () => CounterAnimator.init()],
    ['ScrollReveal',        () => ScrollReveal.init()],
    ['FAQManager',          () => FAQManager.init()],
    ['LeadForm',            () => LeadForm.init()],
    ['SkeletonLoader',      () => SkeletonLoader.init()],
    ['NewsletterForm',      () => NewsletterForm.init()],
    ['ImageBlurUp',         () => ImageBlurUp.init()],
  ];

  modules.forEach(([name, boot]) => {
    try {
      boot();
    } catch (err) {
      console.error(`[Seran] Module "${name}" failed to initialize:`, err);
    }
  });

  // Welcome toast — low priority, runs last
  setTimeout(() => {
    ToastManager.show('Welcome to Seran — Reimagining Smart Living', 'info', 3500);
  }, 1200);
});
