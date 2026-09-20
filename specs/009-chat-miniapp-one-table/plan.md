# Plan

1. Add a small authenticated `/api/game` route beside `/api/ask`. Validate the
   signed Telegram launch data, authorize the seat, serialize a replayable view
   of the room, and serialize writes per table.
2. Put the source chat id on reply-keyboard board launches. Menu-button and
   ordinary browser launches remain standalone.
3. Preload a linked room before the WebGL entry is imported. In linked mode use
   the server session and server die, disable local persistence/seating, and
   animate the authoritative move returned by the server.
4. Test the relation: the session returned after every accepted browser throw
   equals the room persisted for the chat, while refusals leave both unchanged.
5. Run package and repository gates and inspect the public endpoints read-only.

