
const SVGRenderer = require('./js/svg');
const Files = require('./js/files');

async function main() {
  const ren = new SVGRenderer();
  // const res = await ren.downloadAndRenderMap({ ll: { lat: 47.693356, lon: 11.749774 }, ur: { lat: 47.700786, lon: 11.762389 } }, 5000);
  const res = await ren.downloadAndRenderMap({ ll: { lat: 47.693356, lon: 11.749774 }, ur: { lat: 47.717956, lon: 11.765478 } }, 5000);
  Files.cacheFile('app-data/test', 'svg', res);
  // console.log(res); // 47.693356, 11.749774, 47.700786, 11.762389
  // ["highway"]
}

main();
