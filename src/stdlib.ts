import { z } from "zod";
import * as fs from "fs";
import * as fsPromises from "fs/promises";
import * as path from "path/win32";
import * as types from "./types.js";

enum CompilerMode {
  DEV,
  PROD
}

export default class StandardLibraryAPI {
  hasBP;
  hasRP;
  zod = z;
  node = {
    fs,
    fsPromises,
    path
  };
  CompilerMode = CompilerMode;
  compilerMode;

  constructor(context: types.IContext) {
    this.hasBP = context.config.packs.includes("BP");
    this.hasRP = context.config.packs.includes("RP");
    this.compilerMode = context.buildFlags.production
      ? CompilerMode.PROD
      : CompilerMode.DEV;
  }

  log(message: unknown) {
    console.log(message);
  }
}
