# Project TODO

## Core Infrastructure
- [x] Database schema design (patients, assessments, test results, screenshots, annotations, metrics standards)
- [x] Server-side tRPC routers for all entities
- [x] Global app layout with sidebar navigation
- [x] Design system and theming (medical/professional style)

## Patient Management
- [x] Patient list page with search and filtering
- [x] Create/edit patient profile form (name, DOB, gender, height, weight, contact)
- [x] Patient detail page with assessment history

## Subjective Assessment
- [x] Runner background form (training frequency, goals, experience)
- [x] Running routine capture (weekly mileage, pace, terrain)
- [x] Injury history list with add/edit/delete
- [x] Concerns/complaints input

## Test Results - InBody
- [x] InBody data entry form (body composition, muscle-fat analysis, obesity analysis)
- [x] Segmental lean/fat analysis input
- [x] InBody score and weight control data
- [x] Research parameters input

## Test Results - VO2 Master
- [x] VO2 Master data entry form (VO2max, heart rate, speed, ventilation)
- [x] Ventilatory thresholds (VT1, VT2) input
- [x] Training zones data entry
- [x] VO2max comparison percentile

## Video Analysis
- [x] Video upload for side view and back view
- [x] Video player with frame-by-frame navigation
- [x] Screenshot capture at key gait phases (foot strike, loading, push off)
- [x] Screenshot gallery with phase labels and timestamps

## Line Drawing & Annotation
- [x] Interactive canvas overlay on screenshots
- [x] Line drawing tool with angle measurement
- [x] Circle/highlight annotation tool
- [x] Manual adjustment of drawn lines and annotations
- [x] Color-coded lines for different measurements
- [x] Angle display on canvas

## Metrics Standards Editor
- [x] Configurable metrics with ranges (need improvement, acceptable, excellent)
- [x] Default gold standard values for all running metrics
- [x] Easy adjustment interface for physio to modify standards
- [x] Metrics: knee angle, tibial angle, trunk lean, step width, heel strike, hip angle, rearfoot inversion

## Clinical Notes & AI Report
- [x] Clinical notes text boxes for physio input (background, impressions, management)
- [x] AI summarization of all assessment data into coherent report
- [x] Editable AI-generated report sections
- [x] Report preview

## PDF Export
- [x] Cover page generation with clinic branding
- [x] Test results pages (InBody summary, VO2 summary)
- [x] Annotated screenshot pages (side view, back view)
- [x] Background and impressions pages
- [x] Management recommendations page
- [x] Full PDF download

## InBody/VO2 File Upload Refactor
- [x] Replace manual InBody form with PDF file upload
- [x] Replace manual VO2 Master form with PDF file upload
- [x] Add file upload fields to assessment schema (inbodyFileUrl, vo2FileUrl)
- [x] Store uploaded PDFs in S3
- [x] Display uploaded file with view/remove in assessment editor
- [x] Include uploaded PDFs in AI report generation context
- [x] Include uploaded PDFs in final PDF export
- [x] Update tests for new file upload flow (all 21 tests pass)

## Video Analysis Improvements
- [x] Finer frame-by-frame control (smaller step increments for precise frame selection)
- [x] Video alignment tool (horizontal/vertical alignment across all three views)
- [x] Fix screenshot not showing in annotation editor canvas
- [x] Add grid line overlay option on annotation canvas for easier line placement

## Editable Report Text
- [x] Make AI-generated report text editable before PDF export
- [x] Add edit/preview toggle for each report section

## Metrics Rating & Annotation Tools Enhancement
- [x] Review and ensure all biomechanical metrics have corresponding annotation tools
- [x] Add metric type selector to annotations (link measurement to specific metric like knee angle, tibial angle, etc.)
- [x] Auto-compare annotation measurements against metrics standards
- [x] Generate rating table (needs improvement / acceptable / excellent) in report
- [x] Add rating table to ReportPreview display
- [x] Add rating table to PDF export
- [x] Update AI report generation to reference metric ratings

## Auto Pose Detection & Line Drawing
- [x] Build server-side pose analysis endpoint using LLM vision API
- [x] Define metric-to-landmark mappings per view type and gait phase
- [x] Auto-detect body landmarks (joints, segments) from screenshot image
- [x] Auto-draw biomechanical measurement lines based on detected landmarks
- [x] Auto-calculate angles and assign metric types to annotations
- [x] Integrate auto-detection into screenshot capture workflow (trigger on capture)
- [x] Allow physio to review and adjust auto-detected lines
- [x] Handle detection confidence and fallback for unclear images

