import express from "express";
import { chromium } from "playwright";

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => res.send("ok"));

app.post("/vapi-tools", async (req, res) => {
  const toolCalls = req.body?.message?.toolCallList ?? [];
  const results = [];

  for (const tc of toolCalls) {
    const toolCallId = tc.id || tc.toolCallId;
    const name = tc.function?.name || tc.name;
    const args = tc.function?.arguments || tc.arguments || {};

    try {
      if (name === "amazon_search") {
        const query = args.query;
        if (!query) throw new Error("Missing args.query");

        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        await page.goto("https://www.amazon.com", { waitUntil: "domcontentloaded" });
        await page.fill('input[name="field-keywords"]', query);
        await page.click('input#nav-search-submit-button');
        await page.waitForTimeout(1500);

        // NOTE: selectors can change; this is just a starter
        const firstTitle = await page.locator("h2 a span").first().innerText().catch(() => null);
        const priceWhole = await page.locator(".a-price__whole").first().innerText().catch(() => null);
        const priceFrac = await page.locator(".a-price__fraction").first().innerText().catch(() => null);

        await browser.close();

        results.push({
          toolCallId,
          result: {
            ok: true,
            query,
            item: {
              title: firstTitle,
              price: priceWhole ? `$${priceWhole}${priceFrac ? "." + priceFrac : ""}` : null
            }
          }
        });
      } else {
        results.push({ toolCallId, result: { ok: false, error: `Unknown tool: ${name}` } });
      }
    } catch (e) {
      results.push({ toolCallId, result: { ok: false, error: e.message } });
    }
  }

  res.json({ results });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on ${port}`));
