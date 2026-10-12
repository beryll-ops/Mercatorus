import puppeteer from 'puppeteer';
import fs from 'fs';

async function runVerification() {
  console.log('=== STARTING MERCATORUS BROWSER VERIFICATION ===');
  const results = {
    territory7: {},
    landing: {},
    selectionFlow: {},
    consoleErrors: [],
    consoleWarnings: [],
    requestFailures: [],
  };

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();

  // Track console and network
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      results.consoleErrors.push(text);
      console.error('[Browser ERROR]', text);
    } else if (type === 'warning') {
      results.consoleWarnings.push(text);
      console.warn('[Browser WARN]', text);
    }
  });

  page.on('pageerror', (err) => {
    results.consoleErrors.push(err.toString());
    console.error('[Page Exception]', err);
  });

  page.on('requestfailed', (req) => {
    results.requestFailures.push({
      url: req.url(),
      failure: req.failure()?.errorText,
    });
    console.warn('[Request Failed]', req.url(), req.failure()?.errorText);
  });

  // Mobile viewport: iPhone 13/14 (390 x 844)
  await page.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });

  try {
    // -------------------------------------------------------------
    // TEST 1: DIRECT ACCESS TO http://localhost:3000/?id=7
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Direct navigation to http://localhost:3000/?id=7 ---');
    await page.goto('http://localhost:3000/?id=7', { waitUntil: 'networkidle0', timeout: 10000 });
    await page.waitForSelector('.leaflet-container', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 1200)); // wait for Leaflet to fit bounds & render SVG

    // 1.1 Header check
    const headerTitle = await page.$eval('header h1', (el) => el.textContent?.trim());
    const headerSub = await page.$eval('header p', (el) => el.textContent?.trim()).catch(() => null);
    const backBtnExists = (await page.$('header button[aria-label="Wróć do listy wszystkich terenów"]')) !== null;
    console.log(`Header Title: "${headerTitle}"`);
    console.log(`Header Subtitle: "${headerSub}"`);
    console.log(`Back button present: ${backBtnExists}`);

    // 1.2 Path / SVG Leaflet check
    const paths = await page.$$eval('.leaflet-pane.leaflet-overlay-pane svg path', (els) => {
      return els.map((el) => {
        const d = el.getAttribute('d') || '';
        const bbox = el.getBBox ? el.getBBox() : null;
        const clientRect = el.getBoundingClientRect();
        const stroke = el.getAttribute('stroke');
        const fill = el.getAttribute('fill');
        const strokeWidth = el.getAttribute('stroke-width');
        const fillOpacity = el.getAttribute('fill-opacity');
        const className = el.getAttribute('class');
        return {
          dLength: d.length,
          dStart: d.substring(0, 60),
          dCommandsCount: (d.match(/[MLHVCSQTAZ]/gi) || []).length,
          bbox: bbox ? { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height } : null,
          rect: { width: clientRect.width, height: clientRect.height },
          stroke,
          fill,
          strokeWidth,
          fillOpacity,
          className,
        };
      });
    });

    console.log(`Rendered SVG paths count: ${paths.length}`);
    paths.forEach((p, idx) => {
      console.log(`Path #${idx + 1}: commands=${p.dCommandsCount}, bbox=[w:${p.bbox?.width.toFixed(1)}, h:${p.bbox?.height.toFixed(1)}], stroke=${p.stroke}, fill=${p.fill}, opacity=${p.fillOpacity}`);
    });

    // 1.3 Navigation Panel check
    const navPanel = await page.$('[data-field-panel]');
    let navInfo = null;
    if (navPanel) {
      navInfo = await page.evaluate((el) => {
        return {
          text: el.innerText,
          hasGoogleMapsBtn: Boolean(el.querySelector('a[href*="google.com/maps"]')),
          googleMapsHref: el.querySelector('a[href*="google.com/maps"]')?.getAttribute('href'),
        };
      }, navPanel);
      console.log('Navigation Panel Text:\n' + navInfo.text.replace(/\n+/g, ' | '));
      console.log('Google Maps Target URL:', navInfo.googleMapsHref);
    } else {
      console.warn('Navigation panel not found!');
    }

    // Save screenshot
    await page.screenshot({ path: 'verification_t7_mobile.png' });
    console.log('Saved screenshot: verification_t7_mobile.png');

    results.territory7 = {
      headerTitle,
      headerSub,
      backBtnExists,
      pathsCount: paths.length,
      paths,
      navInfo,
    };

    // -------------------------------------------------------------
    // TEST 2: LANDING PAGE http://localhost:3000/
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: General Landing Page http://localhost:3000/ ---');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 10000 });
    await page.waitForSelector('.leaflet-container', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 1200));

    const landingHeader = await page.$eval('header h1', (el) => el.textContent?.trim());
    console.log(`Landing Header Title: "${landingHeader}"`);

    // All territories polygon count
    const landingPathsCount = await page.$$eval(
      '.leaflet-pane.leaflet-overlay-pane svg path',
      (els) => els.length
    );
    console.log(`All rendered territory SVG paths count: ${landingPathsCount}`);

    // Quick action button
    const openDrawerBtn = await page.$('button svg.lucide-list');
    let drawerBtnText = null;
    if (openDrawerBtn) {
      drawerBtnText = await page.evaluate((icon) => icon.closest('button')?.innerText?.trim(), openDrawerBtn);
    }
    console.log(`Bottom Drawer Button text: "${drawerBtnText}"`);

    // Click to open territory drawer
    console.log('Clicking "Wybierz teren do pracy"...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find((b) => b.innerText.includes('Wybierz teren do pracy'));
      btn?.click();
    });

    await page.waitForSelector('h2', { timeout: 2000 });
    await new Promise((r) => setTimeout(r, 500));

    // Drawer header
    const drawerTitle = await page.$eval('h2', (el) => el.textContent?.trim());
    const drawerSubtitle = await page.$eval('h2 + p', (el) => el.textContent?.trim()).catch(() => null);
    console.log(`Drawer Title: "${drawerTitle}", Subtitle: "${drawerSubtitle}"`);

    // Get list of territories in drawer
    const listItems = await page.evaluate(() => {
      const modal = document.querySelector('.animate-fadeIn');
      if (!modal) return [];
      const buttons = Array.from(modal.querySelectorAll('.overflow-y-auto button'));
      return buttons.map((b) => {
        const text = b.innerText.trim();
        return text.replace(/\n+/g, ' ');
      });
    });

    console.log(`Found ${listItems.length} items in TerritorySelector:`);
    listItems.forEach((item, i) => {
      console.log(`  [${i + 1}] ${item}`);
    });

    await page.screenshot({ path: 'verification_drawer_mobile.png' });
    console.log('Saved screenshot: verification_drawer_mobile.png');

    results.landing = {
      landingHeader,
      landingPathsCount,
      drawerBtnText,
      drawerTitle,
      drawerSubtitle,
      territoriesCount: listItems.length,
      territoriesList: listItems,
    };

    // -------------------------------------------------------------
    // TEST 3: SELECT TERRITORY 7 FROM DRAWER & VERIFY URL / SWITCH
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Selecting Territory 7 from Drawer ---');
    const clickedT7 = await page.evaluate(() => {
      const modal = document.querySelector('.animate-fadeIn');
      if (!modal) return false;
      const buttons = Array.from(modal.querySelectorAll('.overflow-y-auto button'));
      const t7Btn = buttons.find((b) => b.innerText.includes('Sokoła') || b.innerText.includes('7'));
      if (t7Btn) {
        t7Btn.click();
        return true;
      }
      return false;
    });

    console.log('Clicked Territory 7 item:', clickedT7);
    await new Promise((r) => setTimeout(r, 1000));

    const currentUrl = page.url();
    console.log('Current URL after click:', currentUrl);

    const postClickHeader = await page.$eval('header h1', (el) => el.textContent?.trim());
    console.log(`Header after switch: "${postClickHeader}"`);

    const postClickPaths = await page.$$eval('.leaflet-pane.leaflet-overlay-pane svg path', (els) => {
      return els.map((el) => {
        const d = el.getAttribute('d') || '';
        const bbox = el.getBBox ? el.getBBox() : null;
        return {
          dCommandsCount: (d.match(/[MLHVCSQTAZ]/gi) || []).length,
          bbox: bbox ? { width: bbox.width, height: bbox.height } : null,
          stroke: el.getAttribute('stroke'),
          fill: el.getAttribute('fill'),
        };
      });
    });
    console.log(`Post-switch SVG paths count: ${postClickPaths.length}`);
    postClickPaths.forEach((p, idx) => {
      console.log(`Path #${idx + 1}: commands=${p.dCommandsCount}, bbox=[w:${p.bbox?.width.toFixed(1)}, h:${p.bbox?.height.toFixed(1)}], color=${p.stroke}`);
    });

    results.selectionFlow = {
      clickedT7,
      finalUrl: currentUrl,
      postClickHeader,
      postClickPathsCount: postClickPaths.length,
      postClickPaths,
    };

    // -------------------------------------------------------------
    // TEST 4: GO BACK TO ALL TERRITORIES VIA BACK BUTTON
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Back Button Click to return to landing ---');
    await page.evaluate(() => {
      const backBtn = document.querySelector('header button[aria-label="Wróć do listy wszystkich terenów"]');
      backBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    const finalUrlAfterBack = page.url();
    const finalHeaderAfterBack = await page.$eval('header h1', (el) => el.textContent?.trim());
    const finalPathsAfterBack = await page.$$eval(
      '.leaflet-pane.leaflet-overlay-pane svg path',
      (els) => els.length
    );
    console.log(`URL after Back: ${finalUrlAfterBack}`);
    console.log(`Header after Back: "${finalHeaderAfterBack}"`);
    console.log(`Paths count after Back: ${finalPathsAfterBack}`);

    results.selectionFlow.backFlow = {
      finalUrlAfterBack,
      finalHeaderAfterBack,
      finalPathsAfterBack,
    };
  } catch (err) {
    console.error('Test execution error:', err);
    results.error = err.message;
  } finally {
    await browser.close();
  }

  fs.writeFileSync('verification_results.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('\n=== VERIFICATION FINISHED. Results written to verification_results.json ===');
}

runVerification();
