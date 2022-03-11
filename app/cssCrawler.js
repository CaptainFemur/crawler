const puppeteer = require('puppeteer');
const fs  = require('fs');
const { SlowBuffer } = require('buffer');
const util = require('util');
const { url } = require('inspector');




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

const getAllStylesheets = async(browser, urlList, stylesUrl, stylesContent) => {
    let newUrlList = [...urlList];
    if(newUrlList.length > 0){
        let page = await browser.newPage();
        const url = newUrlList.shift();
        page.on('response',async response => {
            if(response.request().resourceType() === 'stylesheet') {
                //TODO trycatch par ici je crois ?
                try {
                    const styleContent = await response.text();
                    stylesContent += styleContent;

                    const url = await response.url();
                    if(!stylesUrl.includes(url)) stylesUrl.push(url);
                } catch (error){
                    console.log('Erreur de lecture de : '+ url);
                    console.log(error);
                }   
            }
        });
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            console.log('Check de la page : '+url);
            return getAllStylesheets(browser, newUrlList, stylesUrl, stylesContent);
        } catch (err) {
            console.error(err.message);
            return getAllStylesheets(browser, newUrlList, stylesUrl, stylesContent);
        }
    } else {
        return [stylesUrl, stylesContent];
    }
}

const verifyCss = async (browser, urlList, stylesContent, arrayCssUnused = [], arrayCssUsed = []) => {
    let newUrlList = [...urlList];
    if(newUrlList.length > 0){
        const cssUsed = stylesContent.match(/\.-?[_a-zA-Z]+[_a-zA-Z0-9-]*\s*\{/gm);
            if(cssUsed != null || cssUsed != undefined){
                // console.log('\t check du css');
                let page = await browser.newPage();
                const url = newUrlList.shift();
                console.log('Analyse CSS pour '+url);
                const cssUsedCleaned = cssUsed.map(className => className.replace(/{/,'').replace(' ',''));
                try {
                    await page.goto(url);
                } catch(e){
                    console.log('A');
                    console.log(e);
                }

                try {
                    await page.waitForSelector('body');
                } catch(e){
                    console.log('B');
                    console.log(e);
                }

                try {
                    const tests = await page.evaluate(elementsPassed => {
                        let arrayCssUsedTemp = elementsPassed[1];
                        let arrayCssUnusedTemp = elementsPassed[2];
                        elementsPassed[0].forEach( selector => {
                            const isPresent = [...document.querySelectorAll(selector)];
                            if(isPresent != undefined && isPresent.length > 0){
                                arrayCssUsedTemp.push(selector);
                                const index = arrayCssUnusedTemp.indexOf(selector);
                                if (index > -1) {
                                    arrayCssUnusedTemp.splice(index, 1);
                                }
                            } else {
                                if(!arrayCssUnusedTemp.includes(selector)){
                                    arrayCssUnusedTemp.push(selector);
                                } 
                            }
                        });
                        return [arrayCssUsedTemp, arrayCssUnusedTemp];
                    }, [cssUsedCleaned, arrayCssUsed, arrayCssUnused]);
      
                    arrayCssUsed = [...new Set([...arrayCssUsed,...tests[0]])];
                    arrayCssUnused = [...new Set([...arrayCssUnused,...tests[1]])];
                } catch (e){
                    console.log('C');
                    console.log(e);
                }
                 
                try {
                    await page.close();
                } catch(e){
                    console.log('D');
                    console.log(e);
                }
                
            } 

        return verifyCss(browser, newUrlList, stylesContent, arrayCssUnused, arrayCssUsed)
    } else {
        return [arrayCssUnused, arrayCssUsed];
    }
            
    
}


const scrap = async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--shm-size=3gb'] });
    let stylesUrl = [];
    let stylesContent = '';
    let urlList = [
        "http://local.selexium.com/",
        "http://local.selexium.com/resultats-plus-value-immobiliere/",
        "http://local.selexium.com/plus-value-immobiliere/",
        "http://local.selexium.com/placer-son-argent/placement-boursier/opcvm/",
        "http://local.selexium.com/bourse/devise/usd-gbp/",
        "http://local.selexium.com/bourse/devise/usd-jpy/",
        "http://local.selexium.com/bourse/devise/eur-chf/",
        "http://local.selexium.com/bourse/devise/eur-gbp/",
        "http://local.selexium.com/bourse/ftse-100/",
        "http://local.selexium.com/bourse/nikkei-225/",
        "http://local.selexium.com/bourse/dow-jones/",
        "http://local.selexium.com/bourse/nasdaq-100/",
        "http://local.selexium.com/placer-son-argent/placement-boursier/choisir-action-bourse/",
        "http://local.selexium.com/placer-son-argent/placement-boursier/comment-passer-un-ordre-en-bourse/",
        "http://local.selexium.com/placer-son-argent/placement-boursier/lire-cours-actions-bourse/",
        "http://local.selexium.com/placer-son-argent/placement-boursier/dividende/",
        "http://local.selexium.com/actualites/banques-et-neobanques-comment-attirent-elles-les-jeunes/",
        "http://local.selexium.com/faq/le-delai-de-jouissance-dune-scpi/",
        "http://local.selexium.com/programmes-neufs/normandie/rouen/programme-013-76-2652/",
        "http://local.selexium.com/programmes-neufs/hauts-de-france/amiens/programme-014-62-2651/",
        "http://local.selexium.com/actualites/controles-fiscaux-les-remises-gracieuses-du-fisc-en-baisse/",
        "http://local.selexium.com/actualites/proprietaires-le-site-impots-gouv-fr-devoile-son-nouveau-service-gerer-mes-biens-immobiliers/",
        "http://local.selexium.com/programmes-neufs/grand-est/strasbourg/programme-014-68-2650/",
        "http://local.selexium.com/faq/comment-transmettre-un-bien-loi-pinel-a-ses-enfants/",
        "http://local.selexium.com/actualites/scpi-la-collecte-2021-montre-un-regain-de-confiance-dans-la-pierre-papier/",
        "http://local.selexium.com/faq/cession-de-titres-demembres-qui-doit-payer-la-plus-value/",
        "http://local.selexium.com/transmission-patrimoine/succession-et-famille-recomposee/",
        "http://local.selexium.com/actualites/loi-de-finances-rectificative-2021-de-bonnes-nouvelles-pour-les-contribuables/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/chambery/programme-014-74-2648/",
        "http://local.selexium.com/actualites/personnes-sous-tutelle-comment-est-effectuee-la-gestion-du-patrimoine/",
        "http://local.selexium.com/loi-pinel/revente/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/appartements-pinel/",
        "http://local.selexium.com/actualites/euro-numerique-la-bce-donne-son-feu-vert/",
        "http://local.selexium.com/actualites/dirigeants-dentreprise-comment-investissent-ils-leur-argent-en-2021/",
        "http://local.selexium.com/bourse/cac-40/",
        "http://local.selexium.com/bourse/devise/eur-usd/",
        "http://local.selexium.com/bourse/devise/",
        "http://local.selexium.com/bourse/",
        "http://local.selexium.com/programmes-neufs/pays-de-la-loire/le-mans/programme-043-72-1958/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/bordeaux/programme-002-33-2635/",
        "http://local.selexium.com/programmes-neufs/grand-est/nancy/programme-013-54-2638/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/bordeaux/programme-002-33-2636/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/nice/programme-002-06-2640/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/bordeaux/programme-002-33-2637/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-027-31-2641/",
        "http://local.selexium.com/programmes-neufs/hauts-de-france/roubaix/programme-002-59-2646/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/poissy/programme-002-78-2645/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/bagneux/programme-023-92-2649/",
        "http://local.selexium.com/actualites/ipo-entree-en-bourse/",
        "http://local.selexium.com/actualites/retraite-les-strategies-des-francais-qui-veulent-partir-avant-64-ans/",
        "http://local.selexium.com/faq/quelles-sont-les-caracteristiques-dun-compte-indivis/",
        "http://local.selexium.com/actualites/la-bourse-nest-plus-reservee-aux-plus-ages/",
        "http://local.selexium.com/actualites/impot-mondial-sur-les-societes-la-barre-fixee-a-15/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/roubaix/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/le-havre/",
        "http://local.selexium.com/faq/quest-ce-quun-investissement-a-impact/",
        "http://local.selexium.com/placer-son-argent/placement-boursier/arbitrage-en-bourse/",
        "http://local.selexium.com/assurance-vie/comparateur-assurance-vie/serenipierre/",
        "http://local.selexium.com/faq/comment-racheter-ses-vieux-contrats-epargne-retraite/",
        "http://local.selexium.com/actualites/juillet-2021-les-taux-dinteret-toujours-au-plancher/",
        "http://local.selexium.com/faq/comment-reduire-les-frais-de-notaire/",
        "http://local.selexium.com/faq/quest-ce-que-la-retraite-surcomplementaire-supplementaire/",
        "http://local.selexium.com/actualites/comment-passer-lete-en-bourse/",
        "http://local.selexium.com/programmes-neufs/grand-est/nancy/programme-002-54-2632/",
        "http://local.selexium.com/programmes-neufs/bretagne/rennes/programme-002-35-2631/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/poissy/programme-002-78-2630/",
        "http://local.selexium.com/loi-pinel/promoteurs/sporting-promotion/",
        "http://local.selexium.com/actualites/dirigeants-dentreprise-quelles-aides-covid-19-dans-les-prochains-mois/",
        "http://local.selexium.com/programmes-neufs/grand-est/metz/programme-002-57-1936/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/bordeaux/programme-002-33-2541/",
        "http://local.selexium.com/programmes-neufs/bourgogne-franche-comte/dijon/programme-002-21-2551/",
        "http://local.selexium.com/programmes-neufs/centre-val-de-loire/orleans/programme-002-45-2588/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villepinte/programme-002-93-1565/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/clermont-ferrand/programme-002-63-2560/",
        "http://local.selexium.com/programmes-neufs/pays-de-la-loire/angers/programme-002-49-2536/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/poissy/programme-002-78-2549/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/toulon/programme-002-83-2546/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/bagneux/programme-002-92-2538/",
        "http://local.selexium.com/programmes-neufs/normandie/rouen/programme-002-76-2545/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/lyon/programme-002-69-2544/",
        "http://local.selexium.com/programmes-neufs/normandie/le-havre/programme-002-76-2543/",
        "http://local.selexium.com/programmes-neufs/occitanie/perpignan/programme-002-66-2542/",
        "http://local.selexium.com/programmes-neufs/pays-de-la-loire/cholet/programme-002-49-2557/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/massy/programme-002-92-2556/",
        "http://local.selexium.com/programmes-neufs/bretagne/rennes/programme-002-35-2539/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/marseille/programme-002-13-2555/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/grenoble/programme-002-05-2553/",
        "http://local.selexium.com/programmes-neufs/occitanie/montpellier/programme-002-34-2552/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/lyon/programme-002-69-2550/",
        "http://local.selexium.com/programmes-neufs/normandie/rouen/programme-002-76-2562/",
        "http://local.selexium.com/programmes-neufs/pays-de-la-loire/nantes/programme-002-44-2559/",
        "http://local.selexium.com/programmes-neufs/bretagne/rennes/programme-002-35-2558/",
        "http://local.selexium.com/programmes-neufs/grand-est/reims/programme-002-51-2565/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/chambery/programme-002-74-2564/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/toulon/programme-002-83-2563/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/paris/programme-002-94-2573/",
        "http://local.selexium.com/programmes-neufs/bretagne/rennes/programme-002-35-2572/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/paris/programme-002-92-2571/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/nice/programme-002-06-2570/",
        "http://local.selexium.com/programmes-neufs/bretagne/rennes/programme-002-35-2569/",
        "http://local.selexium.com/programmes-neufs/centre-val-de-loire/tours/programme-002-37-2568/",
        "http://local.selexium.com/programmes-neufs/centre-val-de-loire/tours/programme-002-37-2626/",
        "http://local.selexium.com/programmes-neufs/hauts-de-france/lille/programme-002-59-2627/",
        "http://local.selexium.com/transmission-entreprise/pacte-dutreil/transmission-activite-location-meublee/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/paris/programme-002-93-2566/",
        "http://local.selexium.com/programmes-neufs/grand-est/strasbourg/programme-002-67-2577/",
        "http://local.selexium.com/programmes-neufs/pays-de-la-loire/nantes/programme-002-44-2576/",
        "http://local.selexium.com/programmes-neufs/hauts-de-france/lille/programme-002-59-2575/",
        "http://local.selexium.com/programmes-neufs/grand-est/strasbourg/programme-002-67-2574/",
        "http://local.selexium.com/faq/pel-ou-cel/",
        "http://local.selexium.com/placer-son-argent/epargne/livret-a/livret-grand-format/",
        "http://local.selexium.com/placer-son-argent/epargne/lep/",
        "http://local.selexium.com/placer-son-argent/epargne/livret-jeune/",
        "http://local.selexium.com/placer-son-argent/epargne/ldds/",
        "http://local.selexium.com/placer-son-argent/epargne/pel/",
        "http://local.selexium.com/placer-son-argent/epargne/cel/",
        "http://local.selexium.com/placer-son-argent/epargne/livret-a/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villiers-sur-marne/programme-002-77-2580/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/melun/programme-002-77-2579/",
        "http://local.selexium.com/programmes-neufs/grand-est/strasbourg/programme-002-67-2584/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/bagneux/programme-002-92-2583/",
        "http://local.selexium.com/programmes-neufs/grand-est/metz/programme-002-57-2582/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/chambery/programme-002-74-2589/",
        "http://local.selexium.com/programmes-neufs/centre-val-de-loire/tours/programme-002-37-2587/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/paris/programme-002-92-2586/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/la-rochelle/programme-002-17-2591/",
        "http://local.selexium.com/programmes-neufs/centre-val-de-loire/tours/programme-002-37-2593/",
        "http://local.selexium.com/programmes-neufs/grand-est/strasbourg/programme-002-67-2592/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villiers-sur-marne/programme-002-77-2597/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/paris/programme-002-93-2596/",
        "http://local.selexium.com/programmes-neufs/centre-val-de-loire/orleans/programme-002-45-2595/",
        "http://local.selexium.com/programmes-neufs/bretagne/rennes/programme-002-35-2594/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/pontoise/programme-002-95-2602/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/lyon/programme-002-69-2603/",
        "http://local.selexium.com/programmes-neufs/pays-de-la-loire/nantes/programme-002-85-2609/",
        "http://local.selexium.com/programmes-neufs/occitanie/perpignan/programme-002-66-2608/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villiers-sur-marne/programme-027-94-2606/",
        "http://local.selexium.com/programmes-neufs/normandie/rouen/programme-002-76-2605/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/marseille/programme-002-13-2604/",
        "http://local.selexium.com/programmes-neufs/bretagne/rennes/programme-002-35-2610/",
        "http://local.selexium.com/programmes-neufs/grand-est/reims/programme-002-51-2612/",
        "http://local.selexium.com/programmes-neufs/pays-de-la-loire/angers/programme-002-49-2611/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/toulon/programme-002-83-2615/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/pontoise/programme-027-95-2614/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/massy/programme-013-91-2616/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/clermont-ferrand/programme-013-63-2617/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/melun/programme-013-77-2619/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villepinte/programme-013-93-2620/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/aix-en-provence/programme-013-13-2621/",
        "http://local.selexium.com/programmes-neufs/normandie/le-havre/programme-013-76-2622/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/aix-en-provence/programme-013-13-2624/",
        "http://local.selexium.com/actualites/rapport-tirole-blanchard-quelles-reformes-fiscales-ont-ete-proposees-au-gouvernement/",
        "http://local.selexium.com/assurance-vie/unites-compte/",
        "http://local.selexium.com/faq/quest-ce-que-le-centre-des-formalites-des-entreprises-cfe/",
        "http://local.selexium.com/transmission-entreprise/clause-sequestre/",
        "http://local.selexium.com/dispositif-madelin-ir-pme/",
        "http://local.selexium.com/faq/comment-annuler-ou-revoquer-une-donation/",
        "http://local.selexium.com/remuneration-dirigeants/sarl/sarl-famille/",
        "http://local.selexium.com/actualites/bourse-quand-les-celebrites-manipulent-les-cours-des-actions/",
        "http://local.selexium.com/sci/declaration/",
        "http://local.selexium.com/sci/familiale/",
        "http://local.selexium.com/sci/creation/",
        "http://local.selexium.com/sci/",
        "http://local.selexium.com/per/per-enfants/",
        "http://local.selexium.com/actualites/assurance-vie-un-nouveau-type-de-support-solidaire-fait-son-entree/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-027-31-2532/",
        "http://local.selexium.com/programmes-neufs/normandie/caen/programme-002-14-2598/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/massy/programme-002-91-2599/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villiers-sur-marne/programme-027-93-2601/",
        "http://local.selexium.com/actualites/juin-2021-des-taux-dinteret-qui-battent-des-records/",
        "http://local.selexium.com/protection-sociale-dirigeant/protection-sociale-conjoint-dirigeant/",
        "http://local.selexium.com/faq/quelles-differences-entre-les-statuts-tns-et-assimile-salarie/",
        "http://local.selexium.com/protection-sociale-dirigeant/",
        "http://local.selexium.com/faq/dirigeant-comment-cumuler-son-mandat-et-sa-retraite/",
        "http://local.selexium.com/retraite-dirigeant/calcul-retraite-dirigeant/",
        "http://local.selexium.com/retraite-dirigeant/retraite-independants/",
        "http://local.selexium.com/retraite-dirigeant/retraite-dirigeants-assimiles-salaries/",
        "http://local.selexium.com/retraite-dirigeant/retraite-professions-liberales/",
        "http://local.selexium.com/retraite-dirigeant/retraite-exploitants-agricoles/",
        "http://local.selexium.com/retraite-dirigeant/",
        "http://local.selexium.com/transmission-entreprise/pacte-dutreil/",
        "http://local.selexium.com/transmission-entreprise/donation-entreprise/",
        "http://local.selexium.com/transmission-entreprise/cession-entreprise/augmentation-capital-societe/",
        "http://local.selexium.com/transmission-entreprise/cession-entreprise/cession-actions/",
        "http://local.selexium.com/transmission-entreprise/cession-entreprise/cession-fonds-de-commerce/",
        "http://local.selexium.com/transmission-entreprise/cession-entreprise/",
        "http://local.selexium.com/transmission-entreprise/",
        "http://local.selexium.com/programmes-neufs/occitanie/cornebarrieu/programme-023-31-2534/",
        "http://local.selexium.com/programmes-neufs/normandie/le-havre/programme-014-76-2533/",
        "http://local.selexium.com/programmes-neufs/hauts-de-france/roubaix/programme-014-59-2526/",
        "http://local.selexium.com/actualites/les-clubs-deals-solution-investissement/",
        "http://local.selexium.com/actualites/bourse-lenvironnement-nouveau-levier-de-croissance/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-027-31-2530/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-028-31-2529/",
        "http://local.selexium.com/actualites/les-cours-des-matieres-premieres-ont-atteint-des-records/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/lyon/programme-014-69-2525/",
        "http://local.selexium.com/programmes-neufs/occitanie/castanet-tolosan/programme-027-31-2523/",
        "http://local.selexium.com/actualites/retraite-des-erreurs-de-calcul-en-masse-en-2020/",
        "http://local.selexium.com/faq/retraite-comment-optimiser-vos-droits/",
        "http://local.selexium.com/scpi/guide-meilleures-scpi/scpi-epargne-fonciere/",
        "http://local.selexium.com/scpi/guide-meilleures-scpi/scpi-primofamily/",
        "http://local.selexium.com/scpi/guide-meilleures-scpi/scpi-pfo2/",
        "http://local.selexium.com/scpi/guide-meilleures-scpi/scpi-novapierre-allemagne/",
        "http://local.selexium.com/scpi/guide-meilleures-scpi/scpi-corum-origin/",
        "http://local.selexium.com/programmes-neufs/normandie/le-havre/programme-014-76-2518/",
        "http://local.selexium.com/programmes-neufs/grand-est/strasbourg/programme-014-67-2521/",
        "http://local.selexium.com/programmes-neufs/occitanie/blagnac/programme-014-31-2519/",
        "http://local.selexium.com/faq/declaration-dividendes/",
        "http://local.selexium.com/actualites/les-petites-retraites-vont-elles-etre-revalorisees/",
        "http://local.selexium.com/faq/les-indemnites-de-depart-a-la-retraite-sont-elles-imposables/",
        "http://local.selexium.com/actualites/publicite-e-mails-frauduleux-soyez-vigilants/",
        "http://local.selexium.com/scpi/guide-meilleures-scpi/scpi-patrimmo-commerce/",
        "http://local.selexium.com/actualites/locde-recommande-de-taxer-les-successions/",
        "http://local.selexium.com/faq/entrepreneur-individuel-comment-faire-passer-son-loyer-en-charge/",
        "http://local.selexium.com/actualites/mai-2021-les-taux-dinteret-repartent-a-la-hausse/",
        "http://local.selexium.com/programmes-neufs/centre-val-de-loire/tours/programme-014-37-2517/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/clermont-ferrand/programme-014-63-2516/",
        "http://local.selexium.com/reduire-ses-impots/declaration-impot-revenu/guide/",
        "http://local.selexium.com/reduire-ses-impots/declaration-impot-revenu/foncier/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/toulon/programme-014-83-2510/",
        "http://local.selexium.com/reduire-ses-impots/fiscalite/crds-csg/",
        "http://local.selexium.com/faq/foyer-fiscal/",
        "http://local.selexium.com/faq/abattement-fiscal/",
        "http://local.selexium.com/reduire-ses-impots/flat-tax/flat-tax-assurance-vie/",
        "http://local.selexium.com/reduire-ses-impots/flat-tax/flat-tax-dividendes/",
        "http://local.selexium.com/reduire-ses-impots/flat-tax/flat-tax-pea/",
        "http://local.selexium.com/reduire-ses-impots/flat-tax/flat-tax-pel/",
        "http://local.selexium.com/actualites/immobilier-de-bureaux-quel-avenir/",
        "http://local.selexium.com/actualites/comment-detecter-les-fake-news-financieres/",
        "http://local.selexium.com/actualites/epargne-salariale-faut-il-placer-sa-prime/",
        "http://local.selexium.com/faq/comment-mesurer-risque-financier-strategie-patrimoniale/",
        "http://local.selexium.com/faq/profession-liberale-comment-passer-loyer-charge-deductible/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-027-31-2508/",
        "http://local.selexium.com/actualites/deconstruire-les-idees-recues-autour-des-conseillers-en-gestion-de-patrimoine/",
        "http://local.selexium.com/faq/ifu-formulaire-n2561/",
        "http://local.selexium.com/reduire-ses-impots/flat-tax/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/marseille/programme-014-13-2499/",
        "http://local.selexium.com/sofica/",
        "http://local.selexium.com/scpi/siic/",
        "http://local.selexium.com/plan-epargne-action/pea-pme/",
        "http://local.selexium.com/plan-epargne-action/pea-jeune/",
        "http://local.selexium.com/plan-epargne-action/pea-assurance/",
        "http://local.selexium.com/actualites/crise-sanitaire-et-niches-fiscales-ce-qui-change-cette-annee/",
        "http://local.selexium.com/actualites/declaration-dimpot-2021-6-depenses-deductibles-a-ne-pas-oublier/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/bordeaux/programme-052-33-2503/",
        "http://local.selexium.com/actualites/impots-pourquoi-optimiser-son-patrimoine-avant-lelection-presidentielle-de-2022/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villepinte/programme-027-93-2497/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-023-31-2498/",
        "http://local.selexium.com/actualites/taux-dinteret-toujours-plus-bas-bonne-ou-mauvaise-nouvelle/",
        "http://local.selexium.com/programmes-neufs/occitanie/castanet-tolosan/programme-028-31-2496/",
        "http://local.selexium.com/reduire-ses-impots/declaration-impot-revenu/bnc-bic/",
        "http://local.selexium.com/reduire-ses-impots/declaration-impot-revenu/frais-reels/",
        "http://local.selexium.com/reduire-ses-impots/declaration-impot-revenu/calcul-revenu-imposable/",
        "http://local.selexium.com/reduire-ses-impots/declaration-impot-revenu/parts-fiscales/",
        "http://local.selexium.com/reduire-ses-impots/declaration-impot-revenu/declaration-source/",
        "http://local.selexium.com/reduire-ses-impots/declaration-impot-revenu/pension-retraite/",
        "http://local.selexium.com/reduire-ses-impots/declaration-impot-revenu/abattement/",
        "http://local.selexium.com/reduire-ses-impots/declaration-impot-revenu/tranches-imposition/",
        "http://local.selexium.com/reduire-ses-impots/declaration-impot-revenu/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villiers-sur-marne/programme-027-94-2493/",
        "http://local.selexium.com/programmes-neufs/hauts-de-france/roubaix/programme-022-59-2489/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/paris/programme-052-93-2490/",
        "http://local.selexium.com/programmes-neufs/occitanie/beauzelle/programme-027-31-2492/",
        "http://local.selexium.com/actualites/ifi-et-exoneration-des-biens-professionnels-mode-demploi/",
        "http://local.selexium.com/faq/renoncer-a-une-succession-pour-transmettre/",
        "http://local.selexium.com/actualites/declaration-dimpot-2021-quid-de-limposition-sur-les-plus-values-des-actions/",
        "http://local.selexium.com/faq/comment-proteger-enfant-fragile/",
        "http://local.selexium.com/faq/per-madelin/",
        "http://local.selexium.com/per/individuel/",
        "http://local.selexium.com/per/loi-pacte/",
        "http://local.selexium.com/per/per-ou-assurance-vie/",
        "http://local.selexium.com/actualites/pourquoi-investir-en-loi-pinel-en-2021/",
        "http://local.selexium.com/actualites/placements-financiers-comment-eviter-les-arnaques/",
        "http://local.selexium.com/faq/quelles-sont-les-charges-deductibles-des-revenus-fonciers/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/grenoble/programme-052-38-2467/",
        "http://local.selexium.com/programmes-neufs/hauts-de-france/roubaix/programme-052-59-2468/",
        "http://local.selexium.com/programmes-neufs/hauts-de-france/roubaix/programme-052-59-2469/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villiers-sur-marne/programme-052-77-2471/",
        "http://local.selexium.com/programmes-neufs/hauts-de-france/lille/programme-052-59-2473/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/chambery/programme-052-74-2475/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villiers-sur-marne/programme-052-93-2476/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/massy/programme-052-92-2478/",
        "http://local.selexium.com/programmes-neufs/grand-est/reims/programme-052-51-2482/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/grenoble/programme-052-38-2481/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/massy/programme-052-92-2483/",
        "http://local.selexium.com/actualites/livrets-depargne-bercy-traque-les-doublons/",
        "http://local.selexium.com/faq/imposition-donation-petits-enfants/",
        "http://local.selexium.com/faq/lmnp-ancien/",
        "http://local.selexium.com/programmes-neufs/occitanie/colomiers/programme-028-31-2463/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-014-31-2319/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-027-31-2459/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-023-31-2461/",
        "http://local.selexium.com/faq/impot-taux-personnalise-ou-individualise/",
        "http://local.selexium.com/statut-lmnp-lmp/lmp/",
        "http://local.selexium.com/statut-lmnp-lmp/lmnp-revente/",
        "http://local.selexium.com/faq/lmnp-amortissement/",
        "http://local.selexium.com/actualites/immobilier-etat-des-lieux-un-an-apres-le-debut-de-la-crise-de-covid-19/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/pontoise/programme-002-95-1632/",
        "http://local.selexium.com/programmes-neufs/occitanie/colomiers/programme-027-31-1557/",
        "http://local.selexium.com/programmes-neufs/occitanie/colomiers/programme-027-31-1885/",
        "http://local.selexium.com/programmes-neufs/occitanie/castanet-tolosan/programme-027-31-1920/",
        "http://local.selexium.com/programmes-neufs/bourgogne-franche-comte/dijon/programme-014-21-2160/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/marseille/programme-014-13-2141/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/nice/programme-014-83-2358/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/marseille/programme-014-13-2369/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/lormont/programme-014-33-2405/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-014-31-2403/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/massy/programme-014-91-2401/",
        "http://local.selexium.com/programmes-neufs/occitanie/beauzelle/programme-030-31-2399/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/clermont-ferrand/programme-014-63-2398/",
        "http://local.selexium.com/programmes-neufs/occitanie/beauzelle/programme-028-31-2426/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/nice/programme-014-06-2423/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/lyon/programme-014-69-2421/",
        "http://local.selexium.com/programmes-neufs/pays-de-la-loire/angers/programme-014-49-2419/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/toulon/programme-014-83-2418/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/nice/programme-014-06-2417/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/lyon/programme-014-42-2416/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/nice/programme-014-83-2414/",
        "http://local.selexium.com/programmes-neufs/pays-de-la-loire/angers/programme-014-49-2412/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/aix-en-provence/programme-014-84-2410/",
        "http://local.selexium.com/programmes-neufs/occitanie/castanet-tolosan/programme-027-31-2436/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/paris/programme-027-93-2435/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/melun/programme-022-77-2433/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villepinte/programme-027-93-2431/",
        "http://local.selexium.com/programmes-neufs/occitanie/saint-orens/programme-027-31-2430/",
        "http://local.selexium.com/programmes-neufs/occitanie/colomiers/programme-028-31-2429/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villiers-sur-marne/programme-028-94-2428/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-028-31-2427/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/chambery/programme-027-74-2438/",
        "http://local.selexium.com/programmes-neufs/occitanie/colomiers/programme-027-31-2437/",
        "http://local.selexium.com/programmes-neufs/occitanie/blagnac/programme-027-31-2450/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villiers-sur-marne/programme-027-94-2448/",
        "http://local.selexium.com/programmes-neufs/occitanie/colomiers/programme-027-31-2447/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-027-31-2443/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-027-31-2442/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-027-31-2440/",
        "http://local.selexium.com/faq/sas-ou-sarl/",
        "http://local.selexium.com/faq/quelles-differences-entre-dividendes-et-salaire/",
        "http://local.selexium.com/faq/comment-choisir-entre-ir-et-is/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villiers-sur-marne/programme-027-77-2439/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villiers-sur-marne/programme-002-94-2276/",
        "http://local.selexium.com/programmes-neufs/normandie/rouen/programme-002-76-2452/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/lyon/programme-002-69-2451/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villiers-sur-marne/programme-002-93-2456/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/poissy/programme-002-92-2455/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/poissy/programme-002-78-2453/",
        "http://local.selexium.com/faq/separation-et-bien-pinel-quelles-sont-les-regles/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/vannes/",
        "http://local.selexium.com/actualites/affaire-de-redressement-a-lisf-la-cour-de-cassation-donne-raison-au-fisc/",
        "http://local.selexium.com/actualites/assurance-vie-la-nouveaute-du-recyclage-des-bureaux-en-logements/",
        "http://local.selexium.com/remuneration-dirigeants/association/",
        "http://local.selexium.com/remuneration-dirigeants/sasu/",
        "http://local.selexium.com/remuneration-dirigeants/sas/",
        "http://local.selexium.com/remuneration-dirigeants/sarl/",
        "http://local.selexium.com/remuneration-dirigeants/eurl/",
        "http://local.selexium.com/remuneration-dirigeants/",
        "http://local.selexium.com/dirigeants/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villepinte/programme-023-93-2396/",
        "http://local.selexium.com/actualites/dons-aux-associations-linsuffisance-des-controles-fiscaux-pointee-du-doigt/",
        "http://local.selexium.com/actualites/pourquoi-les-traders-sinteressent-a-leau/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-007-31-2394/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/bagneux/programme-022-92-2392/",
        "http://local.selexium.com/actualites/covid-19-plus-de-la-moitie-des-francais-anticipent-une-hausse-des-impots/",
        "http://local.selexium.com/avis-clients-selexium/",
        "http://local.selexium.com/actualites/laffaire-gamestop-ou-le-pouvoir-des-petits-investisseurs/",
        "http://local.selexium.com/faq/que-sont-les-droits-de-garde-bancaires/",
        "http://local.selexium.com/faq/comment-recuperer-capital-assurance-vie-succession/",
        "http://local.selexium.com/faq/option-de-gestion/",
        "http://local.selexium.com/programmes-neufs/occitanie/cornebarrieu/programme-027-31-2388/",
        "http://local.selexium.com/programmes-neufs/bourgogne-franche-comte/dijon/programme-014-21-2386/",
        "http://local.selexium.com/actualites/dirigeants-et-prelevement-a-la-source-ce-quil-faut-savoir/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/melun/programme-022-77-2382/",
        "http://local.selexium.com/actualites/assurance-vie-quels-placements-choisir-en-2021/",
        "http://local.selexium.com/loi-pinel/promoteurs/ogic/",
        "http://local.selexium.com/loi-pinel/promoteurs/credit-agricole-immobilier/",
        "http://local.selexium.com/loi-pinel/promoteurs/emerige/",
        "http://local.selexium.com/loi-pinel/promoteurs/marignan/",
        "http://local.selexium.com/loi-pinel/promoteurs/alila/",
        "http://local.selexium.com/loi-pinel/promoteurs/les-nouveaux-constructeurs/",
        "http://local.selexium.com/loi-pinel/promoteurs/procivis/",
        "http://local.selexium.com/loi-pinel/promoteurs/linkcity/",
        "http://local.selexium.com/loi-pinel/promoteurs/promogim/",
        "http://local.selexium.com/loi-pinel/promoteurs/bnp-paribas-real-estate/",
        "http://local.selexium.com/loi-pinel/promoteurs/icade/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/lyon/programme-014-69-2342/",
        "http://local.selexium.com/actualites/credits-et-reductions-dimpot-ce-quil-faut-savoir-sur-lavance-du-15-janvier/",
        "http://local.selexium.com/faq/faut-il-faire-des-versements-programmes/",
        "http://local.selexium.com/assurance-vie/comparateur-assurance-vie/digital-vie/",
        "http://local.selexium.com/assurance-vie/comparateur-assurance-vie/netlife-2/",
        "http://local.selexium.com/assurance-vie/comparateur-assurance-vie/linxea-vie/",
        "http://local.selexium.com/assurance-vie/comparateur-assurance-vie/target-plus/",
        "http://local.selexium.com/assurance-vie/comparateur-assurance-vie/strategic-premium/",
        "http://local.selexium.com/assurance-vie/comparateur-assurance-vie/",
        "http://local.selexium.com/actualites/credit-immobilier-feu-vert-pour-les-emprunteurs/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/poissy/programme-014-78-2378/",
        "http://local.selexium.com/actualites/investir-en-scpi-en-temps-de-crise-bonne-ou-mauvaise-idee/",
        "http://local.selexium.com/faq/chomage-comment-cloturer-son-contrat-assurance-vie-sans-payer-dimpot/",
        "http://local.selexium.com/faq/garantir-equite-entre-les-heritiers-donation/",
        "http://local.selexium.com/programmes-neufs/occitanie/colomiers/programme-007-31-2376/",
        "http://local.selexium.com/credit-immobilier/banque-courtois/",
        "http://local.selexium.com/credit-immobilier/credit-du-nord/",
        "http://local.selexium.com/credit-immobilier/bpe/",
        "http://local.selexium.com/credit-immobilier/lcl/",
        "http://local.selexium.com/credit-immobilier/societe-generale/",
        "http://local.selexium.com/credit-immobilier/caisse-depargne/",
        "http://local.selexium.com/credit-immobilier/axa/",
        "http://local.selexium.com/credit-immobilier/banque-populaire-bpce/",
        "http://local.selexium.com/credit-immobilier/credit-mutuel/",
        "http://local.selexium.com/actualites/loi-de-finances-pour-2021-ce-qui-change/",
        "http://local.selexium.com/en/",
        "http://local.selexium.com/actualites/impots-les-donnees-transmises-a-ladministration-fiscale-explosent/",
        "http://local.selexium.com/actualites/la-france-championne-de-la-taxation-immobiliere/",
        "http://local.selexium.com/programmes-neufs/occitanie/blagnac/programme-014-31-2373/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/nice/programme-014-06-2370/",
        "http://local.selexium.com/faq/investissement-en-entreprise/",
        "http://local.selexium.com/faq/quest-ce-que-le-label-relance/",
        "http://local.selexium.com/faq/est-on-proprietaire-de-limage-de-son-bien/",
        "http://local.selexium.com/actualites/impots-imputez-vos-moins-values-boursieres-avant-la-fin-de-lannee/",
        "http://local.selexium.com/actualites/credit-immobilier-lannee-se-termine-en-beaute/",
        "http://local.selexium.com/faq/pret-immobilier-pour-vente-aux-encheres/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/clermont-ferrand/",
        "http://local.selexium.com/marche-immobilier-clermont-ferrand/",
        "http://local.selexium.com/actualites/comment-profiter-des-fetes-de-fin-dannee-pour-optimiser-son-patrimoine/",
        "http://local.selexium.com/devenir-proprietaire/ou-habiter-en-tant-que-proprietaire/paris-brouillon/",
        "http://local.selexium.com/agences/gestion-patrimoine-clermont-ferrand/",
        "http://local.selexium.com/loi-pinel/promoteurs/sogeprom/",
        "http://local.selexium.com/actualites/economie-mondiale-une-embellie-pour-2021/",
        "http://local.selexium.com/programmes-neufs/occitanie/colomiers/programme-007-2366/",
        "http://local.selexium.com/faq/obtenir-remise-gracieuse-de-administration-fiscale/",
        "http://local.selexium.com/faq/declaration-per-aux-impots/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-007-2364/",
        "http://local.selexium.com/loi-pinel/promoteurs/eiffage-immobilier/",
        "http://local.selexium.com/les-podcasts-selexium/",
        "http://local.selexium.com/actualites/vers-des-per-plus-verts/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-007-2362/",
        "http://local.selexium.com/faq/pacte-sur-succession-future/",
        "http://local.selexium.com/faq/quel-type-per-choisir/",
        "http://local.selexium.com/faq/ouvrir-per-quand-on-est-independant/",
        "http://local.selexium.com/actualites/assurance-vie-pole-emploi-aura-bientot-acces-a-la-base-de-donnees-des-detenteurs-de-contrats/",
        "http://local.selexium.com/faq/a-quel-age-ouvrir-un-per/",
        "http://local.selexium.com/faq/per-deblocage/",
        "http://local.selexium.com/actualites/pinel-le-point-sur-la-reforme-a-venir/",
        "http://local.selexium.com/actualites/reconfinement-et-credit-immobilier-quelles-consequences/",
        "http://local.selexium.com/faq/comment-optimiser-son-per/",
        "http://local.selexium.com/actualites/immobilier-quelles-perspectives-pour-la-fin-de-lannee/",
        "http://local.selexium.com/loi-pinel/",
        "http://local.selexium.com/faq/transferer-perco-sans-perdre-benefice-taux-historiques/",
        "http://local.selexium.com/actualites/reconfinement-lepargne-des-francais-est-un-surcout-pour-leconomie/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/caen/",
        "http://local.selexium.com/marche-immobilier-caen/",
        "http://local.selexium.com/agences/gestion-patrimoine-caen/",
        "http://local.selexium.com/loi-pinel/promoteurs/greencity-immobilier/",
        "http://local.selexium.com/loi-pinel/promoteurs/lp-promotion/",
        "http://local.selexium.com/loi-pinel/promoteurs/belin-promotion/",
        "http://local.selexium.com/loi-pinel/promoteurs/cogedim/",
        "http://local.selexium.com/loi-pinel/promoteurs/vinci-immobilier/",
        "http://local.selexium.com/loi-pinel/promoteurs/pichet/",
        "http://local.selexium.com/loi-pinel/promoteurs/kaufman-and-broad/",
        "http://local.selexium.com/loi-pinel/promoteurs/nexity/",
        "http://local.selexium.com/loi-pinel/promoteurs/bouygues-immobilier/",
        "http://local.selexium.com/loi-pinel/promoteurs/",
        "http://local.selexium.com/loi-pinel/outre-mer/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/bordeaux/programme-007-33-2360/",
        "http://local.selexium.com/actualites/fiscalite-locale-ces-taxes-qui-pesent-sur-les-proprietaires/",
        "http://local.selexium.com/faq/quest-ce-quun-mandat-de-protection-future/",
        "http://local.selexium.com/actualites/labattement-exceptionnel-sur-les-plus-values-immobilieres-etendu/",
        "http://local.selexium.com/devenir-proprietaire/maprimerenov/",
        "http://local.selexium.com/actualites/nouvel-avantage-fiscal-pour-le-per/",
        "http://local.selexium.com/actualites/covid-19-les-francais-veulent-proteger-leur-patrimoine-et-leurs-proches/",
        "http://local.selexium.com/loi-pinel/investissement-locatif/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/lormont/programme-007-2356/",
        "http://local.selexium.com/actualites/projet-de-loi-de-finances-pour-2021-ce-quil-faut-retenir/",
        "http://local.selexium.com/faq/donation-dernier-vivant/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-023-31-1621/",
        "http://local.selexium.com/ptz/prets-aides-en-fonction-des-territoires/",
        "http://local.selexium.com/ptz/pas-pret-accession-sociale/",
        "http://local.selexium.com/ptz/pret-action-logement/",
        "http://local.selexium.com/faq/peut-on-contester-hausse-frais-de-gestion-assurance-vie/",
        "http://local.selexium.com/actualites/dirigeant-dentreprise-les-bons-arbitrages-pour-votre-epargne-retraite/",
        "http://local.selexium.com/devenir-proprietaire/ou-habiter-en-tant-que-proprietaire/strasbourg/",
        "http://local.selexium.com/marche-immobilier-dijon/",
        "http://local.selexium.com/marche-immobilier-nice/",
        "http://local.selexium.com/actualites/hausse-des-taux-dusure-bonne-ou-mauvaise-nouvelle-pour-les-emprunteurs/",
        "http://local.selexium.com/actualites/fiscalite-le-point-sur-les-petites-taxes/",
        "http://local.selexium.com/devenir-proprietaire/ou-habiter-en-tant-que-proprietaire/metz/",
        "http://local.selexium.com/devenir-proprietaire/ou-habiter-en-tant-que-proprietaire/rennes/",
        "http://local.selexium.com/devenir-proprietaire/ou-habiter-en-tant-que-proprietaire/toulouse/",
        "http://local.selexium.com/devenir-proprietaire/ou-habiter-en-tant-que-proprietaire/bordeaux/",
        "http://local.selexium.com/devenir-proprietaire/ou-habiter-en-tant-que-proprietaire/lyon/",
        "http://local.selexium.com/devenir-proprietaire/ou-habiter-en-tant-que-proprietaire/lille/",
        "http://local.selexium.com/devenir-proprietaire/ou-habiter-en-tant-que-proprietaire/marseille/",
        "http://local.selexium.com/devenir-proprietaire/ou-habiter-en-tant-que-proprietaire/paris/",
        "http://local.selexium.com/devenir-proprietaire/ou-habiter-en-tant-que-proprietaire/",
        "http://local.selexium.com/devenir-proprietaire/accession-libre/",
        "http://local.selexium.com/devenir-proprietaire/zone-anru/",
        "http://local.selexium.com/devenir-proprietaire/psla/",
        "http://local.selexium.com/devenir-proprietaire/",
        "http://local.selexium.com/actualites/le-diagnostic-energetique-impacte-t-il-le-prix-dun-bien-immobilier/",
        "http://local.selexium.com/faq/resilier-bail-de-location-pinel-fin-periode-engagement/",
        "http://local.selexium.com/programmes-neufs/hauts-de-france/roubaix/programme-014-59-2352/",
        "http://local.selexium.com/per/guide-meilleurs-per/primoper/",
        "http://local.selexium.com/per/guide-meilleurs-per/swisslife-per-individuel/",
        "http://local.selexium.com/per/guide-meilleurs-per/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/bordeaux/programme-007-33-2351/",
        "http://local.selexium.com/loi-pinel/loi-wargon/",
        "http://local.selexium.com/actualites/dirigeants-dentreprise-comment-se-proteger-face-aux-risques-de-deces-et-dincapacite/",
        "http://local.selexium.com/actualites/taxe-sur-les-transactions-financieres-la-poule-aux-oeufs-dor-de-bercy/",
        "http://local.selexium.com/actualites/covid-19-selexium-reste-mobilise/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-002-31-1197/",
        "http://local.selexium.com/actualites/succession-comment-proteger-son-partenaire-de-pacs/",
        "http://local.selexium.com/actualites/immobilier-comment-envisager-le-marche-de-demain/",
        "http://local.selexium.com/actualites/reforme-des-apl-ce-qui-change-a-partir-du-1er-janvier/",
        "http://local.selexium.com/actualites/plan-de-relance-les-mesures-en-faveur-du-logement/",
        "http://local.selexium.com/actualites/comment-les-scpi-traversent-la-crise-sans-encombre/",
        "http://local.selexium.com/actualites/label-isr-et-immobilier-vers-un-marche-plus-vert/",
        "http://local.selexium.com/faq/indicateurs-choisir-supports-scpi/",
        "http://local.selexium.com/faq/exonere-impot-plus-value-immobiliere/",
        "http://local.selexium.com/actualites/entrepreneurs-3-conseils-pour-proteger-votre-patrimoine-personnel/",
        "http://local.selexium.com/scpi/guide-meilleures-scpi/scpi-primopierre/",
        "http://local.selexium.com/scpi/guide-meilleures-scpi/scpi-primovie/",
        "http://local.selexium.com/scpi/guide-meilleures-scpi/scpi-pierre-capitale/",
        "http://local.selexium.com/scpi/guide-meilleures-scpi/",
        "http://local.selexium.com/actualites/impot-2020-corrigez-votre-declaration-de-revenus/",
        "http://local.selexium.com/actualites/investissement-dans-les-pme-hausse-du-taux-de-reduction-dimpot/",
        "http://local.selexium.com/actualites/credit-immobilier-le-retour-des-taux-bas/",
        "http://local.selexium.com/abonnement-commentaires/",
        "http://local.selexium.com/actualites/la-france-championne-deurope-de-la-pression-fiscale/",
        "http://local.selexium.com/actualites/le-livret-a-au-service-du-climat/",
        "http://local.selexium.com/actualites/finance-les-francais-en-manque-de-reperes/",
        "http://local.selexium.com/actualites/transition-ecologique-ou-en-sont-les-banques-francaises/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/nice/programme-014-06-2187/",
        "http://local.selexium.com/actualites/transfert-de-contrat-dassurance-vie-ce-quil-faut-savoir/",
        "http://local.selexium.com/actualites/investir-dans-un-groupement-foncier-viticole-pour-relancer-leconomie/",
        "http://local.selexium.com/actualites/immobilier-la-renovation-energetique-au-coeur-du-programme-gouvernemental/",
        "http://local.selexium.com/actualites/cadeau-fiscal-pour-les-dons-dargent-au-profit-des-pme/",
        "http://local.selexium.com/actualites/taxe-dhabitation-vers-un-report-de-sa-suppression/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/aix-en-provence/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/nancy/",
        "http://local.selexium.com/actualites/nouveau-gouvernement-emmanuelle-wargon-nommee-ministre-deleguee-au-logement/",
        "http://local.selexium.com/actualites/crise-post-covid-comment-evolue-lepargne-des-francais/",
        "http://local.selexium.com/actualites/crowdfunding-immobilier-que-devient-linvestissement-en-cas-de-deces/",
        "http://local.selexium.com/faq/succession-comment-contester-un-contrat-dassurance-vie/",
        "http://local.selexium.com/actualites/loyers-impayes-linquietude-des-proprietaires-a-lheure-de-la-crise-post-covid-19/",
        "http://local.selexium.com/actualites/immobilier-et-ecologie-quelles-evolutions-possibles/",
        "http://local.selexium.com/faq/contestation-evaluation-immobiliere-que-faire/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/bordeaux/programme-014-33-2121/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/bordeaux/programme-014-33-2122/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/bordeaux/programme-014-33-2125/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/lormont/programme-023-33-1992/",
        "http://local.selexium.com/programmes-neufs/occitanie/montpellier/programme-014-34-2173/",
        "http://local.selexium.com/programmes-neufs/occitanie/saint-orens/programme-014-31-2183/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/chambery/programme-014-74-2184/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/melun/programme-014-77-2198/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/bordeaux/programme-014-33-2199/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/aix-en-provence/programme-014-13-2207/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-014-31-2216/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/lormont/programme-014-33-2217/",
        "http://local.selexium.com/programmes-neufs/centre-val-de-loire/tours/programme-002-37-2306/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/poissy/programme-002-78-2312/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/aix-en-provence/programme-014-13-2313/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-023-31-2314/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-002-31-2330/",
        "http://local.selexium.com/programmes-neufs/occitanie/colomiers/programme-030-31-2087/",
        "http://local.selexium.com/programmes-neufs/occitanie/saint-orens/programme-030-31-2085/",
        "http://local.selexium.com/programmes-neufs/occitanie/blagnac/programme-030-31-2082/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villepinte/programme-046-95-1856/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/paris/programme-046-95-1829/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villepinte/programme-046-93-1878/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villepinte/programme-046-93-1872/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villepinte/programme-046-93-1867/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villepinte/programme-046-93-1830/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/massy/programme-046-92-1882/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/bagneux/programme-046-92-1874/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/paris/programme-046-92-1861/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/massy/programme-046-91-1875/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/massy/programme-046-91-1873/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/massy/programme-046-91-1865/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/massy/programme-046-91-1853/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/massy/programme-046-91-1849/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/melun/programme-046-91-1841/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/toulon/programme-046-83-1843/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/poissy/programme-046-78-1851/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/melun/programme-046-77-1858/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/chambery/programme-046-74-1876/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/chambery/programme-046-73-1866/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/lyon/programme-046-69-1879/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/lyon/programme-046-69-1821/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/lyon/programme-046-69-1816/",
        "http://local.selexium.com/programmes-neufs/occitanie/perpignan/programme-046-66-1880/",
        "http://local.selexium.com/programmes-neufs/occitanie/perpignan/programme-046-66-1862/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/biarritz/programme-046-64-1854/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/bayonne/programme-046-64-1824/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/clermont-ferrand/programme-046-63-1832/",
        "http://local.selexium.com/programmes-neufs/hauts-de-france/lille/programme-046-59-1881/",
        "http://local.selexium.com/programmes-neufs/hauts-de-france/lille/programme-046-59-1809/",
        "http://local.selexium.com/programmes-neufs/grand-est/metz/programme-046-57-1833/",
        "http://local.selexium.com/programmes-neufs/pays-de-la-loire/nantes/programme-046-44-1852/",
        "http://local.selexium.com/programmes-neufs/bretagne/rennes/programme-046-35-1848/",
        "http://local.selexium.com/programmes-neufs/bretagne/rennes/programme-046-35-1839/",
        "http://local.selexium.com/programmes-neufs/bretagne/rennes/programme-046-35-1826/",
        "http://local.selexium.com/programmes-neufs/bretagne/rennes/programme-046-35-1814/",
        "http://local.selexium.com/programmes-neufs/occitanie/montpellier/programme-046-34-1855/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/bordeaux/programme-046-33-1864/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/bordeaux/programme-046-33-1847/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villiers-sur-marne/programme-052-94-2039/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/bagneux/programme-052-92-2047/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/toulon/programme-052-83-2033/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/massy/programme-052-78-2076/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/poissy/programme-052-78-2059/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/poissy/programme-052-78-2045/",
        "http://local.selexium.com/programmes-neufs/outre-mer/la-reunion/programme-046-97-1845/",
        "http://local.selexium.com/programmes-neufs/outre-mer/la-reunion/programme-046-97-1838/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/pontoise/programme-046-95-1860/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/pontoise/programme-046-95-1857/",
        "http://local.selexium.com/programmes-neufs/occitanie/colomiers/programme-028-31-2004/",
        "http://local.selexium.com/programmes-neufs/occitanie/beauzelle/programme-028-31-1935/",
        "http://local.selexium.com/programmes-neufs/occitanie/beauzelle/programme-027-31-1788/",
        "http://local.selexium.com/programmes-neufs/occitanie/castanet-tolosan/programme-027-31-1929/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-023-31-1573/",
        "http://local.selexium.com/programmes-neufs/occitanie/saint-orens/programme-027-31-1628/",
        "http://local.selexium.com/programmes-neufs/occitanie/castanet-tolosan/programme-028-31-1688/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-028-31-1687/",
        "http://local.selexium.com/programmes-neufs/occitanie/colomiers/programme-028-31-1686/",
        "http://local.selexium.com/programmes-neufs/occitanie/blagnac/programme-028-31-1683/",
        "http://local.selexium.com/programmes-neufs/occitanie/beauzelle/programme-028-31-1680/",
        "http://local.selexium.com/programmes-neufs/occitanie/castanet-tolosan/programme-028-31-1690/",
        "http://local.selexium.com/programmes-neufs/occitanie/castanet-tolosan/programme-028-31-1689/",
        "http://local.selexium.com/programmes-neufs/occitanie/colomiers/programme-007-31-2325/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-007-1151/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/grenoble/programme-002-05-2309/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/marseille/programme-002-13-2308/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/marseille/programme-002-13-2307/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/aix-en-provence/programme-002-13-2305/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/marseille/programme-002-13-2008/",
        "http://local.selexium.com/programmes-neufs/bretagne/rennes/programme-043-35-1987/",
        "http://local.selexium.com/programmes-neufs/normandie/caen/programme-046-14-1831/",
        "http://local.selexium.com/programmes-neufs/grand-est/nancy/programme-043-54-1739/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/grenoble/programme-043-38-1719/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/cenon/programme-007-33-2070/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-007-31-2024/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-007-31-1965/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-007-31-1901/",
        "http://local.selexium.com/programmes-neufs/occitanie/cornebarrieu/programme-007-31-1647/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-007-31-1622/",
        "http://local.selexium.com/programmes-neufs/occitanie/beauzelle/programme-007-31-1150/",
        "http://local.selexium.com/programmes-neufs/occitanie/cornebarrieu/programme-007-31-1149/",
        "http://local.selexium.com/programmes-neufs/occitanie/beauzelle/programme-007-31-1146/",
        "http://local.selexium.com/programmes-neufs/occitanie/saint-orens/programme-007-31-1145/",
        "http://local.selexium.com/programmes-neufs/occitanie/colomiers/programme-007-31-1141/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villepinte/programme-002-95-1993/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/pontoise/programme-002-95-1980/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/paris/programme-002-95-1614/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/villepinte/programme-002-93-2019/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/chambery/programme-002-74-1979/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/chambery/programme-002-74-1786/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/chambery/programme-002-74-1785/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/chambery/programme-002-74-1331/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/bagneux/programme-002-92-1807/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/paris/programme-002-92-1381/",
        "http://local.selexium.com/programmes-neufs/hauts-de-france/amiens/programme-002-80-1783/",
        "http://local.selexium.com/programmes-neufs/normandie/rouen/programme-002-76-1756/",
        "http://local.selexium.com/programmes-neufs/normandie/rouen/programme-002-76-1338/",
        "http://local.selexium.com/programmes-neufs/grand-est/strasbourg/programme-002-67-2102/",
        "http://local.selexium.com/programmes-neufs/grand-est/strasbourg/programme-002-67-1604/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/clermont-ferrand/programme-002-63-1895/",
        "http://local.selexium.com/programmes-neufs/grand-est/nancy/programme-002-54-1256/",
        "http://local.selexium.com/programmes-neufs/centre-val-de-loire/orleans/programme-002-45-1991/",
        "http://local.selexium.com/programmes-neufs/pays-de-la-loire/le-mans/programme-002-72-1312/",
        "http://local.selexium.com/programmes-neufs/pays-de-la-loire/nantes/programme-002-44-2097/",
        "http://local.selexium.com/programmes-neufs/pays-de-la-loire/nantes/programme-002-44-1553/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/grenoble/programme-002-38-1990/",
        "http://local.selexium.com/programmes-neufs/centre-val-de-loire/tours/programme-002-37-1620/",
        "http://local.selexium.com/programmes-neufs/centre-val-de-loire/tours/programme-002-37-1222/",
        "http://local.selexium.com/programmes-neufs/bretagne/rennes/programme-002-35-2030/",
        "http://local.selexium.com/programmes-neufs/bretagne/rennes/programme-002-35-2022/",
        "http://local.selexium.com/programmes-neufs/bretagne/rennes/programme-002-35-1605/",
        "http://local.selexium.com/programmes-neufs/occitanie/montpellier/programme-002-34-1998/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/cenon/programme-002-33-1963/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/bordeaux/programme-002-33-1945/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/bordeaux/programme-002-33-1634/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/bordeaux/programme-002-33-1204/",
        "http://local.selexium.com/programmes-neufs/occitanie/beauzelle/programme-002-31-1989/",
        "http://local.selexium.com/programmes-neufs/occitanie/saint-orens/programme-002-31-1893/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-002-31-1764/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-002-31-1761/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/marseille/programme-002-13-2002/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/aix-en-provence/programme-002-13-1999/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/marseille/programme-002-13-1639/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/marseille/programme-002-13-1637/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/nice/programme-002-06-1782/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/nice/programme-002-06-1555/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/nice/programme-002-06-1166/",
        "http://local.selexium.com/programmes-neufs/occitanie/colomiers/programme-002-31-1202/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-002-31-1199/",
        "http://local.selexium.com/programmes-neufs/normandie/caen/programme-002-14-2014/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/pontoise/programme-052-95-2056/",
        "http://local.selexium.com/actualites/pea-les-frais-desormais-plafonnes/",
        "http://local.selexium.com/actualites/epargne-retraite-le-deblocage-exceptionnel-prevu-pour-les-independants-au-programme-du-3eme-projet-de-loi-de-finances-rectificative-pour-2020/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/marseille/programme-014-13-2225/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-022-31-2260/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-022-31-2263/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/pontoise/programme-022-95-2264/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/poissy/programme-022-78-2265/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/melun/programme-022-77-2267/",
        "http://local.selexium.com/programmes-neufs/ile-de-france/melun/programme-022-77-2268/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-007-31-2270/",
        "http://local.selexium.com/programmes-neufs/occitanie/blagnac/programme-007-31-2273/",
        "http://local.selexium.com/programmes-neufs/occitanie/colomiers/programme-028-31-2281/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/marseille/programme-002-13-2284/",
        "http://local.selexium.com/programmes-neufs/auvergne-rhone-alpes/chambery/programme-002-74-2288/",
        "http://local.selexium.com/programmes-neufs/grand-est/troyes/programme-052-10-2298/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-007-31-2301/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/bordeaux/programme-002-33-2302/",
        "http://local.selexium.com/programmes-neufs/occitanie/colomiers/programme-007-2304/",
        "http://local.selexium.com/actualites/divorce-et-partage-de-biens-quelle-taxation/",
        "http://local.selexium.com/programmes-neufs/bourgogne-franche-comte/dijon/programme-046-21-1877/",
        "http://local.selexium.com/programmes-neufs/bourgogne-franche-comte/dijon/programme-046-21-1870/",
        "http://local.selexium.com/programmes-neufs/bourgogne-franche-comte/dijon/programme-046-21-1871/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/nice/programme-046-06-1869/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-046-31-1863/",
        "http://local.selexium.com/programmes-neufs/normandie/caen/programme-046-14-1859/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/la-rochelle/programme-046-17-1850/",
        "http://local.selexium.com/programmes-neufs/occitanie/colomiers/programme-046-31-1846/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/nice/programme-046-06-1844/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/nice/programme-046-06-1842/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/nice/programme-046-06-1834/",
        "http://local.selexium.com/programmes-neufs/bretagne/rennes/programme-046-29-1835/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/nice/programme-046-06-1825/",
        "http://local.selexium.com/programmes-neufs/bretagne/rennes/programme-046-29-1827/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/la-rochelle/programme-046-17-1822/",
        "http://local.selexium.com/programmes-neufs/occitanie/toulouse/programme-046-31-1819/",
        "http://local.selexium.com/programmes-neufs/bourgogne-franche-comte/dijon/programme-046-21-1820/",
        "http://local.selexium.com/programmes-neufs/bretagne/rennes/programme-046-22-1815/",
        "http://local.selexium.com/programmes-neufs/nouvelle-aquitaine/bordeaux/programme-046-33-1812/",
        "http://local.selexium.com/programmes-neufs/provence-alpes-cote-dazur/nice/programme-046-06-1813/",
        "http://local.selexium.com/programmes-neufs/normandie/le-havre/programme-046-14-1810/",
        "http://local.selexium.com/actualites/placements-linattendue-resilience-des-investisseurs-pendant-la-crise-de-covid-19/",
        "http://local.selexium.com/actualites/bourse-lenvironnement-au-coeur-des-nouvelles-strategies-dinvestissement/",
        "http://local.selexium.com/actualites/retablissement-de-lisf-le-grand-debat/",
        "http://local.selexium.com/actualites/les-violences-conjugales-nouveau-cas-de-deblocage-anticipe-du-pee/",
        "http://local.selexium.com/actualites/lactif-forestier-cet-outil-de-defiscalisation-meconnu/",
        "http://local.selexium.com/programmes-neufs/occitanie/blagnac/programme-007-31-1152/",
        "http://local.selexium.com/placer-son-argent/epargne/plan-epargne-entreprise-pee/",
        "http://local.selexium.com/actualites/le-monnaie-au-coeur-des-experimentations-des-banques-centrales/",
        "http://local.selexium.com/programmes-neufs/",
        "http://local.selexium.com/faq/investissement-locatif-avantage-fiscal-deces-proprietaire/",
        "http://local.selexium.com/actualites/frais-bancaires-plafonnes-clients-proteges/",
        "http://local.selexium.com/programmes-neufs/recherche/",
        "http://local.selexium.com/actualites/coproprietes-letat-date-desormais-plafonne/",
        "http://local.selexium.com/agences/gestion-patrimoine-vannes/",
        "http://local.selexium.com/faq/comment-declarer-revenu-scpi/",
        "http://local.selexium.com/actualites/immobilier-comment-le-marche-tient-le-cap/",
        "http://local.selexium.com/actualites/epargne-quelles-garanties-pour-vos-placements-en-cas-de-defaillance-de-la-banque/",
        "http://local.selexium.com/actualites/impots-2020-conseils-pour-bien-declarer-son-epargne-retraite/",
        "http://local.selexium.com/actualites/impot-2020-comment-declarer-les-personnes-a-charge/",
        "http://local.selexium.com/on-parle-de-nous/",
        "http://local.selexium.com/actualites/coronavirus-un-deblocage-anticipe-de-lepargne-retraite-bientot-possible-pour-les-independants/",
        "http://local.selexium.com/actualites/chomage-partiel-quelles-consequences-pour-la-retraite/",
        "http://local.selexium.com/actualites/ifi-2020-comment-evaluer-son-patrimoine-immobilier/",
        "http://local.selexium.com/actualites/divorce-les-points-cles-a-connaitre/",
        "http://local.selexium.com/actualites/les-reseaux-sociaux-nouvel-outil-du-fisc/",
        "http://local.selexium.com/actualites/les-banques-centrales-la-nouvelle-obsession-des-investisseurs/",
        "http://local.selexium.com/actualites/comment-gerer-son-epargne-salariale-durant-lepidemie-de-covid-19/",
        "http://local.selexium.com/actualites/impot-qui-paie-lifi/",
        "http://local.selexium.com/actualites/immobilier-quid-de-lapres-confinement/",
        "http://local.selexium.com/actualites/impot-2020-la-subtile-notion-de-domiciliation-fiscale/",
        "http://local.selexium.com/actualites/ifi-et-ir-2020-les-solutions-pour-diminuer-votre-impot-utilement/",
        "http://local.selexium.com/actualites/placement-comment-se-constituer-une-cave-patrimoniale/",
        "http://local.selexium.com/actualites/coronavirus-3-facons-de-donner-un-coup-de-pouce-financier-a-vos-proches/",
        "http://local.selexium.com/actualites/dirigeants-comment-minimiser-limpot-au-moment-du-depart-a-la-retraite/",
        "http://local.selexium.com/actualites/coronavirus-la-reforme-de-la-taxe-dhabitation-menacee/",
        "http://local.selexium.com/actualites/impot-sur-le-revenu-2020-les-astuces-pour-reduire-son-revenu-imposable/",
        "http://local.selexium.com/actualites/a-lere-du-coronavirus-comment-gerer-la-perte-dun-proche/",
        "http://local.selexium.com/actualites/coronavirus-les-arnaques-financieres-se-multiplient/",
        "http://local.selexium.com/actualites/impot-sur-le-revenu-2020-mode-demploi/",
        "http://local.selexium.com/actualites/tout-savoir-sur-le-testament/",
        "http://local.selexium.com/actualites/coronavirus-comment-moduler-son-budget-pour-palier-la-baisse-de-revenus/",
        "http://local.selexium.com/actualites/succession-la-bonne-nouvelle-pour-les-contrats-de-capitalisation/",
        "http://local.selexium.com/reduire-ses-impots/declaration-impot/",
        "http://local.selexium.com/actualites/covid-19-les-mesures-pour-sauver-leconomie/",
        "http://local.selexium.com/marche-immobilier-biarritz/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/biarritz/",
        "http://local.selexium.com/actualites/immobilier-la-complexe-transformation-des-bureaux-en-logements/",
        "http://local.selexium.com/actualites/reforme-des-retraites-lepidemie-de-coronavirus-pourrait-changer-la-donne/",
        "http://local.selexium.com/actualites/coronavirus-les-aides-promises-par-letat-aux-entreprises/",
        "http://local.selexium.com/actualites/la-france-durcit-son-dispositif-de-lutte-contre-le-blanchiment-dargent/",
        "http://local.selexium.com/marche-immobilier-tours/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/tours/",
        "http://local.selexium.com/agences/gestion-patrimoine-biarritz/",
        "http://local.selexium.com/actualites/coronavirus-que-faire-de-ses-actions-face-au-krach-boursier/",
        "http://local.selexium.com/actualites/epargne-les-francais-nont-pas-le-gout-du-risque/",
        "http://local.selexium.com/actualites/contribution-exceptionnelle-et-impot-sur-le-revenu-2020/",
        "http://local.selexium.com/actualites/viager-4-choses-a-savoir-avant-dinvestir/",
        "http://local.selexium.com/loi-denormandie/villes-eligibles-loi-denormandie/",
        "http://local.selexium.com/actualites/comment-payer-moins-dimpots-sur-ses-actions-boursieres/",
        "http://local.selexium.com/credit-immobilier/taux-credit-immobilier/region-sud-ouest/",
        "http://local.selexium.com/credit-immobilier/taux-credit-immobilier/region-rhone-alpes/",
        "http://local.selexium.com/credit-immobilier/taux-credit-immobilier/region-ouest/",
        "http://local.selexium.com/credit-immobilier/taux-credit-immobilier/paris-ile-de-france/",
        "http://local.selexium.com/credit-immobilier/taux-credit-immobilier/region-nord/",
        "http://local.selexium.com/credit-immobilier/taux-credit-immobilier/region-sud-est/",
        "http://local.selexium.com/credit-immobilier/taux-credit-immobilier/region-est/",
        "http://local.selexium.com/credit-immobilier/taux-credit-immobilier/",
        "http://local.selexium.com/actualites/fiscalite-les-dossiers-explosifs-du-gouvernement/",
        "http://local.selexium.com/agences/gestion-patrimoine-tours/",
        "http://local.selexium.com/actualites/credit-immobilier-zoom-sur-le-succes-des-courtiers/",
        "http://local.selexium.com/actualites/placements-immobiliers-pensez-aux-sci/",
        "http://local.selexium.com/actualites/placements-financiers-mefiance-sur-les-reseaux-sociaux/",
        "http://local.selexium.com/actualites/scpi-un-rendement-en-nette-hausse/",
        "http://local.selexium.com/actualites/les-dirigeants-dentreprises-concernes-par-de-nouvelles-regles-fiscales/",
        "http://local.selexium.com/nous-rejoindre/",
        "http://local.selexium.com/actualites/defiscalisation-pourquoi-acquerir-des-oeuvres-dart/",
        "http://local.selexium.com/actualites/livret-a-ou-ldds-telle-est-la-question/",
        "http://local.selexium.com/actualites/scpi-ou-comment-anticiper-votre-retraite/",
        "http://local.selexium.com/actualites/quand-limmobilier-se-met-au-vert/",
        "http://local.selexium.com/marche-immobilier-marseille/",
        "http://local.selexium.com/marche-immobilier-bordeaux/",
        "http://local.selexium.com/actualites/le-shadow-banking-lautre-facette-de-la-finance/",
        "http://local.selexium.com/actualites/les-questions-a-se-poser-avant-dintegrer-des-etf-dans-sa-strategie-patrimoniale/",
        "http://local.selexium.com/actualites/le-crowdfunding-immobilier-un-placement-en-plein-essor/",
        "http://local.selexium.com/actualites/defiscalisation-immobiliere-ce-qui-change-en-2020/",
        "http://local.selexium.com/actualites/comment-le-coronavirus-impacte-les-marches-financiers/",
        "http://local.selexium.com/actualites/montage-en-sci-ce-qui-est-permis-par-la-loi-nest-pas-toujours-fiscalement-autorise/",
        "http://local.selexium.com/actualites/fonds-autocall-comment-reussir-son-placement/",
        "http://local.selexium.com/actualites/immobilier-ancien-bilan-et-perspectives/",
        "http://local.selexium.com/actualites/2020-sera-t-elle-lannee-de-lor/",
        "http://local.selexium.com/actualites/la-remuneration-du-livret-a-devrait-encore-baisser/",
        "http://local.selexium.com/actualites/finance-les-fonds-souverains-terminent-lannee-en-beaute/",
        "http://local.selexium.com/actualites/placements-financiers-les-bonnes-resolutions-pour-2020/",
        "http://local.selexium.com/actualites/votre-patrimoine-correspond-il-a-votre-classe-dage/",
        "http://local.selexium.com/actualites/emprunter-pour-senrichir-ou-comment-se-constituer-un-patrimoine-a-moindre-cout/",
        "http://local.selexium.com/actualites/brexit-les-banques-britanniques-voient-leur-cours-senvoler/",
        "http://local.selexium.com/actualites/bourse-la-vigilance-sera-de-mise-en-2020/",
        "http://local.selexium.com/actualites/les-francais-preparent-leur-retraite-grace-a-limmobilier/",
        "http://local.selexium.com/actualites/sci-pour-quelle-imposition-opter/",
        "http://local.selexium.com/actualites/3-bonnes-raisons-de-transmettre-son-portefeuille-boursier/",
        "http://local.selexium.com/actualites/transmission-et-si-vous-sautiez-une-generation/",
        "http://local.selexium.com/actualites/le-paradoxe-de-lepargne-et-des-taux-bas/",
        "http://local.selexium.com/actualites/investissement-immobilier-ne-negligez-pas-les-evolutions-demographiques/",
        "http://local.selexium.com/actualites/locde-soutient-la-reforme-des-retraites/",
        "http://local.selexium.com/actualites/jeunes-actifs-les-conseils-pour-bien-placer-votre-argent/",
        "http://local.selexium.com/actualites/reforme-fiscale-mondiale-jackpot-pour-la-france/",
        "http://local.selexium.com/actualites/budget-2020-bruxelles-rappelle-la-france-a-lordre-comment-ca-marche/",
        "http://local.selexium.com/actualites/comment-transmettre-son-patrimoine-immobilier-a-moindre-cout/",
        "http://local.selexium.com/actualites/donner-de-son-vivant-pensez-au-contrat-de-capitalisation/",
        "http://local.selexium.com/actualites/la-croissance-economique-francaise-revue-a-la-baisse/",
        "http://local.selexium.com/loi-cosse/",
        "http://local.selexium.com/credit-immobilier/assurance-pret-immobilier/assurance-pret-immobilier-pieges/",
        "http://local.selexium.com/ptz/ptz-ancien/",
        "http://local.selexium.com/actualites/vendre-en-viager-mode-demploi/",
        "http://local.selexium.com/faq/pret-immobilier-sans-apport/",
        "http://local.selexium.com/placer-son-argent/placement-boursier/",
        "http://local.selexium.com/reduire-ses-impots/fiscalite/",
        "http://local.selexium.com/reduire-ses-impots/credit-impot-corse/",
        "http://local.selexium.com/actualites/patrimoine-arriver-au-sommet-en-partant-de-rien-cest-possible/",
        "http://local.selexium.com/actualites/la-bonne-methode-pour-renforcer-ses-revenus-de-1-000-e-a-la-retraite/",
        "http://local.selexium.com/placer-son-argent/epargne/",
        "http://local.selexium.com/faq/fructifier-son-argent/",
        "http://local.selexium.com/placer-son-argent/",
        "http://local.selexium.com/actualites/lengouement-des-francais-pour-lepargne-solidaire/",
        "http://local.selexium.com/actualites/bercy-veut-sauver-le-systeme-demprunt/",
        "http://local.selexium.com/anciennes-loi-defiscalisation/loi-demessine/",
        "http://local.selexium.com/faq/courtier-assurance-vie/",
        "http://local.selexium.com/actualites/finance-verte-quand-rentable-rime-avec-responsable/",
        "http://local.selexium.com/faq/fip-corse-fip-outre-mer/",
        "http://local.selexium.com/videos/",
        "http://local.selexium.com/actualites/frais-de-succession-quand-les-banques-augmentent-leurs-tarifs/",
        "http://local.selexium.com/faq/pea-compte-titre/",
        "http://local.selexium.com/faq/pourquoi-investir-dans-immobilier/",
        "http://local.selexium.com/faq/prevoyance-sante/",
        "http://local.selexium.com/faq/scpi-assurance-vie/",
        "http://local.selexium.com/faq/faut-il-souscrire-a-une-assurance-vie-apres-70-ans/",
        "http://local.selexium.com/anciennes-loi-defiscalisation/loi-scellier/",
        "http://local.selexium.com/fip-corse/",
        "http://local.selexium.com/actualites/budget-2020-baisse-dimpots-a-lhorizon/",
        "http://local.selexium.com/actualites/brexit-quel-impact-sur-limmobilier-francais/",
        "http://local.selexium.com/actualites/proprietaires-pourquoi-souscrire-une-assurance-construction/",
        "http://local.selexium.com/faq/fip-fcpi/",
        "http://local.selexium.com/assurance-vie/rachat-assurance-vie/",
        "http://local.selexium.com/assurance-vie/beneficiaire-assurance-vie/",
        "http://local.selexium.com/assurance-vie/imposition-assurance-vie/",
        "http://local.selexium.com/assurance-vie/frais-assurance-vie/",
        "http://local.selexium.com/assurance-vie/abattement-assurance-vie/",
        "http://local.selexium.com/assurance-vie/assurance-vie-fond-euro/",
        "http://local.selexium.com/credit-immobilier/assurance-pret-immobilier/assurance-pret-immobilier-obligatoire/",
        "http://local.selexium.com/anciennes-loi-defiscalisation/loi-robien/",
        "http://local.selexium.com/anciennes-loi-defiscalisation/loi-besson/",
        "http://local.selexium.com/anciennes-loi-defiscalisation/loi-borloo/",
        "http://local.selexium.com/author/",
        "http://local.selexium.com/faq/loi-scellier-outre-mer/",
        "http://local.selexium.com/faq/courtier-placement-financier/",
        "http://local.selexium.com/faq/assurance-prevoyance/",
        "http://local.selexium.com/reduire-ses-impots/impot-societes-is/",
        "http://local.selexium.com/credit-immobilier/pret-immobilier-fonctionnaire/",
        "http://local.selexium.com/transmission-patrimoine/donation-partage-simple/",
        "http://local.selexium.com/expert-comptable/",
        "http://local.selexium.com/notaire/",
        "http://local.selexium.com/avocat-fiscaliste/",
        "http://local.selexium.com/actualites/bourse-comprendre-les-fluctuations-des-cours/",
        "http://local.selexium.com/plan-epargne-retraite-populaire/perp-deblocage/",
        "http://local.selexium.com/reduire-ses-impots/impot-ifi/",
        "http://local.selexium.com/actualites/un-quatuor-aux-couleurs-de-selexium-pour-courir-le-marathon-de-toulouse-metropole/",
        "http://local.selexium.com/actualites/assurance-vie-labattement-fiscal-ne-sera-finalement-pas-supprime/",
        "http://local.selexium.com/actualites/reforme-de-lisf-flat-tax-qui-sont-les-gagnants-et-les-perdants/",
        "http://local.selexium.com/faq/declaration-lmnp/",
        "http://local.selexium.com/reduire-ses-impots/niche-fiscale/",
        "http://local.selexium.com/developper-patrimoine/regimes-matrimoniaux/",
        "http://local.selexium.com/assurance-vie/souscrire-assurance-vie/",
        "http://local.selexium.com/assurance-vie/assurance-vie-succession/",
        "http://local.selexium.com/per/per-categoriel/",
        "http://local.selexium.com/per/percol-per-collectif/",
        "http://local.selexium.com/actualites/comment-alleger-la-fiscalite-de-votre-portefeuille-dactions/",
        "http://local.selexium.com/faq/cloture-assurance-vie/",
        "http://local.selexium.com/faq/scpi-fcpi/",
        "http://local.selexium.com/faq/pea-assurance-vie/",
        "http://local.selexium.com/faq/don-manuel/",
        "http://local.selexium.com/faq/deduction-reduction-fiscale/",
        "http://local.selexium.com/faq/donation-enfants/",
        "http://local.selexium.com/faq/plus-values-immobilieres/",
        "http://local.selexium.com/faq/credit-immobilier/",
        "http://local.selexium.com/faq/sci-pinel/",
        "http://local.selexium.com/qui-sommes-nous/nos-engagements/",
        "http://local.selexium.com/faq/frais-de-notaire/",
        "http://local.selexium.com/faq/periode-reflexion-10-jours-changer-avis/",
        "http://local.selexium.com/actualites/la-notion-dabus-de-droit-renforcee-quelles-consequences/",
        "http://local.selexium.com/actualites/le-capital-investissement-la-strategie-de-demain/",
        "http://local.selexium.com/per/",
        "http://local.selexium.com/actualites/assurance-vie-la-fin-dune-ere/",
        "http://local.selexium.com/accreditations/",
        "http://local.selexium.com/actualites/les-seniors-face-a-la-baisse-du-taux-dusure/",
        "http://local.selexium.com/fip-placement/",
        "http://local.selexium.com/fcpi/",
        "http://local.selexium.com/reduire-ses-impots/",
        "http://local.selexium.com/plan-epargne-action/",
        "http://local.selexium.com/scpi/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/paris/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/montpellier/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/reims/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/nantes/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/lyon/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/toulouse/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/bordeaux/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/rennes/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/rouen/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/nice/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/dijon/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/marseille/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/strasbourg/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/lille/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/chambery/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/orleans/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/metz/",
        "http://local.selexium.com/conseiller-gestion-patrimoine/",
        "http://local.selexium.com/loi-pinel/ou-investir-pinel/",
        "http://local.selexium.com/loi-pinel/pinel-ancien/",
        "http://local.selexium.com/loi-pinel/loi-pinel-location/",
        "http://local.selexium.com/courtier-immobilier/",
        "http://local.selexium.com/loi-pinel/loi-duflot/",
        "http://local.selexium.com/ptz/",
        "http://local.selexium.com/credit-immobilier/assurance-pret-immobilier/",
        "http://local.selexium.com/credit-immobilier/renegocier-pret-immobilier/",
        "http://local.selexium.com/loi-pinel/zone-pinel/",
        "http://local.selexium.com/loi-pinel/plafond-loi-pinel/",
        "http://local.selexium.com/loi-pinel/declaration-pinel/",
        "http://local.selexium.com/loi-pinel/loi-pinel-pieges/",
        "http://local.selexium.com/deficit-foncier/",
        "http://local.selexium.com/nue-propriete/",
        "http://local.selexium.com/statut-lmnp-lmp/",
        "http://local.selexium.com/qui-sommes-nous/experts-selexium/",
        "http://local.selexium.com/loi-monument-historique/",
        "http://local.selexium.com/loi-censi-bouvard/",
        "http://local.selexium.com/actualites/limmobilier-a-lere-du-crowdinvesting/",
        "http://local.selexium.com/agences/",
        "http://local.selexium.com/resultats/",
        "http://local.selexium.com/actualites/epargne-retraite-le-nouveau-bon-geste-a-adopter-des-le-mois-doctobre/",
        "http://local.selexium.com/qui-sommes-nous/contact/",
        "http://local.selexium.com/actualites/taux-bas-lassurance-de-pret-peut-parfois-couter-plus-cher-que-les-mensualites/",
        "http://local.selexium.com/credit-immobilier/",
        "http://local.selexium.com/anciennes-loi-defiscalisation/",
        "http://local.selexium.com/loi-malraux/",
        "http://local.selexium.com/loi-denormandie/",
        "http://local.selexium.com/loi-girardin/",
        "http://local.selexium.com/defiscalisation-immobiliere/",
        "http://local.selexium.com/loi-madelin/",
        "http://local.selexium.com/compte-titre/",
        "http://local.selexium.com/plan-epargne-retraite-populaire/",
        "http://local.selexium.com/assurance-vie/",
        "http://local.selexium.com/placement-financier/",
        "http://local.selexium.com/proteger-ses-proches/",
        "http://local.selexium.com/developper-patrimoine/",
        "http://local.selexium.com/preparer-sa-retraite/",
        "http://local.selexium.com/transmission-patrimoine/",
        "http://local.selexium.com/qui-sommes-nous/",
        "http://local.selexium.com/cgu/",
        "http://local.selexium.com/mentions-legales/",
        "http://local.selexium.com/conseil-gestion-de-patrimoine/",
        "http://local.selexium.com/actualites/periode-estivale-des-taux-toujours-tres-bas-le-bon-moment-pour-racheter-votre-credit-immobilier/",
        "http://local.selexium.com/actualites/comment-la-technologie-blockchain-revolutionne-les-transactions-immobilieres/",
        "http://local.selexium.com/actualites/pret-relais-immobilier-mode-demploi/",
        "http://local.selexium.com/actualites/donation-comment-proteger-son-conjoint-pour-la-succession/",
        "http://local.selexium.com/actualites/assurance-pret-immobilier-quand-comment-changer/",
        "http://local.selexium.com/actualites/gestion-de-patrimoine-le-credit-cet-incontournable-levier/",
        "http://local.selexium.com/actualites/succession-pourquoi-realiser-une-donation-immobiliere/",
        "http://local.selexium.com/actualites/assurance-vie-quelles-nouveautes-suite-a-ladoption-de-la-loi-pacte/",
        "http://local.selexium.com/actualites/credit-immobilier-des-taux-record-encore-plus-bas/",
        "http://local.selexium.com/actualites/5-conseils-pour-reussir-son-emprunt-immobilier/",
        "http://local.selexium.com/actualites/faire-appel-a-un-courtier-les-plus-jeunes-en-ont-bien-compris-linteret/",
        "http://local.selexium.com/actualites/une-fiscalite-allegee-pour-les-donations-cest-possible/",
        "http://local.selexium.com/agences/gestion-patrimoine-rouen/",
        "http://local.selexium.com/actualites/patrimoine-que-vous-reserve-la-loi-de-finances-2019/",
        "http://local.selexium.com/actualites/2019-zoom-sur-les-3-meilleurs-placements-immobiliers-pour-defiscaliser/",
        "http://local.selexium.com/agences/gestion-patrimoine-orleans/",
        "http://local.selexium.com/agences/gestion-patrimoine-nice/",
        "http://local.selexium.com/agences/gestion-patrimoine-metz/",
        "http://local.selexium.com/agences/gestion-patrimoine-montpellier/",
        "http://local.selexium.com/agences/gestion-patrimoine-rennes/",
        "http://local.selexium.com/agences/gestion-patrimoine-toulouse/",
        "http://local.selexium.com/agences/gestion-patrimoine-chambery/",
        "http://local.selexium.com/agences/gestion-patrimoine-reims/",
        "http://local.selexium.com/agences/gestion-patrimoine-strasbourg/",
        "http://local.selexium.com/agences/gestion-patrimoine-dijon/",
        "http://local.selexium.com/agences/gestion-patrimoine-lyon/",
        "http://local.selexium.com/agences/gestion-patrimoine-marseille/",
        "http://local.selexium.com/agences/gestion-patrimoine-nantes/",
        "http://local.selexium.com/agences/gestion-patrimoine-lille/",
        "http://local.selexium.com/agences/gestion-patrimoine-bordeaux/",
        "http://local.selexium.com/actualites/transmission-de-patrimoine-assurance-vie-et-avantages-fiscaux/",
        "http://local.selexium.com/actualites/epargne-retraite-assurance-vie-les-reformes-de-bercy-se-precisent/",
        "http://local.selexium.com/agences/gestion-patrimoine-paris/",
        "http://local.selexium.com/actualites/defiscaliser-avec-la-loi-pinel-en-2018/",
        "http://local.selexium.com/actualites/constituer-une-epargne-a-votre-enfant-en-3-points/"
    ];
    // const result = await getAllUrl(browser, urlList, urlListCrawled, arrayCssUsed, arrayCssUnused);
    // console.log(urlList);
    const stylesheets = await getAllStylesheets(browser, urlList, stylesUrl, stylesContent);
    console.log('Récupération des stylesheets terminée.');
    // console.log(urlList);
    console.log('Début du traitement du style...');
    const verifiedCss = await verifyCss(browser, urlList, stylesheets[1]);
    console.log('Fin du traitement du style.');
    browser.close();
    return verifiedCss;
}

scrap()
  .then(value => {
        console.log('Script terminé.');
        // console.log(value[0]);
        // fs.writeFileSync('./pagesCrawled.txt', value[0].join ('\n') , {flag: "w"});
        fs.writeFileSync('./classUsed.txt', value[1].join ('\n') , {flag: "w"});
        fs.writeFileSync('./classPasUsed.txt', value[0].join ('\n') , {flag: "w"});
  })
  .catch(e => console.log(`error: ${e}`))

