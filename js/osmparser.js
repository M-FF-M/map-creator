
const GeoTools = require('./geotools');
const OverpassRequest = require('./overpass');
const Files = require('./files');
const FeatureParser = require('./featureparser');
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

class OSMParser {
  async downloadAndProcessMap(boundingBox, scale, cacheSettings = {}) {
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
    return this.processMap(osmData, boundingBox, scale, cacheSettings);
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
   * @property {number} cacheSettings.specialSaveCache if set to a number >10, the data will be
   * cached with the according number in addition to the standard cache behavior; the cached extra
   * data will then only be overwritten if the same number is given again, it will not be
   * overwritten by newer data
   * @return {object} processed OSM data for drawing
   */
  processMap(osmData, boundingBox, scale, cacheSettings = {}) {
    console.log('Entering OSMParser.processMap().');
    this.scale = scale;
    let { cachedData = null, recacheLvl = 0, cacheData = true, cacheNum = 1, specialSaveCache = -1 }
      = cacheSettings;
    if (boundingBox === null)
      boundingBox = JSON.parse(Files.readCacheFile('app-data/cache/bb', 'json', cacheNum));
    if (osmData === null && recacheLvl>= 1)
      osmData = JSON.parse(Files.readCacheFile('app-data/cache/osm', 'json', cacheNum));
    if (cachedData === null && recacheLvl>= 2)
      cachedData = JSON.parse(Files.readCacheFile('app-data/cache/proc', 'json', cacheNum));
    if (cacheData) {
      if (recacheLvl >= 1 && cacheNum == 1) {
        Files.recacheFile('app-data/cache/osm', 'json');
        if (specialSaveCache > 10) Files.saveFile(`app-data/cache/osm-${specialSaveCache}.json`, JSON.stringify(osmData));
        console.log('OSM data cache entry created (no changes).');
      } else {
        const jsonData = JSON.stringify(osmData);
        Files.cacheFile('app-data/cache/osm', 'json', jsonData);
        if (specialSaveCache > 10) Files.saveFile(`app-data/cache/osm-${specialSaveCache}.json`, jsonData);
        console.log(`OSM data cached (${Files.getSizeStr(jsonData.length)}).`);
      }
      Files.cacheFile('app-data/cache/bb', 'json', JSON.stringify(boundingBox));
      if (specialSaveCache > 10) Files.saveFile(`app-data/cache/bb-${specialSaveCache}.json`, JSON.stringify(boundingBox));
      console.log(`Bounding box (${s(boundingBox.ll.lat, 6)}, ${s(boundingBox.ll.lon, 6)}, ${
        s(boundingBox.ur.lat, 6)}, ${s(boundingBox.ur.lon, 6)}) cached.`);
    }

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

    const data = cachedData !== null ? cachedData : this.getProcessedData(osmData, toMapCoords);

    if (cacheData) {
      if (recacheLvl >= 2 && cacheNum == 1) {
        Files.recacheFile('app-data/cache/proc', 'json');
        if (specialSaveCache > 10) Files.saveFile(`app-data/cache/proc-${specialSaveCache}.json`, JSON.stringify(data));
        console.log('Processed data cache entry created (no changes).');
      } else {
        const cacheStr = JSON.stringify(data);
        Files.cacheFile('app-data/cache/proc', 'json', cacheStr);
        if (specialSaveCache > 10) Files.saveFile(`app-data/cache/proc-${specialSaveCache}.json`, cacheStr);
        console.log(`Processed data cached (${Files.getSizeStr(cacheStr.length)}).`);
      }
    }

    return data;
  }

  getProcessedData(osmData, toMapCoords) {
    const ret = { paths: [], features: [], timestamp: (new Date()).getTime() };
    if (osmData.osm3s && osmData.osm3s.timestamp_osm_base)
      ret.osmTime = osmData.osm3s.timestamp_osm_base;
    
    const ndMap = {}; const wayMap = {}; const relMap = {}; const relWays = {};
      // ndMap: node id -> index in osmData.elements, wayMap, relMap,
      // relWays: OSM id -> true (this is a way which will be drawn as part of a relation) / false
    const pathEnds = []; // saves end an start node ids for paths in ret.paths (as an object {start: id, end: id})
    for (let i = 0; i < osmData.elements.length; i++) {
      if (osmData.elements[i].type === 'node')
        ndMap[osmData.elements[i].id] = i;
      if (osmData.elements[i].type === 'way')
        wayMap[osmData.elements[i].id] = i;
      if (osmData.elements[i].type === 'relation')
        relMap[osmData.elements[i].id] = i;
    }
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
      if (FeatureParser.displayRelation(osmData.elements[i])) {
        for (let k = 0; k < osmData.elements[i].members.length; k++) {
          if (osmData.elements[i].members[k].type === 'way')
            relWays[osmData.elements[i].members[k].ref] = true;
        }
      }
    }
    for (let i = 0; i < osmData.elements.length; i++) {
      if (FeatureParser.createPath(osmData.elements[i])) {
        const pIdx = ret.paths.length;
        ret.paths.push([]); pathEnds.push({});
        for (let k = 0; k < osmData.elements[i].nodes.length; k++) {
          const nodeIdx = ndMap[ osmData.elements[i].nodes[k] ];
          if (nodeIdx) {
            const coords = toMapCoords(osmData.elements[nodeIdx].lat, osmData.elements[nodeIdx].lon);
            ret.paths[pIdx].push({ x: coords[0], y: coords[1] });
            if (ret.paths[pIdx].length == 1) pathEnds[pIdx].start = nodeIdx;
            pathEnds[pIdx].end = nodeIdx;
          }
        }
        pBef += ret.paths[pIdx].length;
        ret.paths[pIdx] = simplify(ret.paths[pIdx], 0.02);
        pAft += ret.paths[pIdx].length;
        if (ret.paths[pIdx].length > 0) {
          // addDrawingStyles(osmData.elements[i], pIdx);
          relWays[osmData.elements[i].id] = pIdx;
        }
      }
    }
    for (let i = 0; i < osmData.elements.length; i++) {
      if (FeatureParser.displayRelation(osmData.elements[i])) {
        const ways = []; const nodeIdxMap = {}; const idxMap = {};
        for (let k = 0; k < osmData.elements[i].members.length; k++) {
          if (osmData.elements[i].members[k].type === 'way') {
            if (typeof relWays[osmData.elements[i].members[k].ref] === 'number') {
              const pathIdx = relWays[osmData.elements[i].members[k].ref];
              if (!(nodeIdxMap[ pathEnds[pathIdx].start ] instanceof Array))
                nodeIdxMap[ pathEnds[pathIdx].start ] = [];
              if (!(nodeIdxMap[ pathEnds[pathIdx].end ] instanceof Array))
                nodeIdxMap[ pathEnds[pathIdx].end ] = [];
              nodeIdxMap[ pathEnds[pathIdx].start ].push({ idx: ways.length, start: true });
              nodeIdxMap[ pathEnds[pathIdx].end ].push({ idx: ways.length, start: false });
              idxMap[ways.length] = true;
              ways.push( { pathIdx, reverse: false,
                startIdx: pathEnds[pathIdx].start, endIdx: pathEnds[pathIdx].end } ); // reverse: whether to traverse path in reverse order
            }
          }
        }
        const waysNew = [];
        // sorting (and potentially reversing) all the ways in order to draw them in the right order
        for (let j = 0; j < ways.length; j++) {
          if (idxMap[j]) {
            let cidx = j; let cidxRev = cidx;
            let creversed = false, creversedRev = false;
            idxMap[cidx] = false;
            waysNew.push(ways[cidx]); const constidx = waysNew.length - 1;
            for (let phase = 0; phase < 2; phase++) {
              // phases: 0: look for previous paths, 1: look for following paths
              while (nodeIdxMap[ phase == 0
                  ? (creversedRev ? pathEnds[ ways[cidxRev].pathIdx ].end : pathEnds[ ways[cidxRev].pathIdx ].start)
                  : (creversed ? pathEnds[ ways[cidx].pathIdx ].start : pathEnds[ ways[cidx].pathIdx ].end) ]
                  instanceof Array) {
                const ndMpIdx = phase == 0
                  ? (creversedRev ? pathEnds[ ways[cidxRev].pathIdx ].end : pathEnds[ ways[cidxRev].pathIdx ].start)
                  : (creversed ? pathEnds[ ways[cidx].pathIdx ].start : pathEnds[ ways[cidx].pathIdx ].end);
                let residx = -1;
                for (let aidx = 0; aidx < nodeIdxMap[ndMpIdx].length; aidx++) {
                  if (nodeIdxMap[ndMpIdx][aidx].idx != cidxRev && idxMap[ nodeIdxMap[ndMpIdx][aidx].idx ]) {
                    residx = aidx;
                    break;
                  }
                }
                if (residx != -1) {
                  const nidx = nodeIdxMap[ndMpIdx][residx].idx;
                  let nreversed = phase == 0
                    ? (nodeIdxMap[ndMpIdx][residx].start ? true : false)
                    : (nodeIdxMap[ndMpIdx][residx].start ? false : true);
                  idxMap[nidx] = false;
                  ways[nidx].reverse = nreversed;
                  if (nreversed) {
                    ways[nidx].startIdx = pathEnds[ ways[nidx].pathIdx ].end;
                    ways[nidx].endIdx = pathEnds[ ways[nidx].pathIdx ].start;
                  }
                  if (phase == 0) {
                    waysNew.splice(constidx, 0, ways[nidx]);
                    cidxRev = nidx;
                    creversedRev = nreversed;
                  } else {
                    waysNew.push(ways[nidx]);
                    cidx = nidx;
                    creversed = nreversed;
                  }
                } else {
                  break;
                }
              }
            }
          }
        }
        // if (waysNew.length > 0)
        //   addDrawingStyles(osmData.elements[i], waysNew);
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

  getSVGText(data, dataElem, mapWidth, mapHeight) {
    const getPos = coords => {
      const hPos = coords.x < 0 ? -1 : (coords.x > mapWidth ? 1 : 0);
      const vPos = coords.y < 0 ? -1 : (coords.y > mapHeight ? 1 : 0);
      return { h: hPos, v: vPos };
    };

    let output = '';
    if (dataElem.type === 'path' || dataElem.type === 'multipath') {
      output += '<path d="';
      const ways = dataElem.type === 'path' ? [ { pathIdx: dataElem.id, reverse: false } ] : dataElem.ids;
      let firstPt = null, lastPt = null;
      for (let k = 0; k < ways.length; k++) {
        const path = ways[k].reverse
          ? [...data.paths[ ways[k].pathIdx ]].reverse()
          : data.paths[ ways[k].pathIdx ];
        let contPath = false;
        if (k > 0) {
          if (ways[k - 1].endIdx == ways[k].startIdx) contPath = true;
        }
        for (let i = 0; i < path.length; i++) {
          if (i == 0 && !contPath) {
            if (firstPt != null && lastPt != null) {
              const lastPos = getPos(lastPt);
              const cPos = getPos(firstPt);
              if (Math.abs(cPos.h) + Math.abs(cPos.v) == 1 && Math.abs(lastPos.h) + Math.abs(lastPos.v) == 1
                  && (cPos.h == 0 && lastPos.h != 0 || cPos.v == 0 && lastPos.v != 0)) {
                const h = cPos.h == 0 ? lastPos.h : cPos.h;
                const v = cPos.v == 0 ? lastPos.v : cPos.v;
                const x = h == 1 ? mapWidth + 1 : -1;
                const y = v == 1 ? mapHeight + 1 : -1;
                output += (i == 0 && k == 0 ? 'M' : 'L') + `${s(x)} ${s(y)}`;
              }
            }
            firstPt = lastPt = null;
            output += 'M';
          } else output += 'L';
          output += `${s(path[i].x)} ${s(path[i].y)}`;
          if (firstPt === null) firstPt = path[i];
          lastPt = path[i];
        }
      }
      output += `"${this.toAttribs(dataElem.style)}${ways.length > 1 ? ' fill-rule="evenodd"' : ''} />`;
    }
    return output;
  }
}

module.exports = OSMParser;
