# 📊 FinAnalytics — Financial Analytics Platform

ระบบวิเคราะห์การเงินสำหรับงานบัญชี/ที่ปรึกษา รองรับหลายบริษัท หลายสกุลเงิน
พร้อม Momentum Analysis (MOM/QOQ/YOY/MTD/YTD/LTM/CAGR), แยกรายอุตสาหกรรม, เปรียบเทียบบริษัท และ Slide Template

---

## 🚀 วิธีรัน (สำหรับมือใหม่ ไม่เคยเขียนโค้ด)

### ขั้นที่ 1 — ติดตั้ง Node.js (ทำครั้งเดียว)

1. ไปที่ **https://nodejs.org**
2. ดาวน์โหลดเวอร์ชัน **LTS** (ปุ่มซ้าย แนะนำ)
3. ติดตั้งตามปกติ (กด Next ไปเรื่อยๆ)
4. รีสตาร์ทเครื่องหลังติดตั้ง

> ตรวจสอบว่าติดตั้งสำเร็จ: เปิด Terminal (Mac) หรือ Command Prompt (Windows) พิมพ์ `node -v` ถ้าขึ้นตัวเลขเวอร์ชัน = สำเร็จ

### ขั้นที่ 2 — เปิดโปรเจกต์

**Mac:**
1. เปิดแอป **Terminal**
2. พิมพ์ `cd ` (มีเว้นวรรค) แล้วลากโฟลเดอร์ finanalytics มาวางใน Terminal กด Enter

**Windows:**
1. เปิดโฟลเดอร์ finanalytics
2. คลิกที่ช่อง address bar ด้านบน พิมพ์ `cmd` กด Enter

### ขั้นที่ 3 — ติดตั้งและรัน

พิมพ์ทีละบรรทัด (รอให้เสร็จก่อนพิมพ์บรรทัดถัดไป):

```bash
npm install
```

```bash
npm run dev
```

เว็บจะเปิดอัตโนมัติที่ **http://localhost:3000** 🎉

> หยุดการทำงาน: กด `Ctrl + C` ใน Terminal

---

## 📁 โครงสร้างไฟล์

```
finanalytics/
├── index.html          ← หน้าเว็บหลัก
├── package.json        ← รายการ dependencies
├── vite.config.js      ← ตั้งค่า build tool
├── src/
│   ├── main.jsx        ← จุดเริ่มต้นของแอป
│   └── App.jsx         ← โค้ดหลักทั้งหมด (8 หน้า)
└── README.md           ← ไฟล์นี้
```

---

## 🌐 วิธี Deploy ขึ้นเว็บจริง (ให้คนอื่นเข้าได้)

### วิธีที่ง่ายที่สุด — Vercel (ฟรี)

1. สมัคร GitHub ที่ **https://github.com** (ฟรี)
2. สร้าง repository ใหม่ แล้วอัปโหลดโฟลเดอร์นี้ขึ้นไป
3. สมัคร Vercel ที่ **https://vercel.com** (ล็อกอินด้วย GitHub)
4. กด **Import Project** เลือก repository → กด **Deploy**
5. รอ 1-2 นาที ได้ URL จริงมาเลย

Vercel จะตรวจเจอว่าเป็น Vite อัตโนมัติ ไม่ต้องตั้งค่าอะไร

---

## ⚙️ คำสั่งที่ใช้บ่อย

| คำสั่ง | ทำอะไร |
|--------|--------|
| `npm install` | ติดตั้ง dependencies (ทำครั้งแรกครั้งเดียว) |
| `npm run dev` | รันเว็บแบบ development (แก้โค้ดแล้วเห็นผลทันที) |
| `npm run build` | สร้างไฟล์สำหรับ deploy จริง |
| `npm run preview` | ดูตัวอย่างเวอร์ชัน production |

---

## 📝 หมายเหตุสำคัญ

- ตอนนี้ข้อมูลเก็บใน memory (รีเฟรชแล้วหาย) — เป็น demo
- เมื่อพร้อมใช้จริง ควรต่อ database (Supabase) เพื่อให้ข้อมูลไม่หาย
- ดูคำแนะนำ Supabase ในไฟล์ `SUPABASE-GUIDE.md`

---

## ✨ ฟีเจอร์

- ⚡ **Momentum** — วิเคราะห์ MOM/QOQ/YOY/MTD/YTD/LTM/CAGR พร้อมสูตรพิสูจน์ได้
- ⬆ **Upload** — อัปโหลด CSV แยกบริษัท/ปี รวมข้อมูลอัตโนมัติ (upsert)
- ▦ **Data Table** — ดูข้อมูลดิบทุกเดือน
- 🏢 **Companies** — แยกตามอุตสาหกรรม/เครือ + เปรียบเทียบได้ 3 บริษัท
- 🏭 **Industry** — วิเคราะห์รายอุตสาหกรรม
- ⊞ **Consolidation** — งบรวมเลือก scope ได้
- 🖥 **Slide Template** — สร้างสไลด์นำเสนอจากข้อมูลจริง
- 🌙☀️ **Dark/Light theme** — สลับ realtime
- 🇹🇭🇬🇧 **Bilingual** — ไทย/อังกฤษ
