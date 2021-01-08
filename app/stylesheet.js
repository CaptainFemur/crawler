const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('response',async response => {
    if(response.request().resourceType() === 'stylesheet') {
        const url = await response.url();
        const styleContent = await response.text();
        const nameCss = url.match(/[^/\\&\?]+\.\w{3,4}(?=([\?&].*$|$))/);
        if(nameCss != null || nameCss != undefined){
            fs.writeFileSync('./css/'+nameCss[0], styleContent);
        }

        fs.readdir('css/', function(err, filenames) {
            if (err) {
              onError(err);
              return;
            }
            filenames.forEach(function(filename) {
              fs.readFile('css/' + filename, 'utf-8', function(err, content) {
                // fs.unlink('./usedCss/'+filename+'.txt', (err) => {
                //     console.log('./usedCss/'+filename+'.txt was deleted');
                //   });
                if (err) {
                  onError(err);
                  return;
                }
                const cssUsed = content.match(/\.-?[_a-zA-Z]+[_a-zA-Z0-9-]*\s*\{/gm);
                if(cssUsed != null || cssUsed != undefined){
                    cssUsed.forEach(async function(cssClassName){
                        const classNamePurified = cssClassName.replace(/{/,'');
                        let classExist = '';
                        try {
                          await page.waitForSelector(classNamePurified)
                          classExist = 'trouvé dans le DOM';
                        } catch (error) {
                          classExist = 'classe non utilisée';
                        }

                        fs.writeFileSync('./usedCss/'+filename+'.txt', classNamePurified + ' => ' + classExist + '\n' , {flag: "a"});
                    });
                    // console.log(cssUsed);
                    // fs.writeFileSync('./usedCss/'+filename+'.txt', cssUsed.replace(/{,/,'/n'));
                }
              });
            });
          });
        
    }
  });
  await page.goto('https://www.selexium.com/');
  await browser.close();
})();