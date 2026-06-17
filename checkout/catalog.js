// ============================================
// Om Sacred Space - Checkout: Catalog (data layer)
// --------------------------------------------
// The single source of truth for everything sellable. DATA ONLY - no logic,
// no DOM. Edit prices, add products, and paste Stripe Payment Links here.
//
// Runs in the browser (window.OSSCatalog) and in Node (module.exports) so the
// same data feeds the site and the test suite.
//
// GO LIVE (no code): create a Payment Link per item in the Stripe dashboard,
// enable Apple/Google Pay, then paste each link into PAYMENT_LINKS below.
// An empty string keeps that item on the graceful "reserve by email" fallback.
//
// Money is stored in MINOR units (cents) to avoid floating-point bugs.
// `heading` is the normalized text used to auto-match an on-page card <h3>.
// ============================================
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;          // Node / tests
  }
  if (typeof window !== 'undefined') {
    window.OSSCatalog = api;       // Browser
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CONTACT_EMAIL = 'contact@omsacredspace.com';

  // Test and live are separate Stripe worlds, so we keep separate link sets.
  // The active set is chosen at runtime (see DEFAULT_MODE / setMode in core).
  // The generator writes into the set matching the key you run it with.
  var PAYMENT_LINKS = {
    live: {
      'session-foundations': 'https://buy.stripe.com/cNicMY04t8IK20kd6S9MY0d',
      'session-awakening': 'https://buy.stripe.com/9B67sE4kJbUW20k1oa9MY0e',
      'session-integration': 'https://buy.stripe.com/7sYcMY9F36ACbAU9UG9MY0f',
      'session-transformation': 'https://buy.stripe.com/8x24gs5oN1gidJ29UG9MY0g',
      'inperson-one-on-one': 'https://buy.stripe.com/9B64gs2cBaQS8oI4Am9MY0h',
      'inperson-sound-bath': 'https://buy.stripe.com/3cI6oA18x6ACdJ29UG9MY0i',
      'program-basic': 'https://buy.stripe.com/00w28kdVj4su0Wg5Eq9MY0j',
      'program-advanced': 'https://buy.stripe.com/cNi00c8AZ5wy0Wgff09MY0k',
      'program-family': 'https://buy.stripe.com/7sY4gs18x8IKcEYaYK9MY0l',
      'program-couple-beginner': 'https://buy.stripe.com/cNi8wIeZn9MO0Wg7My9MY0m',
      'program-couple-advanced': 'https://buy.stripe.com/28E6oAcRf8IK8oIc2O9MY0n',
      'program-spiritual-awakening': 'https://buy.stripe.com/fZu28k5oN9MObAU3wi9MY0o',
      'program-deep-healing': 'https://buy.stripe.com/fZu00cg3r3oq7kEeaW9MY0p',
      'program-custom': 'https://buy.stripe.com/eVq7sE6sRbUWdJ2eaW9MY0q',
      'donate-9': 'https://buy.stripe.com/14AcMYcRfe3420k5Eq9MY0r',
      'donate-49': 'https://buy.stripe.com/8x26oA04t9MO0Wg8QC9MY0s',
      'donate-99': 'https://buy.stripe.com/14A14gaJ74subAU7My9MY0t',
      'donate-custom': 'https://buy.stripe.com/3cI3co04t5wy48sd6S9MY0u'
    },
    test: {
      'session-foundations': 'https://buy.stripe.com/test_9B64gzbj8a0l91V7ktfEk02',
      'session-awakening': 'https://buy.stripe.com/test_4gM7sL3QGb4p7XRcENfEk03',
      'session-integration': 'https://buy.stripe.com/test_cNicN5cnca0l5PJ9sBfEk04',
      'session-transformation': 'https://buy.stripe.com/test_eVqbJ11Iy4G13HBcENfEk05',
      'inperson-one-on-one': 'https://buy.stripe.com/test_9B69AT5YO8Wh7XR48hfEk06',
      'inperson-sound-bath': 'https://buy.stripe.com/test_5kQ14nevkegBgun34dfEk07',
      'program-basic': 'https://buy.stripe.com/test_00w4gz9b0b4p0vp9sBfEk08',
      'program-advanced': 'https://buy.stripe.com/test_7sYcN59b02xTemfawFfEk09',
      'program-family': 'https://buy.stripe.com/test_fZu7sL9b0dcx6TN7ktfEk0a',
      'program-couple-beginner': 'https://buy.stripe.com/test_9B628r0Eua0l6TN0W5fEk0b',
      'program-couple-advanced': 'https://buy.stripe.com/test_28E9AT9b08Wh1zteMVfEk0c',
      'program-spiritual-awakening': 'https://buy.stripe.com/test_cNi4gz1Iyc8t6TNcENfEk0d',
      'program-deep-healing': 'https://buy.stripe.com/test_7sYeVddrgdcx2Dx9sBfEk0e',
      'program-custom': 'https://buy.stripe.com/test_bJe4gz4UKgoJba3fQZfEk0g',
      'donate-9': 'https://buy.stripe.com/test_8x2aEXfzo7Sdba38oxfEk0j',
      'donate-49': 'https://buy.stripe.com/test_9B6bJ186Wc8t5PJcENfEk0k',
      'donate-99': 'https://buy.stripe.com/test_14AfZh0Eu5K5fqjdIRfEk0l',
      'donate-custom': 'https://buy.stripe.com/test_bJeaEXfzoc8ta5Z9sBfEk0m'
    }
  };

  // Which set the site uses by default when nothing overrides it.
  var DEFAULT_MODE = 'live';

  function p(o) { return o; }
  var CATALOG = {
    'session-foundations': p({
      id: 'session-foundations', name: 'Foundations', heading: 'Foundations',
      priceMinor: 4500, currency: 'EUR', unit: '1 session', group: 'Distance Healing'
    }),
    'session-awakening': p({
      id: 'session-awakening', name: 'Awakening', heading: 'Awakening',
      priceMinor: 13300, currency: 'EUR', unit: '3 sessions', group: 'Distance Healing', popular: true
    }),
    'session-integration': p({
      id: 'session-integration', name: 'Integration', heading: 'Integration',
      priceMinor: 22200, currency: 'EUR', unit: '3 sessions', group: 'Distance Healing'
    }),
    'session-transformation': p({
      id: 'session-transformation', name: 'Transformation', heading: 'Transformation',
      priceMinor: 110000, currency: 'EUR', unit: 'All sessions + coaching', group: 'Distance Healing'
    }),
    'inperson-one-on-one': p({
      id: 'inperson-one-on-one', name: 'One-on-One Session', heading: 'One-on-One Session',
      priceMinor: 5000, currency: 'EUR', unit: 'single session', group: 'In-Person'
    }),
    'inperson-sound-bath': p({
      id: 'inperson-sound-bath', name: 'Group Sound Bath', heading: 'Sound Bath',
      priceMinor: 2000, currency: 'EUR', unit: 'per person', group: 'In-Person',
      variableQty: true, minQuantity: 5, maxQuantity: 30,
      // Volume pricing: the whole group bills at the unit price of its size tier.
      // `upTo` is the inclusive upper bound of people for that tier (null = no cap).
      tiers: [
        { upTo: 9, unitMinor: 2000 },
        { upTo: 14, unitMinor: 1800 },
        { upTo: 19, unitMinor: 1600 },
        { upTo: null, unitMinor: 1500 }
      ]
    }),
    'program-basic': p({
      id: 'program-basic', name: 'Basic Package', heading: 'Basic Package',
      priceMinor: 22200, currency: 'EUR', unit: '5 sessions', group: 'Programs'
    }),
    'program-advanced': p({
      id: 'program-advanced', name: 'Advanced Package', heading: 'Advanced Package',
      priceMinor: 22200, currency: 'EUR', unit: '5 sessions', group: 'Programs'
    }),
    'program-family': p({
      id: 'program-family', name: 'Family Package', heading: 'Family Package',
      priceMinor: 22200, currency: 'EUR', unit: '5 sessions', group: 'Programs'
    }),
    'program-couple-beginner': p({
      id: 'program-couple-beginner', name: 'Couple Reconnect - Beginners',
      heading: 'Couple Reconnect - Beginners',
      priceMinor: 22200, currency: 'EUR', unit: '5 sessions', group: 'Programs'
    }),
    'program-couple-advanced': p({
      id: 'program-couple-advanced', name: 'Couple Reconnect - Advanced',
      heading: 'Couple Reconnect - Advanced',
      priceMinor: 22200, currency: 'EUR', unit: '5 sessions', group: 'Programs'
    }),
    'program-spiritual-awakening': p({
      id: 'program-spiritual-awakening', name: 'Spiritual Awakening',
      heading: 'Spiritual Awakening',
      priceMinor: 22200, currency: 'EUR', unit: '5 sessions', group: 'Programs'
    }),
    'program-deep-healing': p({
      id: 'program-deep-healing', name: 'Deep Healing & Transformation',
      heading: 'Deep Healing & Transformation',
      priceMinor: 22200, currency: 'EUR', unit: '5 sessions', group: 'Programs'
    }),
    'program-custom': p({
      id: 'program-custom', name: 'Custom Package', heading: 'Custom Package',
      priceMinor: 22200, currency: 'EUR', unit: '5 sessions', group: 'Programs'
    }),
    'donate-9': p({
      id: 'donate-9', name: 'Donation \u2014 9 EUR', heading: 'Donation 9',
      priceMinor: 900, currency: 'EUR', unit: 'one-time gift', group: 'Donation'
    }),
    'donate-49': p({
      id: 'donate-49', name: 'Donation \u2014 49 EUR', heading: 'Donation 49',
      priceMinor: 4900, currency: 'EUR', unit: 'one-time gift', group: 'Donation'
    }),
    'donate-99': p({
      id: 'donate-99', name: 'Donation \u2014 99 EUR', heading: 'Donation 99',
      priceMinor: 9900, currency: 'EUR', unit: 'one-time gift', group: 'Donation'
    }),
    'donate-custom': p({
      id: 'donate-custom', name: 'Donation \u2014 custom amount', heading: 'Donation custom',
      priceMinor: 100, currency: 'EUR', unit: 'choose your gift', group: 'Donation',
      customAmount: true, customMinMinor: 100, customPresetMinor: 2500
    }),
    'shop-lotus-tee': p({
      id: 'shop-lotus-tee', name: 'Lotus Bloom Meditation Tee', heading: 'Lotus Bloom Meditation Tee',
      priceMinor: 1900, currency: 'GBP', unit: 'organic cotton tee', group: 'Store',
      checkoutUrl: 'https://sacredshop.teemill.com/product/api-69587on1IoCRIWqe6LhiaoRc'
    })
  };

  return {
    CONTACT_EMAIL: CONTACT_EMAIL,
    PAYMENT_LINKS: PAYMENT_LINKS,
    DEFAULT_MODE: DEFAULT_MODE,
    CATALOG: CATALOG
  };
});
