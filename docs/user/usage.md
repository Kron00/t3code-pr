# Review usage

The Usage page combines Codex, Claude Code, and Grok Build activity from your connected
environments. It reads the providers' local session history and shows API-equivalent token cost,
processed tokens, cache savings, provider shares, and model breakdowns. Subscription billing is
separate from the raw token cost shown here.

Grok Build totals come from persisted session updates. Interactive turns that never wrote a
completed-turn record will not appear.

Use **Past 24h** for an hourly chart covering the exact rolling 24-hour period. The **7 days**,
**30 days**, and **90 days** ranges use daily resolution. Cost and token toggles update both the
headline and chart, and refreshing rescans every connected environment.

## Resume after a subscription limit

When Codex, Claude Code, Cursor, Grok, or OpenCode reports that a thread has reached its usage
limit, the thread error includes **Resume when available**. Select it to let T3 Code continue the
same thread automatically after usage becomes available again. T3 Code never creates a new thread
for the retry. If the provider reports an exact reset time, T3 Code uses it. Otherwise, T3 Code
retries at increasing intervals.

The automatic resume is stored on the T3 Code server, so it continues across page reloads and is
available in the desktop client. The computer hosting that server must be awake and T3 Code must be
running for the resume to happen on time. If the server was offline, it restores the schedule when
it starts again. Select **Cancel auto-resume** to stop it. Sending a new message manually also
cancels the pending automatic resume.
