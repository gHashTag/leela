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
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BOARD_ROWS } from '@leela/engine';
import { bookFor, messageFor, planFor, resolveLanguage,
  directionOf,
} from '@leela/content';
import {
  fileReport,
  isOver,
  mayThrow,
  newGame,
  owesAnAccount,
  standingOn,
  throwDie,
  type Game,
  squareToRead,
} from './game';
import { PALETTE } from './palette';
import {
  EMPTY,
  isIntention,
  keep,
  INTENTION_KEY,
  loadIntention,
  loadKeptIntention,
  keepIntention,
  loadKept,
  saveIntention,
  shareName,
  shareSquare,
  takeAccount,
  takeIn,
  takeSquare,
  toShare,
  writingsOn,
  type Journal,
  type Store,
} from './journal';
import { MAX_INTENTION_CHARS, MAX_REPORT_CHARS } from '@leela/journal';
import { deviceKeeper } from './device';
import { GAME_KEY, keepGame, loadKeptGame } from './game-store';
import { HANDLE, squareHandle } from './handles';

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

/** The device's store, made once, one per thing kept. */
const keeper = deviceKeeper();
const gameKeeper = deviceKeeper(GAME_KEY);
const intentionKeeper = deviceKeeper(INTENTION_KEY);

/** A game's die is seeded once, and the seed is what a player carries away. */
const startingSeed = () => Math.floor(Math.random() * 1_000_000);

