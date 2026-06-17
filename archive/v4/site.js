// ============================================
// Om Sacred Space - Shared Site Behavior
// --------------------------------------------
// Sticky header, mobile menu, scroll reveal, lazy YouTube embeds, and
// Formspree AJAX submission. All behavior is feature-detected, so this single
// file is safe to load on every page regardless of which elements exist.
// Loaded with `defer`. Theme logic lives separately in theme.js.
// ============================================
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    // --- Sticky header (only on pages whose header starts transparent, i.e.
    //     index + sound-healing. Coming-soon pages bake in `header--scrolled`
    //     and have no scroll behavior, so they're skipped) ---
    var header = document.getElementById('header');
    if (header && !header.classList.contains('header--scrolled')) {
      var lastY = 0;
      window.addEventListener('scroll', function () {
        header.classList.toggle('header--scrolled', window.scrollY > 50);
        header.classList.toggle('header--hidden', window.scrollY > lastY && window.scrollY > 400);
        lastY = window.scrollY;
      }, { passive: true });
    }

    // --- Mobile menu ---
    var burger = document.getElementById('burger');
    var navLinks = document.getElementById('navLinks');
    if (burger && navLinks) {
      var closeMenu = function () {
        navLinks.classList.remove('nav__links--open');
        burger.classList.remove('burger--open');
        document.body.classList.remove('no-scroll');
      };
      burger.addEventListener('click', function () {
        navLinks.classList.toggle('nav__links--open');
        burger.classList.toggle('burger--open');
        document.body.classList.toggle('no-scroll');
      });
      navLinks.querySelectorAll('.nav__link').forEach(function (l) {
        l.addEventListener('click', closeMenu);
      });
    }

    // --- Scroll reveal ---
    var reveals = document.querySelectorAll('.reveal');
    if (reveals.length) {
      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) { e.target.classList.add('revealed'); observer.unobserve(e.target); }
          });
        }, { threshold: 0.15 });
        reveals.forEach(function (el) { observer.observe(el); });
      } else {
        reveals.forEach(function (el) { el.classList.add('revealed'); });
      }
    }

    // --- Lazy YouTube embeds (click/keyboard to load) ---
    document.querySelectorAll('.yt-thumb[data-video-id]').forEach(function (thumb) {
      var load = function () {
        var id = thumb.getAttribute('data-video-id');
        var iframe = document.createElement('iframe');
        iframe.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
        iframe.allow = 'autoplay; encrypted-media';
        iframe.allowFullscreen = true;
        iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:16px';
        thumb.innerHTML = '';
        thumb.appendChild(iframe);
        thumb.style.cursor = 'default';
      };
      thumb.addEventListener('click', load);
      thumb.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); load(); }
      });
    });

    // --- Formspree AJAX submission (contact form + signup form) ---
    document.querySelectorAll('form[action*="formspree.io"]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var btn = form.querySelector('button[type="submit"], button');
        var original = btn ? btn.textContent : '';
        if (btn) { btn.textContent = 'Sending...'; btn.disabled = true; }

        fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { 'Accept': 'application/json' }
        }).then(function (r) {
          if (r.ok) {
            // Contact form pattern: swap fields block for success block.
            var fields = form.querySelector('.form__fields');
            var success = form.querySelector('.form__success');
            // Signup form pattern: hide the row, show inline success.
            var row = form.querySelector('.signup__row');
            var signupSuccess = form.querySelector('.signup__success');
            if (fields && success) {
              fields.style.display = 'none';
              success.style.display = 'flex';
            } else if (row && signupSuccess) {
              row.style.display = 'none';
              signupSuccess.style.display = 'block';
            }
            form.reset();
          } else {
            if (btn) { btn.textContent = 'Error - try again'; btn.disabled = false; }
          }
        }).catch(function () {
          if (btn) { btn.textContent = 'Error - try again'; btn.disabled = false; }
        });
      });
    });
  });
})();
