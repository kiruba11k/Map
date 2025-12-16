// Add this to the SBIDashboard class
SBIDashboard.prototype.initMap = async function() {
    try {
        // Initialize main map
        mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA';
        
        this.map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/light-v10',
            center: [77.5946, 12.9716], // Bangalore center
            zoom: 11
        });
        
        // Add navigation controls
        this.map.addControl(new mapboxgl.NavigationControl());
        
        // Initialize POI map
        this.poiMap = new mapboxgl.Map({
            container: 'poiMap',
            style: 'mapbox://styles/mapbox/light-v10',
            center: [77.5946, 12.9716],
            zoom: 11
        });
        this.poiMap.addControl(new mapboxgl.NavigationControl());
        
        // Wait for map to load
        await this.map.once('load');
        await this.poiMap.once('load');
        
        this.updateBranchMap();
        
    } catch (error) {
        console.error('Map initialization error:', error);
    }
};

SBIDashboard.prototype.updateBranchMap = function() {
    if (!this.map || !this.branches) return;
    
    const selectedBranches = Array.from(document.getElementById('branchSelect').selectedOptions)
        .map(opt => opt.value);
    
    const filteredBranches = selectedBranches.includes('All Branches') 
        ? this.branches 
        : this.branches.filter(b => selectedBranches.includes(b.Branch));
    
    // Remove existing layers and sources
    if (this.map.getSource('branches')) {
        this.map.removeLayer('branches-layer');
        this.map.removeSource('branches');
    }
    
    // Add branch markers
    this.map.addSource('branches', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: filteredBranches.map(branch => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [branch.Longitude, branch.Latitude]
                },
                properties: {
                    name: branch.Branch,
                    address: branch.Address,
                    ifsc: branch.IFSC_Code
                }
            }))
        }
    });
    
    this.map.addLayer({
        id: 'branches-layer',
        type: 'circle',
        source: 'branches',
        paint: {
            'circle-radius': 10,
            'circle-color': '#0077b6',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
        }
    });
    
    // Add popups
    this.map.on('click', 'branches-layer', (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const props = e.features[0].properties;
        
        new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(`
                <h6><strong>${props.name}</strong></h6>
                <p><small>${props.address}</small></p>
                <p><code>IFSC: ${props.ifsc}</code></p>
            `)
            .addTo(this.map);
    });
    
    // Fit bounds to show all branches
    if (filteredBranches.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        filteredBranches.forEach(branch => {
            bounds.extend([branch.Longitude, branch.Latitude]);
        });
        this.map.fitBounds(bounds, { padding: 50 });
    }
};

SBIDashboard.prototype.updatePOIMap = function() {
    if (!this.poiMap || this.poiResults.length === 0) return;
    
    // Clear existing layers
    const layers = this.poiMap.getStyle().layers || [];
    layers.forEach(layer => {
        if (layer.id.includes('poi-') || layer.id.includes('branch-')) {
            this.poiMap.removeLayer(layer.id);
        }
    });
    
    const sources = Object.keys(this.poiMap.getStyle().sources || {});
    sources.forEach(source => {
        if (source.includes('poi-') || source.includes('branch-')) {
            this.poiMap.removeSource(source);
        }
    });
    
    // Add POI data
    this.poiMap.addSource('poi-data', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: this.poiResults.map(poi => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [poi.longitude, poi.latitude]
                },
                properties: {
                    name: poi.name,
                    address: poi.full_address || poi.address,
                    rating: poi.rating,
                    type: poi.types?.[0],
                    distance: poi.distance_km
                }
            }))
        }
    });
    
    // Color by type
    const typeColors = {
        'education': '#ff0000',
        'business': '#00ff00',
        'healthcare': '#ffff00',
        'retail': '#ff00ff',
        'food': '#ffa500',
        'default': '#808080'
    };
    
    this.poiMap.addLayer({
        id: 'poi-points',
        type: 'circle',
        source: 'poi-data',
        paint: {
            'circle-radius': 8,
            'circle-color': [
                'match',
                ['get', 'type'],
                'school', typeColors.education,
                'college', typeColors.education,
                'university', typeColors.education,
                'office', typeColors.business,
                'hospital', typeColors.healthcare,
                'clinic', typeColors.healthcare,
                'mall', typeColors.retail,
                'restaurant', typeColors.food,
                typeColors.default
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
        }
    });
    
    // Add popups
    this.poiMap.on('click', 'poi-points', (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const props = e.features[0].properties;
        
        new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(`
                <h6><strong>${props.name}</strong></h6>
                <p><small>${props.address}</small></p>
                <p>Rating: ${props.rating || 'N/A'}/5</p>
                <p>Type: ${props.type || 'Unknown'}</p>
                ${props.distance ? `<p>Distance: ${props.distance.toFixed(1)} km</p>` : ''}
            `)
            .addTo(this.poiMap);
    });
    
    // Fit bounds
    const bounds = new mapboxgl.LngLatBounds();
    this.poiResults.forEach(poi => {
        if (poi.longitude && poi.latitude) {
            bounds.extend([poi.longitude, poi.latitude]);
        }
    });
    
    if (!bounds.isEmpty()) {
        this.poiMap.fitBounds(bounds, { padding: 50 });
    }
};
