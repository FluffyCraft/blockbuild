// get all context bridge files from src/contextBridge.js and .cobweb/modules/*/contextBridge.js
// add all methods from the context bridge files to an object, all of them will be namespaced based on their module
// copy src/public to dist
// execute all filters in node:vm and pass the context bridge exposed variables to context

import * as apiExtensions from './api-extensions.js';
import * as zTypes from './zod-types.js';
import * as vm from 'vm';
import * as fs from 'fs';
import * as errors from './errors.js';
import glob from 'glob';
import { z } from 'zod';
import * as path from 'path';

const FilterArgumentDefinition = z.string().min(1).or(z.object({
    name: z.string(),
    schema: z.any().optional()
}));

const FilterDefinitionOptions = z.object({
    arguments: z.array(FilterArgumentDefinition).optional()
});

type TFilterDefinitionOptions = z.infer<typeof FilterDefinitionOptions>;

class Filter {
    mainFunction;
    definitionOptions;

    constructor(mainFunction: () => void, definitionOptions: TFilterDefinitionOptions) {
        this.mainFunction = mainFunction;
        this.definitionOptions = definitionOptions;
    }
}

async function evalFilters(srcPath: string) {
    const api = await apiExtensions.evalExtensions(srcPath);

    const filters: {
        [id: string]: Filter
    } = {};

    async function evalFilter(filePath: string, namespace: string, id: string) {
        let definitionOptions: TFilterDefinitionOptions | undefined;

        const context = vm.createContext({
            filter: (o: TFilterDefinitionOptions) => definitionOptions = o,
            main() {
                throw 'Main function not defined.';
            },
            context: {
                namespace
            },
            api: {
                $this: api[namespace] ?? {},
                ...api
            }
        });

        vm.runInContext(fs.readFileSync(filePath, 'utf8'), context);

        filters[id] = new Filter(
            context.main,
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

    for (const filePath of glob.sync(`${srcPath}/filters/**/*.js`, { nodir: true })) {
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

export async function build(config: zTypes.IConfigRequired) {
    const filters = await evalFilters(config.srcPath);

    for (const filterToExecute of config.filters) {
        const filter = filters[filterToExecute.id];
        if (!filter) throw errors.InternalError(errors.ErrorCode.InternalBuildFilterNotFound, `Cannot execute filter with id; \`${filterToExecute.id}\`, because it does not exist.`);
    }
}