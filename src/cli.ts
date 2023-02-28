#!/usr/bin/env node

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

//vscode-fold=1

import { cli, CLICommand, boolean } from "./cli-api.js";
import * as blockb from "./index.js";
import * as fs from "fs/promises";
import * as types from "./types.js";
import * as errors from "./errors.js";
import * as path from "path/win32";
import * as os from "os";
import * as constants from "./constants.js";
import { randomUUID } from "crypto";
import { execSync } from "child_process";
import chalk from "chalk";
import extract from "extract-zip";
import promptInit from "prompt-sync";

const prompt = promptInit();

interface IParseConfigAsRequiredOptions {
	srcPath?: string;
	outPath?: string;
}

async function evalConfig(options: IParseConfigAsRequiredOptions) {
	const configRaw = await fs.readFile("blockbuild.config.json", "utf8").catch(err => {
		throw errors.InternalError(errors.ErrorCode.InternalConfigReadError, `Failed to read config file.\n\t${err}`);
	});

	let configJSON;

	try {
		configJSON = JSON.parse(configRaw);
	} catch (err) {
		throw errors.InternalError(errors.ErrorCode.InternalConfigJSONParseError, `Failed to parse config file.\n\t${err}`);
	}

	const config = errors.ZodError.tryParseSchema(
		types.Config,
		configJSON,
		errors.ErrorCode.ZodEvalConfigFailParse,
		"Error parsing config."
	);

	config.srcPath = options.srcPath || config.srcPath || "src";
	config.outPath = options.outPath || config.outPath || "dist";
	config.comMojangPath =
		typeof config.comMojangPath === "object"
			? config.comMojangPath.fromHomeDir
				? path.join(os.homedir(), config.comMojangPath.path)
				: config.comMojangPath.path
			: config.comMojangPath ||
			  path.join(
					os.homedir(),
					"AppData/Local/Packages/Microsoft.MinecraftUWP_8wekyb3d8bbwe/LocalState/games/com.mojang"
			  );

	return config as types.IConfigEvaluated;
}

async function readModuleManifest() {
	const raw = await fs.readFile("blockbuild-module-manifest.json", "utf8").catch(err => {
		throw errors.InternalError(
			errors.ErrorCode.InternalModuleManifestReadError,
			`Failed to read module manifest file.\n\t${err}`
		);
	});

	let json;

	try {
		json = JSON.parse(raw);
	} catch (err) {
		throw errors.InternalError(
			errors.ErrorCode.InternalModuleManifestJSONParseError,
			`Failed to parse module manfiest file.\n\t${err}`
		);
	}

	return errors.ZodError.tryParseSchema(
		types.ModuleManifest,
		json,
		errors.ErrorCode.ZodReadModuleManifestFailParse,
		"Error parsing module manifest."
	);
}

