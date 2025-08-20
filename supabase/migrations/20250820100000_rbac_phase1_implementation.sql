-- RBAC Phase 1 Implementation for Business Strategy Dashboard
-- Task #013: RBAC設計（Phase1）実装
-- Created: 2025-08-20

-- ========================================
-- USER PROFILE AND ROLE MANAGEMENT TABLES
-- ========================================

-- User profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'viewer',
    department TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Role constraints
    CONSTRAINT user_profiles_role_valid CHECK (
        role IN ('admin', 'manager', 'analyst', 'viewer')
    )
);

-- User store access mapping (many-to-many)
CREATE TABLE IF NOT EXISTS user_store_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES dim_store(id) ON DELETE CASCADE,
    can_view BOOLEAN DEFAULT true,
    can_edit BOOLEAN DEFAULT false,
    can_export BOOLEAN DEFAULT false,
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint
    CONSTRAINT user_store_access_unique UNIQUE (user_id, store_id)
);

-- Role permissions definition table
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role TEXT NOT NULL,
    resource TEXT NOT NULL, -- 'sales', 'dashboard', 'export', 'audit', etc.
    action TEXT NOT NULL,   -- 'view', 'create', 'update', 'delete', 'export'
    allowed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint
    CONSTRAINT role_permissions_unique UNIQUE (role, resource, action),
    
    -- Role validation
    CONSTRAINT role_permissions_role_valid CHECK (
        role IN ('admin', 'manager', 'analyst', 'viewer')
    )
);

-- ========================================
-- INDEXES FOR RBAC PERFORMANCE
-- ========================================

-- User profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_active ON user_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- User store access indexes  
CREATE INDEX IF NOT EXISTS idx_user_store_access_user_id ON user_store_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_store_access_store_id ON user_store_access(store_id);
CREATE INDEX IF NOT EXISTS idx_user_store_access_permissions ON user_store_access(user_id, can_view, can_edit, can_export);

-- Role permissions indexes
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_resource ON role_permissions(resource, action);

-- ========================================
-- ROW LEVEL SECURITY POLICIES
-- ========================================

-- Enable RLS on critical tables
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_store_access ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Sales data access based on store assignment
CREATE POLICY sales_user_store_access ON sales
    FOR ALL
    TO authenticated
    USING (
        -- Admins can access all data
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND is_active = true
        )
        OR
        -- Other users can only access assigned stores
        EXISTS (
            SELECT 1 FROM user_store_access usa
            JOIN user_profiles up ON up.id = usa.user_id
            WHERE usa.user_id = auth.uid()
            AND usa.store_id = sales.store_id
            AND usa.can_view = true
            AND up.is_active = true
        )
    )
    WITH CHECK (
        -- Insert/Update: Admins can modify all data
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND is_active = true
        )
        OR
        -- Other users can only modify assigned stores if they have edit permission
        EXISTS (
            SELECT 1 FROM user_store_access usa
            JOIN user_profiles up ON up.id = usa.user_id
            WHERE usa.user_id = auth.uid()
            AND usa.store_id = sales.store_id
            AND usa.can_edit = true
            AND up.is_active = true
        )
    );

-- RLS Policy: User profiles - users can view their own profile and admins can view all
CREATE POLICY user_profiles_access ON user_profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND is_active = true
        )
    );

-- RLS Policy: User profiles - only admins can modify
CREATE POLICY user_profiles_admin_modify ON user_profiles
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND is_active = true
        )
    );

-- RLS Policy: User store access - users can view their own access and admins can view all
CREATE POLICY user_store_access_view ON user_store_access
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin' 
            AND is_active = true
        )
    );

-- RLS Policy: User store access - only admins and managers can modify
CREATE POLICY user_store_access_admin_modify ON user_store_access
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager') 
            AND is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager') 
            AND is_active = true
        )
    );

-- RLS Policy: Audit log - users can view their own actions, admins can view all
CREATE POLICY audit_log_access ON audit_log
    FOR SELECT
    TO authenticated
    USING (
        actor_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager') 
            AND is_active = true
        )
    );

-- ========================================
-- RBAC HELPER FUNCTIONS
-- ========================================

