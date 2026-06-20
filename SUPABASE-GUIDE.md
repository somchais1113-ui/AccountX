# 🗄️ Supabase Setup Guide — ทำให้ข้อมูลไม่หาย

ตอนนี้แอปเก็บข้อมูลใน memory (รีเฟรชแล้วหาย) คู่มือนี้สอนต่อ database จริงด้วย Supabase (ฟรี)

---

## ทำไมต้อง Supabase?

งานบัญชีต้องการข้อมูลที่ **ไม่หาย + ตรวจสอบย้อนหลังได้ + backup อัตโนมัติ**
Supabase เป็น PostgreSQL บน cloud ที่ตอบโจทย์นี้ และมี free tier 500MB

---

## ขั้นที่ 1 — สมัคร Supabase

1. ไปที่ **https://supabase.com** → Sign up (ฟรี)
2. สร้าง New Project
3. ตั้งชื่อ + รหัสผ่าน database (จดไว้)
4. รอ 2 นาทีให้ database พร้อม

---

## ขั้นที่ 2 — สร้างตาราง

ไปที่ **SQL Editor** ใน Supabase วาง SQL นี้แล้วกด Run:

```sql
-- ตารางบริษัท
create table companies (
  id bigint primary key generated always as identity,
  name_th text not null,
  name_en text not null,
  currency text default 'THB',
  type text default 'parent',          -- parent | subsidiary
  industry text,                        -- retail | manufacturing | tech | service
  group_id text,                        -- เครือบริษัท
  created_at timestamptz default now()
);

-- ตารางข้อมูลการเงิน (หัวใจของระบบ)
create table financial_records (
  id bigint primary key generated always as identity,
  company_id bigint references companies(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  revenue numeric(20,2) default 0,
  expense numeric(20,2) default 0,
  cash_in numeric(20,2) default 0,
  cash_out numeric(20,2) default 0,
  loan_balance numeric(20,2) default 0,
  status text default 'draft',          -- draft | closed (ปิดงวด)
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- กันข้อมูลซ้ำ: 1 บริษัท + 1 ปี + 1 เดือน = 1 record
  unique(company_id, year, month)
);

-- ตาราง Audit Log (ตามมาตรฐานบัญชี)
create table audit_log (
  id bigint primary key generated always as identity,
  record_id bigint,
  action text,                          -- create | update | delete
  field_name text,
  old_value text,
  new_value text,
  user_email text,
  created_at timestamptz default now()
);

-- Index เพื่อ query เร็ว
create index idx_fr_company_year on financial_records(company_id, year);
```

---

## ขั้นที่ 3 — เชื่อมแอปกับ Supabase

### 3.1 ติดตั้ง library

```bash
npm install @supabase/supabase-js
```

### 3.2 หา API keys

ใน Supabase ไปที่ **Settings → API** จะเห็น:
- **Project URL** (เช่น https://xxxxx.supabase.co)
- **anon public key** (ขึ้นต้นด้วย eyJ...)

### 3.3 สร้างไฟล์ .env

สร้างไฟล์ชื่อ `.env` ในโฟลเดอร์หลัก ใส่:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_KEY=eyJ...your-anon-key...
```

> ⚠️ ห้าม commit ไฟล์ .env ขึ้น GitHub (อยู่ใน .gitignore แล้ว)

### 3.4 สร้างไฟล์ src/supabase.js

```javascript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ─── โหลดข้อมูลทั้งหมด ───
export async function loadAllRecords() {
  const { data, error } = await supabase
    .from("financial_records")
    .select("*");
  if (error) { console.error(error); return {}; }

  // แปลงเป็น store shape: { companyId: { year: { month: {...} } } }
  const store = {};
  data.forEach(r => {
    if (!store[r.company_id]) store[r.company_id] = {};
    if (!store[r.company_id][r.year]) store[r.company_id][r.year] = {};
    store[r.company_id][r.year][r.month - 1] = {
      monthIdx: r.month - 1,
      revenue: Number(r.revenue),
      expense: Number(r.expense),
      cashIn: Number(r.cash_in),
      cashOut: Number(r.cash_out),
      loanBalance: Number(r.loan_balance),
    };
  });
  return store;
}

// ─── บันทึก/อัปเดตข้อมูล (upsert) ───
export async function upsertRecords(companyId, year, rows) {
  const payload = rows.map(r => ({
    company_id: companyId,
    year,
    month: r.monthIdx + 1,
    revenue: r.revenue,
    expense: r.expense,
    cash_in: r.cashIn,
    cash_out: r.cashOut,
    loan_balance: r.loanBalance,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("financial_records")
    .upsert(payload, { onConflict: "company_id,year,month" });

  if (error) { console.error(error); return false; }
  return true;
}
```

### 3.5 แก้ App.jsx ให้ใช้ Supabase

ในไฟล์ `src/App.jsx` หาส่วน `export default function App()` แล้วแก้:

```javascript
import { loadAllRecords, upsertRecords } from "./supabase.js";
import { useEffect } from "react";

export default function App() {
  const [store, setStore] = useState({});  // เริ่มจากว่าง

  // โหลดข้อมูลจาก Supabase ตอนเปิดแอป
  useEffect(() => {
    loadAllRecords().then(setStore);
  }, []);

  // แก้ handleUpsert ให้บันทึกลง Supabase
  const handleUpsert = async (cid, yr, rows) => {
    const ok = await upsertRecords(cid, yr, rows);
    if (ok) {
      const fresh = await loadAllRecords();  // โหลดใหม่
      setStore(fresh);
    }
    return { added: rows.length, updated: 0, store };
  };

  // ... ที่เหลือเหมือนเดิม
}
```

---

## ✅ เสร็จแล้ว!

ตอนนี้:
- ข้อมูลเก็บถาวร ไม่หายเมื่อรีเฟรช
- เปิดเครื่องไหนก็เห็นข้อมูลเดียวกัน
- Supabase backup ให้อัตโนมัติ
- รองรับหลายคนใช้พร้อมกัน

---

## 🔐 ขั้นต่อไป (เมื่อใช้จริงจัง)

1. **เพิ่ม Authentication** — ให้ผู้ใช้ login (Supabase มี built-in)
2. **Row Level Security** — แยกสิทธิ์ว่าใครเห็นบริษัทไหนได้
3. **Audit triggers** — บันทึกทุกการแก้ไขลง audit_log อัตโนมัติ

ดูเอกสาร Supabase: https://supabase.com/docs
