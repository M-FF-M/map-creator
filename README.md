# map-creator

Playing with OSM: the goal is to render high quality OSM maps (to vector graphics) while keeping
the file size low. This is work in progress and will potentially never be finished.

The best existing online converter, in my opinion, is [MyOSMatic](https://print.get-map.org/).
There are two drawbacks however: on the one hand, the file size reaches hundreds of MB very fast -
trying to create a hiking map of a reasonably-sized region results in files of about 1 GB. On the
other hand, there is no way to influence the scale and neither a ruler nor a legend are part of the
final map.

## How to use

The script can be run with node.js (`node index.js`), and it was tested on node version 10.6.0.
Currently, the desired bounding box still has to be adapted by changing the code in `index.js`.
By default, it currently downloads a map of an area near Tegernsee, Germany. The SVG file will
be saved in the folder `app-data`. The following command line options are available:
- `--scale [number]` (default is 25000): changes the map scale. The SVG will contain a map with
  scale of 1:scale. The SVG file itself uses cm as unit. Depending on your machine and software,
  these cm might not render to real-world cm on your screen.
- `--useCache [number]`: if this argument is supplied (with any number), the script automatically
  caches downloaded OSM data as well as bounding boxes and processed data (of the last 10
  executions). If the supplied number is between 1 and 10, the script will reuse the cached data
  instead of downloading and processing again (also see next bullet point). 1 specifies the most
  recent cache data. In addition, if you have saved cache entries via `--cacheSave`, you may also
  supply higher numbers. Note that the oldest cache entry will be automatically deleted during
  execution.
- `--cacheLvl [number]` (default is 2): 0 - no data from cache is used (but cache entries are
  written if `--useCache` is used), 1 - OSM data is read from cache (instead of downloading it),
  2 - OSM data and processed OSM data is read from cache (note that specifying a different scale
  than the scale which was specified when the cached data was processed will result in undefined
  behavior). Only works in connection with `--useCache`.
- `--cacheSave [number]`: if a number larger than 10 is supplied, all data will (in addition to
  standard caching) be saved to a special numbered cache file which can be referred to with
  `--useCache` later. This special cache file will only be overwritten when `--cacheSave` is used
  with the same number, the file will not be overwritten by newer cache data. Only works in
  connection with `--useCache`.

## To do

- Create external styling files
- Fix railway rendering: if there are many tracks close together, the dashes overlap
- Render icons for special places (mountain tops, water sources, huts, etc.)
- Add place names to the map (cities, mountains, streets, rivers, etc.)
- Add contour lines (will be more work since they have to be downloaded from a separate source)
- Add contour shading
- Filter map features depending on desired scale
- Add option to show grid, ruler, map key, etc.
- After restructuring, there (hopefully) are enough comments to actually understand the code, continue and add many JSDoc comments in the future
