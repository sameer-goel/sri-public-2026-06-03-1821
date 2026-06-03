// ===== PORTAL ENGINE =====
(function() {
  // Immediate flash prevention
  const portalEnabled = localStorage.getItem('portal-enabled') !== 'false';
  const portalViewed = sessionStorage.getItem('portal-viewed') === 'true';
  if (!portalEnabled || portalViewed) {
    document.documentElement.classList.add('portal-hidden');
  }
})();

(function() {
  const TIMING = {
    splashFade: 800,
    tunnelDur: 6000,
    welcomeHold: 1500,
    welcomeFade: 1500,
  };

  const splash = document.getElementById('portalSplash');
  const tunnel = document.getElementById('portalTunnel');
  const arrive = document.getElementById('portalArrive');
  const tunnelCanvas = document.getElementById('tunnelCanvas');
  const tunnelRings = document.getElementById('tunnelRings');
  const tunnelYantra = document.getElementById('tunnelYantra');
  const soundToggle = document.getElementById('soundToggle');
  const soundOnIcon = document.getElementById('soundOn');
  const soundOffIcon = document.getElementById('soundOff');

  // Check if disabled globally or already viewed in this session
  const isEnabled = localStorage.getItem('portal-enabled') !== 'false';
  if (!isEnabled || (!window.BYPASS_PORTAL_CHECK && sessionStorage.getItem('portal-viewed') === 'true')) {
    if (splash) splash.remove();
    if (tunnel) tunnel.remove();
    if (arrive) arrive.remove();
    if (document.getElementById('portalWelcome')) document.getElementById('portalWelcome').remove();
    if (soundToggle) soundToggle.classList.add('sound-toggle--visible');
    return;
  }

  const SOUND_URL = window.PORTAL_SOUND_URL || 'singing-bowl-hit-3-33366.mp3';
  let audio = null, soundPlaying = false;

  function updateToggleIcon() {
    if (soundOnIcon) soundOnIcon.style.display = soundPlaying ? '' : 'none';
    if (soundOffIcon) soundOffIcon.style.display = soundPlaying ? 'none' : '';
  }
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Starfield
  const starfield = (function() {
    if (!tunnelCanvas) return { start: () => {}, stop: () => {}, rampSpeed: () => {} };
    const ctx = tunnelCanvas.getContext('2d');
    let W, H, stars = [], speed = 0.3, raf, running = false;
    function resize() { W = tunnelCanvas.width = window.innerWidth; H = tunnelCanvas.height = window.innerHeight; }
    function init() {
      resize(); window.addEventListener('resize', resize);
      stars = [];
      for (let i = 0; i < 500; i++) stars.push({ x: (Math.random()-0.5)*W*3, y: (Math.random()-0.5)*H*3, z: Math.random()*2000, o: Math.random() });
    }
    function draw() {
      ctx.fillStyle = 'rgba(5,3,17,0.25)'; ctx.fillRect(0,0,W,H);
      const cx = W/2, cy = H/2;
      for (const s of stars) {
        s.z -= speed;
        if (s.z <= 0) { s.z = 2000; s.x = (Math.random()-0.5)*W*3; s.y = (Math.random()-0.5)*H*3; }
        const sx = (s.x/s.z)*500+cx, sy = (s.y/s.z)*500+cy;
        if (sx < -50 || sx > W+50 || sy < -50 || sy > H+50) continue;
        const depth = 1 - s.z/2000, r = depth * (speed > 8 ? 2.5 : 1.5);
        if (speed > 4) {
          const pz = s.z+speed*3, px = (s.x/pz)*500+cx, py = (s.y/pz)*500+cy;
          ctx.strokeStyle = `hsla(${260+s.o*60},70%,70%,${depth*0.5})`; ctx.lineWidth = r*0.6;
          ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(sx,sy); ctx.stroke();
        }
        const hue = speed > 4 ? 260+s.o*80 : 40+s.o*20, lum = speed > 4 ? 70+s.o*20 : 80;
        ctx.fillStyle = `hsla(${hue},50%,${lum}%,${depth*0.8})`;
        ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2); ctx.fill();
      }
      if (running) raf = requestAnimationFrame(draw);
    }
    return {
      start() { init(); running = true; draw(); },
      stop() { running = false; cancelAnimationFrame(raf); },
      rampSpeed(from, to, duration) {
        const start = performance.now();
        const tick = () => { const t = Math.min((performance.now()-start)/duration,1); speed = from+(to-from)*t*t; if (t < 1 && running) requestAnimationFrame(tick); };
        tick();
      }
    };
  })();

  // Rings
  (function() {
    if (!tunnelRings) return;
    const count = 18, totalDur = TIMING.tunnelDur/1000;
    for (let i = 0; i < count; i++) {
      const ring = document.createElement('div'); ring.className = 'tunnel-ring';
      const size = 30+i*25; ring.style.width = size+'px'; ring.style.height = size+'px';
      ring.style.setProperty('--ring-delay', ((i/count)*totalDur*0.7)+'s');
      ring.style.setProperty('--ring-dur', (totalDur*0.6+Math.random()*0.5)+'s');
      const hue = 40-(i/count)*100, sat = 50+(i/count)*20;
      ring.style.borderColor = `hsla(${hue},${sat}%,60%,${0.08+(i/count)*0.18})`;
      ring.style.boxShadow = `0 0 ${8+i*2}px hsla(${hue},${sat}%,60%,0.04), inset 0 0 ${6+i}px hsla(280,50%,60%,0.02)`;
      tunnelRings.appendChild(ring);
    }
  })();

  function fireRings() { if (tunnelRings) tunnelRings.querySelectorAll('.tunnel-ring').forEach(r => r.classList.add('tunnel-ring--go')); }

  // Main flow
  let started = false;
  if (splash) {
    splash.addEventListener('click', async () => {
      if (started) return; started = true;

      audio = new Audio(SOUND_URL); audio.loop = false; audio.volume = 0.5;
      audio.play().then(() => { soundPlaying = true; updateToggleIcon(); }).catch(() => {});

      tunnel.classList.add('portal-tunnel--active');
      starfield.start();
      splash.classList.add('portal-splash--hidden');
      await wait(TIMING.splashFade); splash.style.display = 'none';

      starfield.rampSpeed(0.3, 50, TIMING.tunnelDur);
      fireRings();

      await wait(400);
      tunnelYantra.style.setProperty('--tunnel-total', (TIMING.tunnelDur-400)+'ms');
      tunnelYantra.classList.add('portal-tunnel__yantra--grow');

      await wait((TIMING.tunnelDur-400)*0.7);
      document.getElementById('tunnelFlash').classList.add('portal-tunnel__flash--active');
      await wait((TIMING.tunnelDur-400)*0.3);

      starfield.stop();

      const welcome = document.getElementById('portalWelcome');
      const welcomeTop = document.getElementById('welcomeTop');
      const welcomeMain = document.getElementById('welcomeMain');
      tunnel.classList.add('portal-tunnel--fading');
      welcome.classList.add('portal-welcome--active');

      const topText = welcomeTop.querySelector('.welcome-ink__text');
      const topPen = welcomeTop.querySelector('.welcome-ink__pen');
      const topGlow = welcomeTop.querySelector('.welcome-ink__glow');
      topText.style.setProperty('--ink-dur','1.2s'); topText.style.setProperty('--ink-delay','0.3s');
      topPen.style.setProperty('--ink-dur','1.2s'); topPen.style.setProperty('--ink-delay','0.3s');
      topGlow.style.setProperty('--ink-delay','0.3s');
      topText.classList.add('welcome-ink__text--writing');
      topPen.classList.add('welcome-ink__pen--active');
      topGlow.classList.add('welcome-ink__glow--active');
      await wait(1700);

      const mainText = welcomeMain.querySelector('.welcome-ink__text');
      const mainPen = welcomeMain.querySelector('.welcome-ink__pen');
      const mainGlow = welcomeMain.querySelector('.welcome-ink__glow');
      mainText.style.setProperty('--ink-dur','2s'); mainText.style.setProperty('--ink-delay','0s');
      mainPen.style.setProperty('--ink-dur','2s'); mainPen.style.setProperty('--ink-delay','0s');
      mainGlow.style.setProperty('--ink-delay','0s');
      mainText.classList.add('welcome-ink__text--writing');
      mainPen.classList.add('welcome-ink__pen--active');
      mainGlow.classList.add('welcome-ink__glow--active');
      await wait(2200);
      await wait(TIMING.welcomeHold);

      welcome.classList.add('portal-welcome--fading');
      soundToggle.classList.add('sound-toggle--visible');
      await wait(TIMING.welcomeFade);

      // Mark as viewed
      sessionStorage.setItem('portal-viewed', 'true');

      splash.remove(); tunnel.remove(); arrive.remove(); welcome.remove();
    });
  }

  if (soundToggle) {
    soundToggle.addEventListener('click', () => {
      if (!audio) return;
      if (soundPlaying) { audio.pause(); soundPlaying = false; }
      else { audio.play(); soundPlaying = true; }
      updateToggleIcon();
    });
  }
})();


