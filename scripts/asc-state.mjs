/**
 * What App Store Connect actually holds, in one command.
 *
 *     node scripts/asc-state.mjs
 *
 * Written on 2026-08-23 after an improvement loop discovered it had been
 * carrying four beliefs about this app for weeks without measuring any of
 * them — and after a sibling discovery that the deployed bot was four commits
 * behind its branch, for the same reason: nothing asked the platform.
 *
 * It answers three questions that are otherwise guesses:
 *
 *   - which build TestFlight holds, and whether it is VALID or expired;
 *   - which version is live on the store, and since when;
 *   - whether a version is staged and waiting for a human to press
 *     "Add for Review" — `PREPARE_FOR_SUBMISSION` is that state.
 *
 * Read-only. It submits nothing, changes nothing, and holds no secret: the
 * key stays in `~/.appstoreconnect/private_keys/` and is read at call time.
 */

import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const KEY_ID = process.env.ASC_KEY_ID ?? 'R3JF4GL93F';
const ISSUER = process.env.ASC_ISSUER_ID ?? '69a6de80-7a75-47e3-e053-5b8c7c11a4d1';
const BUNDLE = process.env.ASC_BUNDLE_ID ?? 'xyz.ghashtag.dharma';

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

/**
 * Node signs ES256 into DER; JOSE wants the bare `r || s`, 32 bytes each.
 *
 * The one fiddly part of this file, and the reason a JWT library is usually
 * reached for. Written out because it is fifteen lines and a dependency is
 * forever: DER is `30 <len> 02 <len> r 02 <len> s`, each integer carrying a
 * leading zero byte when its top bit is set, which has to come back off.
 */
function joseSignature(der) {
  let at = (der[1] & 0x80) === 0 ? 2 : 2 + (der[1] & 0x7f);
  const halves = [];

  for (let part = 0; part < 2; part += 1) {
    const length = der[at + 1];
    let value = der.subarray(at + 2, at + 2 + length);
    while (value.length > 32) value = value.subarray(1);
    halves.push(Buffer.concat([Buffer.alloc(32 - value.length), value]));
    at += 2 + length;
  }

  return Buffer.concat(halves);
}

function token() {
  const key = readFileSync(
    `${process.env.HOME}/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8`,
    'utf8',
  );
  const issued = Math.floor(Date.now() / 1000);
  const header = base64url({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' });
  // Ten minutes: Apple refuses anything longer than twenty.
  const payload = base64url({ iss: ISSUER, iat: issued, exp: issued + 600, aud: 'appstoreconnect-v1' });

  const signer = createSign('SHA256');
  signer.update(`${header}.${payload}`);

  return `${header}.${payload}.${joseSignature(signer.sign(key)).toString('base64url')}`;
}

const jwt = token();

async function ask(path) {
  const response = await fetch(`https://api.appstoreconnect.apple.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const body = await response.json().catch(() => ({}));
  if (response.status !== 200) {
    throw new Error(`${path} answered ${response.status}: ${JSON.stringify(body).slice(0, 200)}`);
  }
  return body;
}

const apps = await ask(`apps?filter[bundleId]=${BUNDLE}`);
const app = apps.data?.[0];
if (!app) throw new Error(`no app for bundle ${BUNDLE}`);
console.log(`${app.attributes.name} (${BUNDLE}), app id ${app.id}`);

const builds = await ask(`builds?filter[app]=${app.id}&limit=5&sort=-uploadedDate`);
console.log('\nTestFlight, newest first:');
for (const build of builds.data ?? []) {
  const { version, processingState, expired, uploadedDate } = build.attributes;
  console.log(
    `  build ${version}: ${processingState}${expired ? ', EXPIRED' : ''}` +
      `, uploaded ${String(uploadedDate).slice(0, 16)}`,
  );
}

const versions = await ask(`apps/${app.id}/appStoreVersions?limit=5`);
console.log('\nStore versions, newest first:');
for (const version of versions.data ?? []) {
  const { versionString, appStoreState, createdDate } = version.attributes;
  console.log(
    `  ${versionString}: ${appStoreState}, created ${String(createdDate).slice(0, 10)}` +
      (appStoreState === 'PREPARE_FOR_SUBMISSION' ? '   <- waiting for a human to submit it' : ''),
  );
}