## AI Tracking & Annotation UX Fixes
- [x] Improve AI pose analysis prompt for better landmark accuracy
- [x] Phase-specific metrics only (initial contact → tibial angle, trunk lean, overstride; loading → knee flexion, trunk lean; push off → hip extension, trunk lean)
- [x] Fix live angle/degree recalculation when dragging annotation points
- [x] Add horizontal/vertical reference guide lines when dragging points for alignment
- [x] Increase grid line visibility (less transparent)
- [x] Redesign annotation editor to landscape/horizontal layout (tools beside image, not below)
- [ ] AI learning from user adjustments to improve future detections (future enhancement)

## Annotation Editor UX - Size & Alignment Feedback
- [x] Make annotation editor dialog much bigger (near full-screen) so screenshot is large enough to draw on
- [x] Prevent tool panel from overlapping the screenshot
- [x] Change reference line color when annotation aligns to vertical or horizontal (snap feedback)

## Annotation Editor - True Full-Screen Landscape
- [x] Make annotation dialog truly full-screen (full viewport width AND height)
- [x] Ensure landscape layout with image taking maximum space, tools in narrow sidebar

## Metrics Update from Spreadsheet
- [x] Parse uploaded AI_Ready_Objective_Running_Video_Assessment.xlsx
- [x] Replace default metrics with spreadsheet data (S1-S4 side view, B1-B5 back view)
- [x] Update AI pose analysis prompt with detailed anatomical landmark definitions from spreadsheet
- [x] Update phase-metric mappings to match spreadsheet structure
- [x] Add Reset to Defaults button on Metrics Standards page for reseeding

## Left vs Right Side Comparison
- [x] Add left/right side labeling to video uploads and screenshots
- [x] Build side-by-side comparison view for left and right side screenshots at same gait phase (L/R Compare tab)
- [x] AI-powered asymmetry analysis comparing left vs right metrics
- [x] Asymmetry percentage calculation for each metric (with Symmetric/Mild/Moderate/Significant ratings)
- [x] Add asymmetry comparison section to report preview
- [x] Add asymmetry comparison section to PDF export
- [x] Highlight significant asymmetries in the report (color-coded badges and AI narrative)

## VALD Dynamo Handheld Dynamometer Test
- [x] Add dynamo test results table to database schema (joint, movement, left/right values, unit)
- [x] Add server routes for CRUD operations on dynamo test data
- [x] Build VALD Dynamo data entry UI with joint/movement selection (hip, knee, ankle, etc.)
- [x] Support multiple movement types per joint (flexion, extension, abduction, adduction, rotation)
- [x] Left vs right comparison for each measurement
- [x] Add dynamo tab to assessment editor
- [x] Include dynamo data in AI report generation
- [x] Include dynamo data in PDF export
- [x] Auto-calculate left/right asymmetry percentage for strength measurements

## Dynamo Test - Additional Measurement Fields
- [x] Add Peak Force (left/right) fields to dynamo test
- [x] Add Peak RFD (Rate of Force Development, left/right) fields to dynamo test
- [x] Add Time to Peak Force (left/right) fields to dynamo test
- [x] Update database schema with new columns
- [x] Update server routes for new fields
- [x] Update DynamoTests UI component with new input fields
- [x] Update report preview and PDF export with new fields
- [x] Update AI report prompt to include Peak Force, Peak RFD, and Time to Peak Force

## Branding & Design Overhaul
- [x] Convert and analyze company logo files (.ai format)
- [x] Upload logos to S3 for use in app and reports
- [x] Redesign app theme: high-tech, performance-oriented, warm and engaging
- [x] Update app color palette based on brand colors
- [x] Add logo to app navigation/header
- [x] Redesign PDF report with logo, brand colors, and professional layout
- [x] Make data sections feel high-tech/objective, clinical sections feel warm/human

