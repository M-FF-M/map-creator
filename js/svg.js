
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

function s(num, digits = 2) {
  if (digits == 2)
    return `${(Math.round(num * 100) / 100)}`;
  else {
    const str = `${(Math.round(num * Math.pow(10, digits)) / Math.pow(10, digits))}`.split(/\./g);
    if (str.length > 1)
      if (str[1].length > digits) str[1] = str[1].substr(0, digits);
    return str.join('.');
  }
}

class SVGRenderer {
  async downloadAndRenderMap(boundingBox, scale, cacheSettings = {}) {
    const req = new OverpassRequest();
    let osmData = await req.simpleJSONApiRequest(
      `(
        (
          way
            (${boundingBox.ll.lat},${boundingBox.ll.lon},${boundingBox.ur.lat},${boundingBox.ur.lon});
          >;
        );
        <;
      );
      out;`);
    return this.renderMap(osmData, boundingBox, scale, cacheSettings);
  }

  /**
   * Render a OSM map
   * @param {object} osmData JSON data returned by a request to the Overpass API. Set to null if
   * data should be taken from cache (recacheLvl must be at least 1 in this case)
   * @param {object} boundingBox the bounding box of the map. Set to null if it should be read from
   * cache
   * @property {object} boundingBox.ll the lower left corner of the bounding box
   * @property {number} boundingBox.ll.lat the latitude of the lower left corner (in degrees)
   * @property {number} boundingBox.ll.lon the longitude of the lower left corner (in degrees)
   * @property {object} boundingBox.ur the upper right corner of the bounding box
   * @property {number} boundingBox.ur.lat the latitude of the upper right corner (in degrees)
   * @property {number} boundingBox.ur.lon the longitude of the upper right corner (in degrees)
   * @param {number} scale the map will be created with a scale of 1:scale
   * @param {object} [cacheSettings] settings for caching
   * @property {object} cacheSettings.cachedData cached drawing data (as an object). Set to null or
   * do not provide if data should be taken taken from cache (recacheLvl must be at least 2 in this
   * case)
   * @property {number} cacheSettings.recacheLvl 0 - no data from cache is used (standard cache
   * entries are written if cacheData is true), 1 - osmData is read from cache (if osmData is null)
   * and the OSM data cache entry will only reference the old cache entry, 2 - osmData and
   * cachedData are read from cache (if both are null), the new cache entries will only reference
   * the older entries
   * @property {number} cacheSettings.cacheNum set this number to specify which cache file to load
   * @property {boolean} cacheSettings.cacheData set to true if data should be cached
   */
  renderMap(osmData, boundingBox, scale, cacheSettings = {}) {
    this.scale = scale;
    let { cachedData = null, recacheLvl = 0, cacheData = true, cacheNum = 1 } = cacheSettings;
    if (boundingBox === null)
      boundingBox = JSON.parse(Files.readCacheFile('app-data/cache/bb', 'json', cacheNum));
    if (cacheData) {
      if (recacheLvl >= 1) {
        Files.recacheFile('app-data/cache/osm', 'json');
        console.log('OSM data cache entry created (no changes).');
      } else {
        const jsonData = JSON.stringify(osmData);
        Files.cacheFile('app-data/cache/osm', 'json', jsonData);
        console.log(`OSM data cached (${Files.getSizeStr(jsonData.length)}).`);
      }
      Files.cacheFile('app-data/cache/bb', 'json', JSON.stringify(boundingBox));
      console.log(`Bounding box (${s(boundingBox.ll.lat, 6)}, ${s(boundingBox.ll.lon, 6)}, ${
        s(boundingBox.ur.lat, 6)}, ${s(boundingBox.ur.lon, 6)}) cached.`);
    }
    if (osmData === null && recacheLvl>= 1)
      osmData = JSON.parse(Files.readCacheFile('app-data/cache/osm', 'json', cacheNum));
    if (cachedData === null && recacheLvl>= 2)
      cachedData = JSON.parse(Files.readCacheFile('app-data/cache/draw', 'json', cacheNum));

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
    const data = cachedData !== null ? cachedData : this.getDrawingData(osmData, toMapCoords);

    if (cacheData) {
      if (recacheLvl >= 2) {
        Files.recacheFile('app-data/cache/draw', 'json');
        console.log('Drawing data cache entry created (no changes).');
      } else {
        const cacheStr = JSON.stringify(data);
        Files.cacheFile('app-data/cache/draw', 'json', cacheStr);
        console.log(`Drawing data cached (${Files.getSizeStr(cacheStr.length)}).`);
      }
    }

    output += '<rect width="100%" height="100%" fill="#f2efe9"/>';
    for (let l = 0; l < data.layers.length; l++) {
      for (let i = 0; i < data.layers[l].length; i++) {
        output += this.getSVGText(data, data.layers[l][i]);
      }
    }
    output += '</svg>';
    console.log(`SVG created (${Files.getSizeStr(output.length)}).`);
    return output;
  }

