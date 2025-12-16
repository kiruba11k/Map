from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests, math, os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

APIFY_API_URL = "https://api.apify.com/v2/acts/powerai~google-map-nearby-search-scraper/run-sync-get-dataset-items"
APIFY_TOKEN = os.environ.get("APIFY_TOKEN")


def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


@app.post("/api/search-poi")
def search_poi(payload: dict):
    query = payload["query"]
    lat = float(payload["lat"])
    lng = float(payload["lng"])
    max_items = payload.get("maxItems", 30)

    params = {"token": APIFY_TOKEN}
    body = {
        "query": query,
        "lat": str(lat),
        "lng": str(lng),
        "maxItems": max_items,
        "country": "IN",
        "lang": "en"
    }

    res = requests.post(APIFY_API_URL, params=params, json=body, timeout=30)
    data = res.json()

    for item in data:
        item["distance_km"] = calculate_distance(
            lat, lng,
            item.get("latitude", lat),
            item.get("longitude", lng)
        )

    return {"count": len(data), "results": data}