export default function App() {
  const [game, setGame] = useState<Game>(() => newGame(startingSeed()));
  const [store] = useState<Store>(forTheSession);
  const [journal, setJournal] = useState<Journal>(EMPTY);
  const [draft, setDraft] = useState('');
  const [said, setSaid] = useState<string | null>(null);
  const [intention, setIntention] = useState('');
  const [asking, setAsking] = useState('');
  const [pasted, setPasted] = useState('');
  const [reading, setReading] = useState(false);

  // The path from the last time the app was open. Read once, and never allowed
  // to land on top of something written since: a player who starts writing
  // before a slow disk answers must not have their words replaced by what was
  // there yesterday.
  // What they are playing for, from the last time. The published app will not
  // show the board without one; neither will this.
  useEffect(() => {
    // The session's copy first, so the screen answers at once, and then the
    // device's — which is the one that survives a launch. Never allowed to land
    // on an answer given since: somebody typing before a slow disk replies must
    // not have their question replaced by yesterday's.
    setIntention(loadIntention(store));
    let stale = false;
    void loadKeptIntention(intentionKeeper).then((kept) => {
      if (kept !== '' && !stale) setIntention((now) => (now === '' ? kept : now));
    });
    return () => {
      stale = true;
    };
  }, [store]);

  useEffect(() => {
    let stale = false;
    void loadKept(keeper).then((kept) => {
      if (!stale) setJournal((now) => (now === EMPTY ? kept : now));
    });
    return () => {
      stale = true;
    };
  }, []);

  /**
   * The board, from the last time.
   *
   * This app kept a year of writing and lost where the player was standing on
   * every launch. Read once and never allowed to land on a game already in
   * progress, for the reason the journal is not: somebody who begins throwing
   * before a slow disk answers must not be pulled back to yesterday.
   */
  useEffect(() => {
    let stale = false;
    void loadKeptGame(gameKeeper).then((kept) => {
      if (kept !== null && !stale) setGame((now) => (now.rollsTaken === 0 ? kept : now));
    });
    return () => {
      stale = true;
    };
  }, []);

  /**
   * And kept after every throw.
   *
   * On the game rather than on the throw, so a report — which changes the
   * session without turning the die — is kept too. Whether the device took it
   * is not said here: the player is told about their *writing*, which is
   * theirs, and a board that has to be re-entered is a smaller loss than words.
   */
  useEffect(() => {
    void keepGame(gameKeeper, game);
  }, [game]);
  const language = resolveLanguage(undefined);
  // Which way the language reads. Arabic and Urdu are among the twenty-two, and
  // a field left at the default puts their text against the wrong margin with
  // the caret in the wrong corner.
  const reading_direction = directionOf(language);
  const here = standingOn(game);
  // Where the piece is drawn and what may be read are two questions. `here` is
  // 68 for a player who has never thrown — the engine parks them there and the
  // published app draws the gem there from the first screen — and printing that
  // square's teaching hands somebody the end of the game on page one.
  const square = squareToRead(game);
  const plan = square === null ? null : planFor(language, square);

  const refusal = mayThrow(game, intention);

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
    /*
     * The keyboard covers the button that keeps what was just typed.
     *
     * Found by the walk rather than by reading: Detox refused to tap Save
     * because it was *not visible* — `view bounds: {{16, 702.7}, {370, 45}}` on
     * an 874-point screen, under a keyboard about 300 points tall. A player
     * would have to dismiss the keyboard to reach it, and nothing on screen
     * says so.
     *
     * `KeyboardContainer` in the published app is the same answer to the same
     * problem: `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`. This
     * is that, at the root, because both writers and the controls row all sit
     * below the fold.
     */
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="auto" />
      <ScrollView testID={HANDLE.page} contentContainerStyle={styles.body}>
        {plan !== null ? (
          <Text testID={HANDLE.square} accessibilityRole="header" style={styles.title}>
            {square}. {plan.title}
          </Text>
        ) : null}
        <Text style={styles.line}>{line}</Text>

        <View style={styles.board}>
          {BOARD_ROWS.map((row, index) => (
            <View key={index} style={styles.row}>
              {row.map((square) => (
                <View
                  key={square}
                  testID={squareHandle(square)}
                  accessibilityLabel={String(square)}
                  accessibilityState={{ selected: square === here }}
                  style={[styles.cell, square === here && styles.standing]}
                >
                  <Text style={square === here ? styles.standingText : styles.cellText}>
                    {square}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        {plan !== null ? <Text style={styles.plan}>{plan.body}</Text> : null}

        {/*
          The book, which every other surface has and this one did not. A player
          on a square they do not understand had nowhere to look: the bot has
          `/rules`, the mini app has the chapters, and the phone had a plan's
          text and nothing around it.

          `bookFor` rather than `rulesFor`: a language with no chapters of its
          own is served the English ones, and a chapter its book is missing is
          borrowed and marked — the reader gets a whole book either way.
        */}
        <Pressable
          testID={HANDLE.rules}
          accessibilityRole="button"
          accessibilityLabel={messageFor(language, 'app.rules')}
          style={styles.button}
          onPress={() => setReading((open) => !open)}
        >
          <Text style={styles.buttonText}>{messageFor(language, 'app.rules')}</Text>
        </Pressable>

        {reading
          ? bookFor(language).map((chapter) => (
              <View key={chapter.slug} style={styles.written}>
                <Text style={styles.title}>{chapter.title}</Text>
                <Text style={styles.plan}>{chapter.body}</Text>
              </View>
            ))
          : null}

        {/*
          What they wrote here before.
          
          The app kept a path and showed none of it — the same shape the bot was
          found in, where reports were written, stored, and never read back. A
          record nobody can read is a record the game is not producing.
          
          On this square rather than the whole path, because the whole path is a
          screen of its own and this is the moment it matters: a player standing
          again on a square they have stood on is the thing `revisited` exists
          to notice.
        */}
        {square !== null && writingsOn(journal, square).length > 0 ? (
          <View style={styles.written}>
            {writingsOn(journal, square).map((entry) => (
              <Text key={`${entry.plan}-${entry.at}`} style={styles.entry}>
                {entry.text}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/*
        The question, before the board. `blockGoBack: true` in the published
        app: there is no way past it, because every account is written inside
        it and one written before it was asked answers nothing.
      */}
      {intention === '' ? (
        <View style={styles.writer}>
          <Text style={styles.line}>{messageFor(language, 'app.intention')}</Text>
          <TextInput
            testID={HANDLE.intention}
            accessibilityLabel={messageFor(language, 'app.intention')}
            maxLength={MAX_INTENTION_CHARS}
            autoCapitalize="sentences"
            autoCorrect
            textContentType="none"
            placeholderTextColor={PALETTE.hint}
            style={[styles.field, reading_direction === 'rtl' && styles.rightToLeft]}
            multiline
            value={asking}
            onChangeText={setAsking}
            placeholder={messageFor(language, 'app.intentionHint')}
          />
          <Pressable
            testID={HANDLE.intentionSave}
            accessibilityRole="button"
            accessibilityLabel={messageFor(language, 'app.reportSave')}
            disabled={!isIntention(asking)}
            style={[styles.button, !isIntention(asking) && styles.shut]}
            onPress={() => {
              // Held for the session whatever the device says, and the device
              // is asked separately — the two questions this app keeps apart.
              setIntention(asking.trim());
              void keepIntention(intentionKeeper, asking.trim());
              if (!saveIntention(store, asking)) {
                setSaid(messageFor(language, 'app.reportUnkept'));
              }
            }}
          >
            <Text style={[styles.buttonText, !isIntention(asking) && styles.shutText]}>{messageFor(language, 'app.reportSave')}</Text>
          </Pressable>
        </View>
      ) : null}

      {owesAnAccount(game) ? (
        <View style={styles.writer}>
          <TextInput
            testID={HANDLE.report}
            accessibilityLabel={messageFor(language, 'app.reportPlaceholder')}
            maxLength={MAX_REPORT_CHARS}
            autoCapitalize="sentences"
            autoCorrect
            textContentType="none"
            placeholderTextColor={PALETTE.hint}
            style={[styles.field, reading_direction === 'rtl' && styles.rightToLeft]}
            multiline
            value={draft}
            onChangeText={setDraft}
            placeholder={messageFor(language, 'app.reportPlaceholder')}
          />
          <Pressable
            testID={HANDLE.reportSave}
            accessibilityRole="button"
            accessibilityLabel={messageFor(language, 'app.reportSave')}
            // Asked here and asked again by `write`: a dimmed control is a
            // drawing, and a drawing refuses nothing.
            disabled={draft.trim().length === 0}
            style={[styles.button, draft.trim().length === 0 && styles.shut]}
            onPress={write}
          >
            <Text style={[styles.buttonText, draft.trim().length === 0 && styles.shutText]}>{messageFor(language, 'app.reportSave')}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.controls}>
        <Pressable
          testID={HANDLE.roll}
          accessibilityRole="button"
          accessibilityLabel={messageFor(language, 'app.roll')}
          // The same question the disabled state is drawn from, asked again by
          // the act: a dimmed control is a drawing, and a drawing refuses
          // nothing — a double tap walks straight past it.
          disabled={refusal !== 'yes'}
          style={[styles.button, styles.abreast, refusal !== 'yes' && styles.shut]}
          onPress={() => {
            setSaid(null);
            setGame(throwDie(game, intention).game);
          }}
        >
          <Text style={[styles.buttonText, refusal !== 'yes' && styles.shutText]}>{messageFor(language, 'app.roll')}</Text>
        </Pressable>

        {/*
          Carrying the path away. `Share` is React Native's own, so no native
          dependency comes with it, and what goes out is the format every other
          surface reads — question included.
        */}
        {/* This square, as a message somebody can read. */}
        {/*
          `square` and not `here`: a player who won, wrote about 68 and started
          over is waiting to enter again with that account still in their
          journal, so this offered them the winning square's text on a board
          they had not begun. The two are the same number for anybody in play.
        */}
        {plan !== null && square !== null && writingsOn(journal, square).length > 0 ? (
          <Pressable
            testID={HANDLE.shareSquare}
            accessibilityRole="button"
            accessibilityLabel={messageFor(language, 'app.share')}
            style={[styles.button, styles.abreast]}
            onPress={() => {
              void Share.share({
                message: shareSquare(
                  square,
                  plan.title,
                  writingsOn(journal, square).at(-1)?.text ?? '',
                  '',
                ),
              });
            }}
          >
            <Text style={styles.buttonText}>{messageFor(language, 'app.share')}</Text>
          </Pressable>
        ) : null}

        {journal.entries.length > 0 ? (
          <Pressable
            testID={HANDLE.sharePath}
            accessibilityRole="button"
            accessibilityLabel={messageFor(language, 'app.pathExport')}
            style={[styles.button, styles.abreast]}
            onPress={() => {
              const stamp = new Date().toISOString().slice(0, 10);
              void Share.share({
                title: shareName(stamp),
                message: JSON.stringify(toShare(journal, intention), null, 2),
              });
            }}
          >
            <Text style={styles.buttonText}>{messageFor(language, 'app.pathExport')}</Text>
          </Pressable>
        ) : null}

        {/*
          Taking one back. A path that can only leave is two paths, not one:
          somebody who began at a table or in the mini app could not carry it
          here. The decisions are the format's — nothing lost, the gate not
          opened, the question taken only where there is none.
        */}
        <TextInput
          testID={HANDLE.paste}
          accessibilityLabel={messageFor(language, 'app.pasteEither')}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          textContentType="none"
          placeholderTextColor={PALETTE.hint}
          style={[styles.field, reading_direction === 'rtl' && styles.rightToLeft]}
          multiline
          value={pasted}
          onChangeText={setPasted}
          // The field takes either; the button below does the bringing. Both
          // read 'Bring one back' until now, so the phone showed one sentence
          // twice and said nothing about what may be pasted.
          placeholder={messageFor(language, 'app.pasteEither')}
        />
        <Pressable
          testID={HANDLE.pasteTake}
          accessibilityRole="button"
          accessibilityLabel={messageFor(language, 'app.pathImport')}
          disabled={pasted.trim().length === 0}
          style={[styles.button, styles.abreast, pasted.trim().length === 0 && styles.shut]}
          onPress={() => {
            // A square first, because that is what people paste. A path is a
            // file and an occasion; a square is a message, and the two are told
            // apart by the format rather than by asking the player which it is.
            const square = takeSquare(journal, pasted, Date.now());
            if (square.readable) {
              setJournal(square.journal);
              setPasted('');
              setSaid(
                square.added
                  ? messageFor(language, 'square.took', { plan: square.plan ?? here })
                  : messageFor(language, 'app.pathImportedNothing'),
              );
              void keep(keeper, square.journal);
              return;
            }

            const taken = takeIn(journal, pasted, intention);
            if (!taken.readable) {
              setSaid(messageFor(language, 'app.pathUnreadable'));
              return;
            }

            setJournal(taken.journal);
            setPasted('');
            if (taken.intention !== null) {
              setIntention(taken.intention);
              saveIntention(store, taken.intention);
              void keepIntention(intentionKeeper, taken.intention);
            }
            setSaid(
              taken.added === 0
                ? messageFor(language, 'app.pathImportedNothing')
                : messageFor(language, 'app.pathImported', { count: taken.added }),
            );
            void keep(keeper, taken.journal);
          }}
        >
          <Text style={[styles.buttonText, pasted.trim().length === 0 && styles.shutText]}>{messageFor(language, 'app.pathImport')}</Text>
        </Pressable>

        {isOver(game) ? (
          <Pressable
            testID={HANDLE.restart}
            accessibilityRole="button"
            accessibilityLabel={messageFor(language, 'app.restart')}
            style={[styles.button, styles.abreast]}
            onPress={() => setGame(newGame(startingSeed()))}
          >
            <Text style={styles.buttonText}>{messageFor(language, 'app.restart')}</Text>
          </Pressable>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}


const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.page },
  body: { padding: 16, paddingTop: 64, gap: 12 },
  title: { fontSize: 20, fontWeight: '600' },
  line: { fontSize: 15, color: PALETTE.hint },
  board: { gap: 2, alignSelf: 'center' },
  row: { flexDirection: 'row', gap: 2 },
  cell: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.cell,
    borderRadius: 4,
  },
  standing: { backgroundColor: PALETTE.accent },
  cellText: { fontSize: 12, color: PALETTE.hint },
  standingText: { fontSize: 12, color: PALETTE.onAccent, fontWeight: '700' },
  plan: { fontSize: 15, lineHeight: 22, color: PALETTE.text },
  written: {
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: PALETTE.cell,
  },
  entry: { fontSize: 15, lineHeight: 21, color: PALETTE.entry },
  writer: { paddingHorizontal: 16, gap: 8 },
  /** Arabic and Urdu read the other way; the field has to as well. */
  rightToLeft: { textAlign: 'right', writingDirection: 'rtl' },
  field: {
    borderWidth: 1,
    borderColor: PALETTE.rule,
    borderRadius: 8,
    padding: 12,
    minHeight: 72,
    backgroundColor: PALETTE.field,
    fontSize: 15,
  },
  controls: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 32 },
  /** A control sharing the bottom row, which is the only place `flex` belongs. */
  abreast: { flex: 1 },
  button: {
    // No `flex` here. It belongs to the row at the bottom, where three controls
    // share a line — and in the two column blocks above it gave the button a
    // flex-basis of zero, so it collapsed to its padding and clipped its own
    // label out of existence. The intention's Save button was an empty grey
    // strip on the one screen a new player cannot get past.
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: PALETTE.accent,
    alignItems: 'center',
  },
  shut: { backgroundColor: PALETTE.shut },
  buttonText: { color: PALETTE.onAccent, fontWeight: '600' },
  shutText: { color: PALETTE.onShut, fontWeight: '600' },
});
