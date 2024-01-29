const puppeteer = require('puppeteer');
const util = require('util');
const fs    = require("fs");


(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  var siteUrl = 'http://localhost:8000/';
  let urlsToCrawl = [];
  let urlsCrawled = [];
  await page.goto(siteUrl);
  console.log('On commence le crawl du site : '+ siteUrl);

  async function getUrls(page) {
    let urls = await page.evaluate((siteUrl) => {
      const urlArray = Array.from(document.links).filter((link) => link.href.startsWith(siteUrl) && !link.href.startsWith(siteUrl+'#')).map((link) => link.href);
      const dataUrlArray = Array.from(document.querySelectorAll('[data-url]')).filter((link) => link.dataset.url.startsWith(siteUrl) && !link.dataset.url.startsWith(siteUrl+'#')).map((link) => link.dataset.url);
      const uniqueUrlArray = [...new Set(urlArray), ...new Set(dataUrlArray)];
      return uniqueUrlArray;
    }, siteUrl);
    return urls;
  }

  async function crawlSite() {
    let urls = await getUrls(page);
    urlsToCrawl = [...new Set(urlsToCrawl), ...new Set(urls)];

    // console.log(urlsToCrawl);
    // return urlsToCrawl;
    let pagePromise = (link) => new Promise(async(resolve, reject) => {
      let newPage = await browser.newPage();
      console.log('Crawl de la page : '+link);
      await newPage.goto(link);
      let newUrls = await getUrls(newPage);
      resolve(newUrls);
      await newPage.close();
    });

    // urlsToCrawl.forEach(async function(link, index){
    //   //On récupère tous les liens dessus
    //   let currentPageLinks = await pagePromise(link);
    //   urlsToCrawl = [...new Set(urlsToCrawl), ...new Set(currentPageLinks)];

    //   //On retire l'url crawlée
    //   urlsToCrawl = urlsToCrawl.splice(index, 1);
      
    //   //On l'ajoute dans le tab de celles crawlées
    //   //On push et on se fiche des doublons car ils sont retirés par le Set juste après
    //   urlsCrawled.push(link);
    // }, urlsToCrawl);

    for(link in urlsToCrawl){

      //On retire l'url crawlée
      urlsToCrawl = urlsToCrawl.splice(link, 1);
      
      //On l'ajoute dans le tab de celles crawlées
      //On push et on se fiche des doublons car ils sont retirés par le Set juste après
      urlsCrawled.push(urls[link]);

      //On récupère tous les liens dessus
      let currentPageLinks = await pagePromise(urls[link]);
      urlsToCrawl = [...new Set(urlsToCrawl), ...new Set(currentPageLinks)];

      // console.log('Etat des pages à crawl : ', urlsToCrawl);
    }
  }

  await crawlSite();
  // console.log('URLS FAITES : ',urlsCrawled);
  // console.log('URLS A FAIRE : ', urlsToCrawl);
  
  await browser.close();
})();



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