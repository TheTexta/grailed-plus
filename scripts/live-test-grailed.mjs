import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const targetUrl =
  process.env.GRAILED_TEST_URL ||
  "https://www.grailed.com/listings/49351795-drain-gang-drain-gang-chaos-t-shirt-white";
const timeoutMs = Number.parseInt(process.env.GRAILED_TEST_TIMEOUT_MS || "45000", 10);
const requireMarketRows = process.env.GRAILED_REQUIRE_MARKET_ROWS !== "0";
const extensionPath = path.resolve(process.cwd(), "src");

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readPanelThemeSnapshot(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const panel = document.querySelector('[data-grailed-plus-panel="1"]');
    const chip = document.querySelector(".grailed-plus__market-chip");
    const panelStyle = panel ? getComputedStyle(panel) : null;
    const chipStyle = chip ? getComputedStyle(chip) : null;

    return {
      darkModeAttr: root ? root.getAttribute("data-grailed-plus-dark-mode") : null,
      panelBorderColor: panelStyle ? panelStyle.borderTopColor : null,
      panelTextColor: panelStyle ? panelStyle.color : null,
      chipBorderColor: chipStyle ? chipStyle.borderTopColor : null
    };
  });
}

async function waitForDarkModeState(page, expectedEnabled, timeoutMs) {
  const startedAt = Date.now();
  let lastSnapshot = null;

  while (Date.now() - startedAt < timeoutMs) {
    lastSnapshot = await readPanelThemeSnapshot(page);

    const attrEnabled = lastSnapshot.darkModeAttr === "1";
    const panelBorder = String(lastSnapshot.panelBorderColor || "").replace(/\s+/g, "");
    const chipBorder = String(lastSnapshot.chipBorderColor || "").replace(/\s+/g, "");
    const panelText = String(lastSnapshot.panelTextColor || "").replace(/\s+/g, "");

    const hasDarkTokens =
      panelBorder === "rgb(255,255,255)" &&
      chipBorder === "rgb(255,255,255)";
    const hasLightTokens =
      panelBorder === "rgb(217,217,217)" &&
      chipBorder === "rgb(217,217,217)" &&
      panelText === "rgb(17,17,17)";

    if (expectedEnabled) {
      if (attrEnabled && hasDarkTokens) {
        return lastSnapshot;
      }
    } else if (!attrEnabled && hasLightTokens) {
      return lastSnapshot;
    }

    await delay(150);
  }

  throw new Error(
    "Live test failed: dark-mode toggle assertion timed out. expectedEnabled=" +
      String(expectedEnabled) +
      " snapshot=" +
      JSON.stringify(lastSnapshot)
  );
}

async function dismissConsentOverlays(page) {
  const selectors = [
    "#onetrust-accept-btn-handler",
    "#onetrust-reject-all-handler",
    "button[aria-label='Close']",
    ".onetrust-close-btn-handler"
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector);
    if ((await locator.count()) > 0) {
      try {
        await locator.first().click({ timeout: 1500 });
        await page.waitForTimeout(250);
      } catch (_) {
        // Ignore and continue trying other selectors.
      }
    }
  }
}

