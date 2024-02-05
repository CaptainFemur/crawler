import puppeteer from 'puppeteer';
import fs from "fs";
let cssSelectors = new Set();

function extractCssSelectors(cssContent) {
    const selectorRegex = /(?:^|}|\n)([^{}\/@]+)(?=\s*{)/g;
    const matches = new Set();
    let match;
  
    while ((match = selectorRegex.exec(cssContent)) !== null) {
      if (match[1] && !match[1].includes('@media')) {
        // Diviser les sélecteurs si plusieurs sont présents sur une même ligne
        const selectorsOnLine = match[1].split(',').map(selector => selector.trim());
        matches.add(...selectorsOnLine);
      }
    }
    return matches;
}

async function cssCoveragito(css_coverage) {
    let final_css_bytes = '';
    let total_bytes = 0;
    let used_bytes = 0;
   
    for (const entry of css_coverage) {
        let filename = entry.url.split('/').pop();
        if(filename === "") continue;

        final_css_bytes = "";
        total_bytes += entry.text.length;
        let previousRange = 0;
        for (const range of entry.ranges) {
          used_bytes += range.end - range.start - 1;
          if(previousRange != 0) final_css_bytes += entry.text.slice(previousRange, range.start) + '\n';
          previousRange = range.end;
        }

        let newSelectors = extractCssSelectors(final_css_bytes);
        cssSelectors = new Set([...cssSelectors, ...newSelectors]);

        // console.log('Fichier '+filename);

        // try {
        //     let contentFile = fs.readFileSync('./app/css/'+filename, {'encoding': 'utf8'});

        //     console.log(contentFile);
        //     console.log(final_css_bytes);

        //     const linesFichierExistant = contentFile.split('\n');
        //     const linesRecues = final_css_bytes.split('\n');

        //     // Garder les parties communes de A et B
        //     const commonLines = linesFichierExistant.filter(line => linesRecues.includes(line));
    
        //     // Ajouter les parties de B qui ne sont pas dans A
        //     const newLines = linesRecues.filter(line => !linesFichierExistant.includes(line));
    
        //     // Fusionner les parties communes avec les nouvelles parties de B
        //     const mergedContent = commonLines.concat(newLines).join('\n');
    
        //     // Écrire le résultat dans le fichier A
        //     fs.writeFile('./app/css/'+filename, mergedContent, 'utf8', (err) => {
        //       if (err) {
        //         console.error(`Erreur lors de l'écriture dans le fichier : ${err}`);
        //         return;
        //       }
        //       console.log('Opération de fusion réussie.');
        //     });
        // } catch(e){
        //     console.log(e.code);
        //     //Si fichier pas existant on le créee
        //     if (e.code === "ENOENT") {
        //         fs.writeFile('./app/css/'+filename, final_css_bytes, error => {
        //             if (!error) {
        //             console.log('Fichier crée.');
        //             }
        //         });
        //     }
        // }
        

    //   fs.readFile('./app/css/'+filename, 'utf8', (err, contentFile) => {
    //     if (err) {
    //         fs.writeFile('./app/css/'+filename, final_css_bytes, error => {
    //             if (!error) {
    //               console.log('Fichier crée.');
    //             }
    //         });
    //         return;
    //     }

    //     console.debug(final_css_bytes);
   
    
    //     // Comparer et fusionner les contenus
    //     const linesFichierExistant = contentFile.split('\n');
    //     const linesRecues = final_css_bytes.split('\n');

    //     // Garder les parties communes de A et B
    //     const commonLines = linesFichierExistant.filter(line => linesRecues.includes(line));

    //     // Ajouter les parties de B qui ne sont pas dans A
    //     const newLines = linesRecues.filter(line => !linesFichierExistant.includes(line));

    //     // Fusionner les parties communes avec les nouvelles parties de B
    //     const mergedContent = commonLines.concat(newLines).join('\n');

    
    //     // Écrire le résultat dans le fichier A
    //     fs.writeFile('./app/css/'+filename, mergedContent, 'utf8', (err) => {
    //       if (err) {
    //         console.error(`Erreur lors de l'écriture dans le fichier : ${err}`);
    //         return;
    //       }
    //       console.log('Opération de fusion réussie.');
    //     });
    //   });
    
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

        if (visitedLinks.has(url)) {
            return;
        }

        await page.coverage.startCSSCoverage();
        console.log('Visite de la page:', url);
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        const css_coverage = await page.coverage.stopCSSCoverage();
        visitedLinks.add(url);

        cssCoveragito(css_coverage);

        const linksOnPage = await getUrls(page, siteUrl);

        for (const link of linksOnPage) {
            // Assurez-vous que le lien appartient au même domaine (évite les liens externes)
            const isSameDomain = new URL(link).hostname === new URL(siteUrl).hostname;
            if (isSameDomain && visitedLinks.size < 10) {
                await crawlPage(link);
            }
        }
    }

    await crawlPage(siteUrl);

    await browser.close();
    return Array.from(visitedLinks);
}

const siteUrl = 'http://localhost:8000/';
getCoverageSite(siteUrl)
  .then(result => {
    fs.writeFile('./app/css/pagesCrawlees.txt', result.join('\n'), 'utf-8', (err) => {
        if(err) console.log(err);
    });
    fs.writeFile('./app/css/cssInutilises.txt', Array.from(cssSelectors).join('\n'), 'utf-8', (err) => {
        if(err) console.log(err);
    });
    // console.log('Liste de toutes les pages du site:', result);
    // console.log('Liste des css pas utilisés : ', cssSelectors);
    // console.log('Liste de toutes les pages du site:', result.join('\n'));
    // console.log('Liste des css pas utilisés : ', cssSelectors);
  })
  .catch(error => {
    console.error('Une erreur s\'est produite:', error);
  });
