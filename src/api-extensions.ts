import glob from 'glob';
import { existsSync } from 'fs';
import * as path from 'path';

export async function evalExtensions(srcPath: string) {
    const context: {
        [module: string]: any
    } = {};

    async function addExtensionExportsToContext(moduleURL: string, namespace: string) {
        context[namespace] = await import(moduleURL);
    }

    const cwd = process.cwd();
    const projectExtensionFilePath = path.join(cwd, srcPath, 'api-extension.js');

    const promises: Promise<void>[] = [];
    if (existsSync(projectExtensionFilePath)) promises.push(addExtensionExportsToContext(`file://${projectExtensionFilePath}`, 'project'));

    for (const filePath of glob.sync(`.blockbuild/modules/*/api-extension.js`, { nodir: true })) promises.push(addExtensionExportsToContext(`file://${path.join(cwd, filePath)}`, filePath.split('/')[2]));

    await Promise.all(promises);

    return context;
}