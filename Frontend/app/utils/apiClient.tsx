import { refreshAccessToken } from "./refreshAccessToken";
import { apiUrl } from "@/lib/apiBase";

export type ApiClientRole = "superAdmin" | "templeAdmin" | "user";

export const apiClient = async (
    url: string,
    options: RequestInit = {},
    role: ApiClientRole = "user"
) => {
    try {
        let accessToken: string | null = null;
        if (typeof window !== "undefined" && window.sessionStorage) {
            accessToken = window.sessionStorage.getItem("accessToken");
        }

        // Add the access token to the headers
        const headers = new Headers(options.headers);
        if (accessToken) {
            headers.set("Authorization", `Bearer ${accessToken}`);
        }

        let response = await fetch(url, { ...options, headers });

        // If the access token is expired or missing, refresh it
        if (response.status === 401) {
            console.warn("Access token expired or missing. Refreshing...");

            // Determine the refresh endpoint based on the role
            const refreshEndpoint =
                role === "superAdmin"
                    ? apiUrl("/api/v1/superAdmin/refresh-Access-Token")
                    : role === "templeAdmin"
                    ? apiUrl("/api/v1/templeAdmin/refresh-token")
                    : apiUrl("/api/v1/users/refresh-Token");

            accessToken = await refreshAccessToken(refreshEndpoint);

            if (!accessToken) {
                return response;
            }

            // Retry the original request with the new access token
            const retryHeaders = new Headers(options.headers);
            retryHeaders.set("Authorization", `Bearer ${accessToken}`);

            response = await fetch(url, { ...options, headers: retryHeaders });
        }

        return response;
    } catch (error) {
        console.error("API request error:", error);
        throw error;
    }
};