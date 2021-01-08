const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://twitter.com/Julicooorn');

  // Get the "viewport" of the page, as reported by the page.
  const content = await page.evaluate(() => {
    return document.querySelectorAll('div[data-testid="UserDescription"]').innerHTML;
  });

  console.log('Julie :', content);

  await browser.close();
})();