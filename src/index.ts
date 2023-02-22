import * as apiExtensions from './api-extensions.js';
import * as zTypes from './zod-types.js';
import * as vm from 'vm';
import * as fs from 'fs/promises';
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

interface IFilters {
    [id: string]: Filter
}

async function evalFilters(config: zTypes.IConfigRequired, buildFlags: unknown) {
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

export async function build(config: zTypes.IConfigRequired, buildFlags: unknown) {
    let filters: unknown;

    await fs.rm(config.outPath, { force: true, recursive: true });

    await Promise.all([
        evalFilters(config, buildFlags).then(res => filters = res),
        fs.cp(path.join(path.join(config.srcPath, 'pack')), config.outPath, { recursive: true })
    ]);

    for (const filterToExecute of config.filters) {
        const filter = (filters as IFilters)[filterToExecute.id];
        if (!filter) throw errors.InternalError(errors.ErrorCode.InternalBuildFilterNotFound, `Cannot execute filter with id \`${filterToExecute.id}\` because it does not exist.`);
        filter.mainFunction();
    }
}