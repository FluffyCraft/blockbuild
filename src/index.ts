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

export async function build(config: zTypes.IConfigRequired) {
    const vmLinker = apiExtensions.getLinker(config.srcPath).catch(err => {
        throw errors.InternalError(err);
    });

    const filters: {
        [id: string]: Promise<Filter>
    } = {};

    async function evalFilter(filePath: string, id: string) {
        let definitionOptions: TFilterDefinitionOptions | undefined;

        const context = vm.createContext({
            filter: (o: TFilterDefinitionOptions) => definitionOptions = o
        });

        // @ts-ignore
        const module = new vm.SourceTextModule(fs.readFileSync(filePath, 'utf8'), {
            identifier: id,
            context
        });

        await module.link(await vmLinker);
        await module.evaluate();

        if (!context.main) throw 'Main function not defined.'

        return new Filter(
            context.main,
            errors.ZodError.tryParseSchema(
                FilterDefinitionOptions,
                definitionOptions,
                errors.RuntimeError(id, 'Invalid definition options.')
            )
        );
    }

    function addPromiseToFilters(id: string, promise: Promise<Filter>) {
        promise.catch(err => {
            throw errors.RuntimeError(id, err);
        });
        filters[id] = promise;
    }

    for (const filePath of glob.sync(`${config.srcPath}/filters/**/*.js`, { nodir: true })) {
        const id = path.basename(filePath, '.js');
        addPromiseToFilters(id, evalFilter(filePath, id));
    }

    for (const filePath of glob.sync(`.blockbuild/modules/*/filters/**/*.js`, { nodir: true })) {
        const id = `${filePath.split('/')[2]}:${path.basename(filePath, '.js')}`;
        addPromiseToFilters(id, evalFilter(filePath, id));
    }

    console.log(filters);
}