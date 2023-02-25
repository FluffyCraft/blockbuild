import { z } from 'zod';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path/win32';
import * as types from './types.js';

export default class StandardLibraryAPI {
    hasBP;
    hasRP;
    zod = z;
    node = {
        fs,
        fsPromises,
        path
    }

    constructor(context: types.IContext) {
        this.hasBP = context.config.packs.includes('BP');
        this.hasRP = context.config.packs.includes('RP');
    }

    log(message: unknown) {
        console.log(message);
    }
}