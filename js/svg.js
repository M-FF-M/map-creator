
const Files = require('./files');
const OSMParser = require('./osmparser');
const MapStyler = require('./mapstyler');

/**
 * @typedef {object} StyleObject styling object
 * @property {string} [stroke] stroke color
 * @property {string} [strokeWidth] stroke width
 * @property {string} [strokeLinecap] 'round', 'butt', or 'square'
 * @property {string} [strokeLinejoin] 'round', 'arcs', 'bevel', 'miter', or 'miter-clip'
 * @property {string} [strokeDasharray] see MDN (https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray)
 * @property {string} [fill] fill color
 * @property {string} [fillOpacity] 0 transparent to 1 opaque
 */

/**
 * @typedef {object} FeatureCategory feature category object
 * @property {string} type one of 'water', 'land', 'road', 'railway', 'building', 'poi'
 * @property {string} subtype many possible values inherited from OSM elements
 */

/**
 * @typedef {object} PathPoint point on a processed path
 * @property {number} x x-coordinate on the map
 * @property {number} y y-coordinate on the map
 * @property {string} [connection] connector; M for move and L for line
 */

/**
 * @typedef {object} ParsedFeature2 parsed feature object
 * @property {boolean} draw whether this feature should be drawn
 * @property {boolean} isArea whether this is an area feature
 * @property {boolean} isWay whether this feature presents a way / road / track / railway usable by humans
 * @property {boolean} isPath whether this is a path feature
 * @property {boolean} isPoint whether this is a point feature (point of interest)
 * @property {boolean} isTunnel whether this is a path represents a tunnel
 * @property {boolean} isBridge whether this is a path represents a bridge
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
  /**
   * Download and render an OSM map
   * @param {object} boundingBox the bounding box of the map (cannot be loaded from cache!)
   * @property {object} boundingBox.ll the lower left corner of the bounding box
   * @property {number} boundingBox.ll.lat the latitude of the lower left corner (in degrees)
   * @property {number} boundingBox.ll.lon the longitude of the lower left corner (in degrees)
   * @property {object} boundingBox.ur the upper right corner of the bounding box
   * @property {number} boundingBox.ur.lat the latitude of the upper right corner (in degrees)
   * @property {number} boundingBox.ur.lon the longitude of the upper right corner (in degrees)
   * @param {number} scale the map will be created with a scale of 1:scale
   * @param {object} [cacheSettings] settings for caching, see OSMParser.processMap()
   * @return {string} the SVG as a string
   */
  static async downloadAndRenderMap(boundingBox, scale, cacheSettings = {}) {
    const data = await OSMParser.downloadAndProcessMap(boundingBox, scale, cacheSettings);
    return SVGRenderer.getSVGText(data);
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
   * @return {string} the SVG as a string
   */
  static renderMap(osmData, boundingBox, scale, cacheSettings = {}) {
    console.log('Entering renderMap().');
    const data = OSMParser.processMap(osmData, boundingBox, scale, cacheSettings);
    return SVGRenderer.getSVGText(data);
  }

  /**
   * Convert drawing data to SVG text
   * @param {ProcessedData} data the processed OSM data, as returned by OSMParser.processMap()
   * @return {string} the corresponding SVG string
   */
  static getSVGText(data) {
    const styler = new MapStyler(data.scale, JSON.parse(Files.readFile('map-styles/development.json')),
      JSON.parse(Files.readFile('map-styles/shapes.json')));
    let output = '';
    let defstext = ''; let drawtext = ''; let defsid = 0; // defstext: in order to move paths drawn multiple times to <defs>
    output += `<svg version="1.1" viewBox="0 0 ${s(data.mapWidth)} ${s(data.mapHeight)}" width="${
      s(data.mapWidth)}cm" height="${s(data.mapHeight)}cm" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">`;
    drawtext += `<rect width="100%" height="100%"${SVGRenderer.toAttribs(styler.getBackgroundStyle())}/>`;

    const layers = [];
    for (let i = 0; i < styler.LAYER_NUM; i++)
      layers.push([]);
    for (let i = 0; i < data.features.length; i++) {
      const styles = styler.getPathStyle(data.features[i]);
      if (!data.features[i].isPoint && styles.length >= 2 && data.features[i].path.length >= 4) {
        const fcopy = { ...data.features[i] };
        fcopy.isMultiPath = false;
        defstext += SVGRenderer.getFeatureSVGText(fcopy, { id: `d${defsid++}` });
      }
      for (let k = 0; k < styles.length; k++) {
        if (styles[k].layer < 0)
          defstext += styles[k].defText;
        else
          layers[styles[k].layer].push( SVGRenderer.getFeatureSVGText(data.features[i], styles[k].style,
            data.features[i].isPoint || (styles.length >= 2 && data.features[i].path.length >= 4),
            data.features[i].isPoint ? styles[k].symbol : `d${defsid - 1}`,
            data.features[i].isPoint,
            styles[k].shift ? styles[k].shift : { x: 0, y : 0 }) );
      }
    }
    for (let l = 0; l < layers.length; l++) {
      for (let i = 0; i < layers[l].length; i++) {
        drawtext += layers[l][i];
      }
    }
    if (defstext.length > 0)
      output += `<defs>${defstext}</defs>`;
    output += drawtext;
    output += '</svg>';

    console.log(`SVG created (${Files.getSizeStr(output.length)}).`);
    return output;
  }

  /**
   * Convert CamelCase to connection by dashes (i.e. fillOpacity to fill-opacity)
   * @param {string} val the string in CamelCase
   * @return {string} the same string, now connected by dashes
   */
  static cCtoDashC(val) {
    return val.replace(/[A-Z]/g, '-$&').toLowerCase();
  }

  /**
   * Convert a style object to SVG attributes
   * @param {StyleObject} style the style object
   * @return {string} an SVG attribute string which can be inserted into a SVG tag
   */
  static toAttribs(style) {
    let ret = '';
    for (let prop in style) {
      if (style.hasOwnProperty(prop)) {
        ret += ` ${SVGRenderer.cCtoDashC(prop)}="${style[prop]}"`;
      }
    }
    return ret;
  }

  /**
   * Convert a feature to a SVG path element
   * @param {ParsedFeature2} feature the map feature
   * @param {StyleObject} style the corresponding styling information
   * @param {boolean} [useTag] if set to true, no <path> element but a <use> element will be created
   * @param {string} [useId] if useTag is true, this should specify the id of the corresponding element in <defs>
   * @param {boolean} [isPoint] whether this is a single point feature
   * @param {PathPoint} [shift] feature shift
   * @return {string} the SVG path element as a string
   */
  static getFeatureSVGText(feature, style, useTag = false, useId = '', isPoint = false, shift = { x: 0, y : 0 }) {
    if (!feature.draw)
      throw new Error('SVGRenderer.getFeatureSVGText(): only drawable features should be passed to this method!');
    
    let output = '';
    if (!useTag) {
      output += '<path d="';
      for (let i = 0; i < feature.path.length; i++)
        output += `${feature.path[i].connection}${s(feature.path[i].x + shift.x)} ${s(feature.path[i].y + shift.y)}`;
    } else {
      output += `<use xlink:href="#${useId}`;
      if (isPoint)
        output += `" x="${s(feature.path[0].x + shift.x)}" y="${s(feature.path[0].y + shift.y)}`
    }
    output += `"${SVGRenderer.toAttribs(style)}${feature.isMultiPath ? ' fill-rule="evenodd"' : ''} />`;
    return output;
  }
}

module.exports = SVGRenderer;
