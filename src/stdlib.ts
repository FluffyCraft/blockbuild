/*
BlockBuild - A Minecraft addon compiler.
Copyright (C) 2023 FluffyCraft

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.

EMAIL: contact@fluffycraft.net
*/

import { z } from "zod";
import * as fs from "fs";
import * as fsPromises from "fs/promises";
import * as path from "path/win32";
import * as types from "./types.js";
import glob from "glob";

enum CompilerMode {
  DEV,
  PROD
}

export default class StandardLibraryAPI {
  hasBP;
  hasRP;
  zod = z;
  glob = glob;
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
    this.compilerMode = context.buildFlags.production ? CompilerMode.PROD : CompilerMode.DEV;
  }

  log(message: unknown) {
    console.log(message);
  }
}
