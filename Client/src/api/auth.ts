import api from "./axios.ts";

interface DocumentResponse {
    id: string;
    userId: string,
    imageUrl: string,
    markdownContent: string,
    createdAt: string;
}

export const authenticateGoogle = () => {
    try {
        const response = api.post('/users/onboard');
        console.log(response);
        return response;
    } catch (err) {
        console.log(err);
    }
}

export const fileUpload = (imgUrl: string, token: string) => {
    try {
        const response = api.post('/users/scan', { imageUrl: imgUrl }, { headers: { Authorization: `Bearer ${token}` } })
        console.log(response);
        return response as DocumentResponse | any;
    } catch (err) {
        console.log(err);
    }
}

export const getGeminiResponse = () => {
    try {
        const response = api.post('/users/gemini')
        console.log(response);
        return response;
    } catch (err) {
        console.log(err);
    }
}

export const getDocuments = async (token: string | null) => {
    try {
        const response = await api.get('/documents', { headers: { Authorization: `Bearer ${token}` } });
        console.log(response);
        return response
    } catch (err) {
        console.log(err);
        throw err;
    }
}

export const createDocument = async (markdownContent: string, token: string | null) => {
    try {
        const response = await api.post('/documents',
            { markdownContent },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response;
    } catch (err) {
        console.log(err);
        throw err;
    }
}

export const updateDocument = async (id: string, markdownContent: string, token: string | null) => {
    try {
        const response = await api.put(`/documents/${id}`,
            { markdownContent },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response;
    } catch (err) {
        console.log(err);
        throw err;
    }
}

export const deleteDocument = async (id: string, token: string | null) => {
    try {
        const response = await api.delete(`/documents/${id}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response;
    } catch (err) {
        console.log(err);
        throw err;
    }
}