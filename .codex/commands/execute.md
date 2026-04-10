Execute an implementation plan from a markdown file.

Required flow:
1. Read the entire plan.
2. Read all referenced files before editing.
3. Implement the tasks in dependency order.
4. Add the tests named in the plan or the minimum focused regression coverage needed.
5. Run the validation commands from the plan.
6. Report completed tasks, files changed, tests run, and remaining issues.

Do not skip validation.
