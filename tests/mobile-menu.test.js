// ============================================
// Om Sacred Space - Mobile menu / orientation tests (jsdom + CSS assertions)
// Run with:  npm test   (or)  npm run test:ui
//
// jsdom does not perform real layout or evaluate orientation media queries,
// so these tests verify the two things that actually keep the mobile menu
// working in BOTH portrait and landscape:
//   1. The burger toggle behaviour in site.js (open/close + body scroll lock).
//   2. The CSS contract in styles.css that makes the open menu a full-screen
//      overlay that covers content and stays scrollable on short (landscape)
//      viewports.
// For real rendered portrait/landscape checks, see tests/e2e/*.spec.js
// (Playwright, opt-in).
// ============================================
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const siteSrc = fs.readFileSync(path.join(root, 'site.js'), 'utf8');
const cssSrc = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

// --- jsdom harness: mirrors the real header/nav markup used on every page ---
function setupPage() {
  const html = `<!DOCTYPE html><html data-theme="divine"><body>
    <header class="header header--scrolled" id="header">
      <div class="header-bg"></div>
      <nav class="nav container">
        <a href="index.html" class="logo">Logo</a>
        <div class="nav__links" id="navLinks">
          <a href="sound-healing.html" class="nav__link">Sound Healing</a>
          <a href="book.html" class="nav__link">Sri Yantra Guidebook</a>
          <a href="retreat.html" class="nav__link">Sacred Retreat</a>
          <a href="about.html" class="nav__link">About</a>
          <a href="sound-healing-course.html" class="nav__link nav__link--active">Course</a>
          <a href="donate.html" class="nav__link nav__link--cta">Donate</a>
        </div>
        <button class="burger" id="burger" aria-label="Menu"><span></span><span></span><span></span></button>
      </nav>
    </header>
    <main class="coming-soon"><h1>Sound Healing Course</h1></main>
  </body></html>`;
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.eval(siteSrc);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return w;
}

// --- CSS helpers: pull out the mobile breakpoint block by brace matching ---
function sliceBalanced(src, openBraceIdx) {
  let depth = 0;
  for (let i = openBraceIdx; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(openBraceIdx + 1, i);
    }
  }
  return '';
}

function mobileBlock(css) {
  const m = css.match(/@media[^{]*max-width:\s*768px[^{]*\{/i);
  if (!m) return '';
  return sliceBalanced(css, m.index + m[0].length - 1);
}

const norm = (s) => s.replace(/\s+/g, ' ').toLowerCase();

// ============================================================
// 1. Behaviour - the burger toggle (orientation independent)
// ============================================================
test('burger opens the menu and locks background scroll', () => {
  const w = setupPage();
  const burger = w.document.getElementById('burger');
  const navLinks = w.document.getElementById('navLinks');

  assert.equal(navLinks.classList.contains('nav__links--open'), false, 'starts closed');

  burger.dispatchEvent(new w.Event('click'));

  assert.ok(navLinks.classList.contains('nav__links--open'), 'menu opens');
  assert.ok(burger.classList.contains('burger--open'), 'burger animates to X');
  assert.ok(w.document.body.classList.contains('no-scroll'), 'body scroll is locked');
});

test('tapping a nav link closes the menu and unlocks scroll', () => {
  const w = setupPage();
  const burger = w.document.getElementById('burger');
  const navLinks = w.document.getElementById('navLinks');

  burger.dispatchEvent(new w.Event('click')); // open
  const aboutLink = navLinks.querySelector('a[href="about.html"]');
  aboutLink.dispatchEvent(new w.Event('click'));

  assert.equal(navLinks.classList.contains('nav__links--open'), false, 'menu closed');
  assert.equal(burger.classList.contains('burger--open'), false, 'burger reset');
  assert.equal(w.document.body.classList.contains('no-scroll'), false, 'scroll unlocked');
});

test('burger toggles closed on a second tap', () => {
  const w = setupPage();
  const burger = w.document.getElementById('burger');
  const navLinks = w.document.getElementById('navLinks');

  burger.dispatchEvent(new w.Event('click')); // open
  burger.dispatchEvent(new w.Event('click')); // close

  assert.equal(navLinks.classList.contains('nav__links--open'), false);
  assert.equal(w.document.body.classList.contains('no-scroll'), false);
});

// ============================================================
// 2. CSS contract - full-screen overlay that works in any orientation
// ============================================================
test('mobile breakpoint exists in styles.css', () => {
  assert.notEqual(mobileBlock(cssSrc), '', 'a @media (max-width: 768px) block is present');
});

test('open menu is a full-screen fixed overlay (covers content in portrait & landscape)', () => {
  const block = norm(mobileBlock(cssSrc));
  assert.ok(block.includes('position: fixed'), 'menu is position: fixed');
  assert.ok(block.includes('inset: 0'), 'menu stretches to all four edges (inset: 0)');
});

test('open menu scrolls on short viewports (landscape safety)', () => {
  // In landscape the viewport is short; a centered menu would clip or collide
  // with content without overflow scrolling.
  const block = norm(mobileBlock(cssSrc));
  assert.ok(block.includes('overflow-y: auto'), 'menu allows vertical scrolling');
});

test('header does not trap the fixed menu when open (the overlap fix)', () => {
  // backdrop-filter / transform on an ancestor turns it into the containing
  // block for fixed children, which trapped the menu inside the header bar.
  // While open (body.no-scroll) these must be neutralised on the header.
  const block = norm(mobileBlock(cssSrc));
  assert.ok(
    block.includes('body.no-scroll .header'),
    'there is a body.no-scroll header override'
  );
  assert.ok(
    /body\.no-scroll \.header[^}]*backdrop-filter: none/.test(block) ||
      block.includes('backdrop-filter: none'),
    'backdrop-filter is cleared on the header while the menu is open'
  );
});

test('close button stays above the overlay (tappable in any orientation)', () => {
  const block = norm(mobileBlock(cssSrc));
  assert.ok(block.includes('z-index: 999'), 'menu sits at z-index 999');
  assert.ok(block.includes('z-index: 1001'), 'burger sits above the menu at 1001');
});

test('background scroll is locked globally via body.no-scroll', () => {
  assert.ok(
    norm(cssSrc).includes('body.no-scroll { overflow: hidden'),
    'body.no-scroll hides overflow so the page behind the menu cannot scroll'
  );
});
