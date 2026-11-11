import { createDexieRepositories } from '../data/dexieRepositories';
import { AppDB } from '../data/db';

export const db = new AppDB();
export const repos = createDexieRepositories(db);
