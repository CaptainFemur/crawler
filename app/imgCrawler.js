const puppeteer = require('puppeteer');
const fs  = require('fs');

//Site a vérifier
const urlList = ['https://www.la-loi-pinel.com/'];
const urlTestedList = [];
const imgList = [];

function mergeArrays(...arrays) {
    let jointArray = []

    arrays.forEach(array => {
        jointArray = [...jointArray, ...array]
    })
    const uniqueArray = jointArray.reduce((newArray, item) =>{
        if (newArray.includes(item)){
            return newArray
        } else {
            return [...newArray, item]
        }
    }, [])
    return uniqueArray
}



  const getAllUrl = async (browser, urlList, imgList) => {
    if(urlList.length > 0){
        let page = await browser.newPage();
        const url = urlList.shift();
        if(url){
            if(urlTestedList.includes(url)){
                return getAllUrl(browser, urlList, imgList);
            }
            console.log('Check de l\'url : '+url);
            try {
                await page.goto(url);
            } catch (err) {
                console.error(err.message);
                return getAllUrl(browser, urlList);
            }
            await page.waitForSelector('body');
            const allHrefs = await page.evaluate(() =>
                [...document.querySelectorAll('a[href^="https://www.la-loi-pinel.com/"], a[href^="/"]')].map(link => {
                    if(link.href.match(/(?!.+\.pdf$).+$/)) link.href
                })
            );
            const allDataUrls = await page.evaluate(() => 
                    [...document.querySelectorAll('[data-url]')].map(function(element){
                        const dataUrl = element.getAttribute('data-url');
                            if(dataUrl.includes('la-loi-pinel.com') && !dataUrl.startsWith('#') && !dataUrl.startsWith('mailto') && !dataUrl.includes('linkedin.com') && !dataUrl.includes('facebook.com') && !dataUrl.includes('twitter.com') && !dataUrl.includes('plus.google.com') && !dataUrl.includes('.pdf')){
                                return dataUrl;
                            } else {
                                return ;
                            } 
                    })    
            );
            urlList = mergeArrays(urlList,allHrefs,allDataUrls);

            //Récupération des images
            const imgSrcs = await page.evaluate(() => {
                //Récupération des balises img
                const allImages = document.querySelectorAll("img")
                let tempArray = [];
                allImages && allImages.forEach(img => {
                    if(img.getAttribute("src") && !(img.getAttribute("src")).includes('svg') && !(img.getAttribute("src")).includes('.bing') && !tempArray.includes(img.getAttribute("src"))){
                        tempArray.push(img.getAttribute("src"))

                    }
                })
                //Récupération des bg-image
                const regex = /background-image.+?\((.+?)\)/gi;
                const allBgImages = document.body.innerHTML.match(regex)
                console.log(allBgImages)
                allBgImages && allBgImages.map(function(e){
                    if(!tempArray.includes(((e.match(/background-image.+?\((.+?)\)/i) ||[])[1] || '').replace(/&quot;|"/g,'')) && !(((e.match(/background-image.+?\((.+?)\)/i) ||[])[1] || '').replace(/&quot;|"/g,'')).includes('svg') && !(((e.match(/background-image.+?\((.+?)\)/i) ||[])[1] || '').replace(/&quot;|"/g,'')).includes('.bing')){
                        tempArray.push(((e.match(/background-image.+?\((.+?)\)/i) ||[])[1] || '').replace(/&quot;|"/g,''))
                    }
                });
                return tempArray
            });
            console.log("Page analysée");
            imgSrcs.forEach(img =>{
                console.log(img)
                if(!imgList.includes(img)){
                    imgList.push(img)
                }
            })
            console.log('nombre images : '+imgList.length)
            urlTestedList.push(url)
            console.log('Liste url : '+urlList.length)
            console.log('Liste url finale : '+urlTestedList.length)
            await page.close();
            return getAllUrl(browser, urlList, imgList);
        }else{
            return getAllUrl(browser, urlList, imgList);
        }
    } else {
        console.log("scrap terminé")
        console.log(imgList)
        return [imgList];
    }
}

const scrap = async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--shm-size=3gb'] });
    const images = await getAllUrl(browser, urlList, imgList);
    console.log('Récupération des images terminée');
    console.log(images.length)
    browser.close();
    return images;
}

scrap()
  .then(value => {
        console.log('Script terminé.');
        console.log(value)
        fs.writeFileSync('./imgList.txt', value.join ('\n') , {flag: "w"});
  })
  .catch(e => console.log(`error: ${e}`))
