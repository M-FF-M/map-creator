
/**
 * @typedef {object} FeatureCategory feature category object
 * @property {string} type one of 'water', 'land', 'road', 'railway', 'building', 'poi'
 * @property {string} subtype many possible values inherited from OSM elements
 */

/**
 * @typedef {object} ParsedFeature parsed feature object
 * @property {boolean} draw whether this feature should be drawn
 * @property {boolean} isArea whether this is an area feature
 * @property {boolean} isWay whether this feature presents a way / road / track / railway usable by humans
 * @property {boolean} isPath whether this is a path feature
 * @property {boolean} isPoint whether this is a point feature (point of interest)
 * @property {boolean} isTunnel whether this is a path represents a tunnel
 * @property {boolean} isBridge whether this is a path represents a bridge
 * @property {FeatureCategory} info feature category information
 */

/**
 * Class for parsing single OSM elements
 */
class FeatureParser {
  /**
   * Parse a single OSM element
   * @param {object} elem the element to parse
   * @return {ParsedFeature} the parsed feature with useful and easily accesible information
   */
  static parseFeature(elem) {
    const ret = {
      draw: false, isArea: false, isWay: false, isPath: false, isTunnel: false, isBridge: false,
      isPoint: false, info: { type: '', subtype: '', },
    };

    if (elem.type === 'node') {
      if (elem.tags && elem.tags.natural) {
        if (elem.tags.natural === 'peak' || elem.tags.natural === 'hill') {
          ret.draw = true;
          ret.isPoint = true;
          ret.info.type = 'poi';
          ret.info.subtype = elem.tags.natural;
          return ret;
        }
      }

      return ret;
    }

    if (elem.tags && elem.tags.tunnel) ret.isTunnel = true;
    if (elem.tags && elem.tags.bridge) ret.isBridge = true;

    if (elem.tags && elem.tags.natural) {
      if (elem.tags.natural === 'wood' || elem.tags.natural === 'scrub'
          || elem.tags.natural === 'heath' || elem.tags.natural === 'grassland'
          || elem.tags.natural === 'fell' || elem.tags.natural === 'bare_rock'
          || elem.tags.natural === 'scree' || elem.tags.natural === 'shingle'
          || elem.tags.natural === 'sand' || elem.tags.natural === 'mud'
          || elem.tags.natural === 'water' || elem.tags.natural === 'wetland'
          || elem.tags.natural === 'glacier' // || elem.tags.natural === 'bay'
          || elem.tags.natural === 'beach' || elem.tags.natural === 'spring'
          || elem.tags.natural === 'hot_spring' || elem.tags.natural === 'blowhole') {
        ret.draw = true;
        ret.isArea = true;
        ret.info.type = (elem.tags.natural === 'water' || elem.tags.natural === 'spring'
          || elem.tags.natural === 'hot_spring' || elem.tags.natural === 'blowhole')
          ? 'water' : 'land';
        ret.info.subtype = elem.tags.natural;
        return ret;
      }
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
          || elem.tags.landuse === 'vineyard') {
        ret.draw = true;
        ret.isArea = true;
        ret.info.type = (elem.tags.landuse === 'basin' || elem.tags.landuse === 'salt_pond')
          ? 'water' : 'land';
        ret.info.subtype = elem.tags.landuse;
        return ret;
      }
    }

    if (elem.tags && elem.tags.waterway) {
      if (elem.tags.waterway === 'river' || elem.tags.waterway === 'stream'
          || elem.tags.waterway === 'canal' || elem.tags.waterway === 'drain'
          || elem.tags.waterway === 'ditch') {
        ret.draw = true;
        ret.isPath = true;
        ret.info.type = 'water';
        ret.info.subtype = elem.tags.waterway;
        return ret;
      }
      if (elem.tags.waterway === 'riverbank') {
        ret.draw = true;
        ret.isArea = true;
        ret.info.type = 'water';
        ret.info.subtype = elem.tags.waterway;
        return ret;
      }
    }

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
          || elem.tags.highway === 'path' || elem.tags.highway === 'cycleway') {
        ret.draw = true;
        ret.isPath = true; ret.isWay = true;
        ret.info.type = 'road';
        ret.info.subtype = elem.tags.highway;
        if (elem.tags.surface)
          ret.info.surface = elem.tags.surface.split(/:|;/g)[0];
        return ret;
      }
    }

    if (elem.tags && elem.tags.railway && elem.tags.railway !== 'abandoned'
        && elem.tags.railway !== 'subway' && elem.tags.railway !== 'platform') {
      ret.draw = true;
      ret.isPath = true; ret.isWay = true;
      ret.info.type = 'railway';
      ret.info.subtype = elem.tags.railway;
      if (elem.tags["railway:preserved"]) ret.info.subtype = 'preserved';
      if (elem.tags.service) ret.info.service = elem.tags.service;
      return ret;
    }

    if (elem.tags && elem.tags.building) {
      ret.draw = true;
      ret.isArea = true;
      ret.info.type = 'building';
      ret.info.subtype = elem.tags.building;
      return ret;
    }

    return ret;
  }

  /**
   * Checks whether an OSM element represents an area feature
   * @param {object} elem an OSM element
   * @return {boolean} true if the OSM element represents an area feature
   */
  static isAreaFeature(elem) {
    return FeatureParser.parseFeature(elem).isArea;
  }
  
  /**
   * Checks whether an OSM element is a relation and should be drawn on the map
   * @param {object} elem an OSM element
   * @return {boolean} true if the OSM element is a relation and should be drawn on the map
   */
  static shouldDisplayRelation(elem) {
    if (elem.type === 'relation' && elem.tags && elem.tags.type === 'multipolygon') {
      if (FeatureParser.isAreaFeature(elem)) return true;
    }
    return false;
  }

  /**
   * Checks whether an OSM element is a node and should be drawn on the map
   * @param {object} elem an OSM element
   * @return {boolean} true if the OSM element is a node and should be drawn on the map
   */
  static shouldDisplayNode(elem) {
    if (elem.type === 'node') {
      if (FeatureParser.parseFeature(elem).draw) return true;
    }
    return false;
  }

  /**
   * Checks whether an OSM element is a way and will be used for drawing the map
   * @param {object} elem an OSM element
   * @param {object} relWays object which maps OSM id -> true (this is a way which will be drawn as part of a relation) / false
   * @return {boolean} true if the OSM element is a way and is necessary for map drawing
   */
  static shouldCreatePath(elem, relWays) {
    if (elem.type === 'way') {
      if (relWays[elem.id]) return true;
      if (FeatureParser.parseFeature(elem).draw) return true;
    }
    return false;
  }
}

module.exports = FeatureParser;
