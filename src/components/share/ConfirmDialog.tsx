'use client';

import React from 'react';

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  message,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white !px-6 !py-8 shadow-md max-w-sm w-full rounded-[8px]">
        <p className="mb-4 text-[18px] max-md:text-[16px] text-left font-semibold text-gray-700">{message}</p>
        <div className="flex justify-end gap-4 !mt-[20px]">
          <button
            className="bg-gray-200 text-black !px-4 !py-2 text-[14px] rounded"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="bg-red-600 text-white !px-4 !py-2 text-[14px] rounded"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
