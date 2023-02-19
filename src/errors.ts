import { ZodIssue } from 'zod';

export function error(type: string, message: string) {
    throw `BlockBuild${type}: ${message}`;
}

export function CLIError(message: string) {
    error('CLIError', message);
}

export function ZodError(message: string, issue: ZodIssue) {
    error('ZodError', `${message}\n\tat ${issue.path.join('.')}\n\t${issue.code}: ${issue.message}`)
}

ZodError.tryParseSchema = (schema: any, data: any, errorMessage: string) => {
    const result = schema.safeParse(data);

    if (!result.success) ZodError(errorMessage, result.error.issues[0]);
    return result.data;
}