import { Platform } from "react-native";

export function getApiBaseUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (
      window.location.protocol === "https:" ||
      window.location.port === "8000" ||
      window.location.port === ""
    ) {
      return window.location.origin;
    }
    return `http://${window.location.hostname}:8000`;
  }

  return (
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    "http://127.0.0.1:8000"
  );
}
