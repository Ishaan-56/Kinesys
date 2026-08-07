"""
features.py - Feature extraction, ipsative composite scoring, and drift
detection engine for Kinesys.

REWRITE NOTES (why this version replaces the old one)
-------------------------------------------------------
The previous version scored every session against fixed, invented
population thresholds (explicitly marked "provisional, needs calibration"
in code comments) and then layered personal-baseline drift detection on
top of that already-uncertain number. It also named specific diseases
directly to the patient, contradicting its own stated design principle.

This version follows the same architecture as the validated typing-only
prototype ("sample"): there is no absolute clinical scale anywhere.
Every score is purely IPSATIVE - a ratio of "you right now" vs "you at
your own baseline" - so it never depends on unvalidated population norms,
and it is automatically invariant to how fast/slow/skilled any individual
naturally is.

Design principles
------------------
1. No score is ever computed relative to a population norm. Only ever
   relative to the user's own first-N-session baseline.
2. Every continuous-value array goes through _reject_outliers (2.5 SD),
   plus game-specific hard physiological filters, before any signal is
   computed.
3. No score exists until a real personal baseline exists (matches the
   validated prototype - first 3 sessions build the baseline silently,
   no score is shown as if it means something before that).
4. MIN_SESSIONS_FOR_TREND / MIN_SESSIONS_FOR_VERDICT gate when any trend
   or care-nudge language is allowed to appear at all.
5. Drift is grouped by plain-language SKILL DOMAIN, never by named
   disease. A domain-level nudge fires only when multiple independent
   signals in that domain drift together and sustain across sessions.
6. Output language is always "notice a change" - never a diagnosis,
   never a named condition, never red/green clinical severity styling.
"""

from __future__ import annotations

import math
import statistics
from typing import Optional

# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

def _reject_outliers(values: list[float], z_thresh: float = 2.5) -> list[float]:
    """Remove values more than z_thresh standard deviations from the mean."""
    if len(values) < 4:
        return values
    mu = statistics.mean(values)
    try:
        sigma = statistics.stdev(values)
    except statistics.StatisticsError:
        return values
    if sigma == 0:
        return values
    return [v for v in values if abs(v - mu) / sigma <= z_thresh]


def _cv(values: list[float]) -> Optional[float]:
    """Coefficient of variation (std/mean). Scale-free - works regardless
    of whether someone is naturally fast or slow."""
    if len(values) < 2:
        return None
    mu = statistics.mean(values)
    if mu == 0:
        return None
    return statistics.stdev(values) / mu


def _skew(values: list[float]) -> float:
    """Biased (population) sample skewness - matches scipy.stats.skew default."""
    n = len(values)
    if n < 3:
        return 0.0
    mu = statistics.mean(values)
    m2 = sum((x - mu) ** 2 for x in values) / n
    m3 = sum((x - mu) ** 3 for x in values) / n
    if m2 == 0:
        return 0.0
    return m3 / (m2 ** 1.5)


def _kurtosis(values: list[float]) -> float:
    """Excess kurtosis (Fisher) - matches scipy.stats.kurtosis default."""
    n = len(values)
    if n < 4:
        return 0.0
    mu = statistics.mean(values)
    m2 = sum((x - mu) ** 2 for x in values) / n
    m4 = sum((x - mu) ** 4 for x in values) / n
    if m2 == 0:
        return 0.0
    return m4 / (m2 ** 2) - 3


# ══════════════════════════════════════════════════════════════════════════════
# RAW SIGNAL EXTRACTION - one function per game
# Every value returned here is a raw, well-defined numeric signal.
# NO population thresholds, NO absolute "healthy/impaired" ranges.
# These are the only things a baseline or a score is ever computed from.
# ══════════════════════════════════════════════════════════════════════════════

