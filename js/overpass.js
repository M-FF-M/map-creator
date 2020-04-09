
const https = require('https');
const Files = require('./files')

class OverpassRequest {
  constructor() {
    this.apiURL = 'https://overpass.kumi.systems/api/interpreter';
  }

  simpleApiRequest(request) {
    console.log('Entering OverpassRequest.simpleApiRequest().');
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
            console.log(`Downloaded ${Files.getSizeStr(sz)} so far.`);
        });
        resp.on('end', () => {
          console.log(`Download successful (${Files.getSizeStr(sz)}).`);
          resolve(data);
        });
      }).on('error', err => {
        console.log('Download failed.');
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