  getDrawingData(osmData, toMapCoords) {
    const ret = { layers: [], paths: [] };
    let cLayer = 0;
    let BUILDINGS = 0;
    const ROAD_LAYERS = 7;
    const LAND = cLayer++;
    cLayer++; const WATER = cLayer++;
    if (this.scale > 5000) BUILDINGS = cLayer++;
    const ROAD_BG = cLayer; cLayer += ROAD_LAYERS;
    const ROAD_FG = cLayer; cLayer += ROAD_LAYERS;
    cLayer += 2; const RAIL_BG = cLayer++;
    const RAIL_FG = cLayer++;
    if (this.scale <= 5000) BUILDINGS = cLayer++;
    const LAYER_NUM = cLayer;
    for (let i = 0; i < LAYER_NUM; i++)
      ret.layers.push([]);
    
    const ndMap = {}; const wayMap = {}; const relMap = {}; const relWays = {};
    for (let i = 0; i < osmData.elements.length; i++) {
      if (osmData.elements[i].type === 'node')
        ndMap[osmData.elements[i].id] = i;
      if (osmData.elements[i].type === 'way')
        wayMap[osmData.elements[i].id] = i;
      if (osmData.elements[i].type === 'relation')
        relMap[osmData.elements[i].id] = i;
    }
    const areaFeature = elem => {
      if (elem.tags && elem.tags.natural) {
        if (elem.tags.natural === 'wood' || elem.tags.natural === 'scrub'
            || elem.tags.natural === 'heath' || elem.tags.natural === 'grassland'
            || elem.tags.natural === 'fell' || elem.tags.natural === 'bare_rock'
            || elem.tags.natural === 'scree' || elem.tags.natural === 'shingle'
            || elem.tags.natural === 'sand' || elem.tags.natural === 'mud'
            || elem.tags.natural === 'water' || elem.tags.natural === 'wetland'
            || elem.tags.natural === 'glacier' // || elem.tags.natural === 'bay'
            || elem.tags.natural === 'beach' || elem.tags.natural === 'spring'
            || elem.tags.natural === 'hot_spring' || elem.tags.natural === 'blowhole')
          return true;
      }
      if (elem.tags && elem.tags.landuse) {
        if (elem.tags.landuse === 'commercial' || elem.tags.landuse === 'construction'
            || elem.tags.landuse === 'industrial' || elem.tags.landuse === 'residential'
            || elem.tags.landuse === 'retail' || elem.tags.landuse === 'allotments'
            || elem.tags.landuse === 'basin' || elem.tags.landuse === 'brownfield'
            || elem.tags.landuse === 'cemetery' || elem.tags.landuse === 'farmland'
            || elem.tags.landuse === 'farmyard' || elem.tags.landuse === 'forest'
            || elem.tags.landuse === 'garages' || elem.tags.landuse === 'grass'
            || elem.tags.landuse === 'greenfield' || elem.tags.landuse === 'greenhouse_horticulture'
            || elem.tags.landuse === 'landfill' || elem.tags.landuse === 'meadow'
            || elem.tags.landuse === 'military' || elem.tags.landuse === 'orchard'
            || elem.tags.landuse === 'plant_nursery' || elem.tags.landuse === 'quarry'
            || elem.tags.landuse === 'railway' || elem.tags.landuse === 'recreation_ground'
            || elem.tags.landuse === 'religious' || elem.tags.landuse === 'reservoir'
            || elem.tags.landuse === 'salt_pond' || elem.tags.landuse === 'village_green'
            || elem.tags.landuse === 'vineyard')
          return true;
      }
      if (elem.tags && elem.tags.waterway) {
        if (elem.tags.waterway === 'river' || elem.tags.waterway === 'riverbank'
            || elem.tags.waterway === 'riverbank' || elem.tags.waterway === 'stream'
            || elem.tags.waterway === 'canal' || elem.tags.waterway === 'drain'
            || elem.tags.waterway === 'ditch')
          return true;
      }
      return false;
    }
    const displayRelation = elem => {
      if (elem.type === 'relation' && elem.tags && elem.tags.type === 'multipolygon') {
        if (areaFeature(elem)) return true;
      }
      return false;
    };
    const createPath = elem => {
      if (elem.type === 'way') {
        if (relWays[elem.id]) return true;
        if (areaFeature(elem)) return true;
        if (elem.tags && elem.tags.highway) {
          if (elem.tags.highway === 'motorway' || elem.tags.highway === 'trunk'
              || elem.tags.highway === 'primary' || elem.tags.highway === 'secondary'
              || elem.tags.highway === 'tertiary' || elem.tags.highway === 'road'
              || elem.tags.highway === 'motorway_link' || elem.tags.highway === 'trunk_link'
              || elem.tags.highway === 'primary_link' || elem.tags.highway === 'secondary_link'
              || elem.tags.highway === 'tertiary_link' || elem.tags.highway === 'unclassified'
              || elem.tags.highway === 'residential' || elem.tags.highway === 'living_street'
              || elem.tags.highway === 'service' || elem.tags.highway === 'pedestrian'
              || elem.tags.highway === 'track' || elem.tags.highway === 'footway'
              || elem.tags.highway === 'bridleway' || elem.tags.highway === 'steps'
              || elem.tags.highway === 'path' || elem.tags.highway === 'cycleway')
            return true;
        }
        if (elem.tags && elem.tags.railway && elem.tags.railway !== 'abandoned'
            && elem.tags.railway !== 'subway')
          return true;
        if (elem.tags && elem.tags.building) return true;
      }
      return false;
    };
    const getPathStyle = elem => {
      if (elem.tags && elem.tags.highway) {
        if (elem.tags.highway === 'motorway' || elem.tags.highway === 'trunk'
            || elem.tags.highway === 'primary' || elem.tags.highway === 'secondary'
            || elem.tags.highway === 'tertiary' || elem.tags.highway === 'road'
            || elem.tags.highway === 'motorway_link' || elem.tags.highway === 'trunk_link'
            || elem.tags.highway === 'primary_link' || elem.tags.highway === 'secondary_link'
            || elem.tags.highway === 'tertiary_link' || elem.tags.highway === 'unclassified'
            || elem.tags.highway === 'residential' || elem.tags.highway === 'living_street'
            || elem.tags.highway === 'service' || elem.tags.highway === 'pedestrian') {
          let bgWidth = 0.1;
          let fgWidth = 0.06;
          let outerColor = 'black';
          let innerColor = 'white';
          let rdLayer = 1;
          if (elem.tags.highway === 'motorway' || elem.tags.highway === 'motorway_link')
            { innerColor = '#e990a0'; outerColor = '#df2e6b'; rdLayer = 6;
              bgWidth = 0.14; fgWidth = 0.1; }
          if (elem.tags.highway === 'trunk' || elem.tags.highway === 'trunk_link')
            { innerColor = '#fbb29a'; outerColor = '#cd532e'; rdLayer = 5;
              bgWidth = 0.14; fgWidth = 0.1; }
          if (elem.tags.highway === 'primary' || elem.tags.highway === 'primary_link')
            { innerColor = '#fdd7a1'; outerColor = '#ab7b03'; rdLayer = 4;
              bgWidth = 0.14; fgWidth = 0.1; }
          if (elem.tags.highway === 'secondary' || elem.tags.highway === 'secondary_link')
            { innerColor = '#f6fabb'; outerColor = '#7c8900'; rdLayer = 3;
              bgWidth = 0.14; fgWidth = 0.1; }
          if (elem.tags.highway === 'tertiary' || elem.tags.highway === 'tertiary_link')
            { innerColor = '#fefefe'; outerColor = '#adadad'; rdLayer = 2;
              bgWidth = 0.14; fgWidth = 0.1; }
          if (elem.tags.highway === 'road')
            { innerColor = '#dddddd'; outerColor = '#c2c2c1'; }
          if (elem.tags.highway === 'unclassified')
            { innerColor = '#fefefe'; outerColor = '#c9c5c5'; }
          if (elem.tags.highway === 'residential')
            { innerColor = '#fefefe'; outerColor = '#c9c5c5'; }
          if (elem.tags.highway === 'living_street')
            { innerColor = '#ededed'; outerColor = '#c5c5c5'; }
          if (elem.tags.highway === 'service')
            { innerColor = '#fefefe'; outerColor = '#c9c5c5'; bgWidth = 0.08; fgWidth = 0.04; }
          if (elem.tags.highway === 'pedestrian')
            { innerColor = '#dddde9'; outerColor = '#a7a5a6'; }
          return [
            { layer: ROAD_BG + rdLayer, style:
              { stroke: outerColor, fillOpacity: '0', strokeWidth: s(bgWidth), strokeLinecap: 'round', strokeLinejoin: 'round' } },
            { layer: ROAD_FG + rdLayer, style:
              { stroke: innerColor, fillOpacity: '0', strokeWidth: s(fgWidth), strokeLinecap: 'round', strokeLinejoin: 'round' } }
          ];
        } else if (elem.tags.highway === 'track' || elem.tags.highway === 'footway'
            || elem.tags.highway === 'bridleway' || elem.tags.highway === 'steps'
            || elem.tags.highway === 'path' || elem.tags.highway === 'cycleway') {
          let pWidth = 0.03;
          let color = 'black';
          let dashed = '0.5';
          if (elem.tags.highway === 'track')
            { color = '#ac8327'; dashed = '0.16 0.04 0.08 0.04'; }
          if (elem.tags.highway === 'footway' || elem.tags.highway === 'path')
            { color = '#fc7f6f'; dashed = '0.08 0.04'; }
          if (elem.tags.highway === 'bridleway')
            { color = '#028102'; dashed = '0.16 0.04'; }
          if (elem.tags.highway === 'steps')
            { color = '#fc7f6f'; dashed = '0.04 0.02'; pWidth = 0.08; }
          if (elem.tags.highway === 'cycleway')
            { color = '#1111ff'; dashed = '0.08 0.04'; }
          return [
            { layer: ROAD_FG, style:
              { stroke: color, fillOpacity: '0', strokeWidth: s(pWidth),
                strokeDasharray: dashed } }
          ];
        }

      } else if (elem.tags && elem.tags.railway && elem.tags.railway !== 'abandoned'
            && elem.tags.railway !== 'subway') {
        let outerColor = '#707070';
        let innerColor = '#ededed';
        let layerBg = RAIL_BG;
        let layerFg = RAIL_FG;
        if (elem.tags.railway === 'construction' || elem.tags.railway === 'disused') {
          outerColor = '#acabab';
          innerColor = '#f2f1f1';
          layerBg -= 2;
          layerFg -= 2;
        }
        return [
          { layer: layerBg, style:
            { stroke: outerColor, fillOpacity: '0', strokeWidth: '0.09' } },
          { layer: layerFg, style:
            { stroke: innerColor, fillOpacity: '0', strokeWidth: '0.05', strokeDasharray: '0.25' } }
        ];
        
      } else if (elem.tags && elem.tags.building) {
        return [
          { layer: BUILDINGS, style:
            { fill: '#d9d0c9', stroke: '#c5b8ac', strokeWidth: '0.02', strokeLinecap: 'round', strokeLinejoin: 'round' } }
        ];
        
      } else if (elem.tags && elem.tags.waterway) {
        if (elem.tags.waterway === 'riverbank') {
          return [
            { layer: WATER, style: { fill: '#abd4e0' } }
          ];
        } else if (elem.tags.waterway === 'river'
            || elem.tags.waterway === 'riverbank' || elem.tags.waterway === 'stream'
            || elem.tags.waterway === 'canal' || elem.tags.waterway === 'drain'
            || elem.tags.waterway === 'ditch') {
          if (elem.tags.waterway === 'canal') {
            return [
              { layer: WATER - 1, style:
                { stroke: '#7d9ba4', fillOpacity: '0', strokeWidth: '0.08', strokeLinecap: 'round', strokeLinejoin: 'round' } },
              { layer: WATER, style:
                { stroke: '#abd4e0', fillOpacity: '0', strokeWidth: '0.04', strokeLinecap: 'round', strokeLinejoin: 'round' } }
            ];
          } else {
            let pWidth = 0.06;
            if (elem.tags.waterway === 'drain' || elem.tags.waterway === 'ditch') pWidth = 0.03;
            if (elem.tags.waterway === 'river') pWidth = 0.09;
            return [
              { layer: WATER, style:
                { stroke: '#abd4e0', fillOpacity: '0', strokeWidth: s(pWidth), strokeLinecap: 'round', strokeLinejoin: 'round' } }
            ];
          }
        }

      } else if (elem.tags && elem.tags.natural) {
        if (elem.tags.natural === 'water' || elem.tags.natural === 'spring'
            || elem.tags.natural === 'hot_spring' || elem.tags.natural === 'blowhole')
          return [ { layer: WATER, style: { fill: '#abd4e0' } } ];
        // if (elem.tags.natural === 'wood' || elem.tags.natural === 'scrub'
        //     || elem.tags.natural === 'heath' || elem.tags.natural === 'grassland'
        //     || elem.tags.natural === 'fell' || elem.tags.natural === 'bare_rock'
        //     || elem.tags.natural === 'scree' || elem.tags.natural === 'shingle'
        //     || elem.tags.natural === 'sand' || elem.tags.natural === 'mud'
        //     || elem.tags.natural === 'wetland' || elem.tags.natural === 'glacier'
        //     || elem.tags.natural === 'beach')
        //   return [ { layer: LAND, style: { fill: '#abd4e0' } } ];

      } else if (elem.tags && elem.tags.landuse) {
        let color = 'none';
        if (elem.tags.landuse === 'commercial') color = '#eecfcf';
        if (elem.tags.landuse === 'construction') color = '#c7c7b4';
        if (elem.tags.landuse === 'industrial') color = '#e6d1e3';
        if (elem.tags.landuse === 'residential') color = '#dadada';
        if (elem.tags.landuse === 'retail') color = '#fecac5';
        if (elem.tags.landuse === 'allotments') color = '#cae2c0';
        if (elem.tags.landuse === 'basin') color = '#b4d0d1';
        if (elem.tags.landuse === 'brownfield') color = '#b6b690';
        if (elem.tags.landuse === 'cemetery') color = '#abccb0';
        if (elem.tags.landuse === 'farmland') color = '#eff0d6';
        if (elem.tags.landuse === 'farmyard') color = '#eacca4';
        if (elem.tags.landuse === 'forest') color = '#9dca8a';
        if (elem.tags.landuse === 'garages') color = '#deddcc';
        if (elem.tags.landuse === 'grass') color = '#cfeda5';
        if (elem.tags.landuse === 'greenfield') color = '#f1eee8';
        if (elem.tags.landuse === 'greenhouse_horticulture') color = '#eff0d6';
        if (elem.tags.landuse === 'landfill') color = '#b6b690';
        if (elem.tags.landuse === 'meadow') color = '#ceecb1';
        if (elem.tags.landuse === 'military') color = '#f3e4de';
        if (elem.tags.landuse === 'orchard') color = '#9edc90';
        if (elem.tags.landuse === 'plant_nursery') color = '#b0e1a5';
        if (elem.tags.landuse === 'quarry') color = '#b7b5b5';
        if (elem.tags.landuse === 'railway') color = '#e6d1e3';
        if (elem.tags.landuse === 'recreation_ground') color = '#cfeda5';
        if (elem.tags.landuse === 'religious') color = '#cecdca';
        if (elem.tags.landuse === 'reservoir') color = '#abd4e0';
        if (elem.tags.landuse === 'salt_pond') color = '#e7e6e2';
        if (elem.tags.landuse === 'village_green') color = '#ceecb1';
        if (elem.tags.landuse === 'vineyard') color = '#9edc90';
        if (color !== 'none')
          return [ { layer: LAND, style: { fill: color } } ];
      }
      return [];
    };
    const addDrawingStyles = (elem, pIdx) => {
      if (elem.type === 'way'
          || (elem.type === 'relation' && elem.tags && elem.tags.type === 'multipolygon')) {
        const typeObj = pIdx instanceof Array
         ? { type: 'multipath', ids: pIdx }
         : { type: 'path', id: pIdx };
        const styleInfo = getPathStyle(elem);
        for (let i = 0; i < styleInfo.length; i++) {
          ret.layers[styleInfo[i].layer].push({ ...typeObj, style: styleInfo[i].style })
        }
      }
    };

    let pBef = 0; let pAft = 0;
    for (let i = 0; i < osmData.elements.length; i++) {
      if (displayRelation(osmData.elements[i])) {
        for (let k = 0; k < osmData.elements[i].members.length; k++) {
          if (osmData.elements[i].members[k].type === 'way')
            relWays[osmData.elements[i].members[k].ref] = true;
        }
      }
    }
    for (let i = 0; i < osmData.elements.length; i++) {
      if (createPath(osmData.elements[i])) {
        const pIdx = ret.paths.length;
        ret.paths.push([]);
        for (let k = 0; k < osmData.elements[i].nodes.length; k++) {
          const nodeIdx = ndMap[ osmData.elements[i].nodes[k] ];
          if (nodeIdx) {
            const coords = toMapCoords(osmData.elements[nodeIdx].lat, osmData.elements[nodeIdx].lon);
            ret.paths[pIdx].push({ x: coords[0], y: coords[1] });
          }
        }
        pBef += ret.paths[pIdx].length;
        ret.paths[pIdx] = simplify(ret.paths[pIdx], 0.02);
        pAft += ret.paths[pIdx].length;
        if (ret.paths[pIdx].length > 0) {
          addDrawingStyles(osmData.elements[i], pIdx);
          relWays[osmData.elements[i].id] = pIdx;
        }
      }
    }
    for (let i = 0; i < osmData.elements.length; i++) {
      if (displayRelation(osmData.elements[i])) {
        const ways = [];
        for (let k = 0; k < osmData.elements[i].members.length; k++) {
          if (osmData.elements[i].members[k].type === 'way') {
            if (typeof relWays[osmData.elements[i].members[k].ref] === 'number')
              ways.push(relWays[osmData.elements[i].members[k].ref]);
          }
        }
        if (ways.length > 0)
          addDrawingStyles(osmData.elements[i], ways);
      }
    }
    console.log(`Path simplification: number of original nodes was ${pBef}, reduced to ${pAft} nodes.`);
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
    if (dataElem.type === 'path' || dataElem.type === 'multipath') {
      output += '<path d="';
      const ways = dataElem.type === 'path' ? [dataElem.id] : dataElem.ids;
      // const isArea = dataElem.style.fill && dataElem.style.fill !== 'transparent'
      //   && dataElem.style.fill !== 'none' && dataElem.style.fillOpacity !== '0';
      //   && dataElem.style.fillOpacity !== 0;
      for (let k = 0; k < ways.length; k++) {
        const path = data.paths[ ways[k] ];
        let contPath = false;
        if (k > 0) {
          const lastP = data.paths[ ways[k - 1] ][ data.paths[ ways[k - 1] ].length - 1 ];
          const curP = path[0];
          if (Math.abs(lastP.x - curP.x) < 1e-4 && Math.abs(lastP.y - curP.y) < 1e-4)
            contPath = true;
        }
        for (let i = 0; i < path.length; i++) {
          if (i == 0 && !contPath) output += 'M';
          else output += 'L';
          output += `${s(path[i].x)} ${s(path[i].y)}`;
        }
        // if (isArea && path.length > 0 && (Math.abs(path[0].x - path[path.length - 1].x) > 1e-4
        //     || Math.abs(path[0].y - path[path.length - 1].y) > 1e-4)) {
        //   output += `${s(path[0].x)} ${s(path[0].y)}`;
        // }
      }
      output += `"${this.toAttribs(dataElem.style)}${ways.length > 1 ? ' fill-rule="evenodd"' : ''} />`;
    }
    return output;
  }
}

module.exports = SVGRenderer;
