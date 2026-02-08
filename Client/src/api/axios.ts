import axios from "axios";


const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:6300/api',
    timeout: 60000,
    headers: { 'Content-Type': 'application/json' }
});

// // Add token to requests dynamically (token may change after login)
// api.interceptors.request.use((config) => {
//     const token = localStorage.getItem("accessToken");
//     if (token) {
//         config.headers.Authorization = `Bearer ${token}`;
//     }
//     return config;
// });

export default api;