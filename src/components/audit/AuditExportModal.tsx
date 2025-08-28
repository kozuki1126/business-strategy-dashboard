import React from 'react';

export interface AuditExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport?: (options: any) => void;
}

/**
 * TEMPORARY DUMMY COMPONENT
 * TODO: Implement actual audit export modal functionality
 */
export const AuditExportModal: React.FC<AuditExportModalProps> = ({ 
  isOpen, 
  onClose 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            監査ログエクスポート
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        
        <div className="text-gray-500 text-center py-8">
          <p>エクスポート機能は準備中です</p>
          <p className="text-sm mt-2">TODO: 実装予定</p>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
          >
            キャンセル
          </button>
          <button
            onClick={onClose}
            disabled
            className="px-4 py-2 text-white bg-gray-400 rounded cursor-not-allowed"
          >
            エクスポート（準備中）
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditExportModal;