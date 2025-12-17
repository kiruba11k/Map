from fastapi import FastAPI, HTTPException, APIRouter, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
import pandas as pd
import requests
import os
import io
import asyncio
from typing import List, Dict, Optional
from math import radians, sin, cos, sqrt, atan2
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="SBI Dashboard API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Router with prefix - This solves the Vercel routing mismatch
router = APIRouter(prefix="/api")

APIFY_API_URL = "https://api.apify.com/v2/acts/powerai~google-map-nearby-search-scraper/run-sync-get-dataset-items"
APIFY_TOKEN = os.getenv("APIFY_TOKEN", "your_token_here")

class POISearchRequest(BaseModel):
    query: str
    branches: List[str]
    max_results: int = 30
    lat: Optional[float] = None
    lng: Optional[float] = None

class BranchData:
    @staticmethod
    def get_branches():
        return pd.DataFrame({
            "Branch": ["PANATHUR", "BELLANDUR", "BELLANDUR-OUTER", "DOMLUR", "BRIGADE METROPOLIS"],
            "IFSC_Code": ["SBIN0017040", "SBIN0015647", "SBIN0041171", "SBIN0016877", "SBIN0015034"],
            "Address": [
                "Panathur Junction, Marathahalli", "Kaikondrahalli, Bellandur",
                "Outer Ring Road, Bellandur", "Complex, Domlur", "Whitefield Road"
            ],
            "City": ["BANGALORE"] * 5,
            "Latitude": [12.9382107, 12.9188658, 12.9246927, 12.9534312, 12.9927608],
            "Longitude": [77.6992385, 77.6700914, 77.672937, 77.6406167, 77.7021471],
        })

# --- ALL API ROUTES ---

@router.get("/branches")
async def get_branches():
    data = BranchData.get_branches()
    return data.to_dict(orient="records")

@router.get("/branch/{branch_name}")
async def get_branch(branch_name: str):
    data = BranchData.get_branches()
    branch = data[data['Branch'] == branch_name]
    if branch.empty:
        raise HTTPException(status_code=404, detail="Branch not found")
    return branch.iloc[0].to_dict()

@router.post("/search-poi")
async def search_poi(request: POISearchRequest):
    if request.lat and request.lng:
        results = await search_poi_apify(request.query, request.lat, request.lng, request.max_results)
        return {"success": True, "data": results, "count": len(results)}
    
    branch_data = BranchData.get_branches()
    selected = branch_data if "All Branches" in request.branches else branch_data[branch_data['Branch'].isin(request.branches)]
    
    all_results = []
    for _, branch in selected.iterrows():
        results = await search_poi_apify(request.query, branch['Latitude'], branch['Longitude'], request.max_results // len(selected))
        for res in results:
            res.update({'source_branch': branch['Branch'], 'source_ifsc': branch['IFSC_Code']})
        all_results.extend(results)
        await asyncio.sleep(0.2)
    
    return {"success": True, "data": all_results, "count": len(all_results)}

@router.get("/poi-categories")
async def get_poi_categories():
    return {"Education": ["college", "school"], "Business": ["tech park", "office"], "Healthcare": ["hospital"]}

@router.post("/export")
async def export_data(data: List[Dict], format: str = "json"):
    df = pd.DataFrame(data)
    if format == "csv":
        return Response(content=df.to_csv(index=False), media_type="text/csv")
    return df.to_dict(orient="records")

# --- UTILS ---

async def search_poi_apify(query, lat, lng, max_items):
    try:
        res = requests.post(APIFY_API_URL, params={"token": APIFY_TOKEN}, json={
            "query": query, "lat": str(lat), "lng": str(lng), "maxItems": max_items, "country": "IN"
        }, timeout=30)
        if res.status_code in [200, 201]:
            items = res.json()
            for i in items:
                i['distance_km'] = calculate_distance(lat, lng, i.get('latitude', lat), i.get('longitude', lng))
            return items
        return []
    except:
        return []

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    a = sin((lat2-lat1)/2)**2 + cos(lat1)*cos(lat2)*sin((lon2-lon1)/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))

app.include_router(router)
