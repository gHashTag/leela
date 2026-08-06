/**
 * Point React Native's boost podspec at an archive that still exists.
 *
 * RN 0.70 pins boost 1.76.0 and downloads it from `boostorg.jfrog.io`, which
 * stopped serving it. CocoaPods fetches something else, the checksum does not
 * match, and `pod install` dies before a single file is compiled — the first
 * wall between this repository and a build.
 *
 * Runs on `postinstall`, because the file lives inside `node_modules` and is
 * rewritten by every install.
 */
const { readFileSync, writeFileSync, existsSync } = require('node:fs')

const podspec = 'node_modules/react-native/third-party-podspecs/boost.podspec'
const gone = 'https://boostorg.jfrog.io/artifactory/main/release/1.76.0/source/boost_1_76_0.tar.bz2'
const alive = 'https://archives.boost.io/release/1.76.0/source/boost_1_76_0.tar.bz2'

if (!existsSync(podspec)) process.exit(0)

const source = readFileSync(podspec, 'utf8')
if (!source.includes(gone)) process.exit(0)

writeFileSync(podspec, source.split(gone).join(alive))
console.log('boost.podspec: download URL moved to archives.boost.io')
