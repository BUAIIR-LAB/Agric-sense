import { useCallback } from 'react';

import { useSweetAlert } from '@/components/AlertProvider';
import { useAppContext } from '@/context/AppContext';
import { useTranslation } from '@/localization/useTranslation';

type RecordType = 'diagnosis' | 'spectroscopy';

export function useDeleteRecord() {
  const {
    removeDiagnosisRecord,
    removeSpectroscopyRecord,
    removeDiagnosisRecordWithAPI,
    removeSpectroscopyRecordWithAPI,
    isOffline,
  } = useAppContext();
  const { showAlert } = useSweetAlert();
  const { t } = useTranslation();

  const deleteRecord = useCallback(
    async (type: RecordType, id: string) => {
      const title =
        type === 'diagnosis'
          ? t('history.dialog.removeDiagnosisTitle')
          : t('history.dialog.removeSpectrumTitle');
      const message =
        type === 'diagnosis'
          ? t('history.dialog.removeDiagnosisMessage')
          : t('history.dialog.removeSpectrumMessage');

      return new Promise<void>((resolve) => {
        showAlert('warning', title, message, {
          showCancel: true,
          confirmText: t('common.actions.delete'),
          cancelText: t('common.actions.cancel'),
          onCancel: () => resolve(),
          onConfirm: async () => {
            try {
              if (isOffline) {
                if (type === 'diagnosis') {
                  removeDiagnosisRecord(id);
                } else {
                  removeSpectroscopyRecord(id);
                }
                showAlert(
                  'info',
                  'Offline',
                  'Record removed locally. It will sync when you are back online.',
                );
                resolve();
                return;
              }

              const apiDelete =
                type === 'diagnosis' ? removeDiagnosisRecordWithAPI : removeSpectroscopyRecordWithAPI;
              const localDelete = type === 'diagnosis' ? removeDiagnosisRecord : removeSpectroscopyRecord;

              const success = await apiDelete(id);
              if (!success) {
                localDelete(id);
                showAlert(
                  'warning',
                  t('history.dialog.deletePartialTitle') ?? 'Partially Deleted',
                  t('history.dialog.deletePartialMessage') ??
                    'Record removed on this device but could not be deleted from the server.',
                );
              } else {
                showAlert(
                  'success',
                  t('history.dialog.deleteSuccessTitle') ?? 'Record Deleted',
                  t('history.dialog.deleteSuccessMessage') ?? 'The record has been successfully deleted.',
                );
              }
            } catch {
              if (type === 'diagnosis') {
                removeDiagnosisRecord(id);
              } else {
                removeSpectroscopyRecord(id);
              }
              showAlert(
                'error',
                t('history.dialog.deleteFailedTitle') ?? 'Delete Failed',
                t('history.dialog.deleteFailedMessage') ??
                  'Could not reach the server. The record was removed locally only.',
              );
            }
            resolve();
          },
        });
      });
    },
    [
      isOffline,
      removeDiagnosisRecord,
      removeDiagnosisRecordWithAPI,
      removeSpectroscopyRecord,
      removeSpectroscopyRecordWithAPI,
      showAlert,
      t,
    ],
  );

  return { deleteRecord };
}
