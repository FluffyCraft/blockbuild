import chalk from 'chalk';

interface IParsedArgv {
    command?: string,
    arguments: unknown[],
    flags: {
        [flag: string]: unknown
    }
}

function parseArgv(): IParsedArgv {
    const argv = process.argv.slice(2);
    const parsedArgv: IParsedArgv = {
        arguments: [],
        flags: {}
    };

    argLoop: for (const arg of argv) {
        if (arg.startsWith('--')) {
            const [key, value] = arg.split('=');
            parsedArgv.flags[key.slice(2)] = value === undefined ? true : value;
            continue;
        }

        if (arg.startsWith('-')) {
            let lastFlag;
            const chars = arg.slice(1);
            for (const char of chars) {
                if (char === '=') {
                    if (!lastFlag) throw 'Error parsing flags. Found `=` immediately after `-`.'
                    parsedArgv.flags[lastFlag] = chars.split('=')[1];
                    continue argLoop;
                }

                if (lastFlag !== undefined) parsedArgv.flags[lastFlag] = true;
                lastFlag = char;
            }

            if (lastFlag) parsedArgv.flags[lastFlag] = true;
            continue;
        }

        if (!parsedArgv.command) {
            parsedArgv.command = arg;
            continue;
        }

        parsedArgv.arguments.push(arg);
    }

    return parsedArgv;
}

export function boolean(v: unknown) {
    switch (v) {
        case 'true':
            return true;
        case 'false':
            return false;
    }

    return NaN;
}

type TType = typeof String | typeof boolean | typeof Number;

interface ICLICommandArg {
    name: string,
    type?: TType,
    defaultValue?: any
}

interface ICLICommandFlag {
    name: string,
    alias?: string,
    type?: TType,
    defaultValue?: any
}

interface ICLICommandCallbackFlags {
    [name: string]: unknown
}

export class CLICommand {
    args;
    flags;
    callback;

    constructor(args: ICLICommandArg[], flags: ICLICommandFlag[], callback: (flags: ICLICommandCallbackFlags, ...args: any[]) => void) {
        this.args = args;
        this.flags = flags;
        this.callback = callback;
    }

    call(argv: IParsedArgv) {
        const evaluatedArgs = [];

        for (let i = 0; i < this.args.length; i++) {
            const expectedArg = this.args[i];
            const arg = argv.arguments[i];

            if (arg === undefined) {
                if (expectedArg.defaultValue === undefined) throw `Missing required positional argument ${i}; \`${expectedArg.name}\`.`;
                evaluatedArgs.push(expectedArg.defaultValue);
                continue;
            }

            const coalescedArg = expectedArg.type ? expectedArg.type(arg) : arg;

            if (Number.isNaN(coalescedArg)) throw `Unexpected type for positional argument ${i}; \`${expectedArg.name}\`. Expected \`${expectedArg.type?.name.toLowerCase()}\`, got \`${typeof arg}\`.`;

            evaluatedArgs.push(coalescedArg);
        }

        const evaluatedFlags: ICLICommandCallbackFlags = {};

        for (const expectedFlag of this.flags) {
            let flag = argv.flags[expectedFlag.name];

            if (flag === undefined && expectedFlag.alias) flag = argv.flags[expectedFlag.alias];
            if (flag === undefined) {
                if (expectedFlag.defaultValue === undefined) throw `Missing required flag; \`--${expectedFlag.name}\`${expectedFlag.alias ? ` (\`-${expectedFlag.alias}\`)` : ''}.`;
                evaluatedFlags[expectedFlag.name] = expectedFlag.defaultValue;
                continue;
            }

            const coalescedFlag = expectedFlag.type ? expectedFlag.type(flag) : flag;

            if (Number.isNaN(coalescedFlag)) throw `Unexpected type for flag; \`--${expectedFlag.name}\`${expectedFlag.alias ? ` (\`-${expectedFlag.alias}\`)` : ''}. Expected \`${expectedFlag.type?.name.toLowerCase()}\`, got \`${typeof flag}\`.`;

            evaluatedFlags[expectedFlag.name] = coalescedFlag;
        }

        this.callback(evaluatedFlags, ...evaluatedArgs);
    }
}

interface ICLICommands {
    [command: string]: CLICommand
}

export function cli(commands: ICLICommands) {
    try {
        const argv = parseArgv();

        if (!argv.command) {
            console.log('cli help');
            return;
        }

        const command = commands[argv.command];
        if (!command) throw `The command, \`${argv.command}\`, does not exist.`;

        command.call(argv);
    }
    catch (err) {
        console.log(`${chalk.bgRed(' COMMAND ERROR ')} ${err}`);
    }
}