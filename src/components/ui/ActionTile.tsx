import { StyleSheet, Text, View } from 'react-native';
import { ReactNode } from 'react';

import { Card } from '@/components/ui/Card';
import { palette } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type ActionTileProps = {
  icon: ReactNode;
  label: string;
  description?: string;
};

export const ActionTile = ({ icon, label, description }: ActionTileProps) => (
  <Card variant="solid" style={styles.container}>
    <View style={styles.icon}>{icon}</View>
    <View style={styles.textBlock}>
      <Text style={styles.label}>{label}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
    </View>
  </Card>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  label: {
    fontFamily: typography.title.fontFamily,
    fontSize: 15,
    fontWeight: '600',
    color: palette.charcoal,
  },
  description: {
    fontFamily: typography.body.fontFamily,
    fontSize: 13,
    color: palette.gray500,
    lineHeight: 18,
  },
});
