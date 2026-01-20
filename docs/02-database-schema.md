# Smart Bin - Database Schema Documentation

## Overview

This document describes the database schema for the Smart Bin system. We use **PostgreSQL** as the database with **Prisma** as the ORM.

## Entity Relationship Diagram

```mermaid
erDiagram
    COLLECTORS ||--o{ UNITS : "assigned to"
    COLLECTORS ||--o{ COLLECTIONS : "performs"
    COLLECTORS ||--o{ PAYMENTS : "verifies"
    
    QR_CODES ||--|| UNITS : "linked to"
    
    UNITS ||--o{ COLLECTIONS : "has"
    UNITS ||--o{ PAYMENTS : "has"
    UNITS ||--o{ COMPLAINTS : "has"
    
    USERS ||--o{ COMPLAINTS : "resolves"
    
    COLLECTORS {
        int id PK
        string name
        string phone UK
        string upi_id
        string assigned_route
        enum status
        datetime created_at
        datetime updated_at
    }
    
    QR_CODES {
        int id PK
        string secure_token UK
        enum status
        datetime created_at
        datetime activated_at
    }
    
    UNITS {
        int id PK
        int qr_id FK UK
        int collector_id FK
        string unit_number
        string household_phone
        string ward
        datetime created_at
        datetime updated_at
    }
    
    COLLECTIONS {
        int id PK
        int unit_id FK
        int collector_id FK
        datetime collected_at
        float latitude
        float longitude
        datetime synced_at
    }
    
    PAYMENTS {
        int id PK
        int unit_id FK
        int verified_by_id FK
        string month
        decimal amount
        enum status
        string proof_url
        string transaction_ref
        string rejection_reason
        datetime claimed_at
        datetime verified_at
        datetime disputed_at
        datetime resolved_at
    }
    
    COMPLAINTS {
        int id PK
        int unit_id FK
        int collector_id FK
        int resolved_by_id FK
        enum complaint_type
        enum raised_by
        string description
        string image_url
        enum status
        string resolution_notes
        datetime created_at
        datetime resolved_at
    }
    
    USERS {
        int id PK
        string name
        string phone UK
        string email UK
        string password_hash
        enum role
        string assigned_ward
        boolean is_active
        datetime created_at
        datetime updated_at
        datetime last_login_at
    }
    
    OTPS {
        int id PK
        string phone
        string code
        string purpose
        datetime expires_at
        int attempts
        boolean verified
        datetime created_at
    }
    
    AUDIT_LOGS {
        int id PK
        string action
        string entity_type
        int entity_id
        int user_id
        string user_role
        json metadata
        string ip_address
        string user_agent
        datetime created_at
    }
```

## Table Descriptions

### 1. Collectors

Stores garbage collector information.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| name | VARCHAR | Collector's full name |
| phone | VARCHAR | Unique phone number for login |
| upi_id | VARCHAR | UPI ID for receiving payments |
| assigned_route | VARCHAR | Optional route/area assignment |
| status | ENUM | ACTIVE or INACTIVE |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

**Key Points:**
- One collector typically handles ~200 houses
- Phone is used for OTP-based login
- UPI ID is used for household payments

### 2. QR Codes

Stores QR code tokens and their lifecycle status.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| secure_token | VARCHAR | Unique, random token (≥16 chars) |
| status | ENUM | UNASSIGNED, ACTIVE, DEACTIVATED |
| created_at | TIMESTAMP | Generation time |
| activated_at | TIMESTAMP | When linked to a unit |

**QR Lifecycle:**
```
UNASSIGNED (generated) → ACTIVE (linked to unit) → DEACTIVATED (damaged/replaced)
```

### 3. Units (Houses)

Stores house/flat information linked to QR codes.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| qr_id | INT | Foreign key to qr_codes (unique) |
| collector_id | INT | Foreign key to collectors |
| unit_number | VARCHAR | House/flat number |
| household_phone | VARCHAR | Registered phone for OTP |
| ward | VARCHAR | Ward/area for grouping |
| created_at | TIMESTAMP | Registration time |
| updated_at | TIMESTAMP | Last update |

**Key Constraint:**
- One QR per unit (`qr_id` is unique)

### 4. Collections

Stores daily garbage collection records.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| unit_id | INT | Foreign key to units |
| collector_id | INT | Foreign key to collectors |
| collected_at | TIMESTAMP | Collection time |
| latitude | FLOAT | GPS latitude |
| longitude | FLOAT | GPS longitude |
| synced_at | TIMESTAMP | When offline data synced |

**Key Constraint:**
- `UNIQUE(unit_id, DATE(collected_at))` - One collection per unit per day

### 5. Payments

Stores monthly payment tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| unit_id | INT | Foreign key to units |
| month | VARCHAR | Format: "YYYY-MM" |
| amount | DECIMAL | Payment amount |
| status | ENUM | UNPAID, CLAIMED, VERIFIED, DISPUTED |
| proof_url | VARCHAR | Payment screenshot URL |
| transaction_ref | VARCHAR | UPI transaction ID |
| rejection_reason | VARCHAR | If collector rejects |
| verified_by_id | INT | Collector who verified |
| claimed_at | TIMESTAMP | When household claimed |
| verified_at | TIMESTAMP | When collector verified |
| disputed_at | TIMESTAMP | When marked disputed |
| resolved_at | TIMESTAMP | When dispute resolved |

**Payment Flow:**
```
UNPAID → CLAIMED (household pays) → VERIFIED (collector confirms)
                                 → DISPUTED (collector rejects) → VERIFIED/UNPAID (supervisor)
```

**Key Constraint:**
- `UNIQUE(unit_id, month)` - One payment per unit per month

### 6. Complaints

