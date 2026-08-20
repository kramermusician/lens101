#!/usr/bin/env python3
"""Waypoint / Waveform data pipeline (teacher exemplar, LENS 101 Fall 2026).

Takes the ten raw waypoints (place, lat, lon, date) and computes every
calculated column the assignment asks students to build in a spreadsheet:

  interval_days    days since the previous point
  distance_km      haversine distance from the previous point
  bearing          compass direction of travel from the previous point (0-360)
  cumulative_days  total days since point 1
  cumulative_km    total distance traveled so far

Outputs:
  waypoints.csv      the finished data table (what students hand in)
  waypoints.geojson  the same points in uMap-export shape ([lon, lat] order!)
  stdout             a JS array to paste into index.html so the piece
                     runs from file:// with no fetch

This script is also the answer key for the spreadsheet math. Each formula
below is the one printed on the assignment sheet, verbatim.

Re-run after editing RAW below:  python3 build_waypoints.py
"""

import csv
import json
import math
from datetime import date
from pathlib import Path

# ---------------------------------------------------------------------------
# RAW DATA — the ten moments. (name, lat, lon, ISO date, note)
#
# EDIT-ME: dates and several places below are drafted approximations.
# Kramer corrects these in one pass, then re-runs the script.
# Privacy rule from the assignment applies: neighborhood-level points only,
# never a home address. #7 is deliberately the riverbank, not the street.
# ---------------------------------------------------------------------------
RAW = [
    ("Where it starts, Massachusetts",      42.2793, -71.4162, "1989-06-15",
     "EDIT-ME: hometown center + real birth date"),
    ("Miami University, Oxford, Ohio",      39.5119, -84.7346, "2007-08-20",
     "EDIT-ME date: freshman year, chemistry then economics before music"),
    ("Berklee, 150 Mass Ave, Boston",       42.3466, -71.0876, "2008-09-01",
     "EDIT-ME date: the transfer into music education"),
    ("The honest one (you pick)",           42.3550, -71.0656, "2010-01-01",
     "EDIT-ME entirely: the point that would not go on a resume. Only Kramer can choose this one."),
    ("First classroom, a charter school",   42.3918, -71.0328, "2012-09-01",
     "EDIT-ME place + date: first job, general music for English learners"),
    ("Qingdao, China",                      36.0671, 120.3826, "2014-08-15",
     "EDIT-ME date: the year teaching music abroad"),
    ("A K-8 in Boston",                     42.3251, -71.0950, "2015-09-08",
     "EDIT-ME place + date: the twelve BPS years, mapped to the neighborhood"),
    ("The Charles River, Brighton",         42.3639, -71.1338, "2020-06-01",
     "EDIT-ME date: home now, mapped to the riverbank on purpose"),
    ("San Sebastian, Spain",                43.3183,  -1.9812, "2026-07-02",
     "Camino del Norte, first steps"),
    ("Bilbao, Spain",                       43.2630,  -2.9350, "2026-07-10",
     "Camino del Norte, the arrival"),
]

R_EARTH_KM = 6371.0  # Earth's radius, same constant as the assignment sheet


def haversine_km(lat1, lon1, lat2, lon2):
    """distance = 6371 * c, where
    a = sin^2(dphi/2) + cos(phi1) * cos(phi2) * sin^2(dlambda/2)
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    Every angle in radians first (the spreadsheet RADIANS() step)."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R_EARTH_KM * c


def bearing_deg(lat1, lon1, lat2, lon2):
    """theta = atan2( sin(dlambda) * cos(phi2),
                      cos(phi1) * sin(phi2) - sin(phi1) * cos(phi2) * cos(dlambda) )
    then degrees, then mod 360. 0 is north, 90 is east."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlam = math.radians(lon2 - lon1)
    theta = math.atan2(
        math.sin(dlam) * math.cos(phi2),
        math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlam),
    )
    return math.degrees(theta) % 360


def main():
    here = Path(__file__).parent
    rows = []
    pts = sorted(RAW, key=lambda r: r[3])  # sort by date first, like the sheet says
    d0 = date.fromisoformat(pts[0][3])
    cum_km = 0.0
    for i, (name, lat, lon, iso, note) in enumerate(pts):
        d = date.fromisoformat(iso)
        if i == 0:
            interval = 0
            dist = 0.0
            brg = 0.0
        else:
            _, plat, plon, piso, _ = pts[i - 1]
            interval = (d - date.fromisoformat(piso)).days
            dist = haversine_km(plat, plon, lat, lon)
            brg = bearing_deg(plat, plon, lat, lon)
        cum_km += dist
        rows.append({
            "name": name,
            "lat": lat,
            "lon": lon,
            "date": iso,
            "interval_days": interval,
            "distance_km": round(dist, 1),
            "bearing": round(brg, 1),
            "cumulative_days": (d - d0).days,
            "cumulative_km": round(cum_km, 1),
            "note": note,
        })

    # --- waypoints.csv -----------------------------------------------------
    fields = ["name", "lat", "lon", "date", "interval_days", "distance_km",
              "bearing", "cumulative_days", "cumulative_km", "note"]
    with open(here / "waypoints.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    # --- waypoints.geojson (uMap export shape: [lon, lat], longitude first) -
    geo = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [r["lon"], r["lat"]]},
                "properties": {"name": r["name"], "date": r["date"], "description": r["note"]},
            }
            for r in rows
        ],
    }
    with open(here / "waypoints.geojson", "w") as f:
        json.dump(geo, f, indent=2)

    # --- JS block for index.html ------------------------------------------
    print("// Paste into index.html between the DATA markers:")
    print("const WAYPOINTS = [")
    for r in rows:
        print('  {{ name: {n}, lat: {lat}, lon: {lon}, date: "{d}", intervalDays: {i}, distanceKm: {km}, bearing: {b}, cumulativeDays: {cd}, cumulativeKm: {ck} }},'.format(
            n=json.dumps(r["name"]), lat=r["lat"], lon=r["lon"], d=r["date"],
            i=r["interval_days"], km=r["distance_km"], b=r["bearing"],
            cd=r["cumulative_days"], ck=r["cumulative_km"]))
    print("];")
    print(f"\nWrote {len(rows)} points -> waypoints.csv, waypoints.geojson")


if __name__ == "__main__":
    main()
