"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

const pin = L.icon({
  iconUrl: "/images/leaflet/marker-icon.png",
  iconRetinaUrl: "/images/leaflet/marker-icon-2x.png",
  shadowUrl: "/images/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export function ListingAreaMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, {
      center: [latitude, longitude],
      zoom: 15,
      scrollWheelZoom: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    L.marker([latitude, longitude], { icon: pin }).addTo(map).bindPopup("Vị trí gần đúng trong khu vực này.");

    const frame = requestAnimationFrame(() => {
      map.invalidateSize();
    });

    return () => {
      cancelAnimationFrame(frame);
      map.remove();
    };
  }, [latitude, longitude]);

  return <div ref={containerRef} className="z-0 h-[280px] w-full rounded-2xl" />;
}
