# EDD: Auth & Profile System

## Overview

This document describes the authentication and profile system for Moneywright. The system supports two modes:
- **Server mode** (`AUTH_ENABLED=true`): Google OAuth authentication, multi-user
- **Local mode** (`AUTH_ENABLED=false`): No login required, single default user

Each user (authenticated or default) can create multiple profiles to segment financial data (e.g., "Me", "Spouse", "Parent").

---

## Data Model

### User Table Changes

Extend the existing `users` table to support:
- Country selection (stored at user level)
- Optional Google auth fields (nullable for default user in local mode)

```
users
├── id (PK)
├── email (nullable for default user)
├── name (nullable)
├── picture (nullable)
├── google_id (nullable, unique - null for default user)
├── country (e.g., "IN", "US" - ISO 3166-1 alpha-2)
├── created_at
└── updated_at
```

**Changes from existing schema:**
- `email`: Make nullable (default user won't have email)
- `google_id`: Make nullable (default user won't have google_id)
- `country`: New field, nullable initially (set during onboarding)

### Profile Table (New)

```
profiles
├── id (PK, nanoid)
├── user_id (FK → users.id, CASCADE DELETE)
├── name (required, e.g., "Personal", "Spouse")
├── relationship (optional, e.g., "self", "spouse", "parent", "child", "other")
├── is_default (boolean, default false - marks the primary profile for quick access)
├── created_at
└── updated_at

Indexes:
- user_id (for listing profiles)
- (user_id, name) unique (prevent duplicate profile names per user)
```

### Constants

**Supported Countries (V1):**
```typescript
const SUPPORTED_COUNTRIES = [
  { code: 'IN', name: 'India', currency: 'INR' },
  // Future: US, UK, etc.
] as const
```

**Relationship Types:**
```typescript
const RELATIONSHIP_TYPES = [
  'self',
  'spouse',
  'parent',
  'child',
  'sibling',
  'other'
] as const
```

---

## Auth Flow

### Server Mode (`AUTH_ENABLED=true`)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Existing Flow                            │
│  User → Google OAuth → Create/Find User → Create Session → JWT  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      New: Post-Auth Check                       │
│  If user.country is null → Redirect to /onboarding              │
│  If user has no profiles → Redirect to /onboarding              │
│  Else → Redirect to /dashboard                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Local Mode (`AUTH_ENABLED=false`)

```
┌─────────────────────────────────────────────────────────────────┐
│                     App Startup (API)                           │
│  1. Check if default user exists in DB                          │
│  2. If not, create default user:                                │
│     - id: "default"                                             │
│     - email: null                                                │
│     - google_id: null                                           │
│     - name: "Local User"                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Request Handling                              │
│  Auth middleware checks AUTH_ENABLED:                           │
│  - If false: Auto-inject userId="default" into context          │
│  - If true: Normal JWT validation                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Frontend Routing                              │
│  If user.country is null → Redirect to /onboarding              │
│  If user has no profiles → Redirect to /onboarding              │
│  Else → Redirect to /dashboard                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Auth Status (Modified)

```
GET /api/auth/status
```

Returns auth configuration and current user state. Called on app load.

**Response (auth enabled, not logged in):**
```json
{
  "authEnabled": true,
  "authenticated": false
}
```

**Response (auth enabled, logged in):**
```json
{
  "authEnabled": true,
  "authenticated": true,
  "user": {
    "id": "abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "picture": "https://...",
    "country": "IN",
    "onboardingComplete": true
  }
}
```

**Response (auth disabled):**
```json
{
  "authEnabled": false,
  "authenticated": true,
  "user": {
    "id": "default",
    "email": null,
    "name": "Local User",
    "country": "IN",
    "onboardingComplete": true
  }
}
```

### User Onboarding

```
POST /api/user/onboarding
```

Sets user's country. Called during onboarding flow.

**Request:**
```json
{
  "country": "IN"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "abc123",
    "country": "IN"
  }
}
```

### Profile Endpoints

```
GET /api/profiles
```

List all profiles for current user.

**Response:**
```json
{
  "profiles": [
    {
      "id": "prof_abc",
      "name": "Personal",
      "relationship": "self",
      "isDefault": true,
      "createdAt": "2024-01-15T10:00:00Z"
    },
    {
      "id": "prof_xyz",
      "name": "Spouse",
      "relationship": "spouse",
      "isDefault": false,
      "createdAt": "2024-01-15T10:05:00Z"
    }
  ]
}
```

---

```
POST /api/profiles
```

Create a new profile.

**Request:**
```json
{
  "name": "Personal",
  "relationship": "self",
  "isDefault": true
}
```

**Response:**
```json
{
  "profile": {
    "id": "prof_abc",
    "name": "Personal",
    "relationship": "self",
    "isDefault": true,
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

**Validation:**
- `name`: Required, 1-50 characters, unique per user
- `relationship`: Optional, must be valid relationship type
- `isDefault`: Optional, if true and another profile is default, unset the other

---

```
GET /api/profiles/:id
```

Get a specific profile.

**Response:**
```json
{
  "profile": {
    "id": "prof_abc",
    "name": "Personal",
    "relationship": "self",
    "isDefault": true,
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

---

```
PATCH /api/profiles/:id
```

Update a profile.

**Request:**
```json
{
  "name": "My Finances",
  "relationship": "self",
  "isDefault": true
}
```

**Response:**
```json
{
  "profile": {
    "id": "prof_abc",
    "name": "My Finances",
    "relationship": "self",
    "isDefault": true,
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

---

```
DELETE /api/profiles/:id
```

Delete a profile and all associated data (hard delete).

**Response:**
```json
{
  "success": true
}
```

**Notes:**
- Cascades to: accounts, transactions, documents, assets (future tables)
- Cannot delete the last profile? (TBD - probably allow it, user can create new one)

---

## Middleware Changes

### Auth Middleware Update

```typescript
// Pseudo-code for updated auth middleware

const authMiddleware = () => {
  return async (c, next) => {
    const authEnabled = process.env.AUTH_ENABLED !== 'false'

    if (!authEnabled) {
      // Local mode: auto-authenticate as default user
      c.set('userId', 'default')
      c.set('sessionId', null)
      return next()
    }

    // Server mode: existing JWT validation logic
    // ... existing code ...
  }
}
```

### New: Onboarding Guard Middleware

For routes that require completed onboarding (country set + at least one profile):

```typescript
const requireOnboarding = () => {
  return async (c, next) => {
    const userId = c.get('userId')
    const user = await findUserById(userId)

    if (!user.country) {
      return c.json({ error: 'onboarding_required', step: 'country' }, 403)
    }

    const profiles = await getProfilesByUserId(userId)
    if (profiles.length === 0) {
      return c.json({ error: 'onboarding_required', step: 'profile' }, 403)
    }

    return next()
  }
}
```

---

## Frontend Routing

### Route Protection Logic

```
App Load
    │
    ▼
GET /api/auth/status
    │
    ├── authEnabled=true, authenticated=false
    │   └── Show Login Page
    │
    ├── authEnabled=false OR authenticated=true
    │   │
    │   ▼
    │   Check onboardingComplete
    │   │
    │   ├── false (no country)
    │   │   └── Redirect to /onboarding/country
    │   │
    │   ├── false (no profiles)
    │   │   └── Redirect to /onboarding/profile
    │   │
    │   └── true
    │       └── Redirect to /dashboard
```

### Onboarding Flow Pages

1. `/onboarding/country` - Country selection
2. `/onboarding/profile` - Create first profile

---

## File Structure

### API (Backend)

```
apps/api/src/
├── db/
│   ├── schema.pg.ts      # Add profiles table
│   └── schema.sqlite.ts  # Add profiles table
├── routes/
│   ├── auth.ts           # Modify: add /status endpoint
│   ├── user.ts           # New: /user/onboarding endpoint
│   └── profiles.ts       # New: CRUD for profiles
├── services/
│   ├── auth.ts           # Modify: ensure default user creation
│   ├── user.ts           # New: user service (onboarding, etc.)
│   └── profiles.ts       # New: profile service
├── middleware/
│   └── auth.ts           # Modify: support AUTH_ENABLED=false
└── lib/
    └── constants.ts      # New: countries, relationship types
```

### Web (Frontend)

```
apps/web/src/
├── routes/
│   ├── _authenticated.tsx    # Layout with auth check
│   ├── login.tsx             # Login page (only if auth enabled)
│   ├── onboarding/
│   │   ├── country.tsx       # Country selection
│   │   └── profile.tsx       # First profile creation
│   └── dashboard.tsx         # Main dashboard
├── hooks/
│   └── useAuth.ts            # Auth state hook
├── lib/
│   └── api.ts                # API client
└── components/
    └── profile-selector.tsx  # Profile dropdown/switcher
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_ENABLED` | `false` | Enable Google OAuth authentication |

**Existing variables (unchanged):**
- `GOOGLE_CLIENT_ID` - Required if AUTH_ENABLED=true
- `GOOGLE_CLIENT_SECRET` - Required if AUTH_ENABLED=true
- `JWT_SECRET` - Required if AUTH_ENABLED=true

---

## Migration Plan

1. **Schema Migration**
   - Alter `users` table: make `email` and `google_id` nullable
   - Add `country` column to `users` table
   - Create `profiles` table

2. **Seed Default User**
   - On app startup (if AUTH_ENABLED=false), ensure default user exists

3. **Existing Users**
   - Existing users will have `country=null` and no profiles
   - They'll be redirected to onboarding on next login

---

## Security Considerations

1. **Profile Access Control**
   - All profile endpoints verify `profile.user_id === current_user_id`
   - Profiles are strictly scoped to their owner

2. **Default User in Local Mode**
   - ID is predictable ("default") but only accessible when AUTH_ENABLED=false
   - If AUTH_ENABLED=true, "default" user cannot authenticate (no google_id)

3. **Data Isolation**
   - Each user's profiles are completely isolated
   - No cross-user data access possible

---

## Open Items / Future Considerations

1. **Profile Switching UX** - How to persist selected profile across sessions? (localStorage vs cookie vs API)
2. **Family View** - Aggregation logic for "all profiles" view (out of scope for this EDD)
3. **Profile Sharing** - Future: invite family members with their own login (post-V1)
