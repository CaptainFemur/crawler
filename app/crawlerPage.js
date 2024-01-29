const puppeteer = require('puppeteer');

//Todo exclure les ancres ?
async function getUrls(page, siteUrl) {
    let urls = await page.evaluate((siteUrl) => {
        const urlArray = Array.from(document.links).filter((link) => link.href.startsWith(siteUrl) && !link.href.startsWith(siteUrl+'#')).map((link) => link.href);
        const dataUrlArray = Array.from(document.querySelectorAll('[data-url]')).filter((link) => link.dataset.url.startsWith(siteUrl) && !link.dataset.url.startsWith(siteUrl+'#')).map((link) => link.dataset.url);
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


// async function getUrls(page, siteUrl) {
//     let urls = await page.evaluate((siteUrl) => {
//         const urlArray = Array.from(document.links).filter((link) => link.href.startsWith(siteUrl) && !link.href.startsWith(siteUrl+'#')).map((link) => link.href);
//         const dataUrlArray = Array.from(document.querySelectorAll('[data-url]')).filter((link) => link.dataset.url.startsWith(siteUrl) && !link.dataset.url.startsWith(siteUrl+'#')).map((link) => link.dataset.url);
//         const uniqueUrlArray = [...new Set(urlArray), ...new Set(dataUrlArray)];
//         return uniqueUrlArray;
//     }, siteUrl);
//     return urls;
// }

// async function getAllLinks(siteUrl) {
//   console.log('Début du crawl de : '+siteUrl);
//   const browser = await puppeteer.launch();
//   const page = await browser.newPage();

//   // Naviguer vers la page principale du site
//   await page.goto(siteUrl);

//   // Extraire les liens de la page principale
//   const links = await getUrls(page, siteUrl);
// //   const links = await page.evaluate(() => {
// //     const anchorElements = document.querySelectorAll('a');
// //     return Array.from(anchorElements, anchor => anchor.href);
// //   });

//   // Visiter chaque lien et extraire les liens de chaque page
//   const allLinks = [];
//   for (const link of links) {
//     await page.goto(link);
//     console.log('Crawl de la page : '+link);
    
//     const pageLinks = await page.evaluate((siteUrl) => {
//         const urlArray = Array.from(document.links).filter((link) => link.href.startsWith(siteUrl) && !link.href.startsWith(siteUrl+'#')).map((link) => link.href);
//         const dataUrlArray = Array.from(document.querySelectorAll('[data-url]')).filter((link) => link.dataset.url.startsWith(siteUrl) && !link.dataset.url.startsWith(siteUrl+'#')).map((link) => link.dataset.url);
//         const uniqueUrlArray = [...new Set(urlArray), ...new Set(dataUrlArray)];
//         return uniqueUrlArray;
//     //   const anchorElements = document.querySelectorAll('a');
//     //   return Array.from(anchorElements, anchor => anchor.href);
//     }, siteUrl);

//     allLinks.push({ page: link, links: pageLinks });
//   }

//   await browser.close();

//   return allLinks;
// }

// // Utilisation de la fonction
// const siteUrl = 'http://localhost:8000';
// getAllLinks(siteUrl)
//   .then(result => {
//     console.log(result);
//   })
//   .catch(error => {
//     console.error('Une erreur s\'est produite:', error);
//   });

// const puppeteer = require('puppeteer');
// const util = require('util');
// const fs    = require("fs");

// (async () => {
//     var siteUrl = 'http://localhost:8000/';
//     let urlsToCrawl = [siteUrl];
//     let urlsCrawled = [];

//     //Function pour récupérer tous les liens de la page (href & data url)
//     async function getUrls(page) {
//         let urls = await page.evaluate((siteUrl) => {
//             const urlArray = Array.from(document.links).filter((link) => link.href.startsWith(siteUrl) && !link.href.startsWith(siteUrl+'#')).map((link) => link.href);
//             const dataUrlArray = Array.from(document.querySelectorAll('[data-url]')).filter((link) => link.dataset.url.startsWith(siteUrl) && !link.dataset.url.startsWith(siteUrl+'#')).map((link) => link.dataset.url);
//             const uniqueUrlArray = [...new Set(urlArray), ...new Set(dataUrlArray)];
//             return uniqueUrlArray;
//         }, siteUrl);
//         return urls;
//     }

//     const browser = await puppeteer.launch();

//     async function crawlPages(urlsToCrawl){
//         console.log('YES', urlsToCrawl);
//         for(const link of urlsToCrawl){
//             //On ouvre une nouvelle page et on va dessus
//             let newPage = await browser.newPage();
//             console.log('Crawl de la page : '+link);
//             await newPage.goto(link);

//             //On récupère les liens et on fait le tri
//             let urls = await getUrls(newPage);
//             urlsToCrawl = [...new Set(urlsToCrawl), ...new Set(urls)];
//             urlsToCrawl = urlsToCrawl.filter(url => !urlsCrawled.includes(url));

//             //On retire l'url crawlée
//             const indexU = urlsToCrawl.indexOf(link);
//             urlsToCrawl.splice(indexU, 1);
            
//             //On l'ajoute dans le tab de celles crawlées
//             //On push et on se fiche des doublons car ils sont retirés par le Set juste après
//             urlsCrawled.push(link);

//             //On ferme la page
//             await newPage.close();

//             //On continue
//             crawlPages(urlsToCrawl)
//         }
//     }

//     await crawlPages(urlsToCrawl);

//     // async function crawlSite() {
//         // console.log(urlsToCrawl);

//     // while(urlsToCrawl.length != 0){
//     //     console.log('On est là');
    
//         // urlsToCrawl.forEach(async function(link, index){
//         //     //On ouvre une nouvelle page et on va dessus
//         //     let newPage = await browser.newPage();
//         //     console.log('Crawl de la page : '+link);
//         //     await newPage.goto(link);

//         //     //On récupère les liens et on fait le tri
//         //     let urls = await getUrls(page);
//         //     urlsToCrawl = [...new Set(urlsToCrawl), ...new Set(urls)];
//         //     urlsToCrawl = [...(new Set(urlsToCrawl)).difference(new Set(urlsCrawled))];

//         //     //On retire l'url crawlée
//         //     urlsToCrawl = urlsToCrawl.splice(index, 1);
            
//         //     //On l'ajoute dans le tab de celles crawlées
//         //     //On push et on se fiche des doublons car ils sont retirés par le Set juste après
//         //     urlsCrawled.push(link);

//         //     //On ferme la page
//         //     await newPage.close();
//         // }, urlsToCrawl);
//         // console.log('Et on repart pour un tour');
//     // }
//     // }
        
//     // await crawlSite();
//     // console.log('URLS FAITES : ',urlsCrawled);
//     // console.log('URLS A FAIRE : ', urlsToCrawl);
    
//     await browser.close();

// })();

// (async () => {
//   const browser = await puppeteer.launch();
//   const page = await browser.newPage();
//   var siteUrl = 'http://localhost:8000/';
//   let urlsToCrawl = [];
//   let urlsCrawled = [];
//   await page.goto(siteUrl);
//   console.log('On commence le crawl du site : '+ siteUrl);

//   async function getUrls(page) {
//     let urls = await page.evaluate((siteUrl) => {
//       const urlArray = Array.from(document.links).filter((link) => link.href.startsWith(siteUrl) && !link.href.startsWith(siteUrl+'#')).map((link) => link.href);
//       const dataUrlArray = Array.from(document.querySelectorAll('[data-url]')).filter((link) => link.dataset.url.startsWith(siteUrl) && !link.dataset.url.startsWith(siteUrl+'#')).map((link) => link.dataset.url);
//       const uniqueUrlArray = [...new Set(urlArray), ...new Set(dataUrlArray)];
//       return uniqueUrlArray;
//     }, siteUrl);
//     return urls;
//   }

//   async function crawlSite() {
//     let urls = await getUrls(page);
//     urlsToCrawl = [...new Set(urlsToCrawl), ...new Set(urls)];

//     // console.log(urlsToCrawl);
//     // return urlsToCrawl;
//     let pagePromise = (link) => new Promise(async(resolve, reject) => {
//       let newPage = await browser.newPage();
//       console.log('Crawl de la page : '+link);
//       await newPage.goto(link);
//       let newUrls = await getUrls(newPage);
//       resolve(newUrls);
//       await newPage.close();
//     });

//     // urlsToCrawl.forEach(async function(link, index){
//     //   //On récupère tous les liens dessus
//     //   let currentPageLinks = await pagePromise(link);
//     //   urlsToCrawl = [...new Set(urlsToCrawl), ...new Set(currentPageLinks)];

//     //   //On retire l'url crawlée
//     //   urlsToCrawl = urlsToCrawl.splice(index, 1);
      
//     //   //On l'ajoute dans le tab de celles crawlées
//     //   //On push et on se fiche des doublons car ils sont retirés par le Set juste après
//     //   urlsCrawled.push(link);
//     // }, urlsToCrawl);

//     for(link in urlsToCrawl){

//       //On retire l'url crawlée
//       urlsToCrawl = urlsToCrawl.splice(link, 1);
      
//       //On l'ajoute dans le tab de celles crawlées
//       //On push et on se fiche des doublons car ils sont retirés par le Set juste après
//       urlsCrawled.push(urls[link]);

//       //On récupère tous les liens dessus
//       let currentPageLinks = await pagePromise(urls[link]);
//       urlsToCrawl = [...new Set(urlsToCrawl), ...new Set(currentPageLinks)];

//       // console.log('Etat des pages à crawl : ', urlsToCrawl);
//     }
//   }

//   await crawlSite();
//   // console.log('URLS FAITES : ',urlsCrawled);
//   // console.log('URLS A FAIRE : ', urlsToCrawl);
  
//   await browser.close();
// })();



// (async () => {
//   const browser = await puppeteer.launch();
//   const page = await browser.newPage();
//   const siteUrl = 'http://localhost:8000';
//   let urlsToCrawl = [];
//   let urlsCrawled = [];
//   await page.goto(siteUrl);

//   async function crawlPage() {
//     let urls = await page.evaluate(() => {
//       const urlArray = Array.from(document.links).map((link) => link.href);
//       const dataUrlArray = Array.from(document.querySelectorAll('[data-url]')).map((link) => link.dataset.url);
//       const uniqueUrlArray = [...new Set(urlArray), ...new Set(dataUrlArray)];
//       return uniqueUrlArray;
//     });

//     urlsToCrawl = [...new Set(urlsToCrawl), ...new Set(urls)];
//     return urlsToCrawl;

//   }

//   let test = await crawlPage();
//   console.log(test);
  
//   await browser.close();
// })();