# Plan

1. Extend the authenticated game reply with a private `player` context and add
   `intention` and `report` actions beside `read` and `roll`.
2. Validate intention text with `@leela/journal`, run reports through
   `commands.report`, serialize writes per table, and return the updated context.
3. Teach the linked WebGL board to read/write that context while leaving the
   standalone board on local storage.
4. Extract one table-aware Mini App URL helper and use it for bot offers and
   initiative keyboards.
5. Add a pure engagement-skill selector to initiative and state-specific copy
   for reflection, turn, and waiting states.
6. Cover API privacy/rules, WebGL parsing/writes, URL selection, and each agent
   branch; run focused suites, the full verifier, and a read-only live check.
