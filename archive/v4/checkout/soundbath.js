// ============================================
// Om Sacred Space - Group Sound Bath booking + Mega Events enquiry
// --------------------------------------------
// Progressive enhancement, browser only. Depends on window.OSSPay
// (checkout-core.js) for tiered pricing math.
//
// Flow:
//   - A people stepper (min..max) shows a LIVE total with volume discount.
//   - "Continue to secure payment" POSTs the headcount to a small backend
//     (/api/sound-bath/checkout) which creates a Stripe Checkout Session for
//     the exact group size, then we redirect to the Stripe-hosted page.
//   - If the backend isn't reachable (e.g. static-only preview), we fall back
//     to a prefilled email reservation so the button is never a dead end.
//
// Also wires [data-oss-enquiry] buttons (Mega Sound Events) to the existing
// contact form: scrolls to it, prefills a tagged message.
// ============================================
(function () {
  'use strict';

  var Pay = window.OSSPay;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  // Where the Checkout Session endpoint lives. Same-origin by default; override
  // with window.OSS_API_BASE = 'https://api.example.com' if hosted elsewhere.
  function apiBase() {
    return (typeof window.OSS_API_BASE === 'string' ? window.OSS_API_BASE : '').replace(/\/$/, '');
  }

  // ---- Group Sound Bath widget ---------------------------------------------
  function wireSoundBath() {
    var block = document.querySelector('[data-oss-soundbath]');
    if (!block || !Pay) return;

    var productId = block.getAttribute('data-product') || 'inperson-sound-bath';
    var product = Pay.getProduct(productId);
    if (!product) return;

    var input = block.querySelector('.soundbath__count');
    var totalEl = block.querySelector('#sbTotal');
    var breakdownEl = block.querySelector('#sbBreakdown');
    var savingsEl = block.querySelector('#sbSavings');
    var noteEl = block.querySelector('#sbNote');
    var cta = block.querySelector('#sbCheckout');
    var stepBtns = block.querySelectorAll('.soundbath__step');

    var min = product.minQuantity || 1;
    var max = product.maxQuantity || 99;

    function clamp(n) {
      n = Math.round(Number(n));
      if (!Number.isFinite(n)) n = min;
      if (n < min) n = min;
      if (n > max) n = max;
      return n;
    }

    function currentQty() { return clamp(input.value); }

    function render() {
      var qty = currentQty();
      if (String(qty) !== input.value) input.value = qty;
      var line = Pay.computeTieredLineItem(product, qty);
      totalEl.textContent = line.display.subtotal;
      breakdownEl.textContent = qty + (qty === 1 ? ' person' : ' people') + ' \u00D7 ' + line.display.unit + ' each';
      if (line.savingsMinor > 0) {
        savingsEl.textContent = 'You save ' + line.display.savings + ' with a circle of ' + qty;
        savingsEl.hidden = false;
      } else {
        savingsEl.hidden = true;
      }
    }

    stepBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var delta = Number(btn.getAttribute('data-step')) || 0;
        input.value = clamp(currentQty() + delta);
        render();
      });
    });
    input.addEventListener('input', render);
    input.addEventListener('change', render);

    cta.addEventListener('click', function () {
      var qty = currentQty();
      var originalLabel = cta.textContent;
      cta.disabled = true;
      cta.textContent = 'Preparing your circle\u2026';

      var endpoint = apiBase() + '/api/sound-bath/checkout';
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ productId: productId, people: qty })
      }).then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, data: data }; });
      }).then(function (res) {
        if (res.ok && res.data && res.data.url) {
          window.location.href = res.data.url;
        } else {
          throw new Error((res.data && res.data.error) || 'Checkout unavailable');
        }
      }).catch(function () {
        // Graceful fallback: prefilled email reservation for the chosen size.
        if (noteEl) noteEl.textContent = 'Opening an email reservation\u2026 if nothing happens, write to ' + (Pay.CONTACT_EMAIL || 'us') + '.';
        var mailto = Pay.buildReservationMailto(product, qty, '');
        window.location.href = mailto;
        cta.disabled = false;
        cta.textContent = originalLabel;
      });
    });

    render();
  }

  // ---- Mega Sound Events (and any) enquiry -> contact form -----------------
  function wireEnquiries() {
    var triggers = document.querySelectorAll('[data-oss-enquiry]');
    if (!triggers.length) return;
    var form = document.querySelector('form[action*="formspree.io"]');
    var message = document.getElementById('message');
    var contact = document.getElementById('contact');

    triggers.forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        var topic = el.getAttribute('data-oss-enquiry') || 'Enquiry';

        if (form) {
          // Tag the submission so it lands clearly labelled in the inbox.
          var subj = form.querySelector('input[name="_subject"]');
          if (subj) subj.value = topic + ' enquiry - Om Sacred Space';
          var tag = form.querySelector('input[name="enquiry_type"]');
          if (!tag) {
            tag = document.createElement('input');
            tag.type = 'hidden';
            tag.name = 'enquiry_type';
            form.appendChild(tag);
          }
          tag.value = topic;
        }

        if (message && !message.value.trim()) {
          message.value = 'Hello Suhana,\n\nI would like to enquire about ' + topic +
            '. Here are some details:\n  - Type of event: \n  - Approx. number of people: \n  - Preferred dates / location: \n\nPlease let me know availability and pricing. Thank you.';
        }

        if (contact && contact.scrollIntoView) {
          contact.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // Focus the first empty field for a smooth hand-off.
        var name = document.getElementById('name');
        setTimeout(function () {
          if (name && !name.value.trim()) name.focus();
          else if (message) message.focus();
        }, 400);
      });
    });
  }

  // ---- Post-payment acknowledgement ----------------------------------------
  function showBookingResult() {
    var params;
    try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
    if (params.get('booked') !== 'soundbath') return;
    var block = document.querySelector('[data-oss-soundbath]');
    if (!block) return;
    var note = block.querySelector('#sbNote');
    if (note) {
      note.textContent = '\u2728 Thank you \u2014 your sound bath is booked. We will be in touch with the details.';
      note.classList.add('soundbath__note--success');
    }
    if (block.scrollIntoView) block.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  ready(function () {
    wireSoundBath();
    wireEnquiries();
    showBookingResult();
  });
})();
