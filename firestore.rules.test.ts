/**
 * Phase 0 Firestore Security Rules Test Specification
 * Verifies that all 12 "Dirty Dozen" adversarial payloads return PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED' | 'ALLOWED';
}

export const dirtyDozenTests: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Privilege Escalation on User Profile Create',
    collection: '/users/user_regular_1',
    operation: 'create',
    auth: { uid: 'user_regular_1', email: 'staff@example.com', email_verified: true },
    payload: {
      uid: 'user_regular_1',
      email: 'staff@example.com',
      displayName: 'Staff User',
      role: 'CRM Administrator',
      active: true,
      createdAt: '2026-10-18T00:00:00Z',
      updatedAt: '2026-10-18T00:00:00Z'
    },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 2,
    name: 'Shadow Field Injection on Lead Create',
    collection: '/leads/lead_1',
    operation: 'create',
    auth: { uid: 'user_regular_1', email: 'staff@example.com', email_verified: true },
    payload: {
      leadCode: 'LD-101',
      patientName: 'Rahim Uddin',
      isBypassed: true
    },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 3,
    name: 'Owner Spoofing on Patient Create',
    collection: '/patients/pat_1',
    operation: 'create',
    auth: { uid: 'user_regular_1', email: 'staff@example.com', email_verified: true },
    payload: {
      patientCode: 'PT-101',
      fullName: 'Karim Ahmed',
      ownerId: 'other_user_999'
    },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 4,
    name: 'Unverified Email Write',
    collection: '/leads/lead_2',
    operation: 'create',
    auth: { uid: 'user_unverified', email: 'borhanctg@gmail.com', email_verified: false },
    payload: { leadCode: 'LD-102' },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 5,
    name: 'ID Poisoning Attack',
    collection: '/patients/invalid$id!@#',
    operation: 'create',
    auth: { uid: 'user_regular_1', email: 'staff@example.com', email_verified: true },
    payload: {},
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 6,
    name: 'Value Poisoning on Update (Oversized String)',
    collection: '/leads/lead_1',
    operation: 'update',
    auth: { uid: 'user_regular_1', email: 'staff@example.com', email_verified: true },
    payload: {
      patientName: 'A'.repeat(500)
    },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 7,
    name: 'Immutable Field Mutation on Patient Update',
    collection: '/patients/pat_1',
    operation: 'update',
    auth: { uid: 'user_regular_1', email: 'staff@example.com', email_verified: true },
    payload: {
      ownerId: 'hijacked_owner'
    },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 8,
    name: 'Cross-Tenant PII Read',
    collection: '/patients/pat_owned_by_u1',
    operation: 'get',
    auth: { uid: 'user_regular_2', email: 'other@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 9,
    name: 'Unfiltered Collection List Scraping',
    collection: '/patients',
    operation: 'list',
    auth: { uid: 'user_regular_2', email: 'other@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 10,
    name: 'Audit Log Tampering (Delete)',
    collection: '/auditLogs/log_1',
    operation: 'delete',
    auth: { uid: 'user_regular_1', email: 'staff@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 11,
    name: 'Admin Collection Self-Insert',
    collection: '/admins/user_regular_1',
    operation: 'create',
    auth: { uid: 'user_regular_1', email: 'staff@example.com', email_verified: true },
    payload: { uid: 'user_regular_1', email: 'staff@example.com', createdAt: '2026-10-18T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 12,
    name: 'AI Report Update With Undeclared Ghost Key',
    collection: '/aiReports/rep_1',
    operation: 'update',
    auth: { uid: 'user_regular_1', email: 'staff@example.com', email_verified: true },
    payload: { injectedDiagnosis: 'confirmed' },
    expectedResult: 'PERMISSION_DENIED'
  }
];
