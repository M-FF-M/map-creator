
class FeatureParser {
  areaFeature(elem) {
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
  
  displayRelation(elem) {
    if (elem.type === 'relation' && elem.tags && elem.tags.type === 'multipolygon') {
      if (areaFeature(elem)) return true;
    }
    return false;
  }

  createPath(elem) {
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
  }

  getPathStyle(elem) {
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
      if (elem.tags.railway === 'construction' || elem.tags.railway === 'disused'
          || (elem.tags.service && (elem.tags.service === 'crossover'
            || elem.tags.service === 'siding'|| elem.tags.service === 'spur'|| elem.tags.service === 'yard'))) {
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
              { stroke: '#7d9ba4', fillOpacity: '0', strokeWidth: '0.12', strokeLinecap: 'round', strokeLinejoin: 'round' } },
            { layer: WATER, style:
              { stroke: '#abd4e0', fillOpacity: '0', strokeWidth: '0.08', strokeLinecap: 'round', strokeLinejoin: 'round' } }
          ];
        } else {
          let pWidth = 0.05;
          if (elem.tags.waterway === 'drain' || elem.tags.waterway === 'ditch') pWidth = 0.03;
          if (elem.tags.waterway === 'river') pWidth = 0.08;
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
      if (elem.tags.natural === 'wood' || elem.tags.natural === 'scrub'
          || elem.tags.natural === 'heath' || elem.tags.natural === 'grassland'
          || elem.tags.natural === 'fell' || elem.tags.natural === 'bare_rock'
          || elem.tags.natural === 'scree' || elem.tags.natural === 'shingle'
          || elem.tags.natural === 'sand' || elem.tags.natural === 'mud'
          || elem.tags.natural === 'wetland' || elem.tags.natural === 'glacier'
          || elem.tags.natural === 'beach') {
        let color = 'none'; let add = 0;
        if (elem.tags.natural === 'wood') { color = '#9dca8a'; add = -1; }
        if (elem.tags.natural === 'scrub') color = '#c9d8ad';
        if (elem.tags.natural === 'heath') color = '#d6d99f';
        if (elem.tags.natural === 'grassland') color = '#ceecb2';
        if (elem.tags.natural === 'fell') color = '#ceecb2';
        if (elem.tags.natural === 'bare_rock') color = '#ede4dc';
        if (elem.tags.natural === 'scree') color = '#ede4dc';
        if (elem.tags.natural === 'shingle') color = '#ede4dc';
        if (elem.tags.natural === 'sand') color = '#f0e5c2';
        if (elem.tags.natural === 'mud') color = '#e7ddd3';
        if (elem.tags.natural === 'wetland') color = '#e7ddd3';
        if (elem.tags.natural === 'glacier') color = '#deeded';
        if (elem.tags.natural === 'beach') color = '#fff1bb';
        if (color !== 'none')
          return [ { layer: LAND + add, style: { fill: color } } ];
      }
    } else if (elem.tags && elem.tags.landuse) {
      let color = 'none'; let add = 0;
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
      if (elem.tags.landuse === 'forest') { color = '#9dca8a'; add = -1; }
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
        return [ { layer: LAND + add, style: { fill: color } } ];
    }
    return [];
  }
}

module.exports = FeatureParser;
