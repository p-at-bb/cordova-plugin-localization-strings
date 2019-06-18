function getTargetLang(context) {
    var targetLangArr = [];

    var path = require('path');
    var glob = require('glob');
    var providedTranslationPathPattern;
    var providedTranslationPathRegex;
    var configNodes = context.opts.plugin.pluginInfo._et._root._children;
    var config = fs.readFileSync("config.xml").toString();
    var PATH = getTranslationPath(config, "TRANSLATION_PATH");

    if (PATH == null) {
        PATH = getDefaultPath(context);
        providedTranslationPathPattern = PATH + "*.json";
        providedTranslationPathRegex = new RegExp((PATH + "(.*).json"));
    }
    if (PATH != null) {
        if (/^\s*$/.test(PATH)) {
            providedTranslationPathPattern = getDefaultPath(context);
            providedTranslationPathPattern = PATH + "*.json";
            providedTranslationPathRegex = new RegExp((PATH + "(.*).json"));
        }
        else {
            providedTranslationPathPattern = PATH + "*.json";
            providedTranslationPathRegex = new RegExp((PATH + "(.*).json"));
        }
    }

    return globWrapper(glob)(providedTranslationPathPattern)
        .then(
            langFiles => {
                langFiles.forEach(function (langFile) {
                    var matches = langFile.match(providedTranslationPathRegex);
                    if (matches) {
                        targetLangArr.push({
                            lang: matches[1],
                            path: path.join(context.opts.projectRoot, langFile)
                        });
                    }
                });
            }
        ).then(
            _ => targetLangArr
        )
}

function globWrapper(glob) {
    return function (pattern, ) {
        return new Promise((resolve, reject) => {
            glob(pattern, (err, langFiles) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(langFiles);
                }
            })
        })
    }
}

module.exports = {
    getTargetLang: getTargetLang
}