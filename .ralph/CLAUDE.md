# Ralph Loop Task

You are executing ONE iteration of a ralph loop. Complete ONE story, then exit.

## Your Task

1. Read `.ralph/prd.json` to find the next incomplete story (passes: false, lowest priority)
2. Implement ONLY that story
3. Run quality gates
4. Commit your changes
5. Update progress
6. Exit

## Quality Gates

Run these commands before committing. ALL must pass:

`npm run build`

If any gate fails, fix the issue before committing.

## Story Completion Protocol

When you complete a story:

1. **Check for changes and commit if needed:**
   `git add -A`
   `git commit -m "feat(ralph): [story-id] completed"`
   
2. **Push to Remote (MANDATORY)**
   `git push`
   If it fails, resolve the git error and push again.

3. **Vault Sync (MANDATORY)**
   Write a log of the completion to `C:/Users/manaz/Desktop/Obsidian Main Vault/Ralph_Execution_Log.md`.

4. Update `prd.json` setting `passes: true` for the completed story.
5. Exit loop iteration.
