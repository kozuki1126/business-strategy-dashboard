// RBAC Guard Components for Business Strategy Dashboard
// Task #013: RBAC設計（Phase1）実装
// Created: 2025-08-20

import React from 'react';
import { useRBAC, usePermissions, useStoreAccess } from '@/hooks/useRBAC';
import type {
  RBACGuardProps,
  ResourceType,
  ActionType,
  StorePermissionType,
  UserRole
} from '@/types/rbac';

/**
 * Main RBAC Guard Component for conditional rendering based on permissions
 */
export function RBACGuard({ 
  permissions = [], 
  storeAccess = [], 
  fallback = null, 
  children 
}: RBACGuardProps) {
  const { hasPermission, canAccessStore, isLoading, userProfile } = useRBAC();

  // Show loading state while checking permissions
  if (isLoading) {
    return <div className="animate-pulse bg-gray-200 h-4 w-full rounded"></div>;
  }

  // Check if user meets all permission requirements
  const hasRequiredPermissions = permissions.every(check => {
    const userHasPermission = hasPermission(check.resource, check.action);
    return check.required ? userHasPermission : true;
  });

  // Check if user meets all store access requirements
  const hasRequiredStoreAccess = storeAccess.every(check => {
    const userCanAccess = canAccessStore(check.store_id, check.permission);
    return check.required ? userCanAccess : true;
  });

  // Render children if all requirements are met
  if (hasRequiredPermissions && hasRequiredStoreAccess) {
    return <>{children}</>;
  }

  // Render fallback or nothing
  return <>{fallback}</>;
}

/**
 * Permission-based guard for specific resource and action combinations
 */
