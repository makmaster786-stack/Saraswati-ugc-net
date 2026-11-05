# Mobile browser verification — 29 September 2026

## Result

98 page/viewport combinations completed with no detected horizontal overflow or template/inline JavaScript errors. The phone menu opened and closed at every tested mobile/tablet width. Exam footer buttons stayed inside the viewport and passed center-point hit testing; long questions remained scrollable and the palette opened and closed.

Widths: 320, 360, 390, 430, 768, 844, and 1280 CSS pixels. Height: 844 pixels except landscape 844 x 390.

Pages: homepage, login, signup, dashboard, courses, course details, available tests, custom test, knowledge base, results, payments, about, contact, and exam.

Real exam scripts were additionally tested using touch input at 320, 390, and 844 pixels. All checks passed: select an answer, save and advance, open the palette, return to a saved answer, open submission confirmation, cancel submission, clear an answer, and mark for review.

## Fixes discovered during testing

- An empty toast layer intercepted navigation taps.
- Legacy navigation CSS forced desktop links into a tall phone header.
- Contact details, instructor content, and chart canvas overflowed narrow screens.
- Dashboard and custom-test headings needed clearance below the fixed header.
- A missing default avatar triggered repeated failed image requests.
- Duplicate exam palette handlers toggled the drawer twice, leaving its overlay open.
- Exam header controls needed larger touch targets and a second row on small phones.

## Method and limits

Headless installed Chrome, Playwright, real EJS templates and local styles/images. Layout checks use sample server data; page-specific API-driven scripts are isolated except the exam interaction run, which loads the actual exam scripts with simulated local API responses. No production accounts, database, payments, or exam submissions were used. Remote fonts/icons and third-party scripts were blocked, so screenshots show fallback fonts and missing remote icons. This does not verify Safari/iOS rendering, real-device keyboards or safe-area hardware, real backend persistence, or payment/login transactions. Changes are local and not deployed.

## Local evidence

- report.json: all 98 layout cases
- functional-report.json: exam interaction results
- *-390.png: screenshots of all 14 pages
- exam-functional-*.png: actual exam-script screenshots
- check.cjs: local browser harness (uses machine-specific Playwright path)

The .mobile-test directory is ignored by Git and contains only local testing tools and evidence.
