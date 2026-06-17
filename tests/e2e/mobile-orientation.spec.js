// ============================================
// Om Sacred Space - Mobile orientation E2E (Playwright, OPT-IN)
//
// Real rendered checks that the open mobile menu fills the screen and covers
// page content in BOTH portrait and landscape, and that every nav link is
// reachable on short landscape viewports.
//
// Not part of `npm test` (no browser download required for the default suite).
// To run:
//   npm i -D @playwright/test
//   npx playwright install chromium
//   npm run test:e2e
// ============================================
'use strict';

const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// A page that bakes in `header--scrolled` - this is where the overlap bug hit.
const pageUrl = pathToFileURL(
  path.join(__dirname, '..', '..', 'sound-healing-course.html')
).href;

const orientations = [
  { name: 'portrait', width: 390, height: 844 },
  { name: 'landscape', width: 844, height: 390 },
];

for (const o of orientations) {
  test.describe(`mobile ${o.name} (${o.width}x${o.height})`, () => {
    test.use({ viewport: { width: o.width, height: o.height } });

    test('open menu fills the viewport from the top-left corner', async ({ page }) => {
      await page.goto(pageUrl);
      await page.locator('#burger').click();

      const menu = page.locator('#navLinks');
      await expect(menu).toBeVisible();

      const box = await menu.boundingBox();
      expect(box, 'menu has a layout box').not.toBeNull();
      // A full-screen fixed overlay: anchored at 0,0 and the size of the viewport.
      expect(Math.round(box.x)).toBe(0);
      expect(Math.round(box.y)).toBe(0);
      expect(Math.round(box.width)).toBe(o.width);
      expect(Math.round(box.height)).toBe(o.height);
    });

    test('open menu hides the page heading behind it', async ({ page }) => {
      await page.goto(pageUrl);
      await page.locator('#burger').click();

      // The hero <h1> must be painted under the opaque overlay: clicking at its
      // location should land on the menu, not the heading.
      const topElIsMenuDescendant = await page.evaluate(() => {
        const menu = document.getElementById('navLinks');
        const el = document.elementFromPoint(
          Math.round(window.innerWidth / 2),
          Math.round(window.innerHeight / 2)
        );
        return !!el && (el === menu || menu.contains(el));
      });
      expect(topElIsMenuDescendant).toBe(true);
    });

    test('every nav link is reachable (scrollable in landscape)', async ({ page }) => {
      await page.goto(pageUrl);
      await page.locator('#burger').click();

      const links = page.locator('#navLinks .nav__link');
      const count = await links.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await links.nth(i).scrollIntoViewIfNeeded();
        await expect(links.nth(i)).toBeVisible();
      }
    });
  });
}
