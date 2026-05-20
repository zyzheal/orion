/**
 * SubApp Service Index
 */

import { SubAppRepository } from './SubAppRepository';
import { SubAppService } from './SubAppService';

export { SubAppRepository } from './SubAppRepository';
export { SubAppService } from './SubAppService';
export type { SubAppConfig, CreateSubAppInput, UpdateSubAppInput, SubAppConfigHistory } from './SubAppRepository';

export default {
  SubAppRepository,
  SubAppService,
};