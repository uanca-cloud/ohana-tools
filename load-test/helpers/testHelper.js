const {SharedArray} = require('k6/data'),
    {debug = false} = __ENV;

function importJsonFile(relativePath) {
    const MAX_SLICE_FOR_DEBUG = 100;
    const fileContents = open(relativePath);

    if (debug) {
        console.log(`Imported text: ${fileContents.slice(0, fileContents.length < MAX_SLICE_FOR_DEBUG ? fileContents.length : MAX_SLICE_FOR_DEBUG)}`);
    }

    return JSON.parse(fileContents);
}

function importJsonDir(relativePaths) {
    return new SharedArray('DATA_DIR', () => {
        return relativePaths.map(path => {
            const contents = open(path);
            return JSON.parse(contents);
        });
    });
}

function timesMap(count, predicate) {
    let index;
    let result = new Array(count);
    for (index = 0; index < count; index++) {
        result[index] = predicate(index);
    }

    return result;
}

function binArrayToStr(binArray) {
    let str = "";
    for (let i = 0; i < binArray.length; i++) {
        str += String.fromCharCode(parseInt(binArray[i]));
    }
    return str;
}

module.exports = {
    importJsonFile,
    importJsonDir,
    timesMap,
    binArrayToStr
};
