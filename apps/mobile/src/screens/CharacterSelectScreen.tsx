import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { Avatar } from '../components/Avatar';
import { CrownBadge } from '../components/CrownBadge';
import { LoadingView } from '../components/LoadingView';
import { PrimaryButton } from '../components/PrimaryButton';
import { AppModal } from '../components/AppModal';
import { useNavigation } from '../navigation/NavigationContext';
import { useSession } from '../store/SessionContext';
import { useToast } from '../store/ToastContext';
import { colors, fontSizes, fontWeights, radii, shadows, spacing } from '../theme';
import type { Character } from '../types';
import { affectionLevelLabel } from '../utils/format';

interface CharacterSelectScreenProps {
  mode: 'SINGLE' | 'MULTI';
}

export function CharacterSelectScreen({ mode }: CharacterSelectScreenProps) {
  const { push } = useNavigation();
  const { isMember } = useSession();
  const { showToast } = useToast();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [memberGuideVisible, setMemberGuideVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listCharacters();
      setCharacters(list);
      setSelected((prev) => prev.filter((id) => list.some((c) => c.id === id && !c.locked)));
    } catch (e) {
      showToast({ title: '加载失败', message: e instanceof Error ? e.message : '请稍后重试', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load, isMember]);

  const handleTap = (char: Character) => {
    if (char.locked) {
      setMemberGuideVisible(true);
      return;
    }
    if (mode === 'SINGLE') {
      push('chat', { mode: 'SINGLE', characters: [char] });
      return;
    }
    setSelected((prev) => (prev.includes(char.id) ? prev.filter((x) => x !== char.id) : [...prev, char.id]));
  };

  const startMulti = () => {
    const chars = characters.filter((c) => selected.includes(c.id));
    if (chars.length < 2) {
      showToast({ message: '多角色模式至少选择 2 位伴友' });
      return;
    }
    push('chat', { mode: 'MULTI', characters: chars });
  };

  if (loading && characters.length === 0) return <LoadingView text="正在召唤伴友…" />;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={styles.title}>{mode === 'SINGLE' ? '选择一位伴友' : '选择伴友同台'}</Text>
          <Text style={styles.subtitle}>
            {mode === 'SINGLE'
              ? '点击免费角色开始私聊；皇冠角色为会员专属。'
              : '至少选择 2 位伴友，多角色将依据性格同台互动。'}
          </Text>
        </View>

        <View style={styles.grid}>
          {characters.map((char) => {
            const isSelected = selected.includes(char.id);
            return (
              <Pressable
                key={char.id}
                onPress={() => handleTap(char)}
                style={[
                  styles.card,
                  mode === 'MULTI' && isSelected && styles.cardSelected,
                  char.locked && styles.cardLocked,
                ]}
              >
                <View style={styles.avatarWrap}>
                  <Avatar name={char.name} avatarUrl={char.avatarUrl} size={64} />
                  {char.isMemberOnly ? <View style={styles.crownBadge}><CrownBadge small /></View> : null}
                  {mode === 'MULTI' && !char.locked ? (
                    <View style={[styles.selectDot, isSelected && styles.selectDotOn]}>
                      <Text style={styles.selectDotText}>{isSelected ? '✓' : ''}</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.name}>{char.name}</Text>
                <Text style={styles.titleText}>{char.title}</Text>

                <View style={styles.tags}>
                  {char.tags.slice(0, 2).map((t) => (
                    <View key={t} style={styles.tag}>
                      <Text style={styles.tagText}>{t}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.meta}>{char.occupation}</Text>
                <Text style={styles.meta2}>{char.dialectLabel} · 亲和度 {affectionLevelLabel(char.affection?.level ?? 1)}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {mode === 'MULTI' ? (
        <View style={styles.bottomBar}>
          <View style={styles.countWrap}>
            <Text style={styles.countNum}>{selected.length}</Text>
            <Text style={styles.countLabel}>/ 已选伴友</Text>
          </View>
          <PrimaryButton
            title={selected.length >= 2 ? `开始同台 (${selected.length})` : '至少选 2 位'}
            onPress={startMulti}
            disabled={selected.length < 2}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}

      {/* 会员引导弹窗 */}
      <AppModal visible={memberGuideVisible} onClose={() => setMemberGuideVisible(false)}>
        <View style={styles.modalBody}>
          <Text style={styles.modalEmoji}>👑</Text>
          <Text style={styles.modalTitle}>会员专属角色</Text>
          <Text style={styles.modalDesc}>
            开通会员即可解锁小满、苏雅，畅享无限消息、专属剧情与限量礼物。
          </Text>
          <PrimaryButton title="去开通会员" onPress={() => { setMemberGuideVisible(false); push('members', { from: 'characters' }); }} style={{ width: '100%' }} />
          <Pressable onPress={() => setMemberGuideVisible(false)} style={styles.modalCancel}>
            <Text style={styles.modalCancelText}>再看看</Text>
          </Pressable>
        </View>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  intro: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 6,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.card,
  },
  cardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  cardLocked: {
    opacity: 0.96,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  crownBadge: {
    position: 'absolute',
    right: -8,
    top: -4,
  },
  selectDot: {
    position: 'absolute',
    left: -4,
    top: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectDotOn: {
    backgroundColor: colors.primary,
  },
  selectDotText: {
    color: colors.textOnPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  name: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  titleText: {
    fontSize: fontSizes.sm,
    color: colors.primaryDark,
    fontWeight: fontWeights.semibold,
    marginTop: 2,
  },
  tags: {
    flexDirection: 'row',
    gap: 4,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  tag: {
    backgroundColor: colors.violetSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: fontSizes.xs,
    color: colors.violet,
  },
  meta: {
    marginTop: spacing.sm,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  meta2: {
    marginTop: 2,
    fontSize: fontSizes.xs,
    color: colors.textTertiary,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    ...shadows.sheet,
  },
  countWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  countNum: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.heavy,
    color: colors.primary,
  },
  countLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  modalBody: {
    alignItems: 'center',
  },
  modalEmoji: {
    fontSize: 44,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  modalDesc: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginVertical: spacing.lg,
    lineHeight: 22,
  },
  modalCancel: {
    marginTop: spacing.md,
    paddingVertical: 8,
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontSize: fontSizes.md,
  },
});
