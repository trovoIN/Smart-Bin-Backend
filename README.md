# Smart Bin Backend

A comprehensive QR-based garbage collection, payment, and dispute management system for municipal operations.

## 🏗️ Architecture Overview

```
smart-bin-backend/
├── prisma/                  # Database schema and migrations
│   └── schema.prisma        # Database models
├── src/
│   ├── app/api/             # Next.js API routes
│   │   ├── auth/            # Authentication endpoints
│   │   ├── collector/       # Collector app endpoints
│   │   ├── household/       # Household PWA endpoints  
│   │   ├── qr/              # QR management endpoints
│   │   ├── payment/         # Payment endpoints
│   │   └── complaint/       # Complaint endpoints
│   ├── lib/                 # Core utilities
│   │   ├── auth/            # JWT & OTP authentication
│   │   ├── db/              # Database connection
│   │   ├── security/        # Encryption & hashing
│   │   └── validation/      # Request validation
│   ├── services/            # Business logic layer
│   │   ├── auth.service.ts
│   │   ├── qr.service.ts
│   │   ├── unit.service.ts
│   │   ├── collection.service.ts
│   │   ├── payment.service.ts
│   │   └── complaint.service.ts
│   ├── middleware/          # Authentication middleware
│   └── types/               # TypeScript definitions
├── docs/                    # Layer documentation
└── tests/                   # Test files
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm 9+
- PostgreSQL database (or Supabase account)

### Setup

1. **Clone and install:**
   ```bash
   cd smart-bin-backend
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Setup database:**
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Run migrations
   npx prisma db push
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Access the API:**
   - API: http://localhost:3000
   - Prisma Studio: `npx prisma studio`

## 🔐 Authentication

### JWT Token Flow

```
User enters phone → Backend sends OTP → User enters OTP 
→ Backend verifies → Returns JWT tokens → User stores tokens
→ All requests include: Authorization: Bearer <token>
```

### Token Types

| Token | Purpose | Expiry |
|-------|---------|--------|
| Access Token | API authentication | 7 days |
| Refresh Token | Get new access token | 30 days |

### User Roles (RBAC)

| Role | Description | Access Level |
|------|-------------|--------------|
| ADMIN | Full system access | Everything |
| SUPERVISOR | Ward-level control | Collections, complaints, disputes |
| CONTRACTOR | Operations oversight | Collections, performance |
| GOVT | Municipality officials | Collections, complaints (no payment data) |
| COLLECTOR | Garbage collectors | Assigned units only |
| HOUSEHOLD | Residents | Own unit only |

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/request-otp` | Request OTP |
| POST | `/api/auth/verify-otp` | Verify OTP & get tokens |
| POST | `/api/auth/refresh` | Refresh access token |

### Collector APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/collector/profile` | Get collector profile |
| POST | `/api/qr/resolve` | Resolve scanned QR |
| POST | `/api/unit/register` | Register new unit |
| POST | `/api/collection/mark` | Mark garbage collected |
| POST | `/api/payment/verify` | Verify payment |
| POST | `/api/complaint/create` | Create complaint |
| POST | `/api/sync/bulk` | Sync offline data |

### Household APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/household/profile` | Get unit profile |
| GET | `/api/household/history` | Collection history |
| POST | `/api/payment/claim` | Claim payment |
| POST | `/api/complaint/create` | Create complaint |

### Dashboard APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/overview` | System overview |
| GET | `/api/collections` | Collection monitoring |
| GET | `/api/payments` | Payment management |
| GET | `/api/complaints` | Complaint management |
| CRUD | `/api/collectors` | Collector CRUD |
| CRUD | `/api/qr-codes` | QR management |

## 🔒 Security Features

### Authentication
- ✅ OTP-based authentication (no passwords for mobile users)
- ✅ JWT tokens with expiration
- ✅ Role-based access control (RBAC)
- ✅ Token refresh mechanism

### Data Protection
- ✅ Bcrypt password hashing (12 rounds)
- ✅ AES-256-GCM encryption for sensitive data
- ✅ No personal data in QR codes
- ✅ Secure random token generation

### API Security
- ✅ Request validation with Zod
- ✅ Rate limiting
- ✅ CORS configuration
- ✅ Secure headers (via Next.js)

### Audit
- ✅ All actions logged to audit_logs table
- ✅ Timestamps on all records
- ✅ Soft deletes (no data deletion)

## 🗄️ Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `collectors` | Garbage collector profiles |
| `qr_codes` | QR code tokens and status |
| `units` | Houses/flats linked to QRs |
| `collections` | Daily collection records |
| `payments` | Monthly payment tracking |
| `complaints` | Service complaints |
| `users` | Dashboard users |
| `otps` | OTP codes (temporary) |
| `audit_logs` | Action tracking |

### Key Relationships

```
Collector 1:N Units 1:N Collections
    │               1:N Payments
    │               1:N Complaints
    │
    └── QRCode 1:1 Unit
```

## 🧪 Testing

### Run Tests
```bash
# Unit tests
npm test

# With coverage
npm run test:coverage
```

### Manual API Testing (Postman)

1. Import the Postman collection from `docs/postman/`
2. Set environment variables:
   - `BASE_URL`: http://localhost:3000
   - `ACCESS_TOKEN`: (obtained after login)

### Test Accounts (Development)

> **Note**: In development mode, OTP codes are logged to the console for easy testing.

#### Admin Dashboard Users
```
Phone: +919000000000
Role: ADMIN
Access: Full system access, all features
```

#### Collector App Users
```
Phone: +919988776655
Role: COLLECTOR
Name: Ramesh Kumar
Access: Assigned units, collection marking, payment verification
```

```
Phone: +919988776656
Role: COLLECTOR
Name: Suresh Reddy
Access: Assigned units, collection marking, payment verification
```

#### Household Users
```
Phone: +919889999998
Role: HOUSEHOLD
Unit: Sample House 1
Access: Own unit data, payment history, complaints
```

```
Phone: +919889999997
Role: HOUSEHOLD
Unit: Sample House 2
Access: Own unit data, payment history, complaints
```

#### How to Login
1. Enter phone number in the app
2. Request OTP
3. Check backend console for OTP code (development mode)
4. Enter OTP to login
5. Access token will be returned and stored automatically


## 📦 Deployment

### Local Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Docker
```bash
docker build -t smart-bin-backend .
docker run -p 3000:3000 smart-bin-backend
```

## 📚 Documentation

See the `docs/` folder for detailed documentation:

- `01-authentication.md` - Auth flows and security
- `02-database-schema.md` - Schema relationships
- `03-api-endpoints.md` - Complete API reference
- `04-deployment.md` - AWS deployment guide

## 🤝 Frontend Integration

### React Native (Collector App)
```javascript
// Request OTP
const response = await fetch('/api/auth/request-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phone: '+919876543210',
    userType: 'collector'
  })
});

// Use token in requests
const data = await fetch('/api/collector/profile', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

### PWA (Household Web App)
```javascript
// Same pattern, different userType
userType: 'household'
```

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret for signing JWTs | Yes |
| `SMS_PROVIDER` | OTP SMS provider (mock/twilio/aws) | Yes |
| `SUPABASE_URL` | Supabase project URL | For Supabase |
| `SUPABASE_ANON_KEY` | Supabase anon key | For Supabase |

See `.env.example` for complete list.

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL (via Supabase)
- **ORM**: Prisma
- **Authentication**: JWT + OTP
- **Validation**: Zod
- **Language**: TypeScript

## 📄 License

Proprietary - All rights reserved.
