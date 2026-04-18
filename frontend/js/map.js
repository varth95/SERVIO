/**
 * Servio Map Module
 * Uses Leaflet.js with OpenStreetMap (free, no API key needed).
 * Google Maps can be swapped in by replacing the tile layer.
 */

const MapView = {
  map: null,
  markers: [],

  init() {
    if (MapView.map) return; // already initialized

    MapView.map = L.map("map-container").setView([20.5937, 78.9629], 5); // India center

    // OpenStreetMap tile layer (free)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(MapView.map);

    MapView.loadMarkers();
  },

  async loadMarkers() {
    // Clear existing markers
    MapView.markers.forEach((m) => m.remove());
    MapView.markers = [];

    const res = await Api.food.list("available");
    if (!res.ok) return;

    res.data.forEach((food) => {
      if (!food.latitude || !food.longitude) return;

      const icon = L.divIcon({
        className: "",
        html: `<div style="
          background: linear-gradient(135deg, #ff6b35, #ff8c42);
          color: white; border-radius: 50%; width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.1rem; box-shadow: 0 2px 8px rgba(255,107,53,0.4);
          border: 2px solid white;
        ">${food.food_type === "veg" ? "🥦" : "🍗"}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([food.latitude, food.longitude], { icon })
        .addTo(MapView.map)
        .bindPopup(`
          <div style="min-width:200px; font-family: Inter, sans-serif;">
            <strong style="font-size:1rem;">${food.org_name}</strong><br/>
            <span style="color:#636e72; font-size:0.85rem;">${food.food_type === "veg" ? "🥦 Veg" : "🍗 Non-Veg"} · ${food.quantity}kg · ${food.quality}</span><br/>
            <span style="color:#636e72; font-size:0.8rem;">📍 ${food.pickup_address}</span><br/>
            <button onclick="Food.showDetail(${food.id}); App.showPage('food-detail');"
              style="margin-top:8px; padding:6px 12px; background:#ff6b35; color:white;
                     border:none; border-radius:6px; cursor:pointer; font-size:0.8rem; font-weight:600;">
              View Details
            </button>
          </div>
        `);

      MapView.markers.push(marker);
    });

    // Try to center on user's location
    if (Auth.currentUser?.latitude && Auth.currentUser?.longitude) {
      MapView.map.setView([Auth.currentUser.latitude, Auth.currentUser.longitude], 12);

      // User location marker
      const userIcon = L.divIcon({
        className: "",
        html: `<div style="
          background: #4ecdc4; color: white; border-radius: 50%;
          width: 40px; height: 40px; display: flex; align-items: center;
          justify-content: center; font-size: 1.2rem;
          box-shadow: 0 2px 10px rgba(78,205,196,0.5); border: 3px solid white;
        ">👤</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      L.marker([Auth.currentUser.latitude, Auth.currentUser.longitude], { icon: userIcon })
        .addTo(MapView.map)
        .bindPopup("<strong>Your Location</strong>")
        .openPopup();
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        MapView.map.setView([pos.coords.latitude, pos.coords.longitude], 12);
      });
    }
  },

  refresh() {
    if (MapView.map) {
      MapView.map.invalidateSize();
      MapView.loadMarkers();
    }
  },
};
