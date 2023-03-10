/*
BlockBuild - A Minecraft addon compiler.
Copyright (C) 2023 FluffyCraft

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License v3.0 as published by
the Free Software Foundation.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.

EMAIL: contact@fluffycraft.net
*/

import chalk from "chalk";
import * as errors from "./errors.js";

interface IParsedArgv {
	command?: string;
	arguments: unknown[];
	flags: {
		[flag: string]: unknown;
	};
}

function parseArgv(): IParsedArgv {
	const argv = process.argv.slice(2);
	const parsedArgv: IParsedArgv = {
		arguments: [],
		flags: {}
	};

	argLoop: for (const arg of argv) {
		if (arg.startsWith("--")) {
			const [key, value] = arg.split("=");
			parsedArgv.flags[key.slice(2)] = value === undefined ? true : value;
			continue;
		}

		if (arg.startsWith("-")) {
			let lastFlag;
			const chars = arg.slice(1);
			for (const char of chars) {
				if (char === "=") {
					if (!lastFlag)
						throw errors.CLIError(
							errors.ErrorCode.CLIParseEqualsAfterDash,
							"Error parsing flags. Found `=` immediately after `-`."
						);
					parsedArgv.flags[lastFlag] = chars.split("=")[1];
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
		case true:
		case "true":
			return true;
		case false:
		case "false":
			return false;
	}

	return NaN;
}

type TType = typeof String | typeof boolean | typeof Number;

interface ICLICommandArg {
	name: string;
	type?: TType;
	defaultValue?: any;
	useDefaultValue?: boolean; // default is true
	description: string;
}

interface ICLICommandFlag {
	name: string;
	alias?: string;
	type?: TType; // default is boolean, to accept any, set it to undefined.
	defaultValue?: any; // default is false, if you do not want a default value, set it to undefined
	useDefaultValue?: boolean; // default is true
	description: string;
}

interface ICLICommandCallbackFlags {
	[name: string]: unknown;
}

function getNameOfType(type?: TType) {
	return type ? type.name.toLowerCase() : "any";
}

function formatDefaultValue(defaultValue: any, type?: TType) {
	return type === String ? chalk.green(`"${defaultValue}"`) : chalk.red(defaultValue);
}

export class CLICommand {
	args;
	flags;
	description;
	callback;

	constructor(
		callback: (flags: ICLICommandCallbackFlags, ...args: any[]) => void,
		description: string,
		args: ICLICommandArg[] = [],
		flags: ICLICommandFlag[] = []
	) {
		this.flags = flags.map(arg => {
			if (!("defaultValue" in arg)) arg.defaultValue = false;
			if (!("type" in arg)) arg.type = boolean;
			return arg;
		});

		this.args = args;
		this.description = description;
		this.callback = callback;
	}

	async call(argv: IParsedArgv) {
		const evaluatedArgs = [];

		for (let i = 0; i < this.args.length; i++) {
			const expectedArg = this.args[i];
			const arg = argv.arguments[i];

			if (arg === undefined) {
				if (expectedArg.defaultValue === undefined)
					throw errors.CLIError(
						errors.ErrorCode.CLIMissingRequiredArgument,
						`Missing required positional argument ${i} (\`${expectedArg.name}\`).`
					);
				evaluatedArgs.push(expectedArg.useDefaultValue === false ? undefined : expectedArg.defaultValue);
				continue;
			}

			const coalescedArg = expectedArg.type ? expectedArg.type(arg) : arg;

			if (Number.isNaN(coalescedArg))
				throw errors.CLIError(
					errors.ErrorCode.CLIArgumentUnexpectedType,
					`Unexpected type for positional argument ${i} (\`${expectedArg.name}\`). Expected \`${getNameOfType(
						expectedArg.type
					)}\`, got \`${typeof arg}\`.`
				);

			evaluatedArgs.push(coalescedArg);
		}

		const evaluatedFlags: ICLICommandCallbackFlags = {};

		for (const expectedFlag of this.flags) {
			let flag = argv.flags[expectedFlag.name];

			if (flag === undefined && expectedFlag.alias) flag = argv.flags[expectedFlag.alias];
			if (flag === undefined) {
				if (expectedFlag.defaultValue === undefined)
					throw errors.CLIError(
						errors.ErrorCode.CLIMissingRequiredFlag,
						`Missing required flag \`--${expectedFlag.name}\`${
							expectedFlag.alias ? ` (\`-${expectedFlag.alias}\`)` : ""
						}.`
					);
				evaluatedFlags[expectedFlag.name] =
					expectedFlag.useDefaultValue === false ? undefined : expectedFlag.defaultValue;
				continue;
			}

			const coalescedFlag = expectedFlag.type ? expectedFlag.type(flag) : flag;

			if (Number.isNaN(coalescedFlag))
				throw errors.CLIError(
					errors.ErrorCode.CLIFlagUnexpectedType,
					`Unexpected type for flag \`--${expectedFlag.name}\`${
						expectedFlag.alias ? ` (\`-${expectedFlag.alias}\`)` : ""
					}. Expected \`${getNameOfType(expectedFlag.type)}\`, got \`${typeof flag}\`.`
				);

			evaluatedFlags[expectedFlag.name] = coalescedFlag;
		}

		await this.callback(evaluatedFlags, ...evaluatedArgs);
	}

	print(name: string) {
		console.log(`${chalk.blue(name)} - ${this.description}`);

		if (this.args.length) {
			console.log(`\t${chalk.bold("Positional Arguments:")}`);
			for (const arg of this.args)
				console.log(
					`\t\t${chalk.blue(arg.defaultValue !== undefined ? `[${arg.name}]` : `<${arg.name}>`)}${chalk.green(
						`: ${getNameOfType(arg.type)}`
					)} - ${arg.description}${
						arg.defaultValue !== undefined ? ` (Default: ${formatDefaultValue(arg.defaultValue, arg.type)})` : ""
					}`
				);
		}

		if (this.flags.length) {
			console.log(`\t${chalk.bold("Flags:")}`);
			for (const flag of this.flags)
				console.log(
					`\t\t${chalk.blue(flag.defaultValue !== undefined ? `[--${flag.name}]` : `<--${flag.name}>`)}${
						flag.alias ? ` (-${flag.alias})` : ""
					}${chalk.green(`: ${getNameOfType(flag.type)}`)} - ${flag.description}${
						flag.defaultValue !== undefined ? ` (Default: ${formatDefaultValue(flag.defaultValue, flag.type)})` : ""
					}`
				);
		}
	}
}

interface ICLICommands {
	[command: string]: CLICommand;
}

export async function cli(commands: ICLICommands) {
	try {
		const argv = parseArgv();

		if (!argv.command) {
			console.log(
				`${chalk.bold(chalk.blue("BlockBuild CLI"))}\nUsage: ${chalk.yellowBright(
					"blockb"
				)} [command] [arguments] [flags]\n\n${chalk.bold("Commands:")}`
			);
			for (const [commandName, command] of Object.entries(commands)) command.print(commandName);
			return;
		}

		const command = commands[argv.command];
		if (!command)
			throw errors.CLIError(errors.ErrorCode.CLICommandNotFound, `The command \`${argv.command}\` does not exist.`);

		await command.call(argv);
	} catch (err) {
		if (err instanceof Error) err = errors.UncaughtError(errors.ErrorCode.UncaughtCLI, err);
		console.log(`${chalk.bgRed(" FATAL ")} ${err}`);
	}
}
