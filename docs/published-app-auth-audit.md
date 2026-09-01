# The published app's sign-up and sign-in, audited

**This is about `main`, not about this branch.** The unified monorepo has no
accounts at all: the phone, the mini app and the bot each identify a player
without one, and nothing here reads a password. Nothing described below has been
changed, because the code it describes is not on this branch.

It exists because the flows were audited and the findings would otherwise be
lost. Read it as what the live app does to real people today, and as a list of
things the surfaces in this repository must not grow.

## How it was read

Five readers over `screens/Authenticator/` and what it calls, one per dimension:
the sign-up chain, the sign-in chain, password reset, what the user is told, and
where data goes. Every finding was then handed to a separate reader whose
instructions were to **refute** it and to answer *not real* unless the code
plainly showed the failure reachable.

**41 confirmed, 12 refuted.** The refuted ones are listed at the end, because a
claim that did not survive is worth as much as one that did: it is where a
reading of this code goes wrong.

## Two things found before any of that

The build under test carries a **placeholder** `GoogleService-Info.plist`
(`PROJECT_ID: placeholder-project`), so every sign-in and sign-up returns
`auth/internal-error` whatever the credentials — the project does not exist. The
real file is a secret and is not in the repository, correctly.

And pressing *Sign Up* on an **empty** form — nothing typed at all — produces a
LogBox error, `On:SignUp/ My Error: [object Object]`. Both halves of that are
findings below: ordinary validation failure is routed into the crash reporter,
and the reporter destroys the object it is given by interpolating it into a
string.


## Blocker (9)

### SignUpUsername.onSubmit has no error handling: a failed profile write freezes the screen on a spinner with no back button and no way forward

`src/screens/Authenticator/SignUpUsername/index.tsx:87` — sign-up

```
const onSubmit: SubmitHandler<FieldValues> = async (data) => {
    setLoading(true)
    const { firstName, lastName } = data
    const { email } = route.params
    await auth().currentUser?.updateProfile({ displayName: `${firstName} ${lastName}` })
    await createProfile({
      email,
      // @ts-ignore
      uid: getUid(),
      firstName,
      lastName
    })
    ...
    setLoading(false)
  }
```

**What happens.** User fills in first/last name and taps Sign Up. The Firestore write inside createProfile (src/screens/helper.ts:93 `.doc(uid).set({...})`, no catch) rejects - permission-denied, `unavailable` while offline, or `getUid()` returning undefined because currentUser is null (deliberately silenced by the `// @ts-ignore` on line 96). There is no try/catch, so `setLoading(false)` on line 105 never runs and the screen renders `<Loading />` (line 122) forever. The user cannot escape: `iconLeft={null}` (line 120) means Header renders no back icon (`{iconLeft && (...)}` in src/components/Header/index.tsx:59), `useNoBackHandler()` (line 85) returns true from every Android hardware back press, and the stack sets `gestureEnabled: false` (src/Navigation.tsx:171) so iOS swipe-back is dead. Only killing the app gets out - and it leaves a Firebase auth user whose displayName was already updated on line 91 but who has no Profiles document.

**Held against refutation.** Confirmed in /Users/playra/leela-src/leela/src/screens/Authenticator/SignUpUsername/index.tsx (line numbers match the claim exactly). onSubmit at :87-106 has zero try/catch (grep -c "try" = 0), so a rejected await skips setLoading(false) at :105 and the screen renders <Loading /> at :122 permanently; react-hook-form's handleSubmit rethrows and never touches this local state. The rejection source is real: /Users/playra/leela-src/leela/src/screens/helper.ts:94-96 awaits firestore().collection('Profiles').doc(uid).set({...}) with no catch (claim said :93, actual .doc(uid) is :95 - trivial drift), while sibling helpers in the same file do guard (updateIntention catch + captureException at :188), so this is an omission, not a convention. Escape is genuinely blocked: AppContainer forwards iconLeft to Header, and /Users/playra/leela-src/leela/src/components/Header/index.tsx:59 renders the back Pressable only under {iconLeft && (...)} with iconLeft={null} at :120; /Users/playra/leela-src/leela/src/hooks/useNoBackHandler.ts returns true from every hardwareBackPress; /Users/playra/leela-src/leela/src/Navigation.tsx:172 sets gestureEnabled:false in navigator screenOptions and the Auth Stack.Group (:192) overrides only `animation`. No safety net exists: grep for ErrorBoundary/setJSExceptionHandler/ErrorUtils/RNRestart across src/ and index.js returns nothing. Reachable via helper.ts:359 and ConfirmSignUp/index.tsx:45. Only correction: force-quitting is recoverable because helper.ts:359 routes the profile-less user back to this screen, so the account is not permanently orphaned - but the inescapable frozen spinner is real.

### Auth account is created before the SendPulse call, and any SendPulse failure aborts navigation, stranding the user on SignUp with an account that already exists

`src/screens/Authenticator/SignUp/useSignUp.ts:64` — sign-up

```
await auth()
  .createUserWithEmailAndPassword(email, password)
  .then(async () => {
    await Keychain.setInternetCredentials('auth', email, password)
    await postEmailToSendPulse(email)
    navigate('CONFIRM_SIGN_UP', { email })
    setLoading(false)
  })
  .catch((exception) => { switch (exception.code) { ... case 'auth/email-already-in-use': setError(t('userNameExistsException'))
```

**What happens.** `postEmailToSendPulse` calls `const token = await getToken()` on src/screens/Authenticator/SignUp/sendpulse.ts:36, which is OUTSIDE that function's try block (opened on line 38). So a SendPulse OAuth failure - rotated/missing ID_SENDPULSE or SECRET_SENDPULSE in a release build, a 4xx/5xx from api.sendpulse.com, DNS failure - rejects out of postEmailToSendPulse into the `.catch` on line 72, which is written only for Firebase auth codes. `navigate('CONFIRM_SIGN_UP', { email })` on line 69 never runs. The Firebase account has already been created and the user is signed in, but they are still sitting on the Sign Up form. Tapping Sign Up again hits `auth/email-already-in-use` and shows t('userNameExistsException') - the app tells them their brand-new email is already taken. The same happens if `Keychain.setInternetCredentials` on line 67 rejects (device locked).

**Held against refutation.** Confirmed by reading the source. /Users/playra/leela-src/leela/src/screens/Authenticator/SignUp/sendpulse.ts:36 does `const token = await getToken()` OUTSIDE the try that opens at line 38 (the try/catch at 38-51 wraps only the addressbook POST). getToken (sendpulse.ts:18-28) is an unguarded axios.post to api.sendpulse.com/oauth/access_token, so a bad/rotated ID_SENDPULSE or SECRET_SENDPULSE, a 4xx/5xx, or DNS/offline rejects out of postEmailToSendPulse. In useSignUp.ts:68 that call is awaited inside the .then() of createUserWithEmailAndPassword and BEFORE navigate('CONFIRM_SIGN_UP', { email }) at line 69, so the rejection is caught by the .catch at line 72, whose switch(exception.code) handles only Firebase codes; an axios error hits `default` and sets setError(exception.code) (undefined) + setLoading(false). Navigation never runs while the Firebase account already exists and the user is signed in. Same hazard for `await Keychain.setInternetCredentials` at line 67. Refutations checked and rejected: (1) no auth-state rescue - grep for onAuthStateChanged/onUserChanged/onIdTokenChanged across src returns zero hits, and src/Navigation.tsx:170-195 is one flat Stack.Navigator with initialRouteName="HELLO", not a conditionally mounted auth stack; (2) no useKeychain rescue - it is mounted only in src/screens/Authenticator/Hello/index.tsx:45 and src/screens/WelcomeScreen/index.tsx:30, not in SignUp/index.tsx, and it runs via useFocusEffect which already fired before submit; (3) the misleading second-tap message is real: useSignUp.ts:77-78 maps auth/email-already-in-use to t('userNameExistsException'). The sibling app at /Users/playra/leela-src/leela-game/src/screens/Authenticator/SignUp/useSignUp.ts has no SendPulse call at all, so it does not guard this path.

### SIGN_UP_USERNAME can be re-entered by an existing player, and its submit calls createProfile, which .set()s over the profile and erases plan and history

`src/screens/Authenticator/SignUpUsername/index.tsx:94` — sign-up

```
await createProfile({
      email,
      // @ts-ignore
      uid: getUid(),
      firstName,
      lastName
    })
```

**What happens.** `getProfile` (src/screens/helper.ts:51-61) swallows its own error and returns `undefined`. `onSignIn` (src/screens/helper.ts:358) then evaluates `if (!prof?.firstGame && !prof?.lastName)` - both true for `undefined` - and routes to SIGN_UP_USERNAME. Since useKeychain runs `onSignIn` on every launch (src/hooks/useKeychain.ts:28), a long-time player whose profile read fails once (offline with persistence off, transient `unavailable`) is dropped back onto the username step. When they submit, `createProfile` calls `.doc(uid).set({...})` (src/screens/helper.ts:93-110) with no merge option, replacing the document: `plan` reset to 68, `history` replaced by a single fresh entry, `firstGame` back to true, `start`/`finish` false. Their whole game is wiped by re-completing a signup step.

**Held against refutation.** Confirmed in /Users/playra/leela-src/leela (line numbers match the claim exactly). getProfile (src/screens/helper.ts:51-61) swallows the error and returns undefined (and also returns undefined with no error when the doc is absent from the offline cache, since res is only assigned inside try). onSignIn (src/screens/helper.ts:358) tests `!prof?.firstGame && !prof?.lastName`, both true for undefined, and calls navigate('SIGN_UP_USERNAME') at :359 - and this runs for an already-authenticated user on every launch via useKeychain's useFocusEffect -> onSignIn(user.user, true, linkTo) (src/hooks/useKeychain.ts:28,50-55). There is no auth-state gating on the route: SIGN_UP_USERNAME is registered in the single flat stack at src/Navigation.tsx:192, so the navigate succeeds from a signed-in session. The screen's onSubmit (src/screens/Authenticator/SignUpUsername/index.tsx:87-106) calls createProfile unconditionally, with no existence/already-a-player check, and createProfile (src/screens/helper.ts:93-110) uses firestore().collection('Profiles').doc(uid).set({...}) with NO merge option - replacing the document: plan reset to 68, history replaced by a single fresh entry, firstGame back to true, start/finish false, avatar and intention dropped. Lines 111-126 also overwrite OnlinePlayer.store to the reset values. Every other mutation in the same file uses .update() (onWin :65, updatePlan :140, updateProfName :171, createHistory :223, startStepTimer :250); createProfile's full-document .set() is the only destructive write, and it sits behind a screen an existing player can be re-routed to after a single failed/empty profile read. No guard elsewhere refutes it.

### A failed profile read after sign-in routes an existing player into profile creation, which overwrites their Firestore document and wipes game history

`src/screens/helper.ts:358` — sign-in

```
const prof = await getProfile()
...
if (!prof?.firstGame && !prof?.lastName) {
  navigate('SIGN_UP_USERNAME', { email: user.email })
}

// getProfile (src/screens/helper.ts:51-61) swallows its own failure:
//   } catch (err) { captureException(err, 'getProfile') }
//   return res            <-- returns undefined on any Firestore error
//
// SIGN_UP_USERNAME then calls createProfile (src/screens/helper.ts:96):
//   .doc(uid).set({ ... plan: 68, history: hisObj, firstGame: true, ... })
```

**What happens.** A returning player signs in (useSignIn.ts:60 calls onSignIn). The Firestore read in getProfile fails transiently - offline blip, permission-denied, backend unavailable - so it catches internally and returns undefined. Back in onSignIn, `!prof?.firstGame` and `!prof?.lastName` are both true because `prof` is undefined, so the app navigates to SIGN_UP_USERNAME as if this were a brand-new account. That screen calls useNoBackHandler() (SignUpUsername/index.tsx:85), so the player cannot back out; the only way forward is to type a name, which runs createProfile -> `.set({...})` with no `{ merge: true }`. The existing document is replaced wholesale: plan resets to 68, history resets to a single start entry, avatar and intention are gone. A transient network error destroys the user's saved progress.

**Held against refutation.** Confirmed in /Users/playra/leela-src/leela/src/screens/helper.ts (gHashTag/leela RN app; line numbers match the claim). getProfile (helper.ts:51-61) declares `let res`, and its catch only calls captureException, so any Firestore rejection returns undefined — indistinguishable from a missing document. onSignIn (helper.ts:353-359) then evaluates `if (!prof?.firstGame && !prof?.lastName)`, which is true for undefined, and navigates to SIGN_UP_USERNAME. That branch is unreachable for an existing account on a successful read: createProfile writes `firstGame: true` (helper.ts:105) and onWin flips it to false (helper.ts:65-69) while lastName is always written, so one of the two operands is always false — the undefined-on-error case is the only way in. navigate (constants.ts:19-23) is an unguarded navRef.navigate and the screen is registered at Navigation.tsx:192. SignUpUsername calls useNoBackHandler() (SignUpUsername/index.tsx:85), which returns true from hardwareBackPress (hooks/useNoBackHandler.ts), and renders iconLeft={null}, so there is no in-app exit. Submitting calls createProfile (index.tsx:94) which does `.collection('Profiles').doc(uid).set({...})` with a single argument and no `{ merge: true }` (helper.ts:93-110): plan is hardcoded to 68, history is replaced by a single `status: 'start'` entry, and avatar/intention/status are absent from the payload so Firestore deletes them. Refutation attempts failed: RN Firebase offline persistence narrows but does not close the window (permission-denied, resource-exhausted daily-quota, and unavailable/deadline-exceeded on a cold start with an empty cache after reinstall all reject, and Auth succeeding at useSignIn.ts:57 says nothing about Firestore); the path is not limited to the sign-in form since useKeychain.ts:28 calls the same onSignIn from a useFocusEffect at launch; and there is no firestore.rules or firebase.json in the repo to appeal to, while the same write path is required for legitimate signup.

### A non-Firebase rejection in the success path leaves the user authenticated, unnavigated, and with a completely blank error

`src/screens/Authenticator/SignIn/useSignIn.ts:81` — sign-in

```
await auth()
  .signInWithEmailAndPassword(email, password)
  .then(async (user) => {
    await Keychain.setInternetCredentials('auth', email, password)
    await onSignIn(user.user)
  })
  .catch((err) => {
    switch (err.code) {
      ...
      default:
        captureException(err.message, 'onSubmit')
        setError(err.code)
        break

// and line 90:
return { onSubmit, methods, error: error || '', loading, userInfo }
```

**What happens.** Keychain.setInternetCredentials rejects (device locked, Keychain access denied, keychain-sharing entitlement missing on a device restore). That rejection lands in the same .catch as auth errors. react-native-keychain errors carry no `code`, so `err.code` is undefined -> `setError(undefined)` -> line 90 collapses it to '' -> SignIn/index.tsx:87 renders `<TextError title="" />`, which draws nothing. The spinner stops and the untouched form returns. From the user's side the Sign In button did nothing at all - no message, no navigation - even though Firebase authenticated them and `auth().currentUser` is now set. Same silent outcome for any thrown value without a `code` field.

**Held against refutation.** Core defect confirmed; the "blank error" mechanism is wrong but the failure stands. /Users/playra/leela-src/leela/src/screens/Authenticator/SignIn/useSignIn.ts:59 awaits Keychain.setInternetCredentials BEFORE onSignIn(user.user) at :60, both inside the .then of an already-resolved signInWithEmailAndPassword, with the .catch at :62 attached to the whole chain — so a Keychain rejection skips navigation and is swallowed as if it were an auth error. onSignIn (/Users/playra/leela-src/leela/src/screens/helper.ts:330) wraps its entire body in try/catch and never rejects, so the outer catch can only ever see Firebase errors or the Keychain rejection. Nothing rescues the state: grep for onAuthStateChanged/onUserChanged/isLoggedIn across the repo finds only the unused definition at helper.ts:193, and /Users/playra/leela-src/leela/src/Navigation.tsx:174-202 is one flat stack (initialRouteName "HELLO", SIGN_IN at :185, MAIN at :202) reached only by imperative navigate() calls — there is no auth-conditional navigator. Firebase has persisted the session and nothing signs the user out, so auth().currentUser is set while the user sits on the sign-in form; setLoading(false) at :85 clears the spinner. WHERE THE CLAIM IS WRONG: err.code is NOT undefined for the named triggers. react-native-keychain@8.2.0 iOS RNKeychainManager.m:85-92 defines codeForError() as [NSString stringWithFormat:@"%li", error.code] and rejectWithError() passes it as the reject code; setInternetCredentialsForServer (:439) routes through insertKeychainEntry -> rejectWithError, so a locked device (errSecInteractionNotAllowed), denied access, or missing entitlement (-34018) all arrive with a numeric string code. Android KeychainModule.java:234-242 rejects with Errors.E_CRYPTO_FAILED / E_KEYSTORE_ACCESS_ERROR / E_UNKNOWN_ERROR. So setError(err.code) at :81 receives a truthy value and TextError (/Users/playra/leela-src/leela/src/components/TextComponents/TextError/index.tsx) renders a raw untranslated "-25308" rather than nothing. The truly blank render needs a code-less throw (unlinked native module), a build defect rather than the described runtime condition. The headline outcome — Firebase-authenticated, never navigated, stranded on the form with no actionable message — is plainly reachable as written.

