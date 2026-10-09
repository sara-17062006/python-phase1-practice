# String Placement Practice

The String Practice page contains 66 Python string problems, including problems derived from the supplied string-program videos and additional placement-level string patterns.

## Judge behavior
- **Run Code** executes against the visible custom input.
- **Submit & Check Hidden Tests** executes the solution against five unseen test inputs for the selected problem.
- The page reports only how many hidden tests passed; hidden inputs and expected outputs are not shown in the UI.
- Code and completion state are saved in browser localStorage under a separate String Practice key, so the existing Phase 1 progress is not changed.

## Important limitation
The current hidden-test implementation is browser-side because the project is a static Vercel/GitHub site. The hidden cases are not rendered in the UI, but they are still present in the client JavaScript and therefore are inspectable by someone who deliberately inspects the page source. A security-grade hidden judge would require a server-side code-execution service and private test data.
