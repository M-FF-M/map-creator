
const fs = require('fs');

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
}

module.exports = Files;
