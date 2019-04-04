
const fs = require('fs');

function s(num) {
  return `${(Math.round(num * 100) / 100)}`;
}

class Files {
  static createDirsIfNecessary(path) {
    const pathSplit = path.split(/\//g);
    if (pathSplit.length > 1) {
      let cP = '';
      for (let i = 0; i < pathSplit.length - 1; i++) {
        if (i > 0) cP += '/';
        cP += pathSplit[i];
        if (pathSplit[i] === '' || pathSplit[i] === '.' || pathSplit[i] === '..') continue;
        if (!fs.existsSync(cP)) fs.mkdirSync(cP);
      }
    }
  }

  static saveFile(path, content) {
    Files.createDirsIfNecessary(path);
    fs.writeFileSync(path, content, 'utf8');
  }

  static readFile(path) {
    if (!fs.existsSync(path)) return '';
    return fs.readFileSync(path, 'utf8');
  }

  static readCacheFile(path, extension, number = 1) {
    let cont = '';
    while (number >= 1) {
      cont = Files.readFile(`${path}-${number}.${extension}`, 'utf8');
      if (cont.search(/RECACHED - NO CHANGES/g) != -1) { number--; }
      else { break; }
    }
    return cont;
  }

  static cacheFile(path, extension, content, cacheSize = 10) {
    Files.createDirsIfNecessary(path);
    let fidx = 0;
    for (let i = 1; i < cacheSize; i++) {
      if (fs.existsSync(`${path}-${i}.${extension}`))
        fidx = i;
    }
    for (let i = fidx; i >= 1; i--)
      fs.renameSync(`${path}-${i}.${extension}`, `${path}-${(i + 1)}.${extension}`);
    fs.writeFileSync(`${path}-1.${extension}`, content, 'utf8');
  }
  
  static recacheFile(path, extension, cacheSize = 10) {
    Files.createDirsIfNecessary(path);
    let fidx = 0;
    for (let i = 1; i < cacheSize; i++) {
      if (fs.existsSync(`${path}-${i}.${extension}`))
        fidx = i;
    }
    for (let i = fidx; i >= 2; i--)
      fs.renameSync(`${path}-${i}.${extension}`, `${path}-${(i + 1)}.${extension}`);
    if (fidx > 0)
      fs.writeFileSync(`${path}-2.${extension}`, 'RECACHED - NO CHANGES (see cache file with '
        + 'smaller index for actual content)', 'utf8');
  }

  static getSizeStr(sz) {
    const szPrefix = ['', 'K', 'M', 'G', 'T'];
    let idx = 0;
    while (idx + 1 < szPrefix.length && sz >= 1000) {
      sz /= 1024;
      idx++;
    }
    return `${s(sz)} ${szPrefix[idx]}B`;
  }
}

module.exports = Files;
