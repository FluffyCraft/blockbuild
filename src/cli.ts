#!/usr/bin/env node

import { cli, CLICommand, boolean } from './cli-api.js';
import * as blockb from './index.js';
import * as fs from 'fs/promises';
import * as zTypes from './zod-types.js';
import * as errors from './errors.js';

interface IParseConfigAsRequiredOptions {
    srcPath?: string,
    outPath?: string
}

async function parseConfigAsRequired(options: IParseConfigAsRequiredOptions) {
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
        errors.ErrorCode.ZodParseConfigAsRequiredFailParse,
        'Error parsing config.'
    );

    config.srcPath = options.srcPath || config.srcPath || '.';
    config.outPath = options.outPath || config.outPath || 'dist';

    return config as zTypes.IConfigRequired;
}

const version = new CLICommand(async () => console.log('Installed BlockBuild version: v0.1.0'), 'Returns the current version of BlockBuild.');
const build = new CLICommand(
    async (flags, srcPath?: string, outPath?: string) => {
        await blockb.build(await parseConfigAsRequired({ srcPath, outPath }));
    },
    'Builds a project.',
    [
        {
            name: 'srcPath',
            description: 'The path to find the source files.',
            type: String,
            defaultValue: '.',
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
            name: 'production',
            description: 'Build in production mode.',
            alias: 'p'
        },
        {
            name: 'package',
            description: 'Package as a .mcaddon file. Automatically uses --production.'
        }
    ]
)

await cli({
    version,
    build
});