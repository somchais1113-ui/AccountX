import { useState, useMemo, useRef, Fragment, createContext, useContext } from "react";
import {
  AreaChart, Area, BarChart, Bar, Line, ComposedChart, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from "recharts";

// ═══════════════════════════════════════════════════════════
// THEME SYSTEM — Dark / Light (realtime)
// ═══════════════════════════════════════════════════════════
const THEMES = {
  dark: {
    bg:"#0B0E1A", surface:"#13172A", card:"#1A1F35", border:"#252A42",
    accent:"#5B7CFA", accentLo:"#5B7CFA18", green:"#1FD9A4", greenLo:"#1FD9A415",
    red:"#F7637C", redLo:"#F7637C15", amber:"#F7B84F", amberLo:"#F7B84F15",
    purple:"#A78BFA", purpleLo:"#A78BFA18",
    text:"#E4E8FF", muted:"#6B7299", white:"#FFFFFF",
    slideBg:"#0F1528", overlay:"#ffffff08", overlay2:"#ffffff06",
  },
  light: {
    bg:"#F4F6FB", surface:"#FFFFFF", card:"#FFFFFF", border:"#E2E6F0",
    accent:"#3A5BE0", accentLo:"#3A5BE012", green:"#0FA67E", greenLo:"#0FA67E12",
    red:"#E0445F", redLo:"#E0445F12", amber:"#C77F15", amberLo:"#C77F1512",
    purple:"#7C5BD4", purpleLo:"#7C5BD412",
    text:"#1A1F35", muted:"#7A8199", white:"#1A1F35",
    slideBg:"#0F1528", overlay:"#ffffff08", overlay2:"#ffffff06",
  },
};
const ThemeCtx = createContext(THEMES.dark);
const useC = () => useContext(ThemeCtx);
const F = { sans:"'Inter','Noto Sans Thai',sans-serif" };

// ═══════════════════════════════════════════════════════════
// FINANCIAL MATH ENGINE
// ═══════════════════════════════════════════════════════════
const FinanceMath = {
  MOM: (cur, prev) => prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100,
  QOQ: (records, metric, qIdx) => {
    const sum = (i) => records.slice(i*3, i*3+3).reduce((s,d)=>s+(d?.[metric]||0),0);
    const cur = sum(qIdx), prev = sum(qIdx-1);
    return prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100;
  },
  YOY: (thisY, lastY) => lastY === 0 ? null : ((thisY - lastY) / Math.abs(lastY)) * 100,
  MTD: (records, metric, monthIdx) => records.slice(0, monthIdx+1).reduce((s,d)=>s+(d?.[metric]||0),0),
  YTD: (records, metric) => records.reduce((s,d)=>s+(d?.[metric]||0),0),
  LTM: (records, metric) => records.slice(-12).reduce((s,d)=>s+(d?.[metric]||0),0),
  CAGR: (s, e, y) => (s<=0||y<=0) ? null : (Math.pow(e/s, 1/y)-1)*100,
  netProfit: (d) => (d?.revenue||0) - (d?.expense||0),
  margin: (d) => (!d||d.revenue===0) ? 0 : ((d.revenue - d.expense) / d.revenue) * 100,
};

const MONTHS = [
  {th:"ม.ค.",en:"Jan"},{th:"ก.พ.",en:"Feb"},{th:"มี.ค.",en:"Mar"},
  {th:"เม.ย.",en:"Apr"},{th:"พ.ค.",en:"May"},{th:"มิ.ย.",en:"Jun"},
  {th:"ก.ค.",en:"Jul"},{th:"ส.ค.",en:"Aug"},{th:"ก.ย.",en:"Sep"},
  {th:"ต.ค.",en:"Oct"},{th:"พ.ย.",en:"Nov"},{th:"ธ.ค.",en:"Dec"},
];

// INDUSTRY DEFINITIONS
const INDUSTRIES = {
  retail:        { th:"ค้าปลีก", en:"Retail", icon:"🛒", color:"#5B7CFA" },
  manufacturing: { th:"การผลิต", en:"Manufacturing", icon:"🏭", color:"#1FD9A4" },
  service:       { th:"บริการ", en:"Service", icon:"💼", color:"#A78BFA" },
  tech:          { th:"เทคโนโลยี", en:"Technology", icon:"💻", color:"#F7B84F" },
  realestate:    { th:"อสังหาฯ", en:"Real Estate", icon:"🏗", color:"#F7637C" },
};

// DATA ENGINE
const emptyMonth = (i) => ({ monthIdx:i, cashIn:0, cashOut:0, revenue:0, expense:0, loanBalance:0 });
const DataEngine = {
  getYearData(store, companyId, year) {
    const yearObj = store?.[companyId]?.[year] || {};
    return MONTHS.map((_, i) => ({ ...emptyMonth(i), ...(yearObj[i]||{}), monthTh:MONTHS[i].th, monthEn:MONTHS[i].en }));
  },
  upsert(store, companyId, year, rows) {
    const next = JSON.parse(JSON.stringify(store));
    if (!next[companyId]) next[companyId] = {};
    if (!next[companyId][year]) next[companyId][year] = {};
    let added=0, updated=0;
    rows.forEach(row => {
      const i = row.monthIdx;
      if (next[companyId][year][i]) updated++; else added++;
      next[companyId][year][i] = { monthIdx:i, cashIn:row.cashIn, cashOut:row.cashOut, revenue:row.revenue, expense:row.expense, loanBalance:row.loanBalance, _updatedAt:new Date().toISOString() };
    });
    return { store: next, added, updated };
  },
  getAvailableYears(store, companyId) { return Object.keys(store?.[companyId]||{}).map(Number).sort(); },
  countMonths(store, companyId, year) { return Object.keys(store?.[companyId]?.[year]||{}).length; },
  yearTotal(store, companyId, year, metric) { return this.getYearData(store,companyId,year).reduce((s,d)=>s+(d[metric]||0),0); },
};

const genSeed = (seed=1, trend=1) => {
  const obj = {};
  MONTHS.forEach((_, i) => {
    obj[i] = {
      monthIdx:i,
      cashIn:Math.round((4200+Math.sin(i*seed+1)*900+i*80*trend)*seed),
      cashOut:Math.round((3100+Math.cos(i*seed+2)*700+i*40*trend)*seed),
      revenue:Math.round((5100+Math.sin(i*seed+3)*800+i*100*trend)*seed),
      expense:Math.round((3400+Math.cos(i*seed+4)*600+i*50*trend)*seed),
      loanBalance:Math.round((15000-i*180*seed+500)*seed),
    };
  });
  return obj;
};

const INITIAL_STORE = {
  1:{2024:genSeed(1,1),2025:genSeed(1,1.15),2026:genSeed(1,1.28)},
  2:{2024:genSeed(0.6,0.9),2025:genSeed(0.6,1.05),2026:genSeed(0.6,1.2)},
  3:{2024:genSeed(1.4,1.1),2025:genSeed(1.4,1.2),2026:genSeed(1.4,1.35)},
  4:{2024:genSeed(0.9,1.05),2025:genSeed(0.9,1.18),2026:genSeed(0.9,1.3)},
  5:{2024:genSeed(1.2,0.95),2025:genSeed(1.2,1.1),2026:genSeed(1.2,1.22)},
};

const COMPANIES = [
  { id:1, nameTh:"บริษัท อัลฟา จำกัด", nameEn:"Alpha Co., Ltd.", currency:"THB", type:"parent", industry:"retail", groupId:"alpha" },
  { id:2, nameTh:"บริษัท เบต้า จำกัด", nameEn:"Beta Co., Ltd.", currency:"USD", type:"subsidiary", industry:"retail", groupId:"alpha" },
  { id:3, nameTh:"บริษัท แกมมา จำกัด", nameEn:"Gamma Co., Ltd.", currency:"THB", type:"subsidiary", industry:"manufacturing", groupId:"alpha" },
  { id:4, nameTh:"บริษัท เดลต้า จำกัด", nameEn:"Delta Co., Ltd.", currency:"THB", type:"parent", industry:"tech", groupId:"delta" },
  { id:5, nameTh:"บริษัท เอปไซลอน จำกัด", nameEn:"Epsilon Co., Ltd.", currency:"THB", type:"subsidiary", industry:"service", groupId:"delta" },
];
const GROUPS = { alpha:{th:"เครืออัลฟา",en:"Alpha Group"}, delta:{th:"เครือเดลต้า",en:"Delta Group"} };

// HELPERS
const fmt = (n, cur="THB", compact=true) => {
  if (n===null||n===undefined||isNaN(n)) return "N/A";
  const sym = cur==="THB"?"฿":cur==="USD"?"$":"€";
  if (compact) {
    if (Math.abs(n)>=1e6) return `${sym}${(n/1e6).toFixed(2)}M`;
    if (Math.abs(n)>=1e3) return `${sym}${(n/1e3).toFixed(1)}K`;
  }
  return `${sym}${Math.round(n).toLocaleString()}`;
};
const fmtPct = (n) => n===null||isNaN(n) ? "N/A" : `${n>=0?"+":""}${n.toFixed(1)}%`;

// ═══════════════════════════════════════════════════════════
// UI PRIMITIVES (theme-aware)
// ═══════════════════════════════════════════════════════════
function Card({children, style={}, ...props}) {
  const C = useC();
  return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:22,...style}} {...props}>{children}</div>;
}
function Badge({children, color}) {
  const C = useC();
  const c = color || C.accent;
  return <span style={{display:"inline-flex",alignItems:"center",padding:"3px 11px",borderRadius:20,fontSize:12,fontWeight:700,background:c+"22",color:c}}>{children}</span>;
}
function Tip({active,payload,label,currency="THB"}) {
  const C = useC();
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",fontSize:13,boxShadow:"0 8px 24px #00000040"}}>
      <div style={{fontWeight:700,marginBottom:6,color:C.text}}>{label}</div>
      {payload.map((p,i)=>(<div key={i} style={{color:p.color,marginBottom:2}}>{p.name}: <b>{fmt(p.value,currency)}</b></div>))}
    </div>
  );
}

