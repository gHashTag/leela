/** Privacy-safe verdict for the public companion stream. */

export type LiveAIState = 'passing' | 'failing' | 'unknown';

export interface LiveAIObservation {
  status: number;
  contentType: string;
  body: string;
}

export interface LiveAIVerdict {
  state: LiveAIState;
  why: string;
}

/** Inspect only the wire shape; no provider output is ever copied into a verdict. */
export function liveAIVerdict(observation: LiveAIObservation | null): LiveAIVerdict {
  if (observation === null) {
    return { state: 'unknown', why: 'the production companion request did not answer' };
  }

  if (observation.status !== 200) {
    return {
      state: 'failing',
      why: `the companion route answered ${observation.status}, expected 200`,
    };
  }

  if (!observation.contentType.toLowerCase().includes('text/event-stream')) {
    return { state: 'failing', why: 'the companion returned a non-stream response' };
  }

  for (const line of observation.body.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    try {
      const event = JSON.parse(line.slice(5).trim()) as { text?: unknown };
      if (typeof event.text === 'string' && event.text.trim() !== '') {
        return { state: 'passing', why: 'the configured companion returned text' };
      }
    } catch {
      // A malformed frame is not echoed and cannot prove the model answered.
    }
  }

  return { state: 'failing', why: 'the companion stream contained no answer text' };
}

export function liveAIExitCode(state: LiveAIState): 0 | 1 | 2 {
  return state === 'passing' ? 0 : state === 'failing' ? 1 : 2;
}

/** Accept only one self-consistent inner verdict from the Railway adapter. */
export function liveAIRemoteExitCode(status: number | null, output: string): 0 | 1 | 2 {
  const expected = status === 0 ? 'PASS' : status === 1 ? 'FAIL' : status === 2 ? 'UNKNOWN' : null;
  if (expected === null) return 2;
  const verdicts = output.split(/\r?\n/).filter((line) => /^(PASS|FAIL|UNKNOWN) — /.test(line));
  if (verdicts.length !== 1 || !verdicts[0]?.startsWith(`${expected} — `)) return 2;
  return status as 0 | 1 | 2;
}
