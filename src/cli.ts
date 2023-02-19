#!/usr/bin/env node

import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import chalk from 'chalk';
import fetch from 'node-fetch';
import * as path from 'path';
import { execSync } from 'child_process';
import * as os from 'os';

/*
config
{
    path?: string, // The path to find the project.
    outPath?: string, // The path to output the built project.
    packName?: string, // The name of the folder to place the pack in. eg. com.mojang/development_behavior_packs/PackNameHere
    devOutPath?: string | { // The path to output the built project.
        fromHomeDir?: boolean,
        path: string
    },
    scripts?: { // Scripts that can be executed with blockb run
        [script: string]: string
    }
}
*/

// async function cliAction(startMessage: string, successMessage: string, failMessage: string, callback: () => void) {
//     console.log(`${chalk.bgBlue(' START ')} ${startMessage}\n`);

//     const timeLabel = `${chalk.bgCyan(' EXIT ')} Operation exited in`;
//     console.time(timeLabel);

//     let errorThrown = false;
//     try {
//         await callback(); // await since it might be async
//     }
//     catch (err) {
//         errorThrown = true;
//         console.log(`${chalk.bgRed(' FATAL ')} ${err}\n`);
//     }

//     console.timeEnd(timeLabel);
//     console.log('\n' + (errorThrown ? `${chalk.bgRed(' FAIL ')} ${failMessage}` : `${chalk.bgGreen(' SUCCESS ')} ${successMessage}`));
// }

// async function getConfig() {
//     return existsSync('blockbuild.config.json') ? JSON.parse(await fs.readFile('blockbuild.config.json', 'utf8')) : {};
// }

// cli
//     .name('blockb')
//     .description('BlockBuild CLI')
//     .version('1.0.0', '--version', 'Outputs the current version of BlockBuild.')
//     .helpOption('--help', 'Returns the details of a command.')
//     .addHelpCommand(false);

// cli.command('build')
//     .alias('b')
//     .description('Build a project.')
//     .argument('[path]', 'The path to find the project.')
//     .argument('[outPath]', 'The path to output the built project.')
//     .action((path_, outPath) => cliAction('Building project.', 'Built project.', 'Could not build project.',
//         async () => {
//             const config = await getConfig();
//             config.path = path_ || config.path || '.';
//             config.outPath = outPath || config.outPath || 'dist';
//             //await build(config);
//         }
//     ));

// cli.command('builddev')
//     .alias('bd')
//     .description('Build a project and copy it to com.mojang development packs')
//     .argument('[path]', '')
//     .argument('[outPath]', '')
//     .argument('[devOutPath]', '')
//     .action((path_, outPath, devOutPath) => cliAction('Building project.', 'Built project.', 'Could not build project.',
//         async () => {
//             const config = await getConfig();

//             if (!config.packName) throw '`packName` must be defined in the config file.';

//             config.path = path_ || config.path || '.';
//             config.outPath = outPath || config.outPath || 'dist';

//             const evaluatedDevOutPath = devOutPath
//                 || (
//                     typeof config.devOutPath === 'object'
//                         ? (
//                             config.devOutPath.fromHomeDir
//                                 ? path.join(os.homedir(), config.devOutPath.path)
//                                 : config.devOutPath.path
//                         )
//                         : config.devOutPath
//                 )
//                 || path.join(os.homedir(), 'AppData', 'Local', 'Packages', 'Microsoft.MinecraftUWP_8wekyb3d8bbwe', 'LocalState', 'games', 'com.mojang');

//             //await build(config);

//             const bpOut = path.join(evaluatedDevOutPath, 'development_behavior_packs', config.packName);
//             const rpOut = path.join(evaluatedDevOutPath, 'development_resource_packs', config.packName);

//             await Promise.all([
//                 fs.rm(bpOut, { force: true, recursive: true }),
//                 fs.rm(rpOut, { force: true, recursive: true })
//             ]);