function MetricPill({label, value, formula, forceColor}) {
  const C = useC();
  const [hover, setHover] = useState(false);
  const clr = forceColor || (value===null||isNaN(value)?C.muted:value>0?C.green:value===0?C.muted:C.red);
  return (
    <div onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} style={{position:"relative",display:"inline-block"}}>
      <div style={{padding:"6px 13px",borderRadius:8,background:clr+"18",border:`1px solid ${clr}40`,fontSize:13,fontWeight:700,color:clr,whiteSpace:"nowrap"}}>
        <span style={{color:C.muted,fontWeight:500,marginRight:4}}>{label}</span>{fmtPct(value)}
      </div>
      {hover && (
        <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:99,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:12,color:C.muted,whiteSpace:"nowrap",boxShadow:"0 8px 24px #00000060"}}>
          <div style={{color:C.text,fontWeight:700,marginBottom:4}}>สูตร / Formula</div>
          <div style={{fontFamily:"monospace",color:C.amber}}>{formula}</div>
        </div>
      )}
    </div>
  );
}

// PAGE HEADER (bigger, bolder)
function PageHeader({title, subtitle}) {
  const C = useC();
  return (
    <div style={{marginBottom:24}}>
      <div style={{fontSize:28,fontWeight:800,color:C.white,marginBottom:6,letterSpacing:"-0.01em"}}>{title}</div>
      {subtitle && <div style={{fontSize:15,color:C.muted,fontWeight:500}}>{subtitle}</div>}
    </div>
  );
}

const FILTERS = [
  {id:"MOM", label:"MOM", color:"accent", formula:"(M₁ - M₀) / |M₀| × 100"},
  {id:"QOQ", label:"QOQ", color:"accent", formula:"(Q₁ - Q₀) / |Q₀| × 100"},
  {id:"YOY", label:"YOY", color:"accent", formula:"(Y₁ - Y₀) / |Y₀| × 100"},
  {id:"MTD", label:"MTD", color:"green", formula:"Σ (1st → today)"},
  {id:"YTD", label:"YTD", color:"green", formula:"Σ (Jan → today)"},
  {id:"LTM", label:"LTM/TTM", color:"purple", formula:"Σ (last 12 months)"},
  {id:"CAGR",label:"CAGR", color:"purple", formula:"(End/Start)^(1/n) - 1"},
];