## 12-Metric Running Video Assessment Overhaul
- [x] Replace all existing metrics with 12 new standardized metrics (M01-M12)
- [x] Update database seed defaults with new metric definitions (Low/Optimal/High ranges)
- [x] Add load shift fields (lowLoadShift, highLoadShift) to metrics schema
- [x] Add linesToDraw and whatToMeasure fields to metrics schema
- [x] Update Metrics Standards UI to show new format (one metric per row, Low/Optimal/High)
- [x] Update AI pose analysis prompt with new metric definitions and landmarks
- [x] Update annotation metric type selector with new 12 metrics
- [x] Update report generation to use Low/Optimal/High rating scale
- [x] Update ReportPreview and PDF export with new metrics table format
- [x] Update phase-metric mappings for video analysis
- [x] Run tests and verify all changes work end-to-end (29 tests pass)

## Annotation Editor - Metric Selector & Drawing Hints
- [x] Update metric type selector dropdown to use new M01-M12 metrics
- [x] Update angle rating display to use Low/Optimal/High scale (not Needs Improvement/Acceptable/Excellent)
- [x] Show phase-specific metric hints (which metrics to find in each gait phase)
- [x] Add drawing instruction tooltips on hover (what to measure, which lines to draw)
- [x] Run tests and verify changes (29 tests pass)

## Practitioner Contact Details
- [x] Add practitioner profile table to database schema (name, clinic, phone, email, qualifications)
- [x] Add server routes for practitioner CRUD
- [x] Build practitioner settings page in sidebar
- [x] Display practitioner details on PDF report footer/header
- [x] Support multiple practitioners per company

## Mid-Stance Gait Phase Option
- [x] Add mid_stance to gaitPhase enum in screenshots schema
- [x] Update screenshot capture UI phase selector with Mid-Stance option
- [x] Update phase-metric mapping for mid_stance

## Report Aesthetic Overhaul
- [x] Add radar/spider chart showing all 12 metrics vs optimal ranges
- [x] Fix logo visibility in PDF report (convert to base64 data URI)
- [x] Fix screenshot visibility in PDF report (convert to base64 data URI)
- [x] Match report aesthetic style with brand logo (organic curves, warm tones)
- [x] Improve overall report professional appearance

## iPad-Friendly Annotation Editor
- [x] Increase touch target sizes for iPad (buttons, points, tools)
- [x] Responsive layout for tablet screen sizes (stacks vertically on narrow/portrait)
- [x] Larger drag handles on annotation points (7px normal, 10px dragging)
- [x] Larger touch detection threshold (25px)
- [x] Collapsible panel toggle on narrow screens
- [x] touch-manipulation CSS on all interactive elements
- [x] touchAction: none on canvas to prevent scroll interference
- [x] All 35 tests pass

## Bug Fixes
- [x] Fix: Unable to click/tap on screenshot to open annotation editor on iPad (hover-dependent buttons invisible on touch)
- [x] Show both inner and outer angle on annotations, let user pick which is correct
- [x] Fix TS error: add useOuterAngle to annotation schema and tRPC input
- [x] Show both inner and outer angle on canvas with toggle to pick correct one
- [x] Change M01 Overstride from degree-based to category picker (Understride/Optimal/Mild Overstride/Overstride)
- [x] Pair M01 Overstride assessment with cadence data for proper judgment
- [x] M01 shown as category-based in annotation editor, report preview, and PDF export
- [x] Bug: M01 Overstride broken in annotation editor — skip numeric rating for category-based metrics, show "visual ref only" label
- [x] Bug: No delete screenshot button visible on iPad — removed hover-dependent visibility, buttons always visible
- [x] Bug: Annotation editor instant rating — fixed: shows optimal range, only rates when metric standards loaded, better swap button
- [x] Don't auto-open annotation editor after screenshot capture — removed, shows toast instead
- [x] AI pose tracking runs in background (non-blocking) — fire-and-forget with per-screenshot spinner overlay and badge counter
- [x] User can capture all phases first — capture button never blocked by AI, review screenshots anytime
- [x] Bug: Unicode escape chars fixed — ° ⇄ → now render correctly as symbols
- [x] Add M01 Overstride category picker directly in annotation editor sidebar under IC phase with cadence input
- [x] Make annotation markers smaller and semi-transparent (3px normal, 4px selected, 6px dragging, 50-70% opacity)
- [x] Make annotation lines semi-transparent (70% normal, 90% selected) so anatomy visible underneath
- [x] Reduce angle arc sizes (inner 16px, outer 26px) and font sizes for less visual clutter
- [x] M01 category picker confirmed in sidebar only, updated label text to reference picker above
- [x] Add 180° angle calculation option (supplement angle) — blue button shows |180° - inner| with rating
- [x] Make annotation editor sidebar fully scrollable with sticky Cancel/Save buttons at bottom
- [x] Merge Mid-Stance and Loading into single "Loading" phase across all components
- [x] Update annotation editor phase hints to combine mid_stance metrics into loading
- [x] Update video capture phase selector to remove mid_stance option
- [x] Update side comparison phase selector
- [x] Update report preview phase labels
- [x] Update server routers metric-phase mappings and default metric definitions (M05-M10 phase = Loading)
- [x] All 35 tests pass after merge
- [x] Bug: Unable to switch to 180° angle in annotation editor — replaced boolean useOuterAngle with proper angleMode ('inner'|'outer'|'supplement') state, updated drag recalculation to respect mode, added 3-button mode switcher with active state highlighting, updated canvas rendering for all modes, angleMode persisted to DB

