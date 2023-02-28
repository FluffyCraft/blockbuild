/*
BlockBuild - A Minecraft addon compiler.
Copyright (C) 2023 FluffyCraft

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License v3.0 as published by
the Free Software Foundation.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.

EMAIL: contact@fluffycraft.net
*/

import glob from "glob";
import { existsSync } from "fs";
import * as path from "path/win32";
import StandardLibraryAPI from "./stdlib.js";
import * as types from "./types.js";

export async function evalExtensions(context: types.IContext) {
	const stdlib = new StandardLibraryAPI(context);

	const modules: {
		std: typeof stdlib;
		[module: string]: any;
	} = {
		std: stdlib
	};

	async function addExtensionExportsToContext(moduleURL: string, namespace: string) {
		modules[namespace] = await (
			await import(moduleURL)
		).default({
			context,
			std: stdlib
		});
	}

	const cwd = process.cwd();
	const projectExtensionFilePath = path.join(cwd, context.config.srcPath, "api-extension.js");

	const promises: Promise<void>[] = [];
	if (existsSync(projectExtensionFilePath))
		promises.push(addExtensionExportsToContext(`file://${projectExtensionFilePath}`, "project"));

	for (const filePath of glob.sync(`.blockbuild/modules/*/api-extension.js`, {
		nodir: true
	}))
		promises.push(addExtensionExportsToContext(`file://${path.join(cwd, filePath)}`, filePath.split("/")[2]));

	await Promise.all(promises);

	return modules;
}
