const mode = import.meta.env.MODE;

var API_SERVER = "http://localhost:3000";

if (mode === "development") {
  API_SERVER = "http://localhost:3000";
}

if (mode === "production") {
  API_SERVER = "http://121.40.124.170:9000";
}

export { API_SERVER };
