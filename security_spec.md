# QureWays Trip CRM — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Default-Deny Catch-All**: All unspecified paths are denied (`allow read, write: if false;`).
2. **Verified Identity**: All writes require `isSignedIn() && request.auth.token.email_verified == true`.
3. **Path ID Hardening**: All document IDs (`userId`, `adminId`, `leadId`, `patientId`, `docId`, `reportId`, `opinionId`, `estimateId`, `bookingId`, `taskId`, `commId`, `hospitalId`, `logId`) must match `^[a-zA-Z0-9_\-]+$` and be `<= 128` chars on single-document operations (`get`, `create`, `update`, `delete`).
4. **Role Integrity & No Self-Privilege Escalation**: Users creating their `/users/{userId}` document cannot assign themselves `"CRM Administrator"` unless `isAdmin()` is true. Users cannot modify `uid` or `createdAt` on update.
5. **PII & Record Isolation**: Patient and Lead PII records can only be listed or read by the record owner (`resource.data.ownerId == request.auth.uid`) or an Admin (`isAdmin()`). No blanket `allow list: if isSignedIn();` is permitted.
6. **AI Report Draft Safety**: Newly created `/aiReports/{reportId}` records must have `ownerId == request.auth.uid`, valid bounded string sizes, and cannot bypass validation helpers on update.
7. **Immutable Audit Trail**: `/auditLogs/{logId}` documents can only be created with `actorUid == request.auth.uid` and can never be updated or deleted by standard users.
8. **Strict Key & Size Enforcement**: Every entity validation helper enforces `.keys().hasAll(...)`, `.keys().hasOnly(...)`, and explicit string `.size()` bounds matching `firebase-blueprint.json`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 (Privilege Escalation on User Profile Create)**: Authenticated non-admin creates `/users/u1` with `role: "CRM Administrator"`. -> `PERMISSION_DENIED`
2. **Payload 2 (Shadow Field Injection on Lead Create)**: Authenticated user creates `/leads/l1` with an undeclared field `isBypassed: true`. -> `PERMISSION_DENIED`
3. **Payload 3 (Owner Spoofing on Patient Create)**: Authenticated user `u1` creates `/patients/p1` with `ownerId: "u2"`. -> `PERMISSION_DENIED`
4. **Payload 4 (Unverified Email Write)**: User with `email_verified: false` attempts to create `/leads/l1`. -> `PERMISSION_DENIED`
5. **Payload 5 (ID Poisoning Attack)**: User attempts to create `/patients/invalid$id!@#` or >128 char ID. -> `PERMISSION_DENIED`
6. **Payload 6 (Value Poisoning on Update)**: User updates `/leads/l1` with a 10,000-character `patientName` exceeding `maxLength: 140`. -> `PERMISSION_DENIED`
7. **Payload 7 (Immutable Field Mutation)**: User updates `/patients/p1` and changes `ownerId` or `createdAt`. -> `PERMISSION_DENIED`
8. **Payload 8 (Cross-Tenant PII Read)**: User `u2` (non-admin) attempts `get` on `/patients/p1` where `ownerId == "u1"`. -> `PERMISSION_DENIED`
9. **Payload 9 (Unfiltered Collection List Scraping)**: Non-admin user attempts `list` on `/patients` without filtering `ownerId == request.auth.uid`. -> `PERMISSION_DENIED`
10. **Payload 10 (Audit Log Tampering)**: User attempts `update` or `delete` on `/auditLogs/log1`. -> `PERMISSION_DENIED`
11. **Payload 11 (Admin Collection Self-Insert)**: Non-admin user attempts `create` on `/admins/u1`. -> `PERMISSION_DENIED`
12. **Payload 12 (AI Report Update Without Validation Helper)**: User attempts to update `/aiReports/r1` with an unapproved field `injectedDiagnosis: "confirmed"`. -> `PERMISSION_DENIED`
