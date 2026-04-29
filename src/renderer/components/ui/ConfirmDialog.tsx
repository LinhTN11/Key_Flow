import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel?: () => void;
    variant?: 'danger' | 'primary';
}

export function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    variant = 'primary'
}: ConfirmDialogProps) {
    const { t } = useTranslation();
    const finalConfirmLabel = confirmLabel || t('common.delete');
    const finalCancelLabel = cancelLabel || t('common.cancel');

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-8">
                    <h3 className="text-2xl font-black text-white mb-2 tracking-tight">{title}</h3>
                    <p className="text-[#a3a3a3] text-sm font-medium leading-relaxed">{message}</p>
                </div>
                <div className="flex items-center gap-3 p-4 bg-white/[0.02] border-t border-white/[0.05]">
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-3 rounded-xl text-xs font-bold text-[#666] hover:text-white hover:bg-white/5 transition-all uppercase tracking-widest"
                        >
                            {finalCancelLabel}
                        </button>
                    )}
                    <button
                        onClick={onConfirm}
                        className={`flex-1 px-4 py-3 rounded-xl text-xs font-bold text-white transition-all uppercase tracking-widest ${variant === 'danger'
                            ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20'
                            : 'bg-[#6366f1] hover:bg-[#818cf8] shadow-lg shadow-[#6366f1]/20'
                            }`}
                    >
                        {finalConfirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
