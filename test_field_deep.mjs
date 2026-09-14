import puppeteer from 'puppeteer';

async function runDeepTests() {
  console.log('--- RUNNING DEEP FIELD INVESTIGATION TESTS ---');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();

  try {
    // -------------------------------------------------------------
    // PART A: LANDING PAGE, POPUPS & DRAWER (iPhone SE: 375x667)
    // -------------------------------------------------------------
    await page.setViewport({
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });

    console.log('\n--- PART A: Testing on Small Mobile (iPhone SE: 375x667) ---');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1200));

    // Check Landing Quick Action Button
    const landingButton = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const found = btns.find((b) => b.textContent?.includes('Wybierz teren do pracy'));
      if (!found) return null;
      const rect = found.getBoundingClientRect();
      return {
        text: found.textContent?.trim(),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        visible: rect.height > 0,
      };
    });
    console.log('Landing Quick Action Button on 375x667:', landingButton);

    // Test Opening Territory Drawer from Landing Button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const found = btns.find((b) => b.textContent?.includes('Wybierz teren do pracy'));
      found?.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const drawerData = await page.evaluate(() => {
      const drawer = document.querySelector('.fixed.inset-y-0.right-0');
      if (!drawer) return { isOpen: false };
      const items = Array.from(drawer.querySelectorAll('button')).map((b) => {
        const rect = b.getBoundingClientRect();
        return {
          text: b.innerText.slice(0, 40).replace(/\n/g, ' '),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      });
      return {
        isOpen: true,
        itemsCount: items.length,
        itemsSample: items.slice(0, 4),
      };
    });
    console.log('Territory Drawer Analysis:', drawerData);

    // Select Territory 2 (Kazimierz) from Drawer
    await page.evaluate(() => {
      const drawer = document.querySelector('.fixed.inset-y-0.right-0');
      const btns = Array.from(drawer?.querySelectorAll('button') || []);
      const kazimierzBtn = btns.find((b) => b.textContent?.includes('Kazimierz'));
      kazimierzBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 1000));
    console.log('URL after clicking Kazimierz in drawer:', page.url());

    // -------------------------------------------------------------
    // PART B: POLYGON POPUP INTERACTION IN LANDING VIEW
    // -------------------------------------------------------------
    console.log('\n--- PART B: Testing Polygon Click Popups on Map ---');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1200));

    // Click in the center of the first polygon SVG path
    const popupResult = await page.evaluate(async () => {
      const paths = document.querySelectorAll('.leaflet-overlay-pane svg path');
      if (!paths.length) return { error: 'No paths found' };
      const firstPath = paths[0];
      const rect = firstPath.getBoundingClientRect();
      const clickX = rect.left + rect.width / 2;
      const clickY = rect.top + rect.height / 2;

      // Dispatch click
      const evt = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: clickX,
        clientY: clickY,
      });
      firstPath.dispatchEvent(evt);
      return { clicked: true, x: clickX, y: clickY };
    });
    console.log('Polygon click dispatched:', popupResult);
    await new Promise((r) => setTimeout(r, 600));

    const popupContent = await page.evaluate(() => {
      const popup = document.querySelector('.leaflet-popup-content');
      if (!popup) return null;
      const btn = popup.querySelector('button');
      return {
        text: popup.textContent?.trim().replace(/\s+/g, ' '),
        hasOpenButton: !!btn,
        buttonText: btn?.textContent?.trim(),
      };
    });
    console.log('Leaflet Popup Content:', popupContent);

    // Click the popup button to open the territory
    if (popupContent?.hasOpenButton) {
      await page.evaluate(() => {
        const btn = document.querySelector('.leaflet-popup-content button');
        btn?.click();
      });
      await new Promise((r) => setTimeout(r, 1000));
      console.log('URL after clicking popup button:', page.url());
    }

    // -------------------------------------------------------------
    // PART C: GPS SIMULATION ACCURACY & EDGE CASES
    // -------------------------------------------------------------
    console.log('\n--- PART C: GPS Simulation & Distance Calculations ---');
    await page.goto('http://localhost:3000/?id=3', { waitUntil: 'networkidle0' }); // Wawel
    await new Promise((r) => setTimeout(r, 1200));

    // Open GPS modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const simBtn = btns.find((b) => b.textContent?.includes('Symuluj') || b.textContent?.includes('Symulacja'));
      simBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // Check modal contents
    const gpsModalButtons = await page.evaluate(() => {
      const modal = document.querySelector('.fixed.inset-0.z-\\[650\\]');
      if (!modal) return null;
      return Array.from(modal.querySelectorAll('button')).map((b) => b.textContent?.trim().replace(/\s+/g, ' '));
    });
    console.log('GPS Modal Buttons:', gpsModalButtons);

    // 1. Simulate Inside Wawel
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find((b) => b.textContent?.includes('WEWNĄTRZ terenu'));
      btn?.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    const insideBadge = await page.evaluate(() => {
      const badge = document.querySelector('.bg-emerald-950\\/90');
      const text = badge?.textContent?.trim().replace(/\s+/g, ' ');
      return {
        exists: !!badge,
        text,
      };
    });
    console.log('Inside Badge for Wawel:', insideBadge);

    // 2. Simulate Outside Far (~1km)
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const simBtn = btns.find((b) => b.textContent?.includes('Symulacja'));
      simBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find((b) => b.textContent?.includes('1 km POZA'));
      btn?.click();
    });
    await new Promise((r) => setTimeout(r, 2000)); // wait for OSRM

    const outsideFarInfo = await page.evaluate(() => {
      const badge = document.querySelector('.bg-amber-950\\/90');
      const navPanel = document.querySelector('.bg-slate-900\\/95');
      const routeSnippet = navPanel ? navPanel.textContent?.trim().replace(/\s+/g, ' ') : null;
      return {
        badgeText: badge?.textContent?.trim().replace(/\s+/g, ' '),
        routeSnippet,
      };
    });
    console.log('Outside Far (~1km) Info:', outsideFarInfo);

    // -------------------------------------------------------------
    // PART D: QR GENERATOR MODAL & A4 PRINT MEDIA
    // -------------------------------------------------------------
    console.log('\n--- PART D: QR Generator Modal & A4 Print Inspection ---');
    // Click QR button in header
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('header button'));
      // Find button containing QrCode SVG or title
      const qrBtn = btns.find((b) => b.getAttribute('title')?.includes('Kreator') || b.querySelector('svg.lucide-qr-code'));
      qrBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 1500));

    const qrModalDetails = await page.evaluate(() => {
      const modal = document.querySelector('.fixed.inset-0.z-\\[700\\]');
      if (!modal) return { isOpen: false };
      const title = modal.querySelector('h2')?.textContent?.trim();
      const dropZone = modal.querySelector('input[type="file"]') ? true : false;
      const cards = Array.from(modal.querySelectorAll('.qr-print-card')).map((c) => {
        return {
          title: c.querySelector('h3')?.textContent?.trim(),
          num: c.querySelector('.font-black')?.textContent?.trim(),
          imgSrc: c.querySelector('img')?.getAttribute('src')?.slice(0, 30),
          url: c.querySelector('.break-all')?.textContent?.trim(),
        };
      });

      return {
        isOpen: true,
        title,
        hasDropZone: dropZone,
        totalCards: cards.length,
        cards,
      };
    });
    console.log('QR Modal Details:', qrModalDetails);

    // Test print stylesheet rules
    await page.emulateMediaType('print');
    const printEvaluation = await page.evaluate(() => {
      const modal = document.querySelector('.fixed.inset-0.z-\\[700\\]');
      const printHiddenEls = Array.from(document.querySelectorAll('.print\\:hidden')).map((el) => {
        return {
          class: el.className,
          display: window.getComputedStyle(el).display,
        };
      });

      const cardsGrid = document.querySelector('.printable-cards-grid');
      const cardsGridStyles = cardsGrid ? {
        display: window.getComputedStyle(cardsGrid).display,
        gridTemplateColumns: window.getComputedStyle(cardsGrid).gridTemplateColumns,
      } : null;

      const firstCard = document.querySelector('.qr-print-card');
      const cutHint = firstCard?.querySelector('.print\\:block');
      const cutHintDisplay = cutHint ? window.getComputedStyle(cutHint).display : null;

      return {
        printHiddenCount: printHiddenEls.length,
        allPrintHiddenNone: printHiddenEls.every((e) => e.display === 'none'),
        cardsGridStyles,
        cutHintDisplay,
      };
    });
    console.log('Print Styles Evaluation:', printEvaluation);

    // -------------------------------------------------------------
    // PART E: SUNLIGHT READABILITY & COLOR CONTRAST AUDIT
    // -------------------------------------------------------------
    console.log('\n--- PART E: Field Ergonomics & Sunlight Readability Audit ---');
    await page.emulateMediaType('screen');
    // Close modal
    await page.evaluate(() => {
      const modal = document.querySelector('.fixed.inset-0.z-\\[700\\]');
      const closeBtn = modal?.querySelector('button svg.lucide-x')?.closest('button');
      closeBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const fieldErgonomics = await page.evaluate(() => {
      const mapContainer = document.querySelector('.leaflet-container');
      const bottomPanel = document.querySelector('.absolute.bottom-4');
      const rightControls = document.querySelector('.absolute.right-3\\.5.top-20');
      const statusBadge = document.querySelector('.bg-amber-950\\/90, .bg-emerald-950\\/90');
      const navButton = document.querySelector('a[href*="google.com/maps"]');

      const bpRect = bottomPanel?.getBoundingClientRect();
      const nbRect = navButton?.getBoundingClientRect();

      return {
        screenHeight: window.innerHeight,
        screenWidth: window.innerWidth,
        bottomPanelHeight: bpRect ? Math.round(bpRect.height) : 0,
        bottomPanelFractionOfScreen: bpRect ? (bpRect.height / window.innerHeight).toFixed(2) : 0,
        navButtonSize: nbRect ? { width: Math.round(nbRect.width), height: Math.round(nbRect.height) } : null,
        // Colors & classes for outdoor glare
        badgeBg: statusBadge ? window.getComputedStyle(statusBadge).backgroundColor : null,
        badgeTextColor: statusBadge ? window.getComputedStyle(statusBadge).color : null,
        mapControlsRightDistance: rightControls ? window.getComputedStyle(rightControls).right : null,
      };
    });
    console.log('Field Ergonomics on 375x667:', fieldErgonomics);

  } catch (err) {
    console.error('Deep test error:', err);
  } finally {
    await browser.close();
  }
}

runDeepTests();