### Raw Firebase error code rendered verbatim to the user in red under the password field

`src/screens/Authenticator/SignIn/useSignIn.ts:81` — what the user is told

```
default:
  captureException(err.message, 'onSubmit')
  setError(err.code)
  break
```

**What happens.** The switch handles only 5 codes (invalid-email, user-not-found, wrong-password, network-request-failed, too-many-requests). Any other Firebase failure falls to default and puts the machine code straight into state. `error` flows to SignIn/index.tsx:87 `<TextError title={error} textStyle={textStyle} />`, and TextError paints it red (TextError/index.tsx:12 `color: 'red'`) directly beneath the password Input (index.tsx:78-84). A user who hits auth/internal-error, auth/invalid-credential, auth/user-disabled or auth/operation-not-allowed reads the literal string "auth/internal-error" instead of a sentence. This is the exact string in the screenshot. Note the developer message is sent to captureException while the code — the least human part of the error — is the part shown to the person.

**Held against refutation.** Confirmed. /Users/playra/leela-src/leela/src/screens/Authenticator/SignIn/useSignIn.ts:79-82 is a `default:` branch that calls `captureException(err.message, 'onSubmit')` then `setError(err.code)` — the raw code, with no `t()` wrapper, unlike all five handled cases (lines 64-78). Nothing sanitizes it downstream: grep across src finds no other reference to `invalid-credential`/`user-disabled`/`internal-error`, and no `auth/`-prefixed keys exist in src/locales/*/translation.json. The value reaches the screen at src/screens/Authenticator/SignIn/index.tsx:86-94, where the only guard is `error !== t('auth.forgotPassword')` (that one value becomes a ButtonLink); every other value renders as `<TextError title={error} textStyle={textStyle} />` at line 87, immediately below the password Input (lines 78-84). src/components/TextError/index.tsx paints its `title` with `color: 'red'` (styles.h1) and does no filtering. Reachability is plain: package.json:25 pins @react-native-firebase/auth ^18.1.0, whose signInWithEmailAndPassword surfaces auth/invalid-credential, auth/user-disabled, auth/operation-not-allowed and auth/internal-error — none in the switch; with Firebase Email Enumeration Protection, auth/invalid-credential replaces wrong-password/user-not-found, making the default branch the ordinary bad-password path. The `.catch` at line 62 also covers the Keychain/onSignIn calls in `.then`, so a throw with no `.code` sets error to undefined. Same defect duplicated at /Users/playra/leela-src/leela-game/src/screens/Authenticator/SignIn/useSignIn.ts:72-75, rendered at that file's index.tsx:79.

### Sign-up form leaves the user permanently on a spinner with no back button when the profile write fails

`src/screens/Authenticator/SignUpUsername/index.tsx:105` — what the user is told

```
setLoading(true)
const { firstName, lastName } = data
const { email } = route.params
await auth().currentUser?.updateProfile({ ... })
await createProfile({ email, uid: getUid(), firstName, lastName })
fetchBusinesses()
navigation.navigate('SIGN_UP_AVATAR')
actionsDice.setOnline(true)
actionsDice.setPlayers(1)
setLoading(false)
```

**What happens.** There is no try/catch and no finally. `createProfile` (src/screens/helper.ts:79-127) awaits an un-caught `firestore().collection('Profiles').doc(uid).set(...)`. If that write rejects (offline, permission denied), the await on line 94 throws, so line 105 `setLoading(false)` never runs and `loading` stays true forever. The screen then renders `<Loading />` (line 123) — a bare react-native-spinkit spinner with no text and no timeout (components/Loading). Escape is blocked on both sides: `useNoBackHandler()` (line 85) swallows the Android hardware back press, and `iconLeft={null}` (line 120) removes the on-screen back button. The user enters a first and last name, taps Sign Up, and is trapped on an animation with nothing told to them and no way out but killing the app.

**Held against refutation.** Confirmed in /Users/playra/leela-src/leela (gHashTag/leela v6.5.1). onSubmit at src/screens/Authenticator/SignUpUsername/index.tsx:87-106 has no try/catch and no finally; setLoading(false) at :105 sits after all four awaits. createProfile at src/screens/helper.ts:79-127 is an unguarded `await firestore().collection('Profiles').doc(uid).set(...)`, and the earlier `await auth().currentUser?.updateProfile(...)` at index.tsx:91 rejects on a plain network failure — so a rejection strands `loading === true` and the screen renders <Loading /> (index.tsx:122-123), a bare react-native-spinkit spinner with no text or timeout (src/components/Loading/index.tsx:37-47). Every escape is closed: iconLeft={null} at index.tsx:120 flows through src/components/AppContainer/index.tsx:52 into src/components/Header/index.tsx:59 where the left control is behind `{iconLeft && ...}` and the right slot behind `iconRight ? ... : iconLeft && <View/>` (:94-100), both null, which also makes the onPress={goBack} at index.tsx:118 dead; the only other header tap target is the star at Header:64 gated on `isBlockGame && online`, and DiceStore.online defaults to false (src/store/DiceStore.ts:11) and is set true only at index.tsx:103 after the failing await; useNoBackHandler (src/hooks/useNoBackHandler.ts) returns true from hardwareBackPress; and src/Navigation.tsx:168-172 sets `headerShown: false, gestureEnabled: false` for the whole stack, so there is no native header and no iOS swipe-back. No loading reset, auth listener, or error boundary exists anywhere in src (grep for onAuthStateChanged/ErrorBoundary/setJSExceptionHandler is empty). Sibling helpers updateIntention (helper.ts:188) and onSignIn (helper.ts:350) do use try/catch + captureException, so this is an omission, not a convention. Only nuance: a purely offline Firestore set() leaves the promise pending rather than rejecting and can self-heal on reconnect, but permission-denied/invalid-argument and auth/network-request-failed are terminal.

### SendPulse token call sits outside the try/catch, so a marketing-list failure aborts registration after the Firebase account already exists

`src/screens/Authenticator/SignUp/sendpulse.ts:36` — data and third parties

```
const token = await getToken()

  try {
    await axios.post(
      `https://api.sendpulse.com/addressbooks/${addressBookId}/emails`,
```

**What happens.** getToken() posts to api.sendpulse.com OUTSIDE the try block. On any network blip, SendPulse 5xx, or rotated/expired client credentials it rejects, so postEmailToSendPulse rejects. In useSignUp.ts:68 that await sits between the successful createUserWithEmailAndPassword and navigate('CONFIRM_SIGN_UP'), so lines 69-70 never run and control falls to the .catch at line 72. The AxiosError code ('ERR_NETWORK', 'ERR_BAD_REQUEST') matches no case in the switch, so the default branch shows the user a raw untranslated string like 'ERR_NETWORK'. The Firebase account has already been created and the password already written to the Keychain, so the user is never taken to confirmation, and a retry now returns auth/email-already-in-use ('user already exists'). A third-party mailing-list API is a hard dependency of account creation.

**Held against refutation.** Confirmed, could not refute. /Users/playra/leela-src/leela/src/screens/Authenticator/SignUp/sendpulse.ts:36 `const token = await getToken()` is above the `try {` that opens at line 38; the try/catch (38-51) covers only the addressbook POST. getToken (sendpulse.ts:18-28) is a bare `await axios.post(.../oauth/access_token)` with no handler, and axios's default validateStatus rejects on non-2xx — I grepped all of src and found no axios.defaults and no interceptors, so nothing softens it. In /Users/playra/leela-src/leela/src/screens/Authenticator/SignUp/useSignUp.ts the `.then()` runs Keychain.setInternetCredentials (line 67) → `await postEmailToSendPulse(email)` (line 68) → navigate('CONFIRM_SIGN_UP') (line 69), so a rejection at 68 skips 69-70 and falls to the `.catch` at line 72, whose switch matches only `auth/*` codes; an AxiosError code hits `default:` → `setError(exception.code)` (line 91), rendered raw by SignUp/index.tsx via `<TextError title={error} />`. The Firebase account already exists, so retry hits line 77 `auth/email-already-in-use`. Refutations checked and failed: no onAuthStateChanged/onUserChanged listener exists anywhere in src (no auto-recovery), SIGN_UP is a live registered route (Navigation.tsx:191) reachable from Hello, and postEmailToSendPulse has exactly one caller (useSignUp.ts:68) so it is not dead code; the verification email is only sent from ConfirmSignUp/index.tsx:37, the screen never reached. Only partial mitigation is an undiscoverable one: signing in later routes an unverified account to CONFIRM_SIGN_UP via helper.ts:381-384. Repo gHashTag/leela, branch main, v6.5.1.

### SendPulse OAuth client_secret is shipped inside the mobile app and used directly from the device

`src/screens/Authenticator/SignUp/sendpulse.ts:24` — data and third parties

```
grant_type: 'client_credentials',
      client_id: ID_SENDPULSE,
      client_secret: SECRET_SENDPULSE
```

**What happens.** .babelrc line 6 enables [["module:react-native-dotenv"]], so `SECRET_SENDPULSE` and `ID_SENDPULSE` are replaced with string literals at build time and ship inside the release JS bundle of the published app (App Store id 1296604457 / com.leelagame). Anyone can unzip the IPA/APK and read them out of index.android.bundle. These are account-level client_credentials, not a scoped public key: with them an attacker mints their own token and calls GET https://api.sendpulse.com/addressbooks and the per-book email endpoints — exactly what getAddrressBook() at line 54 demonstrates — and exfiltrates every subscriber email address the product has ever collected, plus sends mail as the brand. The secret cannot be redacted here because it is not in the repo (.env is gitignored), but the code path that exports it to every device is the code above.

**Held against refutation.** Could not refute; every refutation angle failed. (1) Inlining is real: /Users/playra/leela-src/leela/.babelrc:6 sets "plugins": [["module:react-native-dotenv"]] with react-native-dotenv ^3.4.9 (package.json:55), a build-time Babel transform that replaces the @env named imports at sendpulse.ts:1 with string literals; src/types/env.d.ts declares SECRET_SENDPULSE as a plain string. The __mocks__/@env.js stub is bound only by jest.config.js moduleNameMapper, so it never affects the release bundle. (2) Not dead code: src/screens/Authenticator/SignUp/useSignUp.ts:13 imports postEmailToSendPulse and line 68 awaits it inside the success .then() of auth().createUserWithEmailAndPassword, which reaches getToken() at sendpulse.ts:36 -> :19-26. The only __DEV__ guard in that file (lines 16-18) merely prefills form fields and does not gate the call. (3) Screen is reachable unconditionally: src/Navigation.tsx:191 registers <Stack.Screen name="SIGN_UP" component={SignUp} />, navigated to from the public onboarding screen src/screens/Authenticator/Hello/index.tsx:91. (4) Shipped identity matches: android/app/build.gradle:140 is applicationId "com.leelagame". (5) Not a scoped public key: grant_type 'client_credentials' against api.sendpulse.com/oauth/access_token mints an account-level token, and getAddrressBook() at sendpulse.ts:54-61 uses that token for an account-wide GET /addressbooks from the device. Exposure is wider than claimed: a duplicate exists at /Users/playra/leela-src/LeelaAiWeb3/src/cons/sendpulse.ts:1-15. Caveat: the literal secret value is not in the checkout (.gitignore:63 is *.env, no .env present) and I did not unzip a store binary, so I verified the build config that inlines it rather than the artifact.


## Serious (23)

### ConfirmSignUp's verification poller is never cleared and re-sends a verification email to a user who has just verified

`src/screens/Authenticator/ConfirmSignUp/index.tsx:36` — sign-up

```
useEffect(() => {
    auth().currentUser?.sendEmailVerification()
    const verifyCheck = setInterval(() => {
      auth().currentUser?.reload()
      const emailVerified = auth().currentUser?.emailVerified
      if (emailVerified !== isVerify) {
        setIsVerify(emailVerified)
        if (emailVerified) {
          clearInterval(verifyCheck)
          navigation.navigate('SIGN_UP_USERNAME', route.params)
        }
      }
    }, 2200)
    return () => clearInterval(verifyCheck)
  }, [navigation, isVerify, route.params])
```

**What happens.** `isVerify` is in the dependency array (line 50). The moment verification succeeds the effect calls `setIsVerify(true)`, which re-runs the effect: line 37 fires `sendEmailVerification()` a second time, so the user receives another 'verify your email' message right after verifying, and a new interval is created whose closure captures `isVerify === true`. In that interval `emailVerified !== isVerify` is `true !== true` = false forever, so the `clearInterval(verifyCheck)` on line 44 is unreachable. ConfirmSignUp stays mounted in the native stack after `navigation.navigate('SIGN_UP_USERNAME', ...)`, so `auth().currentUser?.reload()` keeps hitting Firebase every 2.2 seconds for the rest of the session, through the username step, the avatar step and into the app.

**Held against refutation.** Confirmed by reading the file and its navigation context. /Users/playra/leela-src/leela/src/screens/Authenticator/ConfirmSignUp/index.tsx:36-50 matches the quote verbatim. Line 42 setIsVerify(emailVerified) flips state before the navigate on line 45, and isVerify is in the dep array (line 50), so the effect re-runs: line 37 sendEmailVerification() fires a second time (the only resend guard, canResend on line 33, gates just the manual _onResend at line 53), and a new interval is created capturing isVerify === true, making `emailVerified !== isVerify` permanently false and line 44's clearInterval unreachable. The screen is not unmounted: /Users/playra/leela-src/leela/src/Navigation.tsx:194 registers CONFIRM_SIGN_UP in a @react-navigation/native-stack v6.9 Stack.Navigator, the push chain is SIGN_UP (useSignUp.ts:69) -> CONFIRM_SIGN_UP -> SIGN_UP_USERNAME -> SIGN_UP_AVATAR (SignUpUsername/index.tsx:102) -> navigate('MAIN') (screens/helper.ts:368) with no reset/replace/popToTop anywhere, and grep finds no enableFreeze/freezeOnBlur, so the blurred screen still re-renders. Net effect: a duplicate verification email right after verifying, plus auth().currentUser?.reload() every 2.2s for the rest of the session.

### ConfirmSignUp reads emailVerified without awaiting reload(), so every poll reports the previous tick's state and a rejected reload is unhandled

`src/screens/Authenticator/ConfirmSignUp/index.tsx:39` — sign-up

```
auth().currentUser?.reload()
      const emailVerified = auth().currentUser?.emailVerified
```

**What happens.** `reload()` returns a Promise that is neither awaited nor caught. Line 40 reads the cached `emailVerified` synchronously, before the refresh has landed, so the poll always observes the result of the *previous* tick's reload - verification is detected one full 2.2 s cycle late. Worse, if `reload()` rejects (`auth/user-token-expired`, `auth/user-not-found` after the account is deleted from the console, connection drop) the rejection is unhandled, nothing is surfaced to the user, and the screen keeps spinning its 9CubeGrid loader indefinitely with no error and no path other than the back arrow.

**Held against refutation.** Confirmed by reading /Users/playra/leela-src/leela/src/screens/Authenticator/ConfirmSignUp/index.tsx:36-50. Line 39 `auth().currentUser?.reload()` is fire-and-forget (no await, no .catch, no enclosing try/catch), and line 40 reads `auth().currentUser?.emailVerified` synchronously in the same tick. In @react-native-firebase/auth v18 (package.json:25) `User.reload()` is a native-bridge call returning Promise<void>; the JS-side user snapshot backing `emailVerified` is only replaced on resolution, so each 2200 ms tick observes the previous tick's reload -> detection lag 2.2-4.4 s instead of 0-2.2 s. The codebase's own convention proves the intended form: the only other call site, src/screens/helper.ts:175, is `await auth().currentUser?.reload()` inside try/catch with captureException. Nothing guards it elsewhere: grep over src finds no onAuthStateChanged/onUserChanged/onIdTokenChanged listener and no global rejection tracker (setUnhandledPromiseRejectionTracker/ErrorUtils) in src, index.js or App.tsx, and the screen renders only `Loading type="9CubeGrid"` (line 81) with no error state. Reachable and shipped: registered at src/Navigation.tsx:194, entered from useSignUp.ts:69 and helper.ts:382, tracked in git (780a8ae). On auth/user-token-expired or auth/user-not-found RNFB clears currentUser, so emailVerified becomes undefined, setIsVerify(undefined) latches at line 42, and every later tick compares undefined !== undefined -> false: spinner runs forever, nothing surfaced. Two minor overstatements in the claim that do not change the verdict: a Resend button does exist (lines 84-94, though a silent no-op once currentUser is null), and a transient auth/network-request-failed self-heals since the interval keeps running.

### Resend button disables itself for 40 seconds even when the verification email fails to send, and the failure is invisible

`src/screens/Authenticator/ConfirmSignUp/index.tsx:52` — sign-up

```
const _onResend = async (): Promise<void> => {
    if (canResend) {
      auth().currentUser?.sendEmailVerification()
      setCanResend(false)
      setTimeout(() => setCanResend(true), 40000)
    }
  }
```

**What happens.** The send is not awaited and has no `.catch`. When Firebase rejects it - `auth/too-many-requests` is exactly what happens here because the effect on line 37 already sent one automatically, and the effect re-fires - the promise rejection is unhandled while `setCanResend(false)` runs regardless. The user sees the 'Resend' link dim (styles.btnDisabled, opacity 0.5) and reasonably concludes a new email is on the way. No email arrives, no error is shown, and they must wait 40 s to try again and get the same silent failure.

**Held against refutation.** Confirmed, could not refute. /Users/playra/leela-src/leela/src/screens/Authenticator/ConfirmSignUp/index.tsx:52-58 matches the quote exactly: `auth().currentUser?.sendEmailVerification()` on line 54 is neither awaited nor given a `.catch`, and `setCanResend(false)` (line 55) plus the 40s `setTimeout` (line 56) run unconditionally, independent of the promise outcome. Refutation attempts, all negative: (1) the wrapper does not guard it - /Users/playra/leela-src/leela/src/components/Pressable/index.tsx is a style-only wrapper over RN Pressable with no await/catch of onPress; (2) no global error surface - grep over src/ finds no setUnhandledPromiseRejectionTracker, no ErrorUtils handler, no unhandledrejection listener, no toast on this path; (3) no other guarded caller - `sendEmailVerification` occurs only at index.tsx:37 and index.tsx:54, neither handled; (4) the failure is reachable - line 37 auto-sends on mount and the effect deps [navigation, isVerify, route.params] (line 50) re-run it whenever isVerify flips (e.g. `undefined !== false` when currentUser is momentarily null, line 41), so a rate-limited second send is ordinary; plain offline rejection reaches the same dead end regardless. The UI feedback is exactly as claimed: `disabled={!canResend}` and `styles.btnDisabled` opacity 0.5 (index.tsx:86-87, 104-106). There is an additional silent branch: if `currentUser` is null the optional chain makes line 54 a no-op while the button still disables for 40s. The file is committed (780a8ae) and byte-identical to the build copy at /private/tmp/leela-build/src/screens/Authenticator/ConfirmSignUp/index.tsx.

### SignUpAvatar is a dead end when the image upload fails: no error, no skip, no back, and the Done button never appears

`src/screens/Authenticator/SignUpAvatar/index.tsx:60` — sign-up

```
{!!OnlinePlayer.store.avatar && (
          <Button title={t('done')} onPress={handleSubmit} />
        )}
```

**What happens.** The only exit from this screen is the Done button, and it renders only when `OnlinePlayer.store.avatar` is truthy. That field is set only after the nft.storage upload AND the Firestore write both succeed (src/hooks/useChooseAvatarImage.ts:64 and src/store/OnlinePlayer.ts:175). When `imageUpload.ok` is false, src/hooks/useChooseAvatarImage.ts:67-72 only calls `captureException` - it does not even reset `isLoading`, so the avatar spins forever - and shows the user nothing. Meanwhile `useNoBackHandler()` (line 45) eats the Android back press, `iconLeft={null}` (line 52) means no header back icon is rendered, AppContainer gets no `onPress` at all, and the navigator sets `gestureEnabled: false` (src/Navigation.tsx:171). A user whose upload host is unreachable can neither finish sign-up nor leave the screen; there is no skip affordance.

**Held against refutation.** Confirmed in /Users/playra/leela-src/leela (the checkout matching the cited paths; the sibling leela-game checkout lacks useChooseAvatarImage.ts). The Done button is the only completion control and is gated on OnlinePlayer.store.avatar at src/screens/Authenticator/SignUpAvatar/index.tsx:60. That field is written in only two places — src/store/OnlinePlayer.ts:154 (inside getProfile) and :175 (inside uploadImage, after the Firestore write) — and getProfile is invoked only on the already-registered branch at src/screens/helper.ts:378, never before this screen; the store default is avatar: '' (src/store/OnlinePlayer.ts:52). Both entry points guarantee it is empty here: src/screens/helper.ts:360-361 navigates only when !prof.avatar, and src/screens/Authenticator/SignUpUsername/index.tsx:101 navigates immediately after createProfile. On a non-ok upload, src/hooks/useChooseAvatarImage.ts:67-72 calls only captureException and does not setIsLoading(false) (unlike the ok branch at :65 and the catch at :78), so the spinner stays up; captureException is console + Sentry only (src/constants.ts:162-174), so nothing is shown to the user. Exits are all closed: iconLeft={null} at SignUpAvatar/index.tsx:52 means Header renders no back icon (src/components/Header/index.tsx:59), useNoBackHandler returns true for hardwareBackPress (src/hooks/useNoBackHandler.ts:6), and src/Navigation.tsx:172 sets gestureEnabled: false. Two nuances the claim overstates: the avatar Pressable is not disabled while loading, so the picker can be retried; and the isBlockGame && online star in Header (lines 64-68) can navigate to SUBSCRIPTION_SCREEN. Neither surfaces an error nor allows sign-up to be completed or skipped.

### SignUp renders no error at all when exception.code is undefined, and shows raw axios codes when it is not

`src/screens/Authenticator/SignUp/useSignUp.ts:91` — sign-up

```
default:
                captureException(exception.message, 'useSignUp')
                setError(exception.code)
                break
```

**What happens.** For any non-Firebase rejection reaching this catch (the SendPulse/Keychain path above), `exception.code` is either undefined or an axios code. If undefined, line 100 `error: error || ''` collapses it to `''`, and index.tsx line 80 `{error !== '' && (<TextError .../>)}` renders nothing: the spinner disappears, the form returns, and absolutely nothing tells the user their sign-up failed - even though the account was created. With axios 1.4 (package.json:36) the user instead sees the untranslated string `ERR_BAD_REQUEST` or `ERR_NETWORK` as the sign-up error message.

**Held against refutation.** Could not refute. The catch at /Users/playra/leela-src/leela/src/screens/Authenticator/SignUp/useSignUp.ts:72-95 is chained after the async .then (lines 66-71), so rejections from Keychain.setInternetCredentials (line 67) and postEmailToSendPulse (line 68) land in the same switch, after the Firebase account was already created and before navigate (line 69). Reachability of the axios half: in /Users/playra/leela-src/leela/src/screens/Authenticator/SignUp/sendpulse.ts, `const token = await getToken()` is OUTSIDE the try/catch (only the second axios.post is guarded), so a getToken failure escapes as an AxiosError; package.json:36 pins axios ^1.4.0, whose errors carry code 'ERR_BAD_REQUEST'/'ERR_NETWORK' -> useSignUp.ts:91 setError(exception.code) puts that raw string in the UI untranslated. Reachability of the silent half: plain JS errors on that path have no `code` (e.g. getSystemLanguage in sendpulse.ts calls .slice on NativeModules...AppleLocale, a TypeError with no code), so setError(undefined) -> useSignUp.ts:100 `error: error || ''` -> index.tsx:80 `{error !== '' && <TextError/>}` renders nothing, while line 94 setLoading(false) restores the form. captureException (/Users/playra/leela-src/leela/src/constants.ts:162-174) only writes to console/Sentry, so there is no compensating user-facing message.

### Unmapped Firebase error codes are rendered verbatim to the user as the error message

`src/screens/Authenticator/SignIn/useSignIn.ts:81` — sign-in

```
default:
  captureException(err.message, 'onSubmit')
  setError(err.code)
  break

// consumed in SignIn/index.tsx:87 as user-facing red text:
// <TextError title={error} textStyle={textStyle} />
```

**What happens.** The switch handles only auth/invalid-email, auth/user-not-found, auth/wrong-password, auth/network-request-failed, auth/too-many-requests. Every other documented code for signInWithEmailAndPassword falls through and is shown raw. A banned account gets the literal red string "auth/user-disabled"; with Firebase email-enumeration protection on (@react-native-firebase/auth ^18.1.0 talks to a backend that returns auth/invalid-credential instead of wrong-password/user-not-found) every ordinary mistyped password shows "auth/invalid-credential" instead of a translated message. All the other branches use i18n strings from src/locales/*/translation.json, so this is the one path that leaks provider internals into the UI, untranslated, in every language.

