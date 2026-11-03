"use client";

import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
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
  const position: [number, number] = [latitude, longitude];
  return (
    <MapContainer center={position} zoom={15} scrollWheelZoom={false} className="z-0 h-[280px] w-full rounded-2xl">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={position} icon={pin}>
        <Popup>Vị trí gần đúng trong khu vực này.</Popup>
      </Marker>
    </MapContainer>
  );
}
