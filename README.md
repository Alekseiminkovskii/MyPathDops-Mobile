# MyPathDops Mobile

**Field operations mobile app for telecom contractors.**  
Capture photos with GPS, complete safety forms, and sync job data — all from your phone.

---

## Overview

MyPathDops Mobile is the field-facing companion to the [MyPathDops web portal](https://github.com/Alekseiminkovskii/MyPathDops). Field technicians use it on-site to document work, capture geotagged photos, and update job statuses in real time.

---

## Features

- **Authentication** — Secure sign-in with email and password via Supabase Auth
- **Jobs list** — View all assigned jobs with status badges and pull-to-refresh
- **Job detail** — Full job info with photo gallery, timestamps, and GPS coordinates
- **Photo capture** — Take photos directly from camera or pick from gallery
- **GPS tagging** — Every photo is automatically tagged with location coordinates
- **Timestamp** — Each photo records exact capture time
- **Cloud sync** — All data syncs instantly to Supabase (shared with web portal)

---

## Tech stack

| Layer       | Technology                        |
| ----------- | --------------------------------- |
| Framework   | React Native (Expo SDK 54)        |
| Navigation  | Expo Router (file-based)          |
| Backend     | Supabase (shared with web portal) |
| Auth        | Supabase Auth + AsyncStorage      |
| Camera      | expo-image-picker                 |
| Location    | expo-location                     |
| File system | expo-file-system                  |
| Storage     | Supabase Storage                  |

---

## Getting started

### Prerequisites

- Node.js 18+
- Expo Go app on your phone ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
- A [Supabase](https://supabase.com) project (shared with MyPathDops web)

### Setup

```bash
git clone https://github.com/Alekseiminkovskii/MyPathDops-Mobile.git
cd MyPathDops-Mobile
npm install
```

Create `lib/supabase.ts`:

```typescript
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient("your-supabase-url", "your-anon-key", {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### Run

```bash
npx expo start
```

Scan the QR code with Expo Go on your phone.

---

## Project structure

```
app/
  _layout.tsx         — Root layout (Stack navigator)
  index.tsx           — Auth redirect entry point
  login.tsx           — Sign in screen
  jobs/
    index.tsx         — Jobs list screen
    [id].tsx          — Job detail + photo capture
lib/
  supabase.ts         — Supabase client (not committed)
```

---

## Related

- **Web Portal:** [MyPathDops](https://github.com/Alekseiminkovskii/MyPathDops) — React + TypeScript + AWS Amplify
- **Backend:** Supabase (PostgreSQL + Storage + Auth) — shared between web and mobile

---

## Background

Part of MyPathDops — an open-source alternative to [Pathwave](https://pathwave.com), built for telecom field contractors. The author spent 5 years in telecom field work and experienced firsthand the pain of lost photos, manual PDF assembly, and zero office visibility.
