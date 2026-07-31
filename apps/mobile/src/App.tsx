/**
 * The screen.
 *
 * It draws what `src/game.ts` was handed and asks it what may happen; it
 * decides nothing about the game itself. The board's layout comes from
 * `BOARD_ROWS` in the engine — eight rows of nine, counted from the bottom and
 * alternating direction — because a board drawn by hand is another copy of the
 * board.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { EMPTY, keep, loadKept, takeAccount, type Journal, type Store } from './journal';
import { deviceKeeper } from './device';

/**
 * The session's own copy of the path.
 *
 * Drawn from, and written to on every account. The device's store is behind it
 * — `deviceKeeper` — and this is what makes the screen answer instantly while
 * the disk answers when it can.
 */
const forTheSession = (): Store => {
  const held = new Map<string, string>();
  return { getItem: (key) => held.get(key) ?? null, setItem: (key, value) => void held.set(key, value) };
};

/** The device's store, made once. */
const keeper = deviceKeeper();

/** A game's die is seeded once, and the seed is what a player carries away. */
const startingSeed = () => Math.floor(Math.random() * 1_000_000);

export default function App() {
  const [game, setGame] = useState<Game>(() => newGame(startingSeed()));
  const [store] = useState<Store>(forTheSession);
  const [journal, setJournal] = useState<Journal>(EMPTY);
  const [draft, setDraft] = useState('');
  const [said, setSaid] = useState<string | null>(null);

  // The path from the last time the app was open. Read once, and never allowed
  // to land on top of something written since: a player who starts writing
  // before a slow disk answers must not have their words replaced by what was
  // there yesterday.
  useEffect(() => {
    let stale = false;
    void loadKept(keeper).then((kept) => {
      if (!stale) setJournal((now) => (now === EMPTY ? kept : now));
    });
    return () => {
      stale = true;
    };
  }, []);
  const language = resolveLanguage(undefined);
  const here = standingOn(game);
  const plan = planFor(language, here);

  const line =
    said ??
    (game.event
      ? `${game.event.roll} · ${game.event.from} → ${game.event.to} · ${game.event.direction}`
      : messageFor(language, 'app.waiting'));

  /**
   * Keep the account, then open the gate.
   *
   * In that order, and the order is the point: the gate is what the writing
   * buys. This app had the second half without the first — a button that
   * cleared the requirement and kept nothing — so the requirement was removed
   * rather than met.
   *
   * The game goes on whether or not the store took it. They wrote it; a device
   * that will not keep it is not their doing, and shutting a gate they have
   * earned would charge them for it. But they are told, while the words are
   * still on the screen.
   */
  const write = () => {
    const taken = takeAccount(journal, here, draft, Date.now(), store);
    if (!taken.written) return;

    setJournal(taken.journal);
    setDraft('');
    if (taken.gateOpens) setGame(fileReport(game));

    // Said when the device has answered, not before. The session already has
    // the words — the game goes on either way — and the sentence is about
    // whether they will still be here tomorrow, which nobody knows yet.
    void keep(keeper, taken.journal).then((landed) =>
      setSaid(
        landed && taken.kept
          ? messageFor(language, 'app.reportSaved')
          : messageFor(language, 'app.reportUnkept'),
      ),
    );
  };

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

      {owesAnAccount(game) ? (
        <View style={styles.writer}>
          <TextInput
            style={styles.field}
            multiline
            value={draft}
            onChangeText={setDraft}
            placeholder={messageFor(language, 'app.reportPlaceholder')}
          />
          <Pressable
            // Asked here and asked again by `write`: a dimmed control is a
            // drawing, and a drawing refuses nothing.
            disabled={draft.trim().length === 0}
            style={[styles.button, draft.trim().length === 0 && styles.shut]}
            onPress={write}
          >
            <Text style={styles.buttonText}>{messageFor(language, 'app.reportSave')}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.controls}>
        <Pressable
          // The same question the disabled state is drawn from, asked again by
          // the act: a dimmed control is a drawing, and a drawing refuses
          // nothing — a double tap walks straight past it.
          disabled={!mayThrow(game)}
          style={[styles.button, !mayThrow(game) && styles.shut]}
          onPress={() => {
            setSaid(null);
            setGame(throwDie(game).game);
          }}
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
  writer: { paddingHorizontal: 16, gap: 8 },
  field: {
    borderWidth: 1,
    borderColor: '#d8d0c4',
    borderRadius: 8,
    padding: 12,
    minHeight: 72,
    backgroundColor: '#fff',
    fontSize: 15,
  },
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
