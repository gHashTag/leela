import { TFunction } from 'i18next'

export const getFollowUpQuestions = (t: TFunction): string[] => [
  t('followUpQuestions.q1'),
  t('followUpQuestions.q2'),
  t('followUpQuestions.q3'),
  t('followUpQuestions.q4')
]
