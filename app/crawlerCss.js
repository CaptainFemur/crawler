import puppeteer from 'puppeteer';
import fs from "fs";

async function cssCoveragito(siteUrl) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.coverage.startCSSCoverage();
  await page.goto(siteUrl); // Change this
  const css_coverage = await page.coverage.stopCSSCoverage();
  //  console.log(util.inspect(css_coverage, { showHidden: false, depth: null }));
  await browser.close();
  //  console.log(css_coverage);
 
  let final_css_bytes = '';
  let total_bytes = 0;
  let used_bytes = 0;
 
  for (const entry of css_coverage) {
    final_css_bytes = "";
  
    total_bytes += entry.text.length;
    let previousRange = 0;
    for (const range of entry.ranges) {
      used_bytes += range.end - range.start - 1;
      if(previousRange != 0) final_css_bytes += entry.text.slice(previousRange, range.start) + '\n';
      previousRange = range.end;
    }
  
    let filename = entry.url.split('/').pop();
  
    fs.writeFile('./app/css/'+filename, final_css_bytes, error => {
      if (!error) {
        console.log('File saved');
      }
    });
  }
} 

// Utilisation de la fonction
const siteUrl = 'http://localhost:8000/';
cssCoveragito(siteUrl);

// export default cssCoveragito;