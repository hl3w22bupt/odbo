import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { colors, fontSizes, fontWeights, radii, spacing } from '../theme';
import type { Character, CustomizationPayload } from '../types';
import { AppModal } from './AppModal';
import { PrimaryButton } from './PrimaryButton';

const HAIRSTYLES = ['及肩长发', '波浪卷发', '利落短发', '盘发'];
const OUTFITS = ['温柔连衣裙', '干练西装', '休闲针织', '古典旗袍'];
const VOICES = ['温柔女声', '爽朗女声', '俏皮少女音', '优雅女声'];

interface CustomizeModalProps {
  visible: boolean;
  onClose: () => void;
  character: Character;
  saving?: boolean;
  onSave: (payload: CustomizationPayload) => void;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

/** 形象与命名定制弹窗 */
export function CustomizeModal({ visible, onClose, character, saving = false, onSave }: CustomizeModalProps) {
  const [customName, setCustomName] = useState(character.name);
  const [hairstyle, setHairstyle] = useState<string | null>(null);
  const [outfit, setOutfit] = useState<string | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (visible) {
      setCustomName(character.name);
      setHairstyle(null);
      setOutfit(null);
      setVoice(null);
      setPreviewUrl(null);
    }
  }, [visible, character.name]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.generateImage({
        characterName: customName.trim() || character.name,
        hairstyle: hairstyle ?? undefined,
        outfit: outfit ?? undefined,
      });
      setPreviewUrl(res.url);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = () => {
    onSave({
      customName: customName.trim() ? customName.trim() : undefined,
      hairstyle: hairstyle ?? undefined,
      outfit: outfit ?? undefined,
      voice: voice ?? undefined,
      generateImage: Boolean(previewUrl),
    });
  };

  return (
    <AppModal visible={visible} onClose={onClose}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>定制专属「{character.name}」</Text>
        <Text style={styles.subtitle}>改个名字、换身装扮、定个音色，让 TA 更像你的唯一</Text>

        <Text style={styles.label}>角色名</Text>
        <TextInput
          style={styles.input}
          value={customName}
          onChangeText={setCustomName}
          placeholder="为她起个名字"
          placeholderTextColor={colors.textTertiary}
          maxLength={12}
        />

        <Text style={styles.label}>发型</Text>
        <View style={styles.chipRow}>
          {HAIRSTYLES.map((h) => (
            <Chip key={h} label={h} active={hairstyle === h} onPress={() => setHairstyle(h === hairstyle ? null : h)} />
          ))}
        </View>

        <Text style={styles.label}>穿搭</Text>
        <View style={styles.chipRow}>
          {OUTFITS.map((o) => (
            <Chip key={o} label={o} active={outfit === o} onPress={() => setOutfit(o === outfit ? null : o)} />
          ))}
        </View>

        <Text style={styles.label}>音色</Text>
        <View style={styles.chipRow}>
          {VOICES.map((v) => (
            <Chip key={v} label={v} active={voice === v} onPress={() => setVoice(v === voice ? null : v)} />
          ))}
        </View>

        {previewUrl ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: previewUrl }} style={styles.preview} resizeMode="cover" />
            <Text style={styles.previewHint}>专属形象预览 · 保存后生效</Text>
          </View>
        ) : null}

        <PrimaryButton
          title={generating ? '生成中…' : previewUrl ? '重新生成专属照片' : '生成专属照片'}
          onPress={handleGenerate}
          loading={generating}
          variant={previewUrl ? 'ghost' : 'primary'}
          style={{ marginTop: spacing.md }}
        />

        <PrimaryButton
          title="保存定制"
          onPress={handleSave}
          loading={saving}
          style={{ marginTop: 10 }}
        />

        <Pressable onPress={onClose} style={styles.cancel}>
          <Text style={styles.cancelText}>暂不保存</Text>
        </Pressable>
      </ScrollView>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 560,
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 14,
    fontSize: fontSizes.lg,
    color: colors.textPrimary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
  },
  chipTextActive: {
    color: colors.primaryDark,
    fontWeight: fontWeights.bold,
  },
  previewWrap: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  preview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surfaceAlt,
  },
  previewHint: {
    marginTop: 6,
    fontSize: fontSizes.xs,
    color: colors.textTertiary,
  },
  cancel: {
    alignSelf: 'center',
    marginTop: 14,
    paddingVertical: 8,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: fontSizes.md,
  },
});