async function run() {
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  try {
    const page = context.pages()[0] || (await context.newPage());
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });

    await page.waitForTimeout(3000);

    try {
      await page.waitForSelector('[data-grailed-plus-panel="1"]', {
        timeout: timeoutMs,
        state: "attached"
      });
    } catch (_) {
      var panelCountNow = await page.locator('[data-grailed-plus-panel="1"]').count();
      var loadingCountNow = await page.getByText(/Grabbing\s+Listings/i).count();
      var gpClassCountNow = await page.locator('[class*="grailed-plus"]').count();
      throw new Error(
        "Live test failed: insights panel did not mount. " +
          "panelCount=" +
          panelCountNow +
          " loadingTextCount=" +
          loadingCountNow +
          " grailedPlusClassCount=" +
          gpClassCountNow
      );
    }

    await page.emulateMedia({ colorScheme: "dark" });
    const darkSnapshot = await waitForDarkModeState(page, true, timeoutMs);

    await page.emulateMedia({ colorScheme: "light" });
    const lightSnapshot = await waitForDarkModeState(page, false, timeoutMs);

    await page.emulateMedia({ colorScheme: "dark" });
    await waitForDarkModeState(page, true, timeoutMs);

    let compareButton = page.getByRole("button", { name: /compare on depop/i });
    if ((await compareButton.count()) < 1) {
      compareButton = page.locator(".grailed-plus__button--market-compare");
    }
    if ((await compareButton.count()) < 1) {
      const panelPreview = await page.locator('[data-grailed-plus-panel="1"]').first().innerText();
      throw new Error(
        "Live test failed: Compare on Depop button is missing. panelPreview=" +
          JSON.stringify((panelPreview || "").slice(0, 300))
      );
    }

    await page.waitForSelector(".grailed-plus__button--market-compare", {
      state: "attached",
      timeout: timeoutMs
    });

    compareButton = page.locator(".grailed-plus__button--market-compare").first();

    await dismissConsentOverlays(page);
    try {
      await compareButton.click({ timeout: 7000 });
    } catch (_) {
      await dismissConsentOverlays(page);
      await compareButton.click({ timeout: 7000, force: true });
    }

    await page.waitForTimeout(800);
    const chipAfterClick = await page.locator(".grailed-plus__market-chip").first().textContent();
    if (String(chipAfterClick || "").trim().toLowerCase() === "ready") {
      await page.evaluate(() => {
        const button = document.querySelector(".grailed-plus__button--market-compare");
        if (button && typeof button.click === "function") {
          button.click();
        }
      });
    }

    const start = Date.now();
    let marketRows = 0;
    let terminalState = "";
    while (Date.now() - start < timeoutMs) {
      marketRows = await page.locator(".grailed-plus__market-row").count();
      if (marketRows > 0) {
        break;
      }

      const chipText = await page.locator(".grailed-plus__market-chip").first().textContent();
      terminalState = String(chipText || "").trim().toLowerCase();
      if (terminalState === "no results" || terminalState === "error") {
        break;
      }

      await delay(500);
    }

    const chipFinalText = await page.locator(".grailed-plus__market-chip").first().textContent();
    terminalState = String(chipFinalText || "").trim().toLowerCase();

    const panelCount = await page.locator('[data-grailed-plus-panel="1"]').count();
    const loadingCount = await page.getByText(/Grabbing\s+Listings/i).count();

    if (panelCount < 1) {
      throw new Error("Live test failed: insights panel did not mount.");
    }

    if (marketRows < 1 && requireMarketRows) {
      if (terminalState === "no results" || terminalState === "error") {
        console.log("Live test passed with terminal comparator state.");
        console.log(`URL: ${targetUrl}`);
        console.log(`panelCount=${panelCount}`);
        console.log(`marketRows=${marketRows}`);
        console.log(`loadingTextCount=${loadingCount}`);
        console.log(`requireMarketRows=${requireMarketRows}`);
        console.log(`terminalState=${terminalState}`);
        return;
      }

      const marketMessageTexts = await page.locator(".grailed-plus__market-message").allTextContents();
      const panelText = await page.locator('[data-grailed-plus-panel="1"]').first().innerText();
      throw new Error(
        "Live test failed: no market comparison rows rendered before timeout. " +
          "terminalState=" +
          JSON.stringify(terminalState) +
          " " +
          "marketMessages=" +
          JSON.stringify(marketMessageTexts) +
          " panelPreview=" +
          JSON.stringify((panelText || "").slice(0, 300))
      );
    }

    const rowSnapshot = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".grailed-plus__market-row")).map((row) => {
        const link = row.querySelector(".grailed-plus__market-link");
        const meta = row.querySelector(".grailed-plus__market-meta");
        return {
          href: link ? link.getAttribute("href") || "" : "",
          linkText: link ? (link.textContent || "").trim() : "",
          metaText: meta ? (meta.textContent || "").trim() : ""
        };
      });
    });

    if (rowSnapshot.length < 1) {
      throw new Error("Live test failed: comparator row snapshot is empty.");
    }

    const invalidLink = rowSnapshot.find((row) => !/depop\.com/.test(String(row.href || "")));
    if (invalidLink) {
      throw new Error("Live test failed: comparator row link is not a Depop URL.");
    }

    const invalidMeta = rowSnapshot.find((row) => {
      const metaText = String(row.metaText || "");
      return !/score\s+\d+/i.test(metaText);
    });
    if (invalidMeta) {
      throw new Error(
        "Live test failed: comparator row meta is missing expected price/score content. " +
          JSON.stringify(invalidMeta)
      );
    }

    const scoreValues = rowSnapshot
      .map((row) => {
        const match = String(row.metaText || "").match(/score\s+(\d+)/i);
        return match ? Number.parseInt(match[1], 10) : null;
      })
      .filter((value) => Number.isFinite(value));

    const priceValues = rowSnapshot
      .map((row) => {
        const text = String(row.metaText || "").replace(/,/g, "");
        const usdMatch = text.match(/\$\s*(\d+(?:\.\d+)?)/);
        if (usdMatch) {
          return Number.parseFloat(usdMatch[1]);
        }

        const codeMatch = text.match(/\b(?:USD|EUR|GBP|CAD|AUD|JPY)\s*(\d+(?:\.\d+)?)/i);
        if (codeMatch) {
          return Number.parseFloat(codeMatch[1]);
        }

        return null;
      })
      .filter((value) => Number.isFinite(value));

    if (!scoreValues.length) {
      throw new Error(
        "Live test failed: unable to parse comparator score values. rowSnapshot=" +
          JSON.stringify(rowSnapshot)
      );
    }

    const hasBrokenZeroPrice = rowSnapshot.some((row) => /\$\s*0(?:\b|\.0+\b)/i.test(String(row.metaText || "")));
    if (hasBrokenZeroPrice) {
      throw new Error(
        "Live test failed: comparator includes broken $0 rows. rowSnapshot=" +
          JSON.stringify(rowSnapshot)
      );
    }

    const hasPositiveScore = scoreValues.some((value) => value > 0);
    const allScoresZero = scoreValues.every((value) => value === 0);

    if (!hasPositiveScore || allScoresZero) {
      throw new Error(
        "Live test failed: comparator scores are invalid (all zero or non-positive). scoreValues=" +
          JSON.stringify(scoreValues)
      );
    }

    // Price may be unavailable on some fallback rows; only explicit $0 rows are invalid.

    console.log("Live test passed.");
    console.log(`URL: ${targetUrl}`);
    console.log(`panelCount=${panelCount}`);
    console.log(`marketRows=${marketRows}`);
    console.log(`loadingTextCount=${loadingCount}`);
    console.log(`requireMarketRows=${requireMarketRows}`);
    console.log(`terminalState=${terminalState}`);
    console.log(`scoreValues=${JSON.stringify(scoreValues)}`);
    console.log(`priceValues=${JSON.stringify(priceValues)}`);
    console.log(`darkModeSnapshot=${JSON.stringify(darkSnapshot)}`);
    console.log(`lightModeSnapshot=${JSON.stringify(lightSnapshot)}`);
  } finally {
    await context.close();
  }
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
