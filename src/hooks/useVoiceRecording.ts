import { useState, useEffect } from 'react';
import {
    useAudioRecorder,
    RecordingPresets,
    setAudioModeAsync,
    requestRecordingPermissionsAsync,
    getRecordingPermissionsAsync
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';

export const useVoiceRecording = () => {
    const [isVoiceRecording, setIsVoiceRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [recordingTimer, setRecordingTimer] = useState<ReturnType<typeof setInterval> | null>(null);
    const [recordingStopped, setRecordingStopped] = useState(false);
    const [stoppedRecordingUri, setStoppedRecordingUri] = useState<string | null>(null);
    const [stoppedRecordingDuration, setStoppedRecordingDuration] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const WAV_PRESET = {
        ...RecordingPresets.HIGH_QUALITY,
        extension: '.wav', // Default
        android: {
            ...RecordingPresets.HIGH_QUALITY.android,
            extension: '.m4a', // Android specifically needs .m4a for AAC
        },
        ios: {
            ...RecordingPresets.HIGH_QUALITY.ios,
            extension: '.wav',
            outputFormat: 'lpcm', // Linear PCM for WAV
            audioQuality: 127,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
        },
    };

    const recorder = useAudioRecorder(WAV_PRESET as any);

    useEffect(() => {
        return () => {
            // Keep timer cleanup separate or ensure it doesn't cause re-runs
            if (recordingTimer) clearInterval(recordingTimer);
        };
    }, [recordingTimer]);

    useEffect(() => {
        return () => {
            try {
                // Safeguard against accessing released recorder object during unmount
                // Only stop if actually recording
                if (recorder && typeof recorder === 'object' && 'isRecording' in recorder) {
                    if (recorder.isRecording) {
                        console.log('Cleanup: Stopping recorder');
                        recorder.stop();
                    }
                }
            } catch (err) {
                // Quietly fail during cleanup if recorder is already released
                console.log('Recorder cleanup: object already released or invalid');
            }
        };
    }, [recorder]);

    const startRecording = async () => {
        if (isVoiceRecording) return; // Guard against double starts
        console.log('startRecording initiated (WAV)');
        try {
            const { status } = await getRecordingPermissionsAsync();
            console.log('Microphone permission status:', status);
            if (status !== 'granted') {
                const { status: newStatus } = await requestRecordingPermissionsAsync();
                console.log('New microphone permission status:', newStatus);
                if (newStatus !== 'granted') {
                    setError('Permission to access microphone is required');
                    return;
                }
            }

            // Global audio mode setup
            console.log('Setting audio mode for recording...');
            await setAudioModeAsync({
                allowsRecording: true,
                playsInSilentMode: true,
                interruptionMode: 'doNotMix',
                shouldRouteThroughEarpiece: false,
            });

            console.log('Preparing to record...');
            await recorder.prepareToRecordAsync();

            console.log('Triggering recorder.record()');
            recorder.record();
            setIsVoiceRecording(true);
            setRecordingStopped(false);
            setRecordingDuration(0);

            const timer = setInterval(() => {
                setRecordingDuration((prev) => prev + 1);
            }, 1000);
            setRecordingTimer(timer);

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (err) {
            console.error('Failed to start recording', err);
            setError('Failed to start recording: ' + (err instanceof Error ? err.message : String(err)));
            setIsVoiceRecording(false);
        }
    };

    const stopRecording = async () => {
        console.log('stopRecording initiated, isRecording:', recorder.isRecording);

        // If it's too short, wait a bit (Android MediaRecorder.stop() fails if called < 1s)
        if (recordingDuration < 1) {
            console.log('Recording too short, waiting 500ms before stopping...');
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const currentDuration = recordingDuration;
        if (recordingTimer) {
            clearInterval(recordingTimer);
            setRecordingTimer(null);
        }

        setIsVoiceRecording(false);

        try {
            if (recorder.isRecording) {
                console.log('Triggering recorder.stop()');
                await recorder.stop();
            } else {
                console.warn('recorder.stop() called but recorder was not recording');
            }

            // Reset audio mode for playback
            console.log('Resetting audio mode for playback');
            await setAudioModeAsync({
                allowsRecording: false,
                playsInSilentMode: true,
                interruptionMode: 'doNotMix',
                shouldRouteThroughEarpiece: false,
            });

            const uri = recorder.uri;
            console.log('Recording stopped, URI:', uri);

            if (!uri) {
                setError('Failed to save recording');
                resetRecordingState();
                return;
            }

            // Check file size if possible to debug "silence"
            try {
                const info = await FileSystem.getInfoAsync(uri);
                console.log('File info:', info);
                if (info.exists && info.size < 100) {
                    console.warn('⚠️ Recording file is extremely small, might be silent:', info.size, 'bytes');
                }
            } catch (fsErr) {
                console.warn('Could not check file size:', fsErr);
            }

            setStoppedRecordingUri(uri);
            setStoppedRecordingDuration(currentDuration);
            setRecordingStopped(true);

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (err) {
            console.error('Error stopping recording', err);
            // Reset audio mode even on error
            await setAudioModeAsync({
                allowsRecording: false,
                playsInSilentMode: true,
                interruptionMode: 'doNotMix',
                shouldRouteThroughEarpiece: false,
            }).catch(() => { });

            if (recorder.uri) {
                console.log('Stop failed but URI exists:', recorder.uri);
                setStoppedRecordingUri(recorder.uri);
                setStoppedRecordingDuration(currentDuration);
                setRecordingStopped(true);
            } else {
                setError('Failed to stop recording');
                resetRecordingState();
            }
        }
    };

    const cancelRecording = async () => {
        if (recordingTimer) {
            clearInterval(recordingTimer);
            setRecordingTimer(null);
        }
        try {
            if (recorder.isRecording) {
                await recorder.stop();
            }
        } catch (err) {
            console.warn('Error canceling recording', err);
        }

        // Reset audio mode
        await setAudioModeAsync({
            allowsRecording: false,
            playsInSilentMode: true,
            interruptionMode: 'doNotMix',
            shouldRouteThroughEarpiece: false,
        }).catch(() => { });

        resetRecordingState();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const resetRecordingState = () => {
        setIsVoiceRecording(false);
        setRecordingDuration(0);
        setRecordingStopped(false);
        setStoppedRecordingUri(null);
        setStoppedRecordingDuration(0);
    };

    const toggleVoiceRecording = async () => {
        console.log('toggleVoiceRecording called, isVoiceRecording:', isVoiceRecording);
        if (isVoiceRecording) {
            await stopRecording();
        } else {
            await startRecording();
        }
    };

    return {
        isVoiceRecording,
        recordingDuration,
        recordingStopped,
        stoppedRecordingUri,
        stoppedRecordingDuration,
        error,
        setError,
        toggleVoiceRecording,
        stopRecording,
        cancelRecording,
        resetRecordingState,
    };
};
