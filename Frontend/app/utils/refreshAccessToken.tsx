export const refreshAccessToken = async (endpoint: string): Promise<string | null> => {
    // Guard against SSR / non-browser environments (Next can evaluate modules server-side)
    if (typeof window === "undefined") return null;

    const ls = window.localStorage;
    const ss = window.sessionStorage;

    if (!ls || typeof ls.getItem !== "function" || typeof ls.setItem !== "function") return null;
    if (!ss || typeof ss.getItem !== "function" || typeof ss.setItem !== "function") return null;

    const refreshToken = ls.getItem("refreshToken");
    if (!refreshToken) {
        throw new Error("Refresh token is missing");
    }

    //  console.log("Using refreshToken:", refreshToken); // Debugging

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            credentials: "include", // Include cookies in the request
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
            throw new Error("Failed to refresh access token");
        }

        const result = await response.json();
        // console.log("Refresh token response:", result); // Debugging

        if (result.success) {
            // Store the new access token and refresh token
            ss.setItem("accessToken", result.data.accessToken);
            ls.setItem("refreshToken", result.data.refreshToken);
            return result.data.accessToken;
        } else {
            throw new Error(result.message || "Failed to refresh access token");
        }
    } catch (error) {
        console.error("Error refreshing access token:", error);
        throw error;
    }
};