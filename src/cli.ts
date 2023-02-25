#!/usr/bin/env node

import { cli, CLICommand, boolean } from "./cli-api.js";
import * as blockb from "./index.js";
import * as fs from "fs/promises";
import * as types from "./types.js";
import * as errors from "./errors.js";
import * as path from "path/win32";
import * as os from "os";
import * as constants from "./constants.js";
import { randomUUID } from "crypto";

interface IParseConfigAsRequiredOptions {
  srcPath?: string;
  outPath?: string;
}

async function evalConfig(options: IParseConfigAsRequiredOptions) {
  const configRaw = await fs
    .readFile("blockbuild.config.json", "utf8")
    .catch((err) => {
      throw errors.InternalError(
        errors.ErrorCode.InternalConfigReadError,
        `Failed to read config file.\n\t${err}`
      );
    });

  let configJSON;

  try {
    configJSON = JSON.parse(configRaw);
  } catch (err) {
    throw errors.InternalError(
      errors.ErrorCode.InternalConfigJSONParseError,
      `Failed to parse config file.\n\t${err}`
    );
  }

  const config = errors.ZodError.tryParseSchema(
    types.Config,
    configJSON,
    errors.ErrorCode.ZodEvalConfigFailParse,
    "Error parsing config."
  );

  config.srcPath = options.srcPath || config.srcPath || "src";
  config.outPath = options.outPath || config.outPath || "dist";
  config.comMojangPath =
    typeof config.comMojangPath === "object"
      ? config.comMojangPath.fromHomeDir
        ? path.join(os.homedir(), config.comMojangPath.path)
        : config.comMojangPath.path
      : config.comMojangPath ||
        path.join(
          os.homedir(),
          "AppData/Local/Packages/Microsoft.MinecraftUWP_8wekyb3d8bbwe/LocalState/games/com.mojang"
        );

  return config as types.IConfigEvaluated;
}

const version = new CLICommand(
  async () =>
    console.log(`Installed BlockBuild version: v${constants.version}`),
  "Returns the current version of BlockBuild."
);
const build = new CLICommand(
  async (flags, srcPath?: string, outPath?: string) => {
    await blockb.build(await evalConfig({ srcPath, outPath }), flags);
  },
  "Builds a project.",
  [
    {
      name: "srcPath",
      description: "The path to find the source files.",
      type: String,
      defaultValue: "src",
      useDefaultValue: false
    },
    {
      name: "outPath",
      description: "The path to output the built project.",
      type: String,
      defaultValue: "dist",
      useDefaultValue: false
    }
  ],
  [
    {
      name: "package",
      description:
        "Package as a .mcaddon file. Automatically uses --production."
    },
    {
      name: "production",
      description: "Build in production mode.",
      alias: "p"
    }
  ]
);
const init = new CLICommand(
  async (flags, packName: string, authors: string) => {
    if (flags.noBP && flags.noRP)
      throw errors.CLIError(
        errors.ErrorCode.CLIInitNoBPOrRP,
        "`--noBP` and `--noRP` cannot be used together."
      );

    await fs.mkdir("src");

    const packs = [];
    if (!flags.noBP) packs.push("BP");
    if (!flags.noRP) packs.push("RP");

    const firstPromises: Promise<unknown>[] = [
      fs.mkdir("dist"),
      fs.mkdir("src/filters"),
      fs.writeFile(
        "src/api-extension.js",
        `export default function ({ context, std }) {\n\treturn {};\n}`
      ),
      fs.writeFile(
        "blockbuild.config.json",
        JSON.stringify(
          {
            packName,
            packs,
            filters: []
          },
          undefined,
          4
        )
      ),
      fs.writeFile(
        "package.json",
        JSON.stringify(
          {
            type: "module"
          },
          undefined,
          4
        )
      )
    ];

    if (!flags.noBP)
      firstPromises.push(fs.mkdir("src/packs/BP/texts", { recursive: true }));
    if (!flags.noRP)
      firstPromises.push(fs.mkdir("src/packs/RP/texts", { recursive: true }));

    await Promise.all(firstPromises);

    const secondPromises = [];

    const BPUUID = randomUUID();
    const RPUUID = randomUUID();

    if (!flags.noBP) {
      secondPromises.push(
        fs.writeFile(
          "src/packs/BP/manifest.json",
          JSON.stringify(
            {
              format_version: 2,
              metadata: {
                authors: authors.split(","),
                generated_with: { blockbuild: [constants.version] }
              },
              header: {
                name: "pack.name",
                description: "pack.description",
                min_engine_version: [1, 19, 0],
                uuid: BPUUID,
                version: [1, 0, 0]
              },
              modules: [
                {
                  type: "data",
                  uuid: randomUUID(),
                  version: [1, 0, 0]
                }
              ],
              dependencies: flags.noRP
                ? undefined
                : [
                    {
                      uuid: RPUUID,
                      version: [1, 0, 0]
                    }
                  ]
            },
            undefined,
            4
          )
        )
      );
      secondPromises.push(
        fs.writeFile(
          "src/packs/BP/texts/en_US.lang",
          `pack.name=${packName}\npack.description=`
        )
      );
      secondPromises.push(
        fs.writeFile(
          "src/packs/BP/texts/languages.json",
          JSON.stringify(["en_US"], undefined, 4)
        )
      );
    }
    if (!flags.noRP) {
      secondPromises.push(
        fs.writeFile(
          "src/packs/RP/manifest.json",
          JSON.stringify(
            {
              format_version: 2,
              metadata: {
                authors: authors.split(","),
                generated_with: { blockbuild: [constants.version] }
              },
              header: {
                name: "pack.name",
                description: "pack.description",
                min_engine_version: [1, 19, 0],
                uuid: RPUUID,
                version: [1, 0, 0]
              },
              modules: [
                {
                  type: "resources",
                  uuid: randomUUID(),
                  version: [1, 0, 0]
                }
              ],
              dependencies: flags.noBP
                ? undefined
                : [
                    {
                      uuid: BPUUID,
                      version: [1, 0, 0]
                    }
                  ]
            },
            undefined,
            4
          )
        )
      );
      secondPromises.push(
        fs.writeFile(
          "src/packs/RP/texts/en_US.lang",
          `pack.name=${packName}\npack.description=`
        )
      );
      secondPromises.push(
        fs.writeFile(
          "src/packs/RP/texts/languages.json",
          JSON.stringify(["en_US"], undefined, 4)
        )
      );
    }

    await Promise.all(secondPromises);
  },
  "Initializes a project",
  [
    {
      name: "packName",
      description: "The name of your pack. This will be used in the config.",
      type: String
    },
    {
      name: "authors",
      description: "The authors of your pack, separated by commas.",
      type: String
    }
  ],
  [
    {
      name: "noBP",
      description: "Do not create a behavior pack."
    },
    {
      name: "noRP",
      description: "Do not create a resource pack."
    }
  ]
);

await cli({
  build,
  init,
  version
});