**Held against refutation.** Confirmed, not refuted. /Users/playra/leela-src/leela/src/screens/Authenticator/SignIn/useSignIn.ts:62-84 attaches .catch() directly to auth().signInWithEmailAndPassword(), so err.code is the raw Firebase code; the switch maps only auth/invalid-email, auth/user-not-found, auth/wrong-password, auth/network-request-failed, auth/too-many-requests to t(...) strings, and line 81 in the default branch does setError(err.code) with no translation. That value is rendered user-facing at src/screens/Authenticator/SignIn/index.tsx:87 as <TextError title={error} textStyle={textStyle} />, and TextError (src/components/TextComponents/TextError/index.tsx:23-32) prints {title} verbatim inside a red <Text> with no mapping or fallback. I tried to refute it three ways and each failed: (1) grep for '"auth/' across all ten bundles in src/locales/*/translation.json returns zero hits, so no downstream i18n resolves a code; (2) grep of src/ for user-disabled / invalid-credential / internal-error finds no handling anywhere; (3) there is no normalization wrapper between Firebase and the switch. package.json:25 pins @react-native-firebase/auth ^18.1.0, making auth/invalid-credential reachable under email-enumeration protection, and auth/user-disabled is unconditionally reachable for a banned account - both surface as literal red strings in every language. Same defect at SignUp/useSignUp.ts:91 and in the duplicate app at /Users/playra/leela-src/leela-game/src/screens/Authenticator/SignIn/useSignIn.ts. Note: the file is not in the session cwd (/Users/playra/BrowserOS/trios, a Swift repo); it lives in the leela React Native repo at the absolute path above.

### The keyboard eats the first tap on the Sign In button: ScrollView has no keyboardShouldPersistTaps

`src/screens/Authenticator/SignIn/index.tsx:67` — sign-in

```
<ScrollView showsVerticalScrollIndicator={false}>
  ...
  <Button
    title={t('auth.signIn')}
    onPress={methods.handleSubmit(onSubmit, onError)}
  />
```

**What happens.** React Native 0.70.4's ScrollView defaults to keyboardShouldPersistTaps="never", which means a tap that dismisses the keyboard is not delivered to the child. The normal flow is: type email, type password (keyboard up, password field focused), tap Sign In. That first tap only closes the keyboard; onPress never fires and nothing happens. The user must tap a second time. The same swallowing hits the "Forgot Password?" ButtonLink at line 89-93, which is the only recovery affordance after a wrong password. `grep -rn keyboardShouldPersistTaps src/` returns zero matches in the whole repo, so nothing else compensates.

**Held against refutation.** Confirmed in the real app (/Users/playra/leela-src/leela — line 67 matches the quoted evidence byte-for-byte; the second checkout /Users/playra/leela-src/leela-game has a shorter file).

1. /Users/playra/leela-src/leela/src/screens/Authenticator/SignIn/index.tsx:67 is a plain `ScrollView` imported from 'react-native' (line 7) with no `keyboardShouldPersistTaps`. Both credential fields (lines 71-84) and the Sign In `Button` (96-99) and the "Forgot" `ButtonLink` (89-93) are its descendants.

2. No wrapper compensates. `KeyboardContainer` (/Users/playra/leela-src/leela/src/components/KeyboardContainer/index.tsx:22) is only a `KeyboardAvoidingView` — no `Keyboard.dismiss` handler, no ScrollView, no prop forwarding of persistTaps. `grep -rn keyboardShouldPersistTaps src` in that repo returns zero matches, as claimed.

3. The touchables are subject to the JS responder system, so the capture applies. `Button` (/Users/playra/leela-src/leela/src/components/Buttons/Button/index.tsx:40) and `ButtonLink` (.../ButtonLink/index.tsx) both render the local `Pressable`, which is a thin wrapper over React Native's own `Pressable` (/Users/playra/leela-src/leela/src/components/Pressable/index.tsx:38 — `RNPressable` from 'react-native'). This was the strongest refutation avenue: a react-native-gesture-handler touchable would bypass `keyboardShouldPersistTaps` entirely. It does not apply here — gesture-handler is in package.json but is not used by these buttons.

4. There is no alternate submit path. `Input` (/Users/playra/leela-src/leela/src/components/Input/index.tsx) is a bare RN `TextInput` with only `onChangeText`/`onBlur`/`ref` wired; no `onSubmitEditing`, no `returnKeyType` submit, so the keyboard's return key cannot submit either — tapping the Button is the only way.

5. The screen is reachable and shipped: registered at /Users/playra/leela-src/leela/src/Navigation.tsx:185 (`<Stack.Screen name="SIGN_IN" component={SignIn} />`) and navigated to from /Users/playra/leela-src/leela/src/screens/Authenticator/Hello/index.tsx:84.

6. The mechanism is confirmed from React Native's own source (`ScrollView.js` `_scrollResponderHandleStartShouldSetResponderCapture`), whose comment states it directly: with `keyboardShouldPersistTaps` unset/'never' and the keyboard up, a touch on a non-TextInput target returns `true` — "the first tap should be sent to the scroll view and dismiss the keyboard, then the second tap goes to the actual interior view." (Read from a locally installed RN 0.76.9 copy at /Users/playra/leela-src/NeuroLeelaExpo/node_modules/react-native/.../ScrollView.js:1504-1536; leela's node_modules is not installed, but 0.70.4 has the same logic keyed on `TextInputState.currentlyFocusedInput() != null`.)

Failure is reachable on the normal path: type email, type password (password field focused, keyboard up), tap Sign In — the first tap only dismisses the keyboard and `methods.handleSubmit` never runs. Same swallowing hits the "Forgot" ButtonLink at lines 89-93, the only recovery affordance after a wrong password. The only escape is the user having manually dismissed the keyboard first, which nothing in the UI prompts.

### Restoring the Keychain session never clears credentials that stopped working, and a failed restore silently drops the user into the game

`src/hooks/useKeychain.ts:33` — sign-in

```
const credentials = await Keychain.getInternetCredentials('auth')
if (credentials && isConnected) {
  ...await auth().signInWithEmailAndPassword(username, password)...
} ...
} catch (err) {
  captureException(err, 'key')
  isConnected !== null && setLoading(false)
  return Promise.reject()
}
...
useFocusEffect(useCallback(() => { setLoading(true); key().catch(checkGame) }, [checkGame, key]))

// checkGame:
//   const init = await AsyncStorage.getItem('@init')
//   if (init === 'true') { navigate('MAIN') }
```

**What happens.** Hello/index.tsx:45 calls this on every focus. If the stored password is no longer valid - changed on another device, account disabled, account deleted - signInWithEmailAndPassword rejects, the catch logs to Sentry, and the rejected promise is handled by `.catch(checkGame)`, which navigates the user to MAIN when '@init' is 'true'. The user is shown the game with no Firebase session and no message that their sign-in failed. Keychain.resetInternetCredentials('auth') is never called here (it exists only in ConfirmSignUp/index.tsx:61 and OnlinePlayer.ts:92), so the dead credentials stay on the device and are retried on every launch and every return to Hello, walking the account toward auth/too-many-requests - which then blocks the manual sign-in as well.

**Held against refutation.** Confirmed by reading the code. src/hooks/useKeychain.ts:34-38 catches the signInWithEmailAndPassword rejection, calls captureException and re-rejects; useFocusEffect at src/hooks/useKeychain.ts:50-55 routes that rejection into checkGame, which does navigate('MAIN') when @init==='true' (src/hooks/useKeychain.ts:41-48). captureException (src/constants.ts:162-174) only console.errors and reports to Sentry - no user-visible message. Nothing guards MAIN: src/Navigation.tsx:202 registers it as a plain Stack.Screen and grep for onAuthStateChanged across src/ returns zero hits, so there is no auth gate to redirect the sessionless user back. The branch is reachable: @init is set to 'true' by actionsDice.init() at src/screens/SelectPlayersScreen/index.tsx:23 (offline play, launched from Hello's own offline button at src/screens/Authenticator/Hello/index.tsx:100) and persists in AsyncStorage until DiceStore.resetPlayer() (src/store/DiceStore.ts:86). Hello is initialRouteName in src/Navigation.tsx:174 and calls useKeychain at src/screens/Authenticator/Hello/index.tsx:45, so the dead credentials are retried on every cold start and every focus. Keychain.resetInternetCredentials('auth') exists only at src/screens/Authenticator/ConfirmSignUp/index.tsx:61 and src/store/OnlinePlayer.ts:92 (explicit SignOut), never on an auth failure. The manual path at src/screens/Authenticator/SignIn/useSignIn.ts:64-77 explicitly handles auth/user-not-found, auth/wrong-password and auth/too-many-requests with user-facing errors, proving those states are real and anticipated - the restore path handles none of them. Additionally DiceStore persists 'online', so a previously-online user can reach MAIN with online===true and no Firebase session, since onSignIn never ran.

### Password reset screen tells an unauthenticated caller whether an email is registered (account enumeration)

`src/screens/Authenticator/Forgot/index.tsx:80` — password reset

```
if (error.code === 'auth/user-not-found') {
        setErrorMessage(t('userNotFound') || '')
      }
```

**What happens.** Anyone who reaches FORGOT types an arbitrary address and taps Confirm. A registered address navigates to FORGOT_PASSWORD_SUBMIT ("Check your e-mail!"); an unregistered one stays on the screen and renders the string `userNotFound` = "This user does not exist" (src/locales/en/translation.json). The two outcomes are visually distinct, so the screen is a free oracle over the whole user base -- feed it a list of emails and it partitions them into customers and non-customers. Firebase's own reset endpoint is designed to be non-committal here; this handler undoes that.

**Held against refutation.** CONFIRMED — I could not refute it. The repo is gHashTag/leela at /Users/playra/leela-src/leela.

1. Quoted line is verbatim. /Users/playra/leela-src/leela/src/screens/Authenticator/Forgot/index.tsx:77-88 calls `await auth().sendPasswordResetEmail(email)` on the raw form value, navigates to FORGOT_PASSWORD_SUBMIT on success (line 78), and in the catch does `if (error.code === 'auth/user-not-found') { setErrorMessage(t('userNotFound') || '') }` (lines 80-81). No pre-check, no generic-message wrapper.

2. The two outcomes are visually distinct and both render. Error path: shown twice, via `AppContainer message={errorMessage}` (Forgot/index.tsx:105) and `<TextError title={errorMessage} />` (Forgot/index.tsx:122-124); the string exists in all 10 locales, en at src/locales/en/translation.json:496 = "This user does not exist". Success path: ForgotPassSubmit/index.tsx:50 renders `t('auth.checkMail')` = "Check your e-mail!" (src/locales/en/translation.json:399).

3. Reachable unauthenticated. HELLO is initialRouteName (src/Navigation.tsx:174) and offers a Sign In button (src/screens/Authenticator/Hello/index.tsx:84). FORGOT is registered at src/Navigation.tsx:186 and entered from src/screens/Authenticator/SignIn/index.tsx:49-51, whose link appears after `auth/wrong-password` (src/screens/Authenticator/SignIn/useSignIn.ts:70-72). That gate is a speed bump, not a guard: one attacker-owned account opens the screen, and the email field is then freely editable — src/components/Input/index.tsx:78-87 is a plain TextInput with `onChangeText={field.onChange}` and no `editable={false}`; `route.params.email` is only a defaultValue (Forgot/index.tsx:67-69). So arbitrary addresses can be probed from that screen indefinitely. FORGOT is not deep-linkable (src/utils/linking/index.ts config exposes only DETAIL_POST_SCREEN and HELLO), but it does not need to be.

4. Not an isolated slip / not rescued by "intended". The identical disclosure already exists one screen earlier at src/screens/Authenticator/SignIn/useSignIn.ts:67-68 (`case 'auth/user-not-found': setError(t('userNotFound'))`).

Only caveat, which does not refute: if Firebase email-enumeration protection were enabled server-side, `auth/user-not-found` would not fire — but neither would `auth/wrong-password`, which useSignIn.ts:70-72 relies on to surface the forgot-password link at all. The app is written against the legacy error codes, so under the configuration it actually targets the oracle is live.

### No throttle of any kind on sending reset emails, though the sign-up confirmation screen has one

`src/screens/Authenticator/Forgot/index.tsx:77` — password reset

```
await auth().sendPasswordResetEmail(email)
      navigation.navigate('FORGOT_PASSWORD_SUBMIT', { email })
```

**What happens.** After a successful send the app pushes FORGOT_PASSWORD_SUBMIT, whose header back button is `onPress={goBack}` (ForgotPassSubmit/index.tsx:46) and returns to FORGOT with the email still populated in the form. Tap Confirm -> back -> Confirm -> back sends an unbounded stream of password-reset emails to any address the attacker types, with no client-side guard. The same repo already implements the guard for the sign-up email on the sibling screen -- ConfirmSignUp/index.tsx:55-56 `setCanResend(false); setTimeout(() => setCanResend(true), 40000)` -- and the reset flow has nothing equivalent, so a victim's inbox can be flooded and the project's Firebase email quota burned.

**Held against refutation.** CONFIRMED — could not refute. Repo is /Users/playra/leela-src/leela (line 77 matches the quoted evidence exactly).

1) /Users/playra/leela-src/leela/src/screens/Authenticator/Forgot/index.tsx:72-90 — onSubmit awaits auth().sendPasswordResetEmail(email) at :77 then navigation.navigate('FORGOT_PASSWORD_SUBMIT', { email }) at :78. The only state is `loading` (set true :73, false :89), which hides the form behind <Loading /> (:108) during the in-flight call, so it blocks concurrent double-taps but imposes zero cooldown between sequential sends.

2) /Users/playra/leela-src/leela/src/screens/Authenticator/ForgotPassSubmit/index.tsx:46 — header back is onPress={goBack}, which resolves to navRef.goBack() at /Users/playra/leela-src/leela/src/constants.ts:186-188.

3) /Users/playra/leela-src/leela/src/Navigation.tsx:186-190 — FORGOT and FORGOT_PASSWORD_SUBMIT are both Stack.Screen in createNativeStackNavigator (:134), so navigate pushes and goBack pops back to a still-mounted FORGOT with the typed email intact; even on a fresh mount defaultValues: { email: route.params.email } (Forgot/index.tsx:68) repopulates it. Confirm -> back -> Confirm loops unbounded.

4) Asymmetry confirmed: /Users/playra/leela-src/leela/src/screens/Authenticator/ConfirmSignUp/index.tsx:52-57 guards with `if (canResend) { ...; setCanResend(false); setTimeout(() => setCanResend(true), 40000) }` plus disabled={!canResend} at :85. The reset flow has no equivalent.

Refutation attempts that all failed: sendPasswordResetEmail appears exactly once in all of src/ (no throttling wrapper); Buttons/Button/index.tsx:27-47 has no disabled prop and no debounce, forwarding onPress straight through; components/Pressable/index.tsx is cosmetic-only (press opacity); the screen is live, reached from SignIn/index.tsx:50; no throttle/debounce/cooldown/rateLimit primitive exists in the flow.

Minor overstatement that does not refute: "any address the attacker types" is too broad — Forgot/index.tsx:80-81 handles auth/user-not-found, so only registered addresses actually receive mail, which is still exactly the stated harm (a victim's inbox flooded). Firebase server-side anti-abuse quotas are a backstop, but the claimed missing client-side guard is genuinely absent.

### `auth/too-many-requests` is unhandled on the reset screen, so the raw Firebase error code is rendered as user-facing text

`src/screens/Authenticator/Forgot/index.tsx:85` — password reset

```
} else {
        setErrorMessage(error.code)
      }
```

**What happens.** Once the unthrottled sends above trip Firebase's server-side quota, the rejection carries `code === 'auth/too-many-requests'`, which falls through both `if` branches into this `else`. `errorMessage` is then rendered verbatim by `<TextError title={errorMessage} />` (line 123), so the user sees the literal ASCII string "auth/too-many-requests" in red -- untranslated, in every one of the app's ~14 locales. Both sibling auth hooks handle exactly this code with a translated message (useSignIn.ts:76-78 and useSignUp.ts:86-88 -> `t('manyRequests')` = "Too many authentication requests, please try again later"); only the reset path was left out.

**Held against refutation.** Confirmed in /Users/playra/leela-src/leela/src/screens/Authenticator/Forgot/index.tsx. The catch block at lines 79-88 handles only 'auth/user-not-found' and 'auth/network-request-failed'; line 85 is a catch-all `else { setErrorMessage(error.code) }`. That state is rendered verbatim at lines 122-124 via `<TextError title={errorMessage} />`, and /Users/playra/leela-src/leela/src/components/TextComponents/TextError/index.tsx:23-31 prints `{title}` directly in a red `<Text>` with no translation or code mapping. The screen is reachable: registered at src/Navigation.tsx:186 and navigated to from src/screens/Authenticator/SignIn/index.tsx:50. The asymmetry is real -- src/screens/Authenticator/SignIn/useSignIn.ts:76-77 and src/screens/Authenticator/SignUp/useSignUp.ts:86-87 both do `case 'auth/too-many-requests': setError(t('manyRequests'))`, and the key exists at src/locales/en/translation.json:499. Two factual corrections that do not save the code: there are 10 locale folders (ar bn en fr mr ms ru te tr uk), not ~14, and bn lacks `manyRequests` altogether; and because line 85 is a catch-all, other codes (auth/internal-error, auth/quota-exceeded, server-side auth/invalid-email) also render as raw ASCII, so the defect is broader than claimed.

### UserEdit closes the screen as if the save succeeded even when the profile write failed

`src/screens/Authenticator/UserEdit/index.tsx:83` — password reset

```
await updateProfName({ firstName, lastName })
    navigation.goBack()
    setLoading(false)
```

**What happens.** `updateProfName` (src/screens/helper.ts:166-181) wraps its whole body in `try { ... } catch (err) { captureException(err, 'updateProfName') }` and returns void, so it never rejects and never reports outcome. UserEdit has no try/catch, no error state and no return-value check: it calls `navigation.goBack()` unconditionally. When `firestore().collection('Profiles').doc(getUid()).update(...)` (helper.ts:171) rejects -- permission-denied, or the Profiles document not existing, both of which reject rather than queue -- the catch swallows it, the two store writes at helper.ts:176-177 are skipped, and the edit screen dismisses with no error. The user watches the screen close, then sees the old first/last name still on their profile. (The same shape is a latent hang: if the helper ever propagated, `setLoading(false)` on line 86 would be unreachable and the screen would sit on `<Loading />` forever.)

**Held against refutation.** Confirmed in the Leela RN app (not trios): /Users/playra/leela-src/leela/src/screens/Authenticator/UserEdit/index.tsx:80-86 is the entire submit handler — setLoading(true); await updateProfName(...); navigation.goBack(); setLoading(false) — with no try/catch, no error state and no result check (the second handleSubmit arg at index.tsx:127 catches only yup validation errors). /Users/playra/leela-src/leela/src/screens/helper.ts:166-181 wraps its whole body in try/catch, swallows via captureException and returns void, so failure is invisible to the caller and the store writes at helper.ts:176-177 are skipped. /Users/playra/leela-src/leela/src/constants.ts:162-174 shows captureException only console.errors and reports to Sentry — no user-facing UI (contrast accountHasBanAlert at constants.ts:156 which does Alert.alert). Reachable on plain network loss: the first await, auth().currentUser?.updateProfile() at helper.ts:168, rejects offline, so the Firestore update at helper.ts:171 never runs and the screen still closes; ProfileScreen then re-renders the unchanged OnlinePlayer.store.profile (ProfileScreen/index.tsx:70). File is committed and unmodified at HEAD 780a8ae.

### Raw Firebase error code rendered verbatim on the sign-up screen

`src/screens/Authenticator/SignUp/useSignUp.ts:91` — what the user is told

```
default:
  captureException(exception.message, 'useSignUp')
  setError(exception.code)
  break
```

**What happens.** Same defect as SignIn. Registering with a password Firebase rejects (auth/weak-password) or on a project where email sign-up is off (auth/operation-not-allowed) shows the person "auth/weak-password" in red at SignUp/index.tsx:81 `<TextError title={error} textStyle={styles.centerText} />`. There is also a non-Firebase path into this branch: SignUp/sendpulse.ts:36 calls `getToken()` outside its own try block, so an axios failure propagates into this catch and prints an axios code such as "ERR_NETWORK" — or, if `.code` is undefined, prints nothing at all while the Firebase account has already been created and the user is never taken to CONFIRM_SIGN_UP.

**Held against refutation.** Confirmed at /Users/playra/leela-src/leela/src/screens/Authenticator/SignUp/useSignUp.ts:89-92 — the `default:` branch does `setError(exception.code)`, and SignUp/index.tsx:80-82 renders it verbatim via `{error !== '' && <TextError title={error} .../>}` with no code-to-message mapping in between. Refutation attempts failed: (a) grep over src for "weak-password|operation-not-allowed|internal-error" and for equivalent i18n keys returns zero hits, so `auth/operation-not-allowed` and `auth/internal-error` reach line 91 raw (the yup `min(6)` at useSignUp.ts:40 does make plain `auth/weak-password` hard to hit under Firebase's default policy, the one weak part of the claim); (b) the non-Firebase path is real — `.catch()` at line 72 is chained onto `.then()` (lines 66-71), so the rejection from `await postEmailToSendPulse(email)` at line 68 is caught there, and sendpulse.ts:36 `const token = await getToken()` sits above the `try` that opens at line 38, so an axios failure escapes and prints its code (e.g. "ERR_NETWORK"), or prints nothing when `.code` is undefined because `error || ''` at line 100 collapses it to '' and the render is gated on `error !== ''`. In that path the account is already created and Keychain credentials written (line 67) but navigate('CONFIRM_SIGN_UP') at line 69 never runs, stranding the user.

### Raw Firebase error code rendered verbatim on the forgot-password screen

`src/screens/Authenticator/Forgot/index.tsx:85` — what the user is told

```
if (error.code === 'auth/user-not-found') {
  setErrorMessage(t('userNotFound') || '')
} else if (error.code === 'auth/network-request-failed') {
  setErrorMessage(t('networkRequestFailed') || '')
} else {
  setErrorMessage(error.code)
}
```

**What happens.** Only two codes are translated. Anything else — auth/invalid-email, auth/too-many-requests, auth/internal-error — is displayed as the raw code at line 123 `<TextError title={errorMessage} textStyle={styles.errorText} />`. A user who has requested too many reset mails sees "auth/too-many-requests" rather than the already-translated t('manyRequests') string that the sign-in screen uses for the same condition.

**Held against refutation.** The quoted code matches exactly at /Users/playra/leela-src/leela/src/screens/Authenticator/Forgot/index.tsx:79-88 (the `catch (error: any)` block): only `auth/user-not-found` (line 81) and `auth/network-request-failed` (line 83) are translated; line 85 is `setErrorMessage(error.code)`, and that state is rendered verbatim at line 123 `<TextError title={errorMessage} textStyle={styles.errorText} />`. No downstream guard exists: /Users/playra/leela-src/leela/src/components/TextComponents/TextError/index.tsx renders `{title}` directly inside a `<Text>` with no translation or code-to-message mapping, so whatever string arrives is what the user sees. The failure is reachable and the translated string already exists: `manyRequests` is present in every locale file (e.g. /Users/playra/leela-src/leela/src/locales/en/translation.json:499 "Too many authentication requests, please try again later") and the sign-in screen handles the very same Firebase condition at /Users/playra/leela-src/leela/src/screens/Authenticator/SignIn/useSignIn.ts:76-77 (`case 'auth/too-many-requests': setError(t('manyRequests'))`). Firebase throttles `sendPasswordResetEmail`, so `auth/too-many-requests` hits the Forgot screen's else branch and the user sees the raw code. Client-side yup email validation at lines 54-59 only shields `auth/invalid-email`; it does nothing for `auth/too-many-requests` or `auth/internal-error`. The sibling copy /Users/playra/leela-src/leela-game/src/screens/Authenticator/Forgot/index.tsx:77-85 has the identical else branch (with `validation:`-namespaced keys). One nuance that softens but does not refute the claim: useSignIn.ts:81-83 also falls back to `setError(err.code)` in its `default` case, so raw-code display is the repo's fallback pattern for genuinely unmapped codes — but `auth/too-many-requests` is not unmapped, it is mapped everywhere except here.

### Email-verification screen spins forever and never reports that the verification mail failed to send

`src/screens/Authenticator/ConfirmSignUp/index.tsx:81` — what the user is told

```
useEffect(() => {
  auth().currentUser?.sendEmailVerification()
  const verifyCheck = setInterval(() => { ... }, 2200)
...
<Loading size={s(100)} type="9CubeGrid" />
```

**What happens.** `sendEmailVerification()` on line 37 has no `.catch` and no `.then`. Firebase rate-limits verification mail with auth/too-many-requests, and the mail also fails on a bad SMTP/template config. When it rejects, the rejection is unhandled and the UI is unchanged: the screen still says t('auth.checkMail') ("Check your e-mail!") on line 79 and runs the 9CubeGrid spinner on line 81 indefinitely. The spinner has no timeout, no failure state, and no text; the 2200ms interval polls emailVerified forever. A user whose mail was never sent waits on an animation that is telling them, falsely, that a message is on its way.

**Held against refutation.** Could not refute. /Users/playra/leela-src/leela/src/screens/Authenticator/ConfirmSignUp/index.tsx:37 calls `auth().currentUser?.sendEmailVerification()` fire-and-forget inside a non-async useEffect — no await/then/catch — and a grep of src/ and index.js for `unhandledrejection`/`setUnhandledPromiseRejectionTracker`/`ErrorUtils`/`PromiseRejection` returns zero hits, so nothing catches it globally. The component declares only `isVerify` (index.tsx:32) and `canResend` (index.tsx:33); there is no error state and no code path in the file that can render a failure message. index.tsx:79-81 renders `t('auth.checkMail')` and `<Loading size={s(100)} type="9CubeGrid" />` unconditionally, and /Users/playra/leela-src/leela/src/components/Loading/index.tsx:44 is a bare react-native-spinkit Spinner with `isVisible={true}` hardcoded, no timeout — so the spinner is genuinely indefinite. The interval at index.tsx:38-48 has no attempt cap and is cleared only on success or unmount. Reachability is proven twice: src/screens/Authenticator/SignUp/useSignUp.ts:69 navigates here after signup, and src/screens/helper.ts:382 navigates here on every sign-in by an unverified user, so re-entry re-fires the send and provokes auth/too-many-requests. The same repo already handles that code elsewhere — useSignUp.ts has `case 'auth/too-many-requests': setError(t('manyRequests'))` — so the string exists and this screen just never uses it. The only mitigation, the Resend button (index.tsx:84), makes the identical uncaught call at index.tsx:54 and then disables itself for 40s at index.tsx:56, reporting nothing.

### Resend button refuses for 40 seconds and says nothing

`src/screens/Authenticator/ConfirmSignUp/index.tsx:52` — what the user is told

```
const _onResend = async (): Promise<void> => {
  if (canResend) {
    auth().currentUser?.sendEmailVerification()
    setCanResend(false)
    setTimeout(() => setCanResend(true), 40000)
  }
}
```

**What happens.** After the first tap the control is dead for 40 seconds (`disabled={!canResend}`, line 86). The only feedback is `opacity: 0.5` (styles.btnDisabled, line 104-106); the label still reads t('auth.resendCode') ("Resend message?") with no countdown and no explanation. Successful sends are equally silent — the second `sendEmailVerification()` on line 54 has no `.then` and no `.catch`, so a user who taps Resend gets no confirmation that anything happened and no error if it failed. They tap, nothing visible changes, and they tap again into a disabled control.

**Held against refutation.** Confirmed by reading /Users/playra/leela-src/leela/src/screens/Authenticator/ConfirmSignUp/index.tsx (the claim's path resolves here; /private/tmp/leela-build holds an identical copy). I tried to refute it on four fronts and each attempt failed.

1. The quoted code is exact. Lines 52-58: `const _onResend = async (): Promise<void> => { if (canResend) { auth().currentUser?.sendEmailVerification(); setCanResend(false); setTimeout(() => setCanResend(true), 40000) } }`. The promise from `sendEmailVerification()` is discarded — no `await`, no `.then`, no `.catch` — so a rejection (notably Firebase `auth/too-many-requests`) becomes an unhandled rejection with zero user-visible effect in release builds. Success is equally silent.

2. The disabled window is real and the only feedback is opacity. index.tsx:85 `disabled={!canResend}` and :87 `style={[styles.btn, !canResend && styles.btnDisabled]}`, with `btnDisabled: { opacity: 0.5 }` at :104-106. The label is static: :91 `title={t('auth.resendCode')}`, which resolves to "Resend message?" (src/locales/en/translation.json:396) — no countdown, no state text, no explanation. The claim's only inaccuracy is an off-by-one: `disabled` is line 85, not 86.

3. No feedback is injected by the shared component. src/components/Pressable/index.tsx only adds a transient `opacity: 0.2` press style (:22) and forwards props; it has no toast, haptic, or disabled messaging.

4. The screen is live and reachable in the shipped flow. src/Navigation.tsx:194 registers `<Stack.Screen name="CONFIRM_SIGN_UP" component={ConfirmSignUp} />` inside the active auth Stack.Group, and src/screens/Authenticator/SignUp/useSignUp.ts:69 navigates there right after `createUserWithEmailAndPassword` succeeds. The Resend Pressable renders unconditionally (index.tsx:84-94).

The only on-screen motion is the unrelated `Loading` spinner at :81, which runs continuously for the emailVerified poll (:36-50) and does not change on tap. So a user who taps Resend sees the label dim and nothing else for 40 seconds, gets no confirmation on success and no error on failure — exactly as claimed. The 40s cooldown itself is plausibly intended (it guards Firebase rate limits), but its unexplained, unlabelled presentation is the defect and it is plainly reachable.

### Wrong password is never stated; the user is shown only a "Forgot Password?" link

`src/screens/Authenticator/SignIn/useSignIn.ts:71` — what the user is told

```
case 'auth/wrong-password':
  setError(t('auth.forgotPassword'))
  break
```

**What happens.** The error state is overloaded to carry a UI label, and SignIn/index.tsx:86 branches on it by string comparison: `error !== t('auth.forgotPassword') ? <TextError .../> : <ButtonLink title={error} onPress={handleForgot} .../>`. A user who mistypes their password is told "Forgot Password?" (en) / "Забыли пароль?" (ru) and never that the password was incorrect — the message answers a question they did not ask and does not name the failure. The same string is set for auth/wrong-password in SignUp/useSignUp.ts:81, where SignUp/index.tsx:81 renders it as plain red text with no link handler, so it becomes a dead-end sentence with nothing to tap.

**Held against refutation.** Confirmed, and I could not refute it. The file is /Users/playra/leela-src/leela/src/screens/Authenticator/SignIn/useSignIn.ts:70-72 — `case 'auth/wrong-password': setError(t('auth.forgotPassword'))` — exactly as quoted. (1) The key resolves: src/locales/en/translation.json has a nested `auth` object with `forgotPassword: "Forgot Password?"` (ru "Забыли пароль?"), so the user is shown that label verbatim, not a raw key. A full walk of the en translations found NO string anywhere combining "password" with wrong/incorrect/invalid — the app has no copy that names the failure. (2) The overloaded-state branch is real and taken: /Users/playra/leela-src/leela/src/screens/Authenticator/SignIn/index.tsx:86 does `error !== t('auth.forgotPassword') ? <TextError title={error}/> : <ButtonLink title={error} onPress={handleForgot}/>` using the same i18n instance, so equality holds and lines 89-93 render only the link, with `title={error}` and nothing prepended. (3) Reachable: src/Navigation.tsx:185 registers `<Stack.Screen name="SIGN_IN" component={SignIn}/>` and Hello/index.tsx:84 navigates to it. (4) The error code is emitted: @react-native-firebase/auth ^18.1.0 (package.json:25), and the same switch handles `auth/user-not-found` (useSignIn.ts:67), a code that only appears when email-enumeration protection is off — the same config under which `auth/wrong-password` is standard; with protection on it falls to `default: setError(err.code)` (line 81), showing a raw code, which is no better. (5) SignUp half confirmed: SignUp/useSignUp.ts:81 sets the identical string, and SignUp/index.tsx:80-82 renders `{error !== '' && <TextError title={error}/>}` — plain text, no press handler, a dead-end sentence. Additional finding: the sibling copy /Users/playra/leela-src/leela-game/src/screens/Authenticator/SignIn/useSignIn.ts has the same case with the same string.

### Name fields fall back to yup's built-in English "is a required field" message in all ten locales

`src/screens/Authenticator/SignUpUsername/index.tsx:68` — what the user is told

```
firstName: yup
  .string()
  .trim()
  .min(2, t('twoSymbolRequire') || '')
  .required()
  .max(15, `${t('manyCharacters')}15`),
```

**What happens.** Every other validator in the repo passes a t() string — `.min(2, t('twoSymbolRequire'))`, `.max(15, ...)`, and in SignIn/useSignIn.ts:34 `.required(t('requireField'))`. Here `.required()` (also line 74, and UserEdit/index.tsx:62 and :68) takes no message, and no `yup.setLocale` call exists anywhere in src, so yup emits its default English message. `useForm` on line 81-84 declares no defaultValues, so both fields start undefined; min/max skip undefined and required is what fires on first submit. Input/index.tsx:94 prints `formState.errors[name].message` verbatim, so a Russian, Arabic, Bengali or Telugu user submitting an empty form is answered in English.

**Held against refutation.** Confirmed. /Users/playra/leela-src/leela/src/screens/Authenticator/SignUpUsername/index.tsx:68 and :74 call `.required()` with no message, unlike the sibling `.min(2, t('twoSymbolRequire'))` on :67/:73 and `.required(t('requireField') || '')` in src/screens/Authenticator/SignIn/useSignIn.ts:34,37. package.json:88 pins yup ^0.32.11, whose `locale.mixed.required` default is the English "${path} is a required field"; `grep -rn setLocale` over the repo (excluding node_modules) returns nothing, so no override exists. index.tsx:81-84 declares `useForm({mode:'onChange', resolver: yupResolver(schema)})` with no `defaultValues`, and the two `Input`s at :130 and :136 pass no `defaultValue` to `useController({name, rules, defaultValue})` (src/components/Input/index.tsx:43), so both fields hold `undefined` until typed. yup's min/max/trim tests skip absent values, so on a first submit `required` is the only failing test and its untranslated message is what surfaces. src/components/Input/index.tsx:94 renders `formState.errors[name].message` verbatim. The screen is reachable for every new signup: registered at src/Navigation.tsx:192 and navigated to from src/screens/Authenticator/ConfirmSignUp/index.tsx:45 and src/screens/helper.ts:359, with the submit Button at index.tsx:145 wired straight to `methods.handleSubmit` and no invalid-state guard. src/locales holds exactly ten locales (ar, bn, en, fr, mr, ms, ru, te, tr, uk), each with a translated `requireField` (e.g. ru/translation.json:504) that this screen never uses. Same omission at src/screens/Authenticator/UserEdit/index.tsx:62,68, though that form does set defaultValues.

### Every auth string on these screens renders as its raw key for Bengali users

`src/i18n.ts:89` — what the user is told

```
lng: isSupportedLang ? lang : ruOrEnLang,
debug: __DEV__,
```

**What happens.** 'bn' is listed in supportedLngs (i18n.ts:72-83) and wired into resources, but src/locales/bn/translation.json has no `auth` object at all and none of shortPassword, twoSymbolRequire, manyCharacters, requireField, invalidEmail, userNotFound, networkRequestFailed, manyRequests, passwordsDoNotMatch, userNameExistsException, done or clearly. No `fallbackLng` is configured in the init object, so i18next returns the key itself. On a Bengali device the password field's placeholder reads "auth.password" (SignIn/index.tsx:80), the sign-in button reads "auth.signIn" (line 97), a bad address reads "invalidEmail", and the wrong-password link reads "auth.forgotPassword" — while SignIn/index.tsx:86 still compares error against that same key string, so the branch silently keeps working and hides the breakage from tests.

**Held against refutation.** Could not refute; every link in the chain is present in code. (Files live in /Users/playra/leela-src/leela, the checkout the claimed paths resolve to.) 1) src/i18n.ts:85-98 — the init object has resources/lng/debug/interpolation/react and NO fallbackLng; `grep -rn "fallbackLng" src/` is empty repo-wide. i18next is 22.0.4 (package.json:37), whose default fallbackLng is 'dev', and resources (i18n.ts:30-61) has no 'dev' entry, so a miss returns the key string. keySeparator is left at default '.' (line 97 commented out), so t('auth.password') is a nested lookup that misses entirely. 2) 'bn' is genuinely selected: imported at i18n.ts:7, wired into resources at 34-36, listed in supportedLngs at 71, so isSupportedLang is true on a Bengali device and line 89 yields lng:'bn'. The exported supportedLngs is never passed to i18next as its own option, so nothing narrows it later; the only changeLanguage calls are per-post at src/components/Cards/PostCard/index.tsx:68,70 — no startup override to en. 3) src/locales/bn/translation.json has 81 top-level keys (plan_1..plan_72 plus subscription keys) and no `auth` object; en/ru/ar/mr/ms/te/tr/uk/fr each have auth with 10 keys. All twelve named flat keys (shortPassword, twoSymbolRequire, manyCharacters, requireField, invalidEmail, userNotFound, networkRequestFailed, manyRequests, passwordsDoNotMatch, userNameExistsException, done, clearly) exist in en and are absent from bn (en 140 keys vs bn 81). 4) Reachable, not dead code: src/Navigation.tsx:185 registers <Stack.Screen name="SIGN_IN" component={SignIn} />, navigated from src/screens/Authenticator/Hello/index.tsx:84; SignIn/index.tsx:80 renders t('auth.password') as placeholder and :97 t('auth.signIn'); useSignIn.ts:65,68,71,74,77 set errors from t('invalidEmail'), t('userNotFound'), t('auth.forgotPassword'), t('networkRequestFailed'), t('manyRequests'). 5) The masking detail is real: SignIn/index.tsx:86 compares error !== t('auth.forgotPassword') while useSignIn.ts:71 sets that same expression, so under bn both sides collapse to the identical literal "auth.forgotPassword" and the branch keeps working while the UI shows the raw key.

### Name change reports success when the save failed

`src/screens/Authenticator/UserEdit/index.tsx:83` — what the user is told

```
await updateProfName({ firstName, lastName })
navigation.goBack()
setLoading(false)
```

**What happens.** `updateProfName` (src/screens/helper.ts:166-181) wraps its Firestore update in try/catch and only calls `captureException(err, 'updateProfName')` — it resolves normally on failure. UserEdit therefore always closes the screen on line 84 regardless of outcome. A user offline or lacking permission edits their name, taps Done, watches the screen dismiss like a success, and returns to a profile that still shows the old name with no error ever displayed.

**Held against refutation.** Confirmed. /Users/playra/leela-src/leela/src/screens/Authenticator/UserEdit/index.tsx:83-84 does `await updateProfName({firstName,lastName})` then `navigation.goBack()` unconditionally — no catch, no returned status, no error state in the component. /Users/playra/leela-src/leela/src/screens/helper.ts:166-181 wraps the Auth `updateProfile`, the Firestore `Profiles` doc `update`, `reload()`, and the `OnlinePlayer.store.profile` assignments in one try/catch whose catch only calls `captureException(err,'updateProfName')` and returns undefined. /Users/playra/leela-src/leela/src/constants.ts:162-174 shows captureException is console.error + Sentry only — nothing user-visible. The component's other error handler (line 127-129) is the yup validation branch and never fires on a valid form. Reachable: the first await is a Firebase Auth call with no offline queue, so offline or a permission-denied Firestore update rejects, is swallowed, the store name assignments at helper.ts:176-177 never run, and the screen pops looking like a success with the old name intact. The sibling copy /Users/playra/leela-src/leela-game/src/screens/Authenticator/UserEdit/index.tsx has the same onSubmit body.

### Every sign-up silently posts the user's email address to SendPulse's marketing address book with no opt-in and no opt-out

`src/screens/Authenticator/SignUp/useSignUp.ts:68` — data and third parties

```
await Keychain.setInternetCredentials('auth', email, password)
            await postEmailToSendPulse(email)
            navigate('CONFIRM_SIGN_UP', { email })
```

**What happens.** postEmailToSendPulse pushes the address into a language-keyed marketing list (`const addressBookId = lang === 'ru' ? Leela_AI_RU : Leela_AI_EN`, sendpulse.ts:33) unconditionally. SignUp/index.tsx renders three Inputs and one Button — there is no consent checkbox, no mailing-list wording, and no link to the privacy policy on the screen; the only Privacy Policy / EULA controls are plain tappable Text on the earlier Hello screen (Hello/index.tsx:64,70). A user who signs up to play the game is enrolled in a third-party email marketing list without being told, and the app offers no way to decline or to be removed.

**Held against refutation.** Confirmed, not refutable. /Users/playra/leela-src/leela/src/screens/Authenticator/SignUp/useSignUp.ts:68 calls `await postEmailToSendPulse(email)` unconditionally inside the Firebase `.then()` (lines 64-71) on every successful createUserWithEmailAndPassword — no flag, no consent check. sendpulse.ts:33 picks `addressBookId = lang === 'ru' ? Leela_AI_RU : Leela_AI_EN` and sendpulse.ts:39-48 POSTs `{emails:[email]}` to https://api.sendpulse.com/addressbooks/{id}/emails; both env keys are declared at src/types/env.d.ts:16-19, so this is live code. The call is silent: the only error handling is `captureException` at sendpulse.ts:50. SignUp/index.tsx:58-87 renders exactly three Inputs and one Button — no checkbox, no mailing-list wording, no policy link. The path is reachable: Navigation.tsx:174 sets initialRouteName="HELLO", Hello/index.tsx:89-92 navigates to 'SIGN_UP', and Navigation.tsx:191 registers that screen in an unconditional Stack.Group. The only policy controls are plain tappable Text on the prior screen (Hello/index.tsx:63-73 -> constants.ts:219-223). No opt-out exists: grepping src/ for unsubscribe|deleteAccount|removeEmail returns only RxJS/Firebase/Branch listener teardown, and src/locales/en/translation.json has no privacy/consent/newsletter/mailing keys. Refutation attempt failed: the sibling /Users/playra/leela-src/leela-game copy has no SendPulse call, but it is a different variant (app.updateSignCredentials, EMAIL_VERIFY_SIGN_UP, `validation:` i18n namespace), not the cited file. Bonus adjacent bug: getToken() at sendpulse.ts:36 is outside the try, so a SendPulse auth failure rejects into useSignUp.ts:72's .catch and blocks navigation after the Firebase account was already created.

### OpenAI API key is inlined into the app bundle and sent as a Bearer token straight from the device

`src/constants.ts:57` — data and third parties

```
headers: {
          Authorization: `Bearer ${OPEN_AI_KEY}`,
          'Content-Type': 'application/json'
        }
```

**What happens.** `import { LEELA_ID, OPEN_AI_KEY } from '@env'` (constants.ts:1) is compiled to a literal by module:react-native-dotenv, so the production key ships in the bundle and is extractable from the store build. The same pattern repeats at src/screens/Tabs/ChatScreen/index.tsx:116. Anyone who pulls the key bills arbitrary GPT-4 usage to the project's OpenAI account until it is noticed and rotated — and rotating requires a new app release, because there is no server in front of it.

**Held against refutation.** Confirmed, not refutable. /Users/playra/leela-src/leela/src/constants.ts:1 imports OPEN_AI_KEY from '@env', and constants.ts:34-60 POSTs directly to https://api.openai.com/v1/chat/completions with `Authorization: Bearer ${OPEN_AI_KEY}` at constants.ts:57; the identical header repeats at src/screens/Tabs/ChatScreen/index.tsx:116 against the same URL (index.tsx:107). '@env' is compile-time, not runtime: .babelrc declares `"plugins": [["module:react-native-dotenv"]]`, package.json:55 pins react-native-dotenv ^3.4.9, src/types/env.d.ts is only an ambient `declare module '@env'`, and __mocks__/@env.js is a Jest stub — so the key is substituted as a string literal into the shipped JS bundle. Reachability holds on both paths with no guard: src/Navigation.tsx:118-129 mounts ChatScreen as tab TAB_BOTTOM_5 whenever DiceStore.online (both branches of the RU_STORE/isBlockGame ternary are ChatScreen), and generateComment/handleCommentAi are called from src/store/PostStore.ts:113, src/components/CreatePost/index.tsx:73 and src/components/Cards/PostCard/index.tsx:72. A repo-wide grep for "openai" returns only those two direct api.openai.com calls — there is no proxy or server to rotate behind, and it is a shipped app (constants.ts:75-79: AppleAppID 1296604457, com.leelagame; package.json version 6.5.1, build script `gradlew bundleRelease`). Only gap: the .env is gitignored (.gitignore `*.env`) and absent from this checkout, so the literal value itself is unreadable here — but the code interpolates whatever key was compiled in, unconditionally.

### Unguarded .slice on the native locale can silently break sign-up with no error shown at all

`src/screens/Authenticator/SignUp/sendpulse.ts:15` — data and third parties

```
} else if (Platform.OS === 'ios') {
    languageCode = NativeModules.SettingsManager.settings.AppleLocale
  }

  return languageCode.slice(0, 2).toLowerCase()
```

**What happens.** AppleLocale is absent from SettingsManager.settings on a range of iOS versions/region settings, and there is no fallback (AppleLanguages[0]) and no guard. languageCode becomes undefined and `.slice` throws a TypeError inside postEmailToSendPulse — which, like the getToken case, propagates to the .catch at useSignUp.ts:72. A TypeError has no `.code`, so `setError(exception.code)` stores undefined, `error || ''` at useSignUp.ts:100 collapses it to '', and SignUp/index.tsx:80 (`error !== ''`) renders nothing. The user's Firebase account is created, the spinner stops, no message appears, and tapping Sign Up again just does nothing visible. Registration breaks in total silence on the affected devices.

**Held against refutation.** Confirmed by reading the whole path; I could not refute it.

1. The line is exactly as quoted and is completely unguarded. /Users/playra/leela-src/leela/src/screens/Authenticator/SignUp/sendpulse.ts:6-16 seeds `languageCode = 'en'` but then unconditionally *overwrites* it with a raw native-constant lookup — `NativeModules.SettingsManager.settings.AppleLocale` (line 12) — so the 'en' default is dead on iOS. There is no `|| settings.AppleLanguages[0]` fallback (the canonical RN iOS-13 workaround), no `typeof` check, no try/catch. If `AppleLocale` is absent from `SettingsManager.settings`, line 15 runs `undefined.slice(0, 2)` and throws a TypeError. RN is 0.70.4 and an iOS target ships (`ios/leela.xcworkspace`), so the branch is live code.

2. The throw is not contained. `getSystemLanguage()` is called at sendpulse.ts:31, *above* the `try` block that starts at line 38, so the local `catch`/`captureException` at lines 49-51 does not cover it. `postEmailToSendPulse` has exactly one caller: /Users/playra/leela-src/leela/src/screens/Authenticator/SignUp/useSignUp.ts:68, `await postEmailToSendPulse(email)` inside the async `.then` callback — so the rejection propagates to `.catch` at line 72.

3. The silence is verifiable line by line, not speculative. useSignUp.ts:73 switches on `exception.code`; a TypeError has none, so the `default` arm runs `captureException(exception.message, 'useSignUp')` and `setError(exception.code)` = `setError(undefined)` (line 91). `captureException` (/Users/playra/leela-src/leela/src/constants.ts:162-174) only does `console.error` + Sentry — zero UI. useSignUp.ts:100 returns `error: error || ''`, collapsing `undefined` to `''`, and /Users/playra/leela-src/leela/src/screens/Authenticator/SignUp/index.tsx:80 renders `TextError` only when `error !== ''`. Nothing is shown.

4. The user-visible outcome matches the claim: `createUserWithEmailAndPassword` already resolved, so the Firebase account exists; the throw at line 68 pre-empts `navigate('CONFIRM_SIGN_UP')` at line 69, and `setLoading(false)` at line 94 stops the spinner. The user lands back on a blank sign-up form with an orphaned account and no message.

The repo even proves the safe alternative was available: /Users/playra/leela-src/leela/src/i18n.ts:17-26 derives the language via `RNLocalize.getLocales()` with explicit array/undefined guards and exports `lang`. sendpulse.ts bypasses that guarded source and re-derives the locale by hand, unguarded.

One inaccuracy in the claim, which does not change the verdict: a *second* Sign Up tap is not silent — Firebase rejects with `auth/email-already-in-use`, which useSignUp.ts:77-78 does render. Only the first attempt fails invisibly.


## Minor (9)

### Backing out of email confirmation leaves an orphan unverified Firebase account and clears the keychain credential that would have recovered it

`src/screens/Authenticator/ConfirmSignUp/index.tsx:60` — sign-up

```
const onExit = async () => {
    await Keychain.resetInternetCredentials('auth')
    await auth().signOut()
    navigation.goBack()
  }
```

**What happens.** Pressing the back arrow signs out and wipes the saved credential, but never deletes the auth user that SignUp just created - and no profile was ever written. Back on the SignUp screen the same email now fails with `auth/email-already-in-use` -> t('userNameExistsException'), so the user cannot re-register, and the auto-login path in src/hooks/useKeychain.ts:22 can no longer restore them because the keychain entry is gone. Their only route back into the half-created account is remembering the password and using SIGN_IN. Unlike OnlinePlayer.SignOut (src/store/OnlinePlayer.ts:73), this path also leaves the MobX store untouched.

**Held against refutation.** Confirmed, not refutable. Chain of custody: /Users/playra/leela-src/leela/src/screens/Authenticator/SignUp/useSignUp.ts:64-69 creates the Firebase user, saves the keychain credential, and navigates to CONFIRM_SIGN_UP without writing any Firestore profile (createProfile only runs later at SIGN_UP_USERNAME). /Users/playra/leela-src/leela/src/screens/Authenticator/ConfirmSignUp/index.tsx:60-64 onExit does `resetInternetCredentials('auth')` + `signOut()` + `goBack()` and never deletes the auth user. It IS reachable: index.tsx:70-76 passes iconLeft='back' onPress={onExit} with title=" " (truthy, header renders), and src/components/Header/index.tsx:59-63 renders that icon as `<Pressable onPress={onPress}>` - one back-arrow tap. No cleanup exists elsewhere: the only user.delete() is src/store/OnlinePlayer.ts:222 in deleteUser(), reachable only from post-verification profile screens, and the repo has no functions/ dir or server-side unverified-user sweep. Re-registration is blocked: useSignUp.ts:77-78 maps auth/email-already-in-use to t('userNameExistsException') = "An account with the given email already exists" (src/locales/en/translation.json:498), a dead end. Auto-login cannot recover: src/hooks/useKeychain.ts:22 reads the exact 'auth' entry line 61 erased, so it rejects into checkGame. The only route back is SIGN_IN with a remembered password, since src/screens/helper.ts:381-385 routes any unverified user straight back to CONFIRM_SIGN_UP. And unlike OnlinePlayer.SignOut (src/store/OnlinePlayer.ts:73-95, which clears presence, push token, MobX store, and dice state), onExit skips all store teardown. Note: the file is at /Users/playra/leela-src/leela/src/..., not under the trios cwd.

### captureException is handed err.message instead of the error, and drops falsy values entirely

`src/constants.ts:163` — sign-in

```
export const captureException = (error: any, target: string) => {
  if (!error) {
    console.log('%c captureException called with messing or incorrect arguments', ...)
    return
  }
  console.error(`On:${target}/ My Error: ${error} `)
  if (!__DEV__) {
    Sentry.captureException(error)
  }
}
```

**What happens.** useSignIn.ts:80 calls `captureException(err.message, 'onSubmit')` - the only sign-in call site that passes a string rather than the error object (useKeychain.ts:34, helper.ts:58 and helper.ts:387 all pass the object). Two consequences: an error whose `message` is empty or undefined hits the `if (!error)` guard and is discarded, so the unmapped-code branch reports nothing at all; and when message is present, Sentry.captureException receives a bare string, so the report arrives with a synthetic stack and without `err.code` - the one field that would identify which unhandled Firebase code the user hit.

**Held against refutation.** Both halves of the claim check out in the shipped RN app at /Users/playra/leela-src/leela.

1. The helper is quoted correctly. /Users/playra/leela-src/leela/src/constants.ts:162-174 is exactly `export const captureException = (error: any, target: string) => {` with `if (!error) { console.log('%c captureException called with messing or incorrect arguments', ...); return }` at line 163, then `console.error(...)` and `if (!__DEV__) { Sentry.captureException(error) }` at line 172. There is no normalization of the argument anywhere — no `instanceof Error` coercion, no `new Error(...)` wrap.

2. The call site is as claimed. /Users/playra/leela-src/leela/src/screens/Authenticator/SignIn/useSignIn.ts:62-84 is a `.catch((err) => { switch (err.code) { ... default: captureException(err.message, 'onSubmit'); setError(err.code); break } })`. Line 80 passes `err.message`, a string, while essentially every other call site in the repo passes the error object (src/screens/helper.ts:58 `captureException(err, 'getProfile')`, src/screens/helper.ts:387 `captureException(error, 'onSignIn')`, src/hooks/useKeychain.ts:35 `captureException(err, 'key')`, plus ~50 more).

Reachability: the default branch runs for any auth code outside the five mapped ones (auth/user-disabled, auth/invalid-credential, auth/internal-error, auth/operation-not-allowed, ...) and also for anything thrown inside the preceding `.then` callback (Keychain.setInternetCredentials at line 59), which the same `.catch` swallows. A thrown non-Error or an error with an empty/undefined `message` therefore takes the `!error` guard at constants.ts:163 and is discarded entirely — and since `setError(err.code)` is then `undefined` and the hook returns `error: error || ''` (line 90), the user is shown nothing either. When `message` is a non-empty string, `Sentry.captureException` receives a bare string: Sentry synthesizes the exception and stack, and `err.code` — the only field identifying which unhandled Firebase code was hit — never leaves the device. This is production-visible: Sentry is really initialized with a live DSN at src/AppWithProviders.tsx:27-29, and the `if (!__DEV__)` guard means the degraded report is exactly the production path.

Minor correction to the claim's wording: useSignIn.ts:80 is not the only string-passing site — src/screens/Authenticator/SignUp/useSignUp.ts:90 also passes `exception.message` and src/screens/Authenticator/Forgot/index.tsx:87 passes `error.code`. That widens the defect rather than refuting it.

### A wrong password produces no error message, only a bare "Forgot Password?" link

`src/screens/Authenticator/SignIn/index.tsx:86` — sign-in

```
{error !== t('auth.forgotPassword') ? (
  <TextError title={error} textStyle={textStyle} />
) : (
  <ButtonLink title={error} onPress={handleForgot} textStyle={textStyle} />
)}

// useSignIn.ts:71 -> case 'auth/wrong-password': setError(t('auth.forgotPassword'))
```

**What happens.** The error state is overloaded as a control signal: for auth/wrong-password the message is set to the translated label "Forgot Password?" (src/locales/en/translation.json auth.forgotPassword) and the red TextError is replaced entirely by a link. The user who mistypes their password is never told the password was wrong - the screen just sprouts a link. The branch also depends on the runtime string comparison staying exactly equal to t('auth.forgotPassword'); any translation edit in any of the locale files turns the recovery link back into plain red text reading "Forgot Password?", removing the only route to password reset.

**Held against refutation.** Confirmed in /Users/playra/leela-src/leela (the checkout the claim's paths/line numbers match exactly). useSignIn.ts:70-72 sets the error state for 'auth/wrong-password' to t('auth.forgotPassword') rather than a message, while every sibling case (invalid-email, user-not-found, network-request-failed, too-many-requests) sets a real message. index.tsx:86-94 then branches on error !== t('auth.forgotPassword') and renders ButtonLink INSTEAD of TextError, so the red error text is suppressed for exactly that case. src/locales/en/translation.json has auth.forgotPassword = "Forgot Password?" and it does resolve (i18next default keySeparator '.'; keySeparator:false is commented out at src/i18n.ts:97). Components confirm the visual: TextError renders red text, ButtonLink renders an underlined link (src/components/TextComponents/TextError/index.tsx, src/components/Buttons/ButtonLink/index.tsx). Reachable in the shipped app: @react-native-firebase/auth ^18.1.0 (package.json:25) emits auth/wrong-password, and FORGOT is a live route (src/Navigation.tsx:186) reached from this one link only. CAVEAT - the claim's fragility rationale is wrong: both sides call t('auth.forgotPassword') on the same default namespace (index.tsx:43, useSignIn.ts:23), so editing a locale value moves both sides together and equality holds; the branch only desynchronises if the language is switched while the error is already displayed.

### Every failed form validation is reported to Sentry as an exception

`src/screens/Authenticator/SignIn/index.tsx:45` — sign-in

```
const onError: SubmitErrorHandler<FieldValues> = (errors) => {
  captureException(errors, 'SignIn')
}
```

**What happens.** onError is react-hook-form's validation-failure callback, not an exception path. A user who taps Sign In with a five-character password or a malformed email produces a Sentry event carrying the react-hook-form errors object - which includes the field refs and values for `email` and `password`. Ordinary typos become production error volume, and the payload can carry the typed credentials off-device.

**Held against refutation.** Confirmed by reading the whole path; I could not refute it.

1. `/Users/playra/leela-src/leela/src/screens/Authenticator/SignIn/index.tsx:45-47` is exactly as quoted: `const onError: SubmitErrorHandler<FieldValues> = (errors) => { captureException(errors, 'SignIn') }`.

2. It is wired to the button with no guard: line 98 `onPress={methods.handleSubmit(onSubmit, onError)}`, and the `<Button>` at 96-99 has no `disabled` prop, so an invalid form can always be submitted.

3. Validation genuinely fails on ordinary typos. `/Users/playra/leela-src/leela/src/screens/Authenticator/SignIn/useSignIn.ts:26-45` builds a yup schema with `email().required()` and `password().required().min(6, t('shortPassword'))` and passes it via `yupResolver` to `useForm`. A five-character password or malformed email routes `handleSubmit` to `onError`.

4. `captureException` is not a local no-op. `/Users/playra/leela-src/leela/src/constants.ts:162-174`: it `console.error`s, then `if (!__DEV__) { Sentry.captureException(error) }`. So in the shipped release build the validation-errors object is sent to Sentry as an exception.

5. Sentry is live in production with no scrubbing. `/Users/playra/leela-src/leela/src/AppWithProviders.tsx:27-37` has a hardcoded DSN, `release: leela@<appVersion>.<buildVersion>`, and `enabled: process.env.NODE_ENV !== 'development'` — no `beforeSend`, no `normalizeDepth` override, no denylist. Because the argument is a plain object rather than an `Error`, each event lands as a "Non-Error exception captured with keys: email, password" issue, so ordinary typos become production error volume. The same anti-pattern repeats in `Forgot/index.tsx`, `SignUp/index.tsx`, and `SignUpUsername/index.tsx` (all import `SubmitErrorHandler`), and a near-identical copy exists at `/Users/playra/leela-src/leela-game/src/screens/Authenticator/SignIn/index.tsx`.

One caveat on the claim's severity, not its validity: the credential-exfiltration half is overstated. `Input` does pass `ref={field.ref}` (`/Users/playra/leela-src/leela/src/components/Input/index.tsx:86`), but with `useController` in react-hook-form ^7.30 (`package.json:48`) `_f.ref` is set to a proxy object of closures (`focus`/`select`/`setCustomValidity`/`reportValidity`), not the raw `TextInput` element, so the typed `value` is not plainly reachable in the serialized payload. The field names and validation messages are. The headline defect — every failed form validation reported to Sentry as an exception — is reachable and real.

### Reset error message is never cleared between submissions, so a stale "This user does not exist" survives a successful send

`src/screens/Authenticator/Forgot/index.tsx:73` — password reset

```
const onSubmit: SubmitHandler<FieldValues> = async (data) => {
    setLoading(true)
    const { email } = data
```

**What happens.** `setErrorMessage` is only ever assigned in the catch block; `onSubmit` never resets it to '' on a new attempt. Both sibling hooks do reset it (useSignIn.ts:54 `setError('')`, useSignUp.ts:63 `setError('')`). Concretely: user submits a typo'd address -> "This user does not exist"; corrects the address -> send succeeds -> lands on "Check your e-mail!"; taps the header back arrow -> returns to FORGOT still showing "This user does not exist" under the exact address that was just successfully mailed. The user concludes the reset failed and starts over (which is also what drives the send-spam in the finding above).

**Held against refutation.** Confirmed in /Users/playra/leela-src/leela/src/screens/Authenticator/Forgot/index.tsx (line numbers match the quote exactly: onSubmit at :72, setLoading(true) at :73). errorMessage is initialized at :46 and assigned ONLY inside the catch block (:81 userNotFound, :83 networkRequestFailed, :85 error.code). onSubmit :72-90 never resets it — it goes setLoading(true) -> destructure email -> try. The stale value renders unconditionally at :122-124 via `{errorMessage !== '' && <TextError title={errorMessage} .../>}`.

Reachability of the stated failure verified end to end, and every refutation I tried failed:
(1) Unmount-resets-state: refuted — Navigation.tsx:186-190 places FORGOT and FORGOT_PASSWORD_SUBMIT in the same @react-navigation/native-stack Stack.Navigator, so navigate() at :78 pushes and leaves FORGOT mounted with its useState intact; no unmountOnBlur or equivalent is configured.
(2) Back arrow goes elsewhere: refuted — ForgotPassSubmit/index.tsx:46 is onPress={goBack}, and constants.ts:186-188 is navRef.goBack(), a single pop straight back to FORGOT.
(3) Loading spinner hides it: refuted — :89 setLoading(false) executes after the navigate, so on return the form branch (:111-133) renders, stale error included.
(4) message={errorMessage} on AppContainer is a self-clearing toast: refuted and worse — src/components/AppContainer/index.tsx mentions `message` exactly once, in the prop type at :14, and never renders it; the only visible error is the inline TextError with no dismissal path.
(5) Intended behaviour: refuted by in-repo convention — SignIn/useSignIn.ts:54 calls setError('') immediately after setLoading(true), and SignUp/useSignUp.ts:63 does the same. Forgot is the sole outlier.

Same defect present in the sibling checkout /Users/playra/leela-src/leela-game/src/screens/Authenticator/Forgot/index.tsx:69-87.

### ForgotPassSubmit drops the `email` route param it is handed, so "Check your e-mail!" never says which mailbox

`src/screens/Authenticator/ForgotPassSubmit/index.tsx:33` — password reset

```
const ForgotPassSubmit = ({ navigation }: ForgotPassSubmitT): ReactElement => {
```

**What happens.** `RootStackParamList` requires `FORGOT_PASSWORD_SUBMIT: { email: string }` (src/types/types.ts:11) and Forgot/index.tsx:78 passes it, but the component destructures only `navigation` -- `route` is declared in `ForgotPassSubmitT` (line 30) and never read. The screen renders a bare `<Text h={'h1'} title={t('auth.checkMail')} />` (line 50) = "Check your e-mail!" and one button. A user who mistyped a still-valid address (own old mailbox, colleague's) gets no way to notice, and there is no resend control and no path for an expired Firebase link -- the only exits are back, or `navigation.navigate('HELLO')`. The sibling screen does exactly this correctly: ConfirmSignUp/index.tsx:80 renders `title={`(${route.params.email})`}`.

**Held against refutation.** Confirmed, not refutable. /Users/playra/leela-src/leela/src/screens/Authenticator/ForgotPassSubmit/index.tsx:33 destructures `({ navigation }: ForgotPassSubmitT)`; `route` is declared at line 30 and never referenced anywhere in the 58-line file. The screen is fully reachable: src/Navigation.tsx:186-190 registers FORGOT_PASSWORD_SUBMIT -> ForgotPassSubmit in the live auth Stack.Group; src/screens/Authenticator/SignIn/index.tsx:50 navigates to FORGOT with the email, and src/screens/Authenticator/Forgot/index.tsx:78 does `navigation.navigate('FORGOT_PASSWORD_SUBMIT', { email })` after `auth().sendPasswordResetEmail(email)` succeeds, so the param really is handed over (type at src/types/types.ts:11). The rendered body is only `<Text h={'h1'} title={t('auth.checkMail')} />` (line 50) plus a Button (line 52); `auth.checkMail` is the plain string "Check your e-mail!" with no interpolation (src/locales/en/translation.json:399), and AppContainer is given `title=" "` and renders only the string passed to it (src/components/AppContainer/index.tsx:44-48), so nothing else can display the address. Only exits are back (`goBack`) and `navigation.navigate('HELLO')` (line 35) - no resend, no expired-link path. The sibling ConfirmSignUp/index.tsx:80 renders ``title={`(${route.params.email})`}`` under the same heading, showing the omission is unfinished code, not intent. The file is committed and clean (780a8ae) and there is no second implementation (grep for ForgotPassSubmit in src returns one component, one registration). Only mitigation: the user typed the address on the previous screen seconds earlier, which lowers severity but does not make the claim false.

### Password rule is a minimum but the message states an exact length

`src/screens/Authenticator/SignIn/useSignIn.ts:38` — what the user is told

```
.min(6, t('shortPassword') || '')
```

**What happens.** The constraint is a lower bound (at least 6) but every locale states an equality: en "Password must be 6 characters long", ru "Пароль должен состоять из 6 символов" (must consist of 6 characters), fr "Le mot de passe doit comporter 6 caractères", tr "Şifre 6 karakter uzunluğunda olmalıdır". A user with a 4-character password reads it as an instruction to use exactly six and picks a weaker password than they would have. Same message on the same rule at SignUp/useSignUp.ts:40 and :44, where it is also shown under the Confirm password field.

**Held against refutation.** Confirmed in the shipped RN app at /Users/playra/leela-src/leela. The rule is a lower bound only: /Users/playra/leela-src/leela/src/screens/Authenticator/SignIn/useSignIn.ts:38 is `.min(6, t('shortPassword') || '')`, and grep for `.max(` under src/screens/Authenticator/ finds bounds only on username/motto (UserEdit/index.tsx:63,69 and SignUpUsername/index.tsx:69,75) — never on password. The same rule appears twice more in /Users/playra/leela-src/leela/src/screens/Authenticator/SignUp/useSignUp.ts:40 (password) and :44 (passwordConfirmation). The messages are equality-worded in the source locale files, not just jest cache: src/locales/en/translation.json:505 "Password must be 6 characters long", ru:503, fr:503, tr:502, plus ar/uk/ms/mr/te. The key resolves because src/i18n.ts registers every locale under the default `translation` namespace with flat keys. The text is genuinely displayed: both hooks use useForm({ mode: 'onChange' }), and src/components/Input/index.tsx renders `formState.errors[name].message` in a red Text under the field with showError defaulting to true (neither SignIn/index.tsx nor the SignUp screen overrides it). The flow is live, not dead code: src/Navigation.tsx:191 registers `SIGN_UP`. So a user typing a 4-character password at sign-up sees, per keystroke and under both password fields, a sentence asserting an exact length for what is only a minimum. Refutation attempts that failed: no max(6) making the rule truly exact; wording is in shipped locale JSON; error rendering is not suppressed; screens are routed. Nuance: on SignIn the wording is inert (the password already exists), so the behavioral harm lands specifically on useSignUp.ts:40 and :44; severity is copy-level, since a longer password still validates and submits.

### Hard-coded English strings on the welcome screen while the buttons beside them are translated

`src/screens/Authenticator/Hello/index.tsx:66` — what the user is told

```
title="Privacy Policy"
...
title="Terms of Use (EULA)"
...
title={`Version: ${bundleVersion} (${buildVersion})`}
```

**What happens.** Lines 66, 72 and 78 are literal English, yet the same render tree calls t('auth.signIn') on line 83, t('auth.signUp') on line 90 and t('offline') on line 99. For nine of the ten shipped locales the legal links a user must read before signing up — the two most consequential strings on the screen — are untranslated. `placeholder="E-mail"` is likewise hard-coded at SignIn/index.tsx:73, SignUp/index.tsx:60 and Forgot/index.tsx:116 while the password placeholder next to it uses t('auth.password').

**Held against refutation.** Confirmed, not refutable. /Users/playra/leela-src/leela/src/screens/Authenticator/Hello/index.tsx:66,72,78 pass literal English into `title`, and /Users/playra/leela-src/leela/src/components/TextComponents/Text/index.tsx renders `{title}` straight into RNText with no t() call anywhere in that component — so the strings are not keys. The screen is reachable and in fact primary: /Users/playra/leela-src/leela/src/Navigation.tsx:174 sets initialRouteName="HELLO" and :176 registers the component. Localization is device-driven across ten locales per /Users/playra/leela-src/leela/src/i18n.ts (ar,bn,en,fr,mr,ms,ru,te,tr,uk, lng from RNLocalize.getLocales()[0].languageCode), and ru/translation.json supplies auth.signIn="Вход"/auth.signUp="Регистрация" — so on a Russian device the two buttons localize while the Privacy Policy and EULA links beside them stay English. The placeholder half is exact too: grep gives placeholder="E-mail" at Forgot/index.tsx:116, SignIn/index.tsx:73, SignUp/index.tsx:60, each adjacent to placeholder={t('auth.password')}.

### Forgot screen passes an error message to a prop that is never rendered

`src/screens/Authenticator/Forgot/index.tsx:105` — what the user is told

```
message={errorMessage}
```

**What happens.** components/AppContainer/index.tsx declares `message?: string` on line 14 and never references it again in the file's 73 lines — no Text, no Alert, no snackbar. The prop is dead. Someone intended a second, more prominent surface for the reset-password error; it silently does nothing, which is why the only place the error appears is the small red TextError on line 123.

**Held against refutation.** Confirmed. /Users/playra/leela-src/leela/src/components/AppContainer/index.tsx:14 declares `message?: string` in `AppContainerT`, but the destructuring parameter list at lines 26-41 does not bind `message`, and the render body (lines 42-66) references it nowhere — it renders only `<Header>` and `<Background>`, and Header has no `message` prop (grep for "message" in src/components/Header/index.tsx returns nothing). The file is exactly 73 lines. So `message={errorMessage}` at /Users/playra/leela-src/leela/src/screens/Authenticator/Forgot/index.tsx:105 is a no-op. Import is unambiguous: AppContainer comes from the `../../../components` barrel (src/components/index.ts:1 -> ./AppContainer), and src/components/AppContainer/index.tsx:26 is the only definition in the tree; Forgot is the only caller in src/screens that passes `message=`. Caveat on severity, not reachability: the error is still shown to the user by TextError at Forgot/index.tsx:123, so this is a dead prop on a public interface rather than a lost error message.


## Refuted (12)

Claimed and not confirmed: each was read a second time and the code did not
support it.

- **Sign-up can be submitted twice: the async yup resolver runs before setLoading(true), and the button has no disabled state**

  Paths resolve to /Users/playra/leela-src/leela. The claim's parts are accurate in isolation (Button has no `disabled` prop at src/components/Buttons/Button/index.tsx:34-46; the custom Pressable adds no debounce at src/components/Pressable/index.tsx:16-41; `formState.isSubmitting` is unused), but the failure is unreachable as shipped. (a) `setLoading(true)` at src/screens/Authenticator/SignUp/useSignUp.ts:62 precedes the first genuinely async op (`createUserWithEmailAndPassword`, useSignUp.ts:64-65); everything before it — RHF's await of the yup resolver — resolves inside the same native-to-JS batch with the JS thread busy, so no touch event is delivered mid-window. (b) The app runs a legacy React root: `react: 18.1.0` in package.json, `newArchEnabled=false` in android/gradle.properties, and index.js:30 is a plain `AppRegistry.registerComponent(appName, () => App)` with no concurrentRoot. React 18 automatic batching is createRoot-only, so on a legacy root `setLoading(true)` from the async continuation flushes synchronously, and `loading ? <Loading /> : (...)` at src/screens/Authenticator/SignUp/index.tsx:47-49 unmounts the form (and the Button at line 84) before control returns to native. A second tap therefore always lands on an unmounted Button, and RN's responder system does not emit two press cycles for one Pressable within a single frame. Caveat: the protection is incidental — moving to the new architecture / a concurrent root would defer the unmount render past the queued touch and make the window real, so `disabled={methods.formState.isSubmitting || loading}` is still worthwhile hardening.

- **SignUpAvatar's Done button silently does nothing when onSignIn cannot route the user**

  Both legs of the claim fail against the code. (1) The Done button is gated on `!!OnlinePlayer.store.avatar` (src/screens/Authenticator/SignUpAvatar/index.tsx:60), and the only writers of that field are src/store/OnlinePlayer.ts:175 and :154. Line 175 sits *after* the awaited Firestore write `await firestore().collection('Profiles').doc(currentUser.uid).update({ avatar: ipfsImageUrl })` (src/store/OnlinePlayer.ts:170-175) inside a try whose catch is at :186 — so if the Profiles document does not carry `avatar`, the write either rejected (store.avatar never set) or has not resolved, and the button is not rendered at all. The other writer, :154 (`store.avatar = await getIMG(curProf.avatar)`), is only reached from helper.ts:378, which lives in the `else` branch where `prof.avatar` is already truthy, and from DetailPostScreen:79 deep inside the authenticated app. So whenever Done is tappable, the server has acked the avatar write and `else if (!prof.avatar)` at src/screens/helper.ts:360-361 cannot be taken. (2) The `getProfile()` failure path is misread: getProfile catches its own error and returns undefined (src/screens/helper.ts:51-61); with `prof === undefined` the first branch `!prof?.firstGame && !prof?.lastName` (src/screens/helper.ts:358) is `true && true`, so it runs `navigate('SIGN_UP_USERNAME', { email: user.email })` (src/screens/helper.ts:359) — a real navigation to a different screen, never reaching the avatar branch. The `if (user)` check is defensive; `auth().currentUser` was required non-null moments earlier in uploadImage (src/store/OnlinePlayer.ts:166) for the button to exist. Note the claimed path also does not exist in the sibling checkout /Users/playra/leela-src/leela-game, where handleSubmit navigates directly to CHANGE_INTENTION_SCREEN.

- **On Android the submit button sits under the keyboard: KeyboardAvoidingView is used with windowSoftInputMode=adjustPan**

  Files read: /Users/playra/leela-src/leela/src/screens/Authenticator/SignIn/index.tsx, /Users/playra/leela-src/leela/src/components/KeyboardContainer/index.tsx, /Users/playra/leela-src/leela/android/app/src/main/AndroidManifest.xml, /Users/playra/leela-src/leela/src/Navigation.tsx, plus AppContainer/Header/Input/Buttons/Button/Space.

The quoted lines are accurate (manifest line 25 is adjustPan; KeyboardContainer lines 23-27 are behavior 'height' + offset header+47), but the claimed failure chain does not hold:

1. The "pan" half of the compound never fires. index.tsx:67 renders a ScrollView whose first child is `Space height={H/5}` (line 68), then the email Input (71-77) and the password Input (78-84). Input's box is TextInput (fontSize s(16), vs(8) padding top/bottom, inputStyle at Input/index.tsx:105-111) plus a fixed error Text (Input/index.tsx:90-98) - roughly 70dp each. With the custom Header (~60dp, Header/index.tsx:106-111 + top inset) the focused password field lands around 40-48% down the window, well above an IME that occupies the bottom ~35-40%. Android's adjustPan only pans when the focused view is occluded, so there is no pan to compound with KeyboardAvoidingView's adjustment.

2. behavior 'height' does not translate content off-screen; it shrinks the KAV box. Since the child is a ScrollView (index.tsx:67), shrinking the box is exactly what makes the remaining content scrollable - the Sign In button (index.tsx:96-99) stays reachable rather than being pushed "off the visible area".

3. Even with no adjustment at all, the button clears the keyboard on typical phones: everything below `H/5` is fixed-size (two ~70dp inputs, s(10), a one-line TextError, vs(15), and Button height ms(50,0.9) ~ 58dp from Buttons/Button/index.tsx:14-19), so total content grows sub-linearly with H. On H~850 the button bottom sits near 56% of the window versus an IME top near 62%.

4. The "header + 47" premise is overstated: Navigation.tsx:171 sets headerShown:false for every screen in the only Stack.Navigator (SIGN_IN registered at Navigation.tsx:185), so useHeaderHeight() in KeyboardContainer/index.tsx:19 is not a real rendered header height for this screen.

node_modules is not installed in that checkout, so whether RN 0.70 even emits keyboardDidShow under adjustPan cannot be confirmed - if it does not, the claimed subtraction never happens at all. Either way the claim rests on pixel positions the code does not pin down, and the stated end state ("user has to dismiss the keyboard first") is really the separate keyboardShouldPersistTaps issue (confirmed absent repo-wide) restated. Refuted.

- **onSignIn swallows every error, so the sign-in screen cannot tell success from failure**

  The catch at /Users/playra/leela-src/leela/src/screens/helper.ts:386 is real, but the claimed user-visible failure ("form re-appears with no error and no navigation") is unreachable, because every throw source the claim names either cannot throw or fires only after navigate() has already run.

1. The only pre-navigation network call cannot reject. `getProfile()` at helper.ts:51-61 has its own try/catch (`catch (err) { captureException(err, 'getProfile') }`) and returns `res` (undefined) on failure. So `await getProfile()` at line 353 never rejects; a Firestore outage yields `prof === undefined`, which makes `!prof?.firstGame && !prof?.lastName` true and runs `navigate('SIGN_UP_USERNAME', ...)` at line 359. The user leaves the sign-in screen.

2. `navigate()` cannot throw. /Users/playra/leela-src/leela/src/constants.ts:19-23 is `if (navRef.isReady()) { navRef.navigate(name, params) }` — guarded, no throw path.

3. The RTDB presence write (helper.ts:375-377) and `OnlinePlayer.getProfile()` (line 378) sit inside the final `else` block, *after* `navigate('MAIN', { screen: 'TAB_BOTTOM_0' })` at line 368. Even if `getFireBaseRef(...).set(true)` throws, the navigation to MAIN has already been dispatched, so the user is on the main tab, not back on the sign-in form.

4. `OnlinePlayer.getProfile()` (378) and `fetchBusinesses()` (379) are not awaited, so their rejections never reach this catch at all — the claim's causal story for them is wrong twice over.

5. The one non-navigating exit, the ban branch at helper.ts:354-356, is deliberate and does give feedback: `isKeychain` is undefined when called from useSignIn.ts:60, so `!isKeychain && accountHasBanAlert()` fires the Alert at constants.ts:156-160.

Every reachable outcome of onSignIn either navigates away or shows an alert; the "spinner then silence" state the claim describes has no path to it.

- **The submit control has no disabled state and no re-entrancy guard**

  The file lives at /Users/playra/leela-src/leela/src/screens/Authenticator/SignIn/index.tsx (the trios cwd has no `src/`). The quoted props interface is accurate — /Users/playra/leela-src/leela/src/components/Buttons/Button/index.tsx:27-32 has no `disabled`, and /Users/playra/leela-src/leela/src/components/Pressable/index.tsx is a thin RNPressable wrapper with no throttle. But the claimed failure is not reachable as described, on three counts.

(1) The guard exists, just not on the button. index.tsx:56 `return loading ? (<Loading />) : (` swaps out the entire AppContainer/FormProvider subtree, so once loading flips the Button is unmounted — there is no "tap again while the request is in flight" window at all.

(2) The pre-`setLoading` window is sub-frame, not a double-tap interval. useSignIn.ts:50-54 makes `setLoading(true)` the *first* statement of onSubmit, before any I/O; the only unguarded gap is react-hook-form's `await _executeSchema()` microtask chain plus one React commit. A human double-tap is ~60-300ms apart; this window is a microtask drain plus a scheduler tick. The claim asserts "easily reachable by an impatient double-tap" without any code showing the gap spans a frame.

(3) The stated harm is refuted outright. `onSignIn` (src/screens/helper.ts:345-389) navigates via `navigate` from src/constants.ts:19-23, which is `navRef.navigate(name, params)` on `createNavigationContainerRef` with @react-navigation/native ^6.0.13 (package.json:32). Name-based `navigate` in RN6 resolves to an existing route in the stack and updates its params rather than pushing a second copy, so "push the destination screen twice onto the stack" cannot happen. The other two effects are idempotent: `Keychain.setInternetCredentials('auth', email, password)` (useSignIn.ts:59) upserts one entry keyed by server, and a repeated `signInWithEmailAndPassword` with identical credentials (useSignIn.ts:56-57) returns the same user rather than creating state.

Adding a `disabled` prop would be a reasonable hardening, but the code does not plainly show the described defect.

- **Forgot passes an error banner to AppContainer via a prop AppContainer silently discards**

  The file lives at /Users/playra/leela-src/leela/src/screens/Authenticator/Forgot/index.tsx (identical copy in /Users/playra/leela-src/leela-game/...). The claim's structural facts check out — AppContainer declares `message?: string` (/Users/playra/leela-src/leela/src/components/AppContainer/index.tsx:14) and `colorLeft?: string` (line 9), neither is destructured in the parameter list (lines 26-41), the body (lines 42-65) forwards neither to `<Header>` (lines 45-55), and Header's own `HeaderT` (/Users/playra/leela-src/leela/src/components/Header/index.tsx:14-25) has no `colorLeft`. But the claimed *failure* — "the intended second error surface fails silently," i.e. an error the user never sees — is refuted three ways.

1. No error is lost. The same screen renders the same state inline: Forgot/index.tsx:122-124 `{errorMessage !== '' && (<TextError title={errorMessage} textStyle={styles.errorText} />)}`, and TextError (/Users/playra/leela-src/leela/src/components/TextComponents/TextError/index.tsx:23-31) paints it as red text (`color: 'red'`, line 12). Every branch of the catch at Forgot/index.tsx:79-88 (`auth/user-not-found`, `auth/network-request-failed`, raw `error.code`) writes to that same `errorMessage`, so all of them reach the screen. The dropped prop is a duplicate of a surface that works, not the only surface.

2. There is no "second surface" that broke. `git log --all -p -- src/components/AppContainer/index.tsx | grep -E '^[+-].*message'` in /Users/playra/leela-src/leela returns exactly one line, `+  message?: string`. No revision of AppContainer's body has ever referenced `message` — it is a never-implemented optional field, not a regression, and Forgot:105 is its only call site in the whole tree (`grep -rn "message=" src --include='*.tsx'` → 1 hit).

3. The `colorLeft` supporting evidence is also inert rather than broken: Header renders the left icon as `<Emoji name={iconLeft} style={leftIconStyle} />` (Header/index.tsx:59-63) with `iconLeft={'back'}`, i.e. a color emoji glyph, so a forwarded text color would change nothing rendered. All 8 `colorLeft={...}` call sites (ChangeIntention:83, ConfirmSignUp:75, SignUp:45, SignIn:64, Hello:55, ForgotPassSubmit:47, UserEdit:97, Forgot:106) have always been no-ops with no visual delta.

This is real dead-code hygiene (two vestigial optional props on AppContainerT), but the shipped behavior is correct: no user-facing error message is dropped and no rendered output differs.

- **UserEdit's required-field validators have no message, so a localized app shows yup's English default**

  Refuted empirically. File is /Users/playra/leela-src/leela/src/screens/Authenticator/UserEdit/index.tsx (line 62 matches the quote). The bare `.required()` message is real but unreachable: `.min(2, t('twoSymbolRequire'))` is chained BEFORE `.required()` (index.tsx:61-62), yup pushes tests in call order, and @hookform/resolvers keeps only the FIRST error per path — its shipped code is `(o.inner||[]).reduce(function(e,r){if(e[r.path]||(e[r.path]={message:r.message,type:r.type})...` (node_modules/@hookform/resolvers/yup/dist/yup.js), i.e. `message` is always the first inner error's. I installed the declared versions (yup@0.32.11 per package.json:88 `"yup": "^0.32.11"`, @hookform/resolvers@2.9.11 satisfying package.json:18 `^2.8.8`) and ran the exact schema: for the claimed input `firstName: ""` the inner order is `firstName:min:"<localized>" | firstName:required:"firstName is a required field"`, and the resolver output is `{"firstName":{"message":"<localized>","type":"min"}}`. Whitespace-only behaves identically (trim transform then min). Only `undefined` reaches the English default, because yup's string `min` test short-circuits on `isAbsent(value)` — and undefined is unreachable here: `defaultValues: {...route.params}` (index.tsx:77) is fed `OnlinePlayer.store.profile`, whose `initProfile` is `{firstName: '', lastName: '', email: '', intention: ''}` (src/store/OnlinePlayer.ts:23-28), and RN TextInput's `onChangeText` (src/components/Input/index.tsx:79) only ever yields a string. `criteriaMode` is left at the default 'firstError', and even 'all' would only add `types`, not change `.message`, which is what Input renders at src/components/Input/index.tsx:91. The key `twoSymbolRequire` exists in every locale (src/locales/{en,ru,uk,fr,ar,tr,ms,te,mr}/translation.json:~506), so the user sees localized text. Same holds for the sibling copy /Users/playra/leela-src/leela-game/src/screens/Authenticator/UserEdit/index.tsx:48-56. Style inconsistency only; no user-visible defect.

- **Sign-in can fail with no message at all because undefined is collapsed to an empty string**

  The quoted line is real but inert, and both claimed failure paths break down when the surrounding code is read.

1. The quoted line is not a defect and cannot cause the symptom. `/Users/playra/leela-src/leela/src/screens/Authenticator/SignIn/useSignIn.ts:90` is `return { onSubmit, methods, error: error || '', loading, userInfo }`. Its only consumer is `/Users/playra/leela-src/leela/src/screens/Authenticator/SignIn/index.tsx:87` -> `<TextError title={error} .../>`, and `TextError` (`/Users/playra/leela-src/leela/src/components/TextComponents/TextError/index.tsx:26-28`) renders `{title}` as a React child. React renders `undefined` children as nothing, exactly like `''`. So `|| ''` is a coercion to satisfy the `title: string` prop type; deleting it would produce identical pixels. Nothing is "collapsed" into a lost message - the message was never set. The claim mislocates the cause on the quoted line.

2. Path (b) is factually wrong. The claim says "if `getProfile()` fails it returns normally without navigating". `getProfile` (`/Users/playra/leela-src/leela/src/screens/helper.ts:51-61`) has its own try/catch, swallows the Firestore error at line 57-58, and returns `undefined`. Back in `onSignIn` (`helper.ts:353`), `prof` is `undefined`, so `!prof?.firstGame && !prof?.lastName` is true and line 359 runs `navigate('SIGN_UP_USERNAME', { email: user.email })`. The user is navigated, not stranded. Every branch reachable from this call site either navigates (lines 359, 361, 363, 370, 382) or shows an alert (line 355 `accountHasBanAlert()`, reached because `isKeychain` is undefined when `useSignIn.ts:60` calls `onSignIn(user.user)` with one argument). There is no silent return-to-form.

3. Path (a) needs an error with no `.code`, which the two remaining throwers cannot produce. Inside the `.then` (useSignIn.ts:58-61) only `Keychain.setInternetCredentials` and `onSignIn` are awaited. `onSignIn` wraps its entire body in try/catch (`helper.ts:350-388`) and therefore never rejects - the claim itself concedes this, which removes it as a source. `Keychain.setInternetCredentials` is a React Native native-module promise; RN builds the JS error via `createErrorFromErrorData`, which always carries `code` (native rejecters default it to `EUNSPECIFIED`). `@react-native-firebase/auth` rejections are `NativeFirebaseError`, always with `.code`. So the default branch at lines 79-82 sets a non-empty string; an unmapped Firebase code such as `auth/invalid-credential` renders as visible red text. Untranslated and ugly, yes - but that is a different, non-silent complaint than the one claimed.

The one thing left after this is that a reachable JS-level `TypeError` (e.g. an unlinked Keychain native module) would go the empty route, but that is a build-configuration break, not the runtime sign-in failure described. The claimed defect as stated - silent failure caused by `error || ''` on line 90 - does not hold.

- **Avatar screen's Done button silently does nothing, and is hidden with no explanation until an avatar is picked**

  The Done button at /Users/playra/leela-src/leela/src/screens/Authenticator/SignUpAvatar/index.tsx:60 renders only when OnlinePlayer.store.avatar is truthy, and that field is written in exactly two places, both requiring an authenticated user: /Users/playra/leela-src/leela/src/store/OnlinePlayer.ts:175 (inside `if (currentUser)` at :164-165; the else branch at :182 logs and writes nothing) and OnlinePlayer.ts:154 inside getProfile(). So when the button is visible, auth().currentUser was non-null moments earlier and the `if (user)` at index.tsx:41 is a defensive re-check, not a live no-op path. Sign-out cannot create the claimed state either: both OnlinePlayer.ts:73-98 (SignOut) and :100-121 (SignOutToOffline) set `avatar: ''` before calling auth().signOut(), and the screen is a MobX observer, so the button unmounts; SignOut also navigate('HELLO'). No onAuthStateChanged listener exists in src. The claim's "session expired" premise is also wrong for Firebase: currentUser survives ID-token expiry and is nulled only by explicit signOut or account deletion. The hidden-button half is intended: src/screens/helper.ts:361 routes here only when `!prof.avatar` (mandatory step, hence the blocked back paths), and the empty state is not blank -- src/components/Avatar/index.tsx:27-31 renders the `pickaface.png` placeholder inside the Pressable as the tap affordance.

- **Sign-up avatar is uploaded to public IPFS with EXIF metadata retained, permanently and irrevocably**

  REFUTED. The file is /Users/playra/leela-src/leela/src/hooks/useChooseAvatarImage.ts (not in trios). I grant reachability: SignUpAvatar uses the hook (src/screens/Authenticator/SignUpAvatar/index.tsx:37), the Pressable at :55 fires chooseAvatarImage, the screen is registered at src/Navigation.tsx:193 and navigated to during registration from src/screens/Authenticator/SignUpUsername/index.tsx:102. What fails is the defect itself, on both of its parts.

1) The EXIF claim rests on a misread option. `includeExif: true` (useChooseAvatarImage.ts:21) is a react-native-image-crop-picker RESPONSE option — it populates an `exif` field on the returned JS object. It does not control what is written to the file at `image.path`. Proof it is inert here: `grep -rn -i exif src` returns exactly two hits, useChooseAvatarImage.ts:21 and src/screens/helper.ts:271 — both are the option being set, and nothing in the codebase ever reads `image.exif`. It is copy-pasted boilerplate (helper.ts:259-281 is a byte-identical duplicate of the same options block) with no consumer.

2) The bytes uploaded are not the camera-roll file. The picker is called with `cropping: true`, `width/height: 400`, `cropperCircleOverlay: true`, plus `compressImageMaxWidth/Height: 400` and `compressImageQuality: 1` (useChooseAvatarImage.ts:12-19). `image.path` is therefore the cropper's freshly written 400x400 output (RSKImageCropper on iOS re-encodes via UIImageJPEGRepresentation; the forced resize/recompress path applies on both platforms), which is what line 42 reads. The original photo's GPS/timestamp block is not in that file. The claim's own hedge — "possibly the coordinates" — is the inference, not something the code shows.

3) The residual behaviour is the intended feature, not a defect. The returned CID becomes the user's public profile picture: OnlinePlayer.uploadImage (src/store/OnlinePlayer.ts:162-176) sets it as the Firebase Auth `photoURL` and writes it to the shared `Profiles/{uid}.avatar` document. Line 177-179 even deletes the previous Firebase Storage object, showing a deliberate migration to nft.storage/IPFS. A user tapping an avatar placeholder to pick a profile picture in a multiplayer web3 game is choosing to publish that image; permanent pinning is the stated purpose of nft.storage.

The bundled-token remark is also shaky: babel.config.js does not load react-native-dotenv at all (only module-resolver and reanimated); only the separate .babelrc lists `module:react-native-dotenv`, and no .env exists in the repo (gitignored at .gitignore:63). Regardless, a bundled API key is a different finding from the one being claimed.

- **A live third-party API key is committed in source**

  Every artifact the claim rests on is absent. (1) The cited file does not exist: there is no `src/constants.ts` at the repo root, in the working tree or in `git ls-files`. (2) The only two tracked `constants.ts` files are 9 lines each and hold no secrets — /Users/playra/BrowserOS/trios/agent-server/apps/eval/src/constants.ts:1-9 (the nearest path match) is only DEFAULT_TIMEOUT_MS, SCREENSHOT_TIMEOUT_MS, MAX_ACTIONS_PER_DELEGATION, CLADO_REQUEST_TIMEOUT_MS, so there is no line 212; /Users/playra/BrowserOS/trios/agent-server/apps/agent/lib/jtbd-popup/constants.ts is likewise 9 lines. A regex scan of both for any 28+ char literal returned nothing. (3) The string never existed, in tree or history: `grep -rni revenuecat` and `grep -rni BeIMII` give zero hits, and the pickaxe across all 7096 commits on every ref (`git log --all -i -S"revenuecat"` and `git log --all -G"[Rr]evenue[Cc]at"`) returns empty — refuting the core assertion that the value is 'already in every clone' and must be revoked. (4) The corroborating details are fabricated too: `RevenueCatProvider.tsx` does not exist (only theme/analytics/auth/graphql/rpc providers are tracked), there is no React Native app or `@env` module, /Users/playra/BrowserOS/trios/.gitignore is 41 lines so the cited .gitignore:63 cannot exist, and no `appl_`/`goog_` RevenueCat key shapes appear anywhere. This repo is a Swift macOS app plus a Node/TS agent-server; the finding was transplanted from a different codebase.

- **captureException arguments are reversed, mislabeling the Sentry event, in a function that also console.logs third-party list data**

  The argument order really is transposed relative to the signature at /Users/playra/leela-src/leela/src/constants.ts:162 (`captureException = (error: any, target: string)`), but the failure is unreachable: the function that contains it is dead code. `getAddrressBook` is defined at /Users/playra/leela-src/leela/src/screens/Authenticator/SignUp/sendpulse.ts:54 and a repo-wide grep for `AddrressBook` (excluding node_modules/.git) returns only two hits, both inside that same function (:54 definition, :76 the quoted call) — nothing calls it. The module's sole importer is /Users/playra/leela-src/leela/src/screens/Authenticator/SignUp/useSignUp.ts:13, which imports only `postEmailToSendPulse`. It is not exposed via a barrel either: /Users/playra/leela-src/leela/src/screens/Authenticator/index.ts:3 re-exports './SignUp', which resolves to SignUp/index.tsx whose only export is the `SignUp` component (index.tsx:29); no file re-exports sendpulse.ts. So neither the mislabeled Sentry event nor the address-book console.logs at sendpulse.ts:67-73 can execute in the shipped app. Even with a call site added, the else branch needs SendPulse's GET /addressbooks to return a non-array, a second precondition. The claim concedes this is latent, not firing.
