import { I18n } from '../utils'
import { DiceStore, OfflinePlayers, OnlinePlayer } from '../store'

export const useHistoryData = () => {
  const DATA = !DiceStore.online
    ? [
        {
          title: `${I18n.t('player')} 1`,
          data: OfflinePlayers.store.histories[0].slice().reverse()
        },
        {
          title: `${I18n.t('player')} 2`,
          data: OfflinePlayers.store.histories[1].slice().reverse()
        },
        {
          title: `${I18n.t('player')} 3`,
          data: OfflinePlayers.store.histories[2].slice().reverse()
        },
        {
          title: `${I18n.t('player')} 4`,
          data: OfflinePlayers.store.histories[3].slice().reverse()
        },
        {
          title: `${I18n.t('player')} 5`,
          data: OfflinePlayers.store.histories[4].slice().reverse()
        },
        {
          title: `${I18n.t('player')} 6`,
          data: OfflinePlayers.store.histories[5].slice().reverse()
        }
      ].slice(0, DiceStore.multi)
    : [
        {
          title: '',
          data: OnlinePlayer.store.history.slice().reverse()
        }
      ].slice()

  return { DATA }
}
