const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({headless: false});
  const page = await browser.newPage();
  await page.goto('http://www.root-top.com/topsite/callista/in.php?IDmark=513');
//   await page.screenshot({path: './screenshots/example.png'});

//   await browser.close();
})();