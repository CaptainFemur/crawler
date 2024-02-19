import puppeteer from 'puppeteer';
import fs from "fs";
import inquirer from 'inquirer';

let cssSelectorsUnused = new Set();
let cssSelectorsUsed = new Set();

function extractCssSelectors(cssContent) {
    const selectorRegex = /(?:^|}|\n)([^{}\/@]+)(?=\s*{)/g;
    const mediaQueryRegex = /@media\s*\([^)]*\)\s*{[^}]*}[^}]*}/g;
    const matches = new Set();
    let match;

    // Exclure les sélecteurs dans les médias queries
    const cssContentWithoutMediaQueries = cssContent.replaceAll(mediaQueryRegex, '');
    // console.log(cssContentWithoutMediaQueries);
  
    while ((match = selectorRegex.exec(cssContentWithoutMediaQueries)) !== null) {
        if (match[1]) {
            // Diviser les sélecteurs si plusieurs sont présents sur une même ligne
            const selectorsOnLine = match[1].split(',').map(selector => selector.trim());
            matches.add(...selectorsOnLine);
        }
    }
    return matches;
}

async function cssCoveragito(css_coverage, url) {
    let final_css_bytes_unused = '';
    let final_css_bytes_used = '';
   
    for (const entry of css_coverage) {
        let filename = entry.url.split('/').pop();
        if(filename === "") continue;

        final_css_bytes_unused = "";
        let previousRange = 0;
        for (const range of entry.ranges) {
          if(previousRange != 0) final_css_bytes_unused += entry.text.slice(previousRange, range.start) + '\n';
          final_css_bytes_used += entry.text.slice(range.start, range.end) + '\n';
          previousRange = range.end;
        }

        let newSelectorsUnused = extractCssSelectors(final_css_bytes_unused);
        let newSelectorsUsed = extractCssSelectors(final_css_bytes_used);

        newSelectorsUsed.forEach((value) => {
            if(cssSelectorsUnused.has(value)) cssSelectorsUnused.delete(value);
            cssSelectorsUsed.add(value);
        });

        newSelectorsUnused.forEach((value) => {
            if(!cssSelectorsUsed.has(value)) cssSelectorsUnused.add(value);
        });
  
    }

} 

async function getUrls(page, siteUrl) {
    let urls = await page.evaluate((siteUrl) => {
        const urlArray = Array.from(document.links).filter((link) => link.href.startsWith(siteUrl) && !link.href.startsWith(siteUrl+'#') && !link.href.endsWith('.pdf') && !link.href.endsWith('.png')  && !link.href.endsWith('.jpg')).map((link) => link.href);
        const dataUrlArray = Array.from(document.querySelectorAll('[data-url]')).filter((link) => link.dataset.url.startsWith(siteUrl) && !link.dataset.url.startsWith(siteUrl+'#') && !link.dataset.url.endsWith('.pdf') && !link.dataset.url.endsWith('.png')  && !link.dataset.url.endsWith('.jpg')).map((link) => link.dataset.url);
        const uniqueUrlArray = [...new Set(urlArray), ...new Set(dataUrlArray)];
        return uniqueUrlArray;
    }, siteUrl);
    return urls;
}

async function getCoverageSite(siteUrl) {
    console.log('Début du crawl de : '+siteUrl);
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const visitedLinks = new Set(); // Utilisé pour éviter de revisiter les mêmes liens

    async function crawlPage(url) {
        //pour clean les # dans les urls
        let tempUrlWithoutAnchor = url.match(/(.*)\/#/);
        url = tempUrlWithoutAnchor !== null ? tempUrlWithoutAnchor[1] : url;
        if(!url.endsWith('/')) url = url+"/";

        if (visitedLinks.has(url)) {
            return;
        }

        await page.coverage.startCSSCoverage();
        console.log('Visite de la page:', url);
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        const css_coverage = await page.coverage.stopCSSCoverage();
        visitedLinks.add(url);

        cssCoveragito(css_coverage, url);

        const linksOnPage = await getUrls(page, siteUrl);

        for (const link of linksOnPage) {
            // Assurez-vous que le lien appartient au même domaine (évite les liens externes)
            const isSameDomain = new URL(link).hostname === new URL(siteUrl).hostname;
            if (isSameDomain /*&& visitedLinks.size < 10*/) {
                await crawlPage(link);
            }
        }
    }

    await crawlPage(siteUrl);

    await browser.close();
    return Array.from(visitedLinks);
}

const questions = [
  {
    type: 'input',
    name: 'siteUrl',
    message: "Url du site que vous souhaitez crawler :",
  }
];
inquirer.prompt(questions).then(answers => {
    const siteUrl = answers.siteUrl;
    getCoverageSite(siteUrl)
    .then(result => {
        fs.writeFile('./app/css/pagesCrawlees.txt', result.join('\n'), 'utf-8', (err) => {
            if(err) console.log(err);
        });
        fs.writeFile('./app/css/cssInutilises.txt', Array.from(cssSelectorsUnused).join('\n'), 'utf-8', (err) => {
            if(err) console.log(err);
        });
        fs.writeFile('./app/css/cssUtilises.txt', Array.from(cssSelectorsUsed).join('\n'), 'utf-8', (err) => {
            if(err) console.log(err);
        });
    })
    .catch(error => {
        console.error('Une erreur s\'est produite:', error);
    });
});
// 
// const siteUrl = 'http://localhost:8000/';
