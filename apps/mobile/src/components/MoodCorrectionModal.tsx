import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppModal } from './AppModal';
import { PrimaryButton } from './PrimaryButton';
import { colors, fontSizes, fontWeights, radii, spacing } from '../theme';
import { correctionTagOptions, type MoodCorrectionForm } from '../utils/moodCorrections';
import type { MoodSnapshot } from '../types';

interface MoodCorrectionModalProps {
  point: MoodSnapshot | null;
  value: MoodCorrectionForm;
  saving: boolean;
  onChange: (value: MoodCorrectionForm) => void;
  onSave: () => void;
  onClose: () => void;
}

const MOOD_OPTIONS: { value: MoodSnapshot['mood']; label: string }[] = [
  { value: 'POSITIVE', label: '积极' },
  { value: 'NEUTRAL', label: '平稳' },
  { value: 'NEGATIVE', label: '低落' },
];

export function MoodCorrectionModal({ point, value, saving, onChange, onSave, onClose }: MoodCorrectionModalProps) {
  const toggleTag = (tag: string) => {
    const exists = value.tags.includes(tag);
    const tags = exists ? value.tags.filter((item) => item !== tag) : [...value.tags, tag].slice(0, 3);
    onChange({ ...value, tags });
  };

  return (
    <AppModal visible={Boolean(point)} onClose={saving ? () => undefined : onClose} dismissable={!saving}>
      <Text style={styles.title}>修正情绪记录</Text>
      <Text style={styles.subtitle}>原始记录会保留，保存后按最近一次修正展示。</Text>

      <View style={styles.moodRow}>
        {MOOD_OPTIONS.map((option) => {
          const active = value.mood === option.value;
          return (
            <Pressable key={option.value} onPress={() => onChange({ ...value, mood: option.value })} style={[styles.mood, active && styles.moodActive]}>
              <Text style={[styles.moodText, active && styles.moodTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.tagRow}>
        {correctionTagOptions().map((tag) => {
          const active = value.tags.includes(tag);
          return (
            <Pressable key={tag} onPress={() => toggleTag(tag)} style={[styles.tag, active && styles.tagActive]}>
              <Text style={[styles.tagText, active && styles.tagTextActive]}>{tag}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        style={styles.input}
        value={value.reason}
        multiline
        maxLength={160}
        placeholder="补充原因（选填，最多 160 字）"
        onChangeText={(reason) => onChange({ ...value, reason })}
      />

      <PrimaryButton title={saving ? '保存中' : '保存修正'} onPress={onSave} loading={saving} style={styles.save} />
      <Pressable disabled={saving} onPress={onClose} style={styles.cancel}>
        <Text style={styles.cancelText}>取消</Text>
      </Pressable>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    textAlign: 'center',
  },
  moodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  mood: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  moodActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  moodText: { color: colors.textSecondary, fontSize: fontSizes.sm },
  moodTextActive: { color: colors.primaryDark, fontWeight: fontWeights.semibold },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tag: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagActive: { borderColor: colors.info, backgroundColor: '#EAF4FB' },
  tagText: { color: colors.textSecondary, fontSize: fontSizes.xs },
  tagTextActive: { color: colors.info, fontWeight: fontWeights.semibold },
  input: {
    minHeight: 78,
    marginTop: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  save: { marginTop: spacing.lg },
  cancel: { alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { color: colors.textSecondary, fontSize: fontSizes.md },
});
