// Add this to the SBIDashboard class
SBIDashboard.prototype.updateCharts = function() {
    if (this.poiResults.length === 0) return;
    
    // Type distribution chart
    const typeCounts = {};
    this.poiResults.forEach(poi => {
        const type = poi.types?.[0] || 'Unknown';
        typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    const typeCtx = document.getElementById('typeChart').getContext('2d');
    if (this.charts.typeChart) {
        this.charts.typeChart.destroy();
    }
    
    this.charts.typeChart = new Chart(typeCtx, {
        type: 'pie',
        data: {
            labels: Object.keys(typeCounts),
            datasets: [{
                data: Object.values(typeCounts),
                backgroundColor: [
                    '#0077b6', '#0096c7', '#00b4d8', '#48cae4',
                    '#90e0ef', '#ade8f4', '#caf0f8', '#03045e'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                },
                title: {
                    display: true,
                    text: 'POI Type Distribution'
                }
            }
        }
    });
    
    // Rating distribution chart
    const ratings = this.poiResults
        .filter(poi => poi.rating)
        .map(poi => poi.rating);
    
    const ratingCtx = document.getElementById('ratingChart').getContext('2d');
    if (this.charts.ratingChart) {
        this.charts.ratingChart.destroy();
    }
    
    if (ratings.length > 0) {
        this.charts.ratingChart = new Chart(ratingCtx, {
            type: 'bar',
            data: {
                labels: ['1', '2', '3', '4', '5'],
                datasets: [{
                    label: 'Number of POIs',
                    data: [
                        ratings.filter(r => r >= 1 && r < 2).length,
                        ratings.filter(r => r >= 2 && r < 3).length,
                        ratings.filter(r => r >= 3 && r < 4).length,
                        ratings.filter(r => r >= 4 && r < 5).length,
                        ratings.filter(r => r === 5).length
                    ],
                    backgroundColor: '#00b4d8',
                    borderColor: '#0077b6',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Count'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Rating'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Rating Distribution'
                    }
                }
            }
        });
    }
};
