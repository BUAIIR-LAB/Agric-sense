import React, { createContext, useContext, useState, useCallback } from 'react';
import { SweetAlert, type AlertType } from './SweetAlert';

interface AlertContextType {
  showAlert: (
    type: AlertType,
    title: string,
    message: string,
    options?: {
      confirmText?: string;
      cancelText?: string;
      onConfirm?: () => void;
      onCancel?: () => void;
      showCancel?: boolean;
    }
  ) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const useSweetAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useSweetAlert must be used within AlertProvider');
  }
  return context;
};

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alertState, setAlertState] = useState<{
    visible: boolean;
    type: AlertType;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    showCancel?: boolean;
  }>({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const showAlert = useCallback((
    type: AlertType,
    title: string,
    message: string,
    options?: {
      confirmText?: string;
      cancelText?: string;
      onConfirm?: () => void;
      onCancel?: () => void;
      showCancel?: boolean;
    }
  ) => {
    setAlertState({
      visible: true,
      type,
      title,
      message,
      confirmText: options?.confirmText,
      cancelText: options?.cancelText,
      onConfirm: () => {
        setAlertState((prev) => ({ ...prev, visible: false }));
        if (options?.onConfirm) {
          options.onConfirm();
        }
      },
      onCancel: () => {
        setAlertState((prev) => ({ ...prev, visible: false }));
        if (options?.onCancel) {
          options.onCancel();
        }
      },
      showCancel: options?.showCancel,
    });
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <SweetAlert
        visible={alertState.visible}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        confirmText={alertState.confirmText}
        cancelText={alertState.cancelText}
        onConfirm={alertState.onConfirm}
        onCancel={alertState.onCancel}
        showCancel={alertState.showCancel}
      />
    </AlertContext.Provider>
  );
};

