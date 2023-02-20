import { ZodIssue } from 'zod';
import chalk from 'chalk';

export const error = (type: string, message: string) => `${chalk.redBright(`BlockBuild${type}:`)} ${message}`;
export const CLIError = (message: string) => error('CLIError', message);
export const RuntimeError = (filterId: string, message: string) => error('RuntimeError', `In \`${filterId}\`\n\t${message}`);
export const InternalError = (message: string) => error('InternalError', message);

export const ZodError = (message: string, issue: ZodIssue) => error('ZodError', `${message}\n\tAt \`${issue.path.join('.')}\`\n\t${issue.code}: ${issue.message}`);
ZodError.tryParseSchema = (schema: any, data: any, errorMessage: string) => {
    const result = schema.safeParse(data);

    if (!result.success) throw ZodError(errorMessage, result.error.issues[0]);
    return result.data;
}