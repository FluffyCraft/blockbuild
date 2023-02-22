#!/usr/bin/env node

import { cli, CLICommand, boolean } from './cli-api.js';
import * as blockb from './index.js';
import * as fs from 'fs/promises';
import * as zTypes from './zod-types.js';
import * as errors from './errors.js';
import * as path from 'path';
import * as os from 'os';

interface IParseConfigAsRequiredOptions {
    srcPath?: string,
    outPath?: string
}

async function evalConfig(options: IParseConfigAsRequiredOptions) {
    const configRaw = await fs.readFile('blockbuild.config.json', 'utf8').catch(err => {
        throw errors.InternalError(errors.ErrorCode.InternalConfigReadError, `Failed to read config file.\n\t${err}`);
    });

    let configJSON;

    try {
        configJSON = JSON.parse(configRaw);
    } catch (err) {
        throw errors.InternalError(errors.ErrorCode.InternalConfigJSONParseError, `Failed to parse config file.\n\t${err}`);
    }

    const config = errors.ZodError.tryParseSchema(
        zTypes.Config,
        configJSON,
        errors.ErrorCode.ZodEvalConfigFailParse,
        'Error parsing config.'
    );

    config.srcPath = options.srcPath || config.srcPath || 'src';
    config.outPath = options.outPath || config.outPath || 'dist';
    config.comMojangPath = typeof config.comMojangPath === 'object' ?
        (config.comMojangPath.fromHomeDir ? path.join(os.homedir(), config.comMojangPath.path) : config.comMojangPath.path)
        : (config.comMojangPath || path.join(os.homedir(), 'AppData/Local/Packages/Microsoft.MinecraftUWP_8wekyb3d8bbwe/LocalState/games/com.mojang'))

    return config as zTypes.IConfigEvaluated;
}

const version = new CLICommand(async () => console.log('Installed BlockBuild version: v0.0.1'), 'Returns the current version of BlockBuild.');
const build = new CLICommand(
    async (flags, srcPath?: string, outPath?: string) => {
        await blockb.build(await evalConfig({ srcPath, outPath }), flags);
    },
    'Builds a project.',
    [
        {
            name: 'srcPath',
            description: 'The path to find the source files.',
            type: String,
            defaultValue: 'src',
            useDefaultValue: false
        },
        {
            name: 'outPath',
            description: 'The path to output the built project.',
            type: String,
            defaultValue: 'dist',
            useDefaultValue: false
        }
    ],
    [
        {
            name: 'package',
            description: 'Package as a .mcaddon file. Automatically uses --production.'
        },
        {
            name: 'production',
            description: 'Build in production mode.',
            alias: 'p'
        }
    ]
);
const init = new CLICommand(
    (flags) => {

    },
    'Initializes a project'
);

await cli({
    build,
    init,
    version
});