const puppeteer = require('puppeteer');

//Todo exclure les ancres ?
async function getUrls(page, siteUrl) {
    let urls = await page.evaluate((siteUrl) => {
        const urlArray = Array.from(document.links).filter((link) => link.href.startsWith(siteUrl) && !link.href.startsWith(siteUrl+'#') && !link.href.endsWith('.pdf') && !link.href.endsWith('.png')  && !link.href.endsWith('.jpg')).map((link) => link.href);
        const dataUrlArray = Array.from(document.querySelectorAll('[data-url]')).filter((link) => link.dataset.url.startsWith(siteUrl) && !link.dataset.url.startsWith(siteUrl+'#') && !link.dataset.url.endsWith('.pdf') && !link.dataset.url.endsWith('.png')  && !link.dataset.url.endsWith('.jpg')).map((link) => link.dataset.url);
        const uniqueUrlArray = [...new Set(urlArray), ...new Set(dataUrlArray)];
        return uniqueUrlArray;
    }, siteUrl);
    return urls;
}

async function getAllLinks(siteUrl) {
    console.log('Début du crawl de : '+siteUrl);
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const visitedLinks = new Set(); // Utilisé pour éviter de revisiter les mêmes liens

    async function crawlPage(url) {
        if (visitedLinks.has(url)) {
            return;
        }

        console.log('Visite de la page:', url);
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        visitedLinks.add(url);

        const linksOnPage = await getUrls(page, siteUrl);

        for (const link of linksOnPage) {
            // Assurez-vous que le lien appartient au même domaine (évite les liens externes)
            const isSameDomain = new URL(link).hostname === new URL(siteUrl).hostname;
            if (isSameDomain) {
                await crawlPage(link);
            }
        }
    }

  await crawlPage(siteUrl);

  await browser.close();

  return Array.from(visitedLinks);
}

// Utilisation de la fonction
const siteUrl = 'http://localhost:8000';
getAllLinks(siteUrl)
  .then(result => {
    console.log('Liste de toutes les pages du site:', result);
  })
  .catch(error => {
    console.error('Une erreur s\'est produite:', error);
  });
