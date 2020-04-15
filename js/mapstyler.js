
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
 * @typedef {object} DrawingInfo drawing information object
 * @property {number} layer the number of the layer on which the object should be drawn, increasing number <-> higher layers
 * @property {StyleObject} style the style the object should be drawn in
 */

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
 * @property {boolean} isTunnel whether this is a path represents a tunnel
 * @property {boolean} isBridge whether this is a path represents a bridge
 * @property {boolean} isMultiPath whether the path consists of multiple paths and must be filled with the even-odd rule
 * @property {FeatureCategory} info feature category information
 * @property {PathPoint[]} path the path representing the feature
 */

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
 * Class for calculating styles for given map features
 */
class MapStyler {
  /**
   * Initialize, in particular layer structure
   * @param {number} scale the map scale (influences layer order)
   */
  constructor(scale) {
    let cLayer = 0;
    /** @type {number} the buildings layer */
    this.BUILDINGS = 0;
    /** @type {number} the number of road layers */
    this.ROAD_LAYERS = 7;

    cLayer++; // land requires two layers
    /** @type {number} the land layer (layer below can also be used for land) */
    this.LAND = cLayer++;

    const wayStartLayer = cLayer;

    cLayer++; // water requires two layers
    /** @type {number} the water layer (layer below can also be used for water) */
    this.WATER = cLayer++;
    
    /** @type {number} the railway background layer for less important railways (under construction, disused etc.) */
    this.RAIL_BG2 = cLayer++;
    /** @type {number} the railway foreground layer for less important railways (under construction, disused etc.) */
    this.RAIL_FG2 = cLayer++;

    if (scale > 5000) this.BUILDINGS = cLayer++;

    /** @type {number} the road background layer (ROAD_LAYERS layers above can also be used for road background) */
    this.ROAD_BG = cLayer;
    cLayer += this.ROAD_LAYERS;
    /** @type {number} the road foreground layer (ROAD_LAYERS layers above can also be used for road foreground) */
    this.ROAD_FG = cLayer;
    cLayer += this.ROAD_LAYERS;

    /** @type {number} the railway background layer */
    this.RAIL_BG = cLayer++;
    /** @type {number} the railway foreground layer */
    this.RAIL_FG = cLayer++;

    if (scale <= 5000) this.BUILDINGS = cLayer++;

    /** @type {number} how many layers to subtract (tunnels) or add (bridges) for tunnels and bridges */
    this.TUNNEL_BRIDGE_OFFSET = cLayer - wayStartLayer;

    // adapt layer numbers (they currently represent the tunnel layer)
    this.WATER += this.TUNNEL_BRIDGE_OFFSET;
    this.RAIL_BG2 += this.TUNNEL_BRIDGE_OFFSET;
    this.RAIL_FG2 += this.TUNNEL_BRIDGE_OFFSET;
    this.BUILDINGS += this.TUNNEL_BRIDGE_OFFSET;
    this.ROAD_BG += this.TUNNEL_BRIDGE_OFFSET;
    this.ROAD_FG += this.TUNNEL_BRIDGE_OFFSET;
    this.RAIL_BG += this.TUNNEL_BRIDGE_OFFSET;
    this.RAIL_FG += this.TUNNEL_BRIDGE_OFFSET;

    /** @type {number} the total number of layers */
    this.LAYER_NUM = cLayer + 2 * this.TUNNEL_BRIDGE_OFFSET;
  }

  /**
   * Get the background style
   * @return {StyleObject} the background style
   */
  getBackgroundStyle() {
    return { fill: '#f2efe9' };
  }

