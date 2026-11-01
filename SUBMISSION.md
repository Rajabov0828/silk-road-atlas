# 🏆 AWS Location Service Hackathon — Official Submission Form & Video Script

**Project Title:** Silk Road Atlas: Uzbekistan Heritage & Caravan Journey Explorer  
**Live URL:** https://d3fx98y0gpu4w7.cloudfront.net  
**Tagline:** *What took a Silk Road camel caravan a month takes a modern car an afternoon.*

---

## 1. Submission Form Fields (Copy & Paste Ready)

### 📌 The dataset you started with and what is in it:
> We started with a comprehensive cultural spatial dataset extracted from **OpenStreetMap (Overpass API)** under the Open Database License (ODbL 1.0), curated through an automated Python and Pydantic v2 data pipeline. 
> 
> The dataset comprises **2,024 verified historical and cultural heritage landmarks** across Uzbekistan:
> - **26 Ancient Caravanserais (*rabats*)**: Historic roadside trading stations where Silk Road merchants and camel caravans rested.
> - **83 Madrasas & 199 Historic Mosques**: Masterpieces of Islamic architecture with turquoise domes and majolica tilework.
> - **126 Mausoleums**: Including the Gur-e-Amir (Timur's tomb).
> - **230 Ancient Fortresses & City Walls**: Such as the 5th-century Ark of Bukhara and Khorezm desert ruins (*qalas*).
> - **141 Archaeological Sites & 165 Museums**: From prehistoric Afrasiyab murals to national history museums.
> - **339 UNESCO World Heritage Landmarks**: Spanning the four world-renowned historic centres: Bukhara, Samarkand, Shakhrisyabz, and Itchan Kala in Khiva.
> 
> The pipeline strictly bounded coordinates within Uzbekistan, normalized Cyrillic/Uzbek typography, resolved Wikipedia/Wikidata entity tags, and indexed spatial UNESCO protection zones.

---

### 📌 How you put it on the map, the AWS location or data service you used and why:
> We integrated four core capabilities of **Amazon Location Service (v2)** to turn static coordinates into an explorable, living Silk Road intelligence tool:
> 
> 1. **Amazon Location Maps v2 (`Standard` Light Style)**: Provides crisp, high-resolution vector map tiles rendered with MapLibre GL JS, enhanced with dynamic clustering, UNESCO highlight rings, and 3D camera pitch mode.
> 2. **Amazon Location Routes v2 (`CalculateRoutes`)**: Real-time road routing over ancient trading highways (M37, M39, A380). Computes true highway geometry, road kilometers, and modern driving duration. We compare this against ancient travel: computing caravan travel days (based on the historical caravan average of ~30 km/day).
> 3. **Amazon Location Routes v2 (`OptimizeWaypoints`)**: Solves the Traveling Salesperson Problem for custom tourist routes. Travelers select 2 to 20 monuments across Uzbekistan, and Amazon Location finds the mathematically optimal visiting sequence while keeping departure and destination fixed.
> 4. **Amazon Location Routes v2 (`CalculateIsolines`)**: Computes 15, 30, and 60-minute drive-time reachability polygons from any clicked location in Uzbekistan, revealing which heritage sites are accessible from a traveler's hotel or station.
> 5. **Amazon Location Places v2 (`SearchText` & `ReverseGeocode`)**: Powers country-bounded instant search and provides reverse-geocoded local addresses for historical sites.
> 
> **AWS Serverless Architecture**:
> - **Amazon CloudFront** & **Amazon S3**: Host static frontend assets with sub-100ms global latency and Origin Access Control (OAC).
> - **AWS Lambda (Python 3.12)** & **Amazon API Gateway HTTP API**: Provide a secure backend proxy to AWS Location APIs, validating requests via Pydantic v2 and preventing direct browser exposure of IAM credentials.

---

## 2. Three-Minute Demo Video Script (Second-by-Second Walkthrough)

Record your screen showing [https://d3fx98y0gpu4w7.cloudfront.net](https://d3fx98y0gpu4w7.cloudfront.net) with voiceover (or subtitle track):

### ⏱ 0:00 – 0:30 | Introduction & The Dataset
- **Action:** Open the home page. Hover over the top stats cards (`2,024 heritage sites`, `339 in UNESCO zones`, `26 caravanserais`).
- **Narration:**  
  *"Welcome to Silk Road Atlas. For centuries, the Silk Road through Uzbekistan was the world's most vital trading artery. Today, we put over 2,000 cultural heritage sites—including 339 UNESCO World Heritage landmarks and ancient caravanserais—on an interactive map powered by Amazon Location Service."*

### ⏱ 0:30 – 1:05 | Exploration, Photos, 3D Pitch & Audio Guide
- **Action:** Click the `★ UNESCO Only` quick chip, then click on `Nadir Devon Begi Madrasah` in Bukhara. Show the popup: point to the photo, the UNESCO badge, and click the `3D` button in the top-right corner to show the camera tilt. Click `🎧 Audio Guide` so the browser voice begins reading.
- **Narration:**  
  *"Exploring the map is instantaneous. Each landmark features verified high-resolution photography, Amazon Location reverse-geocoded addresses, and an interactive audio guide built with speech synthesis. With one click on our 3D button, the camera tilts to a 55-degree perspective, giving travelers an immersive bird’s-eye view of ancient oases."*

### ⏱ 1:05 – 1:45 | Caravan Story Mode & Amazon Location Routing
- **Action:** Click the `Caravan story` tab. Click `Start the journey →`. Advance to Stop 1 (Margilan), Stop 2 (Kokand), Stop 4 (Samarkand). Highlight the route line on the map and the stats: *"Road distance: 273 km | By car today: 3 h 33 min | By caravan: ≈ 9 days (60× speedup)"*.
- **Narration:**  
  *"In Caravan Story mode, we follow a historic merchant journey from the silk workshops of the Fergana Valley all the way to Khiva. Amazon Location Routes v2 calculates the exact highway path and driving time on modern roads, comparing it to a medieval camel caravan covering 30 km a day. What took a loaded caravan nine grueling days in the desert takes a car just three and a half hours today—a 60-times speedup!"*

### ⏱ 1:45 – 2:20 | Trip Planner, OptimizeWaypoints & Along-Route Discovery
- **Action:** Click `Trip` tab. Add 3 or 4 sites from different cities. Click `🧭 Route my trip`. Show the route drawing on the map. Point to the `🐫 Discovered Along Route` section showing caravanserais near the highway. Click `📥 Export GPX` (show the file download) and hover over `🗺️ Open in Google Maps`.
- **Narration:**  
  *"For modern travelers, our Trip Planner uses Amazon Location OptimizeWaypoints to calculate the optimal visiting sequence. Furthermore, our spatial engine discovers roadside caravanserais located within 10 kilometers of the highway corridor. Travelers can immediately export their route to a standard GPX file for GPS devices, or open it in Google Maps with one tap."*

### 2:20 – 2:50 | Reachability (CalculateIsolines) & Conclusion
- **Action:** Click `Reach` tab. Click `📍 Pick a starting point on the map`, and click in the centre of Tashkent or Samarkand. Watch the green, blue, and cobalt drive-time isochrones render.
- **Narration:**  
  *"Finally, the Reach tab leverages Amazon Location CalculateIsolines to generate 15, 30, and 60-minute driving reachability polygons from any station, airport, or hotel, instantly showing which cultural treasures you can visit today.*  
  *Silk Road Atlas bridges ancient history and modern AWS cloud spatial intelligence. Thank you!"*
