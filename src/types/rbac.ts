// RBAC Types for Business Strategy Dashboard
// Task #013: RBAC設計（Phase1）実装
// Generated: 2025-08-20

// ========================================
// RBAC ROLE AND PERMISSION TYPES
// ========================================

export type UserRole = 'admin' | 'manager' | 'analyst' | 'viewer';

export type ResourceType = 
  | 'dashboard' 
  | 'sales' 
  | 'export' 
  | 'audit' 
  | 'analytics' 
  | 'users';

export type ActionType = 
  | 'view' 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'export';

export type StorePermissionType = 'view' | 'edit' | 'export';

// ========================================
// USER PROFILE INTERFACES
// ========================================

export interface UserProfile {
  id: string; // UUID referencing auth.users
  email: string;
  full_name?: string;
  role: UserRole;
  department?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserStoreAccess {
  id: string;
  user_id: string;
  store_id: string;
  can_view: boolean;
  can_edit: boolean;
  can_export: boolean;
  granted_by?: string;
  granted_at: string;
  // Joined data
  store_name?: string;
}

export interface RolePermission {
  id: string;
  role: UserRole;
  resource: ResourceType;
  action: ActionType;
  allowed: boolean;
  created_at: string;
}

// ========================================
// RBAC CONTEXT INTERFACES
// ========================================

export interface RBACContext {
  userProfile: UserProfile | null;
  storeAccess: UserStoreAccess[];
  permissions: RolePermission[];
  isLoading: boolean;
  hasPermission: (resource: ResourceType, action: ActionType) => boolean;
  canAccessStore: (storeId: string, permission?: StorePermissionType) => boolean;
  getAccessibleStores: () => UserStoreAccess[];
  refreshPermissions: () => Promise<void>;
}

// ========================================
// API REQUEST/RESPONSE INTERFACES
// ========================================

export interface CreateUserProfileRequest {
  email: string;
  full_name?: string;
  role: UserRole;
  department?: string;
}

export interface UpdateUserProfileRequest {
  full_name?: string;
  role?: UserRole;
  department?: string;
  is_active?: boolean;
}

export interface GrantStoreAccessRequest {
  user_id: string;
  store_id: string;
  can_view?: boolean;
  can_edit?: boolean;
  can_export?: boolean;
}

export interface RBACApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

// ========================================
// RBAC UTILITY TYPES
// ========================================

export interface PermissionCheck {
  resource: ResourceType;
  action: ActionType;
  required: boolean;
}

export interface StoreAccessCheck {
  store_id: string;
  permission: StorePermissionType;
  required: boolean;
}

export interface RBACGuardProps {
  permissions?: PermissionCheck[];
  storeAccess?: StoreAccessCheck[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

// ========================================
// COMPONENT PROPS WITH RBAC
// ========================================

export interface WithRBACProps {
  userProfile: UserProfile | null;
  hasPermission: (resource: ResourceType, action: ActionType) => boolean;
  canAccessStore: (storeId: string, permission?: StorePermissionType) => boolean;
}

// ========================================
// RBAC HOOK RETURN TYPES
// ========================================

export interface UseRBACReturn {
  userProfile: UserProfile | null;
  storeAccess: UserStoreAccess[];
  isLoading: boolean;
  error: string | null;
  hasPermission: (resource: ResourceType, action: ActionType) => boolean;
  canAccessStore: (storeId: string, permission?: StorePermissionType) => boolean;
  getAccessibleStores: () => UserStoreAccess[];
  refreshPermissions: () => Promise<void>;
}

export interface UseStoreAccessReturn {
  accessibleStores: UserStoreAccess[];
  isLoading: boolean;
  error: string | null;
  canAccessStore: (storeId: string, permission?: StorePermissionType) => boolean;
  refreshAccess: () => Promise<void>;
}

// ========================================
// RBAC AUDIT TYPES
// ========================================

export interface RBACActivityLog {
  id: string;
  actor_id: string;
  action: string;
  target: string;
  at: string;
  meta: {
    table: string;
    operation: string;
    old_values?: any;
    new_values?: any;
  };
}

// ========================================
// RBAC ADMIN INTERFACES
// ========================================

export interface UserManagementFilters {
  role?: UserRole;
  department?: string;
  is_active?: boolean;
  search?: string;
}

export interface StoreAccessManagementFilters {
  user_id?: string;
  store_id?: string;
  permission_type?: StorePermissionType;
}

export interface BulkPermissionUpdate {
  user_ids: string[];
  permissions: {
    resource: ResourceType;
    action: ActionType;
    allowed: boolean;
  }[];
}

export interface BulkStoreAccessUpdate {
  user_id: string;
  store_accesses: {
    store_id: string;
    can_view: boolean;
    can_edit: boolean;
    can_export: boolean;
  }[];
}

// ========================================
// RBAC ERROR TYPES
// ========================================

export class RBACError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'RBACError';
  }
}

export interface RBACValidationError {
  field: string;
  message: string;
  code: string;
}

// ========================================
// RBAC CONSTANTS
// ========================================

export const USER_ROLES: Record<UserRole, { label: string; description: string }> = {
  admin: {
    label: '管理者',
    description: '全店舗・全機能への完全アクセス権限'
  },
  manager: {
    label: '管理者',
    description: '担当店舗の管理・売上編集権限'
  },
  analyst: {
    label: 'アナリスト',
    description: '分析・エクスポート専用・編集権限なし'
  },
  viewer: {
    label: '閲覧者',
    description: '読み取り専用・エクスポート不可'
  }
};

export const RESOURCE_TYPES: Record<ResourceType, { label: string; description: string }> = {
  dashboard: {
    label: 'ダッシュボード',
    description: '経営戦略ダッシュボードへのアクセス'
  },
  sales: {
    label: '売上データ',
    description: '売上データの閲覧・編集・削除'
  },
  export: {
    label: 'エクスポート',
    description: 'CSV・Excelファイルのエクスポート'
  },
  audit: {
    label: '監査ログ',
    description: '監査ログの閲覧・分析'
  },
  analytics: {
    label: '分析機能',
    description: '相関分析・比較分析機能'
  },
  users: {
    label: 'ユーザー管理',
    description: 'ユーザー・権限の管理'
  }
};

export const ACTION_TYPES: Record<ActionType, { label: string; description: string }> = {
  view: {
    label: '閲覧',
    description: 'データの閲覧・表示'
  },
  create: {
    label: '作成',
    description: '新規データの作成・追加'
  },
  update: {
    label: '更新',
    description: '既存データの編集・更新'
  },
  delete: {
    label: '削除',
    description: 'データの削除・無効化'
  },
  export: {
    label: 'エクスポート',
    description: 'ファイルのダウンロード・出力'
  }
};

// ========================================
// DEFAULT PERMISSIONS BY ROLE
// ========================================

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Record<ResourceType, ActionType[]>> = {
  admin: {
    dashboard: ['view'],
    sales: ['view', 'create', 'update', 'delete'],
    export: ['view', 'create'],
    audit: ['view'],
    analytics: ['view'],
    users: ['view', 'create', 'update']
  },
  manager: {
    dashboard: ['view'],
    sales: ['view', 'create', 'update'],
    export: ['view', 'create'],
    audit: [],
    analytics: ['view'],
    users: []
  },
  analyst: {
    dashboard: ['view'],
    sales: ['view'],
    export: ['view', 'create'],
    audit: [],
    analytics: ['view'],
    users: []
  },
  viewer: {
    dashboard: ['view'],
    sales: ['view'],
    export: [],
    audit: [],
    analytics: ['view'],
    users: []
  }
};
