import * as apiExtensions from './api-extensions.js';
import * as zTypes from './zod-types.js';
import * as vm from 'vm';
import * as fs from 'fs/promises';
import * as errors from './errors.js';
import glob from 'glob';
import { z } from 'zod';
import * as path from 'path';
import { createWriteStream, existsSync } from 'fs';
import archiver from 'archiver';

const FilterDefinitionOptions = z.object({
    arguments: z.any().optional()
});

type TFilterDefinitionOptions = z.infer<typeof FilterDefinitionOptions>;

interface IFilterData {
    args: {
        [arg: string]: unknown
    }
}

class Filter {
    mainFunction;
    definitionOptions;

    constructor(mainFunction: (data: IFilterData) => void, definitionOptions: TFilterDefinitionOptions) {
        this.mainFunction = mainFunction;
        this.definitionOptions = definitionOptions;
    }
}

interface IFilters {
    [id: string]: Filter
}

async function evalFilters(config: zTypes.IConfigEvaluated, buildFlags: any) {
    const context = {
        buildFlags,
        config
    };

    const api = await apiExtensions.evalExtensions(config.srcPath, context);

    const filters: IFilters = {};

    async function evalFilter(filePath: string, namespace: string, id: string) {
        let definitionOptions: TFilterDefinitionOptions | undefined;

        const vmContext = vm.createContext({
            filter: (o: TFilterDefinitionOptions) => definitionOptions = o,
            main() {
                throw 'Main function not defined.';
            },
            context: {
                namespace,
                ...context
            },
            api: {
                $this: api[namespace] ?? {},
                ...api
            }
        });

        vm.runInContext(await fs.readFile(filePath, 'utf8'), vmContext);

        filters[id] = new Filter(
            vmContext.main,
            errors.ZodError.tryParseSchema(
                FilterDefinitionOptions,
                definitionOptions,
                errors.ErrorCode.NoErrorCode,
                errors.RuntimeError(errors.ErrorCode.RuntimeEvalFilterParseDefOpts, id, 'Invalid definition options.')
            )
        );
    }

    const promises: Promise<void>[] = [];

    function awaitFilterPromise(id: string, promise: Promise<void>) {
        promises.push(
            promise
                .catch(e => {
                    throw errors.RuntimeError(errors.ErrorCode.RuntimeEvalFilterAwaitFilterProm, id, e);
                })
        );
    }

    for (const filePath of glob.sync(`${config.srcPath}/filters/**/*.js`, { nodir: true })) {
        const id = path.basename(filePath, '.js');
        awaitFilterPromise(id, evalFilter(filePath, 'project', id));
    }

    for (const filePath of glob.sync(`.blockbuild/modules/*/filters/**/*.js`, { nodir: true })) {
        const namespace = filePath.split('/')[2];
        const id = `${namespace}:${path.basename(filePath, '.js')}`;
        awaitFilterPromise(id, evalFilter(filePath, namespace, id));
    }

    await Promise.all(promises);

    return filters;
}

export async function build(config: zTypes.IConfigEvaluated, buildFlags: any) {
    const packPath = path.join(config.srcPath, 'packs');
    const BPPath = path.join(packPath, 'BP');
    const RPPath = path.join(packPath, 'RP');

    if (config.packs.includes('BP') && !existsSync(BPPath)) throw errors.InternalError(errors.ErrorCode.InternalBPNotFound, `Missing behavior pack directory at \`${BPPath}\`. If you want to choose a different location, change the \`srcPath\` value in the config. If you do not want a behavior pack, remove \`BP\` from \`packs\` in the config.`);
    if (config.packs.includes('RP') && !existsSync(RPPath)) throw errors.InternalError(errors.ErrorCode.InternalRPNotFound, `Missing resource pack directory at \`${RPPath}\`. If you want to choose a different location, change the \`srcPath\` value in the config. If you do not want a resource pack, remove \`RP\` from \`packs\` in the config.`);

    let filters: unknown;

    await fs.rm(config.outPath, { force: true, recursive: true });

    await Promise.all([
        evalFilters(config, buildFlags).then(res => filters = res),
        fs.cp(packPath, config.outPath, { recursive: true })
    ]);

    for (const filterToExecute of config.filters) {
        const filter = (filters as IFilters)[filterToExecute.id];
        if (!filter) throw errors.InternalError(errors.ErrorCode.InternalBuildFilterNotFound, `Cannot execute filter with id \`${filterToExecute.id}\` because it does not exist.`);

        let args;

        if (filter.definitionOptions.arguments) {
            if (!filter.definitionOptions.arguments.parse) throw errors.RuntimeError(errors.ErrorCode.RuntimeArgumentsSchemaNoParseMethod, filterToExecute.id, 'Arguments schema provided in the definition options does not have a `parse` method.');
            try {
                args = await filter.definitionOptions.arguments.parse(filterToExecute.arguments);
            }
            catch (err) {
                throw errors.RuntimeError(errors.ErrorCode.RuntimeArgumentsSchemaParseMethodThrew, filterToExecute.id, `\`arguments.parse\` (from definition options) threw an error or could not be called.\n\t${err}`);
            }
        }

        filter.mainFunction({
            args
        });
    }

    if (!buildFlags.production && !buildFlags.package) {
        // copy packs to com.mojang
        if (config.packs.includes('BP')) (async () => {
            const destPath = path.join(config.comMojangPath, 'development_behavior_packs', config.packName);
            await fs.rm(destPath, { recursive: true, force: true });
            await fs.cp(BPPath, destPath, { recursive: true });
            console.log(`Copied \`${BPPath}\` to \`${destPath}\`. Use \`--production\` to disable this.`)
        })();

        if (config.packs.includes('RP')) (async () => {
            const destPath = path.join(config.comMojangPath, 'development_resource_packs', config.packName);
            await fs.rm(destPath, { recursive: true, force: true });
            await fs.cp(RPPath, destPath, { recursive: true });
            console.log(`Copied \`${RPPath}\` to \`${destPath}\`. Use \`--production\` to disable this.`)
        })();
    }

    if (buildFlags.package) {
        // zip dist to .mcaddon
        if (existsSync('tmp')) throw errors.InternalError(errors.ErrorCode.InternalBuildPackageTmpFileExists, `Cannot package project. There is already a file at \`tmp\`.`);
        const output = createWriteStream('tmp');
        const archive = archiver('zip');

        archive.on('warning', err => {
            throw errors.InternalError(errors.ErrorCode.InternalBuildPackageArchiverWarning, err);
        });

        archive.on('error', err => {
            throw errors.InternalError(errors.ErrorCode.InternalBuildPackageArchiverError, err);
        });

        archive.pipe(output);
        archive.directory(config.outPath, false);

        await archive.finalize();

        const packagedArchivePath = path.join(config.outPath, `${config.packName}.mcaddon`);
        await fs.rename('tmp', packagedArchivePath);
        console.log(`Packaged files at \`${config.outPath}\` into archive \`${packagedArchivePath}\`.`);
    }
}