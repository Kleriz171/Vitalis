# Vitalis role expansion: audit and plan

Source: the "Vitalis master implementation prompt" (six roles, Vitalis Relay), 2026-11-02.
Work through the phases in order; tick items as they land. One phase per session, each with
its own e2e check in `scripts/e2e.sh` and screenshots before anything visual is committed.

## Decisions (defaults, change only if the user says so)

- **Look:** keep the current Vitalis design (green band headers, KPI cards, Panel/Row kit on the
  console; the phone app's list style). The user rejected an Apple-style restyle on 2026-11-02, so the
  prompt's "Apple" direction means polish within the existing look, not a new visual language.
  Roles differ by navigation, page composition and primary actions.
- **Operator vs admin:** split again. `eso` (operator) keeps dispatch, incidents, AEDs, drones,
  handover dispatch. New `admin` role (it was merged into `eso` on 2026-10-05) gets users and roles,
  verification, analytics, feedback, audit and system health. `normalizeRole` must stop mapping
  `admin` to `eso`; existing operator accounts stay `eso`, the seeded operator becomes `admin` too only if asked.
- **Hospital:** new `hospital` role; each account linked to one `Hospital` document. Uses the
  desktop console (its own navigation).
- **Clinician vs first responder:** doctor and nurse are clinicians (consultations) and may also go
  on duty as responders; `student_responder` is responder only. `blood_donor` leaves RESPONDER_ROLES.
- **Surfaces:** citizen, first responder, clinician on the phone app; hospital, operator, admin on
  the desktop console. Clinician also gets a console view later if needed (calendar works better wide).
- **External integrations:** SMS (Twilio) and push already have adapters; hospital delivery is internal
  (in-app acknowledgment). Anything without real credentials is labelled as such in the UI.

## Audit: what exists

| Role | Exists | Missing |
|---|---|---|
| Citizen | SOS (+countdown, silent/duress), one emergency contact (SMS tracking link on SOS), Bio Passport QR, check-in, fall detection, first aid, AED map, assistant, doctor directory (`Doctor` model, not users), `Appointment` model in HealthRecord | Several contacts with consent + delivery tracking (C1); emergency-visible vs private split, QR access log + revocation (C2); real booking against clinician schedules (C3) |
| First responder | Duty toggle (`available`), inbox, accept/en_route/on_scene/resolved, AED runner + cabinet code, handover read, re-dispatch, certificates | Statuses temporarily unavailable / responding (FR1); assistance in progress + handed over steps with transition rules (FR2); quick report (FR3); credentials screen (FR4); role shown in app (bug) and fresh role on app open (bug) |
| Clinician | doctor/nurse users, doctor applications approved in console | Working hours, consultation types/fees, bookings without overlaps, calendar, patient timeline with consent + audit, consultation summary (CL1-4) |
| Hospital | `Hospital` model (directory) | Role, accounts, incoming board, check-in, handover acknowledgment, capacity status (H1-4) |
| Operator | Console: live calls + map, KPIs, 60 s unanswered flag, re-dispatch, AEDs (battery, cabinet code, log), drones, call log (hash-chained ledger) | Full incident timeline view (OP1 partly exists as `timeline`), escalation acknowledge/actions log (OP2), AED maintenance tasks (OP3), handover dispatch to hospital (OP4), queues/filters (OP5) |
| Admin | Merged into operator: users, applications, reports, call log | Separate role and console, suspension, approval history, analytics additions, feedback (A3), audit view incl. medical access (A4), system health (A5) |

## Phases

1. **Permissions.** ✅ 2026-11-02. `admin` + `hospital` roles, `blood_donor` out of responders, server checks per
   route (`allow`), object-level checks, console navigation per role, phone app shows the role and
   refreshes the user on open. Check: roles-check extended.
   Landed: roles in `models/User.ts` (`RESPONDER_ROLES`, `STAFF_ROLES`, `User.hospital`); `authRequired` and
   the socket read the role from the DB per request/connection (`normalizeRole` and the start-up merge are gone);
   `POST /admin/staff` (eso/admin/hospital, hospital id required for hospital); `GET /hospital/me`;
   eso = live calls, AEDs, drones, call log, KPIs; admin = users, applications, revoke/remove-responder,
   analytics, call log; seed adds admin@ and hospital@ (SEED_ADMIN_PASSWORD / SEED_HOSPITAL_PASSWORD off this
   machine); console sections per role (CommandShell `roles`), Hospital page, staff form on Users; app shows
   the role on Profile and reloads the account on open/foreground. roles-check: 26-route role matrix and more.
2. **Emergency operations (Relay core).** ✅ 2026-11-02. Extend `Emergency` states (`assistance`, `handed_over`,
   `completed`) with an allowed-transition table and timestamps; responder statuses; quick report
   model; escalation acknowledge + action log. Check: relay-check (SOS → accept → states → report).
   Landed: `resolved` is "completed"; `STATUS_ORDER` forward-only (skips allowed), compare-and-set per change;
   `pausedUntil` (pause 15/30/60) and busy responders skipped by dispatch; `IncidentReport` (PUT/GET
   /emergencies/:id/report(s)); escalation sweep (ESCALATE_AFTER_MS, once per call) + ack + manual actions
   (`action_*` timeline entries with notes). Phone: pause control, six-step buttons, Quick report screen.
   Console: six-step progress, escalation acknowledge, "what you did by phone", notes, responder reports.
   Watches and /track map the new steps to "help is with you".
3. **Hospital.** ✅ 2026-11-02. Hospital accounts, incoming board, handover dispatch from operator, acknowledgment,
   check-in, capacity status. Check: hospital-check.
   Landed: `Hospital.capacity` (set by its staff, read by operators with the time; never auto-selects);
   `HospitalHandover` snapshot (patient essentials without contact, responders, reports, timeline) sent by
   operators to participating hospitals only, one open per call, live to the `hospital:<id>` room
   (`deliveredLive`), acknowledge / check-in (+ hospital record no.) / intake / duplicate (same person within a
   day) / withdraw, each on the call's timeline. Console: hospital Incoming board + capacity; operator "Hospital
   handover" in the call panel. ETA is not shown: there is no ambulance tracking to base it on.
4. **Citizen and clinician.** Emergency circle, QR visibility + access log, clinician schedule,
   types/fees (price copied onto booking), booking with overlap prevention (unique index + transaction),
   timeline with consent, summaries. Check: appointments-check.
   ✅ 4a booking (Booking model, 15-min `slots` + unique partial index {doctor, slots} for active bookings,
   Tirana time in utils/tirana.ts, /api/doctors/:id/slots|bookings, /api/bookings, /api/clinic; console
   Consultations calendar + Clinic settings for doctor/nurse; phone book/[id] + consultations).
   ✅ 4b record (consent per booking, 30 days, AccessLog kinds clinician_record/admin_record, /account/access-log,
   summary + follow-up + PDF). ✅ 4c circle (User.circle, ContactAlert, /api/circle, /emergencies/:id/alerts,
   phone circle screen + SOS status line). Checks: appointments-check, circle-check.
   ✅ 4d Medical QR: per-field `medicalId.share`, link token `/id/:token` (landing page + Render rewrite route,
   public GET /api/medical-id/:token logged as AccessLog 'qr_profile'), rotate = revoke, phone settings screen
   and "who viewed my records" (GET /account/access-log).
5. **Admin.** Suspension, approval history, analytics from real data, feedback, audit view, health page.
   ✅ 5a API: suspension (User.suspendedAt; currentRole/socket/issueTokens refuse), AdminAction log (staff created,
   removed, responder removed, suspended, restored, applications decided, certificates revoked), GET /admin/audit
   (?kind=access for AccessLog). admin-check in e2e.
   ⏳ 5a console UI: Suspend/Restore on UserDetail, "Suspended" chip on Users, Audit page (admin section).
   ⏳ 5b feedback (model, phone submit, admin triage page). ⏳ 5c platform analytics + system health page.
6. **Relay end to end.** One incident record through every role; permission boundaries test.
7. **Polish and QA** within the existing look; screenshots per role; full e2e.