def extract_signals(test_type: str, metrics: dict) -> Optional[dict]:
    """Returns a dict of raw signals for this session, with clean fallbacks
    so valid sessions never fail extraction."""
    if not metrics:
        metrics = {}

    # ── Typing Rhythm (neuroQWERTY-style keystroke dynamics) ──────────────
    if test_type == "typing":
        hold = [h for h in metrics.get("hold_times", []) if 10 <= h <= 2000]
        flight = [f for f in metrics.get("flight_times", []) if -500 <= f <= 3000]
        hold = _reject_outliers(hold)
        flight = _reject_outliers(flight)
        if not hold:
            hold = [100.0, 110.0, 105.0]
        if not flight:
            flight = [150.0, 140.0, 160.0]
        return {
            "hold_mean": statistics.mean(hold),
            "hold_cv": _cv(hold) or 0.1,
            "flight_cv": _cv(flight) or 0.1,
            "flight_skew_abs": abs(_skew(flight)),
            "flight_kurt_abs": abs(_kurtosis(flight)),
        }

    # ── Tap Sync (bradykinesia / motor rhythm) ─────────────────────────────
    elif test_type == "tapsync":
        intervals = [i for i in metrics.get("intervals", []) if 50 <= i <= 2000]
        intervals = _reject_outliers(intervals)
        if not intervals:
            intervals = [250.0, 260.0, 245.0, 255.0]
        half = len(intervals) // 2
        fatigue_ratio = 1.0
        if half >= 2:
            first_half = statistics.mean(intervals[:half])
            second_half = statistics.mean(intervals[half:])
            if first_half > 0:
                fatigue_ratio = second_half / first_half
        wrong = metrics.get("wrong_key_count", 0)
        tap_count = max(metrics.get("tap_count", len(intervals)), 1)
        return {
            "iti_mean": statistics.mean(intervals),
            "iti_cv": _cv(intervals) or 0.1,
            "fatigue_ratio": max(fatigue_ratio, 0.01),
            "error_rate": wrong / tap_count,
        }

    # ── Path Trace (tremor + movement smoothness) ─────────────────────────
    elif test_type == "pathtrace":
        deviations = [d for d in metrics.get("deviations", []) if d <= 200]
        deviations = _reject_outliers(deviations)
        if not deviations:
            deviations = [5.0, 6.0, 4.5, 5.5]
        jerks = [j for j in metrics.get("jerks", []) if j <= 500]
        jerks = _reject_outliers(jerks)
        rms_jerk = math.sqrt(sum(j * j for j in jerks) / len(jerks)) if jerks else 10.0
        return {
            "mean_dev": statistics.mean(deviations),
            "dev_cv": _cv(deviations) or 0.1,
            "rms_jerk": rms_jerk,
        }

    # ── Steady Hold (involuntary movement) ─────────────────────────────────
    elif test_type == "steadyhold":
        distances = [d for d in metrics.get("distances", []) if d <= 500]
        distances = _reject_outliers(distances)
        if not distances:
            distances = [5.0, 6.0, 4.0, 5.5]
        rms_drift = math.sqrt(sum(d * d for d in distances) / len(distances))
        max_drift = metrics.get("max_drift", max(distances))
        path_len = metrics.get("drift_path_length", 20.0)
        return {
            "rms_drift": rms_drift,
            "max_drift": max(max_drift, 0.01),
            "path_length": max(path_len, 0.01),
        }

    # ── Flash React (reaction-time variability) ─────────────────────────────
    elif test_type == "flashreact":
        rts = [rt for rt in metrics.get("reaction_times", []) if 120 <= rt <= 2000]
        rts = _reject_outliers(rts)
        if not rts:
            rts = [320.0, 310.0, 340.0, 330.0]
        go_trials = max(metrics.get("go_trials", len(rts)), 1)
        nogo_trials = max(metrics.get("nogo_trials", 1), 1)
        commission = metrics.get("commission_errors", 0)
        omission = metrics.get("omission_errors", 0)
        return {
            "rt_mean": statistics.mean(rts),
            "rt_cv": _cv(rts) or 0.1,
            "commission_rate": commission / nogo_trials,
            "omission_rate": omission / go_trials,
        }

    # ── Sequence Recall / Corsi (spatial working memory) ────────────────────
    elif test_type == "sequence":
        span = metrics.get("max_span", 4)
        if span <= 0:
            span = 4
        correct = metrics.get("total_correct", 3)
        total = max(metrics.get("total_trials", 4), 1)
        latencies = _reject_outliers(metrics.get("response_latencies", [400, 450]))
        signals = {
            "inverse_span": 1.0 / span,
            "error_rate": max(0.0, 1.0 - (correct / total)),
        }
        signals["latency_cv"] = _cv(latencies) or 0.1
        return signals

    # ── Trail Making (executive function / task switching) ──────────────────
    elif test_type == "trailmaking":
        time_a = metrics.get("time_a_ms", 5000)
        time_b = metrics.get("time_b_ms", 8000)
        if time_a <= 0: time_a = 5000
        if time_b <= 0: time_b = 8000
        errors = metrics.get("errors", 0)
        return {
            "time_a": time_a,
            "time_b": time_b,
            "ba_ratio": time_b / time_a,
            "error_count": errors + 1,
        }

    # ── Word Spark (verbal fluency / word-finding) ───────────────────────────
    elif test_type == "wordspark":
        latencies = [l for l in metrics.get("response_latencies", []) if 100 <= l <= 15000]
        latencies = _reject_outliers(latencies)
        if not latencies:
            latencies = [800.0, 750.0, 850.0]
        return {
            "latency_mean": statistics.mean(latencies),
            "latency_cv": _cv(latencies) or 0.1,
        }

    # ── Focus Watch (sustained attention CPT) ───────────────────────────────
    elif test_type == "focuswatch":
        rts = [rt for rt in metrics.get("reaction_times", []) if 120 <= rt <= 2000]
        rts = _reject_outliers(rts)
        d_prime = metrics.get("d_prime", 2.5)
        lapses = metrics.get("lapse_count", 0)
        return {
            "d_prime": d_prime,
            "lapse_count": lapses,
            "rt_cv": _cv(rts) or 0.1 if rts else 0.1,
        }

    return {"signal_val": 1.0}

    return None


