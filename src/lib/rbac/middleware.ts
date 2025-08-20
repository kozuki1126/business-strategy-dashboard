// RBAC API Middleware for Business Strategy Dashboard
// Task #013: RBAC設計（Phase1）実装
// Created: 2025-08-20

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { 
  UserProfile, 
  ResourceType, 
  ActionType, 
  StorePermissionType 
} from '@/types/rbac';

export interface RBACMiddlewareOptions {
  resource: ResourceType;
  action: ActionType;
  storeIdParam?: string; // URL parameter name for store ID
  storePermission?: StorePermissionType;
  allowedRoles?: string[];
  requiresAuth?: boolean;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  profile: UserProfile;
}

/**
 * RBAC Middleware for API routes
 */
export async function withRBAC(
  handler: (
    request: NextRequest, 
    context: any, 
    user: AuthenticatedUser
  ) => Promise<NextResponse>,
  options: RBACMiddlewareOptions
) {
  return async (request: NextRequest, context: any) => {
    try {
      const supabase = createClient();

      // Check authentication if required
      if (options.requiresAuth !== false) {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          return NextResponse.json(
            { error: 'Authentication required', code: 'AUTH_REQUIRED' },
            { status: 401 }
          );
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError || !profile) {
          return NextResponse.json(
            { error: 'User profile not found', code: 'PROFILE_NOT_FOUND' },
            { status: 403 }
          );
        }

        // Check if user is active
        if (!profile.is_active) {
          return NextResponse.json(
            { error: 'User account is inactive', code: 'ACCOUNT_INACTIVE' },
            { status: 403 }
          );
        }

        // Check role-based access
        if (options.allowedRoles && !options.allowedRoles.includes(profile.role)) {
          return NextResponse.json(
            { error: 'Insufficient role permissions', code: 'ROLE_DENIED' },
            { status: 403 }
          );
        }

        // Check resource permission
        const hasPermission = await checkResourcePermission(
          profile.role,
          options.resource,
          options.action
        );

        if (!hasPermission) {
          return NextResponse.json(
            { 
              error: `Permission denied for ${options.resource}:${options.action}`, 
              code: 'PERMISSION_DENIED' 
            },
            { status: 403 }
          );
        }

        // Check store-specific permission if required
        if (options.storeIdParam && options.storePermission) {
          const storeId = context.params?.[options.storeIdParam] || 
                          request.nextUrl.searchParams.get(options.storeIdParam);

          if (storeId) {
            const hasStoreAccess = await checkStorePermission(
              user.id,
              storeId,
              options.storePermission,
              profile.role
            );

            if (!hasStoreAccess) {
              return NextResponse.json(
                { 
                  error: `Store access denied for ${options.storePermission} permission`, 
                  code: 'STORE_ACCESS_DENIED' 
                },
                { status: 403 }
              );
            }
          }
        }

        // Log audit trail
        await logAPIAccess(user.id, options.resource, options.action, request);

        const authenticatedUser: AuthenticatedUser = {
          id: user.id,
          email: user.email || '',
          profile
        };

        return await handler(request, context, authenticatedUser);
      }

      // Public endpoint - no authentication required
      return await handler(request, context, null as any);

    } catch (error) {
      console.error('RBAC Middleware Error:', error);
      return NextResponse.json(
        { error: 'Internal server error', code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }
  };
}

/**
 * Check if role has permission for resource action
 */
async function checkResourcePermission(
  role: string,
  resource: ResourceType,
  action: ActionType
): Promise<boolean> {
  // Admins have all permissions
  if (role === 'admin') return true;

  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('role_permissions')
    .select('allowed')
    .eq('role', role)
    .eq('resource', resource)
    .eq('action', action)
    .single();

  if (error) {
    console.error('Permission check error:', error);
    return false;
  }

  return data?.allowed || false;
}

/**
 * Check if user has store-specific permission
 */
async function checkStorePermission(
  userId: string,
  storeId: string,
  permission: StorePermissionType,
  userRole: string
): Promise<boolean> {
  // Admins have access to all stores
  if (userRole === 'admin') return true;

  const supabase = createClient();

  const { data, error } = await supabase
    .from('user_store_access')
    .select(`can_${permission}`)
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .single();

  if (error) {
    console.error('Store permission check error:', error);
    return false;
  }

  return data?.[`can_${permission}`] || false;
}

/**
 * Log API access for audit trail
 */
async function logAPIAccess(
  userId: string,
  resource: ResourceType,
  action: ActionType,
  request: NextRequest
): Promise<void> {
  try {
    const supabase = createClient();

    const { error } = await supabase
      .from('audit_log')
      .insert([{
        actor_id: userId,
        action: `api_${resource}_${action}`,
        target: request.nextUrl.pathname,
        ip: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        ua: request.headers.get('user-agent') || 'unknown',
        meta: {
          method: request.method,
          url: request.nextUrl.toString(),
          resource,
          action,
          timestamp: new Date().toISOString()
        }
      }]);

    if (error) {
      console.error('Audit log error:', error);
    }
  } catch (error) {
    console.error('Failed to log API access:', error);
  }
}

/**
 * Utility functions for common permission patterns
 */
export const RBACPatterns = {
  // Dashboard access
  dashboardView: (): RBACMiddlewareOptions => ({
    resource: 'dashboard',
    action: 'view',
    requiresAuth: true
  }),

  // Sales data access
  salesView: (storeIdParam?: string): RBACMiddlewareOptions => ({
    resource: 'sales',
    action: 'view',
    storeIdParam,
    storePermission: 'view',
    requiresAuth: true
  }),

  salesCreate: (storeIdParam?: string): RBACMiddlewareOptions => ({
    resource: 'sales',
    action: 'create',
    storeIdParam,
    storePermission: 'edit',
    requiresAuth: true
  }),

  salesUpdate: (storeIdParam?: string): RBACMiddlewareOptions => ({
    resource: 'sales',
    action: 'update',
    storeIdParam,
    storePermission: 'edit',
    requiresAuth: true
  }),

  salesDelete: (storeIdParam?: string): RBACMiddlewareOptions => ({
    resource: 'sales',
    action: 'delete',
    storeIdParam,
    storePermission: 'edit',
    allowedRoles: ['admin', 'manager'],
    requiresAuth: true
  }),

  // Export access
  exportCreate: (storeIdParam?: string): RBACMiddlewareOptions => ({
    resource: 'export',
    action: 'create',
    storeIdParam,
    storePermission: 'export',
    requiresAuth: true
  }),

  // Analytics access
  analyticsView: (): RBACMiddlewareOptions => ({
    resource: 'analytics',
    action: 'view',
    requiresAuth: true
  }),

  // Audit access
  auditView: (): RBACMiddlewareOptions => ({
    resource: 'audit',
    action: 'view',
    allowedRoles: ['admin', 'manager'],
    requiresAuth: true
  }),

  // User management (admin only)
  usersView: (): RBACMiddlewareOptions => ({
    resource: 'users',
    action: 'view',
    allowedRoles: ['admin'],
    requiresAuth: true
  }),

  usersCreate: (): RBACMiddlewareOptions => ({
    resource: 'users',
    action: 'create',
    allowedRoles: ['admin'],
    requiresAuth: true
  }),

  usersUpdate: (): RBACMiddlewareOptions => ({
    resource: 'users',
    action: 'update',
    allowedRoles: ['admin'],
    requiresAuth: true
  })
};

/**
 * RBAC Handler decorator for API routes
 */
export function withPermission(options: RBACMiddlewareOptions) {
  return function decorator(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = withRBAC(originalMethod, options);

    return descriptor;
  };
}

/**
 * Quick permission check utility for use within API handlers
 */
export async function hasPermission(
  userId: string,
  resource: ResourceType,
  action: ActionType,
  storeId?: string,
  storePermission?: StorePermissionType
): Promise<boolean> {
  try {
    const supabase = createClient();

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, is_active')
      .eq('id', userId)
      .single();

    if (!profile || !profile.is_active) return false;

    // Check resource permission
    const resourcePermission = await checkResourcePermission(
      profile.role,
      resource,
      action
    );

    if (!resourcePermission) return false;

    // Check store permission if required
    if (storeId && storePermission) {
      return await checkStorePermission(userId, storeId, storePermission, profile.role);
    }

    return true;
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}

/**
 * User context provider for API handlers
 */
export async function getUserContext(userId: string): Promise<AuthenticatedUser | null> {
  try {
    const supabase = createClient();

    const { data: user } = await supabase.auth.admin.getUserById(userId);
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!user || !profile) return null;

    return {
      id: userId,
      email: user.user?.email || '',
      profile
    };
  } catch (error) {
    console.error('Failed to get user context:', error);
    return null;
  }
}

/**
 * Bulk permission check for multiple resources
 */
export async function checkMultiplePermissions(
  userId: string,
  permissions: Array<{
    resource: ResourceType;
    action: ActionType;
    storeId?: string;
    storePermission?: StorePermissionType;
  }>
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  for (const permission of permissions) {
    const key = `${permission.resource}:${permission.action}${
      permission.storeId ? `:${permission.storeId}` : ''
    }`;
    
    results[key] = await hasPermission(
      userId,
      permission.resource,
      permission.action,
      permission.storeId,
      permission.storePermission
    );
  }

  return results;
}
