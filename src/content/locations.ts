/**
 * Places shown on the map on the About page.
 *
 * To add a place: copy a line, change the name, country, longitude (lon)
 * and latitude (lat). You can find these by right-clicking a spot in
 * Google Maps and clicking the two numbers at the top of the menu
 * (the first is latitude, the second is longitude).
 *
 * `label` says which side of the dot the name sits on.
 * SAMPLE content — replace with the real factory and destinations.
 */
export type MapPlace = {
  name: string;
  country: string;
  lat: number;
  lon: number;
  label: "above" | "below" | "left" | "right";
};

export const factory: MapPlace = { name: "Dubai", country: "UAE", lat: 25.2, lon: 55.27, label: "above" };

export const destinations: MapPlace[] = [
  { name: "Doha", country: "Qatar", lat: 25.29, lon: 51.53, label: "below" },
  { name: "Thiruvananthapuram", country: "India", lat: 8.52, lon: 76.94, label: "left" },
  { name: "London", country: "United Kingdom", lat: 51.51, lon: -0.13, label: "above" },
  { name: "California", country: "United States", lat: 36.77, lon: -119.41, label: "below" },
  { name: "Queensland", country: "Australia", lat: -27.47, lon: 153.01, label: "below" },
];