Stores service and payment complaints.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| unit_id | INT | Foreign key to units (optional) |
| collector_id | INT | If raised by collector |
| complaint_type | ENUM | Type of complaint |
| raised_by | ENUM | HOUSEHOLD or COLLECTOR |
| description | TEXT | Details |
| image_url | VARCHAR | Photo evidence |
| status | ENUM | OPEN, IN_REVIEW, RESOLVED, REJECTED |
| resolution_notes | TEXT | Supervisor's notes |
| resolved_by_id | INT | User who resolved |
| created_at | TIMESTAMP | Creation time |
| resolved_at | TIMESTAMP | Resolution time |

**Complaint Types:**
- GARBAGE_NOT_COLLECTED (Household)
- SERVICE_ISSUE (Household)
- NON_PAYMENT (Collector)
- REPEATED_DEFAULTER (Collector)
- OTHER

### 7. Users

Stores dashboard users (Admin, Supervisor, Contractor, Govt).

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| name | VARCHAR | Full name |
| phone | VARCHAR | Unique phone for login |
| email | VARCHAR | Unique email |
| password_hash | VARCHAR | Hashed password (optional) |
| role | ENUM | ADMIN, SUPERVISOR, CONTRACTOR, GOVT |
| assigned_ward | VARCHAR | For supervisors |
| is_active | BOOLEAN | Account status |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update |
| last_login_at | TIMESTAMP | Last login |

### 8. OTPs

Temporary storage for OTP codes.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| phone | VARCHAR | Phone number |
| code | VARCHAR | Hashed OTP code |
| purpose | VARCHAR | LOGIN, VERIFY_PAYMENT, etc. |
| expires_at | TIMESTAMP | Expiration time |
| attempts | INT | Failed verification attempts |
| verified | BOOLEAN | Whether OTP was used |
| created_at | TIMESTAMP | Generation time |

### 9. Audit Logs

Stores all system actions for auditing.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| action | VARCHAR | Action name (e.g., COLLECTION_MARKED) |
| entity_type | VARCHAR | Table affected (e.g., Collection) |
| entity_id | INT | ID of affected record |
| user_id | INT | Who performed action |
| user_role | VARCHAR | Role at time of action |
| metadata | JSONB | Additional context |
| ip_address | VARCHAR | Client IP |
| user_agent | VARCHAR | Client browser/app |
| created_at | TIMESTAMP | Action time |

## Indexes

### Performance Indexes

```sql
-- Fast OTP lookup
CREATE INDEX idx_otps_phone_purpose ON otps(phone, purpose);

-- Fast QR resolution
CREATE INDEX idx_qr_codes_token ON qr_codes(secure_token);

-- Collection queries
CREATE INDEX idx_collections_unit_date ON collections(unit_id, collected_at);
CREATE INDEX idx_collections_collector ON collections(collector_id);

-- Payment queries
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_month ON payments(month);

-- Audit log queries
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

## Enum Values

### CollectorStatus
```sql
CREATE TYPE collector_status AS ENUM ('ACTIVE', 'INACTIVE');
```

### QRStatus
```sql
CREATE TYPE qr_status AS ENUM ('UNASSIGNED', 'ACTIVE', 'DEACTIVATED');
```

### PaymentStatus
```sql
CREATE TYPE payment_status AS ENUM ('UNPAID', 'CLAIMED', 'VERIFIED', 'DISPUTED');
```

### ComplaintStatus
```sql
CREATE TYPE complaint_status AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED');
```

### ComplaintRaisedBy
```sql
CREATE TYPE complaint_raised_by AS ENUM ('HOUSEHOLD', 'COLLECTOR');
```

### ComplaintType
```sql
CREATE TYPE complaint_type AS ENUM (
  'GARBAGE_NOT_COLLECTED',
  'SERVICE_ISSUE',
  'NON_PAYMENT',
  'REPEATED_DEFAULTER',
  'OTHER'
);
```

### UserRole
```sql
CREATE TYPE user_role AS ENUM (
  'ADMIN',
  'SUPERVISOR',
  'CONTRACTOR',
  'GOVT',
  'COLLECTOR',
  'HOUSEHOLD'
);
```

## Data Integrity Rules

### Business Rules Enforced

1. **One QR per Unit**
   - `units.qr_id` is unique
   
2. **One Collection per Day**
   - Unique constraint on `(unit_id, DATE(collected_at))`
   
3. **One Payment per Month**
   - Unique constraint on `(unit_id, month)`
   
4. **No Data Deletion**
   - Only status changes (ACTIVE → INACTIVE)
   - All actions logged to audit_logs

### Referential Integrity

- Units must have valid collector_id
- Collections must reference valid unit_id and collector_id
- Payments must reference valid unit_id

## Migration Commands

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database (development)
npx prisma db push

# Create migration (production)
npx prisma migrate dev --name init

# Deploy migrations (production)
npx prisma migrate deploy

# View database in browser
npx prisma studio
```

## Sample Queries

### Get today's collections for collector
```sql
SELECT u.unit_number, c.collected_at
FROM collections c
JOIN units u ON c.unit_id = u.id
WHERE c.collector_id = 1
AND DATE(c.collected_at) = CURRENT_DATE;
```

### Get pending payments
```sql
SELECT u.unit_number, p.month, p.amount, p.status
FROM payments p
JOIN units u ON p.unit_id = u.id
WHERE u.collector_id = 1
AND p.status IN ('UNPAID', 'CLAIMED');
```

### Get missed collections today
```sql
SELECT u.id, u.unit_number, col.name as collector_name
FROM units u
JOIN collectors col ON u.collector_id = col.id
WHERE u.id NOT IN (
  SELECT unit_id FROM collections 
  WHERE DATE(collected_at) = CURRENT_DATE
);
```
