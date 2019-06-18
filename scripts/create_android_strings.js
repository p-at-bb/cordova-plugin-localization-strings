var fs = require('fs-extra');
var _ = require('lodash');
xml2js = require('xml2js');

const utils = require('./utils');
const getTargetLang = utils.getTargetLang;

function fileExists(path) {
    try {
        return fs.statSync(path).isFile();
    } catch (e) {
        return false;
    }
}

module.exports = function (context) {

    return getTargetLang(context).then(function (languages) {
        var promisesToRun = [];

        languages.forEach(function (lang) {
            //read the json file
            var langJson = require(lang.path);

            // check the locales to write to
            var localeLangs = [];
            if (_.has(langJson, "locale") && _.has(langJson.locale, "android")) {
                //iterate the locales to to be iterated.
                _.forEach(langJson.locale.android, function (aLocale) {
                    localeLangs.push(aLocale);
                });
            } else {
                // use the default lang from the filename, for example "en" in en.json
                localeLangs.push(lang.lang);
            }

            _.forEach(localeLangs, function (localeLang) {
                var stringXmlFilePath = getLocalStringXmlPath(context, localeLang);
                var parser = new xml2js.Parser();

                var stringXmlJson;
                if (!fileExists(stringXmlFilePath)) {
                    stringXmlJson = {
                        "resources": {
                            "string": []
                        }
                    };
                    promisesToRun.push(processResult(context, localeLang, langJson, stringXmlJson));
                } else {
                    //lets read from strings.xml into json
                    fs.readFile(stringXmlFilePath, { encoding: 'utf8' }, function (err, data) {
                        if (err) {
                            throw err;
                        }

                        parser.parseString(data, function (err, result) {
                            if (err) {
                                throw err;
                            }

                            stringXmlJson = result;

                            // initialize xmlJson to have strings
                            if (!_.has(stringXmlJson, "resources") || !_.has(stringXmlJson.resources, "string")) {
                                stringXmlJson.resources = {
                                    "string": []
                                };
                            }

                            promisesToRun.push(processResult(context, localeLang, langJson, stringXmlJson));
                        });
                    });
                }
            });
        });

        return Promise.all(promisesToRun);
    });
};

function getLocalizationDir(context, lang) {
    var path = require('path');

    var langDir;
    switch (lang) {
        case "en":
            langDir = path.normalize(path.join(getResPath(context), 'values'));
            break;
        default:
            langDir = path.normalize(path.join(getResPath(context), 'values-' + lang));
            break;
    }
    return langDir;
}

function getLocalStringXmlPath(context, lang) {
    var path = require('path');

    var filePath;
    switch (lang) {
        case "en":
            filePath = path.normalize(path.join(getResPath(context), 'values/strings.xml'));
            break;
        default:
            filePath = path.normalize(path.join(getResPath(context), 'values-' + lang + '/', 'strings.xml'));
            break;
    }
    return filePath;
}

function getResPath(context) {
    var path = require('path');
    var locations = context.requireCordovaModule('cordova-lib/src/platforms/platforms').getPlatformApi('android').locations;

    if (locations && locations.res) {
        return locations.res;
    }

    return path.join(context.opts.projectRoot, 'platforms/android/res');
}

// process the modified xml and put write to file
function processResult(context, lang, langJson, stringXmlJson) {
    var path = require('path');

    return new Promise((resolve, reject) => {
        var mapObj = {};
        // create a map to the actual string
        _.forEach(stringXmlJson.resources.string, function (val) {
            if (_.has(val, "$") && _.has(val["$"], "name")) {
                mapObj[val["$"].name] = val;
            }
        });

        var langJsonToProcess = _.assignIn(langJson.config_android, langJson.app, langJson.app_android);

        //now iterate through langJsonToProcess
        _.forEach(langJsonToProcess, function (val, key) {
            // positional string format is in Mac OS X format.  change to android format
            val = val.replace(/\$@/gi, "$s");
            val = val.replace(/\'/gi, "\\'");

            if (_.has(mapObj, key)) {
                // mapObj contains key. replace key
                mapObj[key]["_"] = val;
            } else {
                // add by inserting
                stringXmlJson.resources.string.push({
                    _: val,
                    '$': { name: key }
                });
            }
        });

        //save to disk
        var langDir = getLocalizationDir(context, lang);
        var filePath = getLocalStringXmlPath(context, lang);

        fs.ensureDir(langDir, function (err) {
            if (err) {
                reject(err);
            }

            fs.writeFile(filePath, buildXML(stringXmlJson), { encoding: 'utf8' }, function (err) {
                if (err) reject(err);
                console.log('Saved:' + filePath);
                resolve();
            });
        });

        function buildXML(obj) {
            var builder = new xml2js.Builder();
            builder.options.renderOpts.indent = '\t';

            var x = builder.buildObject(obj);
            return x.toString();
        }
    });
}
