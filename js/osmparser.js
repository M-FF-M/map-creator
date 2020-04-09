
const GeoTools = require('./geotools');
const OverpassRequest = require('./overpass');
const Files = require('./files');
const FeatureParser = require('./featureparser');
const merc = require('mercator-projection');
const simplify = require('simplify-js');

/**
 * @typedef {object} FeatureCategory feature category object
 * @property {string} type one of 'water', 'land', 'road', 'railway', 'building'
 * @property {string} subtype many possible values inherited from OSM elements
 */

/**
 * @typedef {object} PathPoint point on a processed path
 * @property {number} x x-coordinate on the map
 * @property {number} y y-coordinate on the map
 * @property {string} connection connector; M for move and L for line
 */

/**
 * @typedef {object} ParsedFeature2 parsed feature object
 * @property {boolean} draw whether this feature should be drawn
 * @property {boolean} isArea whether this is an area feature
 * @property {boolean} isWay whether this feature presents a way / road / track / railway usable by humans
 * @property {boolean} isPath whether this is a path feature
 * @property {boolean} isMultiPath whether the path consists of multiple paths and must be filled with the even-odd rule
 * @property {FeatureCategory} info feature category information
 * @property {PathPoint[]} path the path representing the feature
 */

/**
 * @typedef {object} ProcessedData processed OSM data for drawing
 * @property {number} timestamp date processed data was created (milliseconds)
 * @property {string} osmTime date OSM data was downloaded, if available (YYYY-MM-DD T HH:MM:SS Z)
 * @property {ParsedFeature2[]} features all the features which should be drawn
 * @property {number} mapWidth map with (in cm)
 * @property {number} mapHeight map height (in cm)
 * @property {number} scale map scale
 * @property {number} left left map boundary (mercator projection x value)
 * @property {number} right right map boundary (mercator projection x value)
 * @property {number} top top map boundary (mercator projection y value)
 * @property {number} bottom bottom map boundary (mercator projection y value)
 */

/**
 * Returns the minimum of the given arguments
 * @param {number[]} args the values among which to choose the minimum
 * @return {number} the minimal value
 */
function min(...args) {
  let res = Infinity;
  for (let i = 0; i < args.length; i++)
    if (args[i] < res) res = args[i];
  return res;
}

/**
 * Returns the maximum of the given arguments
 * @param {number[]} args the values among which to choose the maximum
 * @return {number} the maximal value
 */
function max(...args) {
  let res = -Infinity;
  for (let i = 0; i < args.length; i++)
    if (args[i] > res) res = args[i];
  return res;
}

/**
 * Convert a number to a string
 * @param {number} num the number to convert
 * @param {number} [digits] the desired number of digits after the decimal point, default is 2
 * @return {string} the converted number
 */
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

/**
 * Round a number to a certain number of digits after the decimal point
 * @param {number} num the number to round
 * @param {number} [digits] the desired number of digits after the decimal point, default is 2
 * @return {number} the rounded number
 */
function d(num, digits = 2) {
  if (digits == 2)
    return Math.round(num * 100) / 100;
  else 
    return Math.round(num * Math.pow(10, digits)) / Math.pow(10, digits);
}

/**
 * Class which converts the data gathered from OSM to a simpler format for better processing
 */
class OSMParser {
  /**
   * Download and process OSM data
   * @param {object} boundingBox the bounding box of the map (cannot be loaded from cache!)
   * @property {object} boundingBox.ll the lower left corner of the bounding box
   * @property {number} boundingBox.ll.lat the latitude of the lower left corner (in degrees)
   * @property {number} boundingBox.ll.lon the longitude of the lower left corner (in degrees)
   * @property {object} boundingBox.ur the upper right corner of the bounding box
   * @property {number} boundingBox.ur.lat the latitude of the upper right corner (in degrees)
   * @property {number} boundingBox.ur.lon the longitude of the upper right corner (in degrees)
   * @param {number} scale the map will be created with a scale of 1:scale
   * @param {object} [cacheSettings] settings for caching, see OSMParser.processMap()
   * @return {ProcessedData} processed OSM data for drawing
   */
  static async downloadAndProcessMap(boundingBox, scale, cacheSettings = {}) {
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
    return OSMParser.processMap(osmData, boundingBox, scale, cacheSettings);
  }
  
