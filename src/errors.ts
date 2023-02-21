import { ZodIssue } from 'zod';
import chalk from 'chalk';

export const enum ErrorCode {
    CLIParseEqualsAfterDash = 'CLI_0',
    CLIMissingRequiredArgument = 'CLI_1',
    CLIArgumentUnexpectedType = 'CLI_2',
    CLIMissingRequiredFlag = 'CLI_3',
    CLIFlagUnexpectedType = 'CLI_4',
    CLICommandNotFound = 'CLI_5',

    RuntimeModuleLinkerModuleNotFound = 'RT_0',
    RuntimeEvalFilterParseDefOpts = 'RT_1',
    RuntimeEvalFilterAwaitFilterProm = 'RT_2',

    InternalEvalFiltersGetLinker = 'I_0',
    InternalBuildFilterNotFound = 'I_1',

    UncaughtCLI = 'U_0',

    ZodContainsChildError = 'Z_0',
    ZodParseConfigAsRequiredFailParse = 'Z_1'
}

export const error = (type: string, errorCode: ErrorCode, message: string | Error) => `${chalk.redBright(`BlockBuild${type}`)} (${errorCode}): ${message}`;
export const CLIError = (errorCode: ErrorCode, message: string) => error('CLIError', errorCode, message);
export const RuntimeError = (errorCode: ErrorCode, filterId: string, message: string) => error('RuntimeError', errorCode, `In \`${filterId}\`\n\t${message}`);
export const InternalError = (errorCode: ErrorCode, message: string) => error('InternalError', errorCode, message);
export const UncaughtError = (errorCode: ErrorCode, err: Error) => error('UncaughtError', errorCode, err);

export const ZodError = (errorCode: ErrorCode, message: string, issue: ZodIssue) => error('ZodError', errorCode, `${message}\n\tAt \`${issue.path.join('.')}\`\n\t${issue.code}: ${issue.message}`);
ZodError.tryParseSchema = (schema: any, data: any, errorCode: ErrorCode, errorMessage: string) => {
    const result = schema.safeParse(data);

    if (!result.success) throw ZodError(errorCode, errorMessage, result.error.issues[0]);
    return result.data;
}