//             await Promise.all([
//                 fs.cp(path.join(config.outPath, 'BP'), bpOut, { recursive: true }),
//                 fs.cp(path.join(config.outPath, 'RP'), rpOut, { recursive: true })
//             ]);
//         }
//     ));

// cli.command('buildpackage')
//     .alias('bpkg')
//     .description('Build a package.')
//     .argument('[path]', 'The path to find the package', '.')
//     .action(path_ => cliAction('Building package.', 'Built package.', 'Could not build package.',
//         async () => {
//             const config = await getConfig();
//             config.path = path_ || config.path;
//             //await buildPackage(config);
//         }
//     ));

// cli.command('install')
//     .alias('ins')
//     .description('Install a package from the mob-mc/packages repository.')
//     .argument('<packageName>', 'The name of the package to install.')
//     .action(packageName => cliAction(`Installing ${packageName}.`, `Installed ${packageName}.`, `Could not install ${packageName}.`,
//         async () => {
//             interface GitHubTreeFetchResponse {
//                 sha: string,
//                 url: string,
//                 tree: {
//                     path: string,
//                     mode: string,
//                     type: string,
//                     sha: string,
//                     size: number,
//                     url: string
//                 }[],
//                 truncated: boolean
//             }

//             interface GitHubBlobFetchResponse {
//                 sha: string,
//                 node_id: string,
//                 size: number,
//                 url: string,
//                 content: string,
//                 encoding: string
//             }

//             const tree = (await (await fetch('https://api.github.com/repos/FluffyCraft/mob-packages/git/trees/4dad33917ca6410769dcdd035b0fa91d06c15636')).json() as GitHubTreeFetchResponse).tree;
//             const packageFile = tree.find(({ path }) => path === packageName);
//             if (!packageFile) throw 'Cannot find the requested package.';
//             const blob = (await (await fetch(packageFile.url)).json()) as GitHubBlobFetchResponse;
//             // @ts-ignore
//             const fileContent = Buffer.from(blob.content, blob.encoding).toString();

//             await fs.mkdir('.mobpkgs', { recursive: true });
//             await fs.writeFile(path.join('.mobpkgs', packageName), fileContent);
//         }
//     ));

// cli.command('uninstall')
//     .alias('unins')
//     .description('Uninstall a package installed with `mob install`.')
//     .argument('<packageName>', 'The name of the package to uninstall.');

// cli.command('run')
//     .alias('r')
//     .description('Execute a script defined in `mobconfig.json`.')
//     .argument('<script>', 'The script to execute.')
//     .action(script => cliAction(`Executing ${script}.`, `Executed ${script}.`, `Could not execute ${script}.`,
//         async () => {
//             const scripts = (await getConfig()).scripts;
//             if (!scripts) throw 'No scripts defined.';
//             if (typeof scripts[script] !== 'string') throw `${script} is not defined or is not a string.`;

//             console.log(chalk.yellow('-- SCRIPT OUTPUT BEGIN --'))
//             execSync(scripts[script], { shell: 'powershell.exe', stdio: 'inherit' });
//             console.log(chalk.yellow('-- SCRIPT OUTPUT END --\n'))
//         }
//     ));

// cli.command('init')
//     .description('Initialize a project.')
//     .argument('[path]', 'The path to initialize the project in.', '.')
//     .option('--package|-p', 'Initialize a package ready to publish to FluffyCraft/mob-packages instead of a normal project.')
//     .action((path, options) => {
//         console.log(options);
//         console.log('init');
//     });

// cli.parse();

import { cli, CLICommand, boolean } from './cliApi.js';

const version = new CLICommand(() => console.log('v0.1.0'), 'Returns the current version of BlockBuild.');
const build = new CLICommand(
    () => { },
    'Builds a project.',
    [
        {
            name: 'path',
            description: 'The path to find the source files.',
            type: String,
            defaultValue: '.'
        },
        {
            name: 'outPath',
            description: 'The path to output the built project.',
            type: String,
            defaultValue: 'dist'
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
            description: 'Package as a .mcaddon file.'
        }
    ]
)

cli({
    version,
    build
});