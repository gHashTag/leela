/** How many real moves a player may make before paid access is required. */
export const FREE_MOVES = 3;

/**
 * The versioned message a Telegram Web App sends when its paywall button is
 * pressed. Shared by the page and the bot so a typo cannot make the button
 * silently hand over something the bot reads as a journal entry.
 */
export const SUBSCRIBE_REQUEST = 'leela:subscribe:v1';
