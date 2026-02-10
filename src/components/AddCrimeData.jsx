// src/components/AddCrimeData.jsx
import React, { useEffect, useRef, useState } from "react";
import "../styles/add-crime-data.css";

export default function AddCrimeData({ refreshCrimeLayer }) {
  const controlRef = useRef(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [stations, setStations] = useState(null);

  const [form, setForm] = useState({
    station_id: "",
    crime_type: "",
    year: new Date().getFullYear(),
    crime_count: "",
  });

  // ✅ Check login state
  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
  }, []);

  // ✅ Fetch stations from Express API
  useEffect(() => {
    if (!isLoggedIn) return;
    const fetchStations = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/police-stations", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        if (!res.ok) throw new Error("Failed to fetch stations");
        const data = await res.json();
        setStations(data);
      } catch (err) {
        console.error("Error fetching stations:", err);
      }
    };
    fetchStations();
  }, [isLoggedIn]);

  // ✅ Block map events but allow normal click
  useEffect(() => {
    if (!isLoggedIn) return;
    const el = controlRef.current;
    if (!el) return;
    const stop = (e) => e.stopPropagation();
    ["dblclick", "wheel", "touchmove"].forEach((evt) =>
      el.addEventListener(evt, stop, { passive: true })
    );
    return () => {
      ["dblclick", "wheel", "touchmove"].forEach((evt) =>
        el.removeEventListener(evt, stop)
      );
    };
  }, [isLoggedIn]);

  if (!isLoggedIn) return null;

  // ✅ Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch("http://localhost:5000/api/crime-records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (data.success) {
        alert("Crime data updated successfully!");
        setShowForm(false);
        refreshCrimeLayer?.();
      } else {
        alert(data.error || "Error updating crime data.");
      }
    } catch (err) {
      console.error("Submit failed:", err);
      alert("Failed to submit crime data.");
    }
  };

  return (
    <div className="add-crime-control" ref={controlRef}>
      {/* Toggle button */}
      <button
        className="add-crime-btn"
        title="Add Crime Data"
        onClick={() => setShowForm((v) => !v)}
      >
        + Add Crime Data
      </button>

      {/* Form */}
      {showForm && (
        <div className="add-crime-form">
          <form onSubmit={handleSubmit}>
            <label>
              Police Station
              {!stations ? (
                <div style={{ fontSize: "12px", color: "#666" }}>
                  Loading stations...
                </div>
              ) : (
                <select
                  value={form.station_id}
                  onChange={(e) =>
                    setForm({ ...form, station_id: e.target.value })
                  }
                  required
                >
                  <option value="">-- Select --</option>
                  {stations.map((s) => (
                    <option key={s.station_id} value={s.station_id}>
                      {s.station_name}
                    </option>
                  ))}
                </select>
              )}
            </label>

            <label>
              Crime Type
              <select
                value={form.crime_type}
                onChange={(e) =>
                  setForm({ ...form, crime_type: e.target.value })
                }
                required
              >
                <option value="">-- Select --</option>
                <option value="NDPS">NDPS</option>
                <option value="Theft">Theft</option>
                <option value="Crime Against Children">
                  Crime Against Children
                </option>
                <option value="Crime Against Women">Crime Against Women</option>
                <option value="Kidnap">Kidnap</option>
                <option value="Murder">Murder</option>
              </select>
            </label>

            <label>
              Year
              <input
                type="number"
                value={form.year}
                onChange={(e) =>
                  setForm({ ...form, year: parseInt(e.target.value) })
                }
                required
              />
            </label>

            <label>
              Count
              <input
                type="number"
                value={form.crime_count}
                onChange={(e) =>
                  setForm({ ...form, crime_count: parseInt(e.target.value) })
                }
                required
              />
            </label>

            <button type="submit">Save</button>
          </form>
        </div>
      )}
    </div>
  );
}
