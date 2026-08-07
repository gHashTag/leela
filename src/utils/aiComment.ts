import { LEELA_ID } from '@env'

export const isAiComment = (ownerId: string): boolean => ownerId === LEELA_ID
