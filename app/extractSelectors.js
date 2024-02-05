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
  
  
  // Exemple d'utilisation
  const cssContent = `.llp-bg-gray-light{background-color:#f4f4f4}.llp--hello-author{margin:140px 0 50px 0;padding:50px 20px}.llp--hello-author__photo{margin:-140px auto 30px auto;width:180px;height:180px;box-shadow:0 0 7px 0 rgba(0,0,0,.36)}.llp--hello-author__title{font-size:1.3em!important}.llp--hello-author__name{font-weight:700}@media (min-width:768px){.llp--hello-author{margin:50px 0 50px 105px;padding-left:155px;padding-top:60px}.llp--hello-author__photo{margin:-15px 0 0 -260px;width:210px;height:210px;float:left}.llp--hello-author__title{font-size:1.5em!important;line-height:1.2;margin-bottom:36px}.llp--hello-author.flip-y{margin:50px 105px 50px 0;padding-left:155px;padding-top:60px;padding:60px 155px 50px 50px}.llp--hello-author.flip-y .llp--hello-author__photo{margin:-15px -260px 0 0;float:right}}@media (min-width:992px){.llp--hello-author{margin-left:25%}.llp--hello-author.flip-y{margin-left:0;margin-right:25%}}.llp-simulateur{padding-top:30px;background-position:center;background-size:cover}.llp-simulateur .container{position:relative}@media (min-width:1396px){.llp-simulateur .container{max-width:1260px}}`;
  
  const selectors = extractCssSelectors(cssContent);
  console.log(selectors);