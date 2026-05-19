/**
 * User Services - 用户服务模块
 *
 * 导出所有用户相关服务：
 * - UserRepository - 数据库访问层 (with PostgreSQL)
 * - UserService - 业务逻辑层
 * - UserProfileService - 用户档案服务
 */

export {
  UserRepository,
  User,
  CreateUserInput,
  UpdateUserInput,
} from './UserRepository';

export {
  UserService,
  UserServiceError,
  ListUsersOptions,
  PaginatedResult,
} from './UserService';

export {
  UserProfileService,
  UserProfileServiceError,
  UserProfile,
  UserTeam,
  UserPermission,
  UpdateProfileInput,
} from './UserProfileService';