## Back View Leg Identification & Full L/R Comparison
- [x] Add left/right leg selector for back view screenshots (identify which leg is being analyzed)
- [x] Update screenshot schema/data to store leg side (left/right) for back view
- [x] Show leg side label on screenshot cards and annotation editor
- [x] Update L/R comparison summary table to include all 12 metrics (M01-M12) across both side and back views
- [x] Ensure comparison table shows metrics from both views, not just one
- [x] Update report preview with full 12-metric comparison table (grouped by Side View / Back View)
- [x] Update PDF export with full 12-metric comparison table (grouped by Side View / Back View)

## M12 Push-Off Alignment — Category Picker
- [x] Convert M12 from degree-based metric to category picker (like M01 Overstride)
- [x] Categories: Lateral Push Off, Balanced, Medial Push Off
- [x] Update server default metric definition for M12 (measureType = category)
- [x] Update annotation editor to show category picker for M12 (not angle tool)
- [x] Update report preview and PDF export to display M12 as category (CAT badge)
- [x] SideComparison / asymmetry: category metrics show as Incomplete (no numeric L/R to compare)
- [x] Update AI report prompt to reference M12 categories
- [x] All 40 tests pass

## Delete M10 & M11, Fix L/R Comparison, Back View Foot Labels
- [x] Delete M10 (Trunk Rotation Asym) from default metrics
- [x] Delete M11 (Hip Rotation Mid-Swing) from default metrics
- [x] Remove M10/M11 from getMetricsForView back view definitions
- [x] Update metric sort orders after removal (M12 becomes M10)
- [x] Update all M12 references to M10 across codebase (routers, AnnotationCanvas, ReportPreview, SideComparison, MetricsStandards, tests)
- [x] Fix L/R comparison page — updated metric range labels from M06–M12 to M06–M10
- [x] Add L/R foot labeling buttons in back view annotation editor (blue L / red R circle labels, toolbar buttons, tap-to-place mode)
- [x] All 40 tests pass

## Remove L/R Comparison Tab & Back View Leg Labels
- [x] Remove L/R Compare tab from assessment editor
- [x] Remove SideComparison import and tab content
- [x] Verified report preview still includes L/R asymmetry summary table (server-side buildAsymmetryComparison)
- [x] Verified PDF export still includes L/R asymmetry summary table
- [x] Cleaned up unused imports
- [x] Improved back view screenshot cards with color-coded L/R badges (blue for Left, red for Right)
- [x] Grouped back view screenshots by leg side (Left Leg / Right Leg / Untagged) in Video Analysis section
- [x] Extracted renderScreenshotCard helper for DRY screenshot card rendering
- [x] All 40 tests pass

## Bug: Unable to tag back view screenshot as Left or Right
- [x] Investigated: capture-time tagging works, but no way to tag/re-tag existing screenshots after capture
- [x] Added L/R toggle buttons directly on back view screenshot cards (blue L / red R) — tap to tag, tap again to untag
- [x] Buttons work via updateScreenshot mutation with legSide field
- [x] All 40 tests pass

## Report Improvements
- [x] Display VO2master PDF inline in the report (iframe viewer, 600px height, with fallback link)
- [x] Fix report to reference 10 metrics instead of 12 (both in-app and PDF export)
- [x] Fix bug where raw code appears in the report (updated AI prompt to output plain text only, no markdown/code blocks)
- [x] Add metrics summary horizontal bar chart with optimal zone overlay and color-coded ratings
- [x] Add L vs R butterfly comparison chart (left=blue, right=amber, center-aligned bars with asymmetry badges)
- [x] Charts appear in both in-app preview and PDF export
- [x] All 40 tests pass

