
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
  // const res = await SVGRenderer.downloadAndRenderMap({ ll: { lat: 47.693356, lon: 11.749774 }, ur: { lat: 47.700786, lon: 11.762389 } }, 5000);
  if (cmdArgs.help) {
    console.log(`
#################### map-creator ####################
(c) Fabian Michel, 2019-2020 / MIT License

Rendering high quality OSM maps (to vector graphics) while keeping the file size low.
The SVG file will be saved in the folder \x1b[36mapp-data\x1b[0m. The following command line
options are available:
- \x1b[36m--scale [number]\x1b[0m (default is 25000): changes the map scale. The SVG will contain a map with
  scale of 1:scale. The SVG file itself uses cm as unit. Depending on your machine and software,
  these cm might not render to real-world cm on your screen.
- \x1b[36m--useCache [number]\x1b[0m: if this argument is supplied (with any number), the script automatically
  caches downloaded OSM data as well as bounding boxes and processed data (of the last 10
  executions). If the supplied number is between 1 and 10, the script will reuse the cached data
  instead of downloading and processing again (also see next bullet point). 1 specifies the most
  recent cache data. In addition, if you have saved cache entries via \x1b[36m--cacheSave\x1b[0m, you may also
  supply higher numbers. Note that the oldest cache entry will be automatically deleted during
  execution.
- \x1b[36m--cacheLvl [number]\x1b[0m (default is 2): 0 - no data from cache is used (but cache entries are
  written if \x1b[36m--useCache\x1b[0m is used), 1 - OSM data is read from cache (instead of downloading it),
  2 - OSM data and processed OSM data is read from cache (note that specifying a different scale
  than the scale which was specified when the cached data was processed will result in undefined
  behavior). Only works in connection with \x1b[36m--useCache\x1b[0m.
- \x1b[36m--cacheSave [number]\x1b[0m: if a number larger than 10 is supplied, all data will (in addition to
  standard caching) be saved to a special numbered cache file which can be referred to with
  \x1b[36m--useCache\x1b[0m later. This special cache file will only be overwritten when \x1b[36m--cacheSave\x1b[0m is used
  with the same number, the file will not be overwritten by newer cache data. Only works in
  connection with \x1b[36m--useCache\x1b[0m.`);
    return;
  }
  let scale = 25000;
  if (cmdArgs.scale) scale = checkInt(cmdArgs.scale);
  let res;
  if (cmdArgs.useCache) {
    const cacheNum = checkInt(cmdArgs.useCache);
    let cacheLvl = 2, specialSaveCache = -1;
    if (typeof cmdArgs.cacheLvl !== 'undefined') cacheLvl = checkInt(cmdArgs.cacheLvl);
    if (typeof cmdArgs.cacheSave !== 'undefined') specialSaveCache = checkInt(cmdArgs.cacheSave);
    if (cacheLvl >= 1) {
      res = await SVGRenderer.renderMap(null, null, scale, { cacheNum, recacheLvl: cacheLvl, specialSaveCache });
    } else {
      res = await SVGRenderer.downloadAndRenderMap(
        JSON.parse(Files.readCacheFile('app-data/cache/bb', 'json', cacheNum)), scale,
        { cacheNum, recacheLvl: cacheLvl });
    }
  } else {
    // res = await SVGRenderer.downloadAndRenderMap({ ll: { lat: 47.693356, lon: 11.749774 }, ur: { lat: 47.717956, lon: 11.765478 } }, scale);
    // res = await SVGRenderer.downloadAndRenderMap({ ll: { lat: 47.576453, lon: 11.747029 }, ur: { lat: 47.772483, lon: 11.977459 } }, scale);
    res = await SVGRenderer.downloadAndRenderMap({ ll: { lat: 47.6344, lon: 11.7991 }, ur: { lat: 47.6806, lon: 11.9651 } }, scale);
    // res = await SVGRenderer.downloadAndRenderMap({ ll: { lat: 49.5721, lon: 8.6292 }, ur: { lat: 49.6515, lon: 8.8405 } }, scale);
  }
  Files.cacheFile('app-data/test', 'svg', res);
  // console.log(res); // 47.693356, 11.749774, 47.700786, 11.762389
  // ["highway"]
}

main();
