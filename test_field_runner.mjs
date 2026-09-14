import puppeteer from 'puppeteer';

async function runTests() {
  console.log('Starting Mercatorus Field UI Test Suite...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  const testResults = {
    viewports: [],
    scenarios: {},
    touchTargets: [],
    printStyles: {},
  };

  try {
    // 1. Setup Mobile Viewport (iPhone 13/14: 390x844)
    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });

    console.log('\n--- TEST 1: WIDOK OGÓLNY (Landing Page: http://localhost:3000/) ---');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

    // Wait for map container and GeoJSON polygons
    await page.waitForSelector('.leaflet-container', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 1500)); // allow geojson render

    // Check header
    const headerTitle = await page.$eval('header h1', (el) => el.textContent?.trim());
    console.log('Header title:', headerTitle);

    // Count rendered polygons in SVG
    const polygonPathsCount = await page.$$eval('.leaflet-pane.leaflet-overlay-pane svg path', (els) => els.length);
    console.log('Polygons rendered in general view:', polygonPathsCount);

    // Check bottom landing button
    const landingButton = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find((b) => b.textContent?.includes('Wybierz teren do pracy'));
    });
    const landingButtonText = landingButton && landingButton.asElement()
      ? await page.evaluate((el) => el.textContent?.trim(), landingButton.asElement())
      : null;
    console.log('Landing bottom button text:', landingButtonText);

    testResults.scenarios.landingView = {
      headerTitle,
      polygonPathsCount,
      landingButtonText,
      success: polygonPathsCount >= 4 && landingButtonText?.includes('Wybierz teren do pracy') && headerTitle === 'Mapy',
    };

    console.log('\n--- TEST 2: TEST WYBORU TERENU Z LISTY (DRAWER) ---');
    // Open drawer via bottom button
    if (landingButton && landingButton.asElement()) {
      await landingButton.asElement().click();
      await new Promise((r) => setTimeout(r, 600));
    }

    const drawerVisible = await page.$eval('.fixed.inset-0.z-\\[600\\]', (el) => !!el).catch(() => false);
    console.log('Drawer visible:', drawerVisible);

    // Count territories in drawer
    const territoryButtons = await page.$$eval('.divide-y button', (els) =>
      els.map((e) => e.textContent?.trim())
    );
    console.log('Territories in selector drawer:', territoryButtons.length);

    // Select first territory
    const firstTerritoryBtn = (await page.$$('.divide-y button'))[0];
    if (firstTerritoryBtn) {
      await firstTerritoryBtn.click();
      await new Promise((r) => setTimeout(r, 1000));
    }

    const currentUrlAfterSelect = page.url();
    console.log('URL after selecting territory:', currentUrlAfterSelect);

    console.log('\n--- TEST 3: WIDOK POJEDYNCZEGO TERENU (?id=1) ---');
    await page.goto('http://localhost:3000/?id=1', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1500));

    const singleHeaderTitle = await page.$eval('header h1', (el) => el.textContent?.trim());
    console.log('Single territory header title:', singleHeaderTitle);

    const singlePolygonCount = await page.$$eval('.leaflet-pane.leaflet-overlay-pane svg path', (els) => els.length);
    console.log('Polygons rendered in single view (?id=1):', singlePolygonCount);

    const backButtonExists = await page.$('header button[aria-label*="Wróć"]');
    console.log('Back button exists:', !!backButtonExists);

    testResults.scenarios.singleTerritory = {
      url: page.url(),
      headerTitle: singleHeaderTitle,
      singlePolygonCount,
      strictlyOnlyOnePolygon: singlePolygonCount === 1,
      backButtonExists: !!backButtonExists,
    };

    console.log('\n--- TEST 4: BŁĘDNY PARAMETR URL (?id=nieistniejacy_teren) ---');
    await page.goto('http://localhost:3000/?id=nieistniejacy_teren', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1500));

    const errorBanner = await page.$('.bg-rose-950\\/95');
    let errorBannerTitle = null;
    let errorBannerMsg = null;
    let actionButtonsCount = 0;

    if (errorBanner) {
      errorBannerTitle = await errorBanner.$eval('h3', (el) => el.textContent?.trim());
      errorBannerMsg = await errorBanner.$eval('p', (el) => el.textContent?.trim());
      actionButtonsCount = (await errorBanner.$$('button')).length;
    }
    console.log('Error banner title:', errorBannerTitle);
    console.log('Error banner message:', errorBannerMsg);
    console.log('Error action buttons count:', actionButtonsCount);

    const invalidPolygonCount = await page.$$eval('.leaflet-pane.leaflet-overlay-pane svg path', (els) => els.length);
    console.log('Polygons visible on error page:', invalidPolygonCount);

    // Click "Pokaż wszystkie tereny" button
    if (errorBanner) {
      const clearIdBtn = (await errorBanner.$$('button'))[0];
      if (clearIdBtn) {
        await clearIdBtn.click();
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    const recoveredUrl = page.url();
    console.log('URL after clicking "Pokaż wszystkie tereny":', recoveredUrl);

    testResults.scenarios.invalidId = {
      errorBannerTitle,
      errorBannerMsg,
      actionButtonsCount,
      invalidPolygonCount,
      polygonsHiddenOnError: invalidPolygonCount === 0,
      recoveredUrl,
    };

    console.log('\n--- TEST 5: LOGIKA STATUSU GPS (INSIDE vs OUTSIDE vs DENIED) ---');
    await page.goto('http://localhost:3000/?id=1', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1000));

    // Open GPS Simulation modal
    const simButton = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find((b) => b.textContent?.includes('Symuluj') || b.textContent?.includes('Symulacja'));
    });

    if (simButton && simButton.asElement()) {
      await simButton.asElement().click();
      await new Promise((r) => setTimeout(r, 500));
    }

    // Modal should be open: check simulation buttons
    const simInsideBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find((b) => b.textContent?.includes('WEWNĄTRZ terenu'));
    });

    if (simInsideBtn && simInsideBtn.asElement()) {
      console.log('Clicking "Symuluj pozycję WEWNĄTRZ terenu"...');
      await simInsideBtn.asElement().click();
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Check StatusBadge text and classes
    const statusTextInside = await page.evaluate(() => {
      const badge = document.querySelector('.bg-emerald-950\\/90');
      const target = badge?.querySelector('.font-bold');
      return target ? target.textContent?.trim() : null;
    });
    console.log('Status badge text when INSIDE:', statusTextInside);

    // Now test OUTSIDE ~60m
    const simButton2 = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find((b) => b.textContent?.includes('Symulacja'));
    });
    if (simButton2 && simButton2.asElement()) {
      await simButton2.asElement().click();
      await new Promise((r) => setTimeout(r, 500));

      const simOutsideBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.find((b) => b.textContent?.includes('60m POZA'));
      });
      if (simOutsideBtn && simOutsideBtn.asElement()) {
        console.log('Clicking "Symuluj ~60m POZA granicą"...');
        await simOutsideBtn.asElement().click();
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    const statusTextOutside = await page.evaluate(() => {
      const badge = document.querySelector('.bg-amber-950\\/90');
      const target = badge?.querySelector('.font-bold');
      return target ? target.textContent?.trim() : null;
    });
    console.log('Status badge text when OUTSIDE ~60m:', statusTextOutside);

    // Check NavigationPanel contents
    const navPanelInfo = await page.evaluate(() => {
      const gmapsLink = document.querySelector('a[href*="google.com/maps"]');
      const href = gmapsLink ? gmapsLink.getAttribute('href') : null;
      const text = document.body.innerText;
      return {
        gmapsUrl: href,
        hasRouteInfo: text.includes('Trasa do granicy') || text.includes('Dojście'),
        fullSnippet: gmapsLink ? gmapsLink.innerText : null,
      };
    });
    console.log('Navigation Panel info:', navPanelInfo);

    testResults.scenarios.gpsStatus = {
      statusTextInside,
      statusTextOutside,
      navPanelInfo,
      insideRequirementMet: statusTextInside === 'Jesteś na terenie',
      outsideRequirementMet: statusTextOutside?.startsWith('Jesteś poza terenem (odległość do granicy:'),
    };

    console.log('\n--- TEST 6: PRZEŁĄCZNIK WARSTWY (OSM <-> SATELITA ESRI) ---');
    const initialTileUrl = await page.$eval('.leaflet-tile-pane img', (el) => el.src).catch(() => 'no-tile');
    console.log('Initial tile sample URL:', initialTileUrl);

    // Find layer toggle button (Layers icon)
    const layerBtn = await page.$('button[aria-label="Przełącz podkład mapy"]');
    if (layerBtn) {
      await layerBtn.click();
      await new Promise((r) => setTimeout(r, 1200));
    }

    const satTileUrl = await page.$eval('.leaflet-tile-pane img', (el) => el.src).catch(() => 'no-tile');
    console.log('Satellite tile sample URL:', satTileUrl);

    testResults.scenarios.layerToggle = {
      initialTileUrl,
      satTileUrl,
      switchedToArcGIS: satTileUrl.includes('arcgisonline.com'),
    };

    console.log('\n--- TEST 7: ERGONOMIA DOTYKOWA & ROZMIARY PRZYCISKÓW (MIN. 44px) ---');
    const touchElements = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('button, a'));
      return elements.map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          text: el.innerText.slice(0, 30).replace(/\n/g, ' ').trim() || el.getAttribute('aria-label') || el.getAttribute('title') || 'unnamed',
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          visible: rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none',
        };
      }).filter((e) => e.visible);
    });

    const smallTouchTargets = touchElements.filter((e) => e.width < 44 || e.height < 44);
    console.log(`Total interactive elements on mobile view: ${touchElements.length}`);
    console.log(`Elements smaller than 44x44px: ${smallTouchTargets.length}`);
    smallTouchTargets.forEach((t) => {
      console.log(`  Small touch target: "${t.text}" (${t.width}px x ${t.height}px)`);
    });

    testResults.touchTargets = {
      total: touchElements.length,
      failingCount: smallTouchTargets.length,
      smallTouchTargets,
    };

    // Check viewport horizontal overflow
    const overflowInfo = await page.evaluate(() => {
      return {
        docScrollWidth: document.documentElement.scrollWidth,
        docClientWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        windowInnerWidth: window.innerWidth,
        hasHorizontalScroll: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    console.log('Viewport overflow check:', overflowInfo);
    testResults.scenarios.overflow = overflowInfo;

    // Check collision / overlap between bottom panel and map controls or indicator
    const layoutCollision = await page.evaluate(() => {
      const bottomPanel = document.querySelector('.absolute.bottom-4');
      const rightControls = document.querySelector('.absolute.right-3\\.5.top-20');
      const indicator = document.querySelector('.absolute.left-3\\.5.top-20');

      if (!bottomPanel || !rightControls) return { overlap: false };
      const bpRect = bottomPanel.getBoundingClientRect();
      const rcRect = rightControls.getBoundingClientRect();
      const indRect = indicator ? indicator.getBoundingClientRect() : null;

      const overlapWithRightControls = !(
        bpRect.right < rcRect.left ||
        bpRect.left > rcRect.right ||
        bpRect.bottom < rcRect.top ||
        bpRect.top > rcRect.bottom
      );

      const overlapWithIndicator = indRect ? !(
        bpRect.right < indRect.left ||
        bpRect.left > indRect.right ||
        bpRect.bottom < indRect.top ||
        bpRect.top > indRect.bottom
      ) : false;

      return {
        overlapWithRightControls,
        overlapWithIndicator,
        bottomPanelHeight: Math.round(bpRect.height),
        viewportHeight: window.innerHeight,
        screenHeightPercentageCovered: Math.round((bpRect.height / window.innerHeight) * 100),
      };
    });
    console.log('Layout collision & coverage check:', layoutCollision);
    testResults.scenarios.layoutCollision = layoutCollision;

    console.log('\n--- TEST 8: GENERATOR KODÓW QR & WIDOK WYDRUKU A4 ---');
    const qrBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('header button'));
      return btns.find((b) => b.getAttribute('title')?.toLowerCase().includes('qr') || b.querySelector('svg.lucide-qr-code'));
    });
    if (qrBtn && qrBtn.asElement()) {
      await qrBtn.asElement().click();
      await new Promise((r) => setTimeout(r, 1500));
    }

    const qrModalOpen = await page.$eval('.fixed.inset-0.z-\\[700\\]', (el) => !!el).catch(() => false);
    console.log('QR modal open:', qrModalOpen);

    const generatedCardCount = await page.$$eval('.qr-print-card', (els) => els.length);
    console.log('Generated QR print cards count:', generatedCardCount);

    const sampleCardData = await page.$eval('.qr-print-card', (el) => {
      const name = el.querySelector('h3')?.textContent?.trim();
      const num = el.querySelector('.font-black')?.textContent?.trim();
      const qrImg = el.querySelector('img')?.getAttribute('src');
      const url = el.querySelector('.break-all')?.textContent?.trim();
      return { name, num, hasQrImg: qrImg?.startsWith('data:image/png;base64,'), url };
    }).catch(() => null);
    console.log('Sample QR Card Data:', sampleCardData);

    // Emulate print media
    await page.emulateMediaType('print');
    const printStylesCheck = await page.evaluate(() => {
      const modal = document.querySelector('.fixed.inset-0.z-\\[700\\]');
      const headerScreen = document.querySelector('.print\\:hidden');
      const cardsGrid = document.querySelector('.printable-cards-grid');

      return {
        modalComputedDisplay: modal ? window.getComputedStyle(modal).display : null,
        headerScreenDisplay: headerScreen ? window.getComputedStyle(headerScreen).display : null,
        cardsGridDisplay: cardsGrid ? window.getComputedStyle(cardsGrid).display : null,
      };
    });
    console.log('Print media emulation check:', printStylesCheck);

    testResults.scenarios.qrModal = {
      qrModalOpen,
      generatedCardCount,
      sampleCardData,
      printStylesCheck,
    };

    console.log('\n================ COMPLETE TEST REPORT JSON ================');
    console.log(JSON.stringify(testResults, null, 2));

  } catch (error) {
    console.error('Test suite failed with error:', error);
  } finally {
    await browser.close();
  }
}

runTests();