function FilterBar({active, onChange}) {
  const C = useC();
  return (
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20,alignItems:"center"}}>
      <span style={{fontSize:12,color:C.muted,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase"}}>Analysis</span>
      {FILTERS.map(f=>{
        const col = C[f.color];
        return (
          <button key={f.id} onClick={()=>onChange(f.id)} title={f.formula}
            style={{padding:"6px 16px",borderRadius:20,border:`1px solid ${active===f.id?col:C.border}`,
              background:active===f.id?col+"22":"transparent",color:active===f.id?col:C.muted,fontSize:13,fontWeight:700,cursor:"pointer"}}>{f.label}</button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// UPLOAD PAGE
// ═══════════════════════════════════════════════════════════
function UploadPage({store, onUpsert, lang, defaultCompany, defaultYear}) {
  const C = useC();
  const th = lang==="th";
  const [targetCompany, setTargetCompany] = useState(defaultCompany);
  const [targetYear, setTargetYear] = useState(defaultYear);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState(null);
  const [preview, setPreview] = useState(null);
  const inputRef = useRef();
  const company = COMPANIES.find(c=>c.id===targetCompany);
  const existingMonths = DataEngine.countMonths(store, targetCompany, targetYear);

  const parseCSV = (text) => {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(",").map(h=>h.trim().toLowerCase().replace(/[\s_]/g,""));
    return lines.slice(1).filter(l=>l.trim()).map(line=>{
      const vals = line.split(",");
      const row = {};
      headers.forEach((h,i)=>{ row[h] = vals[i]!==undefined ? (parseFloat(vals[i].replace(/[฿$,]/g,""))||0) : 0; });
      return row;
    });
  };

  const handleFile = (file) => {
    if (!file) return;
    if (file.name.split(".").pop().toLowerCase()!=="csv") {
      setStatus({type:"error", msg:th?"กรุณาแปลงเป็น CSV ก่อน (Excel → Save as CSV)":"Please convert to CSV first"});
      return;
    }
    setStatus({type:"loading", msg:th?"กำลังอ่านไฟล์...":"Reading..."});
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rows = parseCSV(e.target.result);
        if (!rows.length) { setStatus({type:"error",msg:th?"ไฟล์ว่างเปล่า":"Empty file"}); return; }
        const normalized = rows.map((r) => {
          const mi = Math.max(0, Math.min(11, Math.round(r.month||r["เดือน"]||0)-1));
          return { monthIdx:mi, cashIn:r.cashin||r["รายรับ"]||0, cashOut:r.cashout||r["รายจ่าย"]||0, revenue:r.revenue||r.income||r["รายได้"]||0, expense:r.expense||r.cost||r["ค่าใช้จ่าย"]||0, loanBalance:r.loanbalance||r.loan||r["เงินกู้"]||0 };
        });
        setPreview(normalized);
        const result = onUpsert(targetCompany, targetYear, normalized);
        setStatus({type:"success", msg:`✓ ${th?"สำเร็จ":"Done"} — ${th?"เพิ่ม":"Added"} ${result.added}, ${th?"อัปเดต":"Updated"} ${result.updated} ${th?"เดือน":"mo"}`});
      } catch(err) { setStatus({type:"error", msg:`Parse error: ${err.message}`}); }
    };
    reader.readAsText(file);
  };

  const selStyle = {width:"100%",background:C.surface,border:`1px solid ${C.border}`,color:C.text,padding:"10px 12px",borderRadius:8,fontSize:14,cursor:"pointer",outline:"none"};

  return (
    <div>
      <PageHeader title={th?"อัปโหลดงบการเงิน":"Upload Financial Statements"} subtitle={th?"เลือกบริษัทและปีก่อน แล้วระบบจะรวมข้อมูลเข้ากับของเดิมอัตโนมัติ":"Select company & year — data merges automatically"}/>

      <Card style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:C.muted,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.05em"}}>{th?"ขั้นที่ 1 — เลือกปลายทางข้อมูล":"Step 1 — Select destination"}</div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-end"}}>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontSize:12,color:C.muted,marginBottom:6,fontWeight:600}}>{th?"บริษัท":"Company"}</div>
            <select value={targetCompany} onChange={e=>setTargetCompany(Number(e.target.value))} style={selStyle}>
              {COMPANIES.map(c=>(<option key={c.id} value={c.id}>{th?c.nameTh:c.nameEn} ({c.currency})</option>))}
            </select>
          </div>
          <div style={{width:150}}>
            <div style={{fontSize:12,color:C.muted,marginBottom:6,fontWeight:600}}>{th?"ปี":"Year"}</div>
            <select value={targetYear} onChange={e=>setTargetYear(Number(e.target.value))} style={selStyle}>
              {[2023,2024,2025,2026].map(y=>(<option key={y} value={y}>{y} (พ.ศ.{y+543})</option>))}
            </select>
          </div>
        </div>
        <div style={{marginTop:14,padding:"10px 14px",borderRadius:8,background:existingMonths>0?C.amberLo:C.greenLo,border:`1px solid ${existingMonths>0?C.amber:C.green}40`,fontSize:13,fontWeight:600,color:existingMonths>0?C.amber:C.green}}>
          {existingMonths>0 ? (th?`⚠ มีข้อมูลอยู่แล้ว ${existingMonths} เดือน — เดือนที่ซ้ำจะถูกอัปเดตทับ`:`⚠ ${existingMonths} months exist — duplicates will update`) : (th?`✓ ยังไม่มีข้อมูล — พร้อมรับข้อมูลใหม่`:`✓ No existing data — ready`)}
        </div>
      </Card>

      <Card style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:C.muted,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.05em"}}>{th?"ขั้นที่ 2 — อัปโหลดไฟล์":"Step 2 — Upload file"}</div>
        <div style={{border:`2px dashed ${dragging?C.accent:C.border}`,borderRadius:12,padding:32,textAlign:"center",cursor:"pointer",background:dragging?C.accentLo:"transparent"}}
          onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
          onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0]);}} onClick={()=>inputRef.current.click()}>
          <input ref={inputRef} type="file" accept=".csv" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
          <div style={{fontSize:30,marginBottom:10}}>📊</div>
          <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:4}}>{th?`ลากไฟล์ CSV → ${company.nameTh} ปี ${targetYear}`:`Drop CSV → ${company.nameEn} ${targetYear}`}</div>
          <div style={{fontSize:13,color:C.muted}}>{th?"รองรับ CSV (Excel แปลงเป็น CSV ก่อน)":"CSV only"}</div>
        </div>
        {status && (
          <div style={{marginTop:12,padding:"11px 14px",borderRadius:8,fontSize:14,fontWeight:600,
            background:status.type==="error"?C.redLo:status.type==="success"?C.greenLo:C.accentLo,
            color:status.type==="error"?C.red:status.type==="success"?C.green:C.accent,
            border:`1px solid ${status.type==="error"?C.red:status.type==="success"?C.green:C.accent}40`}}>{status.msg}</div>
        )}
      </Card>

      <Card>
        <div style={{fontSize:13,fontWeight:700,color:C.muted,marginBottom:10}}>{th?"รูปแบบ CSV ที่รองรับ:":"Supported CSV format:"}</div>
        <code style={{fontSize:12,color:C.amber,fontFamily:"monospace",lineHeight:1.8,display:"block",background:C.surface,padding:"14px",borderRadius:8,border:`1px solid ${C.border}`}}>
          month,revenue,expense,cashin,cashout,loanbalance<br/>1,5100000,3400000,4200000,3100000,15000000<br/>2,5380000,3520000,4450000,3200000,14820000
        </code>
        <div style={{fontSize:12,color:C.muted,marginTop:10}}>{th?"※ month = เลขเดือน 1-12 · รองรับหัวคอลัมน์ภาษาไทย":"※ month = 1-12 · Thai headers supported"}</div>
        {preview && (
          <div style={{marginTop:14}}>
            <div style={{fontSize:12,color:C.muted,marginBottom:6,fontWeight:600}}>{th?"ข้อมูลที่อัปโหลด:":"Uploaded:"}</div>
            <div style={{maxHeight:140,overflowY:"auto"}}>
              {preview.map((r,i)=>(
                <div key={i} style={{fontSize:12,color:C.text,padding:"6px 10px",background:C.surface,borderRadius:6,marginBottom:3,display:"flex",gap:14,flexWrap:"wrap"}}>
                  <span style={{color:C.accent,fontWeight:700}}>{MONTHS[r.monthIdx][th?"th":"en"]}</span>
                  <span style={{color:C.green}}>Rev {fmt(r.revenue,company.currency)}</span>
                  <span style={{color:C.red}}>Exp {fmt(r.expense,company.currency)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MOMENTUM DASHBOARD
// ═══════════════════════════════════════════════════════════
function MomentumDashboard({store, companyId, year, lang}) {
  const C = useC();
  const [filter, setFilter] = useState("YOY");
  const th = lang==="th";
  const company = COMPANIES.find(c=>c.id===companyId);
  const cur = company.currency;
  const ind = INDUSTRIES[company.industry];

  const data = DataEngine.getYearData(store, companyId, year);
  const prevData = DataEngine.getYearData(store, companyId, year-1);
  const hasData = DataEngine.countMonths(store, companyId, year) > 0;

  const latestIdx = useMemo(()=>{
    const m = Object.keys(store?.[companyId]?.[year]||{}).map(Number);
    return m.length ? Math.max(...m) : 5;
  },[store,companyId,year]);

  const metrics = useMemo(()=>{
    const d = data, p = prevData, latest = d[latestIdx], prevMon = latestIdx>0?d[latestIdx-1]:null;
    const ytdRev = FinanceMath.YTD(d.slice(0,latestIdx+1),"revenue");
    const ytdExp = FinanceMath.YTD(d.slice(0,latestIdx+1),"expense");
    return {
      revenue:latest.revenue, expense:latest.expense, cashIn:latest.cashIn, cashOut:latest.cashOut,
      netProfit:FinanceMath.netProfit(latest), margin:FinanceMath.margin(latest), loanBal:latest.loanBalance,
      MOM_rev:prevMon?FinanceMath.MOM(latest.revenue,prevMon.revenue):null,
      MOM_cash:prevMon?FinanceMath.MOM(latest.cashIn,prevMon.cashIn):null,
      QOQ_rev:FinanceMath.QOQ(d,"revenue",Math.floor(latestIdx/3)),
      YOY_rev:p[latestIdx].revenue?FinanceMath.YOY(latest.revenue,p[latestIdx].revenue):null,
      YTD_rev:ytdRev, YTD_net:ytdRev-ytdExp,
      LTM_rev:FinanceMath.LTM(d,"revenue"), LTM_cash:FinanceMath.LTM(d,"cashIn"),
      CAGR_rev:FinanceMath.CAGR(FinanceMath.YTD(p,"revenue"),FinanceMath.YTD(d,"revenue"),1),
    };
  },[data,prevData,latestIdx]);

  const af = FILTERS.find(f=>f.id===filter);
  const afColor = C[af.color];
  const filterValue = {MOM:metrics.MOM_rev,QOQ:metrics.QOQ_rev,YOY:metrics.YOY_rev,MTD:null,YTD:null,LTM:null,CAGR:metrics.CAGR_rev}[filter];
  const filterAbs = {MTD:metrics.revenue,YTD:metrics.YTD_rev,LTM:metrics.LTM_rev}[filter];

  const chartData = data.map((d,i)=>({
    month:th?d.monthTh:d.monthEn, revenue:d.revenue, expense:d.expense, cashIn:d.cashIn, cashOut:d.cashOut,
    margin:Math.round(FinanceMath.margin(d)*10)/10, prev_revenue:prevData[i]?.revenue||0,
  }));

  if (!hasData) {
    return (
      <Card style={{textAlign:"center",padding:48}}>
        <div style={{fontSize:34,marginBottom:12}}>📭</div>
        <div style={{fontSize:18,fontWeight:700,color:C.white,marginBottom:6}}>{th?`ยังไม่มีข้อมูลของ ${company.nameTh} ปี ${year}`:`No data for ${company.nameEn} ${year}`}</div>
        <div style={{fontSize:14,color:C.muted}}>{th?'ไปที่หน้า "อัปโหลดงบ" เพื่อเพิ่มข้อมูล':'Go to "Upload Data" to add records'}</div>
      </Card>
    );
  }

  return (
    <div>
      <div style={{marginBottom:24}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
          <div style={{fontSize:28,fontWeight:800,color:C.white,letterSpacing:"-0.01em"}}>{th?"วิเคราะห์โมเมนตัมทางการเงิน":"Financial Momentum Analysis"}</div>
          <Badge color={ind.color}>{ind.icon} {th?ind.th:ind.en}</Badge>
        </div>
        <div style={{fontSize:15,color:C.muted,fontWeight:500}}>{th?company.nameTh:company.nameEn} · {th?"ปี":"FY"}{year} · {th?"ล่าสุด":"Latest"} {MONTHS[latestIdx][th?"th":"en"]}</div>
      </div>

      <FilterBar active={filter} onChange={setFilter}/>

      <Card style={{marginBottom:16,borderLeft:`4px solid ${afColor}`}}>
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <Badge color={afColor}>{filter}</Badge>
          <span style={{fontFamily:"monospace",fontSize:13,color:C.amber,background:C.surface,padding:"3px 12px",borderRadius:6,border:`1px solid ${C.border}`}}>{af.formula}</span>
          <div style={{marginLeft:"auto",fontSize:28,fontWeight:800,color:filterAbs!==undefined?C.text:(filterValue>0?C.green:filterValue<0?C.red:C.muted)}}>
            {filterAbs!==undefined ? fmt(filterAbs,cur) : fmtPct(filterValue)}
          </div>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:16}}>
        {[
          {label:th?"รายได้":"Revenue", val:metrics.revenue, color:C.accent, pills:[{id:"MOM",v:metrics.MOM_rev,f:"(M₁-M₀)/|M₀|×100"},{id:"YOY",v:metrics.YOY_rev,f:"(Y₁-Y₀)/|Y₀|×100"}]},
          {label:th?"กำไรสุทธิ":"Net Profit", val:metrics.netProfit, color:C.green, pills:[{id:"Margin",v:metrics.margin,f:"Profit/Rev×100",margin:true}]},
          {label:th?"รายรับเงินสด":"Cash In", val:metrics.cashIn, color:C.purple, pills:[{id:"MOM",v:metrics.MOM_cash,f:"(M₁-M₀)/|M₀|×100"}]},
          {label:th?"ยอดกู้คงค้าง":"Loan Balance", val:metrics.loanBal, color:C.amber, pills:[{id:"CAGR",v:metrics.CAGR_rev,f:"(End/Start)^(1/n)-1"}]},
        ].map((k,i)=>(
          <Card key={i} style={{borderTop:`3px solid ${k.color}`}}>
            <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.05em"}}>{k.label}</div>
            <div style={{fontSize:25,fontWeight:800,color:C.white,marginBottom:12}}>{fmt(k.val,cur)}</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {k.pills.map((p,j)=>(<MetricPill key={j} label={p.id} value={p.v} formula={p.f} forceColor={p.margin?(p.v>0?C.green:C.red):undefined}/>))}
            </div>
          </Card>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:16,marginBottom:16}}>
        <Card>
          <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:4}}>Revenue vs Expense — YOY</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:16}}>{th?"เส้นทึบ=ปีนี้ · เส้นประ=ปีก่อน":"Solid=This Year · Dashed=Last Year"}</div>
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={chartData} margin={{top:4,right:4,left:0,bottom:0}}>
              <defs><linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.accent} stopOpacity={0.35}/><stop offset="95%" stopColor={C.accent} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
              <XAxis dataKey="month" tick={{fontSize:11,fill:C.muted}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:11,fill:C.muted}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1e3).toFixed(0)}K`}/>
              <Tooltip content={<Tip currency={cur}/>}/>
              <Area type="monotone" dataKey="revenue" name={th?"รายได้":"Revenue"} stroke={C.accent} fill="url(#gr)" strokeWidth={2.5}/>
              <Line type="monotone" dataKey="prev_revenue" name={th?"ปีก่อน":"Prev"} stroke={C.accent} strokeDasharray="5 3" strokeWidth={1.5} dot={false}/>
              <Line type="monotone" dataKey="expense" name={th?"รายจ่าย":"Expense"} stroke={C.red} strokeWidth={2} dot={false}/>
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:4}}>Profit Margin %</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:16}}>(Rev − Exp) / Rev × 100</div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={chartData} margin={{top:4,right:4,left:0,bottom:0}} barCategoryGap="40%">
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
              <XAxis dataKey="month" tick={{fontSize:11,fill:C.muted}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:11,fill:C.muted}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
              <Tooltip content={({active,payload,label})=>active&&payload?.length?(<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:13}}><b>{label}</b><br/><span style={{color:C.green}}>Margin: {payload[0]?.value}%</span></div>):null}/>
              <ReferenceLine y={0} stroke={C.border}/>
              <Bar dataKey="margin" name="Margin %" radius={[4,4,0,0]}>{chartData.map((d,i)=>(<Cell key={i} fill={d.margin>=0?C.green:C.red}/>))}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card>
          <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:16}}>{th?"กระแสเงินสด":"Cashflow"}</div>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={chartData} margin={{top:4,right:4,left:0,bottom:0}} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
              <XAxis dataKey="month" tick={{fontSize:11,fill:C.muted}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:11,fill:C.muted}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1e3).toFixed(0)}K`}/>
              <Tooltip content={<Tip currency={cur}/>}/>
              <Bar dataKey="cashIn" name={th?"รายรับ":"In"} fill={C.green} radius={[3,3,0,0]}/>
              <Bar dataKey="cashOut" name={th?"รายจ่าย":"Out"} fill={C.red} radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:16}}>{th?"ตัวชี้วัดสะสม":"Cumulative Metrics"}</div>
          {[
            {label:"YTD Revenue", val:fmt(metrics.YTD_rev,cur), f:`Σ → ${MONTHS[latestIdx].en}`, color:C.green},
            {label:"YTD Net Profit", val:fmt(metrics.YTD_net,cur), f:"YTD Rev − YTD Exp", color:metrics.YTD_net>0?C.green:C.red},
            {label:"LTM Revenue", val:fmt(metrics.LTM_rev,cur), f:"Σ last 12M", color:C.purple},
            {label:"LTM Cash In", val:fmt(metrics.LTM_cash,cur), f:"Σ CashIn 12M", color:C.purple},
            {label:"CAGR Revenue", val:fmtPct(metrics.CAGR_rev), f:"(Y₁/Y₀)−1", color:C.amber},
          ].map((r,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:i<4?`1px solid ${C.border}`:"none"}}>
              <div><div style={{fontSize:13,fontWeight:700,color:C.text}}>{r.label}</div><div style={{fontSize:11,color:C.muted,fontFamily:"monospace"}}>{r.f}</div></div>
              <div style={{fontSize:15,fontWeight:800,color:r.color}}>{r.val}</div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DATA TABLE
// ═══════════════════════════════════════════════════════════
function DataManagerPage({store, companyId, year, lang}) {
  const C = useC();
  const th = lang==="th";
  const company = COMPANIES.find(c=>c.id===companyId);
  const data = DataEngine.getYearData(store, companyId, year);
  const years = DataEngine.getAvailableYears(store, companyId);

  return (
    <div>
      <PageHeader title={th?"ตารางข้อมูล":"Data Table"} subtitle={`${th?company.nameTh:company.nameEn} · ${company.currency} · ${th?"ปีที่มีข้อมูล:":"Years:"} ${years.join(", ")||"-"}`}/>
      <Card style={{padding:0,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"0.8fr 1fr 1fr 1fr 1fr 1fr",padding:"14px 18px",borderBottom:`1px solid ${C.border}`,background:C.surface}}>
          {[th?"เดือน":"Month",th?"รายได้":"Revenue",th?"ค่าใช้จ่าย":"Expense",th?"เงินสดเข้า":"Cash In",th?"เงินสดออก":"Cash Out",th?"เงินกู้":"Loan"].map((h,i)=>(
            <div key={i} style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.04em"}}>{h}</div>
          ))}
        </div>
        {data.map((d,i)=>{
          const empty = d.revenue===0&&d.expense===0&&d.cashIn===0;
          return (
            <div key={i} style={{display:"grid",gridTemplateColumns:"0.8fr 1fr 1fr 1fr 1fr 1fr",padding:"11px 18px",borderBottom:i<11?`1px solid ${C.border}`:"none",alignItems:"center",opacity:empty?0.35:1}}>
              <div style={{fontSize:13,fontWeight:700,color:C.text}}>{MONTHS[i][th?"th":"en"]}</div>
              <div style={{fontSize:13,color:C.green}}>{fmt(d.revenue,company.currency)}</div>
              <div style={{fontSize:13,color:C.red}}>{fmt(d.expense,company.currency)}</div>
              <div style={{fontSize:13,color:C.text}}>{fmt(d.cashIn,company.currency)}</div>
              <div style={{fontSize:13,color:C.text}}>{fmt(d.cashOut,company.currency)}</div>
              <div style={{fontSize:13,color:C.amber}}>{fmt(d.loanBalance,company.currency)}</div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPANIES PAGE — group by industry + group structure + compare
// ═══════════════════════════════════════════════════════════
function CompaniesPage({store, year, lang, onSelect, onCompare}) {
  const C = useC();
  const th = lang==="th";
  const [groupBy, setGroupBy] = useState("industry"); // industry | group
  const [compareList, setCompareList] = useState([]);

  const toggleCompare = (id) => {
    setCompareList(prev => prev.includes(id) ? prev.filter(x=>x!==id) : prev.length<3 ? [...prev,id] : prev);
  };

  // Group companies
  const grouped = useMemo(()=>{
    const map = {};
    COMPANIES.forEach(c=>{
      const key = groupBy==="industry" ? c.industry : c.groupId;
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return map;
  },[groupBy]);

  const getMeta = (key) => groupBy==="industry"
    ? {...INDUSTRIES[key], color:INDUSTRIES[key].color}
    : {th:GROUPS[key].th, en:GROUPS[key].en, icon:"🔗", color:C.accent};

  const CompanyCard = ({c}) => {
    const years = DataEngine.getAvailableYears(store, c.id);
    const months = DataEngine.countMonths(store, c.id, year);
    const rev = DataEngine.yearTotal(store, c.id, year, "revenue");
    const inCompare = compareList.includes(c.id);
    const ind = INDUSTRIES[c.industry];
    return (
      <Card style={{borderTop:`3px solid ${c.type==="parent"?C.accent:C.green}`,position:"relative"}}>
        {/* compare checkbox */}
        <div onClick={(e)=>{e.stopPropagation();toggleCompare(c.id);}}
          style={{position:"absolute",top:14,right:14,width:24,height:24,borderRadius:6,cursor:"pointer",
            border:`2px solid ${inCompare?C.accent:C.border}`,background:inCompare?C.accent:"transparent",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:C.white,fontWeight:700}}>
          {inCompare?"✓":""}
        </div>
        <div onClick={()=>onSelect(c.id)} style={{cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,paddingRight:32}}>
            <div style={{width:38,height:38,borderRadius:10,background:c.type==="parent"?C.accent:C.green,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:"#fff"}}>{c.nameEn[0]}</div>
            <div>
              <div style={{fontSize:14,fontWeight:800,color:C.white}}>{th?c.nameTh:c.nameEn}</div>
              <div style={{fontSize:12,color:C.muted}}>{th?c.nameEn:c.nameTh}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
            <Badge color={c.type==="parent"?C.accent:C.green}>{c.type==="parent"?(th?"บริษัทแม่":"Parent"):(th?"บริษัทย่อย":"Subsidiary")}</Badge>
            <Badge color={ind.color}>{ind.icon} {th?ind.th:ind.en}</Badge>
            <Badge color={C.amber}>{c.currency}</Badge>
          </div>
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:13,color:C.muted}}>{th?`รายได้ปี ${year}`:`${year} Revenue`}</span>
              <span style={{fontSize:13,color:C.text,fontWeight:700}}>{fmt(rev,c.currency)}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:13,color:C.muted}}>{th?"ข้อมูล":"Coverage"}</span>
              <span style={{fontSize:13,fontWeight:700,color:months===12?C.green:months>0?C.amber:C.red}}>{months}/12 {th?"เดือน":"mo"}</span>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const segBtn = (active) => ({padding:"8px 16px",borderRadius:8,border:"none",fontSize:13,fontWeight:700,cursor:"pointer",background:active?C.accent:C.card,color:active?"#fff":C.muted});

  return (
    <div>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:28,fontWeight:800,color:C.white,marginBottom:6}}>{th?"จัดการบริษัท":"Company Management"}</div>
          <div style={{fontSize:15,color:C.muted,fontWeight:500}}>{th?"แยกตามอุตสาหกรรมหรือเครือบริษัท เลือกได้สูงสุด 3 บริษัทเพื่อเปรียบเทียบ":"Group by industry or holding group · select up to 3 to compare"}</div>
        </div>
        {compareList.length>=2 && (
          <button onClick={()=>onCompare(compareList)} style={{padding:"10px 20px",borderRadius:8,background:C.accent,color:"#fff",border:"none",fontSize:14,fontWeight:700,cursor:"pointer"}}>
            ⚖ {th?`เปรียบเทียบ ${compareList.length} บริษัท`:`Compare ${compareList.length}`}
          </button>
        )}
      </div>

      {/* Group toggle */}
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        <button onClick={()=>setGroupBy("industry")} style={segBtn(groupBy==="industry")}>🏭 {th?"ตามอุตสาหกรรม":"By Industry"}</button>
        <button onClick={()=>setGroupBy("group")} style={segBtn(groupBy==="group")}>🔗 {th?"ตามเครือบริษัท":"By Group"}</button>
      </div>

      {Object.entries(grouped).map(([key, comps])=>{
        const meta = getMeta(key);
        const totalRev = comps.reduce((s,c)=>s+DataEngine.yearTotal(store,c.id,year,"revenue"),0);
        return (
          <div key={key} style={{marginBottom:28}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <span style={{fontSize:20}}>{meta.icon}</span>
              <span style={{fontSize:18,fontWeight:800,color:C.white}}>{th?meta.th:meta.en}</span>
              <Badge color={meta.color}>{comps.length} {th?"บริษัท":"cos"}</Badge>
              <span style={{marginLeft:"auto",fontSize:14,color:C.muted}}>{th?"รายได้รวม":"Total"}: <b style={{color:C.text}}>{fmt(totalRev,"THB")}</b></span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
              {comps.map(c=>(<CompanyCard key={c.id} c={c}/>))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPARE PAGE — เปรียบเทียบหลายบริษัท
// ═══════════════════════════════════════════════════════════
function ComparePage({store, companyIds, year, lang, onBack}) {
  const C = useC();
  const th = lang==="th";
  const comps = companyIds.map(id=>COMPANIES.find(c=>c.id===id)).filter(Boolean);
  const COLORS = [C.accent, C.green, C.amber];

  const chartData = MONTHS.map((m,i)=>{
    const row = {month:th?m.th:m.en};
    comps.forEach(c=>{ row[`c${c.id}`] = DataEngine.getYearData(store,c.id,year)[i].revenue; });
    return row;
  });

  const summary = comps.map(c=>{
    const d = DataEngine.getYearData(store,c.id,year);
    const p = DataEngine.getYearData(store,c.id,year-1);
    const ytd = FinanceMath.YTD(d,"revenue");
    return {
      company:c, ytdRev:ytd,
      ytdProfit:FinanceMath.YTD(d,"revenue")-FinanceMath.YTD(d,"expense"),
      margin:ytd?((FinanceMath.YTD(d,"revenue")-FinanceMath.YTD(d,"expense"))/ytd*100):0,
      cagr:FinanceMath.CAGR(FinanceMath.YTD(p,"revenue"),ytd,1),
      ltm:FinanceMath.LTM(d,"revenue"),
    };
  });

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <button onClick={onBack} style={{padding:"8px 14px",borderRadius:8,background:C.card,border:`1px solid ${C.border}`,color:C.text,fontSize:14,fontWeight:600,cursor:"pointer"}}>← {th?"กลับ":"Back"}</button>
        <div>
          <div style={{fontSize:28,fontWeight:800,color:C.white}}>{th?"เปรียบเทียบบริษัท":"Company Comparison"}</div>
          <div style={{fontSize:14,color:C.muted}}>{comps.map(c=>th?c.nameTh:c.nameEn).join(" · ")} · {th?"ปี":"FY"}{year}</div>
        </div>
      </div>

      {/* Revenue comparison chart */}
      <Card style={{marginBottom:16}}>
        <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:16}}>{th?"เปรียบเทียบรายได้รายเดือน":"Monthly Revenue Comparison"}</div>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{top:4,right:4,left:0,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
            <XAxis dataKey="month" tick={{fontSize:11,fill:C.muted}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:11,fill:C.muted}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1e3).toFixed(0)}K`}/>
            <Tooltip content={<Tip currency="THB"/>}/>
            {comps.map((c,i)=>(<Line key={c.id} type="monotone" dataKey={`c${c.id}`} name={th?c.nameTh:c.nameEn} stroke={COLORS[i]} strokeWidth={2.5} dot={false}/>))}
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* Comparison table */}
      <Card>
        <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:16}}>{th?"ตารางเปรียบเทียบตัวชี้วัด":"Metrics Comparison"}</div>
        <div style={{overflowX:"auto"}}>
          <div style={{display:"grid",gridTemplateColumns:`1.4fr repeat(${comps.length},1fr)`,gap:12,minWidth:400}}>
            <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",paddingBottom:10,borderBottom:`1px solid ${C.border}`}}>{th?"ตัวชี้วัด":"Metric"}</div>
            {summary.map((s,i)=>(
              <div key={i} style={{fontSize:13,fontWeight:800,color:COLORS[i],paddingBottom:10,borderBottom:`1px solid ${C.border}`}}>{th?s.company.nameTh:s.company.nameEn}</div>
            ))}
            {[
              {label:th?"รายได้ YTD":"YTD Revenue", get:s=>fmt(s.ytdRev,s.company.currency)},
              {label:th?"กำไร YTD":"YTD Profit", get:s=>fmt(s.ytdProfit,s.company.currency)},
              {label:th?"Margin %":"Margin %", get:s=>`${s.margin.toFixed(1)}%`},
              {label:"CAGR", get:s=>fmtPct(s.cagr)},
              {label:"LTM Revenue", get:s=>fmt(s.ltm,s.company.currency)},
            ].map((row,ri)=>(
              <Fragment key={ri}>
                <div style={{fontSize:13,color:C.muted,fontWeight:600,padding:"10px 0"}}>{row.label}</div>
                {summary.map((s,i)=>(<div key={i} style={{fontSize:14,fontWeight:700,color:C.text,padding:"10px 0"}}>{row.get(s)}</div>))}
              </Fragment>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CONSOLIDATION
// ═══════════════════════════════════════════════════════════
function ConsolidationPage({store, year, lang}) {
  const C = useC();
  const th = lang==="th";
  const [scope, setScope] = useState("all"); // all | group | industry key

  const filteredCompanies = useMemo(()=>{
    if (scope==="all") return COMPANIES;
    if (scope.startsWith("grp:")) return COMPANIES.filter(c=>c.groupId===scope.slice(4));
    if (scope.startsWith("ind:")) return COMPANIES.filter(c=>c.industry===scope.slice(4));
    return COMPANIES;
  },[scope]);

  const consolidated = useMemo(()=>{
    return MONTHS.map((m,i)=>{
      let rev=0,exp=0,cin=0,cout=0;
      filteredCompanies.forEach(c=>{ const d=DataEngine.getYearData(store,c.id,year)[i]; rev+=d.revenue;exp+=d.expense;cin+=d.cashIn;cout+=d.cashOut; });
      return {month:th?m.th:m.en, revenue:rev, expense:exp, cashIn:cin, cashOut:cout};
    });
  },[store,year,th,filteredCompanies]);

  const total = consolidated.reduce((a,d)=>({rev:a.rev+d.revenue,exp:a.exp+d.expense,cin:a.cin+d.cashIn}),{rev:0,exp:0,cin:0});
  const selStyle = {background:C.card,border:`1px solid ${C.border}`,color:C.text,padding:"9px 14px",borderRadius:8,fontSize:14,fontWeight:600,cursor:"pointer",outline:"none"};

  return (
    <div>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:28,fontWeight:800,color:C.white,marginBottom:6}}>{th?"งบการเงินรวม":"Consolidated Financials"}</div>
          <div style={{fontSize:15,color:C.muted,fontWeight:500}}>{th?"เลือกขอบเขตการรวมงบ":"Choose consolidation scope"} · {th?"ปี":"FY"}{year}</div>
        </div>
        <select value={scope} onChange={e=>setScope(e.target.value)} style={selStyle}>
          <option value="all">{th?"ทุกบริษัท":"All Companies"}</option>
          <optgroup label={th?"ตามเครือ":"By Group"}>
            {Object.entries(GROUPS).map(([k,g])=>(<option key={k} value={`grp:${k}`}>{th?g.th:g.en}</option>))}
          </optgroup>
          <optgroup label={th?"ตามอุตสาหกรรม":"By Industry"}>
            {Object.entries(INDUSTRIES).filter(([k])=>COMPANIES.some(c=>c.industry===k)).map(([k,ind])=>(<option key={k} value={`ind:${k}`}>{ind.icon} {th?ind.th:ind.en}</option>))}
          </optgroup>
        </select>
      </div>
      <div style={{fontSize:12,color:C.amber,marginBottom:20,padding:"6px 12px",background:C.amberLo,borderRadius:6,display:"inline-block",fontWeight:600}}>{th?`※ รวม ${filteredCompanies.length} บริษัท · nominal sum — production ควรแปลง USD→THB ก่อนรวม`:`※ ${filteredCompanies.length} companies · nominal sum`}</div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:16}}>
        {[
          {label:th?"รายได้รวม":"Total Revenue",val:total.rev,c:C.accent},
          {label:th?"ค่าใช้จ่ายรวม":"Total Expense",val:total.exp,c:C.red},
          {label:th?"เงินสดรับรวม":"Total Cash In",val:total.cin,c:C.green},
          {label:th?"กำไรรวม":"Total Profit",val:total.rev-total.exp,c:C.purple},
        ].map((k,i)=>(
          <Card key={i} style={{borderLeft:`4px solid ${k.c}`}}>
            <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:6,textTransform:"uppercase"}}>{k.label}</div>
            <div style={{fontSize:22,fontWeight:800,color:C.white}}>{fmt(k.val,"THB")}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:16}}>{th?"รายได้รวมรายเดือน":"Monthly Consolidated Revenue"}</div>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={consolidated} margin={{top:4,right:4,left:0,bottom:0}}>
            <defs><linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.accent} stopOpacity={0.4}/><stop offset="95%" stopColor={C.accent} stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
            <XAxis dataKey="month" tick={{fontSize:11,fill:C.muted}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:11,fill:C.muted}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1e6).toFixed(1)}M`}/>
            <Tooltip content={<Tip currency="THB"/>}/>
            <Area type="monotone" dataKey="revenue" name={th?"รายได้รวม":"Revenue"} stroke={C.accent} fill="url(#gc)" strokeWidth={2.5}/>
            <Line type="monotone" dataKey="expense" name={th?"ค่าใช้จ่ายรวม":"Expense"} stroke={C.red} strokeWidth={2} strokeDasharray="4 2" dot={false}/>
          </ComposedChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// INDUSTRY ANALYSIS — วิเคราะห์รายอุตสาหกรรม
// ═══════════════════════════════════════════════════════════
function IndustryPage({store, year, lang}) {
  const C = useC();
  const th = lang==="th";

  const industryStats = useMemo(()=>{
    return Object.entries(INDUSTRIES).filter(([k])=>COMPANIES.some(c=>c.industry===k)).map(([key,ind])=>{
      const comps = COMPANIES.filter(c=>c.industry===key);
      let rev=0, exp=0;
      comps.forEach(c=>{ rev+=DataEngine.yearTotal(store,c.id,year,"revenue"); exp+=DataEngine.yearTotal(store,c.id,year,"expense"); });
      return { key, ind, count:comps.length, revenue:rev, expense:exp, profit:rev-exp, margin:rev?((rev-exp)/rev*100):0 };
    });
  },[store,year]);

  const totalRev = industryStats.reduce((s,i)=>s+i.revenue,0);
  const barData = industryStats.map(s=>({name:th?s.ind.th:s.ind.en, revenue:s.revenue, profit:s.profit, color:s.ind.color}));
  const radarData = industryStats.map(s=>({industry:th?s.ind.th:s.ind.en, margin:Math.round(s.margin)}));

  return (
    <div>
      <PageHeader title={th?"วิเคราะห์รายอุตสาหกรรม":"Industry Analysis"} subtitle={th?"เปรียบเทียบผลประกอบการแต่ละกลุ่มอุตสาหกรรม":"Compare performance across industry sectors"}/>

      {/* Industry KPI cards */}
      <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(industryStats.length,4)},1fr)`,gap:14,marginBottom:16}}>
        {industryStats.map((s,i)=>(
          <Card key={i} style={{borderTop:`3px solid ${s.ind.color}`}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <span style={{fontSize:20}}>{s.ind.icon}</span>
              <span style={{fontSize:14,fontWeight:800,color:C.white}}>{th?s.ind.th:s.ind.en}</span>
            </div>
            <div style={{fontSize:22,fontWeight:800,color:C.white,marginBottom:6}}>{fmt(s.revenue,"THB")}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:8}}>{s.count} {th?"บริษัท":"companies"} · {th?"ส่วนแบ่ง":"share"} {totalRev?((s.revenue/totalRev)*100).toFixed(0):0}%</div>
            <div style={{display:"flex",gap:6}}>
              <Badge color={s.margin>0?C.green:C.red}>{th?"Margin":"Margin"} {s.margin.toFixed(1)}%</Badge>
            </div>
          </Card>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:16}}>
        <Card>
          <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:16}}>{th?"รายได้ vs กำไร รายอุตสาหกรรม":"Revenue vs Profit by Industry"}</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{top:4,right:4,left:0,bottom:0}} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
              <XAxis dataKey="name" tick={{fontSize:11,fill:C.muted}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:11,fill:C.muted}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1e6).toFixed(0)}M`}/>
              <Tooltip content={<Tip currency="THB"/>}/>
              <Bar dataKey="revenue" name={th?"รายได้":"Revenue"} radius={[4,4,0,0]}>{barData.map((d,i)=>(<Cell key={i} fill={d.color}/>))}</Bar>
              <Bar dataKey="profit" name={th?"กำไร":"Profit"} radius={[4,4,0,0]} fill={C.muted} fillOpacity={0.5}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:16}}>{th?"เปรียบเทียบ Margin %":"Margin % Comparison"}</div>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke={C.border}/>
              <PolarAngleAxis dataKey="industry" tick={{fontSize:11,fill:C.muted}}/>
              <PolarRadiusAxis tick={{fontSize:10,fill:C.muted}} stroke={C.border}/>
              <Radar name="Margin %" dataKey="margin" stroke={C.accent} fill={C.accent} fillOpacity={0.35}/>
              <Tooltip content={({active,payload})=>active&&payload?.length?(<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:13}}><span style={{color:C.accent}}>Margin: {payload[0]?.value}%</span></div>):null}/>
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SLIDE TEMPLATE
// ═══════════════════════════════════════════════════════════
function SlideViewer({store, companyId, year, lang}) {
  const C = useC();
  const th = lang==="th";
  const company = COMPANIES.find(c=>c.id===companyId);
  const cur = company.currency;
  const data = DataEngine.getYearData(store, companyId, year);
  const prev = DataEngine.getYearData(store, companyId, year-1);
  const hasData = DataEngine.countMonths(store, companyId, year) > 0;
  const SD = "#0F1528", ST = "#E4E8FF", SM = "#6B7299", SB = "#252A42";

  const latestIdx = useMemo(()=>{
    const m = Object.keys(store?.[companyId]?.[year]||{}).map(Number);
    return m.length ? Math.max(...m) : 5;
  },[store,companyId,year]);

  const m = useMemo(()=>{
    const latest = data[latestIdx], prevMon = latestIdx>0?data[latestIdx-1]:null;
    return {
      revenue:latest.revenue, expense:latest.expense, cashIn:latest.cashIn,
      netProfit:FinanceMath.netProfit(latest), margin:FinanceMath.margin(latest), loanBal:latest.loanBalance,
      MOM_rev:prevMon?FinanceMath.MOM(latest.revenue,prevMon.revenue):null,
      YOY_rev:prev[latestIdx].revenue?FinanceMath.YOY(latest.revenue,prev[latestIdx].revenue):null,
      QOQ_rev:FinanceMath.QOQ(data,"revenue",Math.floor(latestIdx/3)),
      YTD_rev:FinanceMath.YTD(data.slice(0,latestIdx+1),"revenue"),
      LTM_rev:FinanceMath.LTM(data,"revenue"),
      CAGR_rev:FinanceMath.CAGR(FinanceMath.YTD(prev,"revenue"),FinanceMath.YTD(data,"revenue"),1),
    };
  },[data,prev,latestIdx]);

  const SLIDES = [
    {id:1,type:"cover",th:"หน้าปก",en:"Cover"},
    {id:2,type:"executive",th:"สรุปผู้บริหาร",en:"Executive Summary"},
    {id:3,type:"momentum",th:"โมเมนตัม",en:"Momentum"},
    {id:4,type:"cashflow",th:"กระแสเงินสด",en:"Cashflow"},
  ];
  const [activeSlide, setActiveSlide] = useState(1);
  const slide = SLIDES[activeSlide-1];

  if (!hasData) {
    return (
      <Card style={{textAlign:"center",padding:48}}>
        <div style={{fontSize:34,marginBottom:12}}>🖥</div>
        <div style={{fontSize:18,fontWeight:700,color:C.white,marginBottom:6}}>{th?"ยังไม่มีข้อมูลสำหรับสร้างสไลด์":"No data to generate slides"}</div>
        <div style={{fontSize:14,color:C.muted}}>{th?"อัปโหลดข้อมูลของบริษัทนี้ก่อน":"Upload data first"}</div>
      </Card>
    );
  }

  const sbase = {width:"100%",aspectRatio:"16/9",background:SD,borderRadius:12,overflow:"hidden",position:"relative",fontFamily:F.sans};
  const clrP = (n)=>n===null||isNaN(n)?SM:n>0?"#1FD9A4":n<0?"#F7637C":SM;

  const renderSlide = () => {
    if (slide.type==="cover") return (
      <div style={{...sbase,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",background:"linear-gradient(135deg,#0F1528 0%,#1a1f40 100%)"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:4,background:"linear-gradient(90deg,#5B7CFA,#1FD9A4)"}}/>
        <div style={{textAlign:"center",padding:40}}>
          <div style={{fontSize:11,color:"#5B7CFA",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:16,fontWeight:700}}>MONTHLY FINANCIAL REPORT</div>
          <div style={{fontSize:34,fontWeight:800,color:"#fff",marginBottom:8}}>{th?company.nameTh:company.nameEn}</div>
          <div style={{fontSize:17,color:SM,marginBottom:32}}>{MONTHS[latestIdx][th?"th":"en"]} {year} (พ.ศ.{year+543})</div>
          <div style={{display:"flex",gap:20,justifyContent:"center"}}>
            {[{l:th?"รายได้ YTD":"YTD Revenue",v:fmt(m.YTD_rev,cur)},{l:"Margin",v:`${m.margin.toFixed(1)}%`},{l:"CAGR",v:fmtPct(m.CAGR_rev)}].map((s,i)=>(
              <div key={i} style={{textAlign:"center",padding:"12px 20px",border:`1px solid ${SB}`,borderRadius:10,background:"#ffffff08"}}>
                <div style={{fontSize:11,color:SM,marginBottom:4}}>{s.l}</div><div style={{fontSize:19,fontWeight:800,color:"#fff"}}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{position:"absolute",bottom:18,left:0,right:0,textAlign:"center",fontSize:11,color:SM}}>CONFIDENTIAL · FinAnalytics</div>
      </div>
    );
    if (slide.type==="executive") return (
      <div style={{...sbase,padding:32}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#5B7CFA,#1FD9A4)"}}/>
        <div style={{fontSize:11,color:"#5B7CFA",letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:8}}>EXECUTIVE SUMMARY</div>
        <div style={{fontSize:21,fontWeight:800,color:"#fff",marginBottom:18}}>{th?"สรุปผู้บริหาร":"Key Highlights"} · {MONTHS[latestIdx][th?"th":"en"]} {year}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
          {[{l:th?"รายได้":"Revenue",v:fmt(m.revenue,cur),mom:m.MOM_rev,yoy:m.YOY_rev,c:"#5B7CFA"},{l:th?"กำไรสุทธิ":"Net Profit",v:fmt(m.netProfit,cur),sub:`Margin ${m.margin.toFixed(1)}%`,c:"#1FD9A4"},{l:th?"เงินสดรับ":"Cash In",v:fmt(m.cashIn,cur),c:"#A78BFA"}].map((k,i)=>(
            <div key={i} style={{background:"#ffffff06",border:`1px solid ${SB}`,borderRadius:10,padding:14,borderTop:`2px solid ${k.c}`}}>
              <div style={{fontSize:10,color:SM,marginBottom:4,textTransform:"uppercase"}}>{k.l}</div>
              <div style={{fontSize:17,fontWeight:800,color:"#fff",marginBottom:6}}>{k.v}</div>
              {k.mom!=null && <div style={{fontSize:11,color:clrP(k.mom)}}>MOM {fmtPct(k.mom)}</div>}
              {k.yoy!=null && <div style={{fontSize:11,color:clrP(k.yoy)}}>YOY {fmtPct(k.yoy)}</div>}
              {k.sub && <div style={{fontSize:11,color:SM}}>{k.sub}</div>}
            </div>
          ))}
        </div>
        <div style={{background:"#ffffff06",border:`1px solid ${SB}`,borderRadius:10,padding:14}}>
          <div style={{fontSize:11,color:SM,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.05em"}}>{th?"ตัวชี้วัดสะสม":"Cumulative Indicators"}</div>
          <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
            {[{l:"YTD Revenue",v:fmt(m.YTD_rev,cur)},{l:"LTM Revenue",v:fmt(m.LTM_rev,cur)},{l:"CAGR",v:fmtPct(m.CAGR_rev),c:clrP(m.CAGR_rev)},{l:th?"ยอดกู้":"Loan",v:fmt(m.loanBal,cur)}].map((s,i)=>(
              <div key={i}><div style={{fontSize:10,color:SM}}>{s.l}</div><div style={{fontSize:15,fontWeight:800,color:s.c||ST}}>{s.v}</div></div>
            ))}
          </div>
        </div>
      </div>
    );
    if (slide.type==="momentum") return (
      <div style={{...sbase,padding:32}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#A78BFA,#F7B84F)"}}/>
        <div style={{fontSize:11,color:"#A78BFA",letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:8}}>MOMENTUM & TREND</div>
        <div style={{fontSize:21,fontWeight:800,color:"#fff",marginBottom:18}}>{th?"วิเคราะห์โมเมนตัม":"Momentum Dashboard"}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
          {[{id:"MOM",d:th?"เทียบเดือน":"vs Month",v:m.MOM_rev,f:"(M₁-M₀)/|M₀|",c:"#5B7CFA"},{id:"QOQ",d:th?"เทียบไตรมาส":"vs Qtr",v:m.QOQ_rev,f:"(Q₁-Q₀)/|Q₀|",c:"#5B7CFA"},{id:"YOY",d:th?"เทียบปี":"vs Year",v:m.YOY_rev,f:"(Y₁-Y₀)/|Y₀|",c:"#1FD9A4"},{id:"CAGR",d:th?"เติบโตเฉลี่ย":"Growth",v:m.CAGR_rev,f:"(E/S)^⅟ₙ-1",c:"#A78BFA"}].map((k,i)=>(
            <div key={i} style={{background:"#ffffff06",border:`1px solid ${k.c}40`,borderRadius:10,padding:14,textAlign:"center"}}>
              <div style={{fontSize:11,fontWeight:800,color:k.c,marginBottom:2}}>{k.id}</div>
              <div style={{fontSize:10,color:SM,marginBottom:10}}>{k.d}</div>
              <div style={{fontSize:23,fontWeight:800,color:clrP(k.v),marginBottom:6}}>{fmtPct(k.v)}</div>
              <div style={{fontSize:9,color:SM,fontFamily:"monospace"}}>{k.f}</div>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
          {[{id:"MTD",d:th?"สะสมเดือน":"Month",v:m.revenue,c:"#1FD9A4"},{id:"YTD",d:th?"สะสมปี":"Year",v:m.YTD_rev,c:"#1FD9A4"},{id:"LTM",d:th?"12 เดือน":"Rolling",v:m.LTM_rev,c:"#A78BFA"}].map((k,i)=>(
            <div key={i} style={{background:"#ffffff06",border:`1px solid ${k.c}40`,borderRadius:10,padding:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:11,fontWeight:800,color:k.c}}>{k.id}</div><div style={{fontSize:10,color:SM}}>{k.d}</div></div>
              <div style={{fontSize:15,fontWeight:800,color:ST}}>{fmt(k.v,cur)}</div>
            </div>
          ))}
        </div>
      </div>
    );
    return (
      <div style={{...sbase,padding:32}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#1FD9A4,#5B7CFA)"}}/>
        <div style={{fontSize:11,color:"#1FD9A4",letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:8}}>CASHFLOW</div>
        <div style={{fontSize:21,fontWeight:800,color:"#fff",marginBottom:18}}>{th?"กระแสเงินสดรายเดือน":"Monthly Cashflow"}</div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data.map(d=>({month:th?d.monthTh:d.monthEn,cashIn:d.cashIn,cashOut:d.cashOut}))} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke={SB} vertical={false}/>
            <XAxis dataKey="month" tick={{fontSize:10,fill:SM}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:10,fill:SM}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1e3).toFixed(0)}K`}/>
            <Tooltip content={<Tip currency={cur}/>}/>
            <Bar dataKey="cashIn" name={th?"รายรับ":"In"} fill="#1FD9A4" radius={[3,3,0,0]}/>
            <Bar dataKey="cashOut" name={th?"รายจ่าย":"Out"} fill="#F7637C" radius={[3,3,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:28,fontWeight:800,color:C.white,marginBottom:6}}>Slide Master Template</div>
          <div style={{fontSize:15,color:C.muted,fontWeight:500}}>{th?"เทมเพลตนำเสนอ — ข้อมูลผูกสูตรจริงจากบริษัทที่เลือก":"Presentation template — bound to selected company"}</div>
        </div>
        <button style={{padding:"10px 20px",borderRadius:8,background:C.accent,color:"#fff",border:"none",fontSize:14,fontWeight:700,cursor:"pointer"}}>⬇ {th?"ส่งออก PPTX":"Export PPTX"}</button>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16,overflowX:"auto",paddingBottom:4}}>
        {SLIDES.map(s=>(
          <div key={s.id} onClick={()=>setActiveSlide(s.id)} style={{flexShrink:0,width:130,cursor:"pointer",border:`2px solid ${activeSlide===s.id?C.accent:C.border}`,borderRadius:8,overflow:"hidden"}}>
            <div style={{background:SD,aspectRatio:"16/9",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",padding:8}}>
              <div style={{fontSize:8,color:"#5B7CFA",letterSpacing:"0.1em",marginBottom:4}}>SLIDE {s.id}</div>
              <div style={{fontSize:10,color:ST,textAlign:"center",fontWeight:700}}>{th?s.th:s.en}</div>
            </div>
          </div>
        ))}
      </div>
      {renderSlide()}
      <Card style={{marginTop:12}}>
        <div style={{fontSize:12,color:C.muted,fontWeight:700,marginBottom:6}}>{th?"หมายเหตุสไลด์":"Slide Notes"}</div>
        <div style={{fontSize:13,color:C.text,lineHeight:1.7}}>{th?`สร้างจากข้อมูลจริงของ ${company.nameTh} ปี ${year} — ทุกตัวเลขผูกสูตรพิสูจน์ได้ อัปเดตอัตโนมัติเมื่ออัปโหลดข้อมูลใหม่`:`Generated from live data of ${company.nameEn} ${year} — formula-verified, auto-updates.`}</div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════
const NAV = [
  {id:"momentum", icon:"⚡", th:"Momentum", en:"Momentum"},
  {id:"upload", icon:"⬆", th:"อัปโหลดงบ", en:"Upload Data"},
  {id:"data", icon:"▦", th:"ตารางข้อมูล", en:"Data Table"},
  {id:"companies", icon:"🏢", th:"บริษัท", en:"Companies"},
  {id:"industry", icon:"🏭", th:"รายอุตสาหกรรม", en:"Industry"},
  {id:"consolidation", icon:"⊞", th:"งบรวม", en:"Consolidation"},
  {id:"slides", icon:"🖥", th:"Slide Template", en:"Slide Template"},
];

export default function App() {
  const [page, setPage] = useState("momentum");
  const [lang, setLang] = useState("th");
  const [theme, setTheme] = useState("dark");
  const [companyId, setCompanyId] = useState(1);
  const [year, setYear] = useState(2026);
  const [store, setStore] = useState(INITIAL_STORE);
  const [compareIds, setCompareIds] = useState([]);

  const C = THEMES[theme];
  const th = lang==="th";
  const company = COMPANIES.find(c=>c.id===companyId);

  const handleUpsert = (cid, yr, rows) => {
    const result = DataEngine.upsert(store, cid, yr, rows);
    setStore(result.store);
    return result;
  };

  const renderPage = () => {
    if (page==="momentum") return <MomentumDashboard store={store} companyId={companyId} year={year} lang={lang}/>;
    if (page==="upload") return <UploadPage store={store} onUpsert={handleUpsert} lang={lang} defaultCompany={companyId} defaultYear={year}/>;
    if (page==="data") return <DataManagerPage store={store} companyId={companyId} year={year} lang={lang}/>;
    if (page==="companies") return <CompaniesPage store={store} year={year} lang={lang} onSelect={(id)=>{setCompanyId(id);setPage("momentum");}} onCompare={(ids)=>{setCompareIds(ids);setPage("compare");}}/>;
    if (page==="compare") return <ComparePage store={store} companyIds={compareIds} year={year} lang={lang} onBack={()=>setPage("companies")}/>;
    if (page==="industry") return <IndustryPage store={store} year={year} lang={lang}/>;
    if (page==="consolidation") return <ConsolidationPage store={store} year={year} lang={lang}/>;
    if (page==="slides") return <SlideViewer store={store} companyId={companyId} year={year} lang={lang}/>;
  };

  const selStyle = {width:"100%",background:C.card,border:`1px solid ${C.border}`,color:C.text,padding:"8px 11px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",outline:"none"};

  return (
    <ThemeCtx.Provider value={C}>
    <div style={{display:"flex",height:"100vh",background:C.bg,fontFamily:F.sans,color:C.text,overflow:"hidden",transition:"background 0.3s"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px;}
        button{transition:opacity 0.15s,background 0.2s;} button:hover{opacity:0.85;}
        select option{background:${C.surface};color:${C.text};}
      `}</style>

      {/* SIDEBAR — bigger fonts, bolder */}
      <div style={{width:248,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0,transition:"background 0.3s"}}>
        <div style={{padding:"20px 20px 16px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:11}}>
            <div style={{width:34,height:34,borderRadius:9,background:`linear-gradient(135deg,${C.accent},${C.green})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:"#fff"}}>F</div>
            <div><div style={{fontSize:16,fontWeight:800,color:C.white}}>FinAnalytics</div><div style={{fontSize:11,color:C.muted}}>Financial Platform</div></div>
          </div>
        </div>

        <div style={{padding:"12px 10px",flex:1,overflowY:"auto"}}>
          {NAV.map(n=>(
            <div key={n.id} onClick={()=>setPage(n.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,cursor:"pointer",marginBottom:3,
              fontSize:15,fontWeight:page===n.id?800:600,color:page===n.id?C.white:C.muted,
              background:page===n.id?C.accentLo:"transparent",borderLeft:page===n.id?`3px solid ${C.accent}`:"3px solid transparent"}}>
              <span style={{fontSize:17}}>{n.icon}</span><span>{th?n.th:n.en}</span>
            </div>
          ))}
        </div>

        <div style={{padding:"14px 14px",borderTop:`1px solid ${C.border}`}}>
          {/* Theme toggle */}
          <div style={{display:"flex",gap:6,marginBottom:12}}>
            {[{k:"dark",ic:"🌙",l:th?"มืด":"Dark"},{k:"light",ic:"☀️",l:th?"สว่าง":"Light"}].map(t=>(
              <button key={t.k} onClick={()=>setTheme(t.k)} style={{flex:1,padding:"8px",borderRadius:8,border:`1px solid ${theme===t.k?C.accent:C.border}`,fontSize:12,fontWeight:700,cursor:"pointer",background:theme===t.k?C.accentLo:"transparent",color:theme===t.k?C.accent:C.muted}}>
                {t.ic} {t.l}
              </button>
            ))}
          </div>
          <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6,fontWeight:700}}>{th?"บริษัท":"Company"}</div>
          <select value={companyId} onChange={e=>setCompanyId(Number(e.target.value))} style={{...selStyle,marginBottom:8}}>
            {COMPANIES.map(c=>(<option key={c.id} value={c.id}>{th?c.nameTh:c.nameEn}</option>))}
          </select>
          <select value={year} onChange={e=>setYear(Number(e.target.value))} style={selStyle}>
            {[2023,2024,2025,2026].map(y=>(<option key={y} value={y}>{y} (พ.ศ.{y+543})</option>))}
          </select>
          <div style={{display:"flex",gap:5,marginTop:10}}>
            {["th","en"].map(l=>(
              <button key={l} onClick={()=>setLang(l)} style={{flex:1,padding:"6px",borderRadius:7,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",background:lang===l?C.accent:C.border,color:lang===l?"#fff":C.muted}}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{height:58,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",background:C.surface,flexShrink:0,transition:"background 0.3s"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:14,color:C.muted}}>{th?"บริษัท:":"Company:"}</span>
            <span style={{fontSize:14,fontWeight:800,color:C.white}}>{th?company.nameTh:company.nameEn}</span>
            <Badge color={INDUSTRIES[company.industry].color}>{INDUSTRIES[company.industry].icon} {th?INDUSTRIES[company.industry].th:INDUSTRIES[company.industry].en}</Badge>
            <Badge color={C.amber}>{company.currency}</Badge>
            <Badge color={C.accent}>{th?"ปี":"FY"}{year}</Badge>
          </div>
          <div style={{fontSize:13,color:C.muted}}>{new Date().toLocaleDateString(th?"th-TH":"en-GB",{day:"numeric",month:"short",year:"numeric"})}</div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:26}}>{renderPage()}</div>
      </div>
    </div>
    </ThemeCtx.Provider>
  );
}