// ===== HOME RE-ENTRY ANIMATION =====
(function() {
  const logo = document.querySelector('.logo');
  const reentry = document.getElementById('homeReentry');
  const canvas = document.getElementById('homeReentryCanvas');
  const ringsContainer = document.getElementById('homeReentryRings');
  const flashEl = document.getElementById('homeReentryFlash');
  const yantra = document.getElementById('homeReentryYantra');
  if (!logo || !reentry || !canvas) return;

  // The overlay starts VISIBLE (dark, blocking).
  // Hide it on page load so user sees the site.
  // If the portal splash is active, wait for it to finish first.
  const portalViewed = sessionStorage.getItem('portal-viewed') === 'true';
  const portalEnabled = localStorage.getItem('portal-enabled') !== 'false';
  if (!portalEnabled || portalViewed) {
    // No portal - hide the re-entry overlay immediately
    reentry.classList.add('home-reentry--hidden');
  } else {
    // Portal is playing - watch for it to finish, then hide re-entry
    const obs = new MutationObserver(() => {
      if (sessionStorage.getItem('portal-viewed') === 'true') {
        reentry.classList.add('home-reentry--hidden');
        obs.disconnect();
      }
    });
    // Poll via interval as fallback (sessionStorage changes don't fire mutations)
    const poll = setInterval(() => {
      if (sessionStorage.getItem('portal-viewed') === 'true') {
        reentry.classList.add('home-reentry--hidden');
        clearInterval(poll);
      }
    }, 200);
  }

  const DURATION = 4500;
  let animating = false;

  // Mini starfield for re-entry
  function createStarfield() {
    const ctx = canvas.getContext('2d');
    let W, H, stars = [], speed = 0.3, raf, running = false;
    function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
    function init() {
      resize();
      stars = [];
      for (let i = 0; i < 400; i++) stars.push({ x: (Math.random()-0.5)*W*3, y: (Math.random()-0.5)*H*3, z: Math.random()*2000, o: Math.random() });
    }
    function draw() {
      ctx.fillStyle = 'rgba(5,3,17,0.25)'; ctx.fillRect(0,0,W,H);
      const cx = W/2, cy = H/2;
      for (const s of stars) {
        s.z -= speed;
        if (s.z <= 0) { s.z = 2000; s.x = (Math.random()-0.5)*W*3; s.y = (Math.random()-0.5)*H*3; }
        const sx = (s.x/s.z)*500+cx, sy = (s.y/s.z)*500+cy;
        if (sx < -50 || sx > W+50 || sy < -50 || sy > H+50) continue;
        const depth = 1 - s.z/2000, r = depth * (speed > 8 ? 2.5 : 1.5);
        if (speed > 4) {
          const pz = s.z+speed*3, px = (s.x/pz)*500+cx, py = (s.y/pz)*500+cy;
          ctx.strokeStyle = `hsla(${260+s.o*60},70%,70%,${depth*0.5})`; ctx.lineWidth = r*0.6;
          ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(sx,sy); ctx.stroke();
        }
        const hue = speed > 4 ? 260+s.o*80 : 40+s.o*20, lum = speed > 4 ? 70+s.o*20 : 80;
        ctx.fillStyle = `hsla(${hue},50%,${lum}%,${depth*0.8})`;
        ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2); ctx.fill();
      }
      if (running) raf = requestAnimationFrame(draw);
    }
    return {
      start() { init(); running = true; draw(); },
      stop() { running = false; cancelAnimationFrame(raf); ctx.clearRect(0,0,W,H); },
      rampSpeed(from, to, duration) {
        const start = performance.now();
        const tick = () => { const t = Math.min((performance.now()-start)/duration,1); speed = from+(to-from)*t*t; if (t < 1 && running) requestAnimationFrame(tick); };
        tick();
      }
    };
  }

  // Create rings
  function buildRings() {
    ringsContainer.innerHTML = '';
    const count = 14, totalDur = DURATION/1000;
    for (let i = 0; i < count; i++) {
      const ring = document.createElement('div'); ring.className = 'tunnel-ring';
      const size = 30+i*25; ring.style.width = size+'px'; ring.style.height = size+'px';
      ring.style.setProperty('--ring-delay', ((i/count)*totalDur*0.7)+'s');
      ring.style.setProperty('--ring-dur', (totalDur*0.6+Math.random()*0.4)+'s');
      const hue = 40-(i/count)*100, sat = 50+(i/count)*20;
      ring.style.borderColor = `hsla(${hue},${sat}%,60%,${0.08+(i/count)*0.18})`;
      ring.style.boxShadow = `0 0 ${8+i*2}px hsla(${hue},${sat}%,60%,0.04), inset 0 0 ${6+i}px hsla(280,50%,60%,0.02)`;
      ringsContainer.appendChild(ring);
    }
  }

  function fireRings() {
    ringsContainer.querySelectorAll('.tunnel-ring').forEach(r => r.classList.add('tunnel-ring--go'));
  }

  function resetRings() {
    ringsContainer.querySelectorAll('.tunnel-ring').forEach(r => r.classList.remove('tunnel-ring--go'));
  }

  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  logo.addEventListener('click', async function(e) {
    e.preventDefault();
    if (animating) return;
    animating = true;

    // 1. Show the dark overlay instantly by removing the hidden class
    //    (no transition when showing - transition only applies when hiding)
    reentry.style.transition = 'none';
    reentry.classList.remove('home-reentry--hidden');
    reentry.offsetHeight; // force repaint
    reentry.style.transition = '';

    // 2. Scroll to top while fully covered
    window.scrollTo({ top: 0, behavior: 'instant' });

    // 3. Run the tunnel animation on the dark background
    buildRings();
    const starfield = createStarfield();
    starfield.start();
    starfield.rampSpeed(0.3, 45, DURATION);
    fireRings();

    // Yantra approach (image comes from the tunnel)
    await wait(300);
    yantra.style.setProperty('--tunnel-total', (DURATION - 300) + 'ms');
    yantra.classList.add('home-reentry__yantra--grow');

    // Flash near the end
    await wait((DURATION - 300) * 0.75);
    flashEl.classList.add('home-reentry__flash--active');
    await wait((DURATION - 300) * 0.25);

    // Stop starfield
    starfield.stop();

    // 4. Fade the overlay away to reveal the hero underneath
    reentry.classList.add('home-reentry--hidden');
    await wait(1200);

    // 5. Reset for next use
    yantra.classList.remove('home-reentry__yantra--grow');
    yantra.style.opacity = '0';
    flashEl.classList.remove('home-reentry__flash--active');
    resetRings();
    animating = false;
  });
})();
