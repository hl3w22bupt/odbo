import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, getAccessToken, resolveBaseUrl } from '../api';
import { useToast } from '../store/ToastContext';
import { colors, fontSizes, fontWeights, radii, spacing } from '../theme';
import {
  countPeriodCsvRows,
  periodExportContract,
  readPeriodCsvDownload,
  serverAuthoritativeImportResult,
  triggerBlobDownload,
} from '../utils/dataExchange';
import { describePeriodCsvImport, type ImportSummary } from '../utils/csvImport';
import { currentPeriodId } from '../utils/moodPeriodInsight';

interface PeriodDataExchangeCardProps {
  /** 报告页传入当前会话；设置页按最近会话解析，不额外新建会话选择页。 */
  conversationId?: string | null;
  onImported?: () => void;
}

const FEEDBACK_LIMIT = 3;

export function PeriodDataExchangeCard({ conversationId, onImported }: PeriodDataExchangeCardProps) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [feedback, setFeedback] = useState<ImportSummary | null>(null);

  const showError = useCallback((title: string, error: unknown) => {
    showToast({
      title,
      message: error instanceof Error ? error.message : '请稍后重试',
      type: 'error',
    });
  }, [showToast]);

  const resolveConversation = useCallback(async () => {
    if (conversationId) return conversationId;
    const conversations = await api.listConversations();
    const first = conversations.items[0]?.id ?? null;
    if (!first) throw new Error('请先创建会话');
    return first;
  }, [conversationId]);

  const handleExport = useCallback(async () => {
    if (typeof document === 'undefined' || typeof Blob === 'undefined') {
      showToast({ title: '当前端不支持导出', message: '请在 Web 版导出 CSV', type: 'error' });
      return;
    }
    setBusy('export');
    try {
      const targetConversationId = await resolveConversation();
      const contract = periodExportContract(targetConversationId, currentPeriodId(new Date()));
      const headers: Record<string, string> = { accept: 'text/csv' };
      const token = getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(`${resolveBaseUrl()}${contract.endpoint}`, {
        method: contract.method,
        headers,
      });
      const download = await readPeriodCsvDownload(response);
      triggerBlobDownload(download.blob, download.filename);
      showToast({ title: '导出完成', message: download.filename, type: 'success' });
    } catch (error) {
      showError('导出失败', error);
    } finally {
      setBusy(null);
    }
  }, [resolveConversation, showError, showToast]);

  const handleFile = useCallback((file: File) => {
    setBusy('import');
    void resolveConversation()
      .then(async (targetConversationId) => {
        const csv = await file.text();
        // 客户端计数只是体验优化；无论预检是否超限，都让服务端做出唯一权威判定。
        const clientRowCount = countPeriodCsvRows(csv);
        const serverResult = await api.importPeriodCsv(targetConversationId, csv);
        return { clientRowCount, serverResult };
      })
      .then(({ clientRowCount, serverResult }) => {
        const authoritative = serverAuthoritativeImportResult(
          { clientRowCount, blocked: false },
          serverResult,
        );
        const summary = describePeriodCsvImport(authoritative);
        setFeedback(summary);
        showToast({ title: summary.title, message: summary.message, type: summary.type });
        onImported?.();
      })
      .catch((error: unknown) => showError('导入失败', error))
      .finally(() => setBusy(null));
  }, [onImported, resolveConversation, showError, showToast]);

  const handleImport = useCallback(() => {
    if (typeof document === 'undefined') {
      showToast({ title: '当前端不支持文件选择', message: '请在 Web 版导入 CSV', type: 'error' });
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  }, [handleFile, showToast]);

  const visibleDetails = feedback?.details.slice(0, FEEDBACK_LIMIT) ?? [];
  const hiddenCount = feedback?.hiddenDetailCount ?? 0;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>周期数据</Text>
      <Text style={styles.description}>
        导出既有周期 CSV，或将 v0.9 导出文件导入恢复。
      </Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="导出周期 CSV"
          onPress={() => { void handleExport(); }}
          disabled={busy !== null}
          style={({ pressed }) => [styles.button, (busy !== null || pressed) && styles.buttonInactive]}
        >
          <Text style={styles.buttonText}>{busy === 'export' ? '正在导出…' : '导出周期 CSV'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="导入周期 CSV"
          onPress={handleImport}
          disabled={busy !== null}
          style={({ pressed }) => [styles.button, (busy !== null || pressed) && styles.buttonInactive]}
        >
          <Text style={styles.buttonText}>{busy === 'import' ? '正在导入…' : '导入周期 CSV'}</Text>
        </Pressable>
      </View>

      {feedback ? (
        <View style={styles.feedback}>
          <Text style={feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError}>
            {feedback.message}
          </Text>
          {visibleDetails.map((detail) => (
            <Text key={detail} style={styles.feedbackDetail}>{detail}</Text>
          ))}
          {hiddenCount > 0 ? <Text style={styles.feedbackDetail}>+{hiddenCount} 行</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  description: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  button: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  buttonInactive: { opacity: 0.55 },
  buttonText: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  feedback: { gap: 3 },
  feedbackSuccess: { color: colors.primary, fontSize: fontSizes.xs },
  feedbackError: { color: colors.primaryDark, fontSize: fontSizes.xs, lineHeight: 16 },
  feedbackDetail: { color: colors.textSecondary, fontSize: fontSizes.xs, lineHeight: 16 },
});
