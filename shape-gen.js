
const Files = require('./js/files');
const cmdArgs = require('minimist')(process.argv.slice(2));
const fs = require('fs');

function checkInt(num) {
  if (typeof num === 'number') return Math.round(num);
  else return parseInt(num);
}

function checkFloat(num) {
  if (typeof num === 'number') return num;
  else return parseFloat(num);
}

function getAllSVG(svgArray, currentDir) {
  fs.readdirSync(currentDir).forEach(file => {
    if (fs.lstatSync(`${currentDir}${file}`).isDirectory())
      getAllSVG(svgArray, `${currentDir}${file}/`);
    else if (fs.lstatSync(`${currentDir}${file}`).isFile()) {
      if (file.search(/\.svg$/ig) != -1)
        svgArray.push({ path: `${currentDir}${file}`, name: file.replace(/\.svg$/ig, '') });
    }
  });
}

async function main() {
  // const res = await SVGRenderer.downloadAndRenderMap({ ll: { lat: 47.693356, lon: 11.749774 }, ur: { lat: 47.700786, lon: 11.762389 } }, 5000);
  if (cmdArgs.help) {
    console.log(`
#################### map-creator // shape-gen ####################
(c) Fabian Michel, 2019-2020 / MIT License

This script generates the \x1b[36mmap-styles/shapes.json\x1b[0m file. It expects:
the file \x1b[36mmap-styles/shapes-manual.json\x1b[0m should contain all the needed shapes.
The format is as follows:
"\x1b[36mshape name\x1b[0m": "\x1b[36mplain SVG\x1b[0m" \x1b[36m|\x1b[0m "\x1b[36mpath to OSM SVG\x1b[0m" \x1b[36m|\x1b[0m true
- \x1b[36mplain SVG\x1b[0m: simply insert SVG code for the icon
- \x1b[36mpath to OSM SVG\x1b[0m: path to a differently named OSM SVG, e.g. \x1b[36mamenity/bank.svg\x1b[0m
- true: look for a OSM SVG with the name \x1b[36mshape name\x1b[0m

The OSM SVGs are expected to be located under \x1b[36m../openstreetmap-carto/symbols\x1b[0m
(retrieve them by cloning https://github.com/gravitystorm/openstreetmap-carto).

Command line arguments:
- \x1b[36m--check "[space separated list]"\x1b[0m: check whether given icon exists and show its path
- \x1b[36m--add "[space separated list]"\x1b[0m: add icon to \x1b[36mmap-styles/shapes-manual.json\x1b[0m`);
    return;
  }
  let check = [];
  if (cmdArgs.check && (typeof cmdArgs.check === 'string'))
    check = cmdArgs.check.split(/ /g);
  let add = [];
  if (cmdArgs.add && (typeof cmdArgs.add === 'string'))
    add = cmdArgs.add.split(/ /g);

  const svgArray = [];
  getAllSVG(svgArray, '../openstreetmap-carto/symbols/');
  console.log(`A total of ${svgArray.length} SVG files are available.\n`);
  const svgMap = {};
  for (let i = 0; i < svgArray.length; i++) {
    if (!(svgMap[svgArray[i].name] instanceof Array))
      svgMap[svgArray[i].name] = [];
    svgMap[svgArray[i].name].push(svgArray[i].path);
  }

  for (let i = 0; i < check.length; i++) {
    if (svgMap[ check[i] ] instanceof Array) {
      console.log(`Found ${svgMap[ check[i] ].length} version${svgMap[ check[i] ].length == 1 ? '' : 's'} of icon '${check[i]}':`);
      for (let k = 0; k < svgMap[ check[i] ].length; k++)
        console.log(`  ${svgMap[ check[i] ][k]}`);
    } else {
      console.log(`Icon '${check[i]}' does not exist!`);
    }
  }

  const shapeObject = JSON.parse(Files.readFile('map-styles/shapes-manual.json'));

  for (let i = add.length - 1; i >= 0; i--) {
    if (!(svgMap[ add[i] ] instanceof Array)) {
      console.log(`Failed to add icon '${add[i]}': not found!`);
      add.splice(i, 1);
    } else if (shapeObject[ add[i] ]) {
      console.log(`Failed to add icon '${add[i]}': already part of map-styles/shapes-manual.json!`);
      add.splice(i, 1);
    } else {
      if (svgMap[ add[i] ].length == 1) shapeObject[ add[i] ] = true;
      else shapeObject[ add[i] ] = svgMap[ add[i] ][0];
      console.log(`Added icon '${add[i]}'.`);
    }
  }

  const JSONStringify2 = obj => {
    let ret = '{\n';
    let isFirst = true;
    for (let prop in obj) {
      if (obj.hasOwnProperty(prop)) {
        if (!isFirst) ret += ',\n';
        ret += `  ${JSON.stringify(prop)}: ${JSON.stringify(obj[prop])}`;
        isFirst = false;
      }
    }
    ret += '\n}';
    return ret;
  };
  
  const adaptSVG = txt => {
    txt = txt.replace(/^([^<]|\n|\r)*<\?xml[^>]*\?>(.|\n|\r)*<svg[^>]*>([^<]|\n|\r)*/g, '').replace(/([^>]|\n|\r)*<\/svg[^>]*>([^<]|\n|\r)*$/g, '');
    txt = txt.replace(/id="[^"]+"/g, '');
    txt = txt.replace(/(\n|\r|\t| )+/g, ' ');
    txt = txt.replace(/" ?\/>/g, '" transform="scale(0.015)" />');
    return txt;
  };

  const toShapeFile = obj => {
    for (let prop in obj) {
      if (obj.hasOwnProperty(prop)) {
        if (typeof obj[prop] === 'boolean') {
          if (obj[prop] && (svgMap[prop] instanceof Array))
            obj[prop] = adaptSVG(Files.readFile(svgMap[prop][0]));
          else
            delete obj[prop];
        }
        if ((typeof obj[prop] === 'string') && obj[prop].length >= 1) {
          if (obj[prop][0] !== '<')
            obj[prop] = adaptSVG(Files.readFile(obj[prop]));
        }
      }
    }
  };

  Files.saveFile('map-styles/shapes-manual.json', JSONStringify2(shapeObject));
  toShapeFile(shapeObject);
  Files.saveFile('map-styles/shapes.json', JSON.stringify(shapeObject));
}

main();
