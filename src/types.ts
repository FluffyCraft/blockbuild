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

import { z } from "zod";

const ConfigFilterExecuter = z.object({
	id: z.string(),
	arguments: z.any().optional()
});

export const Config = z.object({
	packName: z.string().min(1),
	srcPath: z.string().optional(),
	outPath: z.string().optional(),
	comMojangPath: z
		.string()
		.min(1)
		.or(
			z.object({
				fromHomeDir: z.boolean().optional(),
				path: z.string().min(1)
			})
		)
		.optional(),
	packs: z
		.array(z.literal("BP").or(z.literal("RP")))
		.max(2)
		.min(1),
	filters: z.array(ConfigFilterExecuter)
});

export type TConfig = z.infer<typeof Config>;

export interface IConfigEvaluated {
	packName: string;
	srcPath: string;
	outPath: string;
	comMojangPath: string;
	packs: ("BP" | "RP")[];
	filters: z.infer<typeof ConfigFilterExecuter>[];
}

export const ModuleManifest = z.object({
	dependencies: z.object({}).catchall(
		z.object({
			version: z.string().min(1)
		})
	)
});

export interface IContext {
	buildFlags: IBuildFlags;
	config: IConfigEvaluated;
}
