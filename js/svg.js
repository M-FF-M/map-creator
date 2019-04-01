
const GeoTools = require('./geotools');
const OverpassRequest = require('./overpass');
const Files = require('./files');
const merc = require('mercator-projection');
const simplify = require('simplify-js');

function min(...args) {
  let res = Infinity;
  for (let i = 0; i < args.length; i++)
    if (args[i] < res) res = args[i];
  return res;
}

function max(...args) {
  let res = -Infinity;
  for (let i = 0; i < args.length; i++)
    if (args[i] > res) res = args[i];
  return res;
}

function s(num) {
  return `${(Math.round(num * 100) / 100)}`;
}

class SVGRenderer {
  async downloadAndRenderMap(boundingBox, scale) {
    const req = new OverpassRequest();
    let osmData = await req.simpleJSONApiRequest(
      `way
        (${boundingBox.ll.lat},${boundingBox.ll.lon},${boundingBox.ur.lat},${boundingBox.ur.lon});
      (._;>;);
      out;`);
    return this.renderMap(osmData, boundingBox, scale);
  }

  renderMap(osmData, boundingBox, scale) {
    const ll = merc.fromLatLngToPoint({ lat: boundingBox.ll.lat, lng: boundingBox.ll.lon });
    const ul = merc.fromLatLngToPoint({ lat: boundingBox.ur.lat, lng: boundingBox.ll.lon });
    const ur = merc.fromLatLngToPoint({ lat: boundingBox.ur.lat, lng: boundingBox.ur.lon });
    const lr = merc.fromLatLngToPoint({ lat: boundingBox.ll.lat, lng: boundingBox.ur.lon });
    const left = min(ll.x, ul.x, ur.x, lr.x);
    const right = max(ll.x, ul.x, ur.x, lr.x);
    const top = min(ll.y, ul.y, ur.y, lr.y);
    const bottom = max(ll.y, ul.y, ur.y, lr.y);
    const actWidth = GeoTools.distance(boundingBox.ll.lat, boundingBox.ll.lon,
      boundingBox.ll.lat, boundingBox.ur.lon);
    const actHeight = GeoTools.distance(boundingBox.ll.lat, boundingBox.ll.lon,
      boundingBox.ur.lat, boundingBox.ll.lon);
    const mapWidth = actWidth * 100000 / scale;
    const mapHeight = actHeight * 100000 / scale;
    const toMapCoords = (lat, lon) => {
      const xy = merc.fromLatLngToPoint({ lat, lng: lon });
      const x = ((xy.x - left) / (right - left)) * mapWidth;
      const y = ((xy.y - top) / (bottom - top)) * mapHeight;
      return [x, y];
    };
    let output = '';
    output += `<svg version="1.1" viewBox="0 0 ${s(mapWidth)} ${s(mapHeight)}" width="${s(mapWidth)}cm" height="${s(mapHeight)}cm" xmlns="http://www.w3.org/2000/svg">`;
    const data = this.getDrawingData(osmData, toMapCoords);
    for (let l = 0; l < data.layers.length; l++) {
      for (let i = 0; i < data.layers[l].length; i++) {
        output += this.getSVGText(data, data.layers[l][i]);
      }
    }
    output += '</svg>';
    console.log(`SVG created (${s(output.length / (1024 * 1024))} MB).`);
    return output;
  }

  getDrawingData(osmData, toMapCoords) {
    const ret = { layers: [], paths: [] };
    const LAYER_NUM = 3;
    for (let i = 0; i < LAYER_NUM; i++)
      ret.layers.push([]);
    const ROAD_BG = 0;
    const ROAD_FG = 1;
    const BUILDINGS = 2;
    
    const ndMap = {};
    for (let i = 0; i < osmData.elements.length; i++) {
      if (osmData.elements[i].type === 'node')
        ndMap[osmData.elements[i].id] = i;
    }
    const createPath = elem => {
      if (elem.type === 'way') {
        if (elem.tags && elem.tags.highway) return true;
        if (elem.tags && elem.tags.building && elem.tags.building === 'yes') return true;
      }
      return false;
    };
    const addDrawingStyles = (elem, pIdx) => {
      if (elem.type === 'way') {

        if (elem.tags && elem.tags.highway) {
          ret.layers[ROAD_BG].push( { type: 'path', id: pIdx, style:
            { stroke: 'black', fill: 'transparent', strokeWidth: '0.14', strokeLinecap: 'round', strokeLinejoin: 'round' } } );
          ret.layers[ROAD_FG].push( { type: 'path', id: pIdx, style:
            { stroke: 'white', fill: 'transparent', strokeWidth: '0.08', strokeLinecap: 'round', strokeLinejoin: 'round' } } );

        } else if (elem.tags && elem.tags.building && elem.tags.building === 'yes') {
          ret.layers[BUILDINGS].push( { type: 'path', id: pIdx, style: { fill: 'orange' } } );
        }
      }
    };
    let pBef = 0; let pAft = 0;
    for (let i = 0; i < osmData.elements.length; i++) {
      if (createPath(osmData.elements[i])) {
        const pIdx = ret.paths.length;
        ret.paths.push([]);
        for (let k = 0; k < osmData.elements[i].nodes.length; k++) {
          const nodeIdx = ndMap[ osmData.elements[i].nodes[k] ];
          const coords = toMapCoords(osmData.elements[nodeIdx].lat, osmData.elements[nodeIdx].lon);
          ret.paths[pIdx].push({ x: coords[0], y: coords[1] });
        }
        pBef += ret.paths[pIdx].length;
        ret.paths[pIdx] = simplify(ret.paths[pIdx], 0.03);
        pAft += ret.paths[pIdx].length;
        addDrawingStyles(osmData.elements[i], pIdx);
      }
    }
    console.log(`Path simplification: number of original nodes was ${pBef}, reduced to ${pAft} nodes.`);
    const cacheStr = JSON.stringify(ret);
    Files.cacheFile('app-data/cache/draw', 'json', cacheStr);
    console.log(`Drawing data cached (${s(cacheStr.length / (1024 * 1024))} MB).`);
    return ret;
  }

  cCtoDashC(val) {
    return val.replace(/[A-Z]/g, '-$&').toLowerCase();
  }

  toAttribs(style) {
    let ret = '';
    for (let prop in style) {
      if (style.hasOwnProperty(prop)) {
        ret += ` ${this.cCtoDashC(prop)}="${style[prop]}"`;
      }
    }
    return ret;
  }

  getSVGText(data, dataElem) {
    let output = '';
    if (dataElem.type === 'path') {
      const path = data.paths[dataElem.id];
      output += '<path d="';
      for (let i = 0; i < path.length; i++) {
        if (i == 0) output += 'M';
        else output += 'L';
        output += `${s(path[i].x)} ${s(path[i].y)}`;
      }
      output += `"${this.toAttribs(dataElem.style)} />`;
    }
    return output;
  }
}

module.exports = SVGRenderer;
