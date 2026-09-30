/*
 * Storage setup (`node dist/storage-setup.js`): creates the object storage buckets, turns on
 * versioning for documents and sets the expiry of import and export files, then exits. Runs from
 * the API image as a one-off job after the migrator; locally `pnpm storage:setup`.
 */
import { setUpStorage } from './modules/documents/index.js';
import { processLogger, readConfig } from './shared/bootstrap.js';

const config = readConfig();
const logger = processLogger('storage-setup', config);

// The store may still be starting (the job runs right after `compose up`): retry for a while.
for (let attempt = 1; ; attempt++) {
  try {
    const result = await setUpStorage(config.storage);
    logger.info(result, 'object storage ready');
    break;
  } catch (err) {
    if (attempt >= 30) {
      logger.fatal({ err }, 'object storage setup failed');
      process.exit(1);
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
}
