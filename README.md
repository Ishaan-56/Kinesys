# Kinesys – Precision Neurological & Cognitive Screening Suite

> **Zero-Hardware Digital Biomarker Discovery Engine**  
> Converts ordinary keyboard and mouse micro-interactions into non-invasive, longitudinal telemetry for early detection of neurological and motor-cognitive pattern changes.

---

## 📌 Project Overview

**Kinesys** is a browser-native clinical screening platform built on published neurological research (such as *neuroQWERTY* keystroke dynamics and Corsi spatial memory protocols). It captures sub-visual motor and executive timing patterns using standard consumer hardware — without requiring wearables, hospital visits, or specialized sensors.

Biological markers for neurodegenerative conditions like Parkinson's and Alzheimer's begin shifting 5 to 10 years before visible clinical symptoms appear. Kinesys provides a continuous, frictionless screening suite designed for early detection, personal baseline tracking, and remote physician decision support.

---

## ⚡ Key Features

- **9 Research-Backed Assessment Protocols**:
  1. ⌨️ **Typing Rhythm** — Keystroke dynamics (hold-time & flight-time variability).
  2. 🎹 **Tap Sync** — Alternating key tapping frequency and bradykinesia measurement.
  3. 🌀 **Path Trace** — Archimedes spiral tracing for action tremor and movement jerk.
  4. 🎯 **Steady Hold** — Cursor micro-steadiness, postural stability, and static-movement detection.
  5. ⚡ **Flash React** — Go/No-Go reaction time variability and response inhibition.
  6. 🧩 **Sequence Recall** — Corsi block spatial working memory span.
  7. 🔗 **Trail Connect** — Trail Making Test (Parts A & B) executive switching speed.
  8. 💬 **Word Spark** — Verbal fluency prompt-to-type reaction latency.
  9. 👁️ **Focus Watch** — Continuous Performance Test (CPT) sustained attention and $d'$ sensitivity index.

- **5-Layer Defense-in-Depth Diagnostic Architecture**:
  - **Layer 1**: Microsecond timing precision (`performance.now()`) with 2.5 SD outlier rejection & physiological boundary gates.
  - **Layer 2**: **Ipsative (Self-Referential) Scoring** — Never compares against population averages. Baseline locks after 3 sessions, anchoring baseline score at **50.0**.
  - **Layer 3**: Gated 3-session floor required before generating trend signals.
  - **Layer 4**: **Multi-Signal Domain Concurrence** — Requires $\ge 2$ independent signals within a skill domain to drift concurrently by $\ge 25\%$ before triggering an alert.
  - **Layer 5**: Dual-surface rendering (calm domain language for patients; raw CV, Skewness, Kurtosis, and condition markers for doctors).

- **Physician Portal & Consultation Log**:
  - Dedicated doctor portal (`/doctor`) to review patient rosters, inspect condition-correlated markers, and exchange live AJAX consultation notes.

- **High-Contrast Print Reports**:
  - Dedicated `@media print` layout formatting patient data, domain breakdown matrix, doctor notes, and clinical disclaimers into clean 1–2 page PDF reports.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.9+, Flask, SQLite3
- **Frontend**: Vanilla JavaScript (ES6+), HTML5 Canvas, Chart.js
- **Design System**: Cyber-Clinical Teal & Electric Emerald CSS (`/static/css/style.css`)

---

## 🚀 Setup & Installation Guide

### Prerequisites
- [Python 3.9+](https://www.python.org/downloads/) installed on your machine.
- Git (optional, for cloning).

### 1. Navigate to Project Directory
```bash
cd "d:/IshaanGupta/Anything_else/PROGRAMMING/FUN PROJECTS/bvc_hackathon/website"
```

### 2. Set Up Virtual Environment (Recommended)
```bash
# Windows (PowerShell)
python -m venv venv
.\venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the Application
```bash
python app.py
```

### 5. Access the Web Application
Open your web browser and navigate to:
```text
http://127.0.0.1:5000
```

---

## 📂 Project Structure

```text
website/
├── app.py                  # Flask application server & API endpoints
├── db.py                   # SQLite database layer, tables & queries
├── features.py             # Feature extraction, ipsative scoring & diagnostic engine
├── neurotype.db            # SQLite database file (created automatically)
├── requirements.txt        # Python dependency manifest
├── README.md               # Project documentation
│
├── static/
│   ├── css/
│   │   └── style.css       # Cyber-Clinical Teal design system
│   └── js/
│       ├── api.js          # Centralized API fetch wrapper
│       ├── main.js         # Game hub orchestrator & in-page trends
│       ├── dashboard.js    # Diagnostic dashboard & print logic
│       └── games/          # 9 Game protocol JavaScript modules
│           ├── typing.js
│           ├── tapsync.js
│           ├── pathtrace.js
│           ├── steadyhold.js
│           ├── flashreact.js
│           ├── sequence.js
│           ├── trailmaking.js
│           ├── wordspark.js
│           └── focuswatch.js
│
└── templates/              # HTML Jinja templates
    ├── landing.html        # Landing page with ECG waveform & stats
    ├── app.html            # Game assessment hub
    ├── dashboard.html      # Longitudinal diagnostic dashboard
    └── doctor.html         # Physician clinical portal
```

---

## ⚖️ Clinical Disclaimer

*Kinesys is an automated screening tool intended for research, screening, and longitudinal self-tracking purposes only. It does not provide a formal medical diagnosis. Any flagged pattern change should be evaluated by a qualified neurologist or healthcare professional alongside comprehensive clinical examination.*
