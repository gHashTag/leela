import { getFollowUpQuestions } from './followUpQuestions'

const t = (key: string) => {
  if (key === 'followUpQuestions.q1') return 'Question one'
  if (key === 'followUpQuestions.q2') return 'Question two'
  if (key === 'followUpQuestions.q3') return 'Question three'
  if (key === 'followUpQuestions.q4') return 'Question four'
  return key
}

describe('getFollowUpQuestions', () => {
  it('returns four localized follow-up questions', () => {
    const questions = getFollowUpQuestions(t)
    expect(questions).toEqual([
      'Question one',
      'Question two',
      'Question three',
      'Question four'
    ])
  })
})