  /**
   * Process OSM data
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
   * @return {ProcessedData} processed OSM data for drawing
   */
  static processMap(osmData, boundingBox, scale, cacheSettings = {}) {
    console.log('Entering OSMParser.processMap().');
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

    const data = cachedData !== null ? cachedData : OSMParser.getProcessedData(osmData, toMapCoords, mapWidth, mapHeight);
    data.mapWidth = mapWidth;
    data.mapHeight = mapHeight;
    data.scale = scale;
    data.left = left;
    data.right = right;
    data.top = top;
    data.bottom = bottom;

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

  /**
   * Process OSM data with function for map coordinates already given
   * @param {object} osmData JSON data returned by a request to the Overpass API
   * @param {function} toMapCoords function taking latitude as 1st, longitude as 2nd argument and
   * returning an array with x-coordinate on map at 1st, y-coordinate on map at 2nd position
   * @param {number} mapWidth the width of the map in cm
   * @param {number} mapHeight the height of the map in cm
   * @return {ProcessedData} processed OSM data for drawing
   */
  static getProcessedData(osmData, toMapCoords, mapWidth, mapHeight) {
    const ret = { paths: [], features: [], timestamp: (new Date()).getTime() };
    if (osmData.osm3s && osmData.osm3s.timestamp_osm_base)
      ret.osmTime = osmData.osm3s.timestamp_osm_base;
    
    const ndMap = {}; const wayMap = {}; const relMap = {}; const relWays = {};
      // ndMap: node id -> index in osmData.elements, wayMap, relMap,
      // relWays: OSM id -> true (this is a way which will be drawn as part of a relation) / false
    const pathEnds = []; // saves end and start node ids for paths in ret.paths (as an object {start: id, end: id})
      // ids are indices in osmData.elements
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

    // ############### check relations ###############
    let pBef = 0; let pAft = 0; // points before and after simplification
    for (let i = 0; i < osmData.elements.length; i++) {
      if (FeatureParser.shouldDisplayRelation(osmData.elements[i])) { // if relation should be shown on map
        for (let k = 0; k < osmData.elements[i].members.length; k++) {
          if (osmData.elements[i].members[k].type === 'way')
            relWays[osmData.elements[i].members[k].ref] = true; // as part of a visible relation, this way should be processed
        }
      }
    }

    // ############### check ways ###############
    for (let i = 0; i < osmData.elements.length; i++) {
      if (FeatureParser.shouldCreatePath(osmData.elements[i], relWays)) { // if path should be processed
        const pIdx = ret.paths.length; // new path index
        ret.paths.push([]); pathEnds.push({});
        for (let k = 0; k < osmData.elements[i].nodes.length; k++) {
          const nodeIdx = ndMap[ osmData.elements[i].nodes[k] ];
          if (nodeIdx) {
            const coords = toMapCoords(osmData.elements[nodeIdx].lat, osmData.elements[nodeIdx].lon);
            ret.paths[pIdx].push({ x: coords[0], y: coords[1] }); // add coordinates to path
            if (ret.paths[pIdx].length == 1) pathEnds[pIdx].start = nodeIdx; // adapt start node index in pathEnds
            pathEnds[pIdx].end = nodeIdx; // adapt end node index in pathEnds
          }
        }
        pBef += ret.paths[pIdx].length; // point counter before simplification
        ret.paths[pIdx] = simplify(ret.paths[pIdx], 0.02); // path simplification
        pAft += ret.paths[pIdx].length; // point counter after simplification
        if (ret.paths[pIdx].length > 0) {
          const feature = FeatureParser.parseFeature(osmData.elements[i]);
          if (feature.draw) { // if element should be drawn, add path to features array
            feature.path = []; feature.isMultiPath = false;
            for (let j = 0; j < ret.paths[pIdx].length; j++) // add coordinates / connector M for move, L for line
              feature.path.push({ connection: j == 0 ? 'M' : 'L', x: d(ret.paths[pIdx][j].x), y: d(ret.paths[pIdx][j].y) });
            ret.features.push(feature);
          }
          relWays[osmData.elements[i].id] = pIdx; // map OSM path id to the index in the ret.paths array
        }
      }
    }

    // ############### process relations and the corresponding ways; in particular adapt order and orientation of ways appropriately ###############
    for (let i = 0; i < osmData.elements.length; i++) {
      if (FeatureParser.shouldDisplayRelation(osmData.elements[i])) { // if relation should be shown on map
        const ways = []; // will be filled with objects describing the corresponding ways (corresponding to the relation)
        const nodeIdxMap = {}; // nodeIdxMap[ index in osmData.elements ] = [ {path ending in this node}, ... ]
        const idxMap = {}; // idxMap[ index in ways ] = true / false (true: was not yet inserted into waysNew, see below)

        for (let k = 0; k < osmData.elements[i].members.length; k++) { // iterate through members
          if (osmData.elements[i].members[k].type === 'way') {
            if (typeof relWays[osmData.elements[i].members[k].ref] === 'number') { // if path should be processed
              const pathIdx = relWays[osmData.elements[i].members[k].ref]; // index in osmData.elements
              if (!(nodeIdxMap[ pathEnds[pathIdx].start ] instanceof Array)) // initialize, if necessary
                nodeIdxMap[ pathEnds[pathIdx].start ] = [];
              if (!(nodeIdxMap[ pathEnds[pathIdx].end ] instanceof Array))
                nodeIdxMap[ pathEnds[pathIdx].end ] = [];
              nodeIdxMap[ pathEnds[pathIdx].start ].push({ idx: ways.length, start: true }); // save that way ends in its end nodes
              nodeIdxMap[ pathEnds[pathIdx].end ].push({ idx: ways.length, start: false });
                // idx: index of way in ways / start: true / false (whether the way starts or ends in this node)
              idxMap[ways.length] = true; // initialize
              ways.push( { pathIdx, reverse: false,
                startIdx: pathEnds[pathIdx].start, endIdx: pathEnds[pathIdx].end } );
                // pathIdx: index in ret.paths
                // reverse: whether to traverse path in reverse order
                // startIdx, endIdx: indices of start and end nodes (will be adapted accordingly if reverse is true!)
            }
          }
        }

        const waysNew = []; // way array with new, appropriate order
        // sorting (and potentially reversing) all the ways / paths in order to draw them in the right order
        for (let j = 0; j < ways.length; j++) {
          if (idxMap[j]) { // if not yet processed
            let cidx = j; let cidxRev = cidx; // index in ways; cidx: for going forward, cidxRev: for going backward
            let creversed = false, creversedRev = false; // whether the current way should be reversed; for forward / backward
            idxMap[cidx] = false; // path is processed now
            waysNew.push(ways[cidx]); // insert in new way array
            const constidx = waysNew.length - 1; // current index in waysNew, saved for later

            for (let phase = 0; phase < 2; phase++) {
              // phases: 0: look for previous paths, 1: look for following paths
              while (nodeIdxMap[ phase == 0
                  ? (creversedRev ? pathEnds[ ways[cidxRev].pathIdx ].end : pathEnds[ ways[cidxRev].pathIdx ].start)
                  : (creversed ? pathEnds[ ways[cidx].pathIdx ].start : pathEnds[ ways[cidx].pathIdx ].end) ]
                  instanceof Array) { // as long as the current end node is listed in nodeIdxMap
                const ndMpIdx = phase == 0
                  ? (creversedRev ? pathEnds[ ways[cidxRev].pathIdx ].end : pathEnds[ ways[cidxRev].pathIdx ].start)
                  : (creversed ? pathEnds[ ways[cidx].pathIdx ].start : pathEnds[ ways[cidx].pathIdx ].end);
                  // current end node, depending on backward or forward direction and whether the current path is reversed
                let residx = -1; // index in nodeIdxMap[ndMpIdx] specifying which path can be connected to the current end
                for (let aidx = 0; aidx < nodeIdxMap[ndMpIdx].length; aidx++) {
                  if (idxMap[ nodeIdxMap[ndMpIdx][aidx].idx ]) { // if unprocessed path is found
                    residx = aidx;
                    break;
                  }
                }
                if (residx != -1) { // if path which can be connected was found
                  const nidx = nodeIdxMap[ndMpIdx][residx].idx; // index of new path
                  let nreversed = phase == 0
                    ? (nodeIdxMap[ndMpIdx][residx].start ? true : false)
                    : (nodeIdxMap[ndMpIdx][residx].start ? false : true); // whether the new path must be reversed to fit
                  idxMap[nidx] = false; // path is processed now
                  ways[nidx].reverse = nreversed; // adapt reverse variable
                  if (nreversed) { // adapt startIdx / endIdx for reversed case
                    ways[nidx].startIdx = pathEnds[ ways[nidx].pathIdx ].end;
                    ways[nidx].endIdx = pathEnds[ ways[nidx].pathIdx ].start;
                  }
                  if (phase == 0) {
                    waysNew.splice(constidx, 0, ways[nidx]); // phase = 0 -> insert before current path
                    cidxRev = nidx;
                    creversedRev = nreversed;
                  } else {
                    waysNew.push(ways[nidx]); // phase = 1 -> insert after current path
                    cidx = nidx;
                    creversed = nreversed;
                  }
                } else {
                  break; // no (unprocessed) connecting path available anymore
                }
              }
            }
          }
        }

        const feature = FeatureParser.parseFeature(osmData.elements[i]);
        if (feature.draw) { // if element should be drawn, add path to features array
          const getPos = coords => { // get position relative to map (above, left, right, ...)
            const hPos = coords.x < 0 ? -1 : (coords.x > mapWidth ? 1 : 0);
            const vPos = coords.y < 0 ? -1 : (coords.y > mapHeight ? 1 : 0);
            return { h: hPos, v: vPos };
          };

          feature.path = []; feature.isMultiPath = (waysNew.length > 1);
          let firstPt = null, lastPt = null; // firstPt = first point of current continuous path section / lastPt
          for (let k = 0; k <= waysNew.length; k++) {
            // k = waysNew.length -> dummy path to still execute slanting cut-off prevention below
            const path = (k == waysNew.length) ? [{ x: -1, y: -1 }] : (
              waysNew[k].reverse
              ? [...ret.paths[ waysNew[k].pathIdx ]].reverse()
              : ret.paths[ waysNew[k].pathIdx ] ); // current path
            let contPath = false; // whether the path seamlessly continues the previous one
            if (k > 0) {
              if (waysNew[k - 1].endIdx == ((k == waysNew.length) ? -1 : waysNew[k].startIdx)) contPath = true;
            }
            for (let i = 0; i < path.length; i++) {
              let connection = 'L'; // connector: L for line, M for move
              if (i == 0 && !contPath) { // if at beginning of current path which does not continue previous one
                if (firstPt != null && lastPt != null) { // first and last points have already been determined
                  const lastPos = getPos(lastPt);
                  const cPos = getPos(firstPt);
                  if (Math.abs(cPos.h) + Math.abs(cPos.v) == 1 && Math.abs(lastPos.h) + Math.abs(lastPos.v) == 1
                      && (cPos.h == 0 && lastPos.h != 0 || cPos.v == 0 && lastPos.v != 0)) {
                    // if first and last point are both outside of the map, and lie closest to two
                    // neighboring sides of the map: insert point at the corner to prevent rendering
                    // of slanting cut-offs in the corners of the map
                    const h = cPos.h == 0 ? lastPos.h : cPos.h;
                    const v = cPos.v == 0 ? lastPos.v : cPos.v;
                    const x = h == 1 ? mapWidth + 1 : -1;
                    const y = v == 1 ? mapHeight + 1 : -1;
                    feature.path.push({ connection: i == 0 && k == 0 ? 'M' : 'L', x: d(x), y: d(y) });
                    feature.path.push({ connection: 'L', x: d(firstPt.x), y: d(firstPt.y) });
                  }
                }
                firstPt = lastPt = null; // reset
                connection = 'M'; // next follows a new path which should not be connected with a line
              }
              if (k < waysNew.length) feature.path.push({ connection, x: d(path[i].x), y: d(path[i].y) });
              if (firstPt === null) firstPt = path[i];
              lastPt = path[i];
            }
          }
          ret.features.push(feature);
        }
      }
    }

    console.log(`Path simplification: number of original nodes was ${pBef}, reduced to ${pAft} nodes.`);
    delete ret.paths; // paths will not be needed anymore
    ret.features.sort((a, b) => { // sort to influence drawing order: large areas -> small areas -> short ways -> long ways
      const aval = (a.isArea ? -1 : 1) * a.path.length;
      const bval = (b.isArea ? -1 : 1) * b.path.length;
      return aval - bval;
    });
    return ret;
  }
}

module.exports = OSMParser;
