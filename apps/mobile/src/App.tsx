/**
 * The screen.
 *
 * It draws what `src/game.ts` was handed and asks it what may happen; it
 * decides nothing about the game itself. The board's layout comes from
 * `BOARD_ROWS` in the engine — eight rows of nine, counted from the bottom and
 * alternating direction — because a board drawn by hand is another copy of the
 * board.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BOARD_ROWS } from '@leela/engine';
import { messageFor, planFor, resolveLanguage } from '@leela/content';
import {
  fileReport,
  isOver,
  mayThrow,
  newGame,
  owesAnAccount,
  standingOn,
  throwDie,
  type Game,
} from './game';

/** A game's die is seeded once, and the seed is what a player carries away. */
const startingSeed = () => Math.floor(Math.random() * 1_000_000);

export default function App() {
  const [game, setGame] = useState<Game>(() => newGame(startingSeed()));
  const language = resolveLanguage(undefined);
  const here = standingOn(game);
  const plan = planFor(language, here);

  const line = game.event
    ? `${game.event.roll} · ${game.event.from} → ${game.event.to} · ${game.event.direction}`
    : messageFor(language, 'app.waiting');

  return (
    <View style={styles.screen}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>
          {here}. {plan.title}
        </Text>
        <Text style={styles.line}>{line}</Text>

        <View style={styles.board}>
          {BOARD_ROWS.map((row, index) => (
            <View key={index} style={styles.row}>
              {row.map((square) => (
                <View key={square} style={[styles.cell, square === here && styles.standing]}>
                  <Text style={square === here ? styles.standingText : styles.cellText}>
                    {square}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <Text style={styles.plan}>{plan.body}</Text>
      </ScrollView>

      <View style={styles.controls}>
        {owesAnAccount(game) ? (
          <Pressable style={styles.button} onPress={() => setGame(fileReport(game))}>
            <Text style={styles.buttonText}>{messageFor(language, 'app.reportWrite')}</Text>
          </Pressable>
        ) : null}

        <Pressable
          // The same question the disabled state is drawn from, asked again by
          // the act: a dimmed control is a drawing, and a drawing refuses
          // nothing — a double tap walks straight past it.
          disabled={!mayThrow(game)}
          style={[styles.button, !mayThrow(game) && styles.shut]}
          onPress={() => setGame(throwDie(game).game)}
        >
          <Text style={styles.buttonText}>{messageFor(language, 'app.roll')}</Text>
        </Pressable>

        {isOver(game) ? (
          <Pressable style={styles.button} onPress={() => setGame(newGame(startingSeed()))}>
            <Text style={styles.buttonText}>{messageFor(language, 'app.restart')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#faf7f2' },
  body: { padding: 16, paddingTop: 64, gap: 12 },
  title: { fontSize: 20, fontWeight: '600' },
  line: { fontSize: 15, color: '#6b6255' },
  board: { gap: 2, alignSelf: 'center' },
  row: { flexDirection: 'row', gap: 2 },
  cell: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#efe9df',
    borderRadius: 4,
  },
  standing: { backgroundColor: '#b4643c' },
  cellText: { fontSize: 12, color: '#6b6255' },
  standingText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  plan: { fontSize: 15, lineHeight: 22, color: '#2f2a24' },
  controls: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 32 },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#b4643c',
    alignItems: 'center',
  },
  shut: { backgroundColor: '#cdc6ba' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