  /**
   * Get the style for a map feature
   * @param {ParsedFeature2} elem feature element, as returned by OSMParser.processMap()
   * @return {DrawingInfo[]} each array entry specifies that elem.path should be drawn with the
   * given style on the given layer
   */
  getPathStyle(elem) {
    if (!elem.draw)
      throw new Error('MapStyler.getPathStyle(): only drawable features should be passed to this method!');

    const layerAdd = elem.isTunnel ? -this.TUNNEL_BRIDGE_OFFSET : (elem.isBridge ? this.TUNNEL_BRIDGE_OFFSET : 0);

    if (elem.info.type === 'road') {
      if (elem.info.subtype === 'track' || elem.info.subtype === 'footway'
          || elem.info.subtype === 'bridleway' || elem.info.subtype === 'steps'
          || elem.info.subtype === 'path' || elem.info.subtype === 'cycleway') {
        let pWidth = 0.03;
        let color = 'black';
        let dashed = '0.5';
        if (elem.info.subtype === 'track')
          { color = '#ac8327'; dashed = '0.16 0.04 0.08 0.04'; }
        if (elem.info.subtype === 'footway' || elem.info.subtype === 'path')
          { color = '#fc7f6f'; dashed = '0.08 0.04'; }
        if (elem.info.subtype === 'bridleway')
          { color = '#028102'; dashed = '0.16 0.04'; }
        if (elem.info.subtype === 'steps')
          { color = '#fc7f6f'; dashed = '0.04 0.02'; pWidth = 0.08; }
        if (elem.info.subtype === 'cycleway')
          { color = '#1111ff'; dashed = '0.08 0.04'; }
        return [
          { layer: this.ROAD_FG + layerAdd, style:
            { stroke: color, fillOpacity: '0', strokeWidth: s(pWidth),
              strokeDasharray: dashed } }
        ];
      }

      let bgWidth = 0.1;
      let fgWidth = 0.06;
      let outerColor = 'black';
      let innerColor = 'white';
      let rdLayer = 1;
      if (elem.info.subtype === 'motorway' || elem.info.subtype === 'motorway_link')
        { innerColor = '#e990a0'; outerColor = '#df2e6b'; rdLayer = 6;
          bgWidth = 0.14; fgWidth = 0.1; }
      if (elem.info.subtype === 'trunk' || elem.info.subtype === 'trunk_link')
        { innerColor = '#fbb29a'; outerColor = '#cd532e'; rdLayer = 5;
          bgWidth = 0.14; fgWidth = 0.1; }
      if (elem.info.subtype === 'primary' || elem.info.subtype === 'primary_link')
        { innerColor = '#fdd7a1'; outerColor = '#ab7b03'; rdLayer = 4;
          bgWidth = 0.14; fgWidth = 0.1; }
      if (elem.info.subtype === 'secondary' || elem.info.subtype === 'secondary_link')
        { innerColor = '#f6fabb'; outerColor = '#7c8900'; rdLayer = 3;
          bgWidth = 0.14; fgWidth = 0.1; }
      if (elem.info.subtype === 'tertiary' || elem.info.subtype === 'tertiary_link')
        { innerColor = '#fefefe'; outerColor = '#adadad'; rdLayer = 2;
          bgWidth = 0.14; fgWidth = 0.1; }
      if (elem.info.subtype === 'road')
        { innerColor = '#dddddd'; outerColor = '#c2c2c1'; }
      if (elem.info.subtype === 'unclassified')
        { innerColor = '#fefefe'; outerColor = '#c9c5c5'; }
      if (elem.info.subtype === 'residential')
        { innerColor = '#fefefe'; outerColor = '#c9c5c5'; }
      if (elem.info.subtype === 'living_street')
        { innerColor = '#ededed'; outerColor = '#c5c5c5'; }
      if (elem.info.subtype === 'service')
        { innerColor = '#fefefe'; outerColor = '#c9c5c5'; bgWidth = 0.08; fgWidth = 0.04; }
      if (elem.info.subtype === 'pedestrian')
        { innerColor = '#dddde9'; outerColor = '#a7a5a6'; }
      const retArr = [
        { layer: this.ROAD_BG + rdLayer + layerAdd, style:
          { stroke: outerColor, fillOpacity: '0', strokeWidth: s(bgWidth), strokeLinecap: elem.isBridge ? 'butt' : 'round', strokeLinejoin: 'round' } },
        { layer: this.ROAD_FG + rdLayer + layerAdd, style:
          { stroke: innerColor, fillOpacity: '0', strokeWidth: s(fgWidth), strokeLinecap: 'round', strokeLinejoin: 'round' } }
      ];
      if (elem.isTunnel) {
        retArr[0].style.strokeOpacity = '0.3';
        retArr[1].style.strokeOpacity = '0.3';
      } else if (elem.isBridge) {
        // retArr[0].layer -= layerAdd;
        retArr[0].style.stroke = 'black';
      }
      return retArr;
    }

    if (elem.info.type === 'railway') {
      let outerColor = '#707070';
      let innerColor = '#ededed';
      let layerBg = this.RAIL_FG; // this.RAIL_BG;
      let layerFg = this.RAIL_FG;
      if (elem.info.subtype === 'construction' || elem.info.subtype === 'disused'
          || (elem.info.service && (elem.info.service === 'crossover'
            || elem.info.service === 'siding'|| elem.info.service === 'spur'|| elem.info.service === 'yard'))) {
        outerColor = '#acabab';
        innerColor = '#f2f1f1';
        layerBg = this.RAIL_FG2; // this.RAIL_BG2;
        layerFg = this.RAIL_FG2;
      }
      const retArr = [
        { layer: layerBg + layerAdd, style:
          { stroke: outerColor, fillOpacity: '0', strokeWidth: '0.09' } },
        { layer: layerFg + layerAdd, style:
          { stroke: innerColor, fillOpacity: '0', strokeWidth: '0.05', strokeDasharray: '0.25' } }
      ];
      if (elem.isTunnel) {
        retArr[0].style.strokeOpacity = '0.5';
        retArr[1].style.strokeOpacity = '0.5';
      }
      return retArr;
    }

    if (elem.info.type === 'building') {
      return [
        { layer: this.BUILDINGS + layerAdd, style:
          { fill: '#d9d0c9', stroke: '#c5b8ac', strokeWidth: '0.02', strokeLinecap: 'round', strokeLinejoin: 'round' } }
      ];
    }

    if (elem.info.type === 'water') {
      if (elem.isPath) {
        if (elem.info.subtype === 'riverbank') {
          return [
            { layer: this.WATER + layerAdd, style: { fill: '#abd4e0' } }
          ];
        } else if (elem.info.subtype === 'river'
            || elem.info.subtype === 'riverbank' || elem.info.subtype === 'stream'
            || elem.info.subtype === 'canal' || elem.info.subtype === 'drain'
            || elem.info.subtype === 'ditch') {
          if (elem.info.subtype === 'canal') {
            return [
              { layer: this.WATER - 1 + layerAdd, style:
                { stroke: '#7d9ba4', fillOpacity: '0', strokeWidth: '0.12', strokeLinecap: 'round', strokeLinejoin: 'round' } },
              { layer: this.WATER + layerAdd, style:
                { stroke: '#abd4e0', fillOpacity: '0', strokeWidth: '0.08', strokeLinecap: 'round', strokeLinejoin: 'round' } }
            ];
          } else {
            let pWidth = 0.05;
            if (elem.info.subtype === 'drain' || elem.info.subtype === 'ditch') pWidth = 0.03;
            if (elem.info.subtype === 'river') pWidth = 0.08;
            return [
              { layer: this.WATER + layerAdd, style:
                { stroke: '#abd4e0', fillOpacity: '0', strokeWidth: s(pWidth), strokeLinecap: 'round', strokeLinejoin: 'round' } }
            ];
          }
        }
      }

      if (elem.isArea) {
        if (elem.info.subtype === 'water' || elem.info.subtype === 'spring'
            || elem.info.subtype === 'hot_spring' || elem.info.subtype === 'blowhole')
          return [ { layer: this.WATER + layerAdd, style: { fill: '#abd4e0' } } ];
        if (elem.info.subtype === 'basin')
          return [ { layer: this.WATER + layerAdd, style: { fill: '#b4d0d1' } } ];
        if (elem.info.subtype === 'salt_pond')
          return [ { layer: this.WATER + layerAdd, style: { fill: '#e7e6e2' } } ];
      }
    }

    if (elem.info.type === 'land') {
      let color = 'none'; let add = 0;
      if (elem.info.subtype === 'wood') { color = '#9dca8a'; add = -1; }
      if (elem.info.subtype === 'scrub') color = '#c9d8ad';
      if (elem.info.subtype === 'heath') color = '#d6d99f';
      if (elem.info.subtype === 'grassland') color = '#ceecb2';
      if (elem.info.subtype === 'fell') color = '#ceecb2';
      if (elem.info.subtype === 'bare_rock') color = '#ede4dc';
      if (elem.info.subtype === 'scree') color = '#ede4dc';
      if (elem.info.subtype === 'shingle') color = '#ede4dc';
      if (elem.info.subtype === 'sand') color = '#f0e5c2';
      if (elem.info.subtype === 'mud') color = '#e7ddd3';
      if (elem.info.subtype === 'wetland') color = '#e7ddd3';
      if (elem.info.subtype === 'glacier') color = '#deeded';
      if (elem.info.subtype === 'beach') color = '#fff1bb';
      if (elem.info.subtype === 'commercial') color = '#eecfcf';
      if (elem.info.subtype === 'construction') color = '#c7c7b4';
      if (elem.info.subtype === 'industrial') color = '#e6d1e3';
      if (elem.info.subtype === 'residential') color = '#dadada';
      if (elem.info.subtype === 'retail') color = '#fecac5';
      if (elem.info.subtype === 'allotments') color = '#cae2c0';
      if (elem.info.subtype === 'brownfield') color = '#b6b690';
      if (elem.info.subtype === 'cemetery') color = '#abccb0';
      if (elem.info.subtype === 'farmland') color = '#eff0d6';
      if (elem.info.subtype === 'farmyard') color = '#eacca4';
      if (elem.info.subtype === 'forest') { color = '#9dca8a'; add = -1; }
      if (elem.info.subtype === 'garages') color = '#deddcc';
      if (elem.info.subtype === 'grass') color = '#cfeda5';
      if (elem.info.subtype === 'greenfield') color = '#f1eee8';
      if (elem.info.subtype === 'greenhouse_horticulture') color = '#eff0d6';
      if (elem.info.subtype === 'landfill') color = '#b6b690';
      if (elem.info.subtype === 'meadow') color = '#ceecb1';
      if (elem.info.subtype === 'military') color = '#f3e4de';
      if (elem.info.subtype === 'orchard') color = '#9edc90';
      if (elem.info.subtype === 'plant_nursery') color = '#b0e1a5';
      if (elem.info.subtype === 'quarry') color = '#b7b5b5';
      if (elem.info.subtype === 'railway') color = '#e6d1e3';
      if (elem.info.subtype === 'recreation_ground') color = '#cfeda5';
      if (elem.info.subtype === 'religious') color = '#cecdca';
      if (elem.info.subtype === 'reservoir') color = '#abd4e0';
      if (elem.info.subtype === 'village_green') color = '#ceecb1';
      if (elem.info.subtype === 'vineyard') color = '#9edc90';
      if (color !== 'none')
        return [ { layer: this.LAND + add + layerAdd, style: { fill: color } } ];
      else
        return [];
    }

    return [];
  }
}

module.exports = MapStyler;
