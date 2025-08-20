// RBAC Custom Hook for Business Strategy Dashboard
// Task #013: RBAC設計（Phase1）実装
// Created: 2025-08-20

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUser } from '@/lib/auth';
import type {
  UserProfile,
  UserStoreAccess,
  RolePermission,
  UseRBACReturn,
  ResourceType,
  ActionType,
  StorePermissionType,
  RBACError
} from '@/types/rbac';

const supabase = createClient();

/**
 * Main RBAC hook providing comprehensive permission management
 */
export function useRBAC(): UseRBACReturn {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [storeAccess, setStoreAccess] = useState<UserStoreAccess[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user profile and permissions
  const loadUserData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const user = await getCurrentUser();
      if (!user) {
        throw new RBACError('User not authenticated', 'AUTH_REQUIRED');
      }

      // Load user profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        throw new RBACError(
          'Failed to load user profile',
          'PROFILE_LOAD_ERROR',
          profileError
        );
      }

      if (!profile) {
        throw new RBACError(
          'User profile not found',
          'PROFILE_NOT_FOUND'
        );
      }

      setUserProfile(profile);

      // Load store access (if not admin, admins have access to all stores)
      if (profile.role !== 'admin') {
        const { data: access, error: accessError } = await supabase
          .from('user_store_access')
          .select(`
            *,
            dim_store:store_id (
              name
            )
          `)
          .eq('user_id', user.id);

        if (accessError) {
          throw new RBACError(
            'Failed to load store access',
            'STORE_ACCESS_LOAD_ERROR',
            accessError
          );
        }

        const formattedAccess: UserStoreAccess[] = (access || []).map(item => ({
          ...item,
          store_name: item.dim_store?.name || 'Unknown Store'
        }));

        setStoreAccess(formattedAccess);
      } else {
        // Admin has access to all stores
        const { data: allStores, error: storesError } = await supabase
          .from('dim_store')
          .select('id, name');

        if (storesError) {
          throw new RBACError(
            'Failed to load stores',
            'STORES_LOAD_ERROR',
            storesError
          );
        }

        const adminAccess: UserStoreAccess[] = (allStores || []).map(store => ({
          id: `admin-${store.id}`,
          user_id: user.id,
          store_id: store.id,
          can_view: true,
          can_edit: true,
          can_export: true,
          granted_at: new Date().toISOString(),
          store_name: store.name
        }));

        setStoreAccess(adminAccess);
      }

      // Load role permissions
      const { data: permissions, error: permissionsError } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role', profile.role);

      if (permissionsError) {
        throw new RBACError(
          'Failed to load role permissions',
          'PERMISSIONS_LOAD_ERROR',
          permissionsError
        );
      }

      setRolePermissions(permissions || []);

    } catch (err) {
      console.error('RBAC load error:', err);
      setError(err instanceof RBACError ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check if user has specific permission
  const hasPermission = useCallback((resource: ResourceType, action: ActionType): boolean => {
    if (!userProfile) return false;

    // Admins have all permissions
    if (userProfile.role === 'admin') return true;

    // Check role permissions
    const permission = rolePermissions.find(p => 
      p.resource === resource && p.action === action
    );

    return permission?.allowed || false;
  }, [userProfile, rolePermissions]);

  // Check if user can access specific store
  const canAccessStore = useCallback((
    storeId: string, 
    permission: StorePermissionType = 'view'
  ): boolean => {
    if (!userProfile) return false;

    // Admins can access all stores
    if (userProfile.role === 'admin') return true;

    // Check store-specific access
    const access = storeAccess.find(a => a.store_id === storeId);
    if (!access) return false;

    switch (permission) {
      case 'view':
        return access.can_view;
      case 'edit':
        return access.can_edit;
      case 'export':
        return access.can_export;
      default:
        return false;
    }
  }, [userProfile, storeAccess]);

  // Get accessible stores for current user
  const getAccessibleStores = useCallback((): UserStoreAccess[] => {
    return storeAccess.filter(access => access.can_view);
  }, [storeAccess]);

  // Refresh permissions data
  const refreshPermissions = useCallback(async (): Promise<void> => {
    await loadUserData();
  }, [loadUserData]);

  // Load data on mount
  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Set up real-time subscription for user profile changes
  useEffect(() => {
    if (!userProfile) return;

    const subscription = supabase
      .channel(`user_profile_${userProfile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${userProfile.id}`
        },
        () => {
          loadUserData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_store_access',
          filter: `user_id=eq.${userProfile.id}`
        },
        () => {
          loadUserData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userProfile?.id, loadUserData]);

  return {
    userProfile,
    storeAccess,
    isLoading,
    error,
    hasPermission,
    canAccessStore,
    getAccessibleStores,
    refreshPermissions
  };
}

/**
 * Hook for checking specific permissions
 */
export function usePermissions(resource: ResourceType, actions: ActionType[]) {
  const { hasPermission, isLoading } = useRBAC();

  const permissions = useMemo(() => {
    const result: Record<ActionType, boolean> = {} as Record<ActionType, boolean>;
    actions.forEach(action => {
      result[action] = hasPermission(resource, action);
    });
    return result;
  }, [hasPermission, resource, actions]);

  return {
    permissions,
    isLoading,
    hasAnyPermission: actions.some(action => permissions[action]),
    hasAllPermissions: actions.every(action => permissions[action])
  };
}

/**
 * Hook for store access management
 */
export function useStoreAccess(storeId?: string) {
  const { 
    storeAccess, 
    canAccessStore, 
    getAccessibleStores, 
    isLoading 
  } = useRBAC();

  const currentStoreAccess = useMemo(() => {
    if (!storeId) return null;
    return storeAccess.find(access => access.store_id === storeId) || null;
  }, [storeAccess, storeId]);

  const storePermissions = useMemo(() => {
    if (!storeId) return { canView: false, canEdit: false, canExport: false };
    
    return {
      canView: canAccessStore(storeId, 'view'),
      canEdit: canAccessStore(storeId, 'edit'),
      canExport: canAccessStore(storeId, 'export')
    };
  }, [storeId, canAccessStore]);

  return {
    currentStoreAccess,
    storePermissions,
    accessibleStores: getAccessibleStores(),
    isLoading
  };
}

/**
 * Hook for admin operations
 */
export function useRBACAdmin() {
  const { userProfile, hasPermission, refreshPermissions } = useRBAC();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = userProfile?.role === 'admin';
  const canManageUsers = hasPermission('users', 'view');

  // Create user profile
  const createUserProfile = useCallback(async (data: {
    email: string;
    full_name?: string;
    role: string;
    department?: string;
  }) => {
    if (!canManageUsers) {
      throw new RBACError('Insufficient permissions', 'PERMISSION_DENIED');
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data: result, error } = await supabase
        .from('user_profiles')
        .insert([data])
        .select()
        .single();

      if (error) {
        throw new RBACError(
          'Failed to create user profile',
          'CREATE_USER_ERROR',
          error
        );
      }

      return result;
    } catch (err) {
      const error = err instanceof RBACError ? err.message : 'Unknown error';
      setError(error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [canManageUsers]);

  // Grant store access
  const grantStoreAccess = useCallback(async (data: {
    user_id: string;
    store_id: string;
    can_view?: boolean;
    can_edit?: boolean;
    can_export?: boolean;
  }) => {
    if (!canManageUsers) {
      throw new RBACError('Insufficient permissions', 'PERMISSION_DENIED');
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data: result, error } = await supabase
        .from('user_store_access')
        .upsert([{
          ...data,
          can_view: data.can_view ?? true,
          can_edit: data.can_edit ?? false,
          can_export: data.can_export ?? false
        }])
        .select()
        .single();

      if (error) {
        throw new RBACError(
          'Failed to grant store access',
          'GRANT_ACCESS_ERROR',
          error
        );
      }

      return result;
    } catch (err) {
      const error = err instanceof RBACError ? err.message : 'Unknown error';
      setError(error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [canManageUsers]);

  // Get all users (admin only)
  const getAllUsers = useCallback(async () => {
    if (!isAdmin) {
      throw new RBACError('Admin access required', 'ADMIN_REQUIRED');
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          *,
          user_store_access (
            store_id,
            can_view,
            can_edit,
            can_export,
            dim_store:store_id (name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw new RBACError(
          'Failed to load users',
          'LOAD_USERS_ERROR',
          error
        );
      }

      return data || [];
    } catch (err) {
      const error = err instanceof RBACError ? err.message : 'Unknown error';
      setError(error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  return {
    isAdmin,
    canManageUsers,
    isLoading,
    error,
    createUserProfile,
    grantStoreAccess,
    getAllUsers,
    refreshPermissions
  };
}
