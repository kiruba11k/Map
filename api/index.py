from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, Response
from pydantic import BaseModel
import pandas as pd
import requests
import json
from typing import List, Dict, Optional
from datetime import datetime
import io
import asyncio
import os
from dotenv import load_dotenv
from math import radians, sin, cos, sqrt, atan2

load_dotenv()

# Note: The root path is now handled by your frontend/index.html via vercel.json
app = FastAPI(title="SBI Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
                "Panathur Junction, Marathahalli",
                "Kaikondrahalli, Bellandur",
                "Outer Ring Road, Bellandur",
                "Complex, Domlur",
                "Whitefield Road"
            ],
            "City": ["BANGALORE"] * 5,
            "State": ["KARNATAKA"] * 5,
            "Pincode": ["560037", "560035", "560103", "560071", "560016"],
            "Country": ["India"] * 5,
            "Latitude": [12.9382107, 12.9188658, 12.9246927, 12.9534312, 12.9927608],
            "Longitude": [77.6992385, 77.6700914, 77.672937, 77.6406167, 77.7021471],
        })

# --- ALL ROUTES NOW START WITH /api TO MATCH VERCEL REWRITES ---
@app.get("/api/branches")
async def get_branches():
    data = BranchData.get_branches()
    return data.to_dict(orient="records")

@app.get("/api/branch/{branch_name}")
async def get_branch(branch_name: str):
    data = BranchData.get_branches()
    branch = data[data['Branch'] == branch_name]
    if branch.empty:
        raise HTTPException(status_code=404, detail="Branch not found")
    return branch.iloc[0].to_dict()

@app.post("/api/search-poi")
async def search_poi(request: POISearchRequest):
    if request.lat and request.lng:
        results = await search_poi_apify(
            query=request.query,
            lat=request.lat,
            lng=request.lng,
            max_items=request.max_results
        )
        if results:
            for item in results:
                item['source_branch'] = 'Manual Search'
            return {"success": True, "data": results, "count": len(results)}
    else:
        branch_data = BranchData.get_branches()
        if "All Branches" in request.branches:
            selected_branches = branch_data
        else:
            selected_branches = branch_data[branch_data['Branch'].isin(request.branches)]
        
        all_results = []
        for idx, branch in selected_branches.iterrows():
            results = await search_poi_apify(
                query=request.query,
                lat=branch['Latitude'],
                lng=branch['Longitude'],
                max_items=request.max_results // len(selected_branches)
            )
            for result in results:
                result['source_branch'] = branch['Branch']
                result['source_ifsc'] = branch['IFSC_Code']
                result['source_address'] = branch['Address']
            all_results.extend(results)
            await asyncio.sleep(0.5) 
        
        return {"success": True, "data": all_results, "count": len(all_results)}
    
    return {"success": False, "data": [], "count": 0}

@app.get("/api/poi-categories")
async def get_poi_categories():
    categories = {
        "Education": ["college", "university", "school"],
        "Business": ["tech park", "office"],
        "Healthcare": ["hospital", "clinic"],
        "Retail": ["shopping mall", "mall"],
        "Food": ["restaurant", "cafe"],
        "Banking": ["bank", "atm"]
    }
    return categories

@app.post("/api/export")
async def export_data(data: List[Dict], format: str = "json"):
    df = pd.DataFrame(data)
    if format == "csv":
        csv_str = df.to_csv(index=False)
        return JSONResponse(content={"data": csv_str})
    elif format == "json":
        return df.to_dict(orient="records")
    elif format == "excel":
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='POI_Data')
        output.seek(0)
        return Response(
            content=output.read(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=poi_data.xlsx"}
        )

# --- HELPER FUNCTIONS ---

async def search_poi_apify(query: str, lat: float, lng: float, max_items: int = 30):
    payload = {
        "query": query, "lat": str(lat), "lng": str(lng),
        "maxItems": max_items, "country": "IN", "lang": "en", "zoom": 12
    }
    try:
        headers = {"Content-Type": "application/json"}
        params = {"token": APIFY_TOKEN}
        response = requests.post(APIFY_API_URL, params=params, json=payload, headers=headers, timeout=30)
        if response.status_code in [200, 201]:
            results = response.json()
            for item in results:
                item['distance_km'] = calculate_distance(lat, lng, item.get('latitude', lat), item.get('longitude', lng))
            return results
        return []
    except Exception as e:
        print(f"Error: {e}")
        return []

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
