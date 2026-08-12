import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '@/theme/colors';
import { Fonts } from '@/theme/fonts';

/**
 * Lightweight markdown renderer for AI-generated guidance text.
 * Handles: ## headings, # headings, **bold**, - bullets, * bullets, blank lines.
 * No external dependencies required.
 */

type Segment = string | React.ReactElement;

function parseInlineBold(text: string): Segment[] {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <Text key={i} style={styles.bold}>
        {part}
      </Text>
    ) : (
      part
    )
  );
}

interface Props {
  text: string;
}

export function MarkdownRenderer({ text }: Props) {
  const lines = text.split('\n');

  return (
    <View style={styles.container}>
      {lines.map((line, i) => {
        // H2
        if (line.startsWith('## ')) {
          return (
            <Text key={i} style={styles.h2}>
              {line.slice(3).trim()}
            </Text>
          );
        }
        // H1
        if (line.startsWith('# ')) {
          return (
            <Text key={i} style={styles.h1}>
              {line.slice(2).trim()}
            </Text>
          );
        }
        // Bullet
        if (line.startsWith('- ') || line.startsWith('* ')) {
          const content = line.slice(2).trim();
          return (
            <View key={i} style={styles.bulletRow}>
              <View style={styles.bullet} />
              <Text style={styles.bulletText}>{parseInlineBold(content)}</Text>
            </View>
          );
        }
        // Numbered list
        if (/^\d+\.\s/.test(line)) {
          const match = line.match(/^(\d+)\.\s(.*)$/);
          if (match) {
            return (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.numberedBullet}>{match[1]}.</Text>
                <Text style={styles.bulletText}>{parseInlineBold(match[2])}</Text>
              </View>
            );
          }
        }
        // Blank line → spacer
        if (line.trim() === '') {
          return <View key={i} style={styles.spacer} />;
        }
        // Standalone bold line (acts as sub-heading)
        if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
          return (
            <Text key={i} style={styles.boldLine}>
              {line.slice(2, -2)}
            </Text>
          );
        }
        // Regular paragraph
        return (
          <Text key={i} style={styles.body}>
            {parseInlineBold(line)}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  h1: {
    fontFamily: Fonts.bold,
    fontSize: 17,
    lineHeight: 24,
    color: palette.text.primary,
    marginTop: 10,
    marginBottom: 4,
  },
  h2: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    lineHeight: 22,
    color: palette.brandGreen,
    marginTop: 10,
    marginBottom: 2,
  },
  bold: {
    fontFamily: Fonts.bold,
    color: palette.text.primary,
  },
  boldLine: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    lineHeight: 20,
    color: palette.text.primary,
    marginTop: 6,
  },
  body: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: palette.text.secondary,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingLeft: 4,
    marginTop: 2,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.brandGreen,
    marginTop: 9,
    flexShrink: 0,
  },
  numberedBullet: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: palette.brandGreen,
    width: 20,
    marginTop: 1,
    flexShrink: 0,
  },
  bulletText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: palette.text.secondary,
    flex: 1,
  },
  spacer: {
    height: 6,
  },
});
