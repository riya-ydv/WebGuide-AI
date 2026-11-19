# WebGuide AI UI / UX contract

## Direction

Calm daily-use accessibility workspace: navy navigation, white task surfaces, teal primary actions. Audience: blind and low-vision users plus people who prefer spoken instructions. The primary job is to start voice assistance, give a goal, then interact with the current page. The previous oversized mascot/hero and repeated marketing text competed with this job; the refreshed interface uses a compact control rail and grouped navigation instead.

## Checkable layout

- Targets: 1440x900 desktop and 390x844 mobile; additionally 320 CSS px reflow.
- Desktop: grouped navigation retains all 11 sections and existing accessible names. Voice controls are one consistent region above task content; no decorative mascot. On non-home sections the persistent rail stays visible while More voice and AI options collapses the goal and settings; voice goals and pending confirmations reopen it. Screen-reader status stays outside the collapsed subtree. The page goal is a flat form, not a nested visual card.
- Mobile: native section selector, wrapped 44px controls, one-column forms and no horizontal overflow. No hover-only actions.
- Start voice guide remains the primary voice action. Listen is explicit, Stop remains visible. Microphone state and AI connection are separate text states; neither implies a completed website task.
- Advanced speech settings, typed commands and help retain their disclosure labels. No autoplay or automatic microphone capture. Skip links, focus indication and screen-reader status semantics remain.
- Home provides website companion, practice and saved-guide choices. Other sections have concise, specific headings rather than a second hero.

## State contract

| State      | Trigger                                        | Visible feedback and next action                                                   |
| ---------- | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| Loading    | Explicit guidance request                      | Looking-at-page status; Stop cancels pending request                               |
| Empty      | No guides/history or no connected backend      | Existing empty-state copy; connect or explore action                               |
| Error      | Missing service/invalid goal/denied microphone | Specific status and available text/keyboard fallback                               |
| Partial    | Unsupported page/context                       | Bounded insufficient-context answer, request fresh context                         |
| Success    | Returned guidance or saved profile             | Grounded instructions or saved feedback; no false external-task completion         |
| Permission | Explicit Listen or companion activation        | Browser permission boundary and privacy explanation; cancel/Stop remains available |

## Evidence boundaries

Rendered screenshots and automated audits verify layout/selected rules, not blind-user acceptance, speech-recognition accuracy, all website structures or the recipient's Mac. Guidance state behavior is tested separately from visual rendering. See final evidence report for observed versus untested states.
