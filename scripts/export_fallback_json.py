import openpyxl
import json
from datetime import datetime, date

EXCEL_PATH = r"d:\ANTIGRAVITY APPs\Web ROV Workshop\Track Record.xlsx"
SHEET_NAME = "Clean Data"
OUT_PATH = r"d:\ANTIGRAVITY APPs\Web ROV Workshop\lib\track-records-fallback.json"

def safe_str(v):
    if v is None: return None
    s = str(v).strip()
    return s if s else None

def safe_float(v):
    if v is None: return None
    try:
        return float(str(v).replace(",", ""))
    except Exception:
        return None

def safe_int(v):
    f = safe_float(v)
    return int(f) if f is not None else None

def safe_date(v):
    if v is None: return None
    if isinstance(v, (datetime, date)):
        return v.strftime("%Y-%m-%d")
    s = str(v).strip()
    if not s or s.startswith("="): return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None

def calc_duration(start, end, raw_duration):
    raw_d = safe_int(raw_duration)
    if raw_d is not None and raw_d >= 0:
        return raw_d
    if start and end:
        try:
            d1 = datetime.strptime(start, "%Y-%m-%d")
            d2 = datetime.strptime(end, "%Y-%m-%d")
            days = (d2 - d1).days + 1
            if days >= 0:
                return days
        except Exception:
            pass
    return None

wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
ws = wb[SHEET_NAME]

records = []
row_idx = 1
for row in ws.iter_rows(min_row=2, values_only=True):
    if all(v is None for v in row): continue
    def get(i): return row[i] if i < len(row) else None
    
    start = safe_date(get(4))
    end = safe_date(get(5))
    dur = calc_duration(start, end, get(6))
    
    rec = {
        "id": row_idx,
        "no": safe_int(get(0)),
        "client": safe_str(get(1)),
        "contract": safe_str(get(2)),
        "project_task": safe_str(get(3)),
        "start_date": start,
        "end_date": end,
        "duration_days": dur,
        "client_contact_person": safe_str(get(7)),
        "client_contact_phone": safe_str(get(8)),
        "project_sow": safe_str(get(9)),
        "location": safe_str(get(10)),
        "total_project_cost_usd": safe_float(get(11)),
        "water_depth_min_msw": safe_float(get(12)),
        "water_depth_max_msw": safe_float(get(13)),
        "rov_system": safe_str(get(14)),
        "vessel_rig": safe_str(get(15)),
        "class": safe_str(get(16)),
        "created_by": "Excel fallback",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }
    records.append(rec)
    row_idx += 1

with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

total_days = sum(r["duration_days"] or 0 for r in records)
total_cost = sum(r["total_project_cost_usd"] or 0 for r in records)
print(f"Generated {len(records)} records. Total days: {total_days}, Total cost: {total_cost}")
