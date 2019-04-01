
const https = require('https');
const Files = require('./files')

function s(num) {
  return `${(Math.round(num * 100) / 100)}`;
}

class OverpassRequest {
  constructor() {
    this.apiURL = 'https://overpass.kumi.systems/api/interpreter';
  }

  simpleApiRequest(request) {
    return new Promise((resolve, reject) => {
      https.get(`${this.apiURL}?data=${encodeURIComponent(request)}`, resp => {
        console.log('Downloading OSM data...');
        let data = ''; let sz = 0;
        resp.on('data', (chunk) => {
          data += chunk;
          const oldSz = sz / (1024 * 1024);
          sz += chunk.length;
          const newSz = sz / (1024 * 1024);
          if (Math.ceil(oldSz / 10) > oldSz / 10 && newSz / 10 >= Math.ceil(oldSz / 10))
            console.log(`Downloaded ${s(sz / (1024 * 1024))} MB so far.`);
        });
        resp.on('end', () => {
          console.log(`Download successful (${s(sz / (1024 * 1024))} MB).`);
          Files.cacheFile('app-data/cache/osm', 'json', data);
          console.log(`Result cached (${s(sz / (1024 * 1024))} MB).`);
          resolve(data);
        });
      }).on('error', err => {
        reject(err);
      });
    });
  }

  async simpleJSONApiRequest(request) {
    let data = await this.simpleApiRequest(`[out:json];${request}`);
    return JSON.parse(data);
  }
}

module.exports = OverpassRequest;
