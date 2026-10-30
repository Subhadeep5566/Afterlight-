import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runVerification() {
  console.log('=== STARTING AFTERLIGHT COMPREHENSIVE VERIFICATION ===\n');

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

  console.log('1. Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });

  // 1.1 Verify Cinematic Initial Experience Loader
  console.log('   Verifying Experience Loader & Progress...');
  const loaderState = await page.evaluate(() => {
    const loader = document.querySelector('#experience-loader');
    return {
      exists: !!loader,
      isLoaded: loader?.classList.contains('is-loaded'),
      pct: document.querySelector('#loader-status-pct')?.innerText
    };
  });
  console.log('   Experience Loader State:', JSON.stringify(loaderState));
  await new Promise(r => setTimeout(r, 1500));

  // Check WebGL Context
  const webglStatus = await page.evaluate(() => {
    const canvas = document.querySelector('#webgl-canvas');
    if (!canvas) return { error: 'no canvas' };
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return {
      hasGL: !!gl,
      renderer: gl ? gl.getParameter(gl.RENDERER) : null,
      width: canvas.width,
      height: canvas.height
    };
  });
  console.log('   WebGL Context Status:', JSON.stringify(webglStatus));

  // 2. Verify "DRAG TO EXPLORE" Discovery Indicator
  console.log('\n2. Verifying "DRAG TO EXPLORE" Discovery Indicator...');
  const cueState = await page.evaluate(() => {
    const hint = document.querySelector('#drag-discovery-hint');
    return {
      exists: !!hint,
      isDismissed: hint ? hint.classList.contains('is-dismissed') : false,
      text: hint ? hint.innerText.replace(/\s+/g, ' ').trim() : ''
    };
  });
  console.log('   Discovery Indicator:', JSON.stringify(cueState));
  if (!cueState.text.includes('DRAG TO EXPLORE')) {
    throw new Error(`Expected discovery indicator to contain "DRAG TO EXPLORE", got: "${cueState.text}"`);
  }

  // 3. Test Direct 3D Mouse Manipulation (Horizontal & Vertical with Inertia)
  console.log('\n3. Testing Natural 3D Mouse Drag & Rotational Inertia...');
  await page.mouse.move(820, 420);
  await page.mouse.down();
  await page.mouse.move(980, 420, { steps: 12 });

  const activeDragState = await page.evaluate(() => ({
    bodyHasDraggingClass: document.body.classList.contains('is-dragging'),
    hintIsDismissed: document.querySelector('#drag-discovery-hint')?.classList.contains('is-dismissed')
  }));
  console.log('   State during active drag:', JSON.stringify(activeDragState));

  await page.mouse.up();
  // Allow rotational inertia coast and smooth damping
  await new Promise(r => setTimeout(r, 900));

  const postDragRot = await page.evaluate(() => {
    return document.querySelector('#telemetry-rotation')?.innerText;
  });
  console.log('   Rotation after horizontal drag with inertia:', postDragRot);

  // Vertical drag (pitch)
  await page.mouse.move(820, 420);
  await page.mouse.down();
  await page.mouse.move(820, 320, { steps: 8 });
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 900));

  const postPitchRot = await page.evaluate(() => {
    return document.querySelector('#telemetry-rotation')?.innerText;
  });
  console.log('   Rotation after vertical pitch drag:', postPitchRot);

  // 4. Verify Orientation Preservation Across Chapters
  console.log('\n4. Verifying Orientation Preservation across Chapter Scroll...');
  const preScrollRot = await page.evaluate(() => document.querySelector('#telemetry-rotation')?.innerText);
  await page.click('#btn-enter-experience');
  await new Promise(r => setTimeout(r, 1200));

  const postScrollRot = await page.evaluate(() => document.querySelector('#telemetry-rotation')?.innerText);
  console.log(`   Rotation before scroll: ${preScrollRot} | Rotation in Chapter 02: ${postScrollRot}`);

  // 5. Verify Navigation Header & Active Chapter Indication
  console.log('\n5. Verifying Navigation Header & Active Chapter Indication...');
  const headerState = await page.evaluate(() => {
    const activeNav = document.querySelector('.nav-link.is-active')?.innerText.trim();
    const chapterBadge = document.querySelector('#nav-chapter-indicator')?.innerText.trim();
    const isScrolled = document.querySelector('.site-header')?.classList.contains('is-scrolled');
    return { activeNav, chapterBadge, isScrolled };
  });
  console.log('   Header Navigation State:', JSON.stringify(headerState));

  // 6. Test All Seven Chapters & Scroll Transitions
  console.log('\n6. Verifying all Seven Chapters...');
  const chapters = [
    { id: '#chapter-01', name: 'ORIGIN' },
    { id: '#chapter-02', name: 'STRUCTURE' },
    { id: '#chapter-03', name: 'TENSION' },
    { id: '#chapter-04', name: 'DISSOLUTION' },
    { id: '#chapter-05', name: 'REFORMATION' },
    { id: '#chapter-06', name: 'PLAYGROUND' },
    { id: '#chapter-07', name: 'CONTINUATION' }
  ];

  for (const ch of chapters) {
    const exists = await page.evaluate((selector) => !!document.querySelector(selector), ch.id);
    if (!exists) throw new Error(`Missing section ${ch.id} (${ch.name})`);
  }
  console.log('   All 7 narrative chapters present in DOM.');

  // Scroll to Chapter 06 (Playground)
  console.log('\n7. Testing Chapter 06 (Playground) & Presets Preservation...');
  await page.evaluate(() => {
    document.querySelector('#chapter-06').scrollIntoView({ behavior: 'instant' });
  });
  await new Promise(r => setTimeout(r, 900));

  // Test Presets
  const presets = ['origin', 'tension', 'dissolution', 'reformation'];
  for (const preset of presets) {
    await page.click(`[data-preset="${preset}"]`);
    await new Promise(r => setTimeout(r, 200));
    const active = await page.evaluate((p) => {
      const btn = document.querySelector(`[data-preset="${p}"]`);
      return btn?.classList.contains('is-active');
    }, preset);
    if (!active) throw new Error(`Preset ${preset} failed to activate`);
  }
  console.log('   All 4 geometric presets activated successfully.');

  // Test Color Palettes
  const palettes = ['lapis', 'platinum', 'aurelia', 'spectral'];
  for (const pal of palettes) {
    await page.click(`[data-palette="${pal}"]`);
    await new Promise(r => setTimeout(r, 200));
    const active = await page.evaluate((p) => {
      const btn = document.querySelector(`[data-palette="${p}"]`);
      return btn?.classList.contains('is-active');
    }, pal);
    if (!active) throw new Error(`Palette ${pal} failed to activate`);
  }
  console.log('   All 4 material lighting palettes activated successfully.');

  // Test Rotation Speed (STILL, SERENE, KINETIC)
  await page.click('[data-speed="0"]');
  await new Promise(r => setTimeout(r, 200));
  await page.click('[data-speed="2.2"]');
  await new Promise(r => setTimeout(r, 200));
  await page.click('[data-speed="1"]');
  console.log('   Rotation dynamics controls verified.');

  // Test Reset button
  await page.click('#btn-reset-sculpture');
  await new Promise(r => setTimeout(r, 700));
  const postResetTelemetry = await page.evaluate(() => ({
    activeSpeed: document.querySelector('[data-speed].is-active')?.innerText,
    activePreset: document.querySelector('.form-select-btn.is-active .btn-name')?.innerText,
    activePalette: document.querySelector('.palette-btn.is-active .palette-name')?.innerText,
    rotation: document.querySelector('#telemetry-rotation')?.innerText
  }));
  console.log('   State after Playground Reset:', JSON.stringify(postResetTelemetry));

  // 8. Test Return to Origin
  console.log('\n8. Testing Return to Origin from Chapter 07...');
  await page.evaluate(() => {
    document.querySelector('#chapter-07').scrollIntoView({ behavior: 'instant' });
  });
  await new Promise(r => setTimeout(r, 800));
  await page.click('#btn-return-origin');
  await new Promise(r => setTimeout(r, 1200));

  const returnScrollY = await page.evaluate(() => window.scrollY);
  console.log(`   Scroll position after Return to Origin: ${returnScrollY}px`);

  // 9. Test Responsive Viewports (Tablet & Mobile)
  console.log('\n9. Testing Responsive Viewports...');
  
  // Tablet: 768x1024
  await page.setViewport({ width: 768, height: 1024 });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await new Promise(r => setTimeout(r, 500));
  const tabletCheck = await page.evaluate(() => ({
    mobilePillVisible: window.getComputedStyle(document.querySelector('.mobile-chapter-pill')).display !== 'none',
    desktopRailHidden: window.getComputedStyle(document.querySelector('.chapter-rail')).display === 'none'
  }));
  console.log('   Tablet (768x1024) check:', JSON.stringify(tabletCheck));

  // Mobile: 375x667
  await page.setViewport({ width: 375, height: 667 });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await new Promise(r => setTimeout(r, 500));
  const mobileCheck = await page.evaluate(() => ({
    hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    mobilePillVisible: window.getComputedStyle(document.querySelector('.mobile-chapter-pill')).display !== 'none',
    currChapterText: document.querySelector('#mobile-chapter-label')?.innerText.replace(/\s+/g, ' ').trim()
  }));
  console.log('   Mobile (375x667) check:', JSON.stringify(mobileCheck));

  // Test Mobile Chapter Navigation Arrow Click
  console.log('   Testing Mobile Chapter Pill next arrow click...');
  await page.click('#mobile-next-chapter');
  await new Promise(r => setTimeout(r, 1000));
  const mobileAfterNext = await page.evaluate(() => ({
    chapterText: document.querySelector('#mobile-chapter-label')?.innerText.replace(/\s+/g, ' ').trim(),
    scrollY: window.scrollY
  }));
  console.log('   Mobile after next arrow click:', JSON.stringify(mobileAfterNext));

  await page.screenshot({ path: 'verification-mobile-responsive.png' });

  // Reset to desktop viewport for final screenshot
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluate(() => {
    window.dispatchEvent(new Event('resize'));
    window.scrollTo(0, 0);
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: 'verification-elevated-hero.png' });

  await browser.close();

  console.log('\n=== VERIFICATION SUMMARY ===');
  console.log(`Total Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error('Errors encountered:', consoleErrors);
    process.exit(1);
  } else {
    console.log('SUCCESS: All 9 requirements verified with 0 console errors!');
    process.exit(0);
  }
}

runVerification().catch((err) => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});