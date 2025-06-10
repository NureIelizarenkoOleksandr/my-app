import { useEffect, useState } from "react";
import "./App.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";

const API_BASE = "http://localhost:8000";

function App() {
    const [token, setToken] = useState(localStorage.getItem("token"));
    const [view, setView] = useState(token ? "routes" : "auth");
    const [authMode, setAuthMode] = useState("login");

    const handleLogin = async (e) => {
        e.preventDefault();
        const form = new FormData(e.target);
        const body = new URLSearchParams();
        body.append("username", form.get("email"));
        body.append("password", form.get("password"));

        try {
            const res = await fetch(`${API_BASE}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body,
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem("token", data.access_token);
                setToken(data.access_token);
                setView("routes");
            } else {
                alert(data.detail || "Помилка входу");
            }
        } catch (err) {
            console.error(err);
            alert("Помилка з'єднання");
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        const form = new FormData(e.target);
        const payload = {
            email: form.get("email"),
            password: form.get("password"),
            username: form.get("username"),
        };

        try {
            const res = await fetch(`${API_BASE}/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (res.ok) {
                alert("Реєстрація успішна, увійдіть");
                setView("auth");
            } else {
                alert(data.detail || "Помилка реєстрації");
            }
        } catch (err) {
            console.error(err);
            alert("Помилка з'єднання");
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        setToken(null);
        setView("auth");
    };

    if (view === "auth") {
        return (
            <div className="auth-wrapper">
                <div className="auth">
                    {authMode === "login" ? (
                        <>
                            <h2>Вхід</h2>
                            <form onSubmit={handleLogin}>
                                <input name="email" placeholder="Email" required />
                                <input name="password" type="password" placeholder="Пароль" required />
                                <button type="submit">Увійти</button>
                            </form>
                            <p className="auth-toggle">
                                Немає акаунту?{" "}
                                <span onClick={() => setAuthMode("register")} className="link">
                                    Зареєструватися
                                </span>
                            </p>
                        </>
                    ) : (
                        <>
                            <h2>Реєстрація</h2>
                            <form onSubmit={handleRegister}>
                                <input name="username" placeholder="Ім'я користувача" required />
                                <input name="email" placeholder="Email" required />
                                <input name="password" type="password" placeholder="Пароль" required />
                                <button type="submit">Зареєструватися</button>
                            </form>
                            <p className="auth-toggle">
                                Вже маєте акаунт?{" "}
                                <span onClick={() => setAuthMode("login")} className="link">
                                    Увійти
                                </span>
                            </p>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return <MainApp token={token} onLogout={handleLogout} />;
}

function MainApp({ token, onLogout }) {
    const [tab, setTab] = useState("routes");
    const [mapCoords, setMapCoords] = useState(null);

    return (
        <div className="app">
            <aside className="sidebar">
                <button onClick={() => setTab("routes")}>ВСІ МАРШРУТИ</button>
                <button onClick={() => setTab("search")}>ПОШУК МАРШРУТУ</button>
                <button onClick={onLogout}>Вийти</button>
            </aside>
            <main>
                {tab === "routes" && <RoutesPage token={token} onLogout={onLogout} />}
                {tab === "search" && <SearchRoute token={token} onShowOnMap={setMapCoords} />}
                {tab === "map" && <MapView coords={mapCoords} />}
            </main>
        </div>
    );
}

function RoutesPage({ token, onLogout }) {
    const [routes, setRoutes] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedRoute, setSelectedRoute] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        if (selectedRoute) return;

        const fetchRoutes = async () => {
            try {
                const res = await fetch(`${API_BASE}/routes/routes?page=${page}&size=10`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (res.status === 401) {
                    onLogout();
                    return;
                }

                const data = await res.json();
                setRoutes(data.items);
                setTotalPages(data.pages);
            } catch (err) {
                console.error(err);
                alert("Помилка завантаження маршрутів");
            }
        };

        fetchRoutes();
    }, [page, token, selectedRoute, onLogout]);

    const handleSelectRoute = async (routeId) => {
        setLoadingDetails(true);
        try {
            const res = await fetch(`${API_BASE}/routes/routes/${routeId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.status === 401) {
                onLogout();
                return;
            }

            if (!res.ok) {
                alert("Не вдалося завантажити деталі маршруту");
                setLoadingDetails(false);
                return;
            }

            const data = await res.json();
            setSelectedRoute(data);
        } catch (err) {
            console.error(err);
            alert("Помилка завантаження деталей маршруту");
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleBack = () => {
        setSelectedRoute(null);
    };

    if (selectedRoute) {
        return (
            <>
                <h1>{selectedRoute.name} (Маршрут №{selectedRoute.route_number})</h1>
                <p>Дистанція: {selectedRoute.distance} км</p>
                <p>Середня затримка: {selectedRoute.average_delay_minutes} хв</p>

                <h2>Розклад</h2>
                {loadingDetails ? (
                    <p>Завантаження...</p>
                ) : selectedRoute.schedules.length > 0 ? (
                    <ul>
                        {selectedRoute.schedules.map((s) => (
                            <li key={s.id}>
                                {s.departure_time} → {s.arrival_time}
                                <ul>
                                    <li>Тип транспорту: {s.vehicle.vehicle_type}</li>
                                    <li>Реєстраційний номер: {s.vehicle.registration_number}</li>
                                    <li>Марка: {s.vehicle.brand}</li>
                                    <li>Модель: {s.vehicle.model}</li>
                                    <li>Вмістимість: {s.vehicle.capacity} осіб</li>
                                </ul>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>Розклад відсутній</p>
                )}
                <button onClick={handleBack}>← Назад</button>
            </>
        );
    }

    return (
        <>
            <h1>Маршрути</h1>
            {routes.map((route) => (
                <div key={route.id} className="route" onClick={() => handleSelectRoute(route.id)}>
                    <h3>{route.name}</h3>
                </div>
            ))}
            <div className="pagination">
                <button onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page === 1}>
                    Назад
                </button>
                <span>
                    Сторінка {page} з {totalPages}
                </span>
                <button onClick={() => setPage((p) => Math.min(p + 1, totalPages))} disabled={page === totalPages}>
                    Вперед
                </button>
            </div>
        </>
    );
}

function SearchRoute({ token }) {
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [results, setResults] = useState([]);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!from || !to) return alert("Заповніть обидва поля");

        try {
            const res = await fetch(`${API_BASE}/routes/departures-between-stops/${from}/${to}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await res.json();
            if (!Array.isArray(data)) {
                alert("Маршрутів не знайдено");
                return;
            }

            setResults(data);
        } catch (err) {
            console.error(err);
            alert("Помилка пошуку маршруту");
        }
    };
    const handleShowOnMap = async (vehicleId) => {
        const newWindow = window.open();
        if (!newWindow) {
            alert("Відкриття нового вікна заблоковано браузером");
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/routes/vehicle/${vehicleId}/location`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                newWindow.close();
                alert("Не вдалося отримати координати");
                return;
            }

            const data = await res.json();
            if (!data.lat || !data.lng) {
                newWindow.close();
                alert("Невірні координати");
                return;
            }

            const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Карта транспорту</title>
          <meta charset="UTF-8" />
          <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
          <style>
            html, body, #map {
              height: 100%;
              margin: 0;
              padding: 0;
            }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
          <script>
            document.addEventListener("DOMContentLoaded", function () {
              const map = L.map('map').setView([${data.lat}, ${data.lng}], 15);
              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
              }).addTo(map);
              L.marker([${data.lat}, ${data.lng}]).addTo(map)
                .bindPopup('Транспорт тут').openPopup();
            });
          </script>
        </body>
        </html>
      `;

            newWindow.document.write(html);
            newWindow.document.close();

        } catch (error) {
            console.error("Помилка при запиті координат:", error);
            newWindow.close();
            alert("Помилка при завантаженні координат");
        }
    };

    return (
        <div>
            <h1>Пошук маршруту</h1>
            <form onSubmit={handleSearch} className="search-form">
                <input
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    placeholder="Початкова зупинка"
                />
                <input
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="Кінцева зупинка"
                />
                <button type="submit">Шукати</button>
            </form>

            <h2>Результати</h2>
            {results.length === 0 ? (
                <p>Немає результатів</p>
            ) : (
                <div className="search-results">
                    <ul>
                        {results.map((r, i) => (
                            <li key={i}>
                                <p><strong>Маршрут:</strong> {r.route_name} (№{r.route_number})</p>
                                <p><strong>Транспорт:</strong> {r.vehicle_name}</p>
                                <p><strong>Відправлення:</strong> {r.from_stop_time}</p>
                                <p><strong>Прибуття:</strong> {r.to_stop_time}</p>
                                <button onClick={() => handleShowOnMap(r.vehicle_id)}>📍 На мапі</button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}


export default App;
