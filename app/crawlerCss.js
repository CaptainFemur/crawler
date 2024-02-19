import puppeteer from 'puppeteer';
import fs from "fs";

function extractCssSelectors(cssContent) {
  const selectorRegex = /(?:^|}|\n)([^{}\/@]+)(?=\s*{)/g;
  // const mediaQueryRegex = /@media\s*\([^)]*\)\s*{[^}]*}[^}]*}/g;
  const matches = new Set();
  let match;

  // Exclure les sélecteurs dans les médias queries
  // const cssContentWithoutMediaQueries = cssContent.replaceAll(mediaQueryRegex, '');
  // console.log(cssContentWithoutMediaQueries);

  // while ((match = selectorRegex.exec(cssContentWithoutMediaQueries)) !== null) {
    while ((match = selectorRegex.exec(cssContent)) !== null) {
      if (match[1]) {
          // Diviser les sélecteurs si plusieurs sont présents sur une même ligne
          const selectorsOnLine = match[1].split(',').map(selector => selector.trim());
          selectorsOnLine.forEach(selector => matches.add(selector));
      }
  }
  return matches;
}

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

    const cssUnused = extractCssSelectors(final_css_bytes);
  
    let filename = entry.url.split('/').pop();
  
    fs.writeFile('./app/css/'+filename, Array.from(cssUnused).join('\n'), error => {
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