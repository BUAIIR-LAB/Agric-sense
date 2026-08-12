import apiService from './api';
import { getPendingDiagnosesDB } from './database';
import { DiagnosisRecord } from '@/context/AppContext';

/**
 * SyncService handles the background synchronization of offline-created records.
 */
class SyncService {
  private isSyncing = false;

  /**
   * Attempts to synchronize all pending diagnoses with the server.
   * @param onRecordSynced Callback invoked after each successful record sync.
   */
  async syncPendingDiagnoses(
    onRecordSynced: (syncedRecord: DiagnosisRecord) => void
  ): Promise<{ success: number; failed: number }> {
    if (this.isSyncing) return { success: 0, failed: 0 };
    
    this.isSyncing = true;
    let successCount = 0;
    let failedCount = 0;

    try {
      const pendingRecords = await getPendingDiagnosesDB();
      
      if (pendingRecords.length === 0) {
        this.isSyncing = false;
        return { success: 0, failed: 0 };
      }

      console.log(`🔄 SyncService: Attempting to sync ${pendingRecords.length} pending diagnoses...`);

      for (const record of pendingRecords) {
        try {
          // Attempt to upload to API
          // Note: createDiagnosisWithAPI in AppContext handles the mapping, 
          // but here we call apiService directly or simulate the call.
          // The backend /diagnosis/image requires an image file usually.
          
          // CRITICAL: If the record has a local image URI, we might need to 
          // re-upload it. For now, we assume the record contains enough info 
          // or the backend supports the deferred sync.
          
          // Since we already have the diagnosis results saved locally from the initial 
          // (possibly failed) offline attempt, we might just be syncing the "record" 
          // to the user's remote history.
          
          // Re-trigger the API call
          const response = await apiService.createDiagnosis({
            image_uri: record.imageUri,
            suspected_issues: record.suspectedIssues,
            confidence: record.confidence,
            summary: record.summary,
            recommendations: record.recommendations,
            follow_up_question: record.followUpQuestion,
            follow_up_response: record.followUpResponse,
            target_lang: undefined, // Will use default or we could store it
          });

          if (response) {
            console.log(`✅ SyncService: Successfully synced diagnosis ${record.id}`);
            // Return the updated record marked as synced
            onRecordSynced({
              ...record,
              syncStatus: 0, // Mark as synced
            });
            successCount++;
          }
        } catch (error) {
          console.warn(`❌ SyncService: Failed to sync diagnosis ${record.id}:`, error);
          failedCount++;
        }
      }
    } catch (error) {
      console.error('❌ SyncService: Fatal error during sync:', error);
    } finally {
      this.isSyncing = false;
    }

    return { success: successCount, failed: failedCount };
  }
}

export const syncService = new SyncService();
export default syncService;
