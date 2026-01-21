# Smart Bin - API Endpoints Documentation

## Overview

This document provides a complete reference for all Smart Bin API endpoints.

| Category | Count | Description |
|----------|-------|-------------|
| Authentication | 3 | OTP request, verify, token refresh |
| Collector | 10 | Mobile app endpoints |
| Household | 9 | PWA endpoints |
| Dashboard | 17 | Admin/Supervisor web dashboard |
| **Total** | **39** | |

---

## Authentication Endpoints

### Request OTP
```http
POST /api/auth/request-otp
```

**Request:**
```json
{
  "phone": "+919876543210",
  "userType": "collector" | "household" | "dashboard"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "OTP sent successfully",
    "expiresAt": "2026-01-21T12:35:00Z"
  }
}
```

---

### Verify OTP
```http
POST /api/auth/verify-otp
```

**Request:**
```json
{
  "phone": "+919876543210",
  "code": "123456",
  "userType": "collector"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "collector": {
      "id": 1,
      "name": "Ravi Kumar",
      "phone": "+919876543210"
    }
  }
}
```

---

### Refresh Token
```http
POST /api/auth/refresh
```

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

---

## Collector Endpoints

> **Auth Required:** All endpoints require `Authorization: Bearer <token>` header with COLLECTOR role.

### Get Profile
```http
GET /api/collector/profile
```

**Response:** Collector details with unit count.

---

### Resolve QR Code
```http
POST /api/collector/qr/resolve
```

**Request:**
```json
{
  "qrToken": "abc123def456...",
  "latitude": 17.4239,
  "longitude": 78.4738
}
```

**Response:** QR status + unit details (if active) or registration prompt (if unassigned).

---

### Register Unit
```http
POST /api/collector/unit/register
```

**Request:**
```json
{
  "qrToken": "abc123def456...",
  "unitNumber": "H-101",
  "householdPhone": "+919876543210"
}
```

**Response:** Created unit details.

---

### Mark Collection
```http
POST /api/collector/collection/mark
```

**Request:**
```json
{
  "unitId": 10,
  "latitude": 17.4239,
  "longitude": 78.4738
}
```

**Response:** Collection confirmation.

---

### Get Today's Route
```http
GET /api/collector/route
```

**Response:** List of assigned units with today's collection status.

---

### Get Stats
```http
GET /api/collector/stats
```

**Response:** Today's collection statistics (total, collected, remaining, percentage).

---

### Get Pending Payments
```http
GET /api/collector/payments/pending
```

**Response:** List of payment claims awaiting verification.

---

### Verify Payment
```http
POST /api/collector/payment/verify
```

**Request:**
```json
{
  "paymentId": 5,
  "action": "CONFIRM" | "REJECT",
  "rejectionReason": "No payment received" // Required if REJECT
}
```

---

### Create Complaint
```http
POST /api/collector/complaint/create
```

**Request:**
```json
{
  "unitId": 10,
  "complaintType": "NON_PAYMENT" | "REPEATED_DEFAULTER" | "OTHER",
  "description": "Details..."
}
```

---

### Sync Offline Data
```http
POST /api/collector/sync
```

**Request:**
```json
{
  "actions": [
    {
      "type": "COLLECTION",
      "payload": { "unitId": 10 },
      "timestamp": "2026-01-21T10:30:00Z",
      "localId": "local-123"
    }
  ]
}
```

---

## Household Endpoints

> **Auth Required:** All endpoints require `Authorization: Bearer <token>` header with HOUSEHOLD role.

### Get Profile
```http
GET /api/household/profile
```

**Response:** Unit details, collector info, last collection, payment status.

---

### Get Collection History
```http
GET /api/household/history?days=30
```

**Response:** Array of collection records with status (COLLECTED/MISSED).

---

### Get Payment Status
```http
GET /api/household/payment/status
```

**Response:** Current month's payment status, amount due.

---

### Get Payment History
```http
GET /api/household/payment/history?limit=12
```

**Response:** Past payment records.

---

### Get UPI Details
```http
GET /api/household/payment/upi
```

**Response:** Collector's UPI ID, name, and amount due.

---

### Claim Payment
```http
POST /api/household/payment/claim
```

**Request:**
```json
{
  "month": "2026-01",
  "proofUrl": "https://...",
  "transactionRef": "UPI123456"
}
```

---

### Get Complaints
```http
GET /api/household/complaints
```

**Response:** List of submitted complaints.

---

### Create Complaint
```http
POST /api/household/complaint/create
```

