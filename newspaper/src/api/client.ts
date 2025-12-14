const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

const normalizeHeaders = (input?: HeadersInit): Record<string, string> => {
  if (!input) {
    return {};
  }

  if (input instanceof Headers) {
    const result: Record<string, string> = {};
    input.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  if (Array.isArray(input)) {
    return input.reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  }

  return { ...(input as Record<string, string>) };
};

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
}

export async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

    const headers = normalizeHeaders(options.headers);

    if (!isFormData) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    if (authToken) {
      headers.Authorization = headers.Authorization || `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: (data && data.error) || `HTTP error! status: ${response.status}`,
      };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export { API_BASE_URL };


