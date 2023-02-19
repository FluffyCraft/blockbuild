// get all context bridge files from src/contextBridge.js and .cobweb/modules/*/contextBridge.js
// add all methods from the context bridge files to an object, all of them will be namespaced based on their module
// copy src/public to dist
// execute all filters in node:vm and pass the context bridge exposed variables to context

import * as apiExtensions from './api-extensions.js';
import * as zTypes from './zod-types.js';

export function build(config: zTypes.IConfigRequired) {
    apiExtensions.getLinker(config.srcPath);
}