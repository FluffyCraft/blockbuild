import { z } from 'zod';

export default class StandardLibraryAPI {
    zod = z;
    log(message: unknown) {
        console.log(message);
    }
}