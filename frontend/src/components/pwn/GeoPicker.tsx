import React from "react";
import { Input } from "@/components/ui/input";
import {
  loadLeafletLibrary,
  setupMapEventHandlers,
  setupMapResizeHandlers,
  searchNominatim,
  NominatimResult
} from "./geo-picker-helpers";

type GeoPickerProps = {
  value?: { lat: number; lng: number } | null;
  onChange: (coords: { lat: number; lng: number }) => void;
  height?: number | string;
  radiusKm?: number | null;
};

// Lightweight Leaflet loader via CDN to avoid bundling dependencies
export default function GeoPicker({ value, onChange, height = 320, radiusKm }: GeoPickerProps) {
  const mapRef = React.useRef<HTMLDivElement | null>(null);
  const leafletReadyRef = React.useRef(false);
  const instanceRef = React.useRef<any>(null);
  const markerRef = React.useRef<any>(null);
  const circleRef = React.useRef<any>(null);

  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<NominatimResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const debounceRef = React.useRef<any>(null);
  const ignoreSearchOnceRef = React.useRef(false);
  const cleanupRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    if (typeof globalThis.window === "undefined") return;

    let destroyed = false;
    (async () => {
      await loadLeafletLibrary();
      if (destroyed || !mapRef.current) return;
      const L = (globalThis.window as any).L;
      leafletReadyRef.current = true;

      // Default to random location if no value provided
      const getRandomLocation = () => ({
        lat: (Math.random() * 180) - 90,  // Random latitude between -90 and 90
        lng: (Math.random() * 360) - 180  // Random longitude between -180 and 180
      });
      const initial = value || getRandomLocation();
      
      // Double-check mapRef is still available before calling L.map()
      if (!mapRef.current) return;
      const map = L.map(mapRef.current).setView([initial.lat, initial.lng], 50);
      instanceRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      // Add scale control for real-world distance reference
      try { L.control.scale({ metric: true, imperial: false }).addTo(map); } catch {}

      markerRef.current = L.marker([initial.lat, initial.lng], { draggable: true }).addTo(map);
      if (typeof radiusKm === 'number' && !Number.isNaN(radiusKm)) {
        circleRef.current = L.circle([initial.lat, initial.lng], { radius: radiusKm * 1000, color: '#0ea5e9', fillColor: '#0ea5e9', fillOpacity: 0.15 }).addTo(map);
        try { map.fitBounds(circleRef.current.getBounds(), { padding: [16, 16] }); } catch {}
      }
      
      setupMapEventHandlers(map, markerRef.current, circleRef.current, onChange, () => {
        setResults([]);
        setQuery('');
      });

      setTimeout(() => {
        try { map.invalidateSize(); } catch {}
      }, 100);

      cleanupRef.current = setupMapResizeHandlers(map, mapRef.current);
    })();

    return () => {
      destroyed = true;
      try {
        if (cleanupRef.current) cleanupRef.current();
        if (instanceRef.current) instanceRef.current.remove();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search using Nominatim
  React.useEffect(() => {
    if (ignoreSearchOnceRef.current) {
      // Skip one search cycle after selecting a suggestion programmatically
      ignoreSearchOnceRef.current = false;
      return;
    }
    if (!query || query.trim().length < 3) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setSearching(true);
        const results = await searchNominatim(query);
        setResults(results);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [query]);

  const moveTo = (lat: number, lng: number) => {
    onChange({ lat, lng });
    try {
      if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
      if (circleRef.current) circleRef.current.setLatLng([lat, lng]);
      if (instanceRef.current) instanceRef.current.setView([lat, lng]);
    } catch {}
  };

  // When value changes externally, move marker
  React.useEffect(() => {
    if (!leafletReadyRef.current || !value || !markerRef.current || !instanceRef.current) return;
    markerRef.current.setLatLng([value.lat, value.lng]);
    instanceRef.current.setView([value.lat, value.lng]);
    if (circleRef.current) circleRef.current.setLatLng([value.lat, value.lng]);
  }, [value]);

  React.useEffect(() => {
    if (!leafletReadyRef.current || !instanceRef.current || !markerRef.current) return;
    const L = (window as any).L;
    const pos = markerRef.current.getLatLng();
    if (typeof radiusKm === 'number' && !Number.isNaN(radiusKm)) {
      if (!circleRef.current) {
        circleRef.current = L.circle([pos.lat, pos.lng], { radius: radiusKm * 1000, color: '#0ea5e9', fillColor: '#0ea5e9', fillOpacity: 0.15 }).addTo(instanceRef.current);
        try { instanceRef.current.fitBounds(circleRef.current.getBounds(), { padding: [16, 16] }); } catch {}
      } else {
        circleRef.current.setRadius(radiusKm * 1000);
        try { instanceRef.current.fitBounds(circleRef.current.getBounds(), { padding: [16, 16] }); } catch {}
      }
    } else if (circleRef.current) {
      circleRef.current.remove();
      circleRef.current = null;
    }
  }, [radiusKm]);

  return (
    <div
      style={{
        width: "100%",
        height: typeof height === 'number' ? `${height}px` : height,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={"Search a place (min 3 chars)"}
          disabled={searching}
        />
        {results.length > 0 && (
          <div
            style={{
              position: "relative",
              zIndex: 10,
            }}
          >
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "6px 0 0 0",
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: "var(--card)",
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {results.map((r, i) => (
                <li
                  key={`${r.lat}-${r.lon}-${i}`}
                  role="button"
                  tabIndex={0}
                  style={{ padding: "8px 10px", cursor: "pointer" }}
                  onClick={() => {
                    const lat = Number.parseFloat(r.lat);
                    const lon = Number.parseFloat(r.lon);
                    moveTo(lat, lon);
                    // Close search results
                    ignoreSearchOnceRef.current = true;
                    setQuery(r.display_name);
                    setResults([]);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      const lat = Number.parseFloat(r.lat);
                      const lon = Number.parseFloat(r.lon);
                      moveTo(lat, lon);
                      // Set the input text but suppress the next search effect
                      ignoreSearchOnceRef.current = true;
                      setQuery(r.display_name);
                      setResults([]);
                    }
                  }}
                >
                  {r.display_name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    <div
        ref={mapRef}
        style={{
      flex: 1,
      minHeight: 200,
          width: "100%",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid var(--border)",
          position: "relative",
          zIndex: 0, // isolate Leaflet panes under sibling overlays
        }}
      />
    </div>
  );
}


