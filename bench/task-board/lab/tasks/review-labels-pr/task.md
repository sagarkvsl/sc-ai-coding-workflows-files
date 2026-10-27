# Task: review a pull request

A teammate opened a pull request that adds **labels** to tasks. The repository in this folder is the code **after** the change. `PR.diff` is the diff, and `LABELS_SPEC.md` is the specification the PR is meant to implement. Follow the house rules in `README.md`.

Your job is to review it and report the **real defects**: places where the code does not do what the specification says, or breaks a house rule in a way that changes behaviour. Do not report style opinions. Do not edit any source file.

Write your findings to `review.json` in the repository root, as a JSON array:

```json
[
  { "file": "src/state/example.ts", "line": 42, "issue": "one or two sentences: what is wrong and what it causes" }
]
```

- `file` is the path from the repository root, `line` is the 1-based line in the file as it is now (the line where the defect is, not the line of the function that contains it).
- Each finding is judged against a hidden list of planted defects. A finding scores when it names the right file and a line within 4 lines of the defect. A finding that matches no defect counts against you as a false alarm, so report only what you are confident about. Report at most 15 findings.
- Reading is enough. You do not need to run anything.