-- Function to check if user has permission for specific action
CREATE OR REPLACE FUNCTION user_has_permission(
    user_id UUID, 
    resource_name TEXT, 
    action_name TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    has_permission BOOLEAN := false;
BEGIN
    -- Get user role
    SELECT role INTO user_role
    FROM user_profiles 
    WHERE id = user_id AND is_active = true;
    
    -- If user not found or inactive, deny access
    IF user_role IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check role permissions
    SELECT allowed INTO has_permission
    FROM role_permissions 
    WHERE role = user_role 
    AND resource = resource_name 
    AND action = action_name;
    
    -- Default to false if permission not explicitly defined
    RETURN COALESCE(has_permission, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user accessible stores
CREATE OR REPLACE FUNCTION get_user_accessible_stores(user_id UUID)
RETURNS TABLE(store_id UUID, store_name TEXT, can_view BOOLEAN, can_edit BOOLEAN, can_export BOOLEAN) AS $$
BEGIN
    -- Check if user is admin (access to all stores)
    IF EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = user_id 
        AND role = 'admin' 
        AND is_active = true
    ) THEN
        RETURN QUERY
        SELECT 
            ds.id as store_id,
            ds.name as store_name,
            true as can_view,
            true as can_edit,
            true as can_export
        FROM dim_store ds
        ORDER BY ds.name;
    ELSE
        -- Return only assigned stores for non-admin users
        RETURN QUERY
        SELECT 
            usa.store_id,
            ds.name as store_name,
            usa.can_view,
            usa.can_edit,
            usa.can_export
        FROM user_store_access usa
        JOIN dim_store ds ON ds.id = usa.store_id
        JOIN user_profiles up ON up.id = usa.user_id
        WHERE usa.user_id = user_id
        AND up.is_active = true
        ORDER BY ds.name;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can access specific store
CREATE OR REPLACE FUNCTION user_can_access_store(
    user_id UUID, 
    target_store_id UUID, 
    required_permission TEXT DEFAULT 'view'
) RETURNS BOOLEAN AS $$
DECLARE
    is_admin BOOLEAN := false;
    has_access BOOLEAN := false;
BEGIN
    -- Check if user is admin
    SELECT EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = user_id 
        AND role = 'admin' 
        AND is_active = true
    ) INTO is_admin;
    
    IF is_admin THEN
        RETURN true;
    END IF;
    
    -- Check store-specific access
    CASE required_permission
        WHEN 'view' THEN
            SELECT can_view INTO has_access
            FROM user_store_access usa
            JOIN user_profiles up ON up.id = usa.user_id
            WHERE usa.user_id = user_id 
            AND usa.store_id = target_store_id
            AND up.is_active = true;
        WHEN 'edit' THEN
            SELECT can_edit INTO has_access
            FROM user_store_access usa
            JOIN user_profiles up ON up.id = usa.user_id
            WHERE usa.user_id = user_id 
            AND usa.store_id = target_store_id
            AND up.is_active = true;
        WHEN 'export' THEN
            SELECT can_export INTO has_access
            FROM user_store_access usa
            JOIN user_profiles up ON up.id = usa.user_id
            WHERE usa.user_id = user_id 
            AND usa.store_id = target_store_id
            AND up.is_active = true;
    END CASE;
    
    RETURN COALESCE(has_access, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- INITIAL RBAC DATA SETUP
-- ========================================

-- Insert default role permissions
INSERT INTO role_permissions (role, resource, action, allowed) VALUES
-- Admin permissions (full access)
('admin', 'dashboard', 'view', true),
('admin', 'sales', 'view', true),
('admin', 'sales', 'create', true),
('admin', 'sales', 'update', true),
('admin', 'sales', 'delete', true),
('admin', 'export', 'view', true),
('admin', 'export', 'create', true),
('admin', 'audit', 'view', true),
('admin', 'analytics', 'view', true),
('admin', 'users', 'view', true),
('admin', 'users', 'create', true),
('admin', 'users', 'update', true),

-- Manager permissions (store management)
('manager', 'dashboard', 'view', true),
('manager', 'sales', 'view', true),
('manager', 'sales', 'create', true),
('manager', 'sales', 'update', true),
('manager', 'export', 'view', true),
('manager', 'export', 'create', true),
('manager', 'analytics', 'view', true),
('manager', 'audit', 'view', false), -- Limited audit access

-- Analyst permissions (analysis focused)
('analyst', 'dashboard', 'view', true),
('analyst', 'sales', 'view', true),
('analyst', 'export', 'view', true),
('analyst', 'export', 'create', true),
('analyst', 'analytics', 'view', true),
('analyst', 'sales', 'create', false),
('analyst', 'sales', 'update', false),

-- Viewer permissions (read-only)
('viewer', 'dashboard', 'view', true),
('viewer', 'sales', 'view', true),
('viewer', 'analytics', 'view', true),
('viewer', 'export', 'view', false),
('viewer', 'sales', 'create', false),
('viewer', 'sales', 'update', false)

ON CONFLICT (role, resource, action) DO NOTHING;

-- ========================================
-- TRIGGERS FOR RBAC AUDIT LOGGING
-- ========================================

-- Function to log RBAC events
CREATE OR REPLACE FUNCTION log_rbac_event()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (actor_id, action, target, meta)
    VALUES (
        auth.uid(),
        TG_OP || '_' || TG_TABLE_NAME,
        COALESCE(NEW.id::TEXT, OLD.id::TEXT),
        jsonb_build_object(
            'table', TG_TABLE_NAME,
            'operation', TG_OP,
            'old_values', CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
            'new_values', CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END
        )
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for RBAC tables
CREATE TRIGGER rbac_audit_user_profiles
    AFTER INSERT OR UPDATE OR DELETE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION log_rbac_event();

CREATE TRIGGER rbac_audit_user_store_access
    AFTER INSERT OR UPDATE OR DELETE ON user_store_access
    FOR EACH ROW EXECUTE FUNCTION log_rbac_event();

-- ========================================
-- UPDATED_AT TRIGGERS FOR RBAC TABLES
-- ========================================

-- Apply updated_at triggers to RBAC tables
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- COMMENTS FOR DOCUMENTATION
-- ========================================

COMMENT ON TABLE user_profiles IS 'User profiles with role-based access control information';
COMMENT ON TABLE user_store_access IS 'Many-to-many mapping of users to stores with specific permissions';
COMMENT ON TABLE role_permissions IS 'Defines what actions each role can perform on each resource';

COMMENT ON FUNCTION user_has_permission IS 'Check if a user has permission to perform a specific action on a resource';
COMMENT ON FUNCTION get_user_accessible_stores IS 'Get all stores a user can access with their permission levels';
COMMENT ON FUNCTION user_can_access_store IS 'Check if a user can access a specific store with required permission level';

COMMENT ON POLICY sales_user_store_access ON sales IS 'RLS policy: Users can only access sales data for stores they are assigned to';
COMMENT ON POLICY user_profiles_access ON user_profiles IS 'RLS policy: Users can view their own profile, admins can view all';
COMMENT ON POLICY audit_log_access ON audit_log IS 'RLS policy: Users can view their own audit logs, admins can view all';
