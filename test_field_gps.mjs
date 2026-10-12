import puppeteer from 'puppeteer';

async function testFieldGpsSimulation() {
  console.log('Testing GPS simulation & field behavior on Territory 7...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });

  await page.goto('http://localhost:3000/?id=7&test=true', { waitUntil: 'networkidle0' });
  await page.waitForSelector('.leaflet-container', { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 1000));

  // 1. Open modal via StatusBadge
  const badgeSimBtn = await page.$('[data-field-panel] button');
  if (badgeSimBtn) {
    await badgeSimBtn.click();
    await page.waitForSelector('.fixed.inset-0', { timeout: 2000 });
    console.log('Modal opened.');

    // Click "WEWNĄTRZ terenu"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.fixed.inset-0 button'));
      const insideBtn = btns.find((b) => b.innerText.includes('WEWNĄTRZ'));
      insideBtn?.click();
    });

    await new Promise((r) => setTimeout(r, 1000));

    // Verify inside state
    const badgeTextAfterInside = await page.$eval('[data-field-panel]', (el) => el.innerText);
    console.log('\n--- FIELD STATE: INSIDE TERRITORY 7 ---');
    console.log(badgeTextAfterInside.replace(/\n+/g, ' | '));

    await page.screenshot({ path: 'verification_t7_inside.png' });
    console.log('Saved screenshot: verification_t7_inside.png');

    // 2. Open modal again and select "~60m POZA"
    const reopenModalBtn = await page.$('[data-field-panel] button');
    await reopenModalBtn.click();
    await page.waitForSelector('.fixed.inset-0', { timeout: 2000 });

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.fixed.inset-0 button'));
      const outsideBtn = btns.find((b) => b.innerText.includes('60m POZA'));
      outsideBtn?.click();
    });

    await new Promise((r) => setTimeout(r, 2000)); // wait for OSRM route fetch

    const badgeTextAfterOutside = await page.$eval('[data-field-panel]', (el) => el.innerText);
    console.log('\n--- FIELD STATE: OUTSIDE TERRITORY 7 (~60m) ---');
    console.log(badgeTextAfterOutside.replace(/\n+/g, ' | '));

    // Check SVG paths (territory polygon + route polyline)
    const pathsCountOutside = await page.$$eval(
      '.leaflet-pane.leaflet-overlay-pane svg path',
      (els) => els.length
    );
    console.log('SVG paths count when outside (polygon + route):', pathsCountOutside);

    await page.screenshot({ path: 'verification_t7_outside.png' });
    console.log('Saved screenshot: verification_t7_outside.png');
  }

  await browser.close();
}

testFieldGpsSimulation();
