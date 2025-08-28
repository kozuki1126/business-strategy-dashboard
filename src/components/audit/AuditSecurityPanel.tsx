import React from 'react';

/**
 * TEMPORARY DUMMY COMPONENT
 * TODO: Implement actual audit security panel
 */
export const AuditSecurityPanel: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        セキュリティ分析
      </h3>
      <div className="text-gray-500 text-center py-8">
        <p>セキュリティ分析機能は準備中です</p>
        <p className="text-sm mt-2">TODO: 実装予定</p>
      </div>
    </div>
  );
};

export default AuditSecurityPanel;