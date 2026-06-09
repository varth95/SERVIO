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

    // Esri World Imagery satellite tile layer (base)
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19,
    }).addTo(MapView.map);

    // Esri World Topo Map labels overlay (streets, cities, landmarks)
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19,
      opacity: 0.5,
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
          background: linear-gradient(135deg, #FFB45A, #FFA333);
          color: white; border-radius: 50%; width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.1rem; box-shadow: 0 4px 12px rgba(255, 180, 90, 0.3);
          border: 2px solid white;
        ">${food.food_type === "veg" ? "Veg" : "Non-Veg"}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([food.latitude, food.longitude], { icon })
        .addTo(MapView.map)
        .bindPopup(`
          <div style="min-width:200px; font-family: Inter, sans-serif; padding: 4px;">
            <strong style="font-size:1rem; color: #2d3748;">${food.org_name}</strong><br/>
            <span style="color:#718096; font-size:0.85rem; display: inline-block; margin-top: 4px;">${food.food_type === "veg" ? "Veg" : "Non-Veg"} · ${food.quantity}kg · ${food.quality}</span><br/>
            <span style="color:#718096; font-size:0.8rem; display: inline-block; margin-top: 2px;">${food.pickup_address}</span><br/>
            <button onclick="Food.showDetail(${food.id}); App.showPage('food-detail');"
              style="margin-top:10px; width: 100%; padding:8px 16px; background:#20C7BE; color:white;
                     border:none; border-radius:20px; cursor:pointer; font-size:0.8rem; font-weight:600;
                     box-shadow: 0 4px 10px rgba(32, 199, 190, 0.2); transition: all 0.2s ease;">
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
          background: #20C7BE; color: white; border-radius: 50%;
          width: 40px; height: 40px; display: flex; align-items: center;
          justify-content: center; font-size: 1.2rem;
          box-shadow: 0 4px 12px rgba(32, 199, 190, 0.4); border: 3px solid white;
        "></div>`,
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
