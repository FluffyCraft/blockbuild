import glob from 'glob';
import { existsSync } from 'fs';
import * as path from 'path/win32';
import StandardLibraryAPI from './stdlib.js';
import * as types from './types.js';

export async function evalExtensions(context: types.IContext) {
    const stdlib = new StandardLibraryAPI(context);

    const modules: {
        std: typeof stdlib,
        [module: string]: any
    } = {
        std: stdlib
    };

    async function addExtensionExportsToContext(moduleURL: string, namespace: string) {
        modules[namespace] = await (await import(moduleURL)).default({
            context,
            std: stdlib
        });
    }

    const cwd = process.cwd();
    const projectExtensionFilePath = path.join(cwd, context.config.srcPath, 'api-extension.js');

    const promises: Promise<void>[] = [];
    if (existsSync(projectExtensionFilePath)) promises.push(addExtensionExportsToContext(`file://${projectExtensionFilePath}`, 'project'));

    for (const filePath of glob.sync(`.blockbuild/modules/*/api-extension.js`, { nodir: true })) promises.push(addExtensionExportsToContext(`file://${path.join(cwd, filePath)}`, filePath.split('/')[2]));

    await Promise.all(promises);

    return modules;
}