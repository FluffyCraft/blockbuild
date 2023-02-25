/*
BlockBuild - A Minecraft addon compiler.
Copyright (C) 2023 FluffyCraft

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.

EMAIL: contact@fluffycraft.net
*/

import { ZodIssue } from "zod";
import chalk from "chalk";

export const enum ErrorCode {
  NoErrorCode = "NONE", //! only use NoErrorCode if the error contains (or is contained by) an error which has an error code

  CLIParseEqualsAfterDash = "CLI0",
  CLIMissingRequiredArgument = "CLI1",
  CLIArgumentUnexpectedType = "CLI2",
  CLIMissingRequiredFlag = "CLI3",
  CLIFlagUnexpectedType = "CLI4",
  CLICommandNotFound = "CLI5",
  CLIInitNoBPOrRP = "CLI6",

  RuntimeArgumentsSchemaNoParseMethod = "RT0",
  RuntimeEvalFilterParseDefOpts = "RT1",
  RuntimeEvalFilterAwaitFilterProm = "RT2",
  RuntimeArgumentsSchemaParseMethodThrew = "RT3",

  InternalBuildFilterNotFound = "I1",
  InternalConfigReadError = "I2",
  InternalConfigJSONParseError = "I3",
  InternalBPNotFound = "I4",
  InternalRPNotFound = "I5",
  InternalBuildPackageArchiverWarning = "I6",
  InternalBuildPackageArchiverError = "I7",
  InternalBuildPackageTmpFileExists = "I8",

  UncaughtCLI = "U0",

  ZodEvalConfigFailParse = "Z1"
}

export const error = (type: unknown, errorCode: ErrorCode, message: unknown) => `${chalk.redBright(`BlockBuild${type}`)} (${errorCode}): ${message}`;
export const CLIError = (errorCode: ErrorCode, message: unknown) => error("CLIError", errorCode, message);
export const RuntimeError = (errorCode: ErrorCode, filterId: unknown, message: unknown) => error("RuntimeError", errorCode, `In \`${filterId}\`\n\t${message}`);
export const InternalError = (errorCode: ErrorCode, message: unknown) => error("InternalError", errorCode, message);
export const UncaughtError = (errorCode: ErrorCode, err: Error) => error("UncaughtError", errorCode, err);

export const ZodError = (errorCode: ErrorCode, message: unknown, issue: ZodIssue) =>
  error("ZodError", errorCode, `${message}\n\tAt \`${issue.path.join(".")}\`\n\t${issue.code}: ${issue.message}`);
ZodError.tryParseSchema = (schema: any, data: any, errorCode: ErrorCode, errorMessage: unknown) => {
  const result = schema.safeParse(data);

  if (!result.success) throw ZodError(errorCode, errorMessage, result.error.issues[0]);
  return result.data;
};
