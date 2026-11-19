# Assistive-technology acceptance

Use a disposable practice page and ordinary sample text. Do not dictate passwords or payment details. These are the remaining human checks; automated ARIA tests alone cannot certify blind usability.

## Windows Narrator or Mac VoiceOver

1. Open WebGuide in desktop Chrome or Edge. Start Narrator with Control+Windows+Enter, or VoiceOver with Command+F5.
2. Press Tab at the start of the page. Confirm “Skip to voice controls” is announced. Enter should reach “Start voice guide”.
3. Choose “Use my screen reader”. Confirm WebGuide does not speak over the screen reader. Tab through Listen, Stop, Read page, Next and Back; each must have a clear name.
4. Choose Read page before granting page access. Confirm the permission explanation is announced and no page description is given.
5. Check “Allow page reading and navigation in this section”. Choose Next. Confirm the target name and current position are understandable. Confirm keyboard focus follows navigation.
6. Press Escape. Confirm microphone off, page access revoked and no delayed/repeated speech. Navigate to another section and confirm page access must be granted again.
7. On the practice form, enter sample text and request an action. Confirm the action is explained and can be cancelled before execution. Confirm completion is based on the visible result.

Record the screen reader/version, browser/version, exact action, announced words, delay and pass/fail. Do not record private page contents.

## Real microphone command

1. Turn off the separate screen reader for this short test if it interferes with recognition. Choose Start voice guide; confirm clear output.
2. Choose Listen and allow the browser microphone prompt. When Listening is shown, say “open profile”. Confirm Profile actually opens, not merely that a transcript appears.
3. Choose Listen again, then press Escape while it is listening. Wait a few seconds. Confirm it does not restart or repeat a previous command.
4. Test a denied microphone permission: the app must explain recovery and typed commands must remain usable.

The speech recognition API uses the system/browser default input and may depend on an online browser service. Device capture checks do not prove speech recognition or audio quality. Local AI model availability is a separate check.

## Outcome

Report each task separately as passed, failed or not tested. A successful introduction, an automated test score, or a single user session does not prove every website is accessible. Repeat the relevant tasks with the intended user's own browser, assistive technology and preferred language before relying on it independently.
