AOS.init({ duration: 800, once: true });

const map = L.map('map').setView([12.9716, 77.5946], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("active");
  setTimeout(() => map.invalidateSize(), 300);
}

async function searchPOI() {
  const query = queryInput.value;
  const lat = latInput.value;
  const lng = lngInput.value;

  const res = await fetch("/api/search-poi", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ query, lat, lng })
  });

  const data = await res.json();

  map.eachLayer(layer => layer instanceof L.Marker && map.removeLayer(layer));

  data.results.forEach(poi => {
    L.marker([poi.latitude, poi.longitude])
      .addTo(map)
      .bindPopup(`<b>${poi.name}</b><br>${poi.distance_km.toFixed(2)} km`);
  });

  new CountUp("totalPOI", data.count).start();

  Plotly.newPlot("chart", [{
    x: data.results.map(p => p.rating || 0),
    type: "histogram"
  }], { title: "Rating Distribution" });
}