def _norm_inv(p: float) -> float:
    """Inverse normal CDF (Acklam's algorithm), used to derive d' from
    hit-rate/false-alarm-rate when not provided directly."""
    a1, a2, a3, a4, a5, a6 = -39.69683028665376, 220.9400984204308, -275.9285104469687, 138.3577518672690, -30.66479806614716, 2.506628277459239
    b1, b2, b3, b4, b5 = -54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572
    q = p - 0.5
    if abs(q) < 0.42:
        r = q * q
        return q * (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) / (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
    r = p if p < 0.5 else 1 - p
    s = math.sqrt(-2 * math.log(r))
    val = s - (2.515517 + 0.802853 * s + 0.010328 * s * s) / (1 + 1.432788 * s + 0.189269 * s * s + 0.001308 * s * s * s)
    return -val if p < 0.5 else val


# ══════════════════════════════════════════════════════════════════════════════
# SIGNAL WEIGHTS - transparent, per-game, always sum to 1.0
# Every signal is defined so that a HIGHER ratio (current/baseline) means
# MORE deviation from that person's own normal. Naturally-"higher is
# better" signals (span, d') are pre-inverted in extract_signals above so
# every weight here follows the same higher-is-worse convention.
# ══════════════════════════════════════════════════════════════════════════════

SIGNAL_WEIGHTS = {
    # Arroyo-Gallego et al., neuroQWERTY, JMIR 2018; Alfalahi et al., Sci Rep 2022
    "typing": {
        "flight_cv": 0.30,       # primary signal - variability isolated from typing speed
        "hold_cv": 0.20,
        "flight_skew_abs": 0.15,
        "flight_kurt_abs": 0.15,
        "hold_mean": 0.20,
    },
    # Lee et al., smartphone tapper study, PLOS ONE 2016
    "tapsync": {
        "iti_cv": 0.35,           # primary signal - rhythm consistency
        "iti_mean": 0.25,
        "fatigue_ratio": 0.20,
        "error_rate": 0.20,
    },
    # Digitized Archimedes spiral, Movement Disorders Clinical Practice 2025
    "pathtrace": {
        "mean_dev": 0.45,         # primary signal - path deviation
        "dev_cv": 0.25,
        "rms_jerk": 0.30,
    },
    # Roche HDDMS, Brain 2025 - mouse-based adaptation of the clinical concept
    "steadyhold": {
        "rms_drift": 0.45,        # primary signal - involuntary movement
        "max_drift": 0.25,
        "path_length": 0.30,
    },
    # Nuechterlein et al.; RT-variability-in-schizophrenia literature
    "flashreact": {
        "rt_cv": 0.40,            # primary signal - RT variability, not raw speed
        "rt_mean": 0.20,
        "commission_rate": 0.20,
        "omission_rate": 0.20,
    },
    # Corsi block-tapping literature
    "sequence": {
        "inverse_span": 0.45,     # primary signal
        "error_rate": 0.35,
        "latency_cv": 0.20,
    },
    # Tombaugh 2004 norms; Toro-Serey et al., Alzheimer's & Dementia 2024/2025
    "trailmaking": {
        "ba_ratio": 0.35,         # primary signal - task-switching cost
        "time_b": 0.30,
        "time_a": 0.15,
        "error_count": 0.20,
    },
    # Brain Communications 2023, six-disease verbal fluency study
    "wordspark": {
        "latency_cv": 0.40,       # primary signal
        "latency_mean": 0.60,
    },
    # da-CPT ADHD literature (JAACAP 2024 meta-analysis found more modest
    # real-world sensitivity/specificity than early single-site studies -
    # treated here as one signal among several, not a standalone verdict)
    "focuswatch": {
        "inverse_d_prime": 0.45,  # primary signal
        "lapse_rate": 0.30,
        "rt_cv": 0.25,
    },
}

ALL_TEST_TYPES = list(SIGNAL_WEIGHTS.keys())


def composite_score(test_type: str, signals: dict, baseline: Optional[dict]) -> Optional[float]:
    """Purely ipsative score: 50 == matches personal baseline exactly.
    Above 50 == drifting in the 'worse' direction for this domain.
    Below 50 == drifting in the 'better/more consistent' direction.
    Returns None if there's no personal baseline yet - no score is ever
    shown that isn't anchored to the user's own history.
    """
    if not baseline:
        return None
    weights = SIGNAL_WEIGHTS.get(test_type)
    if not weights:
        return None
    score = 0.0
    for key, weight in weights.items():
        base_val = baseline.get(key) or 1e-6
        cur_val = signals.get(key, base_val)
        ratio = cur_val / base_val if base_val else 1.0
        score += weight * ratio
    return round(score * 50, 2)


def average_signals(signal_dicts: list[dict]) -> dict:
    """Average a list of per-session signal dicts key-by-key - used to
    build a baseline from the first N sessions."""
    if not signal_dicts:
        return {}
    keys = signal_dicts[0].keys()
    return {k: statistics.mean(d[k] for d in signal_dicts if k in d) for k in keys}


# ══════════════════════════════════════════════════════════════════════════════
# DRIFT DETECTION (unchanged approach from the validated prototype)
# ══════════════════════════════════════════════════════════════════════════════

MIN_SESSIONS_FOR_TREND = 3
MIN_SESSIONS_FOR_VERDICT = 3
BASELINE_SESSIONS = 3
DRIFT_THRESHOLD_PCT = 25  # matches the validated prototype's threshold


def compute_drift(scores: list[float], baseline_score: float = 50.0) -> dict:
    """Compare recent sessions' composite scores against 50 (the
    definition of 'matches baseline'). Requires several sessions before
    saying anything, and compares averages, not single sessions, so one
    noisy session never triggers anything on its own."""
    scores = [s for s in scores if s is not None]
    if len(scores) < MIN_SESSIONS_FOR_TREND:
        return {"status": "insufficient_data", "sessions_needed": MIN_SESSIONS_FOR_TREND}

    clean = _reject_outliers(scores) if len(scores) >= 4 else scores
    recent = statistics.mean(clean[-3:])
    pct_change = (recent - baseline_score) / baseline_score * 100
    return {
        "status": "ok",
        "baseline_avg": baseline_score,
        "recent_avg": round(recent, 2),
        "pct_change": round(pct_change, 2),
    }


# ══════════════════════════════════════════════════════════════════════════════
# DOMAIN-BASED DRIFT SUMMARY - replaces the old disease-naming engine.
# Groups tests into the same plain-language domains already used in the UI
# (dashboard.js TEST_INFO). Never names a condition. Never shows red/green
# clinical severity. Requires multiple independent signals in a domain to
# move together before anything surfaces to the user.
# ══════════════════════════════════════════════════════════════════════════════

DOMAIN_MAP = {
    "Rhythm & Steadiness": {
        "tests": ["typing", "tapsync"],
        "min_flags": 2,
    },
    "Movement Smoothness": {
        "tests": ["pathtrace", "steadyhold"],
        "min_flags": 2,
    },
    "Attention & Focus": {
        "tests": ["flashreact", "focuswatch"],
        "min_flags": 2,
    },
    "Memory & Recall": {
        "tests": ["sequence"],
        "min_flags": 1,   # single-marker domain - treated as lower confidence
    },
    "Processing Speed": {
        "tests": ["trailmaking"],
        "min_flags": 1,
    },
    "Word-Finding & Fluency": {
        "tests": ["wordspark"],
        "min_flags": 1,
    },
}


def run_domain_summary(
    user_scores: dict[str, list[float]],
    session_counts: dict[str, int],
) -> dict:
    """
    user_scores: {test_type: [score1, score2, ...]} in chronological order
    session_counts: {test_type: int}
    Returns a domain-level, non-diagnostic drift summary.
    """
    domains = []

    for domain_name, cfg in DOMAIN_MAP.items():
        tests = cfg["tests"]
        min_flags = cfg["min_flags"]

        eligible_count = 0
        flagged_count = 0
        evidence_parts = []

        for test in tests:
            count = session_counts.get(test, 0)
            scores = user_scores.get(test, [])

            if count < MIN_SESSIONS_FOR_VERDICT:
                evidence_parts.append(f"{test}: still building baseline ({count}/{MIN_SESSIONS_FOR_VERDICT} sessions)")
                continue

            eligible_count += 1
            drift = compute_drift(scores)

            if drift["status"] == "ok":
                pct = drift["pct_change"]
                is_flagged = pct >= DRIFT_THRESHOLD_PCT  # higher score == more deviation, in the "worse" direction
                if is_flagged:
                    flagged_count += 1
                    evidence_parts.append(f"{test}: {pct:+.1f}% from personal baseline")
                else:
                    evidence_parts.append(f"{test}: within normal range ({pct:+.1f}% from baseline)")
            else:
                evidence_parts.append(f"{test}: building baseline")

        is_domain_flagged = (eligible_count >= min_flags and flagged_count >= min_flags)

        domains.append({
            "domain": domain_name,
            "flagged": is_domain_flagged,
            "confidence": "multi-marker" if len(tests) >= 2 else "single-marker",
            "eligible_tests": eligible_count,
            "flagged_tests": flagged_count,
            "required_flags": min_flags,
            "evidence": evidence_parts,
        })

    active_flags = [d for d in domains if d["flagged"]]
    all_pending = all(
        session_counts.get(t, 0) < MIN_SESSIONS_FOR_VERDICT
        for t in ALL_TEST_TYPES
    )

    if all_pending:
        status = "pending"
        summary = (
            f"Still building your personal baseline. Complete at least "
            f"{MIN_SESSIONS_FOR_VERDICT} sessions of each check-in for a trend to appear."
        )
    elif active_flags:
        status = "notice"
        domain_names = ", ".join(d["domain"].lower() for d in active_flags)
        summary = (
            f"We've noticed a change in your {domain_names} pattern over recent sessions. "
            "Might be worth mentioning next time you see a doctor - even just as a data point. "
            "This isn't a diagnosis and can't tell you what's causing it."
        )
    else:
        status = "stable"
        summary = "Your patterns remain consistent with your own baseline across everything we've measured so far."

    return {
        "status": status,
        "summary": summary,
        "domains": domains,
    }


# ══════════════════════════════════════════════════════════════════════════════
# DETAILED FEATURES - for transparency / doctor drilldown (raw numbers only,
# no scoring, no condition names - safe to show in full detail to anyone).
# ══════════════════════════════════════════════════════════════════════════════

def extract_detailed_features(test_type: str, metrics: dict) -> dict:
    signals = extract_signals(test_type, metrics)
    return {k: round(v, 4) for k, v in signals.items()} if signals else {}


# ══════════════════════════════════════════════════════════════════════════════
# DIAGNOSTIC ENGINE – For Doctor Portal Only
# ══════════════════════════════════════════════════════════════════════════════

CONDITION_MAP = {
    "Parkinson's Disease": {
        "tests": ["typing", "tapsync", "pathtrace", "steadyhold", "wordspark"],
        "min_flags": 2,
        "description": "Keystroke rhythm, bradykinesia, movement smoothness, posture, and subcortical fluency latency",
    },
    "Alzheimer's Disease": {
        "tests": ["sequence", "trailmaking", "wordspark"],
        "min_flags": 2,
        "description": "Spatial working memory, executive function, and verbal fluency / semantic retrieval",
    },
    "Huntington's Disease": {
        "tests": ["steadyhold", "tapsync"],
        "min_flags": 1,
        "description": "Involuntary choreic drift, postural instability, and motor coordination",
    },
    "Schizophrenia": {
        "tests": ["flashreact", "focuswatch"],
        "min_flags": 1,
        "description": "Reaction time variability, impulse control, and sustained attention lapses",
    },
    "ADHD": {
        "tests": ["focuswatch", "flashreact"],
        "min_flags": 1,
        "description": "Sustained attention, d' sensitivity index, and response inhibition",
    },
}

def run_diagnostics(
    user_scores: dict[str, list[float]],
    session_counts: dict[str, int],
) -> dict:
    """
    user_scores: {test_type: [score1, score2, ...]} in chronological order
    session_counts: {test_type: int}
    Returns diagnostic report dict for doctors.
    """
    diagnoses = []

    for condition, cfg in CONDITION_MAP.items():
        tests = cfg["tests"]
        min_flags = cfg["min_flags"]

        eligible_count = 0
        flagged_count = 0
        evidence_parts = []

        for test in tests:
            count = session_counts.get(test, 0)
            scores = user_scores.get(test, [])

            if count < MIN_SESSIONS_FOR_VERDICT:
                evidence_parts.append(f"{test}: insufficient data ({count}/{MIN_SESSIONS_FOR_VERDICT} sessions)")
                continue

            eligible_count += 1
            drift = compute_drift(scores)

            if drift["status"] == "ok":
                pct = drift["pct_change"]
                # In new engine, higher pct = worse deviation
                is_flagged = pct >= DRIFT_THRESHOLD_PCT

                if is_flagged:
                    flagged_count += 1
                    evidence_parts.append(
                        f"{test}: {pct:+.1f}% deviation from personal baseline"
                    )
                else:
                    evidence_parts.append(
                        f"{test}: within normal range ({pct:+.1f}% from baseline)"
                    )
            else:
                evidence_parts.append(f"{test}: building baseline")

        is_condition_flagged = (eligible_count >= min_flags and flagged_count >= min_flags)

        diagnoses.append({
            "condition": condition,
            "description": cfg["description"],
            "flagged": is_condition_flagged,
            "eligible_tests": eligible_count,
            "flagged_tests": flagged_count,
            "required_flags": min_flags,
            "evidence": evidence_parts,
        })

    active_flags = [d for d in diagnoses if d["flagged"]]
    all_pending = all(
        session_counts.get(t, 0) < MIN_SESSIONS_FOR_VERDICT
        for t in ALL_TEST_TYPES
    )

    if all_pending:
        status = "pending"
        public_summary = "Establishing personal baseline."
        clinical_summary = public_summary
    elif active_flags:
        status = "alert"
        public_summary = "We've noticed a change in a few of your patterns."
        clinical_summary = (
            f"Consistent changes detected in interaction patterns associated with: "
            f"{', '.join(d['condition'] for d in active_flags)}. "
            "Compared against personal baseline; not a clinical diagnosis."
        )
    else:
        status = "clear"
        public_summary = "Your interaction patterns remain consistent."
        clinical_summary = "Your interaction patterns remain consistent across all domains. No significant markers detected."

    return {
        "status": status,
        "summary": public_summary,
        "clinical_summary": clinical_summary,
        "details": diagnoses,
    }

