import { z } from 'zod';

const ConfigFilterExecuter = z.object({
    id: z.string(),
    arguments: z.object({}).catchall(z.unknown())
});

export const Config = z.object({
    srcPath: z.string().optional(),
    outPath: z.string().optional(),
    filters: z.array(ConfigFilterExecuter)
});

export type TConfig = z.infer<typeof Config>;

export interface IConfigRequired {
    srcPath: string,
    outPath: string,
    filters: z.infer<typeof ConfigFilterExecuter>[]
}