**Request:**
```json
{
  "complaintType": "GARBAGE_NOT_COLLECTED" | "SERVICE_ISSUE" | "OTHER",
  "description": "Details...",
  "imageUrl": "https://..."
}
```

---

## Dashboard Endpoints

> **Auth Required:** Minimum role varies by endpoint. See role requirements below.

### Overview (GOVT+)
```http
GET /api/dashboard/overview?ward=Ward5
```

**Response:** System-wide metrics (collections, payments, complaints, active collectors).

---

### Collections (GOVT+)
```http
GET /api/dashboard/collections?ward=Ward5&date=2026-01-21&collectorId=1
```

**Response:** Collection records with stats.

---

### Missed Collections (GOVT+)
```http
GET /api/dashboard/collections/missed?ward=Ward5
```

**Response:** List of units not collected today.

---

### Payments (CONTRACTOR+)
```http
GET /api/dashboard/payments?ward=Ward5&status=CLAIMED&month=2026-01
```

**Response:** Payment records with stats.

---

### Disputed Payments (SUPERVISOR+)
```http
GET /api/dashboard/payments/disputed?ward=Ward5
```

**Response:** Payments in DISPUTED status.

---

### Resolve Dispute (SUPERVISOR+)
```http
POST /api/dashboard/payments/resolve
```

**Request:**
```json
{
  "paymentId": 5,
  "decision": "approve" | "reject",
  "notes": "Resolution notes..."
}
```

---

### Defaulters (CONTRACTOR+)
```http
GET /api/dashboard/payments/defaulters?ward=Ward5&months=2
```

**Response:** Units with unpaid payments.

---

### Complaints (GOVT+)
```http
GET /api/dashboard/complaints?status=OPEN&raisedBy=HOUSEHOLD&type=GARBAGE_NOT_COLLECTED&ward=Ward5&page=1&limit=20
```

**Response:** Paginated complaint list.

---

### Resolve Complaint (SUPERVISOR+)
```http
POST /api/dashboard/complaints/resolve
```

**Request:**
```json
{
  "complaintId": 3,
  "action": "RESOLVE" | "REJECT",
  "resolutionNotes": "Issue addressed..."
}
```

---

### Collectors (GOVT+)
```http
GET /api/dashboard/collectors
```

**Response:** List of all collectors with unit counts.

---

### Create Collector (ADMIN)
```http
POST /api/dashboard/collectors
```

**Request:**
```json
{
  "name": "Ramesh Kumar",
  "phone": "+919876543210",
  "upiId": "ramesh@upi",
  "assignedRoute": "Ward 5"
}
```

---

### Update Collector Status (ADMIN)
```http
PATCH /api/dashboard/collectors/status
```

**Request:**
```json
{
  "collectorId": 1,
  "status": "ACTIVE" | "INACTIVE"
}
```

---

### QR Codes (ADMIN)
```http
GET /api/dashboard/qr-codes?status=UNASSIGNED&page=1&limit=50
```

**Response:** QR codes with statistics.

---

### Generate QR Codes (ADMIN)
```http
POST /api/dashboard/qr-codes/generate
```

**Request:**
```json
{
  "count": 100,
  "prefix": "W5"
}
```

---

### Deactivate QR (ADMIN)
```http
POST /api/dashboard/qr-codes/deactivate
```

**Request:**
```json
{
  "qrId": 5,
  "reason": "Damaged sticker"
}
```

---

### Users (ADMIN)
```http
GET /api/dashboard/users
```

**Response:** List of dashboard users.

---

### Create User (ADMIN)
```http
POST /api/dashboard/users
```

**Request:**
```json
{
  "name": "Supervisor Name",
  "phone": "+919876543210",
  "email": "supervisor@example.com",
  "role": "ADMIN" | "SUPERVISOR" | "CONTRACTOR" | "GOVT",
  "assignedWard": "Ward 5",
  "password": "optional-password"
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `UNAUTHORIZED` | 401 | No/invalid auth token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `SERVER_ERROR` | 500 | Internal server error |

---

## Role Hierarchy

| Role | Level | Access |
|------|-------|--------|
| ADMIN | 100 | Full system access |
| SUPERVISOR | 80 | Ward-level management |
| CONTRACTOR | 60 | Operations oversight |
| GOVT | 40 | View only (no payment data) |
| COLLECTOR | 30 | Mobile app (assigned units) |
| HOUSEHOLD | 20 | PWA (own unit only) |