interface PermissionGuardProps {
  resource: ResourceType;
  action: ActionType;
  required?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGuard({ 
  resource, 
  action, 
  required = true,
  fallback = null, 
  children 
}: PermissionGuardProps) {
  return (
    <RBACGuard
      permissions={[{ resource, action, required }]}
      fallback={fallback}
    >
      {children}
    </RBACGuard>
  );
}

/**
 * Store access guard for store-specific permissions
 */
interface StoreGuardProps {
  storeId: string;
  permission: StorePermissionType;
  required?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function StoreGuard({ 
  storeId, 
  permission, 
  required = true,
  fallback = null, 
  children 
}: StoreGuardProps) {
  return (
    <RBACGuard
      storeAccess={[{ store_id: storeId, permission, required }]}
      fallback={fallback}
    >
      {children}
    </RBACGuard>
  );
}

/**
 * Role-based guard for user role restrictions
 */
interface RoleGuardProps {
  allowedRoles: UserRole[];
  required?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function RoleGuard({ 
  allowedRoles, 
  required = true,
  fallback = null, 
  children 
}: RoleGuardProps) {
  const { userProfile, isLoading } = useRBAC();

  if (isLoading) {
    return <div className="animate-pulse bg-gray-200 h-4 w-full rounded"></div>;
  }

  const hasAllowedRole = userProfile && allowedRoles.includes(userProfile.role);

  if (required && !hasAllowedRole) {
    return <>{fallback}</>;
  }

  if (!required || hasAllowedRole) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

/**
 * Admin-only guard component
 */
interface AdminGuardProps {
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function AdminGuard({ fallback = null, children }: AdminGuardProps) {
  return (
    <RoleGuard allowedRoles={['admin']} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

/**
 * Manager and above guard component
 */
interface ManagerGuardProps {
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function ManagerGuard({ fallback = null, children }: ManagerGuardProps) {
  return (
    <RoleGuard allowedRoles={['admin', 'manager']} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

/**
 * Analyst and above guard component
 */
interface AnalystGuardProps {
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function AnalystGuard({ fallback = null, children }: AnalystGuardProps) {
  return (
    <RoleGuard allowedRoles={['admin', 'manager', 'analyst']} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

/**
 * Higher-Order Component for adding RBAC to any component
 */
export function withRBAC<P extends object>(
  Component: React.ComponentType<P>,
  permissions: { resource: ResourceType; action: ActionType }[] = [],
  storeAccess: { store_id: string; permission: StorePermissionType }[] = [],
  fallback?: React.ReactNode
) {
  return function RBACWrappedComponent(props: P) {
    return (
      <RBACGuard
        permissions={permissions.map(p => ({ ...p, required: true }))}
        storeAccess={storeAccess.map(s => ({ ...s, required: true }))}
        fallback={fallback}
      >
        <Component {...props} />
      </RBACGuard>
    );
  };
}

/**
 * Permission check hook with UI feedback
 */
export function usePermissionWithFeedback(resource: ResourceType, action: ActionType) {
  const { hasPermission, userProfile } = useRBAC();
  const canPerform = hasPermission(resource, action);

  const getFeedbackMessage = () => {
    if (!userProfile) {
      return 'ログインが必要です';
    }
    
    if (!canPerform) {
      return `この操作（${resource}:${action}）を実行する権限がありません`;
    }
    
    return null;
  };

  return {
    canPerform,
    feedbackMessage: getFeedbackMessage(),
    userRole: userProfile?.role
  };
}

/**
 * Store access check hook with UI feedback
 */
export function useStoreAccessWithFeedback(storeId: string, permission: StorePermissionType) {
  const { canAccessStore, userProfile } = useRBAC();
  const { currentStoreAccess } = useStoreAccess(storeId);
  const canAccess = canAccessStore(storeId, permission);

  const getFeedbackMessage = () => {
    if (!userProfile) {
      return 'ログインが必要です';
    }
    
    if (!currentStoreAccess && userProfile.role !== 'admin') {
      return 'この店舗へのアクセス権限がありません';
    }
    
    if (!canAccess) {
      const permissionLabels = {
        view: '閲覧',
        edit: '編集',
        export: 'エクスポート'
      };
      return `この店舗の${permissionLabels[permission]}権限がありません`;
    }
    
    return null;
  };

  return {
    canAccess,
    feedbackMessage: getFeedbackMessage(),
    storeAccess: currentStoreAccess,
    userRole: userProfile?.role
  };
}

/**
 * Disabled component wrapper for insufficient permissions
 */
interface DisabledWrapperProps {
  disabled: boolean;
  tooltip?: string;
  children: React.ReactNode;
}

export function DisabledWrapper({ disabled, tooltip, children }: DisabledWrapperProps) {
  if (!disabled) {
    return <>{children}</>;
  }

  return (
    <div 
      className="relative"
      title={tooltip}
    >
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
      {tooltip && (
        <div className="absolute inset-0 cursor-not-allowed" title={tooltip} />
      )}
    </div>
  );
}

/**
 * Permission-aware button component
 */
interface PermissionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  resource: ResourceType;
  action: ActionType;
  storeId?: string;
  storePermission?: StorePermissionType;
  children: React.ReactNode;
}

export function PermissionButton({ 
  resource, 
  action, 
  storeId, 
  storePermission,
  children, 
  className = '',
  ...buttonProps 
}: PermissionButtonProps) {
  const { canPerform, feedbackMessage } = usePermissionWithFeedback(resource, action);
  const storeCheck = storeId && storePermission 
    ? useStoreAccessWithFeedback(storeId, storePermission)
    : { canAccess: true, feedbackMessage: null };

  const isDisabled = !canPerform || !storeCheck.canAccess;
  const tooltipMessage = feedbackMessage || storeCheck.feedbackMessage;

  return (
    <DisabledWrapper disabled={isDisabled} tooltip={tooltipMessage}>
      <button
        {...buttonProps}
        disabled={isDisabled || buttonProps.disabled}
        className={`${className} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={isDisabled ? tooltipMessage : buttonProps.title}
      >
        {children}
      </button>
    </DisabledWrapper>
  );
}

/**
 * Permission-aware link component
 */
interface PermissionLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  resource: ResourceType;
  action: ActionType;
  storeId?: string;
  storePermission?: StorePermissionType;
  children: React.ReactNode;
}

export function PermissionLink({ 
  resource, 
  action, 
  storeId, 
  storePermission,
  children, 
  className = '',
  ...linkProps 
}: PermissionLinkProps) {
  const { canPerform, feedbackMessage } = usePermissionWithFeedback(resource, action);
  const storeCheck = storeId && storePermission 
    ? useStoreAccessWithFeedback(storeId, storePermission)
    : { canAccess: true, feedbackMessage: null };

  const isDisabled = !canPerform || !storeCheck.canAccess;
  const tooltipMessage = feedbackMessage || storeCheck.feedbackMessage;

  if (isDisabled) {
    return (
      <span 
        className={`${className} opacity-50 cursor-not-allowed`}
        title={tooltipMessage}
      >
        {children}
      </span>
    );
  }

  return (
    <a {...linkProps} className={className}>
      {children}
    </a>
  );
}
