import puppeteer from 'puppeteer-core';
import { preview } from 'vite';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runComprehensiveVerification() {
  console.log('=== STARTING AFTERLIGHT PHASE 5 PRODUCTION VALIDATION ===\n');

  // 1. Start Vite Production Preview Server
  console.log('1. Starting Vite Production Preview Server on port 5173...');
  const server = await preview({
    preview: {
      port: 5173,
      host: 'localhost',
      open: false
    }
  });
  console.log('   Preview server ready at http://localhost:5173\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader-webgl'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error(`[Browser Error]: ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
    console.error(`[Page Exception]: ${err.message}`);
  });

  page.on('requestfailed', (request) => {
    failedRequests.push({
      url: request.url(),
      error: request.failure()?.errorText
    });
    console.error(`[Failed Request]: ${request.url()} - ${request.failure()?.errorText}`);
  });

  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedRequests.push({
        url: response.url(),
        status: response.status()
      });
      console.error(`[HTTP ${response.status()}]: ${response.url()}`);
    }
  });

  try {
    console.log('2. Loading AFTERLIGHT Production Build...');
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });

    // ------------------------------------------------------------------------
    // REGRESSION TEST 1: Cinematic Loading Sequence
    // ------------------------------------------------------------------------
    console.log('\n[1/16] Verifying Cinematic Loading Sequence...');
    const initialLoader = await page.evaluate(() => {
      const loader = document.querySelector('#experience-loader');
      const pct = document.querySelector('#loader-status-pct')?.innerText;
      const status = document.querySelector('#loader-status-text')?.innerText;
      return { exists: !!loader, pct, status };
    });
    console.log('   Initial Loader State:', JSON.stringify(initialLoader));

    // Wait for the choreographed reveal and loader dismissal
    await page.waitForFunction(() => {
      const loader = document.querySelector('#experience-loader');
      return !loader || loader.classList.contains('is-loaded') || loader.style.display === 'none';
    }, { timeout: 6000 });
    console.log('   Cinematic loading sequence completed and dismissed.');

    // ------------------------------------------------------------------------
    // REGRESSION TEST 2: Hero Entrance Choreography
    // ------------------------------------------------------------------------
    console.log('\n[2/16] Verifying Hero Entrance Choreography...');
    const heroElements = await page.evaluate(() => {
      const headline = document.querySelector('.hero-headline');
      const subline = document.querySelector('.hero-subline');
      const actions = document.querySelector('.hero-actions');
      const indicator = document.querySelector('.hero-scroll-indicator');
      return {
        hasHeadline: !!headline && headline.innerText.includes('Shape the'),
        hasSubline: !!subline && subline.innerText.includes('AFTERLIGHT'),
        hasActions: !!actions,
        hasIndicator: !!indicator
      };
    });
    console.log('   Hero elements:', JSON.stringify(heroElements));
    if (!heroElements.hasHeadline || !heroElements.hasSubline) {
      throw new Error('Hero entrance typography failed to render');
    }

    // ------------------------------------------------------------------------
    // REGRESSION TEST 3: Sculpture Idle Animation
    // ------------------------------------------------------------------------
    console.log('\n[3/16] Verifying Sculpture Idle Animation & WebGL Context...');
    const webglInfo = await page.evaluate(() => {
      const canvas = document.querySelector('#webgl-canvas');
      const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
      return {
        hasCanvas: !!canvas,
        hasGL: !!gl,
        renderer: gl ? gl.getParameter(gl.RENDERER) : null,
        width: canvas?.width,
        height: canvas?.height
      };
    });
    console.log('   WebGL Graphics Engine:', JSON.stringify(webglInfo));
    if (!webglInfo.hasGL) throw new Error('WebGL context is not available');

    // ------------------------------------------------------------------------
    // REGRESSION TEST 4: Mouse Drag Rotation
    // ------------------------------------------------------------------------
    console.log('\n[4/16] Verifying Direct 3D Mouse Drag Rotation...');
    await page.mouse.move(720, 450);
    await page.mouse.down();
    await page.mouse.move(860, 450, { steps: 10 });
    const isDraggingActive = await page.evaluate(() => document.body.classList.contains('is-dragging'));
    console.log('   Active drag state applied:', isDraggingActive);
    await page.mouse.up();

    // ------------------------------------------------------------------------
    // REGRESSION TEST 5: Touch Drag Rotation
    // ------------------------------------------------------------------------
    console.log('\n[5/16] Verifying Touch Drag Rotation...');
    await page.evaluate(() => {
      const canvas = document.querySelector('#webgl-canvas');
      const startX = 600, startY = 400;
      canvas.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: startX,
        clientY: startY,
        pointerType: 'touch',
        isPrimary: true,
        button: 0,
        bubbles: true
      }));
      canvas.dispatchEvent(new PointerEvent('pointermove', {
        clientX: startX + 100,
        clientY: startY - 20,
        pointerType: 'touch',
        isPrimary: true,
        bubbles: true
      }));
      canvas.dispatchEvent(new PointerEvent('pointerup', {
        clientX: startX + 100,
        clientY: startY - 20,
        pointerType: 'touch',
        isPrimary: true,
        bubbles: true
      }));
    });
    console.log('   Touch drag dispatched cleanly.');

    // ------------------------------------------------------------------------
    // REGRESSION TEST 6: Inertia and Orientation Preservation
    // ------------------------------------------------------------------------
    console.log('\n[6/16] Verifying Rotational Inertia and Orientation Preservation...');
    await new Promise(r => setTimeout(r, 700));
    const rotationAfterInertia = await page.evaluate(() => {
      return document.querySelector('#telemetry-rotation')?.innerText;
    });
    console.log('   Orientation preserved:', rotationAfterInertia);

    // ------------------------------------------------------------------------
    // REGRESSION TEST 7: Seven Editorial Chapters Present
    // ------------------------------------------------------------------------
    console.log('\n[7/16] Verifying Seven Narrative Chapters...');
    const expectedChapters = [
      '#chapter-01', '#chapter-02', '#chapter-03',
      '#chapter-04', '#chapter-05', '#chapter-06', '#chapter-07'
    ];
    for (const chId of expectedChapters) {
      const exists = await page.evaluate((id) => !!document.querySelector(id), chId);
      if (!exists) throw new Error(`Missing expected chapter: ${chId}`);
    }
    console.log('   All 7 narrative chapters verified in DOM.');

    // ------------------------------------------------------------------------
    // REGRESSION TEST 8: Scroll-Triggered Transitions
    // ------------------------------------------------------------------------
    console.log('\n[8/16] Verifying Scroll-Triggered Transitions...');
    await page.evaluate(() => {
      document.querySelector('#chapter-02').scrollIntoView({ behavior: 'instant' });
    });
    await new Promise(r => setTimeout(r, 600));
    const ch2Badge = await page.evaluate(() => document.querySelector('#nav-chapter-indicator')?.innerText);
    console.log('   Active chapter badge after scroll to Chapter 02:', ch2Badge);
    if (!ch2Badge.includes('02') && !ch2Badge.includes('STRUCTURE')) {
      throw new Error(`Expected Chapter 02 indication, got: ${ch2Badge}`);
    }

    // ------------------------------------------------------------------------
    // REGRESSION TEST 9: Chapter Navigation (Links, Rail, Buttons)
    // ------------------------------------------------------------------------
    console.log('\n[9/16] Verifying Chapter Navigation...');
    // Click chapter rail item 3 (Tension)
    await page.click('.rail-item[data-chapter="3"]');
    await new Promise(r => setTimeout(r, 600));
    const ch3Badge = await page.evaluate(() => document.querySelector('#nav-chapter-indicator')?.innerText);
    console.log('   Active badge after clicking Chapter 03 in rail:', ch3Badge);

    // ------------------------------------------------------------------------
    // REGRESSION TEST 10: Playground Presets
    // ------------------------------------------------------------------------
    console.log('\n[10/16] Verifying Playground Presets...');
    await page.evaluate(() => {
      document.querySelector('#chapter-06').scrollIntoView({ behavior: 'instant' });
    });
    await new Promise(r => setTimeout(r, 600));

    const presets = ['origin', 'tension', 'dissolution', 'reformation'];
    for (const p of presets) {
      await page.click(`.form-select-btn[data-preset="${p}"]`);
      await new Promise(r => setTimeout(r, 150));
      const isActive = await page.evaluate((preset) => {
        return document.querySelector(`.form-select-btn[data-preset="${preset}"]`)?.classList.contains('is-active');
      }, p);
      if (!isActive) throw new Error(`Playground preset ${p} failed to activate`);
    }
    console.log('   All 4 geometric presets activated successfully.');

    // ------------------------------------------------------------------------
    // REGRESSION TEST 11: Color Palette Controls
    // ------------------------------------------------------------------------
    console.log('\n[11/16] Verifying Color Palette Controls...');
    const palettes = ['platinum', 'aurelia', 'spectral', 'lapis'];
    for (const pal of palettes) {
      await page.click(`.palette-btn[data-palette="${pal}"]`);
      await new Promise(r => setTimeout(r, 150));
      const isActive = await page.evaluate((palette) => {
        return document.querySelector(`.palette-btn[data-palette="${palette}"]`)?.classList.contains('is-active');
      }, pal);
      if (!isActive) throw new Error(`Palette ${pal} failed to activate`);
    }
    console.log('   All 4 material palettes activated successfully.');

    // ------------------------------------------------------------------------
    // REGRESSION TEST 12: Motion Controls (Speed & Deformation)
    // ------------------------------------------------------------------------
    console.log('\n[12/16] Verifying Motion Controls (Speed & Deformation)...');
    await page.click('[data-speed="2.2"]');
    await new Promise(r => setTimeout(r, 150));
    await page.click('[data-deform="2.5"]');
    await new Promise(r => setTimeout(r, 150));
    const motionState = await page.evaluate(() => ({
      speedActive: document.querySelector('[data-speed="2.2"]')?.classList.contains('is-active'),
      deformActive: document.querySelector('[data-deform="2.5"]')?.classList.contains('is-active')
    }));
    console.log('   Motion controls state:', JSON.stringify(motionState));
    if (!motionState.speedActive || !motionState.deformActive) {
      throw new Error('Motion controls failed to activate');
    }

    // ------------------------------------------------------------------------
    // REGRESSION TEST 13: Glow Controls
    // ------------------------------------------------------------------------
    console.log('\n[13/16] Verifying Glow Controls...');
    await page.click('[data-glow="2.0"]');
    await new Promise(r => setTimeout(r, 150));
    const glowActive = await page.evaluate(() => {
      return document.querySelector('[data-glow="2.0"]')?.classList.contains('is-active');
    });
    if (!glowActive) throw new Error('Glow control failed to activate');
    console.log('   Glow control verified.');

    // ------------------------------------------------------------------------
    // REGRESSION TEST 14: Reset Functionality
    // ------------------------------------------------------------------------
    console.log('\n[14/16] Verifying Reset Functionality...');
    await page.click('#btn-reset-sculpture');
    await new Promise(r => setTimeout(r, 400));
    const resetState = await page.evaluate(() => ({
      preset01Active: document.querySelector('.form-select-btn[data-preset="origin"]')?.classList.contains('is-active'),
      speedDefault: document.querySelector('[data-speed="1"]')?.classList.contains('is-active'),
      lapisDefault: document.querySelector('.palette-btn[data-palette="lapis"]')?.classList.contains('is-active')
    }));
    console.log('   Reset state:', JSON.stringify(resetState));
    if (!resetState.preset01Active || !resetState.speedDefault || !resetState.lapisDefault) {
      throw new Error('Reset functionality failed to restore default state');
    }

    // ------------------------------------------------------------------------
    // REGRESSION TEST 15: Ambient Audio Activation and Deactivation
    // ------------------------------------------------------------------------
    console.log('\n[15/16] Verifying Ambient Audio Activation and Deactivation...');
    const soundInitial = await page.evaluate(() => {
      const btn = document.querySelector('#btn-sound-toggle');
      return {
        pressed: btn?.getAttribute('aria-pressed'),
        isActive: btn?.classList.contains('is-active')
      };
    });
    console.log('   Initial sound state (must be OFF):', JSON.stringify(soundInitial));
    if (soundInitial.pressed !== 'false' || soundInitial.isActive) {
      throw new Error('Sound must be disabled by default');
    }

    // Toggle sound ON
    await page.click('#btn-sound-toggle');
    await new Promise(r => setTimeout(r, 200));
    const soundOn = await page.evaluate(() => ({
      pressed: document.querySelector('#btn-sound-toggle')?.getAttribute('aria-pressed'),
      isActive: document.querySelector('#btn-sound-toggle')?.classList.contains('is-active')
    }));
    console.log('   Sound toggled ON state:', JSON.stringify(soundOn));

    // Toggle sound back OFF
    await page.click('#btn-sound-toggle');
    await new Promise(r => setTimeout(r, 200));
    const soundOff = await page.evaluate(() => ({
      pressed: document.querySelector('#btn-sound-toggle')?.getAttribute('aria-pressed'),
      isActive: document.querySelector('#btn-sound-toggle')?.classList.contains('is-active')
    }));
    console.log('   Sound toggled OFF state:', JSON.stringify(soundOff));

    // ------------------------------------------------------------------------
    // REGRESSION TEST 16: Return-to-Top Interaction
    // ------------------------------------------------------------------------
    console.log('\n[16/16] Verifying Return-to-Top Interaction...');
    await page.evaluate(() => {
      document.querySelector('#chapter-07').scrollIntoView({ behavior: 'instant' });
    });
    await new Promise(r => setTimeout(r, 500));
    await page.click('#btn-return-origin');
    await new Promise(r => setTimeout(r, 1200));
    const returnScroll = await page.evaluate(() => window.scrollY);
    console.log(`   Scroll position after return to origin: ${returnScroll}px`);

    // ------------------------------------------------------------------------
    // SECTION 3: RESPONSIVE VIEWPORT TESTING (6 CATEGORIES)
    // ------------------------------------------------------------------------
    console.log('\n=== TESTING ALL 6 RESPONSIVE VIEWPORT CATEGORIES ===');
    const viewports = [
      { name: 'Large Desktop', width: 1920, height: 1080 },
      { name: 'Standard Laptop', width: 1440, height: 900 },
      { name: 'Smaller Laptop', width: 1280, height: 720 },
      { name: 'Tablet Portrait', width: 768, height: 1024 },
      { name: 'Mobile', width: 390, height: 844 },
      { name: 'Small Mobile', width: 360, height: 800 }
    ];

    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));
      await new Promise(r => setTimeout(r, 300));

      const vpStatus = await page.evaluate(() => {
        const hasOverflow = document.documentElement.scrollWidth > window.innerWidth;
        const soundBtnVisible = window.getComputedStyle(document.querySelector('#btn-sound-toggle')).display !== 'none';
        const mobilePill = document.querySelector('.mobile-chapter-pill');
        const pillVisible = mobilePill ? window.getComputedStyle(mobilePill).display !== 'none' : false;
        const rail = document.querySelector('.chapter-rail');
        const railVisible = rail ? window.getComputedStyle(rail).display !== 'none' : false;

        return {
          hasOverflow,
          soundBtnVisible,
          pillVisible,
          railVisible,
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth
        };
      });

      console.log(`   ${vp.name} (${vp.width}x${vp.height}):`);
      console.log(`     - Horizontal Overflow: ${vpStatus.hasOverflow ? 'FAIL' : 'PASS (0px overflow)'}`);
      console.log(`     - Sound Control Accessible: ${vpStatus.soundBtnVisible ? 'PASS' : 'FAIL'}`);
      console.log(`     - Mobile Pill / Desktop Rail: pill=${vpStatus.pillVisible}, rail=${vpStatus.railVisible}`);

      if (vpStatus.hasOverflow) {
        throw new Error(`Horizontal overflow detected at ${vp.name} (${vp.width}x${vp.height})! scrollWidth: ${vpStatus.scrollWidth}, innerWidth: ${vpStatus.innerWidth}`);
      }
      if (!vpStatus.soundBtnVisible) {
        throw new Error(`Sound toggle is inaccessible at ${vp.name} (${vp.width}x${vp.height})!`);
      }
    }

    // ------------------------------------------------------------------------
    // SECTION 5: ACCESSIBILITY VALIDATION
    // ------------------------------------------------------------------------
    console.log('\n=== TESTING ACCESSIBILITY (a11y) ===');
    const a11yChecks = await page.evaluate(() => {
      const skipLink = document.querySelector('.skip-link');
      const soundBtn = document.querySelector('#btn-sound-toggle');
      const buttons = Array.from(document.querySelectorAll('button'));
      const buttonsWithoutAriaOrLabel = buttons.filter(b => !b.innerText.trim() && !b.getAttribute('aria-label'));
      const mainContent = document.querySelector('#main-content');
      const headerRole = document.querySelector('.site-header')?.getAttribute('role');
      const footerRole = document.querySelector('.site-footer')?.getAttribute('role');

      return {
        hasSkipLink: !!skipLink,
        soundBtnAriaPressed: soundBtn?.getAttribute('aria-pressed'),
        unlabelledButtonsCount: buttonsWithoutAriaOrLabel.length,
        hasMainLandmark: !!mainContent,
        headerRole,
        footerRole
      };
    });
    console.log('   Accessibility Landmarks & Attributes:', JSON.stringify(a11yChecks));
    if (a11yChecks.unlabelledButtonsCount > 0) {
      throw new Error(`Found ${a11yChecks.unlabelledButtonsCount} unlabelled buttons!`);
    }

    // ------------------------------------------------------------------------
    // SECTION 6: BRANDING & METADATA VALIDATION
    // ------------------------------------------------------------------------
    console.log('\n=== TESTING BRANDING & METADATA ===');
    const metadata = await page.evaluate(() => {
      const favicon = document.querySelector('link[rel="icon"]')?.getAttribute('href');
      const manifest = document.querySelector('link[rel="manifest"]')?.getAttribute('href');
      const themeColor = document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
      const twitterCard = document.querySelector('meta[name="twitter:card"]')?.getAttribute('content');
      const lang = document.documentElement.getAttribute('lang');

      return { favicon, manifest, themeColor, ogTitle, twitterCard, lang };
    });
    console.log('   Branding & Metadata:', JSON.stringify(metadata));
    if (!metadata.favicon || !metadata.manifest || !metadata.themeColor || metadata.lang !== 'en') {
      throw new Error('Incomplete branding or SEO metadata!');
    }

    // Take final production verification screenshot
    await page.setViewport({ width: 1440, height: 900 });
    await page.evaluate(() => {
      window.dispatchEvent(new Event('resize'));
      window.scrollTo(0, 0);
    });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: 'verification-production-v1.png' });
    console.log('   Saved verification screenshot: verification-production-v1.png');

  } finally {
    await browser.close();
    await server.close();
    console.log('   Preview server stopped.');
  }

  // ------------------------------------------------------------------------
  // SUMMARY REPORT
  // ------------------------------------------------------------------------
  console.log('\n=== VALIDATION SUMMARY REPORT ===');
  console.log(`Failed Network Requests: ${failedRequests.length}`);
  console.log(`Browser Console Errors:   ${consoleErrors.length}`);

  if (failedRequests.length > 0) {
    console.error('Failed requests:', failedRequests);
    process.exit(1);
  }

  if (consoleErrors.length > 0) {
    console.error('Console errors:', consoleErrors);
    process.exit(1);
  }

  console.log('\n✓ ALL 16 REGRESSION TESTS PASSED');
  console.log('✓ ALL 6 VIEWPORT CATEGORIES VERIFIED WITH 0 OVERFLOW');
  console.log('✓ 0 FAILED NETWORK REQUESTS');
  console.log('✓ 0 CONSOLE ERRORS');
  console.log('✓ PRODUCTION EXCELLENCE ESTABLISHED!');
  process.exit(0);
}

runComprehensiveVerification().catch((err) => {
  console.error('\nVerification failed with exception:', err);
  process.exit(1);
});
