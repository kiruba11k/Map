class SBIDashboard {
    constructor() {
        this.branches = [];
        this.poiResults = [];
        this.searchHistory = [];
        this.currentTab = 'dashboard';
        this.map = null;
        this.poiMap = null;
        this.charts = {};
        
        // For Vercel deployment
        this.API_BASE = window.location.origin + '/api';
    }

    async init() {
        this.setupEventListeners();
        await this.loadBranches();
        await this.initMap();
        this.updateMetrics();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = link.getAttribute('data-tab');
                this.switchTab(tab);
            });
        });

        // Branch selection
        document.getElementById('branchSelect').addEventListener('change', () => {
            this.updateBranchMap();
        });

        // POI Category
        document.getElementById('poiCategory').addEventListener('change', (e) => {
            if (e.target.value) {
                document.getElementById('customSearch').value = e.target.value;
            }
        });

        // Range inputs
        document.getElementById('maxResults').addEventListener('input', (e) => {
            document.getElementById('maxResultsValue').textContent = e.target.value;
        });

        document.getElementById('zoomLevel').addEventListener('input', (e) => {
            document.getElementById('zoomValue').textContent = e.target.value;
            if (this.map) {
                this.map.setZoom(parseInt(e.target.value));
            }
        });

        // Manual search toggle
        document.getElementById('manualSearchToggle').addEventListener('change', (e) => {
            const coordsDiv = document.getElementById('manualSearchCoords');
            if (e.target.checked) {
                coordsDiv.classList.remove('d-none');
            } else {
                coordsDiv.classList.add('d-none');
            }
        });

        // Map style
        document.getElementById('mapStyle').addEventListener('change', (e) => {
            if (this.map) {
                const style = e.target.value;
                const styleMap = {
                    'light': 'mapbox://styles/mapbox/light-v10',
                    'dark': 'mapbox://styles/mapbox/dark-v10',
                    'streets': 'mapbox://styles/mapbox/streets-v11',
                    'satellite': 'mapbox://styles/mapbox/satellite-streets-v11'
                };
                this.map.setStyle(styleMap[style]);
            }
        });

        // Search button
        document.getElementById('searchBtn').addEventListener('click', () => {
            this.searchPOI();
        });

        // Clear results
        document.getElementById('clearResultsBtn').addEventListener('click', () => {
            this.clearResults();
        });

        // Export buttons
        document.getElementById('exportCSV').addEventListener('click', () => {
            this.exportData('csv');
        });
        document.getElementById('exportJSON').addEventListener('click', () => {
            this.exportData('json');
        });
        document.getElementById('exportExcel').addEventListener('click', () => {
            this.exportData('excel');
        });
    }

    async loadBranches() {
        try {
            this.showLoading();
            const response = await axios.get(`${this.API_BASE}/api/branches`);
            this.branches = response.data;
            this.populateBranchSelect();
            this.populateBranchTable();
            this.updateMetrics();
        } catch (error) {
            console.error('Error loading branches:', error);
            this.showError('Failed to load branch data');
        } finally {
            this.hideLoading();
        }
    }

    populateBranchSelect() {
        const select = document.getElementById('branchSelect');
        select.innerHTML = '<option value="All Branches" selected>All Branches</option>';
        
        this.branches.forEach(branch => {
            const option = document.createElement('option');
            option.value = branch.Branch;
            option.textContent = branch.Branch;
            select.appendChild(option);
        });
    }

    populateBranchTable() {
        const tbody = document.querySelector('#branchesTable tbody');
        tbody.innerHTML = '';
        
        this.branches.forEach(branch => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${branch.Branch}</strong></td>
                <td><code>${branch.IFSC_Code}</code></td>
                <td>${branch.Address}</td>
                <td>${branch.City}</td>
                <td>${branch.Latitude.toFixed(6)}, ${branch.Longitude.toFixed(6)}</td>
            `;
            tbody.appendChild(row);
        });
    }

    async searchPOI() {
        const query = document.getElementById('customSearch').value;
        if (!query.trim()) {
            this.showError('Please enter a search query');
            return;
        }

        const selectedBranches = Array.from(document.getElementById('branchSelect').selectedOptions)
            .map(opt => opt.value);
        
        const maxResults = document.getElementById('maxResults').value;
        const manualSearch = document.getElementById('manualSearchToggle').checked;
        
        const searchData = {
            query: query,
            branches: selectedBranches,
            max_results: parseInt(maxResults)
        };

        if (manualSearch) {
            const lat = parseFloat(document.getElementById('manualLat').value);
            const lng = parseFloat(document.getElementById('manualLng').value);
            if (lat && lng) {
                searchData.lat = lat;
                searchData.lng = lng;
            }
        }

        try {
            this.showLoading();
            const response = await axios.post(`${this.API_BASE}/api/search-poi`, searchData);
            
            if (response.data.success) {
                this.poiResults = response.data.data;
                this.displayPOIResults();
                
                // Add to search history
                this.searchHistory.push({
                    timestamp: new Date().toLocaleString(),
                    query: query,
                    location: manualSearch ? 'Manual Coordinates' : selectedBranches.join(', '),
                    results: response.data.count
                });
                
                this.updateSearchHistory();
            } else {
                this.showError('No results found');
            }
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Search failed. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    displayPOIResults() {
        // Show POI sections
        document.getElementById('poiMetrics').style.display = 'block';
        document.getElementById('poiMapSection').style.display = 'block';
        document.getElementById('poiResultsSection').style.display = 'block';
        document.getElementById('noResultsSection').style.display = 'none';
        
        // Update metrics
        const totalPOIs = this.poiResults.length;
        const uniqueTypes = new Set(this.poiResults.map(p => p.types?.[0] || 'Unknown')).size;
        const avgRating = this.poiResults.reduce((sum, p) => sum + (p.rating || 0), 0) / totalPOIs;
        
        document.getElementById('totalPOIs').textContent = totalPOIs;
        document.getElementById('uniqueTypes').textContent = uniqueTypes;
        document.getElementById('avgRating').textContent = avgRating.toFixed(1);
        
        // Populate table
        this.populatePOITable();
        
        // Update POI map
        this.updatePOIMap();
        
        // Update charts
        this.updateCharts();
        
        // Switch to POI tab
        this.switchTab('poi-search');
    }

    populatePOITable() {
        const tbody = document.querySelector('#poiTable tbody');
        tbody.innerHTML = '';
        
        this.poiResults.forEach(poi => {
            const row = document.createElement('tr');
            row.style.cursor = 'pointer';
            row.addEventListener('click', () => this.showPOIDetail(poi));
            
            row.innerHTML = `
                <td><strong>${poi.name || 'Unknown'}</strong></td>
                <td>${poi.full_address || poi.address || 'N/A'}</td>
                <td>
                    ${poi.rating ? `
                        <span class="badge bg-warning text-dark">
                            ${poi.rating} <i class="fas fa-star"></i>
                        </span>
                    ` : 'N/A'}
                </td>
                <td>${poi.distance_km ? `${poi.distance_km.toFixed(1)} km` : 'N/A'}</td>
                <td>
                    <span class="badge bg-primary">
                        ${poi.types?.[0] || 'Unknown'}
                    </span>
                </td>
                <td>${poi.source_branch || 'Manual Search'}</td>
            `;
            tbody.appendChild(row);
        });
    }

    showPOIDetail(poi) {
        document.getElementById('poiDetailTitle').textContent = poi.name || 'Unknown';
        
        let content = `
            <div class="row">
                <div class="col-md-8">
                    <p><strong>Address:</strong> ${poi.full_address || poi.address || 'N/A'}</p>
                    <p><strong>Types:</strong> ${Array.isArray(poi.types) ? poi.types.join(', ') : poi.types || 'N/A'}</p>
                    
                    <div class="row mb-3">
                        <div class="col-6">
                            <p><strong>Rating:</strong> ${poi.rating || 'N/A'}/5</p>
                        </div>
                        <div class="col-6">
                            <p><strong>Reviews:</strong> ${poi.review_count || 0}</p>
                        </div>
                    </div>
                    
                    <p><strong>Distance:</strong> ${poi.distance_km ? `${poi.distance_km.toFixed(1)} km` : 'N/A'}</p>
                    <p><strong>Near Branch:</strong> ${poi.source_branch || 'Manual Search'}</p>
                </div>
                <div class="col-md-4">
        `;
        
        if (poi.phone_number) {
            content += `<p><strong>Phone:</strong> ${poi.phone_number}</p>`;
        }
        
        if (poi.website) {
            content += `<p><strong>Website:</strong> <a href="${poi.website}" target="_blank">${poi.website}</a></p>`;
        }
        
        if (poi.place_link) {
            content += `
                <a href="${poi.place_link}" target="_blank" class="btn btn-primary w-100 mb-2">
                    <i class="fas fa-map-marker-alt me-2"></i>Open in Maps
                </a>
            `;
        }
        
        content += `</div></div>`;
        
        document.getElementById('poiDetailContent').innerHTML = content;
        
        const modal = new bootstrap.Modal(document.getElementById('poiDetailModal'));
        modal.show();
    }

    clearResults() {
        this.poiResults = [];
        
        // Hide POI sections
        document.getElementById('poiMetrics').style.display = 'none';
        document.getElementById('poiMapSection').style.display = 'none';
        document.getElementById('poiResultsSection').style.display = 'none';
        document.getElementById('noResultsSection').style.display = 'block';
        
        // Clear table
        document.querySelector('#poiTable tbody').innerHTML = '';
        
        // Clear charts
        if (this.charts.typeChart) {
            this.charts.typeChart.destroy();
        }
        if (this.charts.ratingChart) {
            this.charts.ratingChart.destroy();
        }
    }

    async exportData(format) {
        if (this.poiResults.length === 0) {
            this.showError('No data to export');
            return;
        }
        
        try {
            this.showLoading();
            const response = await axios.post(
                `${this.API_BASE}/api/export?format=${format}`,
                this.poiResults,
                {
                    responseType: format === 'excel' ? 'blob' : 'json'
                }
            );
            
            let blob, filename;
            
            if (format === 'csv') {
                blob = new Blob([response.data.data], { type: 'text/csv' });
                filename = 'poi_results.csv';
            } else if (format === 'json') {
                blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
                filename = 'poi_results.json';
            } else if (format === 'excel') {
                blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                filename = 'poi_results.xlsx';
            }
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.showSuccess(`Data exported as ${format.toUpperCase()}`);
        } catch (error) {
            console.error('Export error:', error);
            this.showError('Export failed');
        } finally {
            this.hideLoading();
        }
    }

    updateMetrics() {
        document.getElementById('totalBranches').textContent = this.branches.length;
        document.getElementById('citiesCovered').textContent = 
            new Set(this.branches.map(b => b.City)).size;
        
        if (this.branches.length > 0) {
            const lats = this.branches.map(b => b.Latitude);
            const area = Math.max(...lats) - Math.min(...lats);
            document.getElementById('areaCoverage').textContent = area.toFixed(2) + '°';
        }
    }

    updateSearchHistory() {
        const tbody = document.querySelector('#searchHistoryTable tbody');
        tbody.innerHTML = '';
        
        this.searchHistory.slice().reverse().forEach(history => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${history.timestamp}</td>
                <td>${history.query}</td>
                <td>${history.location}</td>
                <td><span class="badge bg-primary">${history.results}</span></td>
            `;
            tbody.appendChild(row);
        });
    }

    switchTab(tabName) {
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const activeLink = document.querySelector(`.nav-link[data-tab="${tabName}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.style.display = 'none';
        });
        
        const activeTab = document.getElementById(tabName);
        if (activeTab) {
            activeTab.style.display = 'block';
        }
        
        this.currentTab = tabName;
        
        // Update map size when switching tabs
        setTimeout(() => {
            if (this.map) this.map.resize();
            if (this.poiMap) this.poiMap.resize();
        }, 300);
    }

    showLoading() {
        document.getElementById('loadingSpinner').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingSpinner').style.display = 'none';
    }

    showError(message) {
        // You can implement a toast or alert system here
        alert(`Error: ${message}`);
    }

    showSuccess(message) {
        // You can implement a toast or alert system here
        console.log(`Success: ${message}`);
    }
}