## Report & Annotation Editor Fixes (Round 2)
- [x] Charts use reactive displayReport — update when report is regenerated
- [x] Use AnnotatedScreenshot component in report — renders annotations on canvas overlay, shows full body (3:4 aspect, object-contain)
- [x] Replaced Streamdown with PlainText renderer — no more markdown/code blocks in report
- [x] Removed CAT badge from both in-app and PDF metrics tables
- [x] Annotation editor: only draws selected mode's arc and value with dark background pill for readability
- [x] PDF export screenshots also use object-contain with max-height for full body display
- [x] All 40 tests pass

## Report: Asymmetry & Metrics Table Updates
- [x] Remove "Assessment" column from L/R asymmetry tables (both in-app and PDF) — replaced with color-coded % Diff
- [x] Add Left (blue) and Right (amber) value columns to the 10-metric table (both in-app and PDF)
- [x] Redesign radar chart: grouped into 5 ability categories (Shock Absorption, Stability, Propulsion, Alignment, Efficiency) with 0-100 scores
- [x] Updated both in-app preview and PDF export for all changes
- [x] L/R values populated server-side from asymmetryData into metricsRatings
- [x] All 40 tests pass

## PDF Report Fixes (Round 3)
- [x] Screenshots in PDF report now use annotated versions (renderAnnotatedScreenshotBase64 draws annotations on canvas)
- [x] VO2 Master report: in-app iframe enlarged to 800px/60vh with FitH view; PDF export shows prominent link card
- [x] Fixed radar chart label newline bug (was using escaped \n string instead of actual newlines)
- [x] Radar chart scoring: 5 ability categories scored 0-100 based on metric ratings (Optimal=100, High/Low=50, extreme=20)
- [x] L/R values populated server-side from asymmetryData — need to regenerate report to see them
- [x] Removed metrics summary bar chart from both in-app and PDF export
- [x] Replaced misleading % difference with absolute difference in degrees (Δ) for asymmetry
- [x] Symmetry rating: ≤2° = Symmetric (green), ≤5° = Minor (amber), >5° = Notable (red)
- [x] Updated both in-app and PDF asymmetry tables with new Diff (°) and Symmetry columns
- [x] All 40 tests pass

## Report Fixes (Round 4) — VO2 Inline, Radar Labels, Scoring Config
- [x] VO2 PDF: render pages as images directly in the report (not as link/iframe)
- [x] Radar chart: fix label overlap — scores overlapping with category names (visible in screenshot)
- [x] Radar chart: improve label positioning and spacing
- [x] Add scoring/ability grouping configuration to Metrics Standards page
- [x] Make scoring logic configurable for future metrics additions
- [x] InBody PDF: also render pages as images directly in the report (same as VO2)
- [x] Ability groups stored in database (abilityGroups table) with CRUD operations
- [x] Ability groups seeding/reset to defaults (5 groups: Shock Absorption, Stability, Propulsion, Alignment, Efficiency)
- [x] Metrics Standards page: new "Scoring & Grouping" tab with ability group management
- [x] Scoring logic explanation card in Metrics Standards page
- [x] Metric-to-group assignment overview matrix table
- [x] Radar chart uses configurable ability groups from database (falls back to defaults)
- [x] All 47 tests pass

## Bug: VO2 PDF not rendering in report
- [x] Fix VO2 PDF pages not rendering inline in the report preview (added server-side PDF proxy)
- [x] Ensure PDF-to-image rendering works for both in-app preview and PDF export

## Bug: PDF Export stuck on VO2 rendering + Report Redesign
- [x] Fix PDF export hanging when VO2 PDF rendering takes too long (add timeout/fallback)
- [x] Fix VO2 inline rendering still stuck on published site (proxy may not work in production)
- [x] Make company logo bigger in the PDF report
- [x] Redesign entire PDF report — cleaner, cooler, modern layout
- [x] Use brand colors from company logo throughout the report
- [x] Improve overall report visual hierarchy and typography

