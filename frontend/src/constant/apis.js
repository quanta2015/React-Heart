const mode = import.meta.env.MODE;

var API_SERVER = "http://localhost:3000";

if (mode === "development") {
  API_SERVER = "http://localhost:3000";
}

if (mode === "production") {
  API_SERVER = "https://mantt.asia:8443";
}

export { API_SERVER };
