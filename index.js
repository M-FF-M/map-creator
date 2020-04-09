
const SVGRenderer = require('./js/svg');
const Files = require('./js/files');
const cmdArgs = require('minimist')(process.argv.slice(2));

function checkInt(num) {
  if (typeof num === 'number') return Math.round(num);
  else return parseInt(num);
}

function checkFloat(num) {
  if (typeof num === 'number') return num;
  else return parseFloat(num);
}

async function main() {
  const ren = new SVGRenderer();
  // const res = await ren.downloadAndRenderMap({ ll: { lat: 47.693356, lon: 11.749774 }, ur: { lat: 47.700786, lon: 11.762389 } }, 5000);
  let scale = 25000;
  if (cmdArgs.scale) scale = checkInt(cmdArgs.scale);
  let res;
  if (cmdArgs.useCache) {
    const cacheNum = checkInt(cmdArgs.useCache);
    let cacheLvl = 2, specialSaveCache = -1;
    if (typeof cmdArgs.cacheLvl !== 'undefined') cacheLvl = checkInt(cmdArgs.cacheLvl);
    if (typeof cmdArgs.cacheSave !== 'undefined') specialSaveCache = checkInt(cmdArgs.cacheSave);
    if (cacheLvl >= 1) {
      res = await ren.renderMap(null, null, scale, { cacheNum, recacheLvl: cacheLvl, specialSaveCache });
    } else {
      res = await ren.downloadAndRenderMap(
        JSON.parse(Files.readCacheFile('app-data/cache/bb', 'json', cacheNum)), scale,
        { cacheNum, recacheLvl: cacheLvl });
    }
  } else {
    // res = await ren.downloadAndRenderMap({ ll: { lat: 47.693356, lon: 11.749774 }, ur: { lat: 47.717956, lon: 11.765478 } }, scale);
    // res = await ren.downloadAndRenderMap({ ll: { lat: 47.576453, lon: 11.747029 }, ur: { lat: 47.772483, lon: 11.977459 } }, scale);
    res = await ren.downloadAndRenderMap({ ll: { lat: 47.6344, lon: 11.7991 }, ur: { lat: 47.6806, lon: 11.9651 } }, scale);
    // res = await ren.downloadAndRenderMap({ ll: { lat: 49.5721, lon: 8.6292 }, ur: { lat: 49.6515, lon: 8.8405 } }, scale);
  }
  Files.cacheFile('app-data/test', 'svg', res);
  // console.log(res); // 47.693356, 11.749774, 47.700786, 11.762389
  // ["highway"]
}

main();
