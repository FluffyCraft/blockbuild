import { z } from 'zod';

const ConfigFilterExecuter = z.object({
    id: z.string(),
    arguments: z.object({}).catchall(z.unknown()).optional()
});

export const Config = z.object({
    packName: z.string().min(1),
    srcPath: z.string().optional(),
    outPath: z.string().optional(),
    comMojangPath: z.string().min(1).or(z.object({
        fromHomeDir: z.boolean().optional(),
        path: z.string().min(1)
    })).optional(),
    packs: z.array(z.literal('BP').or(z.literal('RP'))).max(2).min(1),
    filters: z.array(ConfigFilterExecuter)
});

export type TConfig = z.infer<typeof Config>;

export interface IConfigEvaluated {
    packName: string,
    srcPath: string,
    outPath: string,
    comMojangPath: string,
    packs: ('BP' | 'RP')[]
    filters: z.infer<typeof ConfigFilterExecuter>[]
}