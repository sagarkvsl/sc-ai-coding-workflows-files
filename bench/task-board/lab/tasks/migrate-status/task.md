# Task: rename two board statuses everywhere

The product team renamed two columns. Make the repository agree with the new names, **everywhere**.

| Old status value | New status value | Old column label | New column label |
|---|---|---|---|
| `todo` | `backlog` | `To do` | `Backlog` |
| `doing` | `review` | `In progress` | `In review` |

`done` / `Done` is unchanged. The order of the columns is unchanged.

This covers the status values and the labels in the types, the reducer, selectors and hooks, the components, the **tests**, the `tools/` report, the styles if they mention a status, and `README.md`. After the change, the words `todo`, `doing`, `To do` and `In progress` must not appear anywhere in `src/`, `tools/` or `README.md`, including in test names and comments.

Examples of what changes for users: the first column is headed `Backlog`, the buttons read `Move Write docs to Backlog` and `Move Write docs to In review`, and the report line reads `Total: 3 (Backlog 1, In review 1, Done 1)`.

No behaviour changes. Update the existing tests to the new names and keep them passing.
