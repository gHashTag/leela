/** Put a stable table handle on any configured Mini App URL. */
export function tableMiniAppUrl(base: string, chatId: string): string {
  const url = new URL(base);
  url.searchParams.set('chat', chatId);
  return url.toString();
}
