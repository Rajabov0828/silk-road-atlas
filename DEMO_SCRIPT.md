# 📹 Silk Road Atlas: Demo Video Recording Script (< 3 Minutes)

This script is structured to cover all 4 hackathon judging criteria in **under 3 minutes**.

---

### Timing Breakdown
- **0:00 – 0:30**: Introduction, Dataset & The Core Idea
- **0:30 – 1:15**: Interactive Map Exploration (Clustering, Filters, UNESCO Zones)
- **1:15 – 1:55**: Caravan Story Mode (Amazon Location Routes & Caravan Maths)
- **1:55 – 2:30**: Custom Trip Planner & Isochrone Reachability (OptimizeWaypoints & CalculateIsolines)
- **2:30 – 2:50**: Architecture, Security & Wrap-up

---

### Step-by-Step Walkthrough

#### ⏱ 0:00 – 0:30 | Introduction & Dataset
- **On Screen**: The Silk Road Atlas open in the browser at [http://localhost:5173](http://localhost:5173). The map displays the entire territory of Uzbekistan with 2,024 clustered heritage points.
- **Narrator**:
  > *"Hi everyone! Welcome to Silk Road Atlas. For centuries, the Silk Road was the artery of Eurasian trade, crossing the deserts and oases of Uzbekistan. What once took camel caravans weeks or months to traverse can now be driven in an afternoon.*
  >
  > *For this hackathon, we built an interactive application placing over 2,000 real-world cultural heritage sites across Uzbekistan on an explorable map, combining OpenStreetMap heritage data with Amazon Location Service's Maps, Routes, and Places APIs."*

#### ⏱ 0:30 – 1:15 | Exploration, Categories & UNESCO Zones
- **On Screen**:
  1. Click the **"UNESCO only"** toggle — the map filters down to the 339 monuments in Samarkand, Bukhara, Khiva, and Shakhrisyabz.
  2. Click **"Only caravanserais"** — shows the 26 ancient roadside inns where merchants sheltered.
  3. Zoom into Samarkand or Bukhara. Click on a site (e.g. **Registan** or **Kalyan Minaret**).
  4. The popup opens with category icon, UNESCO badge, historical dates, Wikipedia link, and an address resolved in real-time via Amazon Location `ReverseGeocode`.
- **Narrator**:
  > *"On the Explore tab, users can filter by category — from madrasas and mausoleums to rare roadside caravanserais. Toggling 'UNESCO only' instantly highlights monuments within the four World Heritage zones.*
  >
  > *Clicking any monument opens a popup with historical context, Wikipedia links, and a reverse-geocoded address retrieved on the fly via Amazon Location Places."*

#### ⏱ 1:15 – 1:55 | Caravan Story Mode
- **On Screen**:
  1. Switch to the **"Caravan story"** tab.
  2. Click **"Start the journey →"**. The map smoothly flies through the route: Margilan (the silk city) → Kokand → Tashkent → Samarkand → Shahrisabz → Bukhara → Khiva.
  3. Highlight the stats panel: Road distance, driving time, caravan days (e.g. *Samarkand to Bukhara: 273 km, 3h 33m by car vs 9 days by caravan*).
  4. At the final step, show the full multi-leg gradient route across Uzbekistan.
- **Narrator**:
  > *"Next is the Caravan Story mode. Here we trace a historical merchant's journey from the silk workshops of the Fergana Valley all the way to the desert fortress of Khiva.*
  >
  > *For each leg, we call Amazon Location Service's `CalculateRoutes` to compute real highway navigation. We then contrast modern drive time against historical caravan speeds of 30 km a day. A 270 km journey between Samarkand and Bukhara took 9 grueling days by camel; today it is driven in 3.5 hours — a 60-fold difference."*

#### ⏱ 1:55 – 2:30 | Trip Planner & Reachability (Isolines)
- **On Screen**:
  1. Switch to the **"Trip"** tab. Click 3 or 4 sites across the map.
  2. Keep **"Optimize stop order"** checked. Click **"🧭 Route my trip"**.
  3. The route draws on the map, stops reorder optimally, and total distance / drive time appear.
  4. Switch to the **"Reach"** tab. Click **"📍 Pick a starting point on the map"** and click on Samarkand.
  5. Green (15m), yellow (30m), and orange (60m) isochrone polygons appear with the exact count and list of heritage sites reachable inside them.
- **Narrator**:
  > *"Travelers can plan custom journeys. The Trip tab lets you pick any stops, and Amazon Location's `OptimizeWaypoints` solves the visiting order to minimize driving time.*
  >
  > *Or, if you are arriving at a hotel or train station, our Reach tab uses `CalculateIsolines` to generate 15-, 30-, and 60-minute drive-time areas, revealing exactly which historical treasures are accessible within an hour."*

#### ⏱ 2:30 – 2:50 | Architecture & Conclusion
- **On Screen**: Show the GitHub repo / architecture diagram.
- **Narrator**:
  > *"Under the hood, the frontend is built with Vite, TypeScript, and MapLibre GL JS, served securely via Amazon S3 and CloudFront with Origin Access Control. All location requests are proxied through an AWS Lambda microservice in Python, validating inputs with Pydantic and enforcing least-privilege IAM policies.*
  >
  > *The code is open-source and ready for anyone to explore and reuse. Thank you!"*
