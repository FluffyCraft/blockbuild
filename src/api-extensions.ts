import * as vm from 'vm';
import glob from 'glob';
import { existsSync } from 'fs';
import * as path from 'path';

export async function getLinker(srcPath: string) {
    const modules: {
        [module: string]: any //* vm.SyntheticModule
    } = {};

    const projectContextFilePath = path.join(process.cwd(), srcPath, 'api-extension.js');
    const projectContextFileURL = `file://${projectContextFilePath}`;

    if (existsSync(projectContextFilePath)) {
        const module = await import(projectContextFileURL);

        const moduleExports: {
            [exportName: string]: unknown
        } = {};

        for (const moduleExport in module) moduleExports[moduleExport] = module[moduleExport];

        // @ts-ignore
        modules.project = new vm.SyntheticModule(
            Object.keys(moduleExports),
            () => { //* this: vm.SyntheticModule
                // @ts-ignore
                for (const [exportName, exportValue] of Object.entries(moduleExports)) this.setExport(exportName, exportValue);
            },
            { identifier: 'project' }
        );
    }

    // for (const file of glob.sync(`.blockbuild/modules/**/api-extension.js`, { nodir: true })) {

    // }

    return (specifier: string) => {
        const module = modules[specifier];
        if (!module) throw `ModuleReferenceError: API extension; \`${specifier}\`, does not exist.`
        return module;
    }
}