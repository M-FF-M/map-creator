
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
 * @typedef {object} DrawingInfo drawing information object
 * @property {number} layer the number of the layer on which the object should be drawn, increasing number <-> higher layers
 * @property {string} [symbol] the id of the symbol which should be drawn
 * @property {PathPoint} [shift] symbol offset
 * @property {StyleObject} [style] the style the object should be drawn in
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
   * @param {object} styling a styling object (loaded from a JSON file)
   * @param {object} shapes an object containing shapes (loaded from a JSON file)
   */
  constructor(scale, styling, shapes) {
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

    cLayer += 2 * this.TUNNEL_BRIDGE_OFFSET;
    
    /** @type {number} the point of interest layer */
    this.POI = cLayer++;

    /** @type {number} the total number of layers */
    this.LAYER_NUM = cLayer;

    /** @type {object} the object describing how to style the map features */
    this.STYLING = styling;
    /** @type {object} the object describing shapes for map features */
    this.SHAPES = shapes;
    /** @type {object} mapping shapes to false / true (<- shape was already used) */
    this.usedShapeMap = {};
    /** @type {object} mapping pattern shapes to false / true (<- shape was already used for a pattern) */
    this.usedPatternMap = {};

    /** @type {string} bridge color (lines on the side of the bridge) */
    this.BRIDGE_COLOR = '#000000';
    /** @type {string} bridge color (color on top of bridge) */
    this.BRIDGE_FG_COLOR = '#dddddd';
    /** @type {number} tunnel opacity */
    this.TUNNEL_OPACITY = 0.3;
    /** @type {string} map background color */
    this.BACKGROUND_COLOR = '#f2efe9';

    for (let i = 0; i < this.STYLING.rules.length; i++) {
      if (this.STYLING.rules[i].type === 'background')
        this.BACKGROUND_COLOR = this.STYLING.rules[i].color;
      if (this.STYLING.rules[i].type === 'bridge') {
        this.BRIDGE_COLOR = this.STYLING.rules[i].color;
        this.BRIDGE_FG_COLOR = this.STYLING.rules[i].foregroundColor;
      }
      if (this.STYLING.rules[i].type === 'tunnel')
        this.TUNNEL_OPACITY = this.STYLING.rules[i].opacity;
    }
  }

  /**
   * Get the background style
   * @return {StyleObject} the background style
   */
  getBackgroundStyle() {
    return { fill: this.BACKGROUND_COLOR };
  }

  /**
   * Get the layer corresponding to a description
   * @param {string} layerDescription the layer description, e.g. 'ROAD-DEFAULT' (see source code
   * for all available descriptions)
   * @return {number} the corresponding layer number
   */
  getLayer(layerDescription) {
    switch (layerDescription) {
      case 'ROAD-PATH' : return this.ROAD_FG;
      case 'ROAD-PATH-BG' : return this.ROAD_BG;
      case 'ROAD-DEFAULT' : return this.ROAD_FG + 1;
      case 'ROAD-DEFAULT-BG' : return this.ROAD_BG + 1;
      case 'ROAD-TERTIARY' : return this.ROAD_FG + 2;
      case 'ROAD-TERTIARY-BG' : return this.ROAD_BG + 2;
      case 'ROAD-SECONDARY' : return this.ROAD_FG + 3;
      case 'ROAD-SECONDARY-BG' : return this.ROAD_BG + 3;
      case 'ROAD-PRIMARY' : return this.ROAD_FG + 4;
      case 'ROAD-PRIMARY-BG' : return this.ROAD_BG + 4;
      case 'ROAD-TRUNK' : return this.ROAD_FG + 5;
      case 'ROAD-TRUNK-BG' : return this.ROAD_BG + 5;
      case 'ROAD-MOTORWAY' : return this.ROAD_FG + 6;
      case 'ROAD-MOTORWAY-BG' : return this.ROAD_BG + 6;
      case 'RAILWAY' : return this.RAIL_FG;
      case 'RAILWAY-BG' : return this.RAIL_BG;
      case 'RAILWAY-MINOR' : return this.RAIL_FG2;
      case 'RAILWAY-MINOR-BG' : return this.RAIL_BG2;
      case 'BUILDING' : return this.BUILDINGS;
      case 'WATER' : return this.WATER;
      case 'WATER-BG' : return this.WATER - 1;
      case 'LAND' : return this.LAND;
      case 'LAND-BG' : return this.LAND - 1;
      case 'POI' : return this.POI;
    }
    throw new Error(`MapStyler.getLayer(): layer description '${layerDescription}' unknown`);
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

    // determine styling for given element
    let cstyle = this.STYLING;
    while (cstyle !== null && !cstyle.layer) {
      let crules = cstyle.rules;
      let defaultval = null; let matchingval = null; // default: fallback styling, matching: styling for given element
      for (let i = 0; i < crules.length; i++) {
        if (crules[i].isDefault) defaultval = crules[i]; // fallback styling
        if (crules[i].type && (crules[i].type instanceof Array)) {
          if (crules[i].type.includes(elem.info.type)) matchingval = crules[i]; // if any of the types is given in the rule: match
        } else if (crules[i].type && (typeof crules[i].type === 'string')) {
          if (crules[i].type === elem.info.type) matchingval = crules[i]; // if this type is given in the rule: match
        }
        if (crules[i].subtype && (crules[i].subtype instanceof Array)) {
          if (crules[i].subtype.includes(elem.info.subtype)) matchingval = crules[i]; // if any of the subtypes is given in the rule: match
        } else if (crules[i].subtype && (typeof crules[i].subtype === 'string')) {
          if (crules[i].subtype === elem.info.subtype) matchingval = crules[i]; // if this subtype is given in the rule: match
        }
        if (crules[i].service && (crules[i].service instanceof Array)) {
          if (elem.info.service && crules[i].service.includes(elem.info.service)) matchingval = crules[i]; // if any of the services is given in the rule: match
        } else if (crules[i].service && (typeof crules[i].service === 'string')) {
          if (elem.info.service && crules[i].service === elem.info.service) matchingval = crules[i]; // if this service is given in the rule: match
        }
        if (crules[i].surface && (crules[i].surface instanceof Array)) {
          if (elem.info.surface && crules[i].surface.includes(elem.info.surface)) matchingval = crules[i]; // if any of the surfaces is given in the rule: match
        } else if (crules[i].surface && (typeof crules[i].surface === 'string')) {
          if (elem.info.surface && crules[i].surface === elem.info.surface) matchingval = crules[i]; // if this surface is given in the rule: match
        }
      }
      if (matchingval !== null) cstyle = matchingval;
      else cstyle = defaultval;
    }

    if (cstyle !== null) {
      const layer = this.getLayer(cstyle.layer);
      let layerBg = layer;
      const layerAdd = (elem.info.type === 'road' || elem.info.type === 'railway' || elem.info.type === 'water')
        ? ( elem.isTunnel ? -this.TUNNEL_BRIDGE_OFFSET : (elem.isBridge ? this.TUNNEL_BRIDGE_OFFSET : 0) )
        : 0;
      let retArr = [];

      if (cstyle.line) { // "line" : { "color" : "#abd4e0", "width" : 0.12 }
        retArr = [
          { layer: layer + layerAdd, style:
            { stroke: cstyle.line.color, fillOpacity: '0', strokeWidth: s(cstyle.line.width), strokeLinecap: 'round', strokeLinejoin: 'round' } }
        ]
        if (elem.isTunnel) {
          retArr[0].style.strokeOpacity = s(this.TUNNEL_OPACITY);
        } else if (elem.isBridge) {
          retArr.splice(0, 0,
            { layer: layerBg + layerAdd, style:
              { stroke: this.BRIDGE_COLOR, fillOpacity: '0', strokeWidth: s(cstyle.line.width + 0.04) } });
        }

      } else if (cstyle.dashedLine) { // "dashedLine" : { "color" : "#ac8327", "dash" : "0.16 0.04 0.08 0.04", "width" : 0.03 }
        retArr = [
          { layer: layer + layerAdd, style:
            { stroke: cstyle.dashedLine.color, fillOpacity: '0', strokeWidth: s(cstyle.dashedLine.width),
              strokeDasharray: cstyle.dashedLine.dash } }
        ];
        if (elem.isTunnel) {
          retArr[0].style.strokeOpacity = s(this.TUNNEL_OPACITY);
        } else if (elem.isBridge) {
          retArr.splice(0, 0,
            { layer: layerBg + layerAdd, style:
              { stroke: this.BRIDGE_COLOR, fillOpacity: '0', strokeWidth: s(cstyle.dashedLine.width + 0.04) } },
            { layer: layerBg + layerAdd, style:
              { stroke: this.BRIDGE_FG_COLOR, fillOpacity: '0', strokeWidth: s(cstyle.dashedLine.width),
                strokeLinecap: 'round' } });
        }

      } else if (cstyle.borderedLine) { // "borderedLine" : { "innerColor" : "#dddde9", "outerColor": "#a7a5a6", "innerWidth" : 0.06, "outerWidth" : 0.1 }
        layerBg = this.getLayer(`${cstyle.layer}-BG`);
        retArr = [
          { layer: layerBg + layerAdd, style:
            { stroke: cstyle.borderedLine.outerColor, fillOpacity: '0', strokeWidth: s(cstyle.borderedLine.outerWidth),
              strokeLinecap: 'round', strokeLinejoin: 'round' } },
          { layer: layer + layerAdd, style:
            { stroke: cstyle.borderedLine.innerColor, fillOpacity: '0', strokeWidth: s(cstyle.borderedLine.innerWidth),
              strokeLinecap: 'round', strokeLinejoin: 'round' } }
        ];
        if (elem.isTunnel) {
          retArr[0].style.strokeOpacity = s(this.TUNNEL_OPACITY);
          retArr[1].style.strokeOpacity = s(this.TUNNEL_OPACITY);
        } else if (elem.isBridge) {
          retArr[0].style.stroke = this.BRIDGE_COLOR;
          delete retArr[0].style.strokeLinecap;
        }

      } else if (cstyle.dashedBorderedLine) { // "dashedBorderedLine" : { "innerColor" : "#acabab", "outerColor" : "#f2f1f1", "dash" : "0.25", "innerWidth" : 0.05, "outerWidth" : 0.09 }
        layerBg = this.getLayer(`${cstyle.layer}-BG`);
        retArr = [
          { layer: layerBg + layerAdd, style:
            { stroke: cstyle.dashedBorderedLine.outerColor, fillOpacity: '0', strokeWidth: s(cstyle.dashedBorderedLine.outerWidth) } },
          { layer: layer + layerAdd, style:
            { stroke: cstyle.dashedBorderedLine.outerColor, fillOpacity: '0', strokeWidth: s(cstyle.dashedBorderedLine.innerWidth) } },
          { layer: layer + layerAdd, style:
            { stroke: cstyle.dashedBorderedLine.innerColor, fillOpacity: '0', strokeWidth: s(cstyle.dashedBorderedLine.innerWidth),
              strokeDasharray: cstyle.dashedBorderedLine.dash } }
        ];
        if (elem.info.type !== 'railway')
          retArr.splice(1, 1);
        if (elem.isTunnel) {
          retArr[0].style.strokeOpacity = s(this.TUNNEL_OPACITY);
          retArr[1].style.strokeOpacity = s(this.TUNNEL_OPACITY);
        } else if (elem.isBridge) {
          retArr[0].style.stroke = this.BRIDGE_COLOR;
          delete retArr[0].style.strokeLinecap;
        }

      } else if (cstyle.area) { // "area" : { "color" : "#abd4e0" }
        retArr = [
          { layer: layer + layerAdd, style: { fill: cstyle.area.color } }
        ];
        

      } else if (cstyle.borderedArea) { // "borderedArea" : { "areaColor" : "#d9d0c9", "borderColor": "#c5b8ac", "borderWidth" : 0.02 }
        retArr = [
          { layer: layer + layerAdd, style:
            { fill: cstyle.borderedArea.areaColor, stroke: cstyle.borderedArea.borderColor,
              strokeWidth: s(cstyle.borderedArea.borderWidth), strokeLinecap: 'round', strokeLinejoin: 'round' } }
        ];
        
      } else if (cstyle.patternedArea) { // "patternedArea" : { "areaColor" : "#9dca8a", "patternColor" : "#99cc00", "patternShape" : "tree", "patternWidth" : 0.9, "patternHeight" : 0.9 }
        const shapes = cstyle.patternedArea.patternShape.split(/:/g); const color = cstyle.patternedArea.patternColor;
        const shapeIds = shapes.map(shape => `s${shape}`);
        const patternId = `p${shapeIds.join('_')}p${color.replace(/#/g, '')}p${
          s(cstyle.patternedArea.patternWidth).replace(/\./g, '_')}p${s(cstyle.patternedArea.patternHeight).replace(/\./g, '_')}`;
        for (let i = 0; i < shapes.length; i++) {
          const shape = shapes[i];
          const shapeId = shapeIds[i];
          if (!this.usedShapeMap[shapeId]) {
            this.usedShapeMap[shapeId] = true;
            retArr.push({
              layer: -1,
              defText: `<g id="${shapeId}">${this.SHAPES[shape]}</g>`
            });
          }
        }
        if (!this.usedPatternMap[patternId]) {
          this.usedPatternMap[patternId] = true;
          let defText = '';
          defText += `<pattern id="${patternId}" width="${s(cstyle.patternedArea.patternWidth)}" height="${
            s(2 * cstyle.patternedArea.patternHeight)}" patternUnits="userSpaceOnUse">`;
          for (let i = 0; i < shapeIds.length; i++) {
            const xShift = i * cstyle.patternedArea.patternWidth / 4;
            defText += `<use xlink:href="#${shapeIds[i]}" fill="${color}"${
                xShift > 0 ? ` transform="translate(${s(xShift)} 0)"` : ''
              } /><use xlink:href="#${shapeIds[i]}" fill="${color}" transform="translate(${
              s(cstyle.patternedArea.patternWidth / 2 + xShift)} ${s(cstyle.patternedArea.patternHeight)})" />`;
          }
          defText += '</pattern>';
          retArr.push({ layer: -1, defText });
        }
        retArr.push({ layer: layer + layerAdd, style: { fill: cstyle.patternedArea.areaColor } });
        retArr.push({ layer: layer + layerAdd, style: { fill: `url(#${patternId})` } });
        
      } else if (cstyle.symbol) { // "symbol" : { "color" : "#000000", "shape" : "peak", "x" : -0.05, "y" : -0.05 }
        const shape = cstyle.symbol.shape; const shapeId = `s${shape}`;
        if (!this.usedShapeMap[shapeId]) {
          this.usedShapeMap[shapeId] = true;
          retArr.push({
            layer: -1,
            defText: `<g id="${shapeId}">${this.SHAPES[shape]}</g>`
          });
        }
        retArr.push({ layer: layer + layerAdd, symbol: shapeId, shift: { x: cstyle.symbol.x, y: cstyle.symbol.y },
          style: { fill: cstyle.symbol.color } });

      }
      return retArr;
    }

    return [];
  }
}

module.exports = MapStyler;