const version = new CLICommand(
	async () => console.log(`Installed BlockBuild version: v${constants.version}`),
	"Returns the current version of BlockBuild."
);
const build = new CLICommand(
	async (flags, srcPath?: string, outPath?: string) => {
		await blockb.build(await evalConfig({ srcPath, outPath }), flags);
	},
	"Builds a project.",
	[
		{
			name: "srcPath",
			description: "The path to find the source files.",
			type: String,
			defaultValue: "src",
			useDefaultValue: false
		},
		{
			name: "outPath",
			description: "The path to output the built project.",
			type: String,
			defaultValue: "dist",
			useDefaultValue: false
		}
	],
	[
		{
			name: "package",
			description: "Package as a .mcaddon file. Automatically uses --production."
		},
		{
			name: "production",
			description: "Build in production mode.",
			alias: "p"
		}
	]
);
const init = new CLICommand(
	async (flags, packName: string, authors: string) => {
		if (flags.noBP && flags.noRP)
			throw errors.CLIError(errors.ErrorCode.CLIInitNoBPOrRP, "`--noBP` and `--noRP` cannot be used together.");

		await fs.mkdir("src");

		const packs = [];
		if (!flags.noBP) packs.push("BP");
		if (!flags.noRP) packs.push("RP");

		const firstPromises: Promise<unknown>[] = [
			fs.mkdir("dist"),
			fs.mkdir("src/filters"),
			fs.writeFile("src/api-extension.js", `export default function ({ context, std }) {\n\treturn {};\n}`),
			fs.writeFile(
				"blockbuild.config.json",
				JSON.stringify(
					{
						packName,
						packs,
						filters: []
					},
					undefined,
					4
				)
			),
			fs.writeFile(
				"package.json",
				JSON.stringify(
					{
						type: "module"
					},
					undefined,
					4
				)
			),
			fs.writeFile(
				"blockbuild-module-manifest.json",
				JSON.stringify(
					{
						dependencies: []
					},
					undefined,
					4
				)
			),
			fs.writeFile(".gitignore", "/dist\n/.blockbuild"),
			fs.writeFile(".mcignore", "/dist")
		];

		if (!flags.noBP) firstPromises.push(fs.mkdir("src/packs/BP/texts", { recursive: true }));
		if (!flags.noRP) firstPromises.push(fs.mkdir("src/packs/RP/texts", { recursive: true }));

		await Promise.all(firstPromises);

		const secondPromises = [];

		const BPUUID = randomUUID();
		const RPUUID = randomUUID();

		if (!flags.noBP) {
			secondPromises.push(
				fs.writeFile(
					"src/packs/BP/manifest.json",
					JSON.stringify(
						{
							format_version: 2,
							metadata: {
								authors: authors.split(","),
								generated_with: { blockbuild: [constants.version] }
							},
							header: {
								name: "pack.name",
								description: "pack.description",
								min_engine_version: [1, 19, 0],
								uuid: BPUUID,
								version: [1, 0, 0]
							},
							modules: [
								{
									type: "data",
									uuid: randomUUID(),
									version: [1, 0, 0]
								}
							],
							dependencies: flags.noRP
								? undefined
								: [
										{
											uuid: RPUUID,
											version: [1, 0, 0]
										}
								  ]
						},
						undefined,
						4
					)
				)
			);
			secondPromises.push(fs.writeFile("src/packs/BP/texts/en_US.lang", `pack.name=${packName}\npack.description=`));
			secondPromises.push(fs.writeFile("src/packs/BP/texts/languages.json", JSON.stringify(["en_US"], undefined, 4)));
		}
		if (!flags.noRP) {
			secondPromises.push(
				fs.writeFile(
					"src/packs/RP/manifest.json",
					JSON.stringify(
						{
							format_version: 2,
							metadata: {
								authors: authors.split(","),
								generated_with: { blockbuild: [constants.version] }
							},
							header: {
								name: "pack.name",
								description: "pack.description",
								min_engine_version: [1, 19, 0],
								uuid: RPUUID,
								version: [1, 0, 0]
							},
							modules: [
								{
									type: "resources",
									uuid: randomUUID(),
									version: [1, 0, 0]
								}
							],
							dependencies: flags.noBP
								? undefined
								: [
										{
											uuid: BPUUID,
											version: [1, 0, 0]
										}
								  ]
						},
						undefined,
						4
					)
				)
			);
			secondPromises.push(fs.writeFile("src/packs/RP/texts/en_US.lang", `pack.name=${packName}\npack.description=`));
			secondPromises.push(fs.writeFile("src/packs/RP/texts/languages.json", JSON.stringify(["en_US"], undefined, 4)));
		}

		await Promise.all(secondPromises);
	},
	"Initializes a project.",
	[
		{
			name: "packName",
			description: "The name of your pack. This will be used in the config.",
			type: String
		},
		{
			name: "authors",
			description: "The authors of your pack, separated by commas.",
			type: String
		}
	],
	[
		{
			name: "noBP",
			description: "Do not create a behavior pack."
		},
		{
			name: "noRP",
			description: "Do not create a resource pack."
		}
	]
);
const install = new CLICommand(
	async (flags, module: string, version: string) => {
		const thisManifest = await readModuleManifest();

		const modules = (
			await (
				await fetch(
					(
						await (await fetch("https://api.github.com/repos/FluffyCraft/blockbuild-modules/git/trees/main")).json()
					).tree[1].url
				)
			).json()
		).tree;

		const requestedModuleDir = modules.find((m: any) => m.path === module);
		if (!requestedModuleDir) throw errors.CLIError(errors.ErrorCode.CLIInstallModuleNotFound, "Module not found.");

		const requestedModule = (await (await fetch(requestedModuleDir.url)).json()).tree;

		if (version === "latest") {
			const rootManifest = JSON.parse(
				Buffer.from(
					(await (await fetch(requestedModule.find((f: any) => f.path === "manifest.json").url)).json()).content,
					"base64"
				).toString()
			);

			version = rootManifest.latest;
		}

		if (thisManifest.dependencies[module]) {
			const currentVersion = thisManifest.dependencies[module].version;
			if (currentVersion !== version) {
				console.log(chalk.bold("Unable to install automatically."));
				console.log("Trying to install a different version of an already installed module.");
				if (
					prompt(
						`Type "keep" to keep ${module}@${currentVersion} or type anything else to replace ${module}@${currentVersion} with ${module}@${version}. `
					) === "keep"
				)
					throw "User cancelled installation.";
			}
		}

		const requestedVersion = requestedModule.find((f: any) => f.path === `${version}.zip`);
		if (!requestedVersion)
			throw errors.CLIError(errors.ErrorCode.CLIInstallModuleVersionNotFound, "Version not found.");

		// download version zip
		await fs.writeFile("tmp", Buffer.from((await (await fetch(requestedVersion.url)).json()).content, "base64"));

		// create modules dir
		await fs.mkdir(".blockbuild/modules", { recursive: true });

		// extract
		const extractPath = path.join(process.cwd(), ".blockbuild/modules", module);

		await fs.rm(extractPath, { recursive: true, force: true });
		await extract("tmp", { dir: extractPath });
		fs.rm("tmp");

		// install dependencies of module
		console.log(chalk.bold(`Installing dependencies of ${module}@${version}.`));

		const installedModuleManifest = JSON.parse(
			await fs.readFile(path.join(".blockbuild/modules", module, "blockbuild-module-manifest.json"), "utf8")
		);

		for (const [dependencyModule, dependencyData] of Object.entries(installedModuleManifest.dependencies) as [
			any,
			any
		]) {
			console.log(`Installing dependency ${dependencyModule}@${dependencyData.version}.`);
			execSync(`blockb install ${dependencyModule} ${dependencyData.version}`, {
				stdio: [process.stdin, process.stdout]
			});
			thisManifest.dependencies[dependencyModule] = { version: dependencyData.version };
		}

		console.log(chalk.bold(`Installed all dependencies of ${module}@${version}.`));

		// update module manifest with new dependencies
		thisManifest.dependencies[module] = {
			version
		};

		await fs.writeFile("blockbuild-module-manifest.json", JSON.stringify(thisManifest, undefined, 4));

		//todo: install the dependencies of the installed module
	},
	"Install a module from the FluffyCraft/blockbuild-modules GitHub repo.",
	[
		{
			name: "module",
			description: "The name of the module to install.",
			type: String
		},
		{
			name: "version",
			description: "The version of the module to install.",
			defaultValue: "latest",
			type: String
		}
	]
);
const insdeps = new CLICommand(async _ => {
	const manifest = await readModuleManifest();
	for (const [module, data] of Object.entries(manifest.dependencies) as [any, any]) {
		console.log(chalk.yellow(`Installing ${module}@${data.version}.`));
		execSync(`blockb install ${module} ${data.version}`, {
			stdio: [process.stdin, process.stdout]
		});
	}
}, "Installs all dependencies found in the module manifest.");

await cli({
	build,
	init,
	insdeps,
	install,
	version
});
