const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({headless: false});
  const page = await browser.newPage();
  await page.goto('https://www.selexium.com/');
  await page.screenshot({path: './screenshots/example.png'});

  await browser.close();
})();