## Bug: PDF Export Not Working + Simplify
- [x] Fix PDF export — currently fails/doesn't show the PDF (server-side pdftoppm conversion via tRPC endpoint)
- [x] Remove all external links from PDF — everything must be self-contained
- [x] Embed VO2/InBody PDF pages as images directly in the exported PDF
- [x] Embed all screenshots as base64 images
- [x] Simplify the export approach — server-side PDF-to-image conversion, no browser-side pdfjs needed

## Bug: PDF Export Screenshots Missing Annotations
- [x] Fix PDF export screenshots to include drawn lines, angles, and annotations overlay (server-side rendering)
- [x] Ensure annotated screenshots render correctly in both in-app preview and PDF export

## True Single Merged PDF Report
- [x] Build server-side PDF generation endpoint that creates a single .pdf file (puppeteer-core + pdf-lib)
- [x] Merge VO2 Master PDF pages into the generated report PDF
- [x] Merge InBody PDF pages into the generated report PDF
- [x] Render annotated screenshots server-side (fix CORS tainted canvas issue)
- [x] Include all report sections: cover, background, test results, running analysis, management, summary
- [x] Frontend downloads the merged PDF directly (no popup window)
- [x] No external links in the PDF — everything self-contained

## Bug: PDF Export fails in production — Chromium not found
- [x] Fix Chromium not found at /usr/bin/chromium-browser in deployed environment (switched to @sparticuz/chromium)
- [x] Either bundle Chromium or replace puppeteer with a Chromium-free PDF generation approach (@sparticuz/chromium bundles minimal Chrome)

## Bug: PDF Export fails — missing shared libraries for Chromium in production
- [x] Replace Puppeteer/Chromium with pure JS PDF generation (jsPDF — zero system dependencies)
- [x] Use jsPDF for report PDF generation
- [x] Keep pdf-lib for merging VO2/InBody PDFs
- [x] Keep sharp for server-side screenshot annotation rendering

## Simplify PDF Export
- [x] Remove VO2/InBody PDF merging from export — only export the running analysis report
- [x] Remove VO2/InBody links/display from the report preview and PDF
- [x] Remove pdf-lib dependency (no longer needed)
- [x] Fix the PDF export error in production (removed Chromium dependency, using jsPDF)
- [x] Keep VO2/InBody upload functionality for AI report generation

## Bug: PDF Export still failing on published site
- [x] Investigate and fix the current PDF export error (reverted to pure client-side HTML print approach)
- [x] Reverted to client-side HTML print approach — removed jsPDF, sharp, puppeteer, pdf-lib from server

## Bug: Report screenshots missing annotations + Report text edits not saving
- [x] Fix: Report preview/PDF shows raw screenshots without drawn annotations (lines/angles) — fetch images as blob to avoid CORS tainted canvas
- [x] Fix: Report text edits don't save changes — sync reportJson from server to parent formData after invalidation
- [x] Fix: PDF export still shows raw screenshots without annotation lines/angles drawn on them — refactored to shared drawAnnotationsOnCanvas function, fixed blob URL loading (removed crossOrigin for blob URLs), proper error handling
- [x] Bug: PDF export annotations STILL not rendering - FIXED with SVG overlay approach (no canvas/CORS needed)
- [x] Bug: PDF export shows duplicate screenshots - NOT a bug, left/right leg screenshots are separate entries
- [x] Bug: PDF export images get cut off at page boundaries - FIXED with ss-row pairs and page-break-inside:avoid
- [x] Bug: PDF cover page overflows to blank page 2 - FIXED with height:100vh and overflow:hidden
- [x] Add "How to Use This Report" intro section after cover page with provided paragraph
- [x] Add management disclaimer paragraph at the start of Management section on a new page
- [x] Fix: Annotation degree labels too small and unclear in PDF export — increased SVG font-size from 2.5% to 4.5%, larger background rect, thicker strokes
- [x] Fix: Cover page still cutting to two pages — changed to calc(100vh - 32mm) with border-radius and padding
- [x] Fix: Overall report aesthetics — improved CSS organization, max-height on screenshots, tighter spacing, better section borders

## PDF Report Fixes (Round 5)
- [x] Fix: SVG annotation lines misaligned after export — removed object-fit:contain and black bg so SVG overlay matches image 1:1
- [x] Remove footer with website URL and creation timestamp — added toast reminder to uncheck 'Headers and footers' in print dialog
- [x] Ensure cover page fits exactly one page — height:100vh with overflow:hidden
- [x] Add page break before 10-Metric Running Assessment table
- [x] Add page break before Impression from Testing section
- [x] Add page break before Key Findings section

## PDF Report Fixes (Round 6)
- [x] Make angle degree labels WAY bigger and more obvious in PDF report screenshots — 7% font, 18x9% label box, 1.2% stroke with white outline, large points

## PDF Report Fixes (Round 7)
- [x] Fix: Wrong angle values in PDF - now uses ann.measuredValue directly from DB instead of recalculating
- [x] Fix: Label box too big but font too small - resized to 14x7% with 5.5% font, color-coded border
- [x] Fix: Label box overlaps annotation lines - smart positioning using bisector offset away from lines, clamped to viewBox

## PDF Report Fixes (Round 8)
- [x] Thinner annotation lines in PDF — 0.4% stroke width (was 1.0%)
- [x] Remove label box, show angle as plain bold text next to lines with bigger font — 7% bold text with white stroke outline, positioned along bisector

## PDF Report Fixes (Round 9)
- [x] Remove white outline from annotation lines and font
- [x] Increase angle font size to 15%
- [x] Add practitioner selector in subjective section of report
- [x] Add practitioner contact details to last page of PDF as sign-off/regards

## PDF Report Fixes (Round 10)
- [x] Increase angle font size to 20% and ensure number doesn't overlap with annotation lines — offset distance increased to 14
- [x] Show each metric's score weight within ability group settings and allow adjustment per metric — added metricWeights field, slider+input UI, weighted average in radar chart

## PDF Report Fixes (Round 11)
- [x] Fix: Angle degree labels overlap with annotation lines — repositioned along bisector with 22-unit offset, auto-flip if out of bounds

## PDF Report Fixes (Round 12)
- [x] Simplify angle label offset: 10 units left, 10 units up from vertex

## Changes (Round 13)
- [x] Management section in PDF uses bullet points instead of paragraphs
- [x] Change "Optimal" label to "Reference Target" throughout the app
- [x] Add Assessment Conditions fields: Speed, Incline, Footwear, Recording
- [x] Key findings should use biomechanical chain-reasoning with arrows (e.g., Long overstride → Hip flexion moment ↑ → Hamstring eccentric braking ↑)
- [x] Add brief explanation of the radar chart (Performance Profile) in the PDF report
- [x] Add follow-up reassessment date picker in management section (x months after assessment date)

## Fixes (Round 14)
- [x] Remove L/R symmetry description paragraph from report (keep table only)
- [x] Remove assessment conditions from AI background prompt (keep in PDF as separate section)
- [x] Fix chain-reasoning key findings — each finding should be one concise chain to one specific consequence, not all expanding to same redundant reasoning

## Report Aesthetic Redesign (Round 15) — Elite Sports Institute Style
- [x] Global design system: navy #1E3A5F primary, orange accent (risk), green accent (optimal), warm grey #F6F8FA background
- [x] Typography: Inter Semi Bold headings, Source Sans Pro body, Roboto Mono numbers
- [x] Cover page: left-anchored hierarchy, logo top-left, large title, patient info side card, diagonal stripe bottom
- [x] Page header/footer system: thin blue line, TOTAL HEALTH left, report name right, page number + client name + Confidential footer
- [x] Section title style: large blue heading with 1px line and orange accent dot
- [x] Photo analysis page: two-image grid, white bg, rounded corners, drop shadow, grey caption box
- [x] Metrics table: dark blue header, white text, badge ratings (green Optimal, orange Monitor, red High), load implication column
- [x] Performance Profile (radar): blue athlete shape, green target zone, orange risk highlights, scoring explanation
- [x] Asymmetry page: two-column L vs R, big numbers, large spacing
- [x] Key findings: card-based layout (not paragraphs), short explanation + metrics + injury relation
- [x] Management plan: divided sections with icons, bullet simple, screenshot-friendly
- [x] Summary page: half page, professional tone, diagnosis + contributing factors + management direction
- [x] Micro details: 8px rounded corners, minimal shadows, outline icons, 24px image spacing, 36px section spacing
- [x] A4 portrait printable layout with generous white space

## PDF Layout Fixes (Round 16)
- [x] Running analysis screenshots: pair L and R side-by-side on same page per phase for easier comparison
- [x] Cover page: fix to fit on single A4 page (currently overflows to 2 pages)
- [x] Page breaks and A4 margins: fix section separation so content doesn't split awkwardly across pages
