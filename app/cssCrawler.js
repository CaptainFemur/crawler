const puppeteer = require('puppeteer');
const fs  = require('fs');
const { SlowBuffer } = require('buffer');
const util = require('util');




function isBase64(str) {
      try {
          return btoa(atob(str)) == str;
      } catch (err) {
          return false;
      }
}

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


const checkCss = async (page, arrayCssUsed, arrayCssUnused, styles) => {
            styles.forEach(async function(styleOfCss) {
                    const cssUsed = styleOfCss.match(/\.-?[_a-zA-Z]+[_a-zA-Z0-9-]*\s*\{/gm);
                    if(cssUsed != null || cssUsed != undefined){
                        // console.log('\t check du css');
                        let tempClassChecked = [];
                        cssUsed.forEach(async function(cssClassName){
                            const classNamePurified = cssClassName.replace(/{/,'');
                            // console.log('Check de '+classNamePurified);
                            if(arrayCssUsed.includes(classNamePurified) || tempClassChecked.includes(classNamePurified)){
                                // console.log('déjà dans l array : ' + classNamePurified);
                                // return;
                            } else {
                                // console.log('Check selector ' + classNamePurified);
                                tempClassChecked.push(classNamePurified);
                                try {
                                    const tests = await page.evaluate(selector =>{
                                        return [...document.querySelectorAll(selector)];
                                    }, classNamePurified);
                                    // return process.kill(process.pid);
                                    if(tests != undefined && tests.length > 0){
                                        // console.log(classNamePurified + ' ajouté à la liste des CSS utilisés');
                                        arrayCssUsed.push(classNamePurified);
                                        const index = arrayCssUnused.indexOf(classNamePurified);
                                        if (index > -1) {
                                            arrayCssUnused.splice(index, 1);
                                        }
                                        // return;
                                    } else {
                                        // console.log(classNamePurified + ' non utilisé');
                                        if(arrayCssUnused.includes(classNamePurified)){
                                            // return;
                                        } else {
                                            arrayCssUnused.push(classNamePurified);
                                            // return;
                                        }
                                    }
                                } catch(error){
                                    console.log(error);
                                }
                            }
                        });
                    }
            });

}

const getAllUrl = async (browser, urlList, urlListCrawled, arrayCssUsed, arrayCssUnused) => {
    if(urlList.length > 0){
        let page = await browser.newPage();
        const url = urlList.shift();
        let styles = [];
        if(urlListCrawled.includes(url)){
            return getAllUrl(browser, urlList, urlListCrawled, arrayCssUsed, arrayCssUnused);
        }
        console.log('Check de l\'url : '+url);
        page.on('response',async response => {
            if(response.request().resourceType() === 'stylesheet') {
                //TODO trycatch par ici je crois ?
                const url = await response.url();
                try {
                    const styleContent = await response.text();
                    styles.push(styleContent);
                } catch (error){
                    console.log('Erreur de lecture de : '+ url);
                }
                
            }
        });
        try {
            await page.goto(url);
        } catch (err) {
            console.error(err.message);
            return getAllUrl(browser, urlList, urlListCrawled, arrayCssUsed, arrayCssUnused);
        }
        await page.waitForSelector('body');
        const allHrefs = await page.evaluate(() =>
            [...document.querySelectorAll('a[href^="http://local.selexium.com/"], a[href^="/"]')].map(link => link.href)
        );
        const allDataUrls = await page.evaluate(() => 
                [...document.querySelectorAll('[data-url]')].map(function(element){
                    const dataUrl = element.getAttribute('data-url');
                    // if(isBase64(dataUrl) == false){
                        if(dataUrl.includes('local.selexium.com') && !dataUrl.startsWith('#') && !dataUrl.startsWith('mailto') && !dataUrl.includes('linkedin.com') && !dataUrl.includes('facebook.com') && !dataUrl.includes('twitter.com') && !dataUrl.includes('plus.google.com')){
                            return dataUrl;
                        } else {
                            return ;
                        } 
                    // } else {
                    //     let decodeUrl = atob(dataUrl);
                    //     if(decodeUrl.startsWith('/')){
                    //         decodeUrl = 'http://local.selexium.com' + decodeUrl;
                    //     }
                    //     if(decodeUrl.includes('local.selexium.com') && !decodeUrl.startsWith('#') && !decodeUrl.startsWith('mailto') && !decodeUrl.includes('linkedin.com') && !decodeUrl.includes('facebook.com') && !decodeUrl.includes('twitter.com') && !dataUrl.includes('plus.google.com')){
                    //         return decodeUrl;
                    //     } else {
                    //         return ;
                    //     } 
                    // }
                })    
        );

        // console.log(util.inspect(allHrefs, { maxArrayLength: null }))
        // return process.kill(process.pid);
        
        urlListCrawled.push(url);
        urlList = mergeArrays(urlList,allHrefs,allDataUrls);

        await checkCss(page, arrayCssUsed, arrayCssUnused, styles);

        await page.close();
        // if(urlList.length > 200){
        //     urlList = [];
        // }
        return getAllUrl(browser, urlList, urlListCrawled, arrayCssUsed, arrayCssUnused);
    } else {
        return [urlListCrawled, arrayCssUsed, arrayCssUnused];
    }
}


const scrap = async () => {
    const browser = await puppeteer.launch({ headless: false });
    let urlListCrawled = [];
    let arrayCssUsed = [];
    let arrayCssUnused = [];
    let urlList = ["http://local.selexium.com/"];
    const result = await getAllUrl(browser, urlList, urlListCrawled, arrayCssUsed, arrayCssUnused);
    browser.close();
    return result;
}

scrap()
  .then(value => {
        // console.log('On est dans le then du scrap ?');
        // console.log(value);
        fs.writeFileSync('./pagesCrawled.txt', value[0].join ('\n') , {flag: "w"});
        fs.writeFileSync('./classUsed.txt', value[1].join ('\n') , {flag: "w"});
        fs.writeFileSync('./classPasUsed.txt', value[2].join ('\n') , {flag: "w"});
  })
  .catch(e => console.log(`error: ${e